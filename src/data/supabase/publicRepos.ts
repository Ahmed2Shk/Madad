// Supabase implementations of the public and patient repositories (SPEC §12, §13). Visitors read
// the public_availability view and approved rows only; RLS enforces it whatever the client asks.
import { fetchCatalog } from '../catalog';
import type {
  AccountRepo,
  AvailabilityRepo,
  Catalog,
  CatalogRepo,
  Favorite,
  GovFilter,
  InsightsRepo,
  OrgRepo,
  PublicPharmacy,
  ReportsRepo,
  Session,
  SettingsRepo,
  NotificationPrefs,
} from '../types';
import { DEFAULT_PREFS } from '../providerTypes';
import { auth, db, must, rpc } from './client';
import {
  toAlert,
  toAvailability,
  toMedicine,
  toNotification,
  toPublicPharmacy,
  toPublicSettings,
  type MedicineDbRow,
  type OrgDbRow,
  type StockDbRow,
} from './map';
import { DEMO_EMAILS, DEMO_PASSWORD } from './demoAccounts';
import { env } from '../../lib/env';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Links from mock mode (e.g. /pharmacy/ph-nour) are not UUIDs: treat as not found, not as an error. */
export const isUuid = (id: string) => UUID.test(id);

const byGov = (gov: GovFilter | undefined) => (gov && gov !== 'all' ? gov : null);
const AVAILABILITY_COLS = 'pharmacy_id, medicine_id, reported_status, reported_at, price_ils, price_updated_at';

// ---------------------------------------------------------------- catalog

const CATALOG_TTL = 5 * 60_000;
let catalogCache: { at: number; value: Promise<Catalog> } | null = null;

async function loadCatalog(): Promise<Catalog> {
  try {
    const [cats, meds] = await Promise.all([
      db.from('categories').select('id, name_ar, name_en').order('sort_order'),
      db.from('medicines').select('id, name_ar, name_en, generic_name, strength, strength_en, dosage_form, pack_size, pack_size_en, manufacturer, barcode, aliases, category_id').eq('status', 'approved').order('sort_order'),
    ]);
    return {
      version: 1,
      categories: must(cats).map((c: { id: string; name_ar: string; name_en: string }) => ({ id: c.id, nameAr: c.name_ar, nameEn: c.name_en })),
      medicines: must(meds).map((m: MedicineDbRow) => toMedicine(m)),
    };
  } catch {
    // Offline or the database is paused: the local catalog file still works (SPEC §11).
    return fetchCatalog();
  }
}

/** The approved catalog, as of the last few minutes. forceCatalogReload() after admin changes. */
export function currentCatalog(): Promise<Catalog> {
  if (!catalogCache || Date.now() - catalogCache.at > CATALOG_TTL) {
    const value = loadCatalog();
    catalogCache = { at: Date.now(), value };
    value.catch(() => (catalogCache = null));
  }
  return catalogCache.value;
}
export const forceCatalogReload = () => void (catalogCache = null);

export const catalogRepo: CatalogRepo = { load: currentCatalog };

// ---------------------------------------------------------------- availability

async function publicRows(filter: { medicineIds?: string[]; medicineId?: string; pharmacyId?: string; gov?: GovFilter; since?: string }) {
  let q = db.from('public_availability').select(AVAILABILITY_COLS);
  if (filter.medicineIds) q = q.in('medicine_id', filter.medicineIds);
  if (filter.medicineId) q = q.eq('medicine_id', filter.medicineId);
  if (filter.pharmacyId) q = q.eq('pharmacy_id', filter.pharmacyId);
  if (byGov(filter.gov)) q = q.eq('governorate', byGov(filter.gov)!);
  if (filter.since) q = q.gte('reported_at', filter.since);
  return must(await q.limit(5000)).map((r: StockDbRow) => toAvailability(r));
}

