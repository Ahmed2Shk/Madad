// P-01 الرئيسية والبحث — phase 0 shell: hero only. Search card and sections arrive in phase 1.
import { useTranslation } from 'react-i18next';

export default function HomePage() {
  const { t } = useTranslation();
  return (
    <section className="rounded-card bg-primary px-6 py-14 text-center text-white lg:py-20">
      <h1 className="text-hero mx-auto max-w-3xl">{t('home.title')}</h1>
      <p className="mx-auto mt-3 max-w-2xl text-mint">{t('home.subtitle')}</p>
    </section>
  );
}
