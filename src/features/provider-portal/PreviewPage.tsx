// PR-07 المعاينة — the organization's public page as patients will see it, pending items included.
import { ExternalLink } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { CardSkeleton, buttonClass } from '../../components/ui';
import { SignInPromptProvider } from '../account/SignInPrompt';
import { usePharmacyCtx } from '../pharmacy-portal/context';

// The public page itself, in the same app (an iframe ran a second copy that never finished loading when signed in).
const ProviderPage = lazy(() => import('../directory/ProviderPage'));

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
      <div className="rounded-card border border-border bg-canvas p-4">
        <SignInPromptProvider>
          <Suspense fallback={<CardSkeleton />}>
            <ProviderPage previewId={orgId} />
          </Suspense>
        </SignInPromptProvider>
      </div>
    </div>
  );
}
