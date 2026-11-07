// Shared data contracts (SPEC §12). The UI talks to these interfaces only; mock and
// Supabase implementations live in src/data/mock and src/data/supabase.
import type { FreshnessSettings, Reported } from '../lib/freshness';
export type { Reported } from '../lib/freshness';
import type { Hours } from '../lib/hours';
import type { Searchable } from '../lib/search';
import type { SuppressedMatrix } from '../lib/suppression';
import type { AdminUser, DirectoryRepo, ModerationItem, NotificationPrefs, ProviderPortalRepo } from './providerTypes';
export * from './providerTypes';

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

/** Every dosage form the catalog accepts (also the check in migration 0012). */
export const DOSAGE_FORMS = [
  'tablet', 'capsule', 'syrup', 'suspension', 'injection_pen', 'vial', 'inhaler', 'sachet', 'cream',
  'drops', 'injection', 'ointment', 'gel', 'suppository', 'spray', 'solution',
] as const;
export type DosageForm = (typeof DOSAGE_FORMS)[number];

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
  /** "مغلق مؤقتًا" set by the pharmacy (PH-07). */
  temporarilyClosed: { reason: string | null } | null;
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

/** settings rows with is_public = true (SPEC §13). */
export interface PublicSettings extends FreshnessSettings {
  /** Admin-edited disclaimer; null = the default text (SPEC §2 rule 10). */
  disclaimerAr: string | null;
  disclaimerEn: string | null;
  requiredDocs: Record<OrgType, string[]>;
  /** «نشط الآن» needs a confirmation this often (SPEC §9 PR-04, AD-11). */
  programConfirmDays: number;
}

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

export type NotificationKind = 'alert_met' | 'inquiry_reply' | 'verification' | 'platform' | 'inquiry_new' | 'medicine_approved' | 'content_review';

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
  /** A service or programme the question is about (P-08); null for pharmacies. */
  serviceId?: string | null;
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
  entityType: 'pharmacy' | 'medicine' | 'availability' | 'catalog' | 'organization';
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
  pharmacyReports(pharmacyId: string, opts?: { preview?: boolean }): Promise<PharmacyAvailability[]>;
  recentlyUpdated(gov: GovFilter, withinMinutes: number, limit: number): Promise<RecentUpdate[]>;
  updateStock(pharmacyId: string, changes: StockChange[]): Promise<void>;
  confirmAll(pharmacyId: string, opts?: { pricesToo?: boolean }): Promise<number>;
}

export interface OrgRepo {
  pharmacies(gov?: GovFilter): Promise<PublicPharmacy[]>;
  /** `preview` lets members see their own not-yet-approved pharmacy as patients will (PH-07). */
  pharmacy(id: string, opts?: { preview?: boolean }): Promise<PublicPharmacy | null>;
}

export interface InsightsRepo {
  /** Anonymous page-view counter for "مشاهدات صفحتك" (PH-01); no identity is stored. */
  viewPharmacy(pharmacyId: string): Promise<void>;
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
  /** PH-10: a new password for the signed-in account. */
  changePassword(newPassword: string): Promise<void>;
  /** PH-10 sessions: signs out everywhere except this browser. */
  signOutOtherDevices(): Promise<void>;
  prefs(): Promise<NotificationPrefs>;
  updatePrefs(patch: Partial<NotificationPrefs>): Promise<NotificationPrefs>;
}

export interface ReportsRepo {
  submit(report: NewReport): Promise<void>;
}

export interface Repos {
  admin: AdminRepo;
  demo: DemoRepo;
  auth: AuthRepo;
  registration: RegistrationRepo;
  pharmacyPortal: PharmacyPortalRepo;
  catalog: CatalogRepo;
  availability: AvailabilityRepo;
  orgs: OrgRepo;
  insights: InsightsRepo;
  settings: SettingsRepo;
  account: AccountRepo;
  reports: ReportsRepo;
  directory: DirectoryRepo;
  providerPortal: ProviderPortalRepo;
  /** Fires when data changes outside the current query (another tab, a portal update). */
  subscribe(listener: () => void): () => void;
}

// ---------------------------------------------------------------- auth, organizations, pharmacy portal (phase 2)

export type OrgType = 'pharmacy' | 'hospital' | 'medical_point' | 'humanitarian';
export type VerificationStatus = 'draft' | 'pending' | 'needs_info' | 'approved' | 'rejected' | 'suspended';
export type MemberRole = 'owner' | 'manager' | 'staff' | 'viewer';
export const PERMS = ['availability', 'prices', 'medicines', 'publish', 'inquiries', 'profile', 'team', 'reports'] as const;
export type Perm = (typeof PERMS)[number];
export type Perms = Record<Perm, boolean>;

