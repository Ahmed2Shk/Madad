// Shared data contracts (SPEC §12). The UI talks to these interfaces only; mock and
// Supabase implementations live in src/data/mock and src/data/supabase.
import type { FreshnessSettings, Reported } from '../lib/freshness';
import type { Hours } from '../lib/hours';
import type { Searchable } from '../lib/search';

export type GovId = string;
/** 'all' searches every governorate. */
export type GovFilter = GovId | 'all';

export interface Area {
  id: string;
  nameAr: string;
  nameEn: string;
}

export interface Governorate {
  id: GovId;
  region: 'gaza' | 'west_bank';
  nameAr: string;
  nameEn: string;
  center: { lat: number; lng: number };
  areas: Area[];
}

export interface Category {
  id: string;
  nameAr: string;
  nameEn: string;
}

export type DosageForm =
  | 'tablet'
  | 'capsule'
  | 'syrup'
  | 'suspension'
  | 'injection_pen'
  | 'vial'
  | 'inhaler'
  | 'sachet'
  | 'cream';

export interface Medicine extends Searchable {
  dosageForm: DosageForm;
  packSize: string;
  /** English pack size, when the catalog has one (docs/DECISIONS.md #6). */
  packSizeEn: string | null;
  manufacturer: string | null;
  categoryId: string;
}

export interface Catalog {
  version: number;
  categories: Category[];
  medicines: Medicine[];
}

export type LocationPrecision = 'exact' | 'area' | 'hidden';

/** What the public may see of a pharmacy: no licence number, coordinates only when precision is exact. */
export interface PublicPharmacy {
  id: string;
  nameAr: string;
  nameEn: string;
  governorate: GovId;
  area: string;
  addressText: string;
  landmark: string | null;
  locationPrecision: LocationPrecision;
  publicLat: number | null;
  publicLng: number | null;
  phone: string;
  whatsapp: string | null;
  hours: Hours;
  infoUpdatedAt: string;
  lastStockUpdateAt: string | null;
}

/** One public availability row (view `public_availability`). Never carries quantity or reporter identity. */
export interface PharmacyAvailability {
  pharmacyId: string;
  medicineId: string;
  reportedStatus: Reported;
  reportedAt: string;
  priceIls: number | null;
  priceUpdatedAt: string | null;
}

export interface MedicineHit {
  medicine: Medicine;
  /** Public rows for this medicine in the searched governorate(s). */
  reports: PharmacyAvailability[];
}

export interface RecentUpdate {
  pharmacyId: string;
  at: string;
}

export interface StockChange {
  medicineId: string;
  status: Reported;
  priceIls?: number | null;
  /** When the change was made on the device, not when it was sent (SPEC §8). */
  clientUpdatedAt: string;
}

export type PublicSettings = FreshnessSettings;

export interface SearchLogEntry {
  query: string;
  governorate: GovFilter;
  medicineId: string | null;
  resultCount: number;
}

export interface TopSearch {
  medicineId: string;
  count: number;
}

// ---------------------------------------------------------------- account

export interface Session {
  userId: string;
  displayName: string;
  email: string;
  phone: string | null;
}

export type FavoriteType = 'medicine' | 'pharmacy' | 'provider';

export interface Favorite {
  entityType: FavoriteType;
  entityId: string;
  createdAt: string;
}

export interface AvailabilityAlert {
  id: string;
  medicineId: string;
  governorate: GovFilter;
  active: boolean;
  createdAt: string;
  notifiedAt: string | null;
}

export type NotificationKind = 'alert_met' | 'inquiry_reply' | 'platform';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  /** i18n-ready parts; the UI composes the sentence. */
  data: Record<string, string>;
  link: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface NewInquiry {
  orgId: string;
  medicineId: string | null;
  subject: string;
  body: string;
}

export type ReportReason =
  | 'wrong_availability'
  | 'closed_or_moved'
  | 'wrong_phone'
  | 'misleading'
  | 'other'
  | 'shortage'
  | 'suggest_medicine';

export interface NewReport {
  entityType: 'pharmacy' | 'medicine' | 'availability' | 'catalog';
  entityId: string;
  reason: ReportReason;
  details: string;
  governorate?: GovFilter;
}

// ---------------------------------------------------------------- repositories

export interface CatalogRepo {
  load(): Promise<Catalog>;
}

export interface AvailabilityRepo {
  searchMedicines(q: string, gov?: GovFilter): Promise<MedicineHit[]>;
  pharmaciesFor(medicineId: string, gov?: GovFilter): Promise<PharmacyAvailability[]>;
  pharmacyReports(pharmacyId: string): Promise<PharmacyAvailability[]>;
  recentlyUpdated(gov: GovFilter, withinMinutes: number, limit: number): Promise<RecentUpdate[]>;
  updateStock(pharmacyId: string, changes: StockChange[]): Promise<void>;
  confirmAll(pharmacyId: string, opts?: { pricesToo?: boolean }): Promise<number>;
}

export interface OrgRepo {
  pharmacies(gov?: GovFilter): Promise<PublicPharmacy[]>;
  pharmacy(id: string): Promise<PublicPharmacy | null>;
}

export interface InsightsRepo {
  /** Called only after the user presses "search" or picks a suggestion (SPEC §7). */
  logSearch(entry: SearchLogEntry): Promise<void>;
  topSearched(gov: GovFilter, limit: number): Promise<TopSearch[]>;
}

export interface SettingsRepo {
  get(): Promise<PublicSettings>;
}

export interface AccountRepo {
  session(): Promise<Session | null>;
  /** Demo mode only: continue as the seeded patient account. Real sign-in arrives with A-02. */
  signInDemoPatient(): Promise<Session>;
  signOut(): Promise<void>;
  updateProfile(patch: Partial<Pick<Session, 'displayName' | 'phone'>>): Promise<Session>;
  favorites(): Promise<Favorite[]>;
  toggleFavorite(entityType: FavoriteType, entityId: string): Promise<boolean>;
  alerts(): Promise<AvailabilityAlert[]>;
  createAlert(medicineId: string, governorate: GovFilter): Promise<AvailabilityAlert>;
  stopAlert(id: string): Promise<void>;
  notifications(): Promise<AppNotification[]>;
  markNotificationsRead(): Promise<void>;
  sendInquiry(inquiry: NewInquiry): Promise<void>;
  exportData(): Promise<unknown>;
  deleteAccount(): Promise<void>;
}

export interface ReportsRepo {
  submit(report: NewReport): Promise<void>;
}

export interface Repos {
  catalog: CatalogRepo;
  availability: AvailabilityRepo;
  orgs: OrgRepo;
  insights: InsightsRepo;
  settings: SettingsRepo;
  account: AccountRepo;
  reports: ReportsRepo;
  /** Fires when data changes outside the current query (another tab, a portal update). */
  subscribe(listener: () => void): () => void;
}
