// Pharmacy portal data (PH-01..PH-08) in mock mode. Every call checks membership and permissions,
// the way has_org_perm() and RLS will in Postgres (SPEC §13).
import { freshnessOf } from '../../lib/freshness';
import { DEFAULT_PERMS } from '../perms';
import type { HistoryEntry, InquiryThread, PharmacyPortalRepo, PortalStockRow, TeamMember } from '../types';
import { AccessError, hasOrgPerm, latency, requireOrgPerm, requireOwner } from './access';
import { audit, newId, store, type MockState, type StockHistoryRow } from './store';

const DAY = 86_400_000;
const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10);

function org(s: MockState, orgId: string) {
  const o = s.orgs.find((x) => x.id === orgId);
  if (!o) throw new AccessError('forbidden');
  return o;
}

function toHistory(s: MockState, h: StockHistoryRow): HistoryEntry {
  return {
    id: h.id,
    medicineId: h.medicineId,
    action: h.action,
    oldStatus: h.oldStatus,
    newStatus: h.newStatus,
    oldPrice: h.oldPrice,
    newPrice: h.newPrice,
    actorName: s.users.find((u) => u.id === h.actorId)?.displayName ?? '—',
    count: h.count ?? null,
    createdAt: h.createdAt,
  };
}

function toThread(s: MockState, q: MockState['inquiries'][number]): InquiryThread {
  return {
    id: q.id,
    orgId: q.orgId,
    medicineId: q.medicineId,
    subject: q.subject,
    status: q.status,
    patientName: s.users.find((u) => u.id === q.patientId)?.displayName ?? '—',
    messages: q.messages,
    createdAt: q.createdAt,
    updatedAt: q.updatedAt,
  };
}

function history(s: MockState, orgId: string, entry: Omit<StockHistoryRow, 'id' | 'pharmacyId' | 'actorId' | 'createdAt'>) {
  s.stockHistory.push({ id: newId(), pharmacyId: orgId, actorId: s.sessionUserId, createdAt: new Date().toISOString(), ...entry });
}

