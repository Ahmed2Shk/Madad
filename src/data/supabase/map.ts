// Database rows (snake_case, SPEC §13) → the app's data contracts (src/data/types.ts).
// Pure functions, so both modes hand the screens exactly the same shapes.
import type { Hours } from '../../lib/hours';
import type {
  Announcement,
  AppNotification,
  AvailabilityAlert,
  DosageForm,
  HistoryEntry,
  InquiryThread,
  LocationPrecision,
  Medicine,
  MemberRole,
  Membership,
  OrgProfile,
  OrgType,
  PharmacyAvailability,
  PlatformSettings,
  PortalStockRow,
  PublicPharmacy,
  PublicSettings,
  Perms,
  Reported,
  OrgLocation,
  ServiceItem,
  VerificationEvent,
  VerificationStatus,
} from '../types';
import { REQUIRED_DOCS_DEFAULT } from '../requiredDocs';

/** Postgres timestamps come as "…+00:00" with microseconds; the app compares ISO strings, so normalize. */
export const iso = (s: string | null | undefined): string | null => (s == null ? null : new Date(s).toISOString());
const isoOf = (s: string) => new Date(s).toISOString();
const numOrNull = (v: number | string | null | undefined) => (v == null ? null : Number(v));

export interface OrgDbRow {
  id: string;
  type: OrgType;
  name_ar: string;
  name_en: string;
  governorate: string;
  area: string;
  address_text: string;
  landmark: string | null;
  location_precision: LocationPrecision;
  public_lat: number | null;
  public_lng: number | null;
  phone: string;
  whatsapp: string | null;
  hours: Hours;
  description: string | null;
  verification_status: VerificationStatus;
  suspended_reason: string | null;
  website?: string | null;
  locations?: unknown;
  temporarily_closed: boolean;
  closed_reason: string | null;
  info_updated_at: string;
}

export function toPublicPharmacy(o: OrgDbRow, lastStockUpdateAt: string | null): PublicPharmacy {
  return {
    id: o.id,
    nameAr: o.name_ar,
    nameEn: o.name_en,
    governorate: o.governorate,
    area: o.area,
    addressText: o.address_text,
    landmark: o.landmark,
    locationPrecision: o.location_precision,
    // The database already nulls these unless precision is exact; checked again so nothing leaks.
    publicLat: o.location_precision === 'exact' ? o.public_lat : null,
    publicLng: o.location_precision === 'exact' ? o.public_lng : null,
    phone: o.phone,
    whatsapp: o.whatsapp,
    hours: o.hours ?? {},
    temporarilyClosed: o.temporarily_closed ? { reason: o.closed_reason } : null,
    infoUpdatedAt: isoOf(o.info_updated_at),
    lastStockUpdateAt: iso(lastStockUpdateAt),
  };
}

export interface PrivateDbRow {
  license_no: string;
  exact_lat: number | null;
  exact_lng: number | null;
  contact_person: string;
  reviewer_notes: string | null;
}

export function toOrgProfile(o: OrgDbRow, p: PrivateDbRow | null): OrgProfile {
  return {
    id: o.id,
    type: o.type,
    nameAr: o.name_ar,
    nameEn: o.name_en,
    licenseNo: p?.license_no ?? '',
    governorate: o.governorate,
    area: o.area,
    addressText: o.address_text,
    landmark: o.landmark,
    locationPrecision: o.location_precision,
    exactLat: p?.exact_lat ?? null,
    exactLng: p?.exact_lng ?? null,
    phone: o.phone,
    whatsapp: o.whatsapp,
    hours: o.hours ?? {},
    description: o.description,
    temporarilyClosed: o.temporarily_closed ? { reason: o.closed_reason } : null,
    verificationStatus: o.verification_status,
  };
}

export interface StockDbRow {
  pharmacy_id: string;
  medicine_id: string;
  reported_status: Reported;
  reported_at: string;
  price_ils: number | string | null;
  price_updated_at: string | null;
  is_listed?: boolean;
  hidden_by_admin?: boolean;
}

export function toAvailability(r: StockDbRow): PharmacyAvailability {
  return {
    pharmacyId: r.pharmacy_id,
    medicineId: r.medicine_id,
    reportedStatus: r.reported_status,
    reportedAt: isoOf(r.reported_at),
    priceIls: numOrNull(r.price_ils),
    priceUpdatedAt: iso(r.price_updated_at),
  };
}

