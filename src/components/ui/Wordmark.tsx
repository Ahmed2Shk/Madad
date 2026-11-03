import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

/** Temporary text-only logo until an approved one is delivered (SPEC §1). */
export function Wordmark({ to = '/' }: { to?: string }) {
  const { t } = useTranslation();
  return (
    <Link to={to} className="rounded-control text-[26px] leading-none font-semibold text-primary">
      {t('app.name')}
    </Link>
  );
}
