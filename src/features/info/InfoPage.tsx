// P-14 عن مدد، الخصوصية، الشروط — short, plain pages; the prototype status is stated up front.
import { useTranslation } from 'react-i18next';
import { Disclaimer } from '../../components/ui';

type Page = 'about' | 'privacy' | 'terms';

export default function InfoPage({ page }: { page: Page }) {
  const { t } = useTranslation();
  const sections = t(`infoPages.${page}.sections`, { returnObjects: true }) as { title: string; body: string; id?: string }[];
  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-page">{t(`infoPages.${page}.title`)}</h1>
        <p className="mt-2 text-ink-muted">{t(`infoPages.${page}.lead`)}</p>
      </header>
      {sections.map((s) => (
        <section key={s.title} id={s.id} className="space-y-2">
          <h2 className="text-section">{s.title}</h2>
          <p>{s.body}</p>
        </section>
      ))}
      {page !== 'privacy' && <Disclaimer />}
    </article>
  );
}
