// Shared formatting: relative time, full date, currency. Western digits everywhere (SPEC §5).

export type Lang = 'ar' | 'en';

/** BCP-47 tag that forces Latin digits for Arabic. */
export function localeTag(lang: Lang): string {
  return lang === 'ar' ? 'ar-u-nu-latn' : 'en';
}

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "قبل 12 دقيقة" / "12 minutes ago"; anything under 45 seconds reads "now". */
export function formatRelative(
  date: Date,
  now: Date,
  lang: Lang,
  style: Intl.RelativeTimeFormatStyle = 'long',
): string {
  const rtf = new Intl.RelativeTimeFormat(localeTag(lang), { numeric: 'auto', style });
  const sec = Math.round((date.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(sec);
  if (abs < 45) return rtf.format(0, 'second');
  if (abs < HOUR) return rtf.format(Math.round(sec / MINUTE), 'minute');
  if (abs < DAY) return rtf.format(Math.round(sec / HOUR), 'hour');
  return rtf.format(Math.round(sec / DAY), 'day');
}

/** Full date and time, for the tooltip under a relative time. */
export function formatDateTime(date: Date, lang: Lang): string {
  return new Intl.DateTimeFormat(localeTag(lang), { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

/** "9.50 ₪" in both languages. */
export function formatPrice(ils: number): string {
  return `${ils.toFixed(2)} ₪`;
}
