// In-memory demo database persisted to localStorage (SPEC §12 `mock` mode).
// Seeds carry relative times; they become absolute timestamps the first time a browser loads them.
import type { Reported } from '../../lib/freshness';
import type { Hours } from '../../lib/hours';
import type {
  AppNotification,
  AvailabilityAlert,
  Favorite,
  GovFilter,
  LocationPrecision,
  NewInquiry,
  NewReport,
  PublicSettings,
} from '../types';
import pharmaciesSeed from './seed/pharmacies.json';
import stockSeed from './seed/stock.json';
import logsSeed from './seed/search_logs.json';
import usersSeed from './seed/users.json';

export type VerificationStatus = 'draft' | 'pending' | 'needs_info' | 'approved' | 'rejected' | 'suspended';

export interface OrgRow {
  id: string;
  type: 'pharmacy' | 'hospital' | 'medical_point' | 'humanitarian';
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
  verificationStatus: VerificationStatus;
  isDemo: boolean;
  infoUpdatedAt: string;
  /** organization_private: never leaves the mock repo through a public method. */
  private: { licenseNo: string; exactLat: number; exactLng: number; contactPerson: string };
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

export interface StockHistoryRow {
  pharmacyId: string;
  medicineId: string | null;
  action: 'update' | 'confirm_all' | 'hide';
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
  platformRole: string | null;
  memberships: { orgId: string; memberRole: string; perms: Record<string, boolean> }[];
}

type Owned<T> = T & { userId: string };

export interface MockState {
  version: number;
  seededAt: string;
  settings: PublicSettings;
  orgs: OrgRow[];
  stock: StockRow[];
  stockHistory: StockHistoryRow[];
  searchLogs: SearchLogRow[];
  reports: (NewReport & { id: string; createdAt: string; status: 'new' })[];
  users: UserRow[];
  sessionUserId: string | null;
  favorites: Owned<Favorite>[];
  alerts: Owned<AvailabilityAlert>[];
  notifications: Owned<AppNotification>[];
  inquiries: Owned<NewInquiry & { id: string; createdAt: string; status: 'new' }>[];
}

const STORAGE_KEY = 'madad.mock.v1';
const VERSION = 1;

const ago = (now: number, minutes: number | null) =>
  minutes == null ? null : new Date(now - minutes * 60_000).toISOString();

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
      verificationStatus: p.verification_status as VerificationStatus,
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
    stockHistory: [],
    searchLogs: logsSeed.map((l) => ({
      queryNorm: l.query_norm,
      medicineId: l.medicine_id,
      governorate: l.governorate,
      resultCount: l.result_count,
      createdAt: ago(now, l.minutes_ago)!,
    })),
    reports: [],
    users: usersSeed.map((u) => ({
      id: u.id,
      role: u.role,
      displayName: u.display_name,
      email: u.email,
      phone: u.phone,
      platformRole: u.platform_role,
      memberships: u.memberships.map((m) => ({ orgId: m.org_id, memberRole: m.member_role, perms: m.perms })),
    })),
    sessionUserId: null,
    favorites: [],
    alerts: [],
    notifications: [],
    inquiries: [],
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

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
