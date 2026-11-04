import { useTranslation } from 'react-i18next';
import type { Lang } from '../lib/format';

/** Current UI language plus a picker for bilingual fields. */
export function useLang() {
  const { i18n } = useTranslation();
  const lang: Lang = i18n.language === 'en' ? 'en' : 'ar';
  const pick = <T extends { nameAr: string; nameEn: string }>(x: T | null | undefined) =>
    x ? (lang === 'en' ? x.nameEn : x.nameAr) : '';
  return { lang, pick };
}
