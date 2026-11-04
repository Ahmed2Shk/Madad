// Arabic search normalization — SPEC §12. Mirrored by the Postgres search_text pipeline.

const DIACRITICS = /[ً-ٰٟۖ-ۭ]/g; // tashkeel + dagger alef (ٰ) + Quranic marks
const TATWEEL = /ـ/g;
const EASTERN_DIGITS = /[٠-٩۰-۹]/g;

const LETTER_MAP: Record<string, string> = {
  أ: 'ا',
  إ: 'ا',
  آ: 'ا',
  ٱ: 'ا',
  ة: 'ه',
  ى: 'ي',
  ؤ: 'و',
  ئ: 'ي',
};

/**
 * Normalizes for matching: strips diacritics and tatweel, unifies alef/taa marbuta/yaa forms,
 * converts Eastern digits to Western, lowercases Latin, and splits letters from digits
 * ("باراسيتامول500" → "باراسيتامول 500").
 */
export function normalizeArabic(input: string): string {
  return input
    .replace(DIACRITICS, '')
    .replace(TATWEEL, '')
    .replace(/[أإآٱةىؤئ]/g, (c) => LETTER_MAP[c] ?? c)
    .replace(EASTERN_DIGITS, (d) => String((d.charCodeAt(0) & 0xf) % 10))
    .toLowerCase()
    .replace(/(\p{L})(\d)/gu, '$1 $2')
    .replace(/(\d)(\p{L})/gu, '$1 $2')
    .replace(/[^\p{L}\p{N}\s.%/]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const PHONETIC_MAP: Record<string, string> = { ص: 'س', ث: 'س', ط: 'ت', ض: 'د', ذ: 'ز', ظ: 'ز' };

/** Fallback key used only when the normal search finds nothing, so names don't blur together. */
export function phoneticKey(input: string): string {
  return normalizeArabic(input).replace(/[صثطضذظ]/g, (c) => PHONETIC_MAP[c] ?? c);
}
