// A-06 حالة الطلب — one template for: under review · needs more information · rejected (and approved).
import { CircleCheck, CircleX, FilePlus2, Hourglass, MessageSquareWarning } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  Button,
  CardSkeleton,
  Field,
  FileUpload,
  Freshness,
  StatusBadge,
  buttonClass,
  inputClass,
  useToast,
} from '../../components/ui';
import type { DocumentMeta } from '../../data';
import { useMe, useRegistrationStatus, useResubmit } from '../../data/portalQueries';
import { useLang } from '../../hooks/useLang';

export default function StatusPage() {
  const { t } = useTranslation();
  const { pick } = useLang();
  const toast = useToast();
  const me = useMe();
  const status = useRegistrationStatus();
  const resubmit = useResubmit();
  const [note, setNote] = useState('');
  const [extra, setExtra] = useState<DocumentMeta | null>(null);

  if (me.isPending || status.isPending) return <CardSkeleton />;
  if (!me.data) return <Navigate to="/login" state={{ from: '/register/status' }} replace />;
  if (!status.data) return <Navigate to="/for-organizations" replace />;

  const s = status.data;
  const portal = s.orgType === 'pharmacy' ? '/pharmacy-portal' : '/provider';
  const view = s.status === 'approved' ? 'approved' : s.status === 'needs_info' ? 'needs_info' : s.status === 'rejected' ? 'rejected' : 'pending';
  const Icon = { pending: Hourglass, needs_info: MessageSquareWarning, rejected: CircleX, approved: CircleCheck }[view];
  const tone = { pending: 'bg-review-bg text-review-icon', needs_info: 'bg-warn-bg text-warn-icon', rejected: 'bg-bad-bg text-bad-icon', approved: 'bg-ok-bg text-ok-icon' }[view];

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <section className="space-y-4 rounded-card border border-border bg-surface p-6 shadow-card">
        <span className={`flex size-14 items-center justify-center rounded-full ${tone}`}>
          <Icon aria-hidden className="size-7" />
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-page">{t(`status_page.${view}.title`)}</h1>
          {view === 'pending' && <StatusBadge status="pending_review" />}
        </div>
        <p className="font-medium">
          {pick(s)} · {t(`orgTypes.${s.orgType}`)}
        </p>
        <p className="text-ink-muted">{t(`status_page.${view}.body`)}</p>

        {view === 'pending' && (
          <ul className="list-disc space-y-1 ps-5 text-meta text-ink-muted">
            <li>{t('status_page.pending.now')}</li>
            <li>{t('status_page.pending.prepare')}</li>
          </ul>
        )}

        {(view === 'needs_info' || view === 'rejected') && s.reviewerNote && (
          <blockquote className="rounded-card border-s-4 border-warn-icon bg-warn-bg p-4 text-warn-text">
            <p className="text-meta font-semibold">{t('status_page.reviewerNote')}</p>
            <p className="mt-1">{s.reviewerNote}</p>
          </blockquote>
        )}

        {view === 'needs_info' && (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              await resubmit.mutateAsync({ orgId: s.orgId, note, documents: extra ? [extra] : [] });
              toast(t('status_page.resubmitted'));
            }}
          >
            <Field label={t('status_page.yourNote')} optional>
              <textarea rows={3} maxLength={500} className={`${inputClass} py-2`} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <FileUpload label={t('status_page.extraDoc')} docType="additional" value={extra} onChange={setExtra} />
            <Button type="submit" loading={resubmit.isPending}>
              <FilePlus2 aria-hidden className="size-4" />
              {t('status_page.resubmit')}
            </Button>
          </form>
        )}

        <div className="flex flex-wrap gap-3 pt-2">
          {view !== 'rejected' && (
            <Link to={portal} className={buttonClass(view === 'approved' ? 'primary' : 'secondary')}>
              {view === 'approved' ? t('status_page.openPortal') : t('status_page.prepareNow')}
            </Link>
          )}
          {view === 'rejected' && (
            <Link to="/about#contact" className={buttonClass('primary')}>
              {t('info.contact')}
            </Link>
          )}
        </div>
      </section>

      <section className="rounded-card border border-border bg-surface p-5">
        <h2 className="text-section mb-3">{t('status_page.history')}</h2>
        <ol className="space-y-3">
          {[...s.events].reverse().map((e, i) => (
            <li key={i} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-2 last:border-0">
              <span>
                {t(`status_page.events.${e.action}`)}
                {e.note && <span className="ms-2 text-meta text-ink-muted">— {e.note}</span>}
              </span>
              <Freshness at={e.createdAt} bare />
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
