// Mock directory (P-07, P-08) and provider portal (PR-01..PR-08) — SPEC §9. The public sees approved
// organizations and approved content only; members see and edit their own (has_org_perm('publish')).
import type {
  Announcement,
  DirectoryEntry,
  DirectoryRepo,
  GovFilter,
  ProviderPortalRepo,
  ProviderPublic,
  ProviderType,
  ServiceItem,
} from '../types';
import { AccessError, hasOrgPerm, latency, requireOrgPerm } from './access';
import { audit, newId, store, type MockState, type OrgRow } from './store';

const isProvider = (o: OrgRow): o is OrgRow & { type: ProviderType } => o.type !== 'pharmacy';
const inGov = (gov: GovFilter | undefined, g: string) => !gov || gov === 'all' || gov === g;
const now = () => new Date().toISOString();

const currentAnnouncement = (a: Announcement, at = Date.now()) =>
  a.reviewStatus === 'approved' && new Date(a.startsAt).getTime() <= at && (!a.endsAt || new Date(a.endsAt).getTime() > at);

function publicServices(s: MockState, orgId: string) {
  return s.services.filter((x) => x.orgId === orgId && x.reviewStatus === 'approved');
}

function toEntry(s: MockState, o: OrgRow & { type: ProviderType }): DirectoryEntry {
  const services = publicServices(s, o.id);
  const latest = services.reduce((m, x) => (x.updatedAt > m ? x.updatedAt : m), o.infoUpdatedAt);
  return {
    id: o.id,
    type: o.type,
    nameAr: o.nameAr,
    nameEn: o.nameEn,
    governorate: o.governorate,
    area: o.area,
    description: o.description,
    hours: o.hours,
    locations: o.locations,
    topServices: services.slice(0, 3).map((x) => x.name),
    categories: [...new Set(services.map((x) => x.category).filter((c): c is NonNullable<typeof c> => !!c))],
    activePrograms: services.filter((x) => x.kind === 'program' && x.programStatus === 'active').length,
    updatedAt: latest,
  };
}

function toPublic(s: MockState, o: OrgRow & { type: ProviderType }, preview: boolean): ProviderPublic {
  const exact = o.locationPrecision === 'exact';
  return {
    id: o.id,
    type: o.type,
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
    temporarilyClosed: o.temporarilyClosed,
    infoUpdatedAt: o.infoUpdatedAt,
    description: o.description,
    website: o.website,
    locations: o.locations,
    // A preview shows what is waiting for review too, so the member sees the whole page.
    services: s.services.filter((x) => x.orgId === o.id && (x.reviewStatus === 'approved' || (preview && x.reviewStatus === 'pending'))),
    announcements: s.announcements.filter((a) => a.orgId === o.id && (currentAnnouncement(a) || (preview && a.reviewStatus === 'pending'))),
  };
}

export const directoryRepo: DirectoryRepo = {
  providers({ type, gov }) {
    const s = store.get();
    return latency(
      s.orgs
        .filter(isProvider)
        .filter((o) => o.verificationStatus === 'approved' && (!type || o.type === type) && inGov(gov, o.governorate))
        .map((o) => toEntry(s, o)),
    );
  },
  provider(id, opts) {
    const s = store.get();
    const o = s.orgs.find((x) => x.id === id);
    if (!o || !isProvider(o)) return latency(null);
    const preview = !!opts?.preview && hasOrgPerm(id, 'member');
    if (o.verificationStatus !== 'approved' && !preview) return latency(null);
    return latency(toPublic(s, o, preview));
  },
};

function ownService(s: MockState, orgId: string, id: string) {
  const x = s.services.find((v) => v.id === id && v.orgId === orgId);
  if (!x) throw new AccessError('forbidden');
  return x;
}

function ownAnnouncement(s: MockState, orgId: string, id: string) {
  const a = s.announcements.find((v) => v.id === id && v.orgId === orgId);
  if (!a) throw new AccessError('forbidden');
  return a;
}

