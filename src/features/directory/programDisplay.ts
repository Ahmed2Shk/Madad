import type { ServiceItem } from '../../data';
import { programDisplayOf } from '../../lib/programs';

/** What patients see for a programme item (SPEC §9 PR-04). */
export const programDisplay = (s: ServiceItem, now: Date, confirmDays: number) =>
  programDisplayOf(s.programStatus ?? 'info', s.confirmedAt ? new Date(s.confirmedAt) : null, now, confirmDays, s.endsOn);
