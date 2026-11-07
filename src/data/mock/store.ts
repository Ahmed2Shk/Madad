// In-memory demo database persisted to localStorage (SPEC §12 `mock` mode).
// Seeds carry relative times; they become absolute timestamps the first time a browser loads them.
import type { Reported } from '../../lib/freshness';
import type { Hours } from '../../lib/hours';
import type {
  Announcement,
  AppNotification,
  AvailabilityAlert,
  DocumentMeta,
  Favorite,
  GovFilter,
  HistoryEntry,
  InquiryStatus,
  LocationPrecision,
  MedicineRequest,
  MemberRole,
  NewReport,
  NotificationPrefs,
  OrgLocation,
  OrgType,
  Perms,
  PublicSettings,
  ServiceItem,
  VerificationEvent,
  VerificationStatus,
} from '../types';
import pharmaciesSeed from './seed/pharmacies.json';
import stockSeed from './seed/stock.json';
import stockPrivateSeed from './seed/stock_private.json';
import historySeed from './seed/stock_history.json';
import logsSeed from './seed/search_logs.json';
import usersSeed from './seed/users.json';
import viewsSeed from './seed/page_views.json';
import inquiriesSeed from './seed/inquiries.json';
import requestsSeed from './seed/medicine_requests.json';
import reportsSeed from './seed/reports.json';
import providersSeed from './seed/providers.json';
import announcementsSeed from './seed/announcements.json';
import { DEFAULT_PREFS } from '../providerTypes';
import { REQUIRED_DOCS_DEFAULT } from '../requiredDocs';

export type { VerificationStatus };

export interface ReportRow extends NewReport {
  id: string;
  createdAt: string;
  status: 'new' | 'in_review' | 'resolved' | 'rejected';
  adminNote: string | null;
  resolution: string | null;
}

/** Same shape as a row of public/catalog.json. */
export interface CatalogMedicineRow {
  id: string;
  name_ar: string;
  name_en: string;
  generic_name: string;
  strength: string;
  strength_en?: string | null;
  dosage_form: string;
  pack_size: string;
  pack_size_en?: string | null;
  manufacturer: string | null;
  barcode: string | null;
  aliases: string[];
  category_id: string;
}

export interface OrgRow {
  id: string;
  type: OrgType;
  nameAr: string;
  nameEn: string;
  governorate: string;
  area: string;
  addressText: string;
  landmark: string | null;
  locationPrecision: LocationPrecision;
  phone: string;
  whatsapp: string | null;
  hours: Hours;
  description: string | null;
  website: string | null;
  locations: OrgLocation[];
  temporarilyClosed: { reason: string | null } | null;
  verificationStatus: VerificationStatus;
  reviewerNote: string | null;
  events: VerificationEvent[];
  documents: (DocumentMeta & { status: 'pending' | 'accepted' | 'rejected' })[];
  invitations: { email: string; role: MemberRole; perms: Perms; createdAt: string }[];
  /** Set by AD-03 "تعليق"; the org disappears from search at once but its data stays for audit. */
  suspendedReason: string | null;
  isDemo: boolean;
  infoUpdatedAt: string;
  /** organization_private: never leaves the mock repo through a public method. */
  private: { licenseNo: string; exactLat: number | null; exactLng: number | null; contactPerson: string };
}

export interface StockRow {
  pharmacyId: string;
  medicineId: string;
  reportedStatus: Reported;
  reportedAt: string;
  priceIls: number | null;
  priceUpdatedAt: string | null;
  isListed: boolean;
  hiddenByAdmin: boolean;
}

/** stock_private: read only by members of the pharmacy. */
export interface StockPrivateRow {
  pharmacyId: string;
  medicineId: string;
  quantity: number;
  lowThreshold: number;
}

export interface StockHistoryRow {
  id: string;
  pharmacyId: string;
  medicineId: string | null;
  action: HistoryEntry['action'];
  oldStatus: Reported | null;
  newStatus: Reported | null;
  oldPrice: number | null;
  newPrice: number | null;
  actorId: string | null;
  count?: number;
  createdAt: string;
}

export interface SearchLogRow {
  queryNorm: string;
  medicineId: string | null;
  governorate: GovFilter;
  resultCount: number;
  createdAt: string;
}

