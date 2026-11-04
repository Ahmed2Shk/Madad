// PH-05 سجل التوفر — every change, who made it and when; confirm_all is a single line.
import { History } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { CardSkeleton, DataTable, EmptyState, ErrorBanner, type Column } from '../../components/ui';
import type { HistoryEntry } from '../../data';
import { usePortalHistory } from '../../data/portalQueries';
import { useCatalog } from '../../data/queries';
import { useLang } from '../../hooks/useLang';
import { formatDateTime } from '../../lib/format';
import { usePharmacyCtx } from './context';
import { HistoryLine } from './HistoryLine';

export default function HistoryPage() {
  const { t } = useTranslation();
  const { pick, lang } = useLang();
  const { orgId } = usePharmacyCtx();
  const [params, setParams] = useSearchParams();
  const history = usePortalHistory(orgId);
  const catalog = useCatalog();
  const medicine = params.get('medicine') ?? 'all';
  const [actor, setActor] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const actors = useMemo(() => [...new Set((history.data ?? []).map((h) => h.actorName))], [history.data]);
  const medicines = useMemo(() => [...new Set((history.data ?? []).flatMap((h) => (h.medicineId ? [h.medicineId] : [])))], [history.data]);
  const rows = useMemo(
    () =>
      (history.data ?? []).filter(
        (h) =>
          (medicine === 'all' || h.medicineId === medicine) &&
          (actor === 'all' || h.actorName === actor) &&
          (!from || h.createdAt.slice(0, 10) >= from) &&
          (!to || h.createdAt.slice(0, 10) <= to),
      ),
    [history.data, medicine, actor, from, to],
  );

  const columns: Column<HistoryEntry>[] = [
    { key: 'time', header: t('table.time'), cell: (h) => <time dateTime={h.createdAt}>{formatDateTime(new Date(h.createdAt), lang)}</time>, sortValue: (h) => h.createdAt },
    { key: 'change', header: t('table.change'), cell: (h) => <HistoryLine entry={h} showActor={false} /> },
    { key: 'actor', header: t('table.actor'), cell: (h) => h.actorName, sortValue: (h) => h.actorName },
  ];

  if (history.isPending) return <CardSkeleton />;
  if (history.isError) return <ErrorBanner onRetry={() => void history.refetch()} />;

  const sel = 'min-h-11 rounded-control border border-border bg-surface px-3';
  return (
    <div className="space-y-4">
      <h1 className="text-page">{t('portal.pharmacy.nav.history')}</h1>
      <div className="flex flex-wrap items-end gap-3 text-meta">
        <label className="flex flex-col gap-1">
          {t('table.medicine')}
          <select
            className={sel}
            value={medicine}
            onChange={(e) => setParams((p) => ({ ...Object.fromEntries(p), medicine: e.target.value }), { replace: true })}
          >
            <option value="all">{t('history.allMedicines')}</option>
            {medicines.map((id) => (
              <option key={id} value={id}>
                {pick(catalog.data?.medicines.find((m) => m.id === id))}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          {t('table.actor')}
          <select className={sel} value={actor} onChange={(e) => setActor(e.target.value)}>
            <option value="all">{t('history.allActors')}</option>
            {actors.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          {t('history.from')}
          <input type="date" dir="ltr" className={sel} value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          {t('history.to_date')}
          <input type="date" dir="ltr" className={sel} value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      <DataTable
        caption={t('portal.pharmacy.nav.history')}
        rows={rows}
        columns={columns}
        rowKey={(h) => h.id}
        pageSize={20}
        empty={<EmptyState icon={History} title={t('history.empty')} />}
      />
    </div>
  );
}
