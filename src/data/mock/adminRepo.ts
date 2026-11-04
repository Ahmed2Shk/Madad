// Mock admin repository (AD-01..AD-11). Reviewer actions need is_platform('reviewer'); settings and
// the audit log need super_admin. The admin can hide or suspend, but never create availability.
import { GOVERNORATES } from '../governorates';
import { freshnessOf } from '../../lib/freshness';
import { likelyDuplicates } from '../../lib/similarity';
import { suppress, MIN_CELL } from '../../lib/suppression';
import type {
  AdminOrgRow,
  AdminRepo,
  AuditEntry,
  GovId,
  MedicineRequestInput,
  VerificationItem,
} from '../types';
import { AccessError, latency, requirePlatform } from './access';
import { currentCatalog } from './catalogData';
import { audit, newId, store, type CatalogMedicineRow, type MockState, type OrgRow } from './store';

const DAY = 86_400_000;
const dayKey = (t: number | string) => new Date(t).toISOString().slice(0, 10);
const palestineDay = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Gaza' }).format(new Date(iso));
const digits = (p: string) => p.replace(/\D/g, '');

function freshCounts(s: MockState, pharmacyIds: Set<string>, now: number) {
  const out = { fresh: 0, stale: 0, expired: 0 };
  for (const r of s.stock) {
    if (!pharmacyIds.has(r.pharmacyId) || !r.isListed || r.hiddenByAdmin) continue;
    out[freshnessOf(new Date(r.reportedAt), new Date(now), s.settings.freshHours, s.settings.expireHours)]++;
  }
  return out;
}

const approvedPharmacies = (s: MockState) => s.orgs.filter((o) => o.type === 'pharmacy' && o.verificationStatus === 'approved');

function byGovFreshness(s: MockState, now: number) {
  return GOVERNORATES.flatMap((g) => {
    const ids = new Set(approvedPharmacies(s).filter((o) => o.governorate === g.id).map((o) => o.id));
    return ids.size ? [{ governorate: g.id, ...freshCounts(s, ids, now) }] : [];
  });
}

function slug(s: MockState, nameEn: string) {
  const base = nameEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'medicine';
  const ids = new Set(currentCatalog().medicines.map((m) => m.id));
  let id = base;
  for (let i = 2; ids.has(id) || s.catalogAdditions.some((m) => m.id === id); i++) id = `${base}-${i}`;
  return id;
}

function toCatalogRow(id: string, m: MedicineRequestInput & { aliases: string[] }): CatalogMedicineRow {
  return {
    id,
    name_ar: m.nameAr.trim(),
    name_en: m.nameEn.trim(),
    generic_name: m.genericName.trim(),
    strength: m.strength.trim(),
    dosage_form: m.dosageForm,
    pack_size: m.packSize.trim(),
    manufacturer: m.manufacturer,
    barcode: m.barcode,
    aliases: m.aliases,
    category_id: m.categoryId,
  };
}

function notifyMembers(s: MockState, orgId: string, kind: 'verification' | 'platform', data: Record<string, string>, link: string | null) {
  const now = new Date().toISOString();
  for (const u of s.users)
    if (u.memberships.some((m) => m.orgId === orgId))
      s.notifications.push({ id: newId(), userId: u.id, kind, data, link, createdAt: now, readAt: null });
}

function verificationItem(s: MockState, o: OrgRow): VerificationItem {
  const warnings: VerificationItem['warnings'] = [];
  for (const other of s.orgs) {
    if (other.id === o.id) continue;
    if (digits(other.phone) && digits(other.phone) === digits(o.phone))
      warnings.push({ field: 'phone', otherOrgId: other.id, otherNameAr: other.nameAr, otherNameEn: other.nameEn });
    if (other.private.licenseNo && other.private.licenseNo === o.private.licenseNo)
      warnings.push({ field: 'license', otherOrgId: other.id, otherNameAr: other.nameAr, otherNameEn: other.nameEn });
  }
  return {
    orgId: o.id,
    type: o.type,
    nameAr: o.nameAr,
    nameEn: o.nameEn,
    governorate: o.governorate,
    area: o.area,
    addressText: o.addressText,
    landmark: o.landmark,
    phone: o.phone,
    whatsapp: o.whatsapp,
    licenseNo: o.private.licenseNo,
    contactPerson: o.private.contactPerson,
    exactLat: o.private.exactLat,
    exactLng: o.private.exactLng,
    status: o.verificationStatus,
    submittedAt: o.events.find((e) => e.action === 'submitted')?.createdAt ?? o.infoUpdatedAt,
    reviewerNote: o.reviewerNote,
    documents: o.documents,
    events: o.events,
    warnings,
  };
}