export interface Membership {
  orgId: string;
  orgType: OrgType;
  orgNameAr: string;
  orgNameEn: string;
  role: MemberRole;
  perms: Perms;
  verificationStatus: VerificationStatus;
}

export interface Me extends Session {
  platformRole: 'reviewer' | 'super_admin' | null;
  memberships: Membership[];
}

export interface SignUpInput {
  displayName: string;
  email: string;
  password: string;
  phone: string | null;
}

export interface AuthRepo {
  me(): Promise<Me | null>;
  /** Generic failure on purpose: never says whether the email exists (SPEC §7 A-02). */
  signIn(email: string, password: string): Promise<Me | null>;
  signUp(input: SignUpInput): Promise<{ ok: true; me: Me } | { ok: false; reason: 'email_taken' }>;
  requestPasswordReset(email: string): Promise<void>;
  /** Sign-in providers turned on for this project besides email (Google: docs/DECISIONS.md). None in mock mode. */
  oauthProviders(): Promise<OAuthProvider[]>;
  /** Leaves for the provider's sign-in page; the user returns to /auth/callback, then to `from`. */
  signInWithOAuth(provider: OAuthProvider, from: string | null): Promise<void>;
}

export type OAuthProvider = 'google';

export interface DocumentMeta {
  docType: string;
  fileName: string;
  size: number;
  mime: string;
  /** The picked file itself, kept in memory only: uploaded to Storage in supabase mode, never saved in the draft. */
  file?: File;
}

export interface RegistrationDraft {
  account: { contactName: string; contactRole: string; email: string; phone: string; password: string };
  org: {
    type: OrgType;
    nameAr: string;
    nameEn: string;
    licenseNo: string;
    governorate: GovId;
    area: string;
    addressText: string;
    landmark: string;
    lat: number | null;
    lng: number | null;
    locationPrecision: LocationPrecision;
    phone: string;
    whatsapp: string;
    hours: Hours;
  };
  documents: DocumentMeta[];
}

export interface VerificationEvent {
  action: 'submitted' | 'approved' | 'needs_info' | 'rejected' | 'resubmitted' | 'profile_changed';
  note: string | null;
  createdAt: string;
}

export interface RegistrationStatus {
  orgId: string;
  orgType: OrgType;
  nameAr: string;
  nameEn: string;
  status: VerificationStatus;
  reviewerNote: string | null;
  events: VerificationEvent[];
}

export interface RegistrationRepo {
  submit(draft: RegistrationDraft): Promise<{ ok: true; orgId: string } | { ok: false; reason: 'email_taken' }>;
  myStatus(): Promise<RegistrationStatus | null>;
  /** "استكمال الطلب": sends a needs_info application back to review with the applicant's note. */
  resubmit(orgId: string, note: string, documents: DocumentMeta[]): Promise<void>;
}

/** A pharmacy's own row: public fields, listing flags and, for authorized members only, the internal quantity. */
export interface PortalStockRow extends PharmacyAvailability {
  isListed: boolean;
  hiddenByAdmin: boolean;
  quantity: number | null;
  lowThreshold: number | null;
}

export interface HistoryEntry {
  id: string;
  medicineId: string | null;
  action: 'update' | 'confirm_all' | 'hide' | 'show' | 'add' | 'remove';
  oldStatus: Reported | null;
  newStatus: Reported | null;
  oldPrice: number | null;
  newPrice: number | null;
  actorName: string;
  count: number | null;
  createdAt: string;
}

export interface PortalOverview {
  listed: number;
  fresh: number;
  stale: number;
  expired: number;
  newInquiries: number;
  viewsThisWeek: number;
  viewsLastWeek: number;
  /** Searches for this pharmacy's medicines in its governorate, oldest day first. */
  searchesByDay: { date: string; count: number }[];
  /** "مطلوب عندك وغير متوفر": searched with no result in the area over 7 days, aggregated without identities. */
  unmetNearby: { medicineId: string; count: number }[];
  activity: HistoryEntry[];
}

export type InquiryStatus = 'new' | 'in_progress' | 'replied' | 'closed';