export interface UserRow {
  id: string;
  role: string;
  displayName: string;
  email: string;
  phone: string | null;
  /** Mock mode only. Supabase Auth owns passwords in phase 4. */
  password: string | null;
  platformRole: 'reviewer' | 'super_admin' | null;
  memberships: { orgId: string; memberRole: MemberRole; perms: Perms }[];
  /** AD-09: a suspended account cannot act. */
  suspended: boolean;
  prefs: NotificationPrefs;
  joinedAt: string;
}

export interface InquiryRow {
  id: string;
  orgId: string;
  patientId: string;
  medicineId: string | null;
  serviceId: string | null;
  subject: string;
  status: InquiryStatus;
  messages: { sender: 'patient' | 'org'; body: string; createdAt: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface AuditRow {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  oldValue: unknown;
  newValue: unknown;
  createdAt: string;
}

type Owned<T> = T & { userId: string };

export interface MockState {
  version: number;
  seededAt: string;
  settings: PublicSettings & { rejectionReasons: string[] };
  orgs: OrgRow[];
  stock: StockRow[];
  stockPrivate: StockPrivateRow[];
  stockHistory: StockHistoryRow[];
  searchLogs: SearchLogRow[];
  pageViews: { pharmacyId: string; day: string; count: number }[];
  reports: ReportRow[];
  /** Medicines added by the MADAD team on top of the shipped catalog (AD-04). */
  catalogAdditions: CatalogMedicineRow[];
  /** Search aliases edited in AD-04 (e.g. «بنادول» → paracetamol). */
  aliasOverrides: Record<string, string[]>;
  medicineRequests: (MedicineRequest & { orgId: string })[];
  users: UserRow[];
  sessionUserId: string | null;
  favorites: Owned<Favorite>[];
  alerts: Owned<AvailabilityAlert>[];
  notifications: Owned<AppNotification>[];
  inquiries: InquiryRow[];
  audit: AuditRow[];
  /** Phase 5: departments, services and programmes; announcements (SPEC §9). */
  services: ServiceItem[];
  announcements: Announcement[];
}

const STORAGE_KEY = 'madad.mock.v1';
const VERSION = 5; // 5: catalog grew to 167 medicines and new dosage forms

const ago = (now: number, minutes: number | null) =>
  minutes == null ? null : new Date(now - minutes * 60_000).toISOString();
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/** Service providers (phase 5 portal) are loaded now so admin counts and memberships are complete. */
function toProviderOrg(p: (typeof providersSeed)[number], now: number): OrgRow {
  return {
    id: p.id,
    type: p.type as OrgType,
    nameAr: p.name_ar,
    nameEn: p.name_en,
    governorate: p.governorate,
    area: p.area,
    addressText: p.address_text,
    landmark: p.landmark,
    locationPrecision: p.location_precision as LocationPrecision,
    phone: p.phone,
    whatsapp: p.whatsapp,
    hours: p.hours as Hours,
    description: p.description,
    website: p.website,
    locations: p.locations as OrgLocation[],
    temporarilyClosed: null,
    verificationStatus: p.verification_status as VerificationStatus,
    reviewerNote: null,
    events: [{ action: 'approved', note: null, createdAt: new Date(now - 30 * 86_400_000).toISOString() }],
    documents: [],
    invitations: [],
    suspendedReason: null,
    isDemo: p.is_demo,
    infoUpdatedAt: new Date(now - 10 * 86_400_000).toISOString(),
    private: { licenseNo: p.private.license_no, exactLat: p.private.exact_lat, exactLng: p.private.exact_lng, contactPerson: p.private.contact_person },
  };
}

export function seedState(now = Date.now()): MockState {
  return {
    version: VERSION,
    seededAt: new Date(now).toISOString(),
    settings: {
      freshHours: 24,
      expireHours: 72,
      priceMaxDays: 14,
      programConfirmDays: 7,
      disclaimerAr: null,
      disclaimerEn: null,
      requiredDocs: REQUIRED_DOCS_DEFAULT,
      rejectionReasons: ['وثائق غير واضحة أو ناقصة', 'الرخصة غير سارية', 'البيانات لا تطابق الوثائق', 'مؤسسة مكررة'],
    },
    orgs: [...pharmaciesSeed.map((p) => ({
      id: p.id,
      type: 'pharmacy' as const,
      nameAr: p.name_ar,
      nameEn: p.name_en,
      governorate: p.governorate,
      area: p.area,
      addressText: p.address_text,
      landmark: p.landmark,
      locationPrecision: p.location_precision as LocationPrecision,
      phone: p.phone,
      whatsapp: p.whatsapp,
      hours: p.hours as Hours,
      description: null,
      website: null,
      locations: [],
      temporarilyClosed: null,
      verificationStatus: p.verification_status as VerificationStatus,
      reviewerNote: p.verification_status === 'needs_info' ? 'صورة ترخيص الصيدلية غير واضحة، يُرجى رفعها مجددًا.' : null,
      events: [{ action: 'submitted' as const, note: null, createdAt: ago(now, p.info_updated_minutes_ago)! }],
      documents: (p.documents ?? []).map((d) => ({ docType: d.doc_type, fileName: d.file_name, size: d.size, mime: d.mime, status: d.status as 'pending' | 'accepted' | 'rejected' })),
      invitations: [],
      suspendedReason: null,
      isDemo: p.is_demo,
      infoUpdatedAt: ago(now, p.info_updated_minutes_ago)!,
      private: {
        licenseNo: p.private.license_no,
        exactLat: p.private.exact_lat,
        exactLng: p.private.exact_lng,
        contactPerson: p.private.contact_person,
      },
    })), ...providersSeed.map((p) => toProviderOrg(p, now))],
    stock: stockSeed.map((s) => ({
      pharmacyId: s.pharmacy_id,
      medicineId: s.medicine_id,
      reportedStatus: s.reported_status as Reported,
      reportedAt: ago(now, s.reported_minutes_ago)!,
      priceIls: s.price_ils,
      priceUpdatedAt: ago(now, s.price_minutes_ago),
      isListed: s.is_listed,
      hiddenByAdmin: s.hidden_by_admin,
    })),
    stockPrivate: stockPrivateSeed.map((s) => ({
      pharmacyId: s.pharmacy_id,
      medicineId: s.medicine_id,
      quantity: s.quantity,
      lowThreshold: s.low_threshold,
    })),
    stockHistory: historySeed.map((h, i) => ({
      id: `h-seed-${i}`,
      pharmacyId: h.pharmacy_id,
      medicineId: h.medicine_id,
      action: h.action as StockHistoryRow['action'],
      count: 'count' in h ? (h.count as number) : undefined,
      oldStatus: h.old_status as Reported,
      newStatus: h.new_status as Reported,
      oldPrice: h.old_price,
      newPrice: h.new_price,
      actorId: h.actor_id,
      createdAt: ago(now, h.minutes_ago)!,
    })),
    searchLogs: logsSeed.map((l) => ({
      queryNorm: l.query_norm,
      medicineId: l.medicine_id,
      governorate: l.governorate,
      resultCount: l.result_count,
      createdAt: ago(now, l.minutes_ago)!,
    })),
    pageViews: viewsSeed.map((v) => ({
      pharmacyId: v.pharmacy_id,
      day: dayKey(new Date(now - v.days_ago * 86_400_000)),
      count: v.count,
    })),
    reports: reportsSeed.map((r) => ({
      id: r.id,
      entityType: r.entity_type as NewReport['entityType'],
      entityId: r.entity_id,
      reason: r.reason as NewReport['reason'],
      details: r.details,
      governorate: r.governorate,
      status: r.status as ReportRow['status'],
      adminNote: null,
      resolution: null,
      createdAt: ago(now, r.minutes_ago)!,
    })),
    catalogAdditions: [],
    aliasOverrides: {},
    medicineRequests: requestsSeed.map((r) => ({
      id: r.id,
      orgId: r.org_id,
      nameAr: r.name_ar,
      nameEn: r.name_en,
      genericName: r.generic_name,
      strength: r.strength,
      dosageForm: r.dosage_form as MedicineRequest['dosageForm'],
      packSize: r.pack_size,
      manufacturer: r.manufacturer,
      barcode: r.barcode,
      categoryId: r.category_id,
      status: r.status as MedicineRequest['status'],
      createdAt: ago(now, r.minutes_ago)!,
    })),
    users: usersSeed.map((u) => ({
      id: u.id,
      role: u.role,
      displayName: u.display_name,
      email: u.email,
      phone: u.phone,
      password: u.password,
      platformRole: u.platform_role as UserRow['platformRole'],
      memberships: u.memberships.map((m) => ({ orgId: m.org_id, memberRole: m.member_role as MemberRole, perms: m.perms as Perms })),
      suspended: false,
      prefs: { ...DEFAULT_PREFS },
      joinedAt: new Date(now - 45 * 86_400_000).toISOString(),
    })),
    sessionUserId: null,
    favorites: [],
    alerts: [],
    notifications: [],
    inquiries: inquiriesSeed.map((q) => {
      const messages = q.messages.map((m) => ({
        sender: m.sender as 'patient' | 'org',
        body: m.body,
        createdAt: ago(now, m.minutes_ago)!,
      }));
      return {
        id: q.id,
        orgId: q.org_id,
        patientId: q.patient_id,
        medicineId: q.medicine_id,
        serviceId: null,
        subject: q.subject,
        status: q.status as InquiryStatus,
        messages,
        createdAt: messages[0]!.createdAt,
        updatedAt: messages.at(-1)!.createdAt,
      };
    }),
    audit: [],
    services: providersSeed.flatMap((p) => p.services.map((x) => toService(p.id, x, now))),
    announcements: announcementsSeed.map((a) => ({
      id: a.id,
      orgId: a.org_id,
      title: a.title,
      body: a.body,
      startsAt: ago(now, a.starts_minutes_ago)!,
      endsAt: a.ends_days == null ? null : new Date(now + a.ends_days * 86_400_000).toISOString(),
      reviewStatus: a.review_status as Announcement['reviewStatus'],
      rejectionReason: a.rejection_reason,
      createdAt: ago(now, a.created_minutes_ago)!,
    })),
  };
}

const dayOffset = (now: number, days: number | null) => (days == null ? null : new Date(now + days * 86_400_000).toISOString().slice(0, 10));

function toService(orgId: string, x: (typeof providersSeed)[number]['services'][number], now: number): ServiceItem {
  return {
    id: x.id,
    orgId,
    kind: x.kind as ServiceItem['kind'],
    name: x.name,
    category: x.category as ServiceItem['category'],
    description: x.description,
    place: x.place,
    phone: x.phone,
    operating: x.operating,
    beneficiaries: x.beneficiaries,
    requiredDocs: x.required_docs,
    contact: x.contact,
    hours: x.hours as Hours | null,
    location: x.location,
    eligibility: x.eligibility,
    howToApply: x.how_to_apply,
    startsOn: dayOffset(now, x.starts_days),
    endsOn: dayOffset(now, x.ends_days),
    programStatus: x.program_status as ServiceItem['programStatus'],
    confirmedAt: ago(now, x.confirmed_minutes_ago),
    reviewStatus: x.review_status as ServiceItem['reviewStatus'],
    rejectionReason: x.rejection_reason,
    updatedAt: ago(now, x.updated_minutes_ago)!,
  };
}

function readStorage(): MockState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MockState;
    return parsed.version === VERSION ? parsed : null;
  } catch {
    return null;
  }
}

function writeStorage(s: MockState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // private window or quota: the demo keeps working in memory
  }
}

let state: MockState = readStorage() ?? seedState();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  // Another tab (e.g. the pharmacy portal) changed the demo data: reload and notify.
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return;
    state = readStorage() ?? state;
    emit();
  });
}

export const store = {
  get: (): MockState => state,
  /** Applies a change, persists it and notifies subscribers. */
  mutate<T>(fn: (s: MockState) => T): T {
    const out = fn(state);
    writeStorage(state);
    emit();
    return out;
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** Restores the original seeds (demo reset, SPEC §4). */
  reset(now = Date.now()) {
    state = seedState(now);
    writeStorage(state);
    emit();
  },
};

/** audit_log: every change to availability, price, permissions or verification (SPEC §4). */
export function audit(s: MockState, action: string, entityType: string, entityId: string, oldValue: unknown, newValue: unknown) {
  s.audit.push({ id: newId(), actorId: s.sessionUserId, action, entityType, entityId, oldValue, newValue, createdAt: new Date().toISOString() });
}
