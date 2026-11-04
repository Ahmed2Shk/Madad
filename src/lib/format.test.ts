import { describe, expect, it } from 'vitest';
import {
  formatDateTime,
  formatDistance,
  formatPrice,
  formatRelative,
  intlPhone,
  localeTag,
  telHref,
  whatsappHref,
} from './format';

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

describe('formatDistance', () => {
  it('uses km with one decimal, metres under 1 km', () => {
    expect(formatDistance(1.234, 'ar')).toBe('1.2 كم');
    expect(formatDistance(1.234, 'en')).toBe('1.2 km');
    expect(formatDistance(0.45, 'en')).toBe('450 m');
  });
});

describe('phone links', () => {
  it('converts local numbers to international digits', () => {
    expect(intlPhone('059-000-0000')).toBe('970590000000');
    expect(intlPhone('+970 59 000 0001')).toBe('970590000001');
  });

  it('builds tel: and wa.me links', () => {
    expect(telHref('059-000-0000')).toBe('tel:+970590000000');
    expect(whatsappHref('059-000-0000')).toBe('https://wa.me/970590000000');
  });
});

describe('formatPrice', () => {
  it('shows two decimals and the shekel sign', () => {
    expect(formatPrice(9.5)).toBe('9.50 ₪');
    expect(formatPrice(42)).toBe('42.00 ₪');
  });
});
