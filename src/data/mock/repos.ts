// Mock implementations of the repositories (SPEC §12). Public reads go through the same
// rules as the Postgres views: approved orgs only, listed and not hidden, no quantity, no reporter.
import { fetchCatalog, mapCatalog, type RawCatalog } from '../catalog';
import { matchCatalog } from '../../lib/search';
import { normalizeArabic } from '../../lib/normalizeArabic';
import type {
  AccountRepo,
  AvailabilityRepo,
  CatalogRepo,
  GovFilter,
  InsightsRepo,
  OrgRepo,
  PharmacyAvailability,
  PublicPharmacy,
  ReportsRepo,
  Repos,
  Session,
  SettingsRepo,
} from '../types';
import { newId, store, type OrgRow, type StockRow, type UserRow } from './store';
import medicinesSeed from './seed/medicines.json';
import categoriesSeed from './seed/categories.json';

const LATENCY_MS = 120;
const latency = <T>(value: T): Promise<T> => new Promise((r) => setTimeout(() => r(value), LATENCY_MS));

const catalog = mapCatalog({ version: 1, categories: categoriesSeed, medicines: medicinesSeed } as RawCatalog);

const inGov = (gov: GovFilter | undefined, orgGov: string) => !gov || gov === 'all' || gov === orgGov;

function publicOrgs() {
  return new Map(store.get().orgs.filter((o) => o.verificationStatus === 'approved').map((o) => [o.id, o]));
}

function toPublicRow(s: StockRow): PharmacyAvailability {
  return {
    pharmacyId: s.pharmacyId,
    medicineId: s.medicineId,
    reportedStatus: s.reportedStatus,
    reportedAt: s.reportedAt,
    priceIls: s.priceIls,
    priceUpdatedAt: s.priceUpdatedAt,
  };
}

function publicStock(gov?: GovFilter) {
  const orgs = publicOrgs();
  return store.get().stock.filter((s) => {
    const o = orgs.get(s.pharmacyId);
    return o && s.isListed && !s.hiddenByAdmin && inGov(gov, o.governorate);
  });
}

function toPublicPharmacy(o: OrgRow): PublicPharmacy {
  const exact = o.locationPrecision === 'exact';
  const reports = store.get().stock.filter((s) => s.pharmacyId === o.id && s.isListed && !s.hiddenByAdmin);
  const last = reports.reduce<string | null>((m, s) => (!m || s.reportedAt > m ? s.reportedAt : m), null);
  return {
    id: o.id,
    nameAr: o.nameAr,
    nameEn: o.nameEn,
    governorate: o.governorate,
    area: o.area,
    addressText: o.addressText,
    landmark: o.landmark,
    locationPrecision: o.locationPrecision,
    publicLat: exact ? o.private.exactLat : null,
    publicLng: exact ? o.private.exactLng : null,
    phone: o.phone,
    whatsapp: o.whatsapp,
    hours: o.hours,
    infoUpdatedAt: o.infoUpdatedAt,
    lastStockUpdateAt: last,
  };
}

const catalogRepo: CatalogRepo = {
  // Same file in both modes; the bundled seed is only a fallback (e.g. in tests).
  load: () => fetchCatalog().catch(() => catalog),
};

