// Contracts for phase 5 (SPEC §9, §10 AD-08/AD-09, §8 PH-09/PH-10): service providers, the medical
// directory, content moderation, users, and account settings. Re-exported from types.ts.
import type { Hours } from '../lib/hours';
import type { ProgramStatus, ReviewStatus } from '../lib/programs';
import type { GovFilter, GovId, MemberRole, OrgProfile, OrgProfilePatch, OrgType, PublicPharmacy } from './types';

export type { ProgramStatus, ReviewStatus } from '../lib/programs';

export type ProviderType = Exclude<OrgType, 'pharmacy'>;
export type ServiceKind = 'department' | 'service' | 'program';
/** SPEC §9 PR-03 service categories. */
export const SERVICE_CATEGORIES = ['emergency', 'dialysis', 'maternity', 'chronic', 'mental_health', 'vaccination', 'rehab', 'pediatrics', 'general'] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

/** An extra place an organization works from (PR-02). */
export interface OrgLocation {
  name: string;
  area: string;
  hours: Hours | null;
}

/** A department, service or programme. Fields a kind does not use stay null or empty. */
export interface ServiceItem {
  id: string;
  orgId: string;
  kind: ServiceKind;
  name: string;
  category: ServiceCategory | null;
  description: string | null;
  /** Department: where it is inside the hospital, its internal phone, and whether it runs now. */
  place: string | null;
  phone: string | null;
  operating: boolean;
  /** Service and programme. */
  beneficiaries: string | null;
  requiredDocs: string[];
  contact: string | null;
  hours: Hours | null;
  location: string | null;
  /** Programme only. */
  eligibility: string[];
  howToApply: string | null;
  startsOn: string | null;
  endsOn: string | null;
  programStatus: ProgramStatus | null;
  confirmedAt: string | null;
  reviewStatus: ReviewStatus;
  rejectionReason: string | null;
  updatedAt: string;
}

export type ServiceInput = Omit<ServiceItem, 'id' | 'orgId' | 'confirmedAt' | 'reviewStatus' | 'rejectionReason' | 'updatedAt'> & { id?: string };

export interface Announcement {
  id: string;
  /** null = a MADAD platform announcement. */
  orgId: string | null;
  title: string;
  body: string;
  startsAt: string;
  endsAt: string | null;
  reviewStatus: ReviewStatus;
  rejectionReason: string | null;
  createdAt: string;
}

export interface AnnouncementInput {
  id?: string;
  title: string;
  body: string;
  startsAt: string;
  endsAt: string | null;
}

/** A provider as the directory card shows it (P-07). */
export interface DirectoryEntry {
  id: string;
  type: ProviderType;
  nameAr: string;
  nameEn: string;
  governorate: GovId;
  area: string;
  description: string | null;
  hours: Hours;
  locations: OrgLocation[];
  /** Names of up to three published services or programmes. */
  topServices: string[];
  categories: ServiceCategory[];
  activePrograms: number;
  /** The latest change to the profile or a published service. */
  updatedAt: string;
}

/** A provider's public page (P-08): approved services and current announcements only. */
export interface ProviderPublic extends Omit<PublicPharmacy, 'lastStockUpdateAt'> {
  type: ProviderType;
  description: string | null;
  website: string | null;
  locations: OrgLocation[];
  services: ServiceItem[];
  announcements: Announcement[];
}

export interface DirectoryRepo {
  providers(filter: { type?: ProviderType; gov?: GovFilter }): Promise<DirectoryEntry[]>;
  /** `preview` lets members see their own organization before approval, pending items included (PR-07). */
  provider(id: string, opts?: { preview?: boolean }): Promise<ProviderPublic | null>;
}

export interface ProviderProfile extends OrgProfile {
  contactPerson: string;
  website: string | null;
  locations: OrgLocation[];
}

export type ProviderProfilePatch = OrgProfilePatch & Partial<Pick<ProviderProfile, 'website' | 'locations' | 'contactPerson'>>;

export interface ProviderPortalRepo {
  services(orgId: string): Promise<ServiceItem[]>;
  /** Creating or editing content sends it to review (AD-08); status changes do not. */
  saveService(orgId: string, input: ServiceInput): Promise<string>;
  deleteService(orgId: string, id: string): Promise<void>;
  /** Sets a programme's status; setting it also counts as a confirmation. */
  setProgramStatus(orgId: string, id: string, status: ProgramStatus): Promise<void>;
  announcements(orgId: string): Promise<Announcement[]>;
  /** `submit` false keeps it a draft; true sends it to review. */
  saveAnnouncement(orgId: string, input: AnnouncementInput, submit: boolean): Promise<string>;
  deleteAnnouncement(orgId: string, id: string): Promise<void>;
  profile(orgId: string): Promise<ProviderProfile>;
  updateProfile(orgId: string, patch: ProviderProfilePatch): Promise<{ reReview: boolean }>;
}

export interface ModerationItem {
  kind: 'service' | 'announcement';
  id: string;
  orgId: string;
  orgNameAr: string;
  orgNameEn: string;
  serviceKind: ServiceKind | null;
  title: string;
  body: string | null;
  status: ReviewStatus;
  submittedAt: string;
}

export interface AdminUser {
  userId: string;
  displayName: string;
  email: string;
  type: 'patient' | 'organization' | 'team';
  platformRole: 'reviewer' | 'super_admin' | null;
  memberships: { orgId: string; orgNameAr: string; orgNameEn: string; role: MemberRole }[];
  suspended: boolean;
  isDemo: boolean;
  joinedAt: string;
}

export interface NotificationPrefs {
  inquiries: boolean;
  verification: boolean;
  catalog: boolean;
  platform: boolean;
  /** Local hour (0–23) for the daily "update your availability" reminder, or null for none. */
  reminderHour: number | null;
}

export const DEFAULT_PREFS: NotificationPrefs = { inquiries: true, verification: true, catalog: true, platform: true, reminderHour: null };
