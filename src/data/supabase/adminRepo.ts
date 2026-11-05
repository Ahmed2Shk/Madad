// Admin panel (AD-01..AD-11) on Supabase. Search data is only ever read in aggregate, through
// admin_overview() and unmet_demand() (SPEC §13); everything else is read by reviewers under RLS.
import { freshnessOf, type FreshnessSettings } from '../../lib/freshness';
import { likelyDuplicates } from '../../lib/similarity';
import { GOVERNORATES } from '../governorates';
import type {
  AdminOrgRow,
  AdminOverview,
  AdminReport,
  AdminRepo,
  AuditEntry,
  ConflictRow,
  DocumentStatus,
  GovId,
  QualityRow,
  RequestReview,
  UnmetDemand,
  VerificationItem,
} from '../types';
import { db, must, rpc, storage } from './client';
import { iso, toEvent, toPlatformSettings, type OrgDbRow, type PrivateDbRow } from './map';
import { currentCatalog, forceCatalogReload, ORG_COLS } from './publicRepos';

const DAY = 86_400_000;
const digits = (p: string) => p.replace(/\D/g, '');
const palestineDay = (s: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Gaza' }).format(new Date(s));
const govOrder = new Map(GOVERNORATES.map((g, i) => [g.id, i]));
const byGovOrder = <T extends { governorate: GovId }>(xs: T[]) => [...xs].sort((a, b) => (govOrder.get(a.governorate) ?? 99) - (govOrder.get(b.governorate) ?? 99));

async function freshnessSettings(): Promise<FreshnessSettings> {
  return toPlatformSettings(must(await db.from('settings').select('key, value')));
}

interface DocRow {
  org_id: string;
  doc_type: string;
  file_name: string;
  size_bytes: number;
  mime: string;
  status: DocumentStatus;
  storage_path: string | null;
}

export const adminRepo: AdminRepo = {
  async overview() {
    const o = await rpc<AdminOverview>('admin_overview');
    return { ...o, freshnessByGov: byGovOrder(o.freshnessByGov), byGov: byGovOrder(o.byGov) };
  },

  async verificationQueue() {
    const [orgs, privs, docs, events] = await Promise.all([
      db.from('organizations').select(ORG_COLS),
      db.from('organization_private').select('org_id, license_no, exact_lat, exact_lng, contact_person, reviewer_notes'),
      db.from('org_documents').select('org_id, doc_type, file_name, size_bytes, mime, status, storage_path').order('created_at'),
      db.from('verification_events').select('org_id, action, note, created_at').order('created_at'),
    ]);
    const all = must(orgs) as OrgDbRow[];
    const priv = new Map((must(privs) as (PrivateDbRow & { org_id: string })[]).map((p) => [p.org_id, p]));
    const docRows = must(docs) as DocRow[];
    const eventRows = must(events) as (Parameters<typeof toEvent>[0] & { org_id: string })[];
    const rank: Record<string, number> = { pending: 0, needs_info: 1, rejected: 2, approved: 3, suspended: 4, draft: 5 };

    return all
      .filter((o) => o.verification_status !== 'draft')
      .map((o): VerificationItem => {
        const p = priv.get(o.id);
        const evs = eventRows.filter((e) => e.org_id === o.id).map(toEvent);
        const warnings: VerificationItem['warnings'] = [];
        for (const other of all) {
          if (other.id === o.id) continue;
          if (digits(other.phone) && digits(other.phone) === digits(o.phone)) warnings.push({ field: 'phone', otherOrgId: other.id, otherNameAr: other.name_ar, otherNameEn: other.name_en });
          const ol = priv.get(other.id)?.license_no;
          if (ol && ol === p?.license_no) warnings.push({ field: 'license', otherOrgId: other.id, otherNameAr: other.name_ar, otherNameEn: other.name_en });
        }
        return {
          orgId: o.id,
          type: o.type,
          nameAr: o.name_ar,
          nameEn: o.name_en,
          governorate: o.governorate,
          area: o.area,
          addressText: o.address_text,
          landmark: o.landmark,
          phone: o.phone,
          whatsapp: o.whatsapp,
          licenseNo: p?.license_no ?? '',
          contactPerson: p?.contact_person ?? '',
          exactLat: p?.exact_lat ?? null,
          exactLng: p?.exact_lng ?? null,
          status: o.verification_status,
          submittedAt: evs.find((e) => e.action === 'submitted')?.createdAt ?? new Date(o.info_updated_at).toISOString(),
          reviewerNote: p?.reviewer_notes ?? null,
          documents: docRows.filter((d) => d.org_id === o.id).map((d) => ({ docType: d.doc_type, fileName: d.file_name, size: d.size_bytes, mime: d.mime, status: d.status })),
          events: evs,
          warnings,
        };
      })
      .sort((a, b) => rank[a.status]! - rank[b.status]! || b.submittedAt.localeCompare(a.submittedAt));
  },

  async reviewOrg(orgId, decision, note) {
    await rpc('review_org', { org: orgId, decision, note });
  },

  async setDocumentStatus(orgId, fileName, status) {
    await rpc('set_document_status', { org: orgId, file_name: fileName, status });
  },

  async documentUrl(orgId, fileName) {
    const r = must(await db.from('org_documents').select('storage_path').eq('org_id', orgId).eq('file_name', fileName).not('storage_path', 'is', null).limit(1)) as { storage_path: string }[];
    if (!r[0]) return null;
    // Short-lived signed link (SPEC §13 Storage): the bucket itself is private.
    const { data, error } = await storage.from('org-docs').createSignedUrl(r[0].storage_path, 60);
    return error ? null : data.signedUrl;
  },

  async organizations() {
    const [orgs, stock, members] = await Promise.all([
      db.from('organizations').select(ORG_COLS).neq('verification_status', 'draft'),
      db.from('pharmacy_stock').select('pharmacy_id, reported_at').eq('is_listed', true).limit(20000),
      db.from('org_members').select('org_id').limit(20000),
    ]);
    const stockRows = must(stock) as { pharmacy_id: string; reported_at: string }[];
    const memberRows = must(members) as { org_id: string }[];
    return (must(orgs) as OrgDbRow[]).map((o): AdminOrgRow => {
      const mine = stockRows.filter((r) => r.pharmacy_id === o.id);
      const last = mine.reduce<string | null>((m, r) => (!m || r.reported_at > m ? r.reported_at : m), null);
      return {
        id: o.id,
        type: o.type,
        nameAr: o.name_ar,
        nameEn: o.name_en,
        governorate: o.governorate,
        verificationStatus: o.verification_status,
        suspendedReason: o.suspended_reason,
        listed: mine.length,
        lastStockUpdateAt: iso(last),
        members: memberRows.filter((m) => m.org_id === o.id).length,
      };
    });
  },

  async suspendOrg(orgId, reason) {
    await rpc('suspend_org', { org: orgId, reason });
  },

  async reactivateOrg(orgId) {
    await rpc('reactivate_org', { org: orgId });
  },

  async catalog() {
    forceCatalogReload();
    return currentCatalog();
  },

  async addCatalogMedicine(input) {
    const id = await rpc<string>('add_medicine', { input });
    forceCatalogReload();
    return id;
  },

  async setAliases(medicineId, aliases) {
    await rpc('set_aliases', { medicine: medicineId, aliases });
    forceCatalogReload();
  },

  async importCatalog(rows) {
    const n = await rpc<number>('import_catalog', { rows });
    forceCatalogReload();
    return n;
  },

  async requests() {
    const [r, catalog] = await Promise.all([
      db
        .from('medicines')
        .select('id, name_ar, name_en, generic_name, strength, dosage_form, pack_size, manufacturer, barcode, category_id, status, created_at, requested_by_org, organizations(name_ar, name_en)')
        .not('requested_by_org', 'is', null),
      adminRepo.catalog(),
    ]);
    const candidates = catalog.medicines.map((m) => ({ id: m.id, names: [m.nameAr, m.nameEn, `${m.genericName} ${m.strength}`] }));
    type Row = { id: string; name_ar: string; name_en: string; generic_name: string; strength: string; dosage_form: RequestReview['dosageForm']; pack_size: string; manufacturer: string | null; barcode: string | null; category_id: string; status: RequestReview['status']; created_at: string; requested_by_org: string; organizations: { name_ar: string; name_en: string } | null };
    return (must(r) as unknown as Row[])
      .map((m): RequestReview => ({
        id: m.id,
        orgId: m.requested_by_org,
        orgNameAr: m.organizations?.name_ar ?? '—',
        orgNameEn: m.organizations?.name_en ?? '—',
        nameAr: m.name_ar,
        nameEn: m.name_en,
        genericName: m.generic_name,
        strength: m.strength,
        dosageForm: m.dosage_form,
        packSize: m.pack_size,
        manufacturer: m.manufacturer,
        barcode: m.barcode,
        categoryId: m.category_id,
        status: m.status,
        createdAt: new Date(m.created_at).toISOString(),
        duplicates:
          m.status === 'pending'
            ? likelyDuplicates([m.name_ar, m.name_en, `${m.generic_name} ${m.strength}`], candidates.filter((c) => c.id !== m.id))
                .slice(0, 3)
                .map((d) => ({ medicineId: d.id, score: d.score }))
            : [],
      }))
      .sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1) || b.createdAt.localeCompare(a.createdAt));
  },

  async reviewRequest(id, decision, mergeInto) {
    await rpc('review_medicine', { id, decision, merge_into: mergeInto ?? null });
    forceCatalogReload();
  },

  async dataQuality() {
    const now = Date.now();
    const since30 = new Date(now - 30 * DAY).toISOString();
    const [settings, orgs, stock, history, reports] = await Promise.all([
      freshnessSettings(),
      db.from('organizations').select('id, name_ar, name_en, governorate').eq('type', 'pharmacy').eq('verification_status', 'approved'),
      db.from('pharmacy_stock').select('pharmacy_id, medicine_id, reported_status, reported_at, is_listed, hidden_by_admin').limit(20000),
      db.from('stock_history').select('pharmacy_id, action').gte('created_at', since30).in('action', ['update', 'confirm_all']).limit(20000),
      db.from('reports').select('id, entity_type, entity_id, reason, created_at').limit(5000),
    ]);
    const fresh = (at: string) => freshnessOf(new Date(at), new Date(now), settings.freshHours, settings.expireHours);
    const pharmacies = must(orgs) as Pick<OrgDbRow, 'id' | 'name_ar' | 'name_en' | 'governorate'>[];
    type S = { pharmacy_id: string; medicine_id: string; reported_status: string; reported_at: string; is_listed: boolean; hidden_by_admin: boolean };
    const stockRows = (must(stock) as S[]).filter((r) => r.is_listed && !r.hidden_by_admin);
    const historyRows = must(history) as { pharmacy_id: string; action: string }[];
    const reportRows = must(reports) as { id: string; entity_type: string; entity_id: string; reason: string; created_at: string }[];
    const counts = (ids: Set<string>) => {
      const out = { fresh: 0, stale: 0, expired: 0 };
      for (const r of stockRows) if (ids.has(r.pharmacy_id)) out[fresh(r.reported_at)]++;
      return out;
    };

    const byGov = GOVERNORATES.flatMap((g) => {
      const ids = new Set(pharmacies.filter((p) => p.governorate === g.id).map((p) => p.id));
      return ids.size ? [{ governorate: g.id, ...counts(ids) }] : [];
    });

    const rows: QualityRow[] = pharmacies.map((o) => {
      const mine = stockRows.filter((r) => r.pharmacy_id === o.id);
      const c = counts(new Set([o.id]));
      const h = historyRows.filter((x) => x.pharmacy_id === o.id);
      const last = mine.reduce<string | null>((m, r) => (!m || r.reported_at > m ? r.reported_at : m), null);
      return {
        pharmacyId: o.id,
        nameAr: o.name_ar,
        nameEn: o.name_en,
        governorate: o.governorate,
        listed: mine.length,
        freshRatio: mine.length ? c.fresh / mine.length : 0,
        lastUpdate: iso(last),
        reportsAgainst: reportRows.filter((r) => r.entity_id === o.id || r.entity_id.startsWith(`${o.id}/`)).length,
        confirmAllRatio: h.length ? h.filter((x) => x.action === 'confirm_all').length / h.length : 0,
      };
    });

    // A pharmacy said "available" and a patient reported it wrong the same day (Palestine time).
    const conflicts = reportRows.flatMap((r): ConflictRow[] => {
      if (r.reason !== 'wrong_availability' || r.entity_type !== 'availability') return [];
      const [pharmacyId, medicineId] = r.entity_id.split('/');
      const row = stockRows.find((x) => x.pharmacy_id === pharmacyId && x.medicine_id === medicineId);
      if (!row || row.reported_status === 'unavailable' || palestineDay(row.reported_at) !== palestineDay(r.created_at)) return [];
      return [{ pharmacyId: pharmacyId!, medicineId: medicineId!, reportedAt: new Date(row.reported_at).toISOString(), reportId: r.id, reportedWrongAt: new Date(r.created_at).toISOString() }];
    });

    return { byGov, pharmacies: rows.sort((a, b) => a.freshRatio - b.freshRatio), conflicts };
  },

  async remindPharmacy(pharmacyId) {
    await rpc('remind_pharmacy', { pharmacy: pharmacyId });
  },

  async hideReport(pharmacyId, medicineId, reason) {
    await rpc('hide_report', { pharmacy: pharmacyId, medicine: medicineId, reason });
  },

  async unmetDemand(days, categoryId, region) {
    const governorates = GOVERNORATES.filter((g) => g.region === region).map((g) => g.id);
    return rpc<UnmetDemand>('unmet_demand', {
      from_at: new Date(Date.now() - days * DAY).toISOString(),
      to_at: new Date().toISOString(),
      governorates,
      category: categoryId,
    });
  },

  async reports() {
    const r = await db.from('reports').select('id, entity_type, entity_id, reason, details, governorate, status, admin_note, resolution, created_at').order('created_at', { ascending: false });
    type Row = { id: string; entity_type: AdminReport['entityType']; entity_id: string; reason: AdminReport['reason']; details: string; governorate: string | null; status: AdminReport['status']; admin_note: string | null; resolution: string | null; created_at: string };
    return (must(r) as Row[]).map((x): AdminReport => ({
      id: x.id,
      entityType: x.entity_type,
      entityId: x.entity_id,
      reason: x.reason,
      details: x.details,
      ...(x.governorate ? { governorate: x.governorate } : {}),
      status: x.status,
      adminNote: x.admin_note,
      resolution: x.resolution,
      createdAt: new Date(x.created_at).toISOString(),
    }));
  },

  async updateReport(id, patch) {
    const row: Record<string, unknown> = {};
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.adminNote !== undefined) row.admin_note = patch.adminNote;
    if (patch.resolution !== undefined) row.resolution = patch.resolution;
    must(await db.from('reports').update(row).eq('id', id));
  },

  async audit() {
    const r = must(await db.from('audit_log').select('*').order('created_at', { ascending: false }).order('id', { ascending: false }).limit(2000)) as {
      id: number; actor_id: string | null; action: string; entity_type: string; entity_id: string; old_value: unknown; new_value: unknown; created_at: string;
    }[];
    const actorIds = [...new Set(r.map((a) => a.actor_id).filter((x): x is string => !!x))];
    const [profiles, members] = actorIds.length
      ? await Promise.all([
          db.from('profiles').select('id, full_name, platform_role').in('id', actorIds),
          db.from('org_members').select('user_id, member_role, created_at').in('user_id', actorIds).order('created_at'),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];
    const names = new Map((must(profiles) as { id: string; full_name: string; platform_role: string | null }[]).map((p) => [p.id, p]));
    const roles = new Map<string, string>();
    for (const m of must(members) as { user_id: string; member_role: string }[]) if (!roles.has(m.user_id)) roles.set(m.user_id, m.member_role);
    return r.map((a): AuditEntry => {
      const p = a.actor_id ? names.get(a.actor_id) : undefined;
      return {
        id: String(a.id),
        actorName: p?.full_name ?? '—',
        actorRole: !a.actor_id ? 'system' : (p?.platform_role ?? roles.get(a.actor_id) ?? 'patient'),
        action: a.action,
        entityType: a.entity_type,
        entityId: a.entity_id,
        oldValue: a.old_value,
        newValue: a.new_value,
        createdAt: new Date(a.created_at).toISOString(),
      };
    });
  },

  async settings() {
    return toPlatformSettings(must(await db.from('settings').select('key, value')));
  },

  async updateSettings(patch) {
    await rpc('update_settings', { patch });
  },
};