function actorRole(s: MockState, id: string | null) {
  const u = s.users.find((x) => x.id === id);
  if (!u) return 'system';
  return u.platformRole ?? u.memberships[0]?.memberRole ?? 'patient';
}

export const adminRepo: AdminRepo = {
  overview() {
    requirePlatform('reviewer');
    const s = store.get();
    const now = Date.now();
    const today = dayKey(now);
    const pharmacies = approvedPharmacies(s);
    const fc = freshCounts(s, new Set(pharmacies.map((p) => p.id)), now);
    const listed = fc.fresh + fc.stale + fc.expired;
    const since30 = new Date(now - 30 * DAY).toISOString();
    const logs30 = s.searchLogs.filter((l) => l.createdAt >= since30);

    const daily = Array.from({ length: 30 }, (_, i) => {
      const date = dayKey(now - (29 - i) * DAY);
      const day = logs30.filter((l) => l.createdAt.slice(0, 10) === date);
      return { date, searches: day.length, failed: day.filter((l) => l.resultCount === 0).length };
    });

    const unmet = new Map<string, number>();
    for (const l of logs30) if (l.resultCount === 0 && l.medicineId) unmet.set(l.medicineId, (unmet.get(l.medicineId) ?? 0) + 1);

    const byGov = GOVERNORATES.flatMap((g) => {
      const govPharmacies = pharmacies.filter((p) => p.governorate === g.id);
      const failed = logs30.filter((l) => l.governorate === g.id && l.resultCount === 0).length;
      if (!govPharmacies.length && !failed) return [];
      const stalePharmacies = govPharmacies.filter((p) => {
        const c = freshCounts(s, new Set([p.id]), now);
        const total = c.fresh + c.stale + c.expired;
        return total > 0 && c.fresh / total < 0.5;
      }).length;
      return [{ governorate: g.id, pharmacies: govPharmacies.length, stalePharmacies, failedSearches: failed }];
    });

    return latency({
      verifiedPharmacies: pharmacies.length,
      verifiedProviders: s.orgs.filter((o) => o.type !== 'pharmacy' && o.verificationStatus === 'approved').length,
      pendingVerifications: s.orgs.filter((o) => o.verificationStatus === 'pending' || o.verificationStatus === 'needs_info').length,
      catalogSize: currentCatalog().medicines.length,
      freshRatio: listed ? fc.fresh / listed : 0,
      searchesToday: s.searchLogs.filter((l) => l.createdAt.slice(0, 10) === today).length,
      failedToday: s.searchLogs.filter((l) => l.createdAt.slice(0, 10) === today && l.resultCount === 0).length,
      openReports: s.reports.filter((r) => r.status === 'new' || r.status === 'in_review').length,
      daily,
      freshnessByGov: byGovFreshness(s, now),
      topUnmet: [...unmet].map(([medicineId, count]) => ({ medicineId, count })).sort((a, b) => b.count - a.count).slice(0, 10),
      byGov,
      pending: {
        pharmacies: s.orgs.filter((o) => o.type === 'pharmacy' && (o.verificationStatus === 'pending' || o.verificationStatus === 'needs_info')).length,
        medicines: s.medicineRequests.filter((r) => r.status === 'pending').length,
        reports: s.reports.filter((r) => r.status === 'new').length,
        announcements: 0,
      },
    });
  },

  verificationQueue() {
    requirePlatform('reviewer');
    const s = store.get();
    const rank: Record<string, number> = { pending: 0, needs_info: 1, rejected: 2, approved: 3, suspended: 4, draft: 5 };
    return latency(
      s.orgs
        .filter((o) => o.verificationStatus !== 'draft')
        .map((o) => verificationItem(s, o))
        .sort((a, b) => rank[a.status]! - rank[b.status]! || b.submittedAt.localeCompare(a.submittedAt)),
    );
  },

  reviewOrg(orgId, decision, note) {
    requirePlatform('reviewer');
    if (decision !== 'approve' && !note.trim()) throw new Error('note_required');
    store.mutate((s) => {
      const o = s.orgs.find((x) => x.id === orgId);
      if (!o) throw new AccessError('forbidden');
      const before = o.verificationStatus;
      o.verificationStatus = decision === 'approve' ? 'approved' : decision === 'needs_info' ? 'needs_info' : 'rejected';
      o.reviewerNote = note.trim() || null;
      o.events.push({ action: o.verificationStatus === 'approved' ? 'approved' : o.verificationStatus === 'needs_info' ? 'needs_info' : 'rejected', note: note.trim() || null, createdAt: new Date().toISOString() });
      if (decision === 'approve') for (const d of o.documents) if (d.status === 'pending') d.status = 'accepted';
      notifyMembers(s, orgId, 'verification', { status: o.verificationStatus, orgNameAr: o.nameAr, orgNameEn: o.nameEn }, '/register/status');
      audit(s, `verification.${decision}`, 'organization', orgId, { status: before }, { status: o.verificationStatus, note: note.trim() || null });
    });
    return latency(undefined);
  },

  setDocumentStatus(orgId, fileName, status) {
    requirePlatform('reviewer');
    store.mutate((s) => {
      const d = s.orgs.find((x) => x.id === orgId)?.documents.find((x) => x.fileName === fileName);
      if (!d) return;
      const before = d.status;
      d.status = status;
      audit(s, 'verification.document', 'org_document', `${orgId}/${fileName}`, { status: before }, { status });
    });
    return latency(undefined);
  },

  organizations() {
    requirePlatform('reviewer');
    const s = store.get();
    const rows: AdminOrgRow[] = s.orgs
      .filter((o) => o.verificationStatus !== 'draft')
      .map((o) => {
        const stock = s.stock.filter((r) => r.pharmacyId === o.id && r.isListed);
        return {
          id: o.id,
          type: o.type,
          nameAr: o.nameAr,
          nameEn: o.nameEn,
          governorate: o.governorate,
          verificationStatus: o.verificationStatus,
          suspendedReason: o.suspendedReason,
          listed: stock.length,
          lastStockUpdateAt: stock.reduce<string | null>((m, r) => (!m || r.reportedAt > m ? r.reportedAt : m), null),
          members: s.users.filter((u) => u.memberships.some((m) => m.orgId === o.id)).length,
        };
      });
    return latency(rows);
  },

  suspendOrg(orgId, reason) {
    requirePlatform('reviewer');
    if (!reason.trim()) throw new Error('note_required');
    store.mutate((s) => {
      const o = s.orgs.find((x) => x.id === orgId)!;
      const before = o.verificationStatus;
      o.verificationStatus = 'suspended';
      o.suspendedReason = reason.trim();
      audit(s, 'organization.suspend', 'organization', orgId, { status: before }, { status: 'suspended', reason: reason.trim() });
    });
    return latency(undefined);
  },

  reactivateOrg(orgId) {
    requirePlatform('reviewer');
    store.mutate((s) => {
      const o = s.orgs.find((x) => x.id === orgId)!;
      o.verificationStatus = 'approved';
      o.suspendedReason = null;
      audit(s, 'organization.reactivate', 'organization', orgId, { status: 'suspended' }, { status: 'approved' });
    });
    return latency(undefined);
  },

  catalog() {
    requirePlatform('reviewer');
    return latency(currentCatalog());
  },

  addCatalogMedicine(input) {
    requirePlatform('reviewer');
    const id = store.mutate((s) => {
      const id = slug(s, input.nameEn);
      s.catalogAdditions.push(toCatalogRow(id, input));
      audit(s, 'catalog.add', 'medicine', id, null, input);
      return id;
    });
    return latency(id);
  },

  setAliases(medicineId, aliases) {
    requirePlatform('reviewer');
    store.mutate((s) => {
      const before = currentCatalog().medicines.find((m) => m.id === medicineId)?.aliases ?? [];
      s.aliasOverrides[medicineId] = aliases.map((a) => a.trim()).filter(Boolean);
      audit(s, 'catalog.aliases', 'medicine', medicineId, before, s.aliasOverrides[medicineId]);
    });
    return latency(undefined);
  },

  importCatalog(rows) {
    requirePlatform('reviewer');
    const n = store.mutate((s) => {
      const existing = currentCatalog().medicines;
      let added = 0;
      for (const r of rows) {
        const dup = existing.some((m) => (r.barcode && m.barcode === r.barcode) || (m.nameEn.toLowerCase() === r.nameEn.trim().toLowerCase() && m.strength === r.strength.trim()));
        if (dup) continue;
        s.catalogAdditions.push(toCatalogRow(slug(s, r.nameEn), r));
        added++;
      }
      audit(s, 'catalog.import', 'medicine', 'csv', null, { rows: rows.length, added });
      return added;
    });
    return latency(n);
  },

  requests() {
    requirePlatform('reviewer');
    const s = store.get();
    const candidates = currentCatalog().medicines.map((m) => ({ id: m.id, names: [m.nameAr, m.nameEn, `${m.genericName} ${m.strength}`] }));
    return latency(
      s.medicineRequests
        .map((r) => {
          const o = s.orgs.find((x) => x.id === r.orgId);
          return {
            ...r,
            orgNameAr: o?.nameAr ?? '—',
            orgNameEn: o?.nameEn ?? '—',
            duplicates: r.status === 'pending' ? likelyDuplicates([r.nameAr, r.nameEn, `${r.genericName} ${r.strength}`], candidates).slice(0, 3).map((d) => ({ medicineId: d.id, score: d.score })) : [],
          };
        })
        .sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1) || b.createdAt.localeCompare(a.createdAt)),
    );
  },

  reviewRequest(id, decision, mergeInto) {
    requirePlatform('reviewer');
    store.mutate((s) => {
      const r = s.medicineRequests.find((x) => x.id === id);
      if (!r || r.status !== 'pending') return;
      if (decision === 'approve') {
        s.catalogAdditions.push(toCatalogRow(slug(s, r.nameEn), { ...r, aliases: [] }));
        r.status = 'approved';
      } else if (decision === 'merge') {
        if (!mergeInto) throw new Error('merge_target_required');
        const target = currentCatalog().medicines.find((m) => m.id === mergeInto);
        s.aliasOverrides[mergeInto] = [...new Set([...(target?.aliases ?? []), r.nameAr, r.nameEn])];
        r.status = 'merged';
      } else {
        r.status = 'rejected';
      }
      audit(s, `catalog.request.${decision}`, 'medicine_request', id, { status: 'pending' }, { status: r.status, mergeInto: mergeInto ?? null });
    });
    return latency(undefined);
  },

  dataQuality() {
    requirePlatform('reviewer');
    const s = store.get();
    const now = Date.now();
    const since30 = new Date(now - 30 * DAY).toISOString();
    const pharmacies = approvedPharmacies(s).map((o) => {
      const rows = s.stock.filter((r) => r.pharmacyId === o.id && r.isListed && !r.hiddenByAdmin);
      const c = freshCounts(s, new Set([o.id]), now);
      const history = s.stockHistory.filter((h) => h.pharmacyId === o.id && h.createdAt >= since30 && (h.action === 'update' || h.action === 'confirm_all'));
      const confirms = history.filter((h) => h.action === 'confirm_all').length;
      return {
        pharmacyId: o.id,
        nameAr: o.nameAr,
        nameEn: o.nameEn,
        governorate: o.governorate,
        listed: rows.length,
        freshRatio: rows.length ? c.fresh / rows.length : 0,
        lastUpdate: rows.reduce<string | null>((m, r) => (!m || r.reportedAt > m ? r.reportedAt : m), null),
        reportsAgainst: s.reports.filter((r) => r.entityId === o.id || r.entityId.startsWith(`${o.id}/`)).length,
        confirmAllRatio: history.length ? confirms / history.length : 0,
      };
    });
    // A pharmacy said "available" and a patient reported it wrong the same day.
    const conflicts = s.reports.flatMap((r) => {
      if (r.reason !== 'wrong_availability' || r.entityType !== 'availability') return [];
      const [pharmacyId, medicineId] = r.entityId.split('/');
      const row = s.stock.find((x) => x.pharmacyId === pharmacyId && x.medicineId === medicineId);
      if (!row || row.reportedStatus === 'unavailable' || palestineDay(row.reportedAt) !== palestineDay(r.createdAt)) return [];
      return [{ pharmacyId: pharmacyId!, medicineId: medicineId!, reportedAt: row.reportedAt, reportId: r.id, reportedWrongAt: r.createdAt }];
    });
    return latency({ byGov: byGovFreshness(s, now), pharmacies: pharmacies.sort((a, b) => a.freshRatio - b.freshRatio), conflicts });
  },

  remindPharmacy(pharmacyId) {
    requirePlatform('reviewer');
    store.mutate((s) => {
      notifyMembers(s, pharmacyId, 'platform', { key: 'remindUpdate' }, '/pharmacy-portal/update?filter=needs');
      audit(s, 'quality.remind', 'organization', pharmacyId, null, null);
    });
    return latency(undefined);
  },

  hideReport(pharmacyId, medicineId, reason) {
    requirePlatform('reviewer');
    if (!reason.trim()) throw new Error('note_required');
    store.mutate((s) => {
      const r = s.stock.find((x) => x.pharmacyId === pharmacyId && x.medicineId === medicineId);
      if (!r) return;
      r.hiddenByAdmin = true;
      s.stockHistory.push({ id: newId(), pharmacyId, medicineId, action: 'hide', oldStatus: r.reportedStatus, newStatus: null, oldPrice: null, newPrice: null, actorId: s.sessionUserId, createdAt: new Date().toISOString() });
      audit(s, 'quality.hide_report', 'pharmacy_stock', `${pharmacyId}/${medicineId}`, { hidden: false }, { hidden: true, reason: reason.trim() });
    });
    return latency(undefined);
  },

  unmetDemand(days, categoryId, region) {
    requirePlatform('reviewer');
    const s = store.get();
    const since = new Date(Date.now() - days * DAY).toISOString();
    const governorates: GovId[] = GOVERNORATES.filter((g) => g.region === region).map((g) => g.id);
    const govIndex = new Map(governorates.map((g, j) => [g, j]));
    const medicines = new Map(currentCatalog().medicines.map((m) => [m.id, m]));
    const failed = s.searchLogs.filter((l) => l.resultCount === 0 && l.createdAt >= since && govIndex.has(String(l.governorate)));

    const perMedicine = new Map<string, number[]>();
    const unmatched = new Map<string, number>();
    for (const l of failed) {
      if (!l.medicineId) {
        unmatched.set(l.queryNorm, (unmatched.get(l.queryNorm) ?? 0) + 1);
        continue;
      }
      if (categoryId !== 'all' && medicines.get(l.medicineId)?.categoryId !== categoryId) continue;
      const row = perMedicine.get(l.medicineId) ?? governorates.map(() => 0);
      row[govIndex.get(String(l.governorate))!]!++;
      perMedicine.set(l.medicineId, row);
    }
    const ordered = [...perMedicine].sort((a, b) => b[1].reduce((x, y) => x + y, 0) - a[1].reduce((x, y) => x + y, 0)).slice(0, 15);
    return latency({
      governorates,
      medicineIds: ordered.map(([id]) => id),
      // Suppressed here, as the unmet_demand() RPC will: the browser never receives a cell under 5.
      matrix: suppress(ordered.map(([, row]) => row)),
      unmatched: [...unmatched].filter(([, n]) => n >= MIN_CELL).map(([query, count]) => ({ query, count })).sort((a, b) => b.count - a.count),
      failedTotal: failed.length,
    });
  },

  reports() {
    requirePlatform('reviewer');
    return latency([...store.get().reports].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  },

  updateReport(id, patch) {
    requirePlatform('reviewer');
    store.mutate((s) => {
      const r = s.reports.find((x) => x.id === id);
      if (!r) return;
      const before = { status: r.status, adminNote: r.adminNote, resolution: r.resolution };
      Object.assign(r, patch);
      audit(s, 'report.update', 'report', id, before, patch);
    });
    return latency(undefined);
  },

  audit() {
    requirePlatform('super_admin');
    const s = store.get();
    const rows: AuditEntry[] = [...s.audit]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((a) => ({
        id: a.id,
        actorName: s.users.find((u) => u.id === a.actorId)?.displayName ?? '—',
        actorRole: actorRole(s, a.actorId),
        action: a.action,
        entityType: a.entityType,
        entityId: a.entityId,
        oldValue: a.oldValue,
        newValue: a.newValue,
        createdAt: a.createdAt,
      }));
    return latency(rows);
  },

  // Reviewers read the lists (e.g. rejection reasons in AD-02); only the system admin edits them.
  settings() {
    requirePlatform('reviewer');
    return latency(structuredClone(store.get().settings));
  },

  updateSettings(patch) {
    requirePlatform('super_admin');
    const next = { ...store.get().settings, ...patch };
    const ints = [next.freshHours, next.expireHours, next.priceMaxDays, next.programConfirmDays];
    if (ints.some((n) => !Number.isInteger(n) || n < 1) || next.freshHours >= next.expireHours) throw new Error('invalid_settings');
    store.mutate((s) => {
      const before = structuredClone(s.settings);
      s.settings = next;
      audit(s, 'settings.update', 'settings', 'platform', before, patch);
    });
    return latency(undefined);
  },
};
