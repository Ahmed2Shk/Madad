// A-01 بوابة المؤسسات واختيار النوع — the only "choose your role" screen, for organizations only.
import { FileCheck2, HandHeart, Hospital, ShieldCheck, Stethoscope, Store, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { buttonClass } from '../../components/ui';
import type { OrgType } from '../../data';

const TYPES: { type: OrgType; Icon: LucideIcon }[] = [
  { type: 'pharmacy', Icon: Store },
  { type: 'hospital', Icon: Hospital },
  { type: 'medical_point', Icon: Stethoscope },
  { type: 'humanitarian', Icon: HandHeart },
];

export default function ForOrganizationsPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-8">
      <header className="max-w-2xl">
        <h1 className="text-page">{t('orgs.title')}</h1>
        <p className="mt-2 text-ink-muted">{t('orgs.lead')}</p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TYPES.map(({ type, Icon }) => (
          <li key={type} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5 shadow-card">
            <span className="flex size-12 items-center justify-center rounded-control bg-mint">
              <Icon aria-hidden className="size-6 text-secondary" />
            </span>
            <h2 className="text-section">{t(`orgTypes.${type}`)}</h2>
            <p className="flex-1 text-meta text-ink-muted">{t(`orgs.desc.${type}`)}</p>
            <Link to={`/register/${type}`} className={buttonClass('primary', 'md', true)}>
              {t('orgs.register')}
            </Link>
            <Link to="/login" className={buttonClass('ghost', 'md', true)}>
              {t('orgs.haveAccount')}
            </Link>
          </li>
        ))}
      </ul>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-card border border-border bg-surface p-5">
          <h2 className="text-section flex items-center gap-2">
            <FileCheck2 aria-hidden className="size-5 text-secondary" />
            {t('orgs.needTitle')}
          </h2>
          <ul className="mt-3 list-disc space-y-1 ps-5 text-ink-muted">
            <li>{t('orgs.need1')}</li>
            <li>{t('orgs.need2')}</li>
            <li>{t('orgs.need3')}</li>
          </ul>
        </div>
        <div className="rounded-card border border-border bg-surface p-5">
          <h2 className="text-section flex items-center gap-2">
            <ShieldCheck aria-hidden className="size-5 text-secondary" />
            {t('orgs.reviewTitle')}
          </h2>
          <p className="mt-3 text-ink-muted">{t('orgs.reviewBody')}</p>
        </div>
      </section>
    </div>
  );
}
