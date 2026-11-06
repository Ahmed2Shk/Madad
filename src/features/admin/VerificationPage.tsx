// AD-02 طلبات التوثيق — approve · ask for more (note required) · reject (reason required).
import { CircleCheck, CircleX, ExternalLink, Eye, FileText, MapPin, MessageSquareWarning, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  buttonClass,
  Skeleton,
  Button,
  CardSkeleton,
  Dialog,
  EmptyState,
  ErrorBanner,
  FieldError,
  FilterChips,
  Freshness,
  LazyMap,
  StatusBadge,
  inputClass,
  useToast,
} from '../../components/ui';
import { governorateById, type DocumentStatus, type VerificationItem, type VerificationStatus } from '../../data';
import { useDocumentUrl, usePlatformSettings, useReviewOrg, useSetDocumentStatus, useVerificationQueue } from '../../data/adminQueries';
import { useLang } from '../../hooks/useLang';
import { useDataSaver } from '../../hooks/usePreferences';
import { cn } from '../../lib/cn';

type Filter = 'open' | 'approved' | 'rejected';
const docTone: Record<DocumentStatus, string> = {
  pending: 'bg-review-bg text-review-text',
  accepted: 'bg-ok-bg text-ok-text',
  rejected: 'bg-bad-bg text-bad-text',
};

export function VerificationStatusPill({ status }: { status: VerificationStatus }) {
  const { t } = useTranslation();
  if (status === 'pending') return <StatusBadge status="pending_review" />;
  const tone = { needs_info: 'bg-warn-bg text-warn-text', approved: 'bg-ok-bg text-ok-text', rejected: 'bg-bad-bg text-bad-text', suspended: 'bg-unknown-bg text-unknown-text', draft: 'bg-unknown-bg text-unknown-text', pending: '' }[status];
  return <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-meta font-medium', tone)}>{t(`admin.vstatus.${status}`)}</span>;
}