export function toPortalStock(r: StockDbRow, priv: { quantity: number; low_threshold: number } | undefined): PortalStockRow {
  return {
    ...toAvailability(r),
    isListed: r.is_listed ?? true,
    hiddenByAdmin: r.hidden_by_admin ?? false,
    quantity: priv?.quantity ?? null,
    lowThreshold: priv?.low_threshold ?? null,
  };
}

export interface MedicineDbRow {
  id: string;
  name_ar: string;
  name_en: string;
  generic_name: string;
  strength: string;
  strength_en: string | null;
  dosage_form: string;
  pack_size: string;
  pack_size_en: string | null;
  manufacturer: string | null;
  barcode: string | null;
  aliases: string[];
  category_id: string;
}

export function toMedicine(m: MedicineDbRow): Medicine {
  return {
    id: m.id,
    nameAr: m.name_ar,
    nameEn: m.name_en,
    genericName: m.generic_name,
    strength: m.strength,
    strengthEn: m.strength_en ?? null,
    dosageForm: m.dosage_form as DosageForm,
    packSize: m.pack_size,
    packSizeEn: m.pack_size_en ?? null,
    manufacturer: m.manufacturer,
    barcode: m.barcode,
    aliases: m.aliases ?? [],
    categoryId: m.category_id,
  };
}

export interface HistoryDbRow {
  id: number | string;
  medicine_id: string | null;
  action: HistoryEntry['action'];
  old_status: Reported | null;
  new_status: Reported | null;
  old_price: number | string | null;
  new_price: number | string | null;
  item_count: number | null;
  actor_name: string | null;
  created_at: string;
}

export function toHistory(h: HistoryDbRow): HistoryEntry {
  return {
    id: String(h.id),
    medicineId: h.medicine_id,
    action: h.action,
    oldStatus: h.old_status,
    newStatus: h.new_status,
    oldPrice: numOrNull(h.old_price),
    newPrice: numOrNull(h.new_price),
    actorName: h.actor_name || '—',
    count: h.item_count,
    createdAt: isoOf(h.created_at),
  };
}

export interface InquiryDbRow {
  id: string;
  org_id: string;
  medicine_id: string | null;
  service_id?: string | null;
  subject: string;
  status: InquiryThread['status'];
  patient_name: string;
  created_at: string;
  updated_at: string;
  inquiry_messages: { sender_side: 'patient' | 'org'; body: string; created_at: string }[];
}

export function toThread(q: InquiryDbRow): InquiryThread {
  return {
    id: q.id,
    orgId: q.org_id,
    medicineId: q.medicine_id,
    serviceId: q.service_id ?? null,
    subject: q.subject,
    status: q.status,
    patientName: q.patient_name || '—',
    messages: [...(q.inquiry_messages ?? [])]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((m) => ({ sender: m.sender_side, body: m.body, createdAt: isoOf(m.created_at) })),
    createdAt: isoOf(q.created_at),
    updatedAt: isoOf(q.updated_at),
  };
}

export function toNotification(n: { id: string; kind: AppNotification['kind']; data: Record<string, unknown>; link: string | null; created_at: string; read_at: string | null }): AppNotification {
  return {
    id: n.id,
    kind: n.kind,
    data: Object.fromEntries(Object.entries(n.data ?? {}).map(([k, v]) => [k, String(v)])),
    link: n.link,
    createdAt: isoOf(n.created_at),
    readAt: iso(n.read_at),
  };
}

export function toAlert(a: { id: string; medicine_id: string; governorate: string; active: boolean; created_at: string; notified_at: string | null }): AvailabilityAlert {
  return { id: a.id, medicineId: a.medicine_id, governorate: a.governorate, active: a.active, createdAt: isoOf(a.created_at), notifiedAt: iso(a.notified_at) };
}

type OrgSummary = { type: OrgType; name_ar: string; name_en: string; verification_status: VerificationStatus };

export function toMembership(m: {
  org_id: string;
  member_role: MemberRole;
  perms: Perms;
  organizations: OrgSummary | OrgSummary[] | null;
}): Membership[] {
  // PostgREST embeds a many-to-one relation as an object; accept a one-item list too.
  const o = Array.isArray(m.organizations) ? m.organizations[0] : m.organizations;
  return o
    ? [{ orgId: m.org_id, orgType: o.type, orgNameAr: o.name_ar, orgNameEn: o.name_en, role: m.member_role, perms: m.perms, verificationStatus: o.verification_status }]
    : [];
}

