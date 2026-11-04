import { useTranslation } from 'react-i18next';
import type { Lang } from '../lib/format';

/** Current UI language plus a picker for bilingual fields. */
export function useLang() {
  const { i18n } = useTranslation();
  const lang: Lang = i18n.language === 'en' ? 'en' : 'ar';
  const pick = <T extends { nameAr: string; nameEn: string }>(x: T | null | undefined) =>
    x ? (lang === 'en' ? x.nameEn : x.nameAr) : '';
  /** Strength and pack in the UI language, falling back to the Arabic catalog value. */
  const strength = (m: { strength: string; strengthEn?: string | null } | null | undefined) =>
    m ? (lang === 'en' && m.strengthEn ? m.strengthEn : m.strength) : '';
  const pack = (m: { packSize: string; packSizeEn: string | null } | null | undefined) =>
    m ? (lang === 'en' && m.packSizeEn ? m.packSizeEn : m.packSize) : '';
  return { lang, pick, strength, pack };
}
