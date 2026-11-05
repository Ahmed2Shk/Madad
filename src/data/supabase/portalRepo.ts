// Pharmacy portal (PH-01..PH-08) on Supabase. Reads go through RLS (members of the pharmacy);
// every change goes through an RPC that checks has_org_perm() and writes the history and audit log.
import type { MedicineRequest, PharmacyPortalRepo, PortalOverview, TeamMember } from '../types';
import { db, must, rpc } from './client';
import { toHistory, toOrgProfile, toPortalStock, toThread, type HistoryDbRow, type InquiryDbRow, type OrgDbRow, type PrivateDbRow, type StockDbRow } from './map';
import { ORG_COLS } from './publicRepos';

export const pharmacyPortalRepo: PharmacyPortalRepo = {
  async overview(orgId) {
    const o = await rpc<Omit<PortalOverview, 'activity'> & { activity: HistoryDbRow[] }>('portal_overview', { org: orgId });
    return { ...o, activity: o.activity.map(toHistory) };
  },

  async stock(orgId) {
    const [stock, priv] = await Promise.all([
      db.from('pharmacy_stock').select('*').eq('pharmacy_id', orgId),
      // Returns nothing without the medicines permission (RLS): the quantity stays hidden.
      db.from('stock_private').select('medicine_id, quantity, low_threshold').eq('pharmacy_id', orgId),
    ]);
    const q = new Map((must(priv) as { medicine_id: string; quantity: number; low_threshold: number }[]).map((p) => [p.medicine_id, p]));
    return (must(stock) as StockDbRow[]).map((r) => toPortalStock(r, q.get(r.medicine_id)));
  },

  async history(orgId) {
    const r = await db.from('stock_history').select('*').eq('pharmacy_id', orgId).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1000);
    return (must(r) as HistoryDbRow[]).map(toHistory);
  },

  async setListed(orgId, medicineId, listed) {
    await rpc('stock_set_listed', { pharmacy: orgId, medicine: medicineId, listed });
  },

  async removeMedicine(orgId, medicineId) {
    await rpc('stock_remove', { pharmacy: orgId, medicine: medicineId });
  },

  async addMedicine(orgId, medicineId, status) {
    await rpc('stock_add', { pharmacy: orgId, medicine: medicineId, status });
  },

  async setQuantity(orgId, medicineId, quantity, lowThreshold) {
    must(
      await db
        .from('stock_private')
        .upsert({ pharmacy_id: orgId, medicine_id: medicineId, quantity, low_threshold: lowThreshold }, { onConflict: 'pharmacy_id,medicine_id' }),
    );
  },

  async requestMedicine(orgId, input) {
    await rpc('request_medicine', { org: orgId, input });
  },

  async requests(orgId) {
    const r = await db
      .from('medicines')
      .select('id, name_ar, name_en, generic_name, strength, dosage_form, pack_size, manufacturer, barcode, category_id, status, created_at')
      .eq('requested_by_org', orgId)
      .order('created_at', { ascending: false });
    return must(r).map(
      (m: { id: string; name_ar: string; name_en: string; generic_name: string; strength: string; dosage_form: MedicineRequest['dosageForm']; pack_size: string; manufacturer: string | null; barcode: string | null; category_id: string; status: MedicineRequest['status']; created_at: string }): MedicineRequest => ({
        id: m.id,
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
      }),
    );
  },

  async inquiries(orgId) {
    const r = await db
      .from('inquiries')
      .select('id, org_id, medicine_id, subject, status, patient_name, created_at, updated_at, inquiry_messages(sender_side, body, created_at)')
      .eq('org_id', orgId)
      .order('updated_at', { ascending: false });
    return (must(r) as InquiryDbRow[]).map(toThread);
  },

  async replyInquiry(orgId, inquiryId, body) {
    await rpc('reply_inquiry', { org: orgId, inquiry: inquiryId, body });
  },

  async setInquiryStatus(orgId, inquiryId, status) {
    await rpc('set_inquiry_status', { org: orgId, inquiry: inquiryId, status });
  },

  async profile(orgId) {
    const [o, p] = await Promise.all([
      db.from('organizations').select(ORG_COLS).eq('id', orgId).single(),
      db.from('organization_private').select('license_no, exact_lat, exact_lng, contact_person, reviewer_notes').eq('org_id', orgId).maybeSingle(),
    ]);
    return toOrgProfile(must(o) as OrgDbRow, must(p) as PrivateDbRow | null);
  },

  async updateProfile(orgId, patch) {
    return { reReview: await rpc<boolean>('update_org_profile', { org: orgId, patch }) };
  },

  async team(orgId) {
    const rows = await rpc<(TeamMember & { sort?: number })[]>('org_team', { org: orgId });
    return rows.map(({ sort: _sort, ...m }) => m);
  },

  async invite(orgId, email, role) {
    await rpc('invite_member', { org: orgId, email, role });
  },

  async updateMember(orgId, key, patch) {
    await rpc('update_member', { org: orgId, key, role: patch.role ?? null, perms: patch.perms ?? null });
  },

  async removeMember(orgId, key) {
    await rpc('remove_member', { org: orgId, key });
  },
};
