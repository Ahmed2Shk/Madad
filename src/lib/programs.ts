// Programs and announcements of service providers (SPEC §9 PR-04, PR-05). The one place their
// displayed state is computed, the way freshness.ts does it for availability.

export type ProgramStatus = 'info' | 'active' | 'paused' | 'ended';
/** What patients see: "active" turns into needs_update when not confirmed in time. */
export type ProgramDisplay = ProgramStatus | 'needs_update';

export const DEFAULT_PROGRAM_CONFIRM_DAYS = 7;
const DAY = 86_400_000;

/**
 * «نشط الآن» needs a confirmation every `confirmDays` days, or it shows «يحتاج تحديث» (same rule as
 * SPEC §3: exactly on the limit still counts). A program past its end date shows as ended.
 */
export function programDisplayOf(
  status: ProgramStatus,
  confirmedAt: Date | null,
  now: Date,
  confirmDays = DEFAULT_PROGRAM_CONFIRM_DAYS,
  endsOn: string | null = null,
): ProgramDisplay {
  if (endsOn && status !== 'ended' && endsOn < now.toISOString().slice(0, 10)) return 'ended';
  if (status !== 'active') return status;
  if (!confirmedAt || now.getTime() - confirmedAt.getTime() > confirmDays * DAY) return 'needs_update';
  return 'active';
}

export type ReviewStatus = 'draft' | 'pending' | 'approved' | 'rejected';
export type AnnouncementState = 'draft' | 'pending' | 'published' | 'scheduled' | 'rejected' | 'expired';

/** PR-05 states: مسودة · بانتظار المراجعة · منشور (or not started yet) · مرفوض · منتهي. */
export function announcementStateOf(review: ReviewStatus, startsAt: Date, endsAt: Date | null, now: Date): AnnouncementState {
  if (endsAt && endsAt.getTime() <= now.getTime()) return 'expired';
  if (review === 'draft') return 'draft';
  if (review === 'pending') return 'pending';
  if (review === 'rejected') return 'rejected';
  return startsAt.getTime() > now.getTime() ? 'scheduled' : 'published';
}

export const ANNOUNCEMENT_MAX = 300;
