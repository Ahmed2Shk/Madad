// AD-08 مراجعة المحتوى — new or edited services, programmes and announcements: approve, or reject with
// a reason the organization sees. Nothing a provider publishes reaches patients before this.
import { CircleCheck, CircleX, ListChecks, Megaphone, Stethoscope } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, CardSkeleton, Dialog, EmptyState, ErrorBanner, Field, Freshness, inputClass, useToast } from '../../components/ui';
import type { ModerationItem } from '../../data';
import { usePlatformSettings } from '../../data/adminQueries';
import { useModerate, useModerationQueue } from '../../data/providerQueries';
import { useLang } from '../../hooks/useLang';

export default function ModerationPage() {
  const { t } = useTranslation();
  const { pick } = useLang();
  const toast = useToast();
  const queue = useModerationQueue();
  const moderate = useModerate();
  const settings = usePlatformSettings();
  const [rejecting, setRejecting] = useState<ModerationItem | null>(null);
  const [reason, setReason] = useState('');

  const decide = async (item: ModerationItem, decision: 'approve' | 'reject', why = '') => {
    await moderate.mutateAsync({ kind: item.kind, id: item.id, decision, reason: why });
    toast(t(decision === 'approve' ? 'moderation.approved' : 'moderation.rejected'));
  };

  if (queue.isPending) return <CardSkeleton />;
  if (queue.isError) return <ErrorBanner onRetry={() => void queue.refetch()} />;
  const items = queue.data ?? [];

  return (
    <div className="space-y-5">
      <h1 className="text-page">{t('portal.admin.nav.moderation')}</h1>
      <p className="text-ink-muted">{t('moderation.lead')}</p>
      {items.length === 0 ? (
        <EmptyState icon={ListChecks} title={t('moderation.emptyTitle')} body={t('moderation.emptyBody')} />
      ) : (
        <ul className="rise-children space-y-3">
          {items.map((item) => {
            const Icon = item.kind === 'announcement' ? Megaphone : Stethoscope;
            return (
              <li key={`${item.kind}-${item.id}`} className="space-y-3 rounded-card border border-border bg-surface p-4 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <Icon aria-hidden className="size-5 text-secondary" />
                      <span className="font-semibold">{item.title}</span>
                      <span className="rounded-full bg-canvas px-2 py-0.5 text-micro text-ink-muted">
                        {item.kind === 'announcement' ? t('moderation.announcement') : t(`serviceKind.${item.serviceKind ?? 'service'}`)}
                      </span>
                    </p>
                    <p className="text-meta text-ink-muted">
                      {pick({ nameAr: item.orgNameAr, nameEn: item.orgNameEn || item.orgNameAr })} · <Freshness at={item.submittedAt} bare />
                    </p>
                    {item.body && <p className="text-meta">{item.body}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" loading={moderate.isPending && moderate.variables?.id === item.id && moderate.variables.decision === 'approve'} onClick={() => void decide(item, 'approve')}>
                      <CircleCheck aria-hidden className="size-4" />
                      {t('moderation.approve')}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setReason('');
                        setRejecting(item);
                      }}
                    >
                      <CircleX aria-hidden className="size-4 text-bad-icon" />
                      {t('moderation.reject')}
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title={t('moderation.rejectTitle', { title: rejecting?.title ?? '' })}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejecting(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              disabled={!reason.trim()}
              loading={moderate.isPending}
              onClick={async () => {
                await decide(rejecting!, 'reject', reason);
                setRejecting(null);
              }}
            >
              {t('moderation.reject')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {(settings.data?.rejectionReasons.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-2">
              {settings.data!.rejectionReasons.map((r) => (
                <button key={r} type="button" onClick={() => setReason(r)} className="min-h-10 rounded-full border border-border px-3 text-meta hover:bg-canvas">
                  {r}
                </button>
              ))}
            </div>
          )}
          <Field label={t('moderation.reason')} hint={t('moderation.reasonHint')}>
            <textarea rows={3} maxLength={300} className={`${inputClass} py-2`} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </div>
      </Dialog>
    </div>
  );
}
