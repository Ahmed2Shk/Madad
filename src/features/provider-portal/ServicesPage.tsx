// PR-03 الخدمات والأقسام and PR-04 البرامج والمساعدات وشروط الأهلية. One list screen: what is
// published, waiting for review or rejected (with the reason), and for programmes the status
// patients see, which turns «يحتاج تحديث» when «نشط الآن» is not confirmed in time.
import { CircleX, HandHeart, Pencil, Plus, RefreshCw, Stethoscope, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, CardSkeleton, ConfirmDialog, EmptyState, ErrorBanner, Freshness, useToast } from '../../components/ui';
import type { ServiceInput, ServiceItem, ServiceKind } from '../../data';
import { useDeleteService, useProviderServices, useSetProgramStatus } from '../../data/providerQueries';
import { useSettings } from '../../data/queries';
import { useNow } from '../../hooks/useNow';
import { DEFAULT_PROGRAM_CONFIRM_DAYS } from '../../lib/programs';
import { DepartmentBadge, PendingTag, ProgramBadge } from '../directory/ServiceViews';
import { programDisplay } from '../directory/programDisplay';
import { usePharmacyCtx } from '../pharmacy-portal/context';
import { ServiceEditor } from './ServiceEditor';
import { emptyService, toInput } from './serviceInput';

function ReviewState({ item }: { item: ServiceItem }) {
  const { t } = useTranslation();
  if (item.reviewStatus === 'pending') return <PendingTag />;
  if (item.reviewStatus === 'rejected')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-bad-bg px-2 py-0.5 text-micro font-medium text-bad-text">
        <CircleX aria-hidden className="size-3.5 text-bad-icon" />
        {t('provider.rejected')}
      </span>
    );
  return <span className="text-micro text-ok-text">{t('provider.published')}</span>;
}

export default function ServicesPage({ mode }: { mode: 'services' | 'programs' }) {
  const { t } = useTranslation();
  const toast = useToast();
  const now = useNow();
  const { orgId, can, membership } = usePharmacyCtx();
  const confirmDays = useSettings().data?.programConfirmDays ?? DEFAULT_PROGRAM_CONFIRM_DAYS;
  const services = useProviderServices(orgId);
  const remove = useDeleteService(orgId);
  const setStatus = useSetProgramStatus(orgId);
  const [editing, setEditing] = useState<ServiceInput | null>(null);
  const [deleting, setDeleting] = useState<ServiceItem | null>(null);

  // Departments are for hospitals only (SPEC §9 table).
  const kinds: ServiceKind[] = mode === 'programs' ? ['program'] : membership.orgType === 'hospital' ? ['department', 'service'] : ['service'];
  const items = (services.data ?? []).filter((s) => kinds.includes(s.kind));
  const canEdit = can('publish');
  const Icon = mode === 'programs' ? HandHeart : Stethoscope;

  if (services.isPending) return <CardSkeleton />;
  if (services.isError) return <ErrorBanner onRetry={() => void services.refetch()} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-page">{t(`portal.provider.nav.${mode}`)}</h1>
        {canEdit && (
          <Button onClick={() => setEditing(emptyService(kinds[kinds.length - 1]!))}>
            <Plus aria-hidden className="size-4" />
            {t(mode === 'programs' ? 'provider.add.program' : 'provider.addService')}
          </Button>
        )}
      </div>
      {!canEdit && <p className="rounded-card bg-canvas p-3 text-meta text-ink-muted">{t('provider.noPublishPerm')}</p>}
      <p className="text-meta text-ink-muted">{t('dir.serviceNote')}</p>

      {items.length === 0 ? (
        <EmptyState icon={Icon} title={t(`provider.empty.${mode}`)} body={t('provider.emptyBody')} />
      ) : (
        <ul className="rise-children space-y-3">
          {items.map((s) => {
            const display = s.kind === 'program' ? programDisplay(s, now, confirmDays) : null;
            return (
              <li key={s.id} className="space-y-3 rounded-card border border-border bg-surface p-4 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{s.name}</span>
                      <span className="text-micro text-ink-muted">{t(`serviceKind.${s.kind}`)}</span>
                      {display && <ProgramBadge display={display} />}
                      {s.kind === 'department' && <DepartmentBadge operating={s.operating} />}
                      <ReviewState item={s} />
                    </p>
                    {s.description && <p className="text-meta text-ink-muted">{s.description}</p>}
                    <p className="text-micro text-ink-muted">
                      {s.kind === 'program' && s.confirmedAt ? (
                        <>
                          {t('dir.lastConfirmed')} <Freshness at={s.confirmedAt} />
                        </>
                      ) : (
                        <>
                          {t('dir.updated')} <Freshness at={s.updatedAt} />
                        </>
                      )}
                    </p>
                    {s.reviewStatus === 'rejected' && s.rejectionReason && (
                      <p className="rounded-control bg-bad-bg p-2 text-meta text-bad-text">{t('provider.rejectedBecause', { reason: s.rejectionReason })}</p>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex flex-wrap gap-2">
                      {s.kind === 'program' && (
                        <Button
                          size="sm"
                          variant={display === 'needs_update' ? 'primary' : 'secondary'}
                          loading={setStatus.isPending && setStatus.variables?.id === s.id}
                          onClick={async () => {
                            await setStatus.mutateAsync({ id: s.id, status: s.programStatus ?? 'info' });
                            toast(t('provider.confirmed'));
                          }}
                        >
                          <RefreshCw aria-hidden className="size-4" />
                          {t('provider.confirmStatus')}
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setEditing(toInput(s))}>
                        <Pencil aria-hidden className="size-4" />
                        {t('provider.edit')}
                      </Button>
                      <Button size="sm" variant="ghost" aria-label={t('provider.delete')} onClick={() => setDeleting(s)}>
                        <Trash2 aria-hidden className="size-4 text-bad-icon" />
                      </Button>
                    </div>
                  )}
                </div>
                {s.kind === 'program' && canEdit && (
                  <div className="flex flex-wrap items-center gap-2 text-meta">
                    <span className="text-ink-muted">{t('provider.changeStatus')}</span>
                    {(['active', 'paused', 'ended', 'info'] as const)
                      .filter((x) => x !== s.programStatus)
                      .map((x) => (
                        <button
                          key={x}
                          type="button"
                          onClick={async () => {
                            await setStatus.mutateAsync({ id: s.id, status: x });
                            toast(t('provider.statusChanged'));
                          }}
                          className="min-h-10 rounded-full border border-border px-3 hover:bg-canvas"
                        >
                          {t(`program.status.${x}`)}
                        </button>
                      ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {editing && <ServiceEditor orgId={orgId} initial={editing} kinds={kinds} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        title={t('provider.deleteTitle')}
        body={t('provider.deleteBody', { name: deleting?.name ?? '' })}
        confirmLabel={t('provider.delete')}
        loading={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          await remove.mutateAsync(deleting!.id);
          setDeleting(null);
          toast(t('provider.deleted'));
        }}
      />
    </div>
  );
}
