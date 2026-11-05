// Directory (P-07, P-08) and provider portal (PR-01..PR-08) on Supabase. Visitors read approved
// organizations, services and current announcements through RLS; every change is an RPC.
import type {
  DirectoryEntry,
  DirectoryRepo,
  ProviderPortalRepo,
  ProviderPublic,
  ProviderType,
} from '../types';
import { db, must, rpc } from './client';
import {
  toAnnouncement,
  toLocations,
  toOrgProfile,
  toPublicPharmacy,
  toService,
  type AnnouncementDbRow,
  type OrgDbRow,
  type PrivateDbRow,
  type ServiceDbRow,
} from './map';
import { isUuid, ORG_COLS } from './publicRepos';

const SERVICE_COLS =
  'id, org_id, kind, name, category, description, place, phone, operating, beneficiaries, required_docs, contact, hours, location, eligibility, how_to_apply, starts_on, ends_on, program_status, confirmed_at, review_status, rejection_reason, updated_at';
const ANNOUNCEMENT_COLS = 'id, org_id, title, body, starts_at, ends_at, review_status, rejection_reason, created_at';

const current = (a: { reviewStatus: string; startsAt: string; endsAt: string | null }, at = Date.now()) =>
  a.reviewStatus === 'approved' && new Date(a.startsAt).getTime() <= at && (!a.endsAt || new Date(a.endsAt).getTime() > at);

export const directoryRepo: DirectoryRepo = {
  async providers({ type, gov }) {
    let q = db.from('organizations').select(ORG_COLS).neq('type', 'pharmacy').eq('verification_status', 'approved');
    if (type) q = q.eq('type', type);
    if (gov && gov !== 'all') q = q.eq('governorate', gov);
    const orgs = must(await q.order('created_at')) as OrgDbRow[];
    if (!orgs.length) return [];
    const services = (must(
      await db.from('services').select(SERVICE_COLS).in('org_id', orgs.map((o) => o.id)).eq('review_status', 'approved').order('created_at'),
    ) as ServiceDbRow[]).map(toService);
    return orgs.map((o): DirectoryEntry => {
      const mine = services.filter((s) => s.orgId === o.id);
      const info = new Date(o.info_updated_at).toISOString();
      return {
        id: o.id,
        type: o.type as ProviderType,
        nameAr: o.name_ar,
        nameEn: o.name_en,
        governorate: o.governorate,
        area: o.area,
        description: o.description,
        hours: o.hours ?? {},
        locations: toLocations(o.locations),
        topServices: mine.slice(0, 3).map((s) => s.name),
        categories: [...new Set(mine.map((s) => s.category).filter((c): c is NonNullable<typeof c> => !!c))],
        activePrograms: mine.filter((s) => s.kind === 'program' && s.programStatus === 'active').length,
        updatedAt: mine.reduce((m, s) => (s.updatedAt > m ? s.updatedAt : m), info),
      };
    });
  },

  async provider(id, opts): Promise<ProviderPublic | null> {
    if (!isUuid(id)) return null;
    const o = must(await db.from('organizations').select(ORG_COLS).eq('id', id).maybeSingle()) as OrgDbRow | null;
    if (!o || o.type === 'pharmacy') return null;
    const preview = !!opts?.preview;
    if (o.verification_status !== 'approved' && !preview) return null;
    // RLS returns members their own pending items too; the public page shows them only in a preview.
    const [services, announcements] = await Promise.all([
      db.from('services').select(SERVICE_COLS).eq('org_id', id).order('created_at'),
      db.from('announcements').select(ANNOUNCEMENT_COLS).eq('org_id', id).order('starts_at', { ascending: false }),
    ]);
    const { lastStockUpdateAt: _unused, ...base } = toPublicPharmacy(o, null);
    return {
      ...base,
      type: o.type as ProviderType,
      description: o.description,
      website: o.website ?? null,
      locations: toLocations(o.locations),
      services: (must(services) as ServiceDbRow[]).map(toService).filter((s) => s.reviewStatus === 'approved' || (preview && s.reviewStatus === 'pending')),
      announcements: (must(announcements) as AnnouncementDbRow[]).map(toAnnouncement).filter((a) => current(a) || (preview && a.reviewStatus === 'pending')),
    };
  },
};

export const providerPortalRepo: ProviderPortalRepo = {
  async services(orgId) {
    const r = await db.from('services').select(SERVICE_COLS).eq('org_id', orgId).order('updated_at', { ascending: false });
    return (must(r) as ServiceDbRow[]).map(toService);
  },

  saveService: (orgId, input) => rpc<string>('save_service', { org: orgId, input }),

  async deleteService(orgId, id) {
    await rpc('delete_service', { org: orgId, service: id });
  },

  async setProgramStatus(orgId, id, status) {
    await rpc('set_program_status', { org: orgId, service: id, status });
  },

  async announcements(orgId) {
    const r = await db.from('announcements').select(ANNOUNCEMENT_COLS).eq('org_id', orgId).order('created_at', { ascending: false });
    return (must(r) as AnnouncementDbRow[]).map(toAnnouncement);
  },

  saveAnnouncement: (orgId, input, submit) => rpc<string>('save_announcement', { org: orgId, input, submit }),

  async deleteAnnouncement(orgId, id) {
    await rpc('delete_announcement', { org: orgId, announcement: id });
  },

  async profile(orgId) {
    const [o, p] = await Promise.all([
      db.from('organizations').select(ORG_COLS).eq('id', orgId).single(),
      db.from('organization_private').select('license_no, exact_lat, exact_lng, contact_person, reviewer_notes').eq('org_id', orgId).maybeSingle(),
    ]);
    const org = must(o) as OrgDbRow;
    const priv = must(p) as PrivateDbRow | null;
    return { ...toOrgProfile(org, priv), contactPerson: priv?.contact_person ?? '', website: org.website ?? null, locations: toLocations(org.locations) };
  },

  async updateProfile(orgId, patch) {
    return { reReview: await rpc<boolean>('update_org_profile', { org: orgId, patch }) };
  },
};
