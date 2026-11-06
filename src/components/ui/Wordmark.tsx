import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

/** The logo: the approved symbol (public/brand/logo-mark.png, from `npm run icons`) and the name. */
export function Wordmark({ to = '/' }: { to?: string }) {
  const { t } = useTranslation();
  return (
    <Link to={to} className="flex items-center gap-2 rounded-control text-[26px] leading-none font-semibold text-primary">
      {/* Decorative: the name next to it is the link's text. Fixed size, so nothing shifts while it loads. */}
      <img src="/brand/logo-mark.png" alt="" width={70} height={36} className="h-9 w-auto" />
      {t('app.name')}
    </Link>
  );
}