const availability: AvailabilityRepo = {
  searchMedicines(q, gov) {
    const rows = publicStock(gov);
    const hits = matchCatalog(catalog.medicines, q).map((medicine) => ({
      medicine,
      reports: rows.filter((r) => r.medicineId === medicine.id).map(toPublicRow),
    }));
    return latency(hits);
  },
  pharmaciesFor(medicineId, gov) {
    return latency(publicStock(gov).filter((r) => r.medicineId === medicineId).map(toPublicRow));
  },
  pharmacyReports(pharmacyId) {
    return latency(publicStock().filter((r) => r.pharmacyId === pharmacyId).map(toPublicRow));
  },
  recentlyUpdated(gov, withinMinutes, limit) {
    const since = new Date(Date.now() - withinMinutes * 60_000).toISOString();
    const latest = new Map<string, string>();
    for (const r of publicStock(gov)) {
      if (r.reportedAt < since) continue;
      const prev = latest.get(r.pharmacyId);
      if (!prev || r.reportedAt > prev) latest.set(r.pharmacyId, r.reportedAt);
    }
    const list = [...latest].map(([pharmacyId, at]) => ({ pharmacyId, at }));
    return latency(list.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit));
  },
  updateStock(pharmacyId, changes) {
    const now = new Date();
    store.mutate((s) => {
      const org = s.orgs.find((o) => o.id === pharmacyId);
      for (const c of changes) {
        // reported_at = LEAST(client time, now); a change older than the current report is ignored (SPEC §8).
        const client = new Date(c.clientUpdatedAt);
        const at = (client > now ? now : client).toISOString();
        let row = s.stock.find((r) => r.pharmacyId === pharmacyId && r.medicineId === c.medicineId);
        if (row && at < row.reportedAt) continue;
        if (!row) {
          row = { pharmacyId, medicineId: c.medicineId, reportedStatus: c.status, reportedAt: at, priceIls: null, priceUpdatedAt: null, isListed: true, hiddenByAdmin: false };
          s.stock.push(row);
        }
        const old = { status: row.reportedStatus, price: row.priceIls };
        row.reportedStatus = c.status;
        row.reportedAt = at;
        if (c.priceIls !== undefined) {
          row.priceIls = c.priceIls;
          row.priceUpdatedAt = c.priceIls == null ? null : at;
        }
        s.stockHistory.push({ pharmacyId, medicineId: c.medicineId, action: 'update', oldStatus: old.status, newStatus: c.status, oldPrice: old.price, newPrice: row.priceIls, actorId: s.sessionUserId, createdAt: now.toISOString() });

        // notify_alerts(): people waiting for this medicine in this governorate.
        if (org && (c.status === 'available' || c.status === 'limited')) {
          for (const a of s.alerts) {
            if (!a.active || a.medicineId !== c.medicineId || !inGov(a.governorate, org.governorate)) continue;
            a.active = false;
            a.notifiedAt = now.toISOString();
            s.notifications.push({
              id: newId(),
              userId: a.userId,
              kind: 'alert_met',
              data: { pharmacyId, medicineId: c.medicineId, governorate: org.governorate },
              link: `/medicine/${c.medicineId}?gov=${org.governorate}`,
              createdAt: now.toISOString(),
              readAt: null,
            });
          }
        }
      }
    });
    return latency(undefined);
  },
  confirmAll(pharmacyId, opts) {
    const now = new Date().toISOString();
    const count = store.mutate((s) => {
      const rows = s.stock.filter((r) => r.pharmacyId === pharmacyId && r.isListed);
      for (const r of rows) {
        r.reportedAt = now;
        if (opts?.pricesToo && r.priceIls != null) r.priceUpdatedAt = now;
      }
      s.stockHistory.push({ pharmacyId, medicineId: null, action: 'confirm_all', oldStatus: null, newStatus: null, oldPrice: null, newPrice: null, actorId: s.sessionUserId, count: rows.length, createdAt: now });
      return rows.length;
    });
    return latency(count);
  },
};

const orgs: OrgRepo = {
  pharmacies(gov) {
    return latency([...publicOrgs().values()].filter((o) => o.type === 'pharmacy' && inGov(gov, o.governorate)).map(toPublicPharmacy));
  },
  pharmacy(id) {
    const o = publicOrgs().get(id);
    return latency(o && o.type === 'pharmacy' ? toPublicPharmacy(o) : null);
  },
};

const insights: InsightsRepo = {
  logSearch(e) {
    store.mutate((s) => {
      s.searchLogs.push({
        queryNorm: normalizeArabic(e.query),
        medicineId: e.medicineId,
        governorate: e.governorate,
        resultCount: e.resultCount,
        createdAt: new Date().toISOString(),
      });
    });
    return latency(undefined);
  },
  topSearched(gov, limit) {
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const counts = new Map<string, number>();
    for (const l of store.get().searchLogs) {
      if (!l.medicineId || l.createdAt < since || !inGov(gov, String(l.governorate))) continue;
      counts.set(l.medicineId, (counts.get(l.medicineId) ?? 0) + 1);
    }
    const top = [...counts].map(([medicineId, count]) => ({ medicineId, count }));
    return latency(top.sort((a, b) => b.count - a.count).slice(0, limit));
  },
};

const settings: SettingsRepo = {
  get: () => latency({ ...store.get().settings }),
};

function currentUser(): UserRow | null {
  const s = store.get();
  return s.users.find((u) => u.id === s.sessionUserId) ?? null;
}

