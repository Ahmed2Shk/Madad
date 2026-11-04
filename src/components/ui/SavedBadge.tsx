import { History } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNow } from '../../hooks/useNow';
import { useOnline } from '../../hooks/useOnline';
import { formatRelative } from '../../lib/format';
import { useLang } from '../../hooks/useLang';

/** "محفوظة قبل …" — shown only offline, when results come from the local cache (SPEC §11). */
export function SavedBadge({ updatedAt }: { updatedAt: number }) {
  const online = useOnline();
  const now = useNow();
  const { t } = useTranslation();
  const { lang } = useLang();
  if (online || !updatedAt) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-unknown-bg px-2.5 py-0.5 text-meta text-unknown-text">
      <History aria-hidden className="size-4 text-unknown-icon" />
      {t('offline.saved', { time: formatRelative(new Date(updatedAt), now, lang) })}
    </span>
  );
}
