// PR-07 المعاينة — the organization's public page as patients will see it, pending items included.
import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { buttonClass } from '../../components/ui';
import { usePharmacyCtx } from '../pharmacy-portal/context';

export default function PreviewPage() {
  const { t } = useTranslation();
  const { orgId } = usePharmacyCtx();
  const src = `/org/${orgId}?preview=1`;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-page">{t('portal.provider.nav.preview')}</h1>
        <a href={src} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary')}>
          <ExternalLink aria-hidden className="size-4" />
          {t('provider.openPreview')}
        </a>
      </div>
      <p className="text-meta text-ink-muted">{t('dir.previewBanner')}</p>
      <iframe title={t('portal.provider.nav.preview')} src={src} className="h-[75dvh] w-full rounded-card border border-border" />
    </div>
  );
}
