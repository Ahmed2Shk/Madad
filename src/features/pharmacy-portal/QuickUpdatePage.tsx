// PH-02 التحديث السريع للتوفر — the most important screen: done in under 30 seconds.
import { CheckCheck, Clock, Eye, Search, WifiOff } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  Button,
  CardSkeleton,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  FilterChips,
  Freshness,
  StatusPicker,
  UpdateRing,
  useToast,
} from '../../components/ui';
import type { Reported, StockChange } from '../../data';
import { useConfirmAll, usePortalStock } from '../../data/portalQueries';
import { useCatalog, useFreshnessSettings } from '../../data/queries';
import { useLang } from '../../hooks/useLang';
import { useNow } from '../../hooks/useNow';
import { freshnessOf } from '../../lib/freshness';
import { normalizeArabic } from '../../lib/normalizeArabic';
import { searchTextOf } from '../../lib/search';
import { cn } from '../../lib/cn';
import { usePharmacyCtx } from './context';
import { RequirePerm } from './NoAccess';
import { useOfflineQueue } from './useOfflineQueue';

type Filter = 'needs' | 'all' | 'unavailable' | 'limited';
interface Edit {
  status?: Reported;
  price?: string;
  /** When the change was made on this device (SPEC §8). */
  at: string;
}

export default function QuickUpdatePage() {
  return (
    <RequirePerm perm="availability">
      <QuickUpdate />
    </RequirePerm>
  );
}

