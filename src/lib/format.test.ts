import { describe, expect, it } from 'vitest';
import { formatDateTime, formatPrice, formatRelative, localeTag } from './format';

const now = new Date('2026-11-03T12:00:00Z');
const ago = (s: number) => new Date(now.getTime() - s * 1000);
const easternDigits = /[٠-٩]/;

describe('localeTag', () => {
  it('forces Latin digits for Arabic', () => {
    expect(localeTag('ar')).toBe('ar-u-nu-latn');
    expect(localeTag('en')).toBe('en');
  });
});

describe('formatRelative', () => {
  it('reads "now" under 45 seconds', () => {
    expect(formatRelative(ago(10), now, 'en')).toBe('now');
    expect(formatRelative(ago(10), now, 'ar')).toBe('الآن');
  });

  it('uses minutes, hours, then days', () => {
    expect(formatRelative(ago(12 * 60), now, 'en')).toBe('12 minutes ago');
    expect(formatRelative(ago(3 * 3600), now, 'en')).toBe('3 hours ago');
    expect(formatRelative(ago(4 * 86400), now, 'en')).toBe('4 days ago');
  });

  it('writes Arabic with Western digits', () => {
    const s = formatRelative(ago(12 * 60), now, 'ar');
    expect(s).toContain('12');
    expect(s).not.toMatch(easternDigits);
  });
});

describe('formatDateTime', () => {
  it('never uses Eastern Arabic digits', () => {
    expect(formatDateTime(now, 'ar')).not.toMatch(easternDigits);
  });
});

describe('formatPrice', () => {
  it('shows two decimals and the shekel sign', () => {
    expect(formatPrice(9.5)).toBe('9.50 ₪');
    expect(formatPrice(42)).toBe('42.00 ₪');
  });
});
