import { WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOnline } from '../../hooks/useOnline';
import { formatRelative, type Lang } from '../../lib/format';
import { useNow } from '../../hooks/useNow';

/** "أنت غير متصل · آخر مزامنة قبل 2 س". Hidden while online. */
export function OfflineBanner({ lastSync }: { lastSync?: Date }) {
  const online = useOnline();
  const { t, i18n } = useTranslation();
  const now = useNow();
  if (online) return null;
  const lang: Lang = i18n.language === 'en' ? 'en' : 'ar';
  return (
    <div role="status" className="flex items-center justify-center gap-2 bg-warn-bg px-4 py-2 text-meta text-warn-text">
      <WifiOff aria-hidden className="size-4 text-warn-icon" />
      <span>
        {t('offline.banner')}
        {lastSync && <> · {t('offline.lastSync', { time: formatRelative(lastSync, now, lang) })}</>}
      </span>
    </div>
  );
}