function requireUser(): UserRow {
  const u = currentUser();
  if (!u) throw new Error('not_signed_in');
  return u;
}

const toSession = (u: UserRow): Session => ({ userId: u.id, displayName: u.displayName, email: u.email, phone: u.phone });

const account: AccountRepo = {
  session: () => latency(currentUser() ? toSession(currentUser()!) : null),
  signInDemoPatient() {
    const u = store.mutate((s) => {
      s.sessionUserId = 'u-patient';
      return s.users.find((x) => x.id === 'u-patient')!;
    });
    return latency(toSession(u));
  },
  signOut() {
    store.mutate((s) => {
      s.sessionUserId = null;
    });
    return latency(undefined);
  },
  updateProfile(patch) {
    const u = requireUser();
    store.mutate(() => Object.assign(u, patch));
    return latency(toSession(u));
  },
  favorites() {
    const u = requireUser();
    return latency(store.get().favorites.filter((f) => f.userId === u.id));
  },
  toggleFavorite(entityType, entityId) {
    const u = requireUser();
    const on = store.mutate((s) => {
      const i = s.favorites.findIndex((f) => f.userId === u.id && f.entityType === entityType && f.entityId === entityId);
      if (i >= 0) {
        s.favorites.splice(i, 1);
        return false;
      }
      s.favorites.push({ userId: u.id, entityType, entityId, createdAt: new Date().toISOString() });
      return true;
    });
    return latency(on);
  },
  alerts() {
    const u = requireUser();
    return latency(store.get().alerts.filter((a) => a.userId === u.id));
  },
  createAlert(medicineId, governorate) {
    const u = requireUser();
    const alert = store.mutate((s) => {
      const existing = s.alerts.find((a) => a.userId === u.id && a.medicineId === medicineId && a.governorate === governorate && a.active);
      if (existing) return existing;
      const a = { id: newId(), userId: u.id, medicineId, governorate, active: true, createdAt: new Date().toISOString(), notifiedAt: null };
      s.alerts.push(a);
      return a;
    });
    return latency(alert);
  },
  stopAlert(id) {
    const u = requireUser();
    store.mutate((s) => {
      const a = s.alerts.find((x) => x.id === id && x.userId === u.id);
      if (a) a.active = false;
    });
    return latency(undefined);
  },
  notifications() {
    const u = requireUser();
    const list = store.get().notifications.filter((n) => n.userId === u.id);
    return latency([...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  },
  markNotificationsRead() {
    const u = requireUser();
    const now = new Date().toISOString();
    store.mutate((s) => s.notifications.forEach((n) => n.userId === u.id && !n.readAt && (n.readAt = now)));
    return latency(undefined);
  },
  sendInquiry(inq) {
    const u = requireUser();
    store.mutate((s) => {
      s.inquiries.push({ ...inq, id: newId(), userId: u.id, createdAt: new Date().toISOString(), status: 'new' });
    });
    return latency(undefined);
  },
  exportData() {
    const u = requireUser();
    const s = store.get();
    const mine = <T extends { userId: string }>(xs: T[]) => xs.filter((x) => x.userId === u.id);
    return latency({
      exportedAt: new Date().toISOString(),
      profile: toSession(u),
      favorites: mine(s.favorites),
      alerts: mine(s.alerts),
      notifications: mine(s.notifications),
      inquiries: mine(s.inquiries),
    });
  },
  deleteAccount() {
    const u = requireUser();
    store.mutate((s) => {
      const keep = <T extends { userId: string }>(xs: T[]) => xs.filter((x) => x.userId !== u.id);
      s.favorites = keep(s.favorites);
      s.alerts = keep(s.alerts);
      s.notifications = keep(s.notifications);
      s.inquiries = keep(s.inquiries);
      s.sessionUserId = null;
    });
    return latency(undefined);
  },
};

const reports: ReportsRepo = {
  submit(r) {
    store.mutate((s) => {
      s.reports.push({ ...r, id: newId(), createdAt: new Date().toISOString(), status: 'new' });
    });
    return latency(undefined);
  },
};

export const mockRepos: Repos = {
  catalog: catalogRepo,
  availability,
  orgs,
  insights,
  settings,
  account,
  reports,
  subscribe: (l) => {
    const off = store.subscribe(l);
    return () => void off();
  },
};
