import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ar from './ar.json';
import en from './en.json';

export const LANGS = ['ar', 'en'] as const;
export type Lang = (typeof LANGS)[number];

const STORAGE_KEY = 'madad.lang';

function storedLang(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'en' ? 'en' : 'ar';
  } catch {
    return 'ar';
  }
}

export function applyDocumentLang(lang: Lang) {
  const el = document.documentElement;
  el.lang = lang;
  el.dir = lang === 'ar' ? 'rtl' : 'ltr';
}

i18n.on('languageChanged', (lng) => {
  const lang: Lang = lng === 'en' ? 'en' : 'ar';
  applyDocumentLang(lang);
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // storage may be blocked; the choice just won't persist
  }
});

void i18n.use(initReactI18next).init({
  resources: { ar: { translation: ar }, en: { translation: en } },
  lng: storedLang(),
  fallbackLng: 'ar',
  interpolation: { escapeValue: false },
});

applyDocumentLang(i18n.language === 'en' ? 'en' : 'ar');

export default i18n;