export function toEvent(e: { action: VerificationEvent['action']; note: string | null; created_at: string }): VerificationEvent {
  return { action: e.action, note: e.note, createdAt: isoOf(e.created_at) };
}

/** settings rows → values. Scalars are stored as JSON, so 24 and "24" both read as 24. */
function settingsMap(rows: { key: string; value: unknown }[]) {
  const m = new Map(rows.map((r) => [r.key, r.value]));
  const int = (k: string, d: number) => {
    const n = Number(m.get(k));
    return Number.isFinite(n) && n > 0 ? n : d;
  };
  const text = (k: string) => {
    const v = m.get(k);
    return typeof v === 'string' && v.trim() ? v : null;
  };
  return { m, int, text };
}

export function toPublicSettings(rows: { key: string; value: unknown }[]): PublicSettings {
  const { m, int, text } = settingsMap(rows);
  const docs = m.get('required_docs');
  return {
    freshHours: int('fresh_hours', 24),
    expireHours: int('expire_hours', 72),
    priceMaxDays: int('price_max_days', 14),
    programConfirmDays: int('program_confirm_days', 7),
    disclaimerAr: text('disclaimer_ar'),
    disclaimerEn: text('disclaimer_en'),
    requiredDocs: docs && typeof docs === 'object' ? { ...REQUIRED_DOCS_DEFAULT, ...(docs as PublicSettings['requiredDocs']) } : REQUIRED_DOCS_DEFAULT,
  };
}

export function toPlatformSettings(rows: { key: string; value: unknown }[]): PlatformSettings {
  const { m } = settingsMap(rows);
  const reasons = m.get('rejection_reasons');
  return {
    ...toPublicSettings(rows),
    rejectionReasons: Array.isArray(reasons) ? reasons.map(String) : [],
  };
}

export interface ServiceDbRow {
  id: string;
  org_id: string;
  kind: ServiceItem['kind'];
  name: string;
  category: string | null;
  description: string | null;
  place: string | null;
  phone: string | null;
  operating: boolean;
  beneficiaries: string | null;
  required_docs: string[] | null;
  contact: string | null;
  hours: Hours | null;
  location: string | null;
  eligibility: string[] | null;
  how_to_apply: string | null;
  starts_on: string | null;
  ends_on: string | null;
  program_status: ServiceItem['programStatus'];
  confirmed_at: string | null;
  review_status: ServiceItem['reviewStatus'];
  rejection_reason: string | null;
  updated_at: string;
}

export function toService(s: ServiceDbRow): ServiceItem {
  return {
    id: s.id,
    orgId: s.org_id,
    kind: s.kind,
    name: s.name,
    category: (s.category as ServiceItem['category']) ?? null,
    description: s.description,
    place: s.place,
    phone: s.phone,
    operating: s.operating,
    beneficiaries: s.beneficiaries,
    requiredDocs: s.required_docs ?? [],
    contact: s.contact,
    hours: s.hours,
    location: s.location,
    eligibility: s.eligibility ?? [],
    howToApply: s.how_to_apply,
    startsOn: s.starts_on,
    endsOn: s.ends_on,
    programStatus: s.program_status,
    confirmedAt: iso(s.confirmed_at),
    reviewStatus: s.review_status,
    rejectionReason: s.rejection_reason,
    updatedAt: isoOf(s.updated_at),
  };
}

export interface AnnouncementDbRow {
  id: string;
  org_id: string | null;
  title: string;
  body: string;
  starts_at: string;
  ends_at: string | null;
  review_status: Announcement['reviewStatus'];
  rejection_reason: string | null;
  created_at: string;
}

export function toAnnouncement(a: AnnouncementDbRow): Announcement {
  return {
    id: a.id,
    orgId: a.org_id,
    title: a.title,
    body: a.body,
    startsAt: isoOf(a.starts_at),
    endsAt: iso(a.ends_at),
    reviewStatus: a.review_status,
    rejectionReason: a.rejection_reason,
    createdAt: isoOf(a.created_at),
  };
}

/** organizations.locations is jsonb; keep only well-formed entries. */
export function toLocations(v: unknown): OrgLocation[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((l) =>
    l && typeof l === 'object' && typeof (l as OrgLocation).name === 'string'
      ? [{ name: (l as OrgLocation).name, area: String((l as OrgLocation).area ?? ''), hours: ((l as OrgLocation).hours as Hours | null) ?? null }]
      : [],
  );
}
