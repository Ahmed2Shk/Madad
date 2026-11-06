import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ar from './ar.json';

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

// Arabic ships with the first page; English loads only when chosen (it is ~14KB gz of the public path).
const loadEnglish = async () => {
  if (!i18n.hasResourceBundle('en', 'translation')) i18n.addResourceBundle('en', 'translation', (await import('./en.json')).default);
};

/** Switch language, loading English first when needed. Use this instead of i18n.changeLanguage. */
export async function setLanguage(lang: Lang) {
  if (lang === 'en') await loadEnglish();
  await i18n.changeLanguage(lang);
}

const initial = storedLang();
void i18n.use(initReactI18next).init({
  resources: { ar: { translation: ar } },
  partialBundledLanguages: true,
  lng: 'ar',
  fallbackLng: 'ar',
  interpolation: { escapeValue: false },
});

applyDocumentLang(initial);

/** Resolves once the stored language is ready; main.tsx renders after it (immediately for Arabic). */
export const i18nReady: Promise<void> = initial === 'en' ? setLanguage('en') : Promise.resolve();

export default i18n;
