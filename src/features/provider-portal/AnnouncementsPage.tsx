// PR-05 الإعلانات — title, 300-character text, start and end. Every announcement passes AD-08 review
// before patients see it. States: مسودة · بانتظار المراجعة · منشور · مرفوض (with the reason) · منتهي.
import { Megaphone, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, CardSkeleton, ConfirmDialog, Dialog, EmptyState, ErrorBanner, Field, Freshness, inputClass, useToast } from '../../components/ui';
import type { Announcement, AnnouncementInput } from '../../data';
import { useDeleteAnnouncement, useProviderAnnouncements, useSaveAnnouncement } from '../../data/providerQueries';
import { useNow } from '../../hooks/useNow';
import { cn } from '../../lib/cn';
import { ANNOUNCEMENT_MAX, announcementStateOf, type AnnouncementState } from '../../lib/programs';
import { usePharmacyCtx } from '../pharmacy-portal/context';

const stateTone: Record<AnnouncementState, string> = {
  draft: 'bg-canvas text-ink-muted',
  pending: 'bg-review-bg text-review-text',
  scheduled: 'bg-review-bg text-review-text',
  published: 'bg-ok-bg text-ok-text',
  rejected: 'bg-bad-bg text-bad-text',
  expired: 'bg-unknown-bg text-unknown-text',
};

/** <input type="datetime-local"> works in local time; the data layer keeps ISO strings. */
const toLocal = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);

function Editor({ orgId, initial, onClose }: { orgId: string; initial: AnnouncementInput; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const save = useSaveAnnouncement(orgId);
  const [v, setV] = useState(initial);
  const [error, setError] = useState(false);
  const valid = v.title.trim() && v.body.trim() && v.body.length <= ANNOUNCEMENT_MAX && (!v.endsAt || v.endsAt > v.startsAt);

  const submit = async (send: boolean) => {
    if (!valid) return setError(true);
    await save.mutateAsync({ input: v, submit: send });
    toast(t(send ? 'provider.sentToReview' : 'provider.draftSaved'));
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={v.id ? t('provider.editAnnouncement') : t('provider.newAnnouncement')}
      footer={
        <>
          <Button variant="ghost" onClick={() => void submit(false)} loading={save.isPending && save.variables?.submit === false}>
            {t('provider.saveDraft')}
          </Button>
          <Button onClick={() => void submit(true)} loading={save.isPending && save.variables?.submit === true}>
            <Send aria-hidden className="size-4" />
            {t('provider.submitReview')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={t('provider.title')} error={error && !v.title.trim() ? 'required' : undefined}>
          <input className={inputClass} maxLength={120} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
        </Field>
        <Field label={t('provider.body')} hint={`${v.body.length}/${ANNOUNCEMENT_MAX}`} error={error && (!v.body.trim() || v.body.length > ANNOUNCEMENT_MAX) ? 'required' : undefined}>
          <textarea rows={4} maxLength={ANNOUNCEMENT_MAX} className={`${inputClass} py-2`} value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('provider.startsAt')}>
            <input type="datetime-local" className={inputClass} value={toLocal(v.startsAt)} onChange={(e) => setV({ ...v, startsAt: fromLocal(e.target.value) ?? v.startsAt })} />
          </Field>
          <Field label={t('provider.endsAt')} optional error={error && v.endsAt && v.endsAt <= v.startsAt ? 'endBeforeStart' : undefined}>
            <input type="datetime-local" className={inputClass} value={toLocal(v.endsAt)} onChange={(e) => setV({ ...v, endsAt: fromLocal(e.target.value) })} />
          </Field>
        </div>
        <p className="text-meta text-ink-muted">{t('provider.announcementRules')}</p>
      </div>
    </Dialog>
  );
}

export default function AnnouncementsPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const now = useNow();
  const { orgId, can } = usePharmacyCtx();
  const list = useProviderAnnouncements(orgId);
  const remove = useDeleteAnnouncement(orgId);
  const [editing, setEditing] = useState<AnnouncementInput | null>(null);
  const [deleting, setDeleting] = useState<Announcement | null>(null);
  const canEdit = can('publish');

  if (list.isPending) return <CardSkeleton />;
  if (list.isError) return <ErrorBanner onRetry={() => void list.refetch()} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-page">{t('portal.provider.nav.announcements')}</h1>
        {canEdit && (
          <Button onClick={() => setEditing({ title: '', body: '', startsAt: new Date().toISOString(), endsAt: null })}>
            <Plus aria-hidden className="size-4" />
            {t('provider.newAnnouncement')}
          </Button>
        )}
      </div>
      {!canEdit && <p className="rounded-card bg-canvas p-3 text-meta text-ink-muted">{t('provider.noPublishPerm')}</p>}

      {(list.data ?? []).length === 0 ? (
        <EmptyState icon={Megaphone} title={t('provider.empty.announcements')} body={t('provider.emptyAnnouncementsBody')} />
      ) : (
        <ul className="rise-children space-y-3">
          {list.data!.map((a) => {
            const state = announcementStateOf(a.reviewStatus, new Date(a.startsAt), a.endsAt ? new Date(a.endsAt) : null, now);
            return (
              <li key={a.id} className="space-y-2 rounded-card border border-border bg-surface p-4 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{a.title}</span>
                      <span className={cn('rounded-full px-2 py-0.5 text-micro font-medium', stateTone[state])}>{t(`announcement.state.${state}`)}</span>
                    </p>
                    <p className="text-meta">{a.body}</p>
                    <p className="text-micro text-ink-muted">
                      {t('provider.startsAt')} <Freshness at={a.startsAt} bare />
                      {a.endsAt && (
                        <>
                          {' · '}
                          {t('provider.endsAt')} <bdi dir="ltr">{a.endsAt.slice(0, 10)}</bdi>
                        </>
                      )}
                    </p>
                    {state === 'rejected' && a.rejectionReason && (
                      <p className="rounded-control bg-bad-bg p-2 text-meta text-bad-text">{t('provider.rejectedBecause', { reason: a.rejectionReason })}</p>
                    )}
                  </div>
                  {canEdit && state !== 'expired' && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setEditing({ id: a.id, title: a.title, body: a.body, startsAt: a.startsAt, endsAt: a.endsAt })}>
                        <Pencil aria-hidden className="size-4" />
                        {t('provider.edit')}
                      </Button>
                      <Button size="sm" variant="ghost" aria-label={t('provider.delete')} onClick={() => setDeleting(a)}>
                        <Trash2 aria-hidden className="size-4 text-bad-icon" />
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing && <Editor orgId={orgId} initial={editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        title={t('provider.deleteTitle')}
        body={t('provider.deleteBody', { name: deleting?.title ?? '' })}
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
