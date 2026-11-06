// PH-06 الاستفسارات — list + conversation. An inquiry is never a reservation or an order.
import { MessageSquare, Send, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, CardSkeleton, EmptyState, ErrorBanner, Freshness, inputClass, useToast } from '../../components/ui';
import type { InquiryStatus, InquiryThread } from '../../data';
import { usePortalInquiries, useReplyInquiry, useSaveStock, useSetInquiryStatus } from '../../data/portalQueries';
import { useCatalog } from '../../data/queries';
import { useLang } from '../../hooks/useLang';
import { cn } from '../../lib/cn';
import { usePharmacyCtx } from './context';
import { useProviderServices } from '../../data/providerQueries';

const STATUSES: InquiryStatus[] = ['new', 'in_progress', 'replied', 'closed'];
const tone: Record<InquiryStatus, string> = {
  new: 'bg-review-bg text-review-text',
  in_progress: 'bg-warn-bg text-warn-text',
  replied: 'bg-ok-bg text-ok-text',
  closed: 'bg-unknown-bg text-unknown-text',
};

export default function InquiriesPage() {
  const { t } = useTranslation();
  const { orgId } = usePharmacyCtx();
  const inquiries = usePortalInquiries(orgId);
  const [selected, setSelected] = useState<string | null>(null);

  if (inquiries.isPending) return <CardSkeleton />;
  if (inquiries.isError) return <ErrorBanner onRetry={() => void inquiries.refetch()} />;
  const list = inquiries.data ?? [];
  const current = list.find((q) => q.id === selected) ?? list[0];

  return (
    <div className="space-y-4">
      <h1 className="text-page">{t('portal.pharmacy.nav.inquiries')}</h1>
      <p className="flex items-center gap-2 rounded-card bg-warn-bg p-3 text-warn-text">
        <ShieldAlert aria-hidden className="size-5 shrink-0 text-warn-icon" />
        {t('inq.warning')}
      </p>
      {list.length === 0 ? (
        <EmptyState icon={MessageSquare} title={t('inq.emptyTitle')} body={t('inq.emptyBody')} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
          <ul aria-label={t('portal.pharmacy.nav.inquiries')} className="divide-y divide-border rounded-card border border-border bg-surface">
            {list.map((q) => (
              <li key={q.id}>
                <button
                  type="button"
                  aria-current={current?.id === q.id ? 'true' : undefined}
                  onClick={() => setSelected(q.id)}
                  className={cn('block w-full p-4 text-start hover:bg-canvas', current?.id === q.id && 'bg-mint')}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{q.patientName}</span>
                    <span className={cn('rounded-full px-2 py-0.5 text-micro font-medium', tone[q.status])}>{t(`inq.status.${q.status}`)}</span>
                  </span>
                  <span className="mt-1 block text-meta">{q.subject}</span>
                  <span className="mt-1 block truncate text-meta text-ink-muted">{q.messages[0]?.body}</span>
                  <span className="mt-1 flex justify-between text-micro text-ink-muted">
                    <bdi>#{q.id.replace('inq-', '')}</bdi>
                    <Freshness at={q.updatedAt} className="text-micro" bare />
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {current && <Conversation key={current.id} q={current} />}
        </div>
      )}
    </div>
  );
}

function Conversation({ q }: { q: InquiryThread }) {
  const { t } = useTranslation();
  const { pick } = useLang();
  const toast = useToast();
  const { orgId, can, membership } = usePharmacyCtx();
  // PR-06 reuses this screen: providers' inquiries are about a service or programme, not a medicine.
  const isPharmacy = membership.orgType === 'pharmacy';
  const services = useProviderServices(isPharmacy ? '' : orgId, !isPharmacy);
  const service = services.data?.find((x) => x.id === q.serviceId);
  const reply = useReplyInquiry(orgId);
  const setStatus = useSetInquiryStatus(orgId);
  const saveStock = useSaveStock(orgId);
  const catalog = useCatalog();
  const [body, setBody] = useState('');
  const [offerUpdate, setOfferUpdate] = useState(false);
  const medicine = catalog.data?.medicines.find((m) => m.id === q.medicineId);
  const canReply = can('inquiries');
  const quick = isPharmacy ? [t('inq.quickAvailable'), t('inq.quickUnavailable')] : [];

  const send = async (text = body) => {
    if (!text.trim()) return;
    await reply.mutateAsync({ id: q.id, body: text });
    setBody('');
    toast(t('inq.sent'));
    // Replying "available" offers to update the medicine's status too (SPEC §8 PH-06).
    if (text === quick[0] && medicine && can('availability')) setOfferUpdate(true);
  };

  return (
    <section aria-label={q.subject} className="flex flex-col rounded-card border border-border bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div>
          <h2 className="text-section">{q.subject}</h2>
          <p className="text-meta text-ink-muted">
            {q.patientName}
            {medicine && <> · {pick(medicine)}</>}
            {service && <> · {service.name}</>}
          </p>
        </div>
        {canReply && (
          <label className="flex items-center gap-2 text-meta">
            {t('inq.statusLabel')}
            <select
              value={q.status}
              onChange={(e) => void setStatus.mutateAsync({ id: q.id, status: e.target.value as InquiryStatus })}
              className="min-h-10 rounded-control border border-border bg-surface px-2"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`inq.status.${s}`)}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>
      <ol className="rise-children flex-1 space-y-3 p-4">
        {q.messages.map((m, i) => (
          <li key={i} className={cn('max-w-[80%] rounded-card p-3', m.sender === 'org' ? 'ms-auto bg-mint' : 'bg-canvas')}>
            <p>{m.body}</p>
            <Freshness at={m.createdAt} className="text-micro" bare />
          </li>
        ))}
      </ol>
      {offerUpdate && medicine && (
        <div className="mx-4 mb-3 flex flex-wrap items-center justify-between gap-3 rounded-card bg-ok-bg p-3 text-ok-text">
          {t('inq.alsoUpdate', { name: pick(medicine) })}
          <span className="flex gap-2">
            <Button
              size="sm"
              loading={saveStock.isPending}
              onClick={async () => {
                await saveStock.mutateAsync([{ medicineId: medicine.id, status: 'available', clientUpdatedAt: new Date().toISOString() }]);
                setOfferUpdate(false);
                toast(t('update.savedPublic', { count: 1 }));
              }}
            >
              {t('inq.markAvailable')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOfferUpdate(false)}>
              {t('common.cancel')}
            </Button>
          </span>
        </div>
      )}
      {canReply && (
        <form
          className="space-y-2 border-t border-border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <div className="flex flex-wrap gap-2">
            {quick.map((text) => (
              <button key={text} type="button" onClick={() => void send(text)} className="min-h-10 rounded-full border border-border px-3 text-meta hover:bg-canvas">
                {text}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <label htmlFor="inq-reply" className="sr-only">
              {t('inq.reply')}
            </label>
            <textarea id="inq-reply" rows={2} maxLength={500} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t('inq.reply')} className={`${inputClass} py-2`} />
            <Button type="submit" loading={reply.isPending} disabled={!body.trim()} aria-label={t('inq.send')}>
              <Send aria-hidden className="size-4" />
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
