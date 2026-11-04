// PH-03 أدوية الصيدلية — table of everything listed; becomes cards under 768px.
import { EyeOff, History, Pill, Plus, RefreshCw, Trash2, Eye } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  AvailabilityStatus,
  Button,
  CardSkeleton,
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorBanner,
  FilterChips,
  buttonClass,
  useToast,
  type Column,
} from '../../components/ui';
import type { PortalStockRow } from '../../data';
import { usePortalStock, useRemoveMedicine, useSetListed, useSetQuantity } from '../../data/portalQueries';
import { useCatalog, useFreshnessSettings } from '../../data/queries';
import { useLang } from '../../hooks/useLang';
import { useNow } from '../../hooks/useNow';
import { DISPLAY_RANK } from '../../lib/freshness';
import { viewRow } from '../../lib/availability';
import { formatPrice } from '../../lib/format';
import { usePharmacyCtx } from './context';

type Pending = { kind: 'hide' | 'remove'; row: PortalStockRow } | null;

export default function MedicinesPage() {
  const { t } = useTranslation();
  const { pick, strength } = useLang();
  const toast = useToast();
  const now = useNow();
  const settings = useFreshnessSettings();
  const { orgId, can } = usePharmacyCtx();
  const stock = usePortalStock(orgId);
  const catalog = useCatalog();
  const setListed = useSetListed(orgId);
  const remove = useRemoveMedicine(orgId);
  const setQty = useSetQuantity(orgId);
  const [pending, setPending] = useState<Pending>(null);
  const [fresh, setFresh] = useState<'all' | 'fresh' | 'stale' | 'expired'>('all');
  const [category, setCategory] = useState('all');
  const canEdit = can('medicines');

  const medicines = useMemo(() => new Map((catalog.data?.medicines ?? []).map((m) => [m.id, m])), [catalog.data]);
  const med = (id: string) => medicines.get(id);
  const rows = useMemo(
    () =>
      (stock.data ?? []).filter((r) => {
        const v = viewRow(r, now, settings);
        if (fresh !== 'all' && v.freshness !== fresh) return false;
        if (category !== 'all' && medicines.get(r.medicineId)?.categoryId !== category) return false;
        return true;
      }),
    [stock.data, now, settings, fresh, category, medicines],
  );

  const columns: Column<PortalStockRow>[] = [
    { key: 'name', header: t('table.medicine'), cell: (r) => <span className="font-medium">{pick(med(r.medicineId))}</span>, sortValue: (r) => pick(med(r.medicineId)), hideInCard: true },
    { key: 'generic', header: t('table.generic'), cell: (r) => <bdi dir="ltr">{med(r.medicineId)?.genericName}</bdi> },
    { key: 'strength', header: t('table.strength'), cell: (r) => strength(med(r.medicineId)) },
    { key: 'form', header: t('table.form'), cell: (r) => { const m = med(r.medicineId); return m ? t(`forms.${m.dosageForm}`) : ''; } },
    {
      key: 'status',
      header: t('table.publicStatus'),
      cell: (r) =>
        r.isListed && !r.hiddenByAdmin ? (
          <AvailabilityStatus row={r} view={viewRow(r, now, settings)} />
        ) : (
          <span className="inline-flex items-center gap-1 text-meta text-ink-muted">
            <EyeOff aria-hidden className="size-4" />
            {r.hiddenByAdmin ? t('meds.hiddenByAdmin') : t('meds.hidden')}
          </span>
        ),
      sortValue: (r) => DISPLAY_RANK[viewRow(r, now, settings).display],
    },
    {
      key: 'price',
      header: t('table.price'),
      cell: (r) => (r.priceIls != null ? <bdi dir="ltr">{formatPrice(r.priceIls)}</bdi> : '—'),
      sortValue: (r) => r.priceIls ?? -1,
    },
    // Internal quantity: only returned (and shown) for members with the medicines permission (SPEC §8 PH-03).
    ...(canEdit
      ? [
          {
            key: 'qty',
            header: t('table.quantity'),
            cell: (r: PortalStockRow) => (
              <span className="inline-flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  dir="ltr"
                  aria-label={t('meds.quantityFor', { name: pick(med(r.medicineId)) })}
                  defaultValue={r.quantity ?? ''}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v) && v >= 0 && v !== r.quantity) void setQty.mutateAsync({ medicineId: r.medicineId, quantity: v, lowThreshold: r.lowThreshold ?? 5 });
                  }}
                  className="min-h-[38px] w-20 rounded-control border border-border px-2"
                />
                {r.quantity != null && r.lowThreshold != null && r.quantity <= r.lowThreshold && (
                  <span className="rounded-full bg-warn-bg px-2 text-micro text-warn-text">{t('meds.low')}</span>
                )}
              </span>
            ),
            sortValue: (r: PortalStockRow) => r.quantity ?? -1,
          },
        ]
      : []),
    {
      key: 'actions',
      header: t('table.actions'),
      cell: (r) => (
        <span className="flex flex-wrap gap-1">
          {can('availability') && (
            <Link to={`/pharmacy-portal/update?filter=all&q=${encodeURIComponent(pick(med(r.medicineId)))}`} className={buttonClass('ghost', 'sm')} aria-label={t('meds.update')}>
              <RefreshCw aria-hidden className="size-4" />
            </Link>
          )}
          <Link to={`/pharmacy-portal/history?medicine=${r.medicineId}`} className={buttonClass('ghost', 'sm')} aria-label={t('meds.history')}>
            <History aria-hidden className="size-4" />
          </Link>
          {canEdit &&
            (r.isListed ? (
              <Button variant="ghost" size="sm" aria-label={t('meds.hide')} onClick={() => setPending({ kind: 'hide', row: r })}>
                <EyeOff aria-hidden className="size-4" />
              </Button>
            ) : (
              <Button variant="ghost" size="sm" aria-label={t('meds.show')} onClick={() => void setListed.mutateAsync({ medicineId: r.medicineId, listed: true }).then(() => toast(t('meds.shown')))}>
                <Eye aria-hidden className="size-4" />
              </Button>
            ))}
          {canEdit && (
            <Button variant="ghost" size="sm" aria-label={t('meds.remove')} onClick={() => setPending({ kind: 'remove', row: r })}>
              <Trash2 aria-hidden className="size-4 text-bad-text" />
            </Button>
          )}
        </span>
      ),
    },
  ];

  if (stock.isPending || catalog.isPending) return <CardSkeleton />;
  if (stock.isError) return <ErrorBanner onRetry={() => void stock.refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-page">{t('portal.pharmacy.nav.medicines')}</h1>
        {canEdit && (
          <Link to="/pharmacy-portal/medicines/add" className={buttonClass('primary')}>
            <Plus aria-hidden className="size-4" />
            {t('portal.pharmacy.nav.add')}
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <FilterChips
          label={t('meds.freshFilter')}
          onToggle={(id) => setFresh(id as typeof fresh)}
          chips={(['all', 'fresh', 'stale', 'expired'] as const).map((id) => ({ id, label: t(`meds.fresh.${id}`), on: fresh === id }))}
        />
        <label className="flex items-center gap-2 text-meta">
          {t('medicine.category')}
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="min-h-11 rounded-control border border-border bg-surface px-3">
            <option value="all">{t('meds.allCategories')}</option>
            {catalog.data?.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {pick(c)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <DataTable
        caption={t('portal.pharmacy.nav.medicines')}
        rows={rows}
        columns={columns}
        rowKey={(r) => r.medicineId}
        searchText={(r) => { const m = med(r.medicineId); return m ? `${m.nameAr} ${m.nameEn} ${m.genericName}` : ''; }}
        cardTitle={(r) => pick(med(r.medicineId))}
        empty={<EmptyState icon={Pill} title={t('meds.empty')} />}
      />

      <ConfirmDialog
        open={pending?.kind === 'hide'}
        onClose={() => setPending(null)}
        title={t('meds.hideTitle')}
        body={t('meds.hideBody')}
        confirmLabel={t('meds.hide')}
        loading={setListed.isPending}
        onConfirm={async () => {
          await setListed.mutateAsync({ medicineId: pending!.row.medicineId, listed: false });
          setPending(null);
          toast(t('meds.hiddenToast'));
        }}
      />
      <ConfirmDialog
        open={pending?.kind === 'remove'}
        onClose={() => setPending(null)}
        title={t('meds.removeTitle')}
        body={t('meds.removeBody')}
        confirmLabel={t('meds.remove')}
        loading={remove.isPending}
        onConfirm={async () => {
          await remove.mutateAsync(pending!.row.medicineId);
          setPending(null);
          toast(t('meds.removed'));
        }}
      />
    </div>
  );
}