export const availabilityRepo: AvailabilityRepo = {
  async searchMedicines(q, gov) {
    const hits = await rpc<{ medicine_id: string }[]>('search_medicines', { q, gov: gov ?? 'all' });
    if (!hits.length) return [];
    const ids = hits.map((h) => h.medicine_id);
    let catalog = await currentCatalog();
    if (ids.some((id) => !catalog.medicines.some((m) => m.id === id))) {
      forceCatalogReload();
      catalog = await currentCatalog();
    }
    const reports = await publicRows({ medicineIds: ids, gov });
    const byId = new Map(catalog.medicines.map((m) => [m.id, m]));
    return ids.flatMap((id) => {
      const medicine = byId.get(id);
      return medicine ? [{ medicine, reports: reports.filter((r) => r.medicineId === id) }] : [];
    });
  },

  pharmaciesFor: (medicineId, gov) => publicRows({ medicineId, gov }),

  async pharmacyReports(pharmacyId, opts) {
    if (!isUuid(pharmacyId)) return [];
    if (opts?.preview) {
      // A member previewing their own not-yet-approved pharmacy (PH-07): RLS lets members read their rows.
      const r = await db.from('pharmacy_stock').select(AVAILABILITY_COLS).eq('pharmacy_id', pharmacyId).eq('is_listed', true).eq('hidden_by_admin', false);
      return must(r).map((x: StockDbRow) => toAvailability(x));
    }
    return publicRows({ pharmacyId });
  },

  async recentlyUpdated(gov, withinMinutes, limit) {
    const since = new Date(Date.now() - withinMinutes * 60_000).toISOString();
    const latest = new Map<string, string>();
    for (const r of await publicRows({ gov, since })) {
      const prev = latest.get(r.pharmacyId);
      if (!prev || r.reportedAt > prev) latest.set(r.pharmacyId, r.reportedAt);
    }
    return [...latest]
      .map(([pharmacyId, at]) => ({ pharmacyId, at }))
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, limit);
  },

  async updateStock(pharmacyId, changes) {
    await rpc('update_stock', { pharmacy: pharmacyId, changes });
  },

  confirmAll: (pharmacyId, opts) => rpc<number>('confirm_all', { pharmacy: pharmacyId, prices_too: !!opts?.pricesToo }),
};

// ---------------------------------------------------------------- organizations

const ORG_COLS =
  'id, type, name_ar, name_en, governorate, area, address_text, landmark, location_precision, public_lat, public_lng, phone, whatsapp, hours, description, website, locations, verification_status, suspended_reason, temporarily_closed, closed_reason, info_updated_at';
export { ORG_COLS };

async function lastUpdates(ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  const r = await db.from('public_pharmacy_updates').select('pharmacy_id, last_stock_update_at').in('pharmacy_id', ids);
  return new Map(must(r).map((x: { pharmacy_id: string; last_stock_update_at: string }) => [x.pharmacy_id, x.last_stock_update_at]));
}

export const orgRepo: OrgRepo = {
  async pharmacies(gov) {
    let q = db.from('organizations').select(ORG_COLS).eq('type', 'pharmacy').eq('verification_status', 'approved');
    if (byGov(gov)) q = q.eq('governorate', byGov(gov)!);
    const orgs = must(await q.order('created_at')) as OrgDbRow[];
    const last = await lastUpdates(orgs.map((o) => o.id));
    return orgs.map((o) => toPublicPharmacy(o, last.get(o.id) ?? null));
  },

  async pharmacy(id, opts): Promise<PublicPharmacy | null> {
    if (!isUuid(id)) return null;
    const o = must(await db.from('organizations').select(ORG_COLS).eq('id', id).maybeSingle()) as OrgDbRow | null;
    if (!o || o.type !== 'pharmacy') return null;
    if (o.verification_status !== 'approved' && !opts?.preview) return null;
    if (o.verification_status === 'approved') return toPublicPharmacy(o, (await lastUpdates([id])).get(id) ?? null);
    const rows = await availabilityRepo.pharmacyReports(id, { preview: true });
    const last = rows.reduce<string | null>((m, r) => (!m || r.reportedAt > m ? r.reportedAt : m), null);
    return toPublicPharmacy(o, last);
  },
};

// ---------------------------------------------------------------- insights, settings, reports

export const insightsRepo: InsightsRepo = {
  async viewPharmacy(pharmacyId) {
    if (isUuid(pharmacyId)) await rpc('view_pharmacy', { pharmacy: pharmacyId });
  },
  async logSearch(e) {
    await rpc('log_search', { q: e.query, gov: e.governorate, medicine: e.medicineId, result_count: e.resultCount });
  },
  async topSearched(gov, limit) {
    const r = await rpc<{ medicine_id: string; count: number }[]>('top_searched', { gov, lim: limit });
    return r.map((x) => ({ medicineId: x.medicine_id, count: x.count }));
  },
};

export const settingsRepo: SettingsRepo = {
  async get() {
    // Visitors receive only is_public rows (RLS); toPublicSettings ignores any others.
    return toPublicSettings(must(await db.from('settings').select('key, value')));
  },
};

export const reportsRepo: ReportsRepo = {
  async submit(r) {
    must(await db.from('reports').insert({ entity_type: r.entityType, entity_id: r.entityId, reason: r.reason, details: r.details, governorate: r.governorate ?? null }));
  },
};

// ---------------------------------------------------------------- account (patients)

export async function currentUserId(): Promise<string | null> {
  const { data } = await auth.getSession();
  return data.session?.user.id ?? null;
}

async function requireUserId(): Promise<string> {
  const id = await currentUserId();
  if (!id) throw new Error('not_signed_in');
  return id;
}