export const pharmacyPortalRepo: PharmacyPortalRepo = {
  overview(orgId) {
    requireOrgPerm(orgId, 'member');
    const s = store.get();
    const o = org(s, orgId);
    const now = Date.now();
    const { freshHours, expireHours } = s.settings;
    const rows = s.stock.filter((r) => r.pharmacyId === orgId && r.isListed);
    const counts = { fresh: 0, stale: 0, expired: 0 };
    for (const r of rows) counts[freshnessOf(new Date(r.reportedAt), new Date(now), freshHours, expireHours)]++;

    const views = (from: number, to: number) =>
      s.pageViews
        .filter((v) => v.pharmacyId === orgId && v.day > dayKey(now - from * DAY) && v.day <= dayKey(now - to * DAY))
        .reduce((n, v) => n + v.count, 0);

    const mine = new Set(rows.map((r) => r.medicineId));
    const weekAgo = new Date(now - 7 * DAY).toISOString();
    const recentLogs = s.searchLogs.filter((l) => l.governorate === o.governorate && l.createdAt >= weekAgo && l.medicineId);
    const searchesByDay = Array.from({ length: 7 }, (_, i) => {
      const date = dayKey(now - (6 - i) * DAY);
      return { date, count: recentLogs.filter((l) => mine.has(l.medicineId!) && l.createdAt.slice(0, 10) === date).length };
    });

    // Searched with no result nearby, and not currently reported available here.
    const availableHere = new Set(
      rows
        .filter((r) => r.reportedStatus !== 'unavailable' && freshnessOf(new Date(r.reportedAt), new Date(now), freshHours, expireHours) === 'fresh')
        .map((r) => r.medicineId),
    );
    const unmet = new Map<string, number>();
    for (const l of recentLogs) if (l.resultCount === 0 && !availableHere.has(l.medicineId!)) unmet.set(l.medicineId!, (unmet.get(l.medicineId!) ?? 0) + 1);

    const activity = s.stockHistory
      .filter((h) => h.pharmacyId === orgId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 8)
      .map((h) => toHistory(s, h));

    return latency({
      listed: rows.length,
      ...counts,
      newInquiries: s.inquiries.filter((q) => q.orgId === orgId && q.status === 'new').length,
      viewsThisWeek: views(7, 0),
      viewsLastWeek: views(14, 7),
      searchesByDay,
      unmetNearby: [...unmet].map(([medicineId, count]) => ({ medicineId, count })).sort((a, b) => b.count - a.count).slice(0, 5),
      activity,
    });
  },

  stock(orgId) {
    requireOrgPerm(orgId, 'member');
    const s = store.get();
    // stock_private is readable only with the medicines permission (internal quantity, SPEC §8 PH-03).
    const withQty = hasOrgPerm(orgId, 'medicines');
    const rows: PortalStockRow[] = s.stock
      .filter((r) => r.pharmacyId === orgId)
      .map((r) => {
        const p = withQty ? s.stockPrivate.find((x) => x.pharmacyId === orgId && x.medicineId === r.medicineId) : undefined;
        return {
          pharmacyId: r.pharmacyId,
          medicineId: r.medicineId,
          reportedStatus: r.reportedStatus,
          reportedAt: r.reportedAt,
          priceIls: r.priceIls,
          priceUpdatedAt: r.priceUpdatedAt,
          isListed: r.isListed,
          hiddenByAdmin: r.hiddenByAdmin,
          quantity: p?.quantity ?? null,
          lowThreshold: p?.lowThreshold ?? null,
        };
      });
    return latency(rows);
  },

  history(orgId) {
    requireOrgPerm(orgId, 'member');
    const s = store.get();
    return latency(
      s.stockHistory
        .filter((h) => h.pharmacyId === orgId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((h) => toHistory(s, h)),
    );
  },

  setListed(orgId, medicineId, listed) {
    requireOrgPerm(orgId, 'medicines');
    store.mutate((s) => {
      const r = s.stock.find((x) => x.pharmacyId === orgId && x.medicineId === medicineId);
      if (!r || r.isListed === listed) return;
      r.isListed = listed;
      history(s, orgId, { medicineId, action: listed ? 'show' : 'hide', oldStatus: null, newStatus: null, oldPrice: null, newPrice: null });
      audit(s, listed ? 'stock.show' : 'stock.hide', 'pharmacy_stock', `${orgId}/${medicineId}`, { isListed: !listed }, { isListed: listed });
    });
    return latency(undefined);
  },

  removeMedicine(orgId, medicineId) {
    requireOrgPerm(orgId, 'medicines');
    store.mutate((s) => {
      const before = s.stock.length;
      s.stock = s.stock.filter((x) => !(x.pharmacyId === orgId && x.medicineId === medicineId));
      s.stockPrivate = s.stockPrivate.filter((x) => !(x.pharmacyId === orgId && x.medicineId === medicineId));
      if (s.stock.length === before) return;
      history(s, orgId, { medicineId, action: 'remove', oldStatus: null, newStatus: null, oldPrice: null, newPrice: null });
      audit(s, 'stock.remove', 'pharmacy_stock', `${orgId}/${medicineId}`, { listed: true }, null);
    });
    return latency(undefined);
  },

  addMedicine(orgId, medicineId, status) {
    requireOrgPerm(orgId, 'medicines');
    store.mutate((s) => {
      if (s.stock.some((x) => x.pharmacyId === orgId && x.medicineId === medicineId)) return;
      const now = new Date().toISOString();
      s.stock.push({ pharmacyId: orgId, medicineId, reportedStatus: status, reportedAt: now, priceIls: null, priceUpdatedAt: null, isListed: true, hiddenByAdmin: false });
      history(s, orgId, { medicineId, action: 'add', oldStatus: null, newStatus: status, oldPrice: null, newPrice: null });
      audit(s, 'stock.add', 'pharmacy_stock', `${orgId}/${medicineId}`, null, { status });
    });
    return latency(undefined);
  },

  setQuantity(orgId, medicineId, quantity, lowThreshold) {
    requireOrgPerm(orgId, 'medicines');
    store.mutate((s) => {
      const p = s.stockPrivate.find((x) => x.pharmacyId === orgId && x.medicineId === medicineId);
      if (p) Object.assign(p, { quantity, lowThreshold });
      else s.stockPrivate.push({ pharmacyId: orgId, medicineId, quantity, lowThreshold });
    });
    return latency(undefined);
  },

  requestMedicine(orgId, input) {
    requireOrgPerm(orgId, 'medicines');
    store.mutate((s) => {
      s.medicineRequests.push({ ...input, id: `req-${newId()}`, orgId, status: 'pending', createdAt: new Date().toISOString() });
    });
    return latency(undefined);
  },

  requests(orgId) {
    requireOrgPerm(orgId, 'member');
    return latency(
      store
        .get()
        .medicineRequests.filter((r) => r.orgId === orgId)
        .map(({ orgId: _o, ...r }) => r)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  },

  inquiries(orgId) {
    requireOrgPerm(orgId, 'member');
    const s = store.get();
    return latency(
      s.inquiries
        .filter((q) => q.orgId === orgId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((q) => toThread(s, q)),
    );
  },

  replyInquiry(orgId, inquiryId, body) {
    requireOrgPerm(orgId, 'inquiries');
    store.mutate((s) => {
      const q = s.inquiries.find((x) => x.id === inquiryId && x.orgId === orgId);
      if (!q) throw new AccessError('forbidden');
      const now = new Date().toISOString();
      q.messages.push({ sender: 'org', body: body.trim(), createdAt: now });
      q.status = 'replied';
      q.updatedAt = now;
      const o = org(s, orgId);
      s.notifications.push({
        id: newId(),
        userId: q.patientId,
        kind: 'inquiry_reply',
        data: { orgId, orgNameAr: o.nameAr, orgNameEn: o.nameEn, subject: q.subject },
        link: `/pharmacy/${orgId}`,
        createdAt: now,
        readAt: null,
      });
    });
    return latency(undefined);
  },

  setInquiryStatus(orgId, inquiryId, status) {
    requireOrgPerm(orgId, 'inquiries');
    store.mutate((s) => {
      const q = s.inquiries.find((x) => x.id === inquiryId && x.orgId === orgId);
      if (q) q.status = status;
    });
    return latency(undefined);
  },

  profile(orgId) {
    requireOrgPerm(orgId, 'member');
    const o = org(store.get(), orgId);
    return latency({
      id: o.id,
      type: o.type,
      nameAr: o.nameAr,
      nameEn: o.nameEn,
      licenseNo: o.private.licenseNo,
      governorate: o.governorate,
      area: o.area,
      addressText: o.addressText,
      landmark: o.landmark,
      locationPrecision: o.locationPrecision,
      exactLat: o.private.exactLat,
      exactLng: o.private.exactLng,
      phone: o.phone,
      whatsapp: o.whatsapp,
      hours: o.hours,
      description: o.description,
      temporarilyClosed: o.temporarilyClosed,
      verificationStatus: o.verificationStatus,
    });
  },

  updateProfile(orgId, patch) {
    requireOrgPerm(orgId, 'profile');
    const reReview = store.mutate((s) => {
      const o = org(s, orgId);
      const before = { nameAr: o.nameAr, nameEn: o.nameEn, licenseNo: o.private.licenseNo };
      const { licenseNo, exactLat, exactLng, ...pub } = patch;
      Object.assign(o, pub);
      if (licenseNo !== undefined) o.private.licenseNo = licenseNo;
      if (exactLat !== undefined) o.private.exactLat = exactLat;
      if (exactLng !== undefined) o.private.exactLng = exactLng;
      o.infoUpdatedAt = new Date().toISOString();
      const identityChanged =
        (patch.nameAr !== undefined && patch.nameAr !== before.nameAr) ||
        (patch.nameEn !== undefined && patch.nameEn !== before.nameEn) ||
        (licenseNo !== undefined && licenseNo !== before.licenseNo);
      if (identityChanged && o.verificationStatus === 'approved') {
        o.verificationStatus = 'pending';
        o.events.push({ action: 'profile_changed', note: null, createdAt: o.infoUpdatedAt });
        audit(s, 'verification.re_review', 'organization', orgId, { status: 'approved', ...before }, { status: 'pending' });
        return true;
      }
      audit(s, 'organization.update', 'organization', orgId, before, patch);
      return false;
    });
    return latency({ reReview });
  },

  team(orgId) {
    requireOrgPerm(orgId, 'member');
    const s = store.get();
    const o = org(s, orgId);
    const active: TeamMember[] = s.users.flatMap((u) => {
      const m = u.memberships.find((x) => x.orgId === orgId);
      return m ? [{ key: u.id, email: u.email, displayName: u.displayName, role: m.memberRole, perms: m.perms, status: 'active' as const }] : [];
    });
    const invited: TeamMember[] = o.invitations.map((i) => ({ key: i.email, email: i.email, displayName: null, role: i.role, perms: i.perms, status: 'invited' as const }));
    return latency([...active, ...invited]);
  },

  invite(orgId, email, role) {
    requireOwner(orgId);
    if (role === 'owner') throw new AccessError('forbidden');
    store.mutate((s) => {
      const o = org(s, orgId);
      const e = email.trim().toLowerCase();
      if (o.invitations.some((i) => i.email === e) || s.users.some((u) => u.email === e && u.memberships.some((m) => m.orgId === orgId))) return;
      o.invitations.push({ email: e, role, perms: DEFAULT_PERMS[role], createdAt: new Date().toISOString() });
      audit(s, 'team.invite', 'organization', orgId, null, { email: e, role });
    });
    return latency(undefined);
  },

  updateMember(orgId, key, patch) {
    requireOwner(orgId);
    if (patch.role === 'owner') throw new AccessError('forbidden');
    store.mutate((s) => {
      const o = org(s, orgId);
      const u = s.users.find((x) => x.id === key);
      const m = u?.memberships.find((x) => x.orgId === orgId);
      const target = m ?? o.invitations.find((i) => i.email === key);
      if (!target || ('memberRole' in target && target.memberRole === 'owner')) throw new AccessError('forbidden');
      const before = { role: 'memberRole' in target ? target.memberRole : target.role, perms: { ...target.perms } };
      if (patch.role) {
        if ('memberRole' in target) target.memberRole = patch.role;
        else target.role = patch.role;
        if (!patch.perms) target.perms = DEFAULT_PERMS[patch.role];
      }
      if (patch.perms) target.perms = patch.perms;
      audit(s, 'team.update', 'org_member', `${orgId}/${key}`, before, { role: patch.role ?? before.role, perms: target.perms });
    });
    return latency(undefined);
  },

  removeMember(orgId, key) {
    requireOwner(orgId);
    store.mutate((s) => {
      const o = org(s, orgId);
      const u = s.users.find((x) => x.id === key);
      if (u) {
        if (u.id === s.sessionUserId) throw new AccessError('forbidden');
        u.memberships = u.memberships.filter((m) => m.orgId !== orgId);
      } else {
        o.invitations = o.invitations.filter((i) => i.email !== key);
      }
      audit(s, 'team.remove', 'org_member', `${orgId}/${key}`, { key }, null);
    });
    return latency(undefined);
  },
};
