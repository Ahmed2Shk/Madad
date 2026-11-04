// In-memory demo database persisted to localStorage (SPEC §12 `mock` mode).
// Seeds carry relative times; they become absolute timestamps the first time a browser loads them.
import type { Reported } from '../../lib/freshness';
import type { Hours } from '../../lib/hours';
import type {
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
  OrgType,
  Perms,
  PublicSettings,
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

export type { VerificationStatus };

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
  temporarilyClosed: { reason: string | null } | null;
  verificationStatus: VerificationStatus;
  reviewerNote: string | null;
  events: VerificationEvent[];
  documents: (DocumentMeta & { status: 'pending' | 'accepted' | 'rejected' })[];
  invitations: { email: string; role: MemberRole; perms: Perms; createdAt: string }[];
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
}

export interface InquiryRow {
  id: string;
  orgId: string;
  patientId: string;
  medicineId: string | null;
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
  settings: PublicSettings;
  orgs: OrgRow[];
  stock: StockRow[];
  stockPrivate: StockPrivateRow[];
  stockHistory: StockHistoryRow[];
  searchLogs: SearchLogRow[];
  pageViews: { pharmacyId: string; day: string; count: number }[];
  reports: (NewReport & { id: string; createdAt: string; status: 'new' })[];
  medicineRequests: (MedicineRequest & { orgId: string })[];
  users: UserRow[];
  sessionUserId: string | null;
  favorites: Owned<Favorite>[];
  alerts: Owned<AvailabilityAlert>[];
  notifications: Owned<AppNotification>[];
  inquiries: InquiryRow[];
  audit: AuditRow[];
}

const STORAGE_KEY = 'madad.mock.v1';
const VERSION = 2;

const ago = (now: number, minutes: number | null) =>
  minutes == null ? null : new Date(now - minutes * 60_000).toISOString();
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export function seedState(now = Date.now()): MockState {
  return {
    version: VERSION,
    seededAt: new Date(now).toISOString(),
    settings: { freshHours: 24, expireHours: 72, priceMaxDays: 14 },
    orgs: pharmaciesSeed.map((p) => ({
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
      temporarilyClosed: null,
      verificationStatus: p.verification_status as VerificationStatus,
      reviewerNote: p.verification_status === 'needs_info' ? 'صورة ترخيص الصيدلية غير واضحة، يُرجى رفعها مجددًا.' : null,
      events: [{ action: 'submitted' as const, note: null, createdAt: ago(now, p.info_updated_minutes_ago)! }],
      documents: [],
      invitations: [],
      isDemo: p.is_demo,
      infoUpdatedAt: ago(now, p.info_updated_minutes_ago)!,
      private: {
        licenseNo: p.private.license_no,
        exactLat: p.private.exact_lat,
        exactLng: p.private.exact_lng,
        contactPerson: p.private.contact_person,
      },
    })),
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
      action: 'update' as const,
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
    reports: [],
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
        subject: q.subject,
        status: q.status as InquiryStatus,
        messages,
        createdAt: messages[0]!.createdAt,
        updatedAt: messages.at(-1)!.createdAt,
      };
    }),
    audit: [],
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
