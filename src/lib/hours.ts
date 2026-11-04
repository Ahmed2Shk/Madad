// Opening hours: { sat: [["08:00","22:00"]], ... } evaluated in Palestine local time.

export const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export type Day = (typeof DAYS)[number];
export type Hours = Partial<Record<Day, [string, string][]>>;

const TZ = 'Asia/Gaza';

/** Weekday and minutes since midnight in Palestine time. */
export function localDayMinutes(now: Date, timeZone = TZ): { day: Day; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const day = get('weekday').toLowerCase().slice(0, 3) as Day;
  return { day, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** True when `now` falls inside one of today's ranges. A range ending before it starts runs past midnight. */
export function isOpenNow(hours: Hours | null | undefined, now: Date, timeZone = TZ): boolean | null {
  if (!hours || Object.keys(hours).length === 0) return null; // unknown
  const { day, minutes } = localDayMinutes(now, timeZone);
  const prev = DAYS[(DAYS.indexOf(day) + 6) % 7]!;
  const inToday = (hours[day] ?? []).some(([o, c]) => {
    const a = toMin(o);
    const b = toMin(c);
    return b > a ? minutes >= a && minutes < b : minutes >= a;
  });
  const fromYesterday = (hours[prev] ?? []).some(([o, c]) => toMin(c) <= toMin(o) && minutes < toMin(c));
  return inToday || fromYesterday;
}