export async function sessionOf(userId: string): Promise<Session> {
  const [{ data }, profile] = await Promise.all([
    auth.getSession(),
    db.from('profiles').select('full_name, phone').eq('id', userId).single(),
  ]);
  const p = must(profile) as { full_name: string; phone: string | null };
  return { userId, displayName: p.full_name, email: data.session?.user.email ?? '', phone: p.phone };
}

export const accountRepo: AccountRepo = {
  async session() {
    const id = await currentUserId();
    return id ? sessionOf(id) : null;
  },

  async signInDemoPatient() {
    if (!env.demo) throw new Error('forbidden');
    const { data, error } = await auth.signInWithPassword({ email: DEMO_EMAILS['u-patient']!, password: DEMO_PASSWORD });
    if (error || !data.user) throw error ?? new Error('sign_in_failed');
    return sessionOf(data.user.id);
  },

  async signOut() {
    await auth.signOut();
  },

  async updateProfile(patch) {
    const id = await requireUserId();
    const row: Record<string, unknown> = {};
    if (patch.displayName !== undefined) row.full_name = patch.displayName.trim();
    if (patch.phone !== undefined) row.phone = patch.phone;
    must(await db.from('profiles').update(row).eq('id', id));
    return sessionOf(id);
  },

  async favorites() {
    await requireUserId();
    const r = await db.from('favorites').select('entity_type, entity_id, created_at').order('created_at');
    return must(r).map((f: { entity_type: Favorite['entityType']; entity_id: string; created_at: string }) => ({ entityType: f.entity_type, entityId: f.entity_id, createdAt: new Date(f.created_at).toISOString() }));
  },

  async toggleFavorite(entityType, entityId) {
    const user_id = await requireUserId();
    const existing = must(await db.from('favorites').select('entity_id').eq('entity_type', entityType).eq('entity_id', entityId));
    if (existing.length) {
      must(await db.from('favorites').delete().eq('entity_type', entityType).eq('entity_id', entityId));
      return false;
    }
    must(await db.from('favorites').insert({ user_id, entity_type: entityType, entity_id: entityId }));
    return true;
  },

  async alerts() {
    await requireUserId();
    return must(await db.from('availability_alerts').select('*').order('created_at')).map(toAlert);
  },

  async createAlert(medicineId, governorate) {
    const user_id = await requireUserId();
    const existing = must(await db.from('availability_alerts').select('*').eq('medicine_id', medicineId).eq('governorate', governorate).eq('active', true).limit(1));
    if (existing[0]) return toAlert(existing[0]);
    return toAlert(must(await db.from('availability_alerts').insert({ user_id, medicine_id: medicineId, governorate }).select('*').single()));
  },

  async stopAlert(id) {
    await requireUserId();
    must(await db.from('availability_alerts').update({ active: false }).eq('id', id));
  },

  async notifications() {
    await requireUserId();
    return must(await db.from('notifications').select('id, kind, data, link, created_at, read_at').order('created_at', { ascending: false }).limit(200)).map(toNotification);
  },

  async markNotificationsRead() {
    await requireUserId();
    must(await db.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null));
  },

  async sendInquiry(inq) {
    await rpc('send_inquiry', { org: inq.orgId, medicine: inq.medicineId, subject: inq.subject, body: inq.body, service: inq.serviceId ?? null });
  },

  async exportData() {
    const id = await requireUserId();
    const [profile, favorites, alerts, notifications, inquiries] = await Promise.all([
      sessionOf(id),
      accountRepo.favorites(),
      accountRepo.alerts(),
      accountRepo.notifications(),
      db.from('inquiries').select('id, org_id, medicine_id, subject, status, created_at, updated_at, inquiry_messages(sender_side, body, created_at)').eq('patient_id', id),
    ]);
    return { exportedAt: new Date().toISOString(), profile, favorites, alerts, notifications, inquiries: must(inquiries) };
  },

  async deleteAccount() {
    await rpc('delete_my_account');
    await auth.signOut();
  },

  async changePassword(newPassword) {
    await requireUserId();
    const { error } = await auth.updateUser({ password: newPassword });
    if (error) throw error;
  },

  async signOutOtherDevices() {
    await requireUserId();
    const { error } = await auth.signOut({ scope: 'others' });
    if (error) throw error;
  },

  async prefs() {
    const id = await requireUserId();
    const p = must(await db.from('profiles').select('prefs').eq('id', id).single()) as { prefs: Partial<NotificationPrefs> | null };
    return { ...DEFAULT_PREFS, ...(p.prefs ?? {}) };
  },

  async updatePrefs(patch) {
    const id = await requireUserId();
    const next = { ...(await accountRepo.prefs()), ...patch };
    must(await db.from('profiles').update({ prefs: next }).eq('id', id));
    return next;
  },
};