export default function VerificationPage() {
  const { t } = useTranslation();
  const { pick } = useLang();
  const queue = useVerificationQueue();
  const [filter, setFilter] = useState<Filter>('open');
  const [selected, setSelected] = useState<string | null>(null);

  if (queue.isPending) return <CardSkeleton />;
  if (queue.isError) return <ErrorBanner onRetry={() => void queue.refetch()} />;
  const items = (queue.data ?? []).filter((v) =>
    filter === 'open' ? v.status === 'pending' || v.status === 'needs_info' : filter === 'approved' ? v.status === 'approved' : v.status === 'rejected',
  );
  const current = items.find((v) => v.orgId === selected) ?? items[0];

  return (
    <div className="space-y-4">
      <h1 className="text-page">{t('portal.admin.nav.verification')}</h1>
      <FilterChips
        label={t('filters.label')}
        onToggle={(id) => {
          setFilter(id as Filter);
          setSelected(null);
        }}
        chips={(['open', 'approved', 'rejected'] as const).map((id) => ({ id, label: t(`admin.vfilter.${id}`), on: filter === id }))}
      />
      {items.length === 0 ? (
        <EmptyState icon={ShieldCheck} title={t('admin.queueEmpty')} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
          <ul aria-label={t('portal.admin.nav.verification')} className="divide-y divide-border self-start rounded-card border border-border bg-surface">
            {items.map((v) => (
              <li key={v.orgId}>
                <button
                  type="button"
                  aria-current={current?.orgId === v.orgId ? 'true' : undefined}
                  onClick={() => setSelected(v.orgId)}
                  className={cn('block w-full p-4 text-start hover:bg-canvas', current?.orgId === v.orgId && 'bg-mint')}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{pick(v)}</span>
                    <VerificationStatusPill status={v.status} />
                  </span>
                  <span className="mt-1 block text-meta text-ink-muted">
                    {t(`orgTypes.${v.type}`)} · {pick(governorateById(v.governorate))}
                  </span>
                  <span className="mt-1 flex items-center justify-between text-micro text-ink-muted">
                    <Freshness at={v.submittedAt} bare className="text-micro" />
                    {v.warnings.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-warn-text">
                        <TriangleAlert aria-hidden className="size-3.5" />
                        {t('admin.hasWarnings')}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {current && <Detail key={current.orgId} v={current} />}
        </div>
      )}
    </div>
  );
}

function Detail({ v }: { v: VerificationItem }) {
  const { t } = useTranslation();
  const { pick } = useLang();
  const toast = useToast();
  const review = useReviewOrg();
  const setDoc = useSetDocumentStatus();
  const settings = usePlatformSettings();
  const [note, setNote] = useState(v.reviewerNote ?? '');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<VerificationItem['documents'][number] | null>(null);
  const [showMap, setShowMap] = useState(false);
  const gov = governorateById(v.governorate);
  const open = v.status === 'pending' || v.status === 'needs_info';

  const decide = async (decision: 'approve' | 'needs_info' | 'reject') => {
    setError(null);
    if (decision === 'needs_info' && !note.trim()) return setError(t('admin.noteRequired'));
    if (decision === 'reject' && !reason) return setError(t('admin.reasonRequired'));
    const text = decision === 'reject' ? [reason, note.trim()].filter(Boolean).join(' — ') : note;
    await review.mutateAsync({ orgId: v.orgId, decision, note: text });
    toast(t(`admin.decided.${decision}`, { name: pick(v) }));
  };

  const rows: [string, string | null][] = [
    [t('register.contactName'), v.contactPerson],
    [t('register.licenseNo'), v.licenseNo],
    [t('gov.label'), `${pick(gov)} · ${pick(gov?.areas.find((a) => a.id === v.area))}`],
    [t('register.address'), v.addressText],
    [t('register.landmark'), v.landmark],
    [t('register.orgPhone'), v.phone],
    [t('actions.whatsapp'), v.whatsapp],
  ];

  return (
    <section aria-label={pick(v)} className="space-y-4 rounded-card border border-border bg-surface p-5 shadow-card">
      <header className="flex flex-wrap items-center gap-3">
        <h2 className="text-page">{pick(v)}</h2>
        <VerificationStatusPill status={v.status} />
        <span className="text-meta text-ink-muted">{t(`orgTypes.${v.type}`)}</span>
      </header>

      {v.warnings.map((w) => (
        <p key={`${w.field}-${w.otherOrgId}`} className="flex items-center gap-2 rounded-card bg-warn-bg p-3 text-meta text-warn-text">
          <TriangleAlert aria-hidden className="size-4 shrink-0 text-warn-icon" />
          {t(`admin.warning.${w.field}`, { name: pick({ nameAr: w.otherNameAr, nameEn: w.otherNameEn }) })}
        </p>
      ))}

      <dl className="grid gap-x-6 gap-y-2 text-meta sm:grid-cols-2">
        {rows.map(([k, val]) => (
          <div key={k} className="flex justify-between gap-3 border-b border-border py-1.5">
            <dt className="text-ink-muted">{k}</dt>
            <dd className="text-end">{val ? <bdi>{val}</bdi> : '—'}</dd>
          </div>
        ))}
      </dl>

      {v.exactLat != null && v.exactLng != null && (
        <div>
          {showMap ? (
            <LazyMap markers={[{ id: v.orgId, lat: v.exactLat, lng: v.exactLng, label: pick(v) }]} zoom={15} className="h-48 w-full rounded-card border border-border" label={t('register.mapLabel')} />
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setShowMap(true)}>
              <MapPin aria-hidden className="size-4" />
              {t('map.show')}
            </Button>
          )}
        </div>
      )}

      <section aria-labelledby="docs-title">
        <h3 id="docs-title" className="mb-2 font-semibold">
          {t('admin.documents')}
        </h3>
        {v.documents.length === 0 ? (
          <p className="text-meta text-ink-muted">{t('admin.noDocuments')}</p>
        ) : (
          <ul className="rise-children divide-y divide-border rounded-card border border-border">
            {v.documents.map((d) => (
              <li key={d.fileName} className="flex flex-wrap items-center gap-3 p-3">
                <FileText aria-hidden className="size-5 text-secondary" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{t(`docTypes.${d.docType}`)}</span>
                  <span className="block truncate text-micro text-ink-muted" dir="ltr">
                    {d.fileName}
                  </span>
                </span>
                <span className={cn('rounded-full px-2 py-0.5 text-micro font-medium', docTone[d.status])}>{t(`admin.docStatus.${d.status}`)}</span>
                <Button variant="ghost" size="sm" onClick={() => setViewing(d)}>
                  <Eye aria-hidden className="size-4" />
                  {t('admin.view')}
                </Button>
                {open && (
                  <>
                    <Button variant="ghost" size="sm" aria-label={t('admin.acceptDoc')} onClick={() => void setDoc.mutateAsync({ orgId: v.orgId, fileName: d.fileName, status: 'accepted' })}>
                      <CircleCheck aria-hidden className="size-4 text-ok-icon" />
                    </Button>
                    <Button variant="ghost" size="sm" aria-label={t('admin.rejectDoc')} onClick={() => void setDoc.mutateAsync({ orgId: v.orgId, fileName: d.fileName, status: 'rejected' })}>
                      <CircleX aria-hidden className="size-4 text-bad-icon" />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="hist-title">
        <h3 id="hist-title" className="mb-2 font-semibold">
          {t('status_page.history')}
        </h3>
        <ol className="rise-children space-y-2 text-meta">
          {[...v.events].reverse().map((e, i) => (
            <li key={i} className="flex flex-wrap justify-between gap-2 border-b border-border pb-1.5">
              <span>
                {t(`status_page.events.${e.action}`)}
                {e.note && <span className="ms-2 text-ink-muted">— {e.note}</span>}
              </span>
              <Freshness at={e.createdAt} bare />
            </li>
          ))}
        </ol>
      </section>

      {open && (
        <section className="space-y-3 border-t border-border pt-4">
          <label className="block">
            <span className="font-medium">{t('admin.noteToOrg')}</span>
            <textarea rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className={`${inputClass} mt-1 py-2`} />
          </label>
          <label className="block">
            <span className="font-medium">{t('admin.rejectReason')}</span>
            <select value={reason} onChange={(e) => setReason(e.target.value)} className={`${inputClass} mt-1`}>
              <option value="">{t('admin.pickReason')}</option>
              {settings.data?.rejectionReasons.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          {error && <FieldError>{error}</FieldError>}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void decide('approve')} loading={review.isPending && review.variables?.decision === 'approve'}>
              <CircleCheck aria-hidden className="size-4" />
              {t('admin.approve')}
            </Button>
            <Button variant="secondary" onClick={() => void decide('needs_info')} loading={review.isPending && review.variables?.decision === 'needs_info'}>
              <MessageSquareWarning aria-hidden className="size-4" />
              {t('admin.needsInfo')}
            </Button>
            <Button variant="danger" onClick={() => void decide('reject')} loading={review.isPending && review.variables?.decision === 'reject'}>
              <CircleX aria-hidden className="size-4" />
              {t('admin.reject')}
            </Button>
          </div>
        </section>
      )}

      <Dialog open={!!viewing} onClose={() => setViewing(null)} title={viewing ? t(`docTypes.${viewing.docType}`) : ''}>
        {viewing && (
          <div className="space-y-2">
            <p dir="ltr" className="font-medium">
              {viewing.fileName}
            </p>
            <p className="text-meta text-ink-muted">
              {viewing.mime} · <bdi>{Math.round(viewing.size / 1024)} KB</bdi>
            </p>
            <DocumentPreview orgId={v.orgId} doc={viewing} />
          </div>
        )}
      </Dialog>
    </section>
  );
}

/** The uploaded file through a one-minute signed link, or a note when only its details exist (mock mode). */
function DocumentPreview({ orgId, doc }: { orgId: string; doc: VerificationItem['documents'][number] }) {
  const { t } = useTranslation();
  const url = useDocumentUrl(orgId, doc.fileName);
  // Data saver (SPEC §11): no images; the link still opens the file on request.
  const saver = useDataSaver();
  if (url.isPending) return <Skeleton className="h-40 w-full" />;
  if (!url.data) return <p className="rounded-card bg-canvas p-4 text-ink-muted">{t('admin.docPreviewMock')}</p>;
  return (
    <div className="space-y-2">
      {doc.mime.startsWith('image/') && !saver && <img src={url.data} alt={t(`docTypes.${doc.docType}`)} className="max-h-96 w-full rounded-card border border-border object-contain" />}
      <a href={url.data} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary', 'sm')}>
        <ExternalLink aria-hidden className="size-4" />
        {t('admin.openDoc')}
      </a>
      <p className="text-micro text-ink-muted">{t('admin.docLinkNote')}</p>
    </div>
  );
}