export interface InquiryThread {
  id: string;
  orgId: string;
  medicineId: string | null;
  serviceId: string | null;
  subject: string;
  status: InquiryStatus;
  /** Display name only (SPEC §2 rule 8). */
  patientName: string;
  messages: { sender: 'patient' | 'org'; body: string; createdAt: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface OrgProfile {
  id: string;
  type: OrgType;
  nameAr: string;
  nameEn: string;
  licenseNo: string;
  governorate: GovId;
  area: string;
  addressText: string;
  landmark: string | null;
  locationPrecision: LocationPrecision;
  exactLat: number | null;
  exactLng: number | null;
  phone: string;
  whatsapp: string | null;
  hours: Hours;
  description: string | null;
  temporarilyClosed: { reason: string | null } | null;
  verificationStatus: VerificationStatus;
}

export type OrgProfilePatch = Partial<Omit<OrgProfile, 'id' | 'type' | 'verificationStatus'>>;

export interface TeamMember {
  /** userId for active members, email for invitations. */
  key: string;
  email: string;
  displayName: string | null;
  role: MemberRole;
  perms: Perms;
  status: 'active' | 'invited';
}

export interface MedicineRequestInput {
  nameAr: string;
  nameEn: string;
  genericName: string;
  strength: string;
  dosageForm: DosageForm;
  packSize: string;
  manufacturer: string | null;
  barcode: string | null;
  categoryId: string;
}

export interface MedicineRequest extends MedicineRequestInput {
  id: string;
  status: 'pending' | 'approved' | 'rejected' | 'merged';
  createdAt: string;
}

export interface PharmacyPortalRepo {
  overview(orgId: string): Promise<PortalOverview>;
  stock(orgId: string): Promise<PortalStockRow[]>;
  history(orgId: string): Promise<HistoryEntry[]>;
  setListed(orgId: string, medicineId: string, listed: boolean): Promise<void>;
  removeMedicine(orgId: string, medicineId: string): Promise<void>;
  addMedicine(orgId: string, medicineId: string, status: Reported): Promise<void>;
  /** PH-04 «إضافة المحدد»: adds several at once with one status; medicines already listed are skipped. Returns how many were added. */
  addMedicines(orgId: string, medicineIds: string[], status: Reported): Promise<number>;
  setQuantity(orgId: string, medicineId: string, quantity: number, lowThreshold: number): Promise<void>;
  requestMedicine(orgId: string, input: MedicineRequestInput): Promise<void>;
  requests(orgId: string): Promise<MedicineRequest[]>;
  inquiries(orgId: string): Promise<InquiryThread[]>;
  replyInquiry(orgId: string, inquiryId: string, body: string): Promise<void>;
  setInquiryStatus(orgId: string, inquiryId: string, status: InquiryStatus): Promise<void>;
  profile(orgId: string): Promise<OrgProfile>;
  /** Changing the name or licence sends the organization back to review (SPEC §8 PH-07). */
  updateProfile(orgId: string, patch: OrgProfilePatch): Promise<{ reReview: boolean }>;
  team(orgId: string): Promise<TeamMember[]>;
  invite(orgId: string, email: string, role: MemberRole): Promise<void>;
  updateMember(orgId: string, key: string, patch: { role?: MemberRole; perms?: Perms }): Promise<void>;
  removeMember(orgId: string, key: string): Promise<void>;
}

// ---------------------------------------------------------------- admin (phase 3)

export interface AdminOverview {
  verifiedPharmacies: number;
  verifiedProviders: number;
  pendingVerifications: number;
  catalogSize: number;
  /** Share of listed reports that are still fresh, 0..1. */
  freshRatio: number;
  searchesToday: number;
  failedToday: number;
  openReports: number;
  daily: { date: string; searches: number; failed: number }[];
  freshnessByGov: { governorate: GovId; fresh: number; stale: number; expired: number }[];
  topUnmet: { medicineId: string; count: number }[];
  byGov: { governorate: GovId; pharmacies: number; stalePharmacies: number; failedSearches: number }[];
  pending: { pharmacies: number; medicines: number; reports: number; announcements: number };
}

export type ReviewDecision = 'approve' | 'needs_info' | 'reject';
export type DocumentStatus = 'pending' | 'accepted' | 'rejected';

export interface VerificationItem {
  orgId: string;
  type: OrgType;
  nameAr: string;
  nameEn: string;
  governorate: GovId;
  area: string;
  addressText: string;
  landmark: string | null;
  phone: string;
  whatsapp: string | null;
  licenseNo: string;
  contactPerson: string;
  exactLat: number | null;
  exactLng: number | null;
  status: VerificationStatus;
  submittedAt: string;
  reviewerNote: string | null;
  documents: (DocumentMeta & { status: DocumentStatus })[];
  events: VerificationEvent[];
  /** Same phone or licence as another organization (SPEC §10 AD-02). */
  warnings: { field: 'phone' | 'license'; otherOrgId: string; otherNameAr: string; otherNameEn: string }[];
}

export interface AdminOrgRow {
  id: string;
  type: OrgType;
  nameAr: string;
  nameEn: string;
  governorate: GovId;
  verificationStatus: VerificationStatus;
  suspendedReason: string | null;
  listed: number;
  lastStockUpdateAt: string | null;
  members: number;
}

export interface RequestReview extends MedicineRequest {
  orgId: string;
  orgNameAr: string;
  orgNameEn: string;
  /** Fuzzy matches in the catalog, best first. */
  duplicates: { medicineId: string; score: number }[];
}

export interface QualityRow {
  pharmacyId: string;
  nameAr: string;
  nameEn: string;
  governorate: GovId;
  listed: number;
  freshRatio: number;
  lastUpdate: string | null;
  reportsAgainst: number;
  /** confirm_all actions ÷ all save actions over 30 days; high = possible box-ticking. */
  confirmAllRatio: number;
}

export interface ConflictRow {
  pharmacyId: string;
  medicineId: string;
  reportedAt: string;
  reportId: string;
  reportedWrongAt: string;
}

export interface DataQuality {
  byGov: { governorate: GovId; fresh: number; stale: number; expired: number }[];
  pharmacies: QualityRow[];
  conflicts: ConflictRow[];
}

export interface UnmetDemand {
  governorates: GovId[];
  medicineIds: string[];
  /** Failed searches per medicine × governorate, already suppressed on the server (cells under 5, revealing totals). */
  matrix: SuppressedMatrix;
  /** Frequent search texts that matched nothing in the catalog. */
  unmatched: { query: string; count: number }[];
  failedTotal: number;
}

export type ReportStatus = 'new' | 'in_review' | 'resolved' | 'rejected';

export interface AdminReport extends NewReport {
  id: string;
  status: ReportStatus;
  adminNote: string | null;
  resolution: string | null;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue: unknown;
  newValue: unknown;
  createdAt: string;
}

export interface PlatformSettings extends PublicSettings {
  rejectionReasons: string[];
}

export interface AdminRepo {
  overview(): Promise<AdminOverview>;
  verificationQueue(): Promise<VerificationItem[]>;
  /** review_org(org_id, decision, note): notes are required for needs_info and reject. */
  reviewOrg(orgId: string, decision: ReviewDecision, note: string): Promise<void>;
  setDocumentStatus(orgId: string, fileName: string, status: DocumentStatus): Promise<void>;
  /** A short-lived signed link to the uploaded file, or null when only its metadata exists (mock mode). */
  documentUrl(orgId: string, fileName: string): Promise<string | null>;
  organizations(): Promise<AdminOrgRow[]>;
  suspendOrg(orgId: string, reason: string): Promise<void>;
  reactivateOrg(orgId: string): Promise<void>;
  catalog(): Promise<Catalog>;
  addCatalogMedicine(input: MedicineRequestInput & { aliases: string[] }): Promise<string>;
  setAliases(medicineId: string, aliases: string[]): Promise<void>;
  importCatalog(rows: (MedicineRequestInput & { aliases: string[] })[]): Promise<number>;
  requests(): Promise<RequestReview[]>;
  /** review_medicine(id, decision, merge_into). */
  reviewRequest(id: string, decision: 'approve' | 'merge' | 'reject', mergeInto?: string): Promise<void>;
  dataQuality(): Promise<DataQuality>;
  remindPharmacy(pharmacyId: string): Promise<void>;
  /** Hides one report from the public with a reason. There is deliberately no "confirm availability" (SPEC §2 rule 5). */
  hideReport(pharmacyId: string, medicineId: string, reason: string): Promise<void>;
  /** unmet_demand(from, to): reviewers only; aggregated, no identities. */
  unmetDemand(days: number, categoryId: string | 'all', region: 'gaza' | 'west_bank'): Promise<UnmetDemand>;
  reports(): Promise<AdminReport[]>;
  updateReport(id: string, patch: { status?: ReportStatus; adminNote?: string; resolution?: string }): Promise<void>;
  audit(): Promise<AuditEntry[]>;
  settings(): Promise<PlatformSettings>;
  updateSettings(patch: Partial<PlatformSettings>): Promise<void>;
  /** AD-08: new or edited services, programmes and announcements. */
  moderationQueue(): Promise<ModerationItem[]>;
  moderate(kind: ModerationItem['kind'], id: string, decision: 'approve' | 'reject', reason: string): Promise<void>;
  /** AD-09, system admin only. */
  users(): Promise<AdminUser[]>;
  setUserSuspended(userId: string, suspended: boolean): Promise<void>;
  setPlatformRole(userId: string, role: 'reviewer' | 'super_admin' | null): Promise<void>;
}

/** Demo mode only (VITE_DEMO=true): the floating role switcher and data reset (SPEC §4). */
export interface DemoRepo {
  signInAs(userId: string | null): Promise<Me | null>;
  reset(): Promise<void>;
}