export const providerPortalRepo: ProviderPortalRepo = {
  services(orgId) {
    requireOrgPerm(orgId, 'member');
    return latency(store.get().services.filter((x) => x.orgId === orgId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  },

  saveService(orgId, input) {
    requireOrgPerm(orgId, 'publish');
    if (!input.name.trim()) throw new Error('name_required');
    const id = store.mutate((s) => {
      const t = now();
      const { id: existingId, ...fields } = input;
      if (existingId) {
        const x = ownService(s, orgId, existingId);
        const before = { ...x };
        // Content edits go back to review (AD-08); the confirmation stays as it was.
        Object.assign(x, fields, { name: fields.name.trim(), reviewStatus: 'pending', rejectionReason: null, updatedAt: t });
        audit(s, 'service.update', 'service', x.id, { name: before.name, reviewStatus: before.reviewStatus }, { name: x.name, reviewStatus: 'pending' });
        return x.id;
      }
      const item: ServiceItem = {
        ...fields,
        name: fields.name.trim(),
        id: `svc-${newId()}`,
        orgId,
        confirmedAt: fields.kind === 'program' ? t : null,
        reviewStatus: 'pending',
        rejectionReason: null,
        updatedAt: t,
      };
      s.services.push(item);
      audit(s, 'service.add', 'service', item.id, null, { name: item.name, kind: item.kind });
      return item.id;
    });
    return latency(id);
  },

  deleteService(orgId, id) {
    requireOrgPerm(orgId, 'publish');
    store.mutate((s) => {
      const x = ownService(s, orgId, id);
      s.services = s.services.filter((v) => v !== x);
      audit(s, 'service.remove', 'service', id, { name: x.name }, null);
    });
    return latency(undefined);
  },

  setProgramStatus(orgId, id, status) {
    requireOrgPerm(orgId, 'publish');
    store.mutate((s) => {
      const x = ownService(s, orgId, id);
      if (x.kind !== 'program') throw new AccessError('forbidden');
      const before = x.programStatus;
      x.programStatus = status;
      // Choosing a status, even the same one, confirms it (SPEC §9 PR-04: «نشط الآن» every 7 days).
      x.confirmedAt = now();
      audit(s, 'program.status', 'service', id, { status: before }, { status });
    });
    return latency(undefined);
  },

  announcements(orgId) {
    requireOrgPerm(orgId, 'member');
    return latency(store.get().announcements.filter((a) => a.orgId === orgId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  },

  saveAnnouncement(orgId, input, submit) {
    requireOrgPerm(orgId, 'publish');
    if (!input.title.trim() || !input.body.trim() || input.body.length > 300) throw new Error('invalid_announcement');
    const id = store.mutate((s) => {
      const reviewStatus = submit ? 'pending' : 'draft';
      if (input.id) {
        const a = ownAnnouncement(s, orgId, input.id);
        Object.assign(a, { title: input.title.trim(), body: input.body.trim(), startsAt: input.startsAt, endsAt: input.endsAt, reviewStatus, rejectionReason: null });
        audit(s, 'announcement.update', 'announcement', a.id, null, { reviewStatus });
        return a.id;
      }
      const a: Announcement = { id: `ann-${newId()}`, orgId, title: input.title.trim(), body: input.body.trim(), startsAt: input.startsAt, endsAt: input.endsAt, reviewStatus, rejectionReason: null, createdAt: now() };
      s.announcements.push(a);
      audit(s, 'announcement.add', 'announcement', a.id, null, { reviewStatus });
      return a.id;
    });
    return latency(id);
  },

  deleteAnnouncement(orgId, id) {
    requireOrgPerm(orgId, 'publish');
    store.mutate((s) => {
      ownAnnouncement(s, orgId, id);
      s.announcements = s.announcements.filter((a) => a.id !== id);
      audit(s, 'announcement.remove', 'announcement', id, null, null);
    });
    return latency(undefined);
  },

  profile(orgId) {
    requireOrgPerm(orgId, 'member');
    const o = store.get().orgs.find((x) => x.id === orgId);
    if (!o) throw new AccessError('forbidden');
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
      contactPerson: o.private.contactPerson,
      website: o.website,
      locations: o.locations,
    });
  },

  updateProfile(orgId, patch) {
    requireOrgPerm(orgId, 'profile');
    const reReview = store.mutate((s) => {
      const o = s.orgs.find((x) => x.id === orgId);
      if (!o) throw new AccessError('forbidden');
      const before = { nameAr: o.nameAr, nameEn: o.nameEn, licenseNo: o.private.licenseNo };
      const { licenseNo, exactLat, exactLng, contactPerson, ...pub } = patch;
      Object.assign(o, pub);
      if (licenseNo !== undefined) o.private.licenseNo = licenseNo;
      if (exactLat !== undefined) o.private.exactLat = exactLat;
      if (exactLng !== undefined) o.private.exactLng = exactLng;
      if (contactPerson !== undefined) o.private.contactPerson = contactPerson;
      o.infoUpdatedAt = now();
      const identity =
        (patch.nameAr !== undefined && patch.nameAr !== before.nameAr) ||
        (patch.nameEn !== undefined && patch.nameEn !== before.nameEn) ||
        (licenseNo !== undefined && licenseNo !== before.licenseNo);
      if (identity && o.verificationStatus === 'approved') {
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
};
