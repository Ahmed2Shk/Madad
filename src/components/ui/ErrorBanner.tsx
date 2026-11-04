import { CircleX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';

/** Network error above the content, with retry; cached results (if any) stay visible below. */
export function ErrorBanner({ onRetry, hasCached }: { onRetry: () => void; hasCached?: boolean }) {
  const { t } = useTranslation();
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-bad-bg px-4 py-3 text-bad-text">
      <span className="flex items-center gap-2">
        <CircleX aria-hidden className="size-5 text-bad-icon" />
        {hasCached ? t('errors.networkCached') : t('errors.network')}
      </span>
      <Button variant="danger" size="sm" onClick={onRetry}>
        {t('common.retry')}
      </Button>
    </div>
  );
}
