import { describe, expect, it } from 'vitest';
import { normalizeArabic, phoneticKey } from './normalizeArabic';

describe('normalizeArabic', () => {
  it('unifies hamza forms so انسولين = إنسولين = أنسولين', () => {
    expect(normalizeArabic('إنسولين')).toBe('انسولين');
    expect(normalizeArabic('أنسولين')).toBe('انسولين');
    expect(normalizeArabic('آنسولين')).toBe('انسولين');
  });

  it('maps taa marbuta, alef maqsura, waw/yaa hamza', () => {
    expect(normalizeArabic('حبة')).toBe('حبه');
    expect(normalizeArabic('مستشفى')).toBe('مستشفي');
    expect(normalizeArabic('مؤسسة')).toBe('موسسه');
    expect(normalizeArabic('بئر')).toBe('بير');
  });

  it('strips diacritics, tatweel and dagger alef', () => {
    expect(normalizeArabic('مَدَد')).toBe('مدد');
    expect(normalizeArabic('دواء ـــ')).toBe('دواء');
    expect(normalizeArabic('رحمٰن')).toBe('رحمن');
  });

  it('converts Eastern digits and splits letters from digits', () => {
    expect(normalizeArabic('باراسيتامول٥٠٠')).toBe('باراسيتامول 500');
    expect(normalizeArabic('باراسيتامول500')).toBe('باراسيتامول 500');
    expect(normalizeArabic('Paracetamol500mg')).toBe('paracetamol 500 mg');
  });

  it('lowercases Latin and collapses spaces', () => {
    expect(normalizeArabic('  INSULIN   Aspart ')).toBe('insulin aspart');
  });
});

describe('phoneticKey', () => {
  it('folds commonly confused letters', () => {
    expect(phoneticKey('سالبوتامول')).toBe(phoneticKey('صالبوتامول'));
    expect(phoneticKey('ضغط')).toBe('دغت');
    expect(phoneticKey('ذ ظ ث')).toBe('ز ز س');
  });
});