function QuickUpdate() {
  const { t } = useTranslation();
  const { pick, strength } = useLang();
  const toast = useToast();
  const now = useNow();
  const settings = useFreshnessSettings();
  const { orgId, can, membership } = usePharmacyCtx();
  const [params, setParams] = useSearchParams();
  const stock = usePortalStock(orgId);
  const catalog = useCatalog();
  const confirmAll = useConfirmAll(orgId);
  const { submit, waiting, saving } = useOfflineQueue(orgId);
  const [q, setQ] = useState(params.get('q') ?? '');
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [openPrice, setOpenPrice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pricesToo, setPricesToo] = useState(false);
  const [saved, setSaved] = useState<number | null>(null);
  const filter = (params.get('filter') as Filter) || 'needs';
  const canPrice = can('prices');
  const approved = membership.verificationStatus === 'approved';

  const medicines = useMemo(() => new Map((catalog.data?.medicines ?? []).map((m) => [m.id, m])), [catalog.data]);
  const fresh = (at: string) => freshnessOf(new Date(at), now, settings.freshHours, settings.expireHours);
  const listed = useMemo(() => (stock.data ?? []).filter((r) => r.isListed), [stock.data]);
  const needsCount = listed.filter((r) => fresh(r.reportedAt) !== 'fresh').length;

  const rows = useMemo(() => {
    const nq = normalizeArabic(q);
    return listed
      .filter((r) => {
        const m = medicines.get(r.medicineId);
        if (nq && !(m && searchTextOf(m).includes(nq))) return false;
        if (filter === 'needs') return freshnessOf(new Date(r.reportedAt), now, settings.freshHours, settings.expireHours) !== 'fresh' || !!edits[r.medicineId];
        if (filter === 'unavailable' || filter === 'limited') return r.reportedStatus === filter;
        return true;
      })
      .sort((a, b) => a.reportedAt.localeCompare(b.reportedAt)); // oldest first: most in need
  }, [listed, medicines, q, filter, now, settings, edits]);

  const changes = Object.keys(edits).length;
  const setEdit = (medicineId: string, patch: Partial<Edit>) =>
    setEdits((e) => ({ ...e, [medicineId]: { ...e[medicineId], ...patch, at: new Date().toISOString() } }));

  const save = async () => {
    const list: StockChange[] = Object.entries(edits).flatMap(([medicineId, e]) => {
      const row = listed.find((r) => r.medicineId === medicineId);
      if (!row) return [];
      const price = e.price === undefined || !canPrice ? undefined : e.price.trim() === '' ? null : Number(e.price);
      if (price !== undefined && price !== null && (!Number.isFinite(price) || price < 0)) return [];
      return [{ medicineId, status: e.status ?? row.reportedStatus, priceIls: price, clientUpdatedAt: e.at }];
    });
    if (list.length === 0) return;
    const result = await submit(list);
    setEdits({});
    setOpenPrice(null);
    if (result === 'queued') return toast(t('update.queued', { count: list.length }));
    setSaved(list.length);
    toast(approved ? t('update.savedPublic', { count: list.length }) : t('update.savedPending', { count: list.length }));
  };

  const doConfirmAll = async () => {
    const n = await confirmAll.mutateAsync(pricesToo);
    setConfirming(false);
    toast(t('update.confirmedAll', { count: n }));
  };

  if (stock.isPending || catalog.isPending) return <CardSkeleton />;
  if (stock.isError) return <ErrorBanner onRetry={() => void stock.refetch()} />;

  return (
    <div className="space-y-4 pb-28">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-page">{t('portal.pharmacy.nav.update')}</h1>
          <p className="text-meta text-ink-muted">{t('update.subtitle')}</p>
          {listed.length > 0 && (
            <div className="mt-3">
              <UpdateRing done={listed.length - needsCount} total={listed.length} label={t('update.progress', { done: listed.length - needsCount, total: listed.length })} />
            </div>
          )}
        </div>
        <div className="relative w-full max-w-xs">
          <label htmlFor="upd-q" className="sr-only">
            {t('update.search')}
          </label>
          <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-ink-muted" />
          <input
            id="upd-q"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('update.search')}
            className="min-h-11 w-full rounded-control border border-border bg-surface ps-10 pe-3"
          />
        </div>
      </div>

      {waiting > 0 && (
        <p role="status" className="flex items-center gap-2 rounded-card bg-warn-bg p-3 text-warn-text">
          <WifiOff aria-hidden className="size-5 text-warn-icon" />
          {t('update.waiting', { count: waiting })}
        </p>
      )}
      {needsCount > 0 && (
        <p className="flex items-center gap-2 rounded-card bg-warn-bg p-3 font-medium text-warn-text">
          <Clock aria-hidden className="size-5 text-warn-icon" />
          {t('dashboard.needsUpdate', { count: needsCount })}
        </p>
      )}
      {saved !== null && (
        <p role="status" className="flex flex-wrap items-center gap-2 rounded-card bg-ok-bg p-3 text-ok-text">
          <CheckCheck aria-hidden className="size-5 text-ok-icon" />
          {approved ? t('update.savedPublic', { count: saved }) : t('update.savedPending', { count: saved })}
          <Link to={`/pharmacy/${orgId}${approved ? '' : '?preview=1'}`} className="inline-flex items-center gap-1 font-semibold underline-offset-4 hover:underline">
            <Eye aria-hidden className="size-4" />
            {t('update.seeAsPatient')}
          </Link>
        </p>
      )}

      <FilterChips
        label={t('filters.label')}
        onToggle={(id) => setParams((p) => ({ ...Object.fromEntries(p), filter: id }), { replace: true })}
        chips={(['needs', 'all', 'unavailable', 'limited'] as const).map((id) => ({ id, label: t(`update.filter.${id}`), on: filter === id }))}
      />

      {rows.length === 0 ? (
        <EmptyState icon={CheckCheck} title={filter === 'needs' ? t('update.allFresh') : t('update.noMatch')} />
      ) : (
        <ul className="divide-y divide-border rounded-card border border-border bg-surface">
          {rows.map((r) => {
            const m = medicines.get(r.medicineId);
            const e = edits[r.medicineId];
            const status = e?.status ?? r.reportedStatus;
            const priceValue = e?.price ?? (r.priceIls != null ? String(r.priceIls) : '');
            return (
              <li key={r.medicineId} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-semibold">
                    {e && <span aria-label={t('update.unsaved')} className="size-2.5 shrink-0 rounded-full bg-warn-icon" />}
                    {pick(m)}
                  </p>
                  <p className="text-meta text-ink-muted">
                    {m && strength(m)} · {m && t(`forms.${m.dosageForm}`)} · <Freshness at={r.reportedAt} />
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <StatusPicker label={t('update.statusFor', { name: pick(m) })} value={status} onChange={(v) => setEdit(r.medicineId, { status: v })} />
                  {/* The price field does not exist for members without the price permission (SPEC §4). */}
                  {canPrice &&
                    (openPrice === r.medicineId || e?.price !== undefined ? (
                      <label className="flex items-center gap-2 text-meta">
                        <span className="sr-only">{t('update.priceFor', { name: pick(m) })}</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step={0.5}
                          dir="ltr"
                          value={priceValue}
                          onChange={(ev) => setEdit(r.medicineId, { price: ev.target.value })}
                          className="min-h-11 w-28 rounded-control border border-border px-3"
                          placeholder="0.00"
                        />
                        <span aria-hidden>₪</span>
                      </label>
                    ) : (
                      <button type="button" onClick={() => setOpenPrice(r.medicineId)} className="min-h-11 text-meta text-primary hover:underline">
                        {r.priceIls != null ? t('update.priceSet', { price: r.priceIls.toFixed(2) }) : t('update.priceOptional')}
                      </button>
                    ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 backdrop-blur lg:start-64">
        <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
          <span className={cn('font-medium', changes ? 'text-warn-text' : 'text-ink-muted')} aria-live="polite">
            {t('update.changes', { count: changes })}
          </span>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setConfirming(true)} disabled={listed.length === 0}>
              {t('update.confirmAll')}
            </Button>
            <Button onClick={save} disabled={changes === 0} loading={saving}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        danger={false}
        title={t('update.confirmAllTitle')}
        body={t('update.confirmAllBody', { count: listed.length })}
        confirmLabel={t('update.confirmAll')}
        loading={confirmAll.isPending}
        onConfirm={doConfirmAll}
      >
        {canPrice && (
          <label className="mt-4 flex min-h-11 items-center gap-2">
            <input type="checkbox" checked={pricesToo} onChange={(e) => setPricesToo(e.target.checked)} className="size-4 accent-primary" />
            {t('update.pricesToo')}
          </label>
        )}
      </ConfirmDialog>
    </div>
  );
}
