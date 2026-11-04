// AD-10 سجل التدقيق — read only: no edit or delete from the interface. Filter and export.
import { Download, ScrollText } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { CardSkeleton, DataTable, EmptyState, ErrorBanner, buttonClass, type Column } from '../../components/ui';
import type { AuditEntry } from '../../data';
import { useAuditLog } from '../../data/adminQueries';
import { useLang } from '../../hooks/useLang';
import { formatDateTime } from '../../lib/format';
import { toCsv } from '../../lib/csv';
import { downloadText } from '../../lib/download';
import { RequireSuperAdmin } from './RequireSuperAdmin';

const short = (v: unknown) => (v == null ? '—' : typeof v === 'string' ? v : JSON.stringify(v));

export default function AuditPage() {
  return (
    <RequireSuperAdmin>
      <Audit />
    </RequireSuperAdmin>
  );
}

function Audit() {
  const { t } = useTranslation();
  const { lang } = useLang();
  const [params] = useSearchParams();
  const audit = useAuditLog();
  const [action, setAction] = useState('all');
  const entity = params.get('entity');
  const actions = useMemo(() => [...new Set((audit.data ?? []).map((a) => a.action))].sort(), [audit.data]);
  const rows = useMemo(
    () => (audit.data ?? []).filter((a) => (action === 'all' || a.action === action) && (!entity || a.entityId === entity || a.entityId.startsWith(`${entity}/`))),
    [audit.data, action, entity],
  );

  const columns: Column<AuditEntry>[] = [
    { key: 'time', header: t('table.time'), cell: (a) => <time dateTime={a.createdAt}>{formatDateTime(new Date(a.createdAt), lang)}</time>, sortValue: (a) => a.createdAt },
    { key: 'actor', header: t('table.actor'), cell: (a) => `${a.actorName} · ${t(`admin.actorRole.${a.actorRole}`)}`, sortValue: (a) => a.actorName },
    { key: 'action', header: t('admin.col.action'), cell: (a) => <code dir="ltr">{a.action}</code>, sortValue: (a) => a.action },
    { key: 'entity', header: t('admin.col.entity'), cell: (a) => <bdi dir="ltr">{`${a.entityType}:${a.entityId}`}</bdi> },
    { key: 'old', header: t('admin.col.old'), cell: (a) => <code dir="ltr" className="block max-w-56 truncate">{short(a.oldValue)}</code> },
    { key: 'new', header: t('admin.col.new'), cell: (a) => <code dir="ltr" className="block max-w-56 truncate">{short(a.newValue)}</code> },
  ];

  if (audit.isPending) return <CardSkeleton />;
  if (audit.isError) return <ErrorBanner onRetry={() => void audit.refetch()} />;

  const exportCsv = () =>
    downloadText(
      'madad-audit.csv',
      toCsv(['created_at', 'actor', 'role', 'action', 'entity_type', 'entity_id', 'old_value', 'new_value'], rows.map((a) => [a.createdAt, a.actorName, a.actorRole, a.action, a.entityType, a.entityId, short(a.oldValue), short(a.newValue)])),
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-page">{t('portal.admin.nav.audit')}</h1>
          <p className="text-meta text-ink-muted">{t('admin.auditReadOnly')}</p>
        </div>
        <button type="button" onClick={exportCsv} className={buttonClass('secondary')}>
          <Download aria-hidden className="size-4" />
          {t('admin.exportCsv')}
        </button>
      </div>
      <select aria-label={t('admin.col.action')} value={action} onChange={(e) => setAction(e.target.value)} className="min-h-11 rounded-control border border-border bg-surface px-3 text-meta">
        <option value="all">{t('admin.allActions')}</option>
        {actions.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
      <DataTable
        caption={t('portal.admin.nav.audit')}
        rows={rows}
        columns={columns}
        rowKey={(a) => a.id}
        searchText={(a) => `${a.actorName} ${a.action} ${a.entityId}`}
        pageSize={25}
        empty={<EmptyState icon={ScrollText} title={t('admin.noAudit')} body={t('admin.noAuditBody')} />}
      />
    </div>
  );
}
