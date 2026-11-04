// AD-03 المؤسسات — suspend (with a reason; out of search at once) or reactivate; open the audit trail.
import { Building2, History, Pause, Play } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  Button,
  CardSkeleton,
  DataTable,
  Dialog,
  EmptyState,
  ErrorBanner,
  Field,
  Freshness,
  buttonClass,
  inputClass,
  useToast,
  type Column,
} from '../../components/ui';
import { GOVERNORATES, governorateById, type AdminOrgRow, type OrgType, type VerificationStatus } from '../../data';
import { useAdminOrgs, useReactivateOrg, useSuspendOrg } from '../../data/adminQueries';
import { useLang } from '../../hooks/useLang';
import { VerificationStatusPill } from './VerificationPage';
import { useAdminCtx } from './context';

const TYPES: OrgType[] = ['pharmacy', 'hospital', 'medical_point', 'humanitarian'];
const STATUSES: VerificationStatus[] = ['pending', 'needs_info', 'approved', 'rejected', 'suspended'];

export default function OrganizationsPage() {
  const { t } = useTranslation();
  const { pick } = useLang();
  const toast = useToast();
  const { role } = useAdminCtx();
  const orgs = useAdminOrgs();
  const suspend = useSuspendOrg();
  const reactivate = useReactivateOrg();
  const [type, setType] = useState<'all' | OrgType>('all');
  const [gov, setGov] = useState('all');
  const [status, setStatus] = useState<'all' | VerificationStatus>('all');
  const [suspending, setSuspending] = useState<AdminOrgRow | null>(null);
  const [reason, setReason] = useState('');

  const rows = useMemo(
    () => (orgs.data ?? []).filter((o) => (type === 'all' || o.type === type) && (gov === 'all' || o.governorate === gov) && (status === 'all' || o.verificationStatus === status)),
    [orgs.data, type, gov, status],
  );

  const columns: Column<AdminOrgRow>[] = [
    { key: 'name', header: t('admin.col.name'), cell: (o) => <span className="font-medium">{pick(o)}</span>, sortValue: (o) => pick(o), hideInCard: true },
    { key: 'type', header: t('register.type'), cell: (o) => t(`orgTypes.${o.type}`), sortValue: (o) => o.type },
    { key: 'gov', header: t('gov.label'), cell: (o) => pick(governorateById(o.governorate)), sortValue: (o) => o.governorate },
    { key: 'status', header: t('admin.col.status'), cell: (o) => <VerificationStatusPill status={o.verificationStatus} />, sortValue: (o) => o.verificationStatus },
    { key: 'listed', header: t('dashboard.listed'), cell: (o) => (o.type === 'pharmacy' ? o.listed : '—'), sortValue: (o) => o.listed },
    { key: 'last', header: t('pharmacies.lastStockUpdate'), cell: (o) => (o.lastStockUpdateAt ? <Freshness at={o.lastStockUpdateAt} /> : '—'), sortValue: (o) => o.lastStockUpdateAt ?? '' },
    {
      key: 'actions',
      header: t('table.actions'),
      cell: (o) => (
        <span className="flex flex-wrap gap-1">
          {o.verificationStatus === 'approved' && (
            <Button variant="ghost" size="sm" onClick={() => setSuspending(o)}>
              <Pause aria-hidden className="size-4 text-bad-text" />
              {t('admin.suspend')}
            </Button>
          )}
          {o.verificationStatus === 'suspended' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await reactivate.mutateAsync(o.id);
                toast(t('admin.reactivated', { name: pick(o) }));
              }}
            >
              <Play aria-hidden className="size-4 text-ok-icon" />
              {t('admin.reactivate')}
            </Button>
          )}
          {role === 'super_admin' && (
            <Link to={`/admin/audit?entity=${o.id}`} className={buttonClass('ghost', 'sm')} aria-label={t('admin.orgHistory', { name: pick(o) })}>
              <History aria-hidden className="size-4" />
            </Link>
          )}
        </span>
      ),
    },
  ];

  if (orgs.isPending) return <CardSkeleton />;
  if (orgs.isError) return <ErrorBanner onRetry={() => void orgs.refetch()} />;
  const sel = 'min-h-11 rounded-control border border-border bg-surface px-3';

  return (
    <div className="space-y-4">
      <h1 className="text-page">{t('portal.admin.nav.organizations')}</h1>
      <div className="flex flex-wrap gap-3 text-meta">
        <select aria-label={t('register.type')} className={sel} value={type} onChange={(e) => setType(e.target.value as typeof type)}>
          <option value="all">{t('admin.allTypes')}</option>
          {TYPES.map((x) => (
            <option key={x} value={x}>
              {t(`orgTypes.${x}`)}
            </option>
          ))}
        </select>
        <select aria-label={t('gov.label')} className={sel} value={gov} onChange={(e) => setGov(e.target.value)}>
          <option value="all">{t('gov.all')}</option>
          {GOVERNORATES.map((g) => (
            <option key={g.id} value={g.id}>
              {pick(g)}
            </option>
          ))}
        </select>
        <select aria-label={t('admin.col.status')} className={sel} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="all">{t('admin.allStatuses')}</option>
          {STATUSES.map((x) => (
            <option key={x} value={x}>
              {t(`admin.vstatus.${x}`)}
            </option>
          ))}
        </select>
      </div>
      <DataTable
        caption={t('portal.admin.nav.organizations')}
        rows={rows}
        columns={columns}
        rowKey={(o) => o.id}
        searchText={(o) => `${o.nameAr} ${o.nameEn}`}
        cardTitle={(o) => pick(o)}
        empty={<EmptyState icon={Building2} title={t('admin.noOrgs')} />}
      />

      <Dialog
        open={!!suspending}
        onClose={() => setSuspending(null)}
        title={t('admin.suspendTitle', { name: suspending ? pick(suspending) : '' })}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSuspending(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              disabled={!reason.trim()}
              loading={suspend.isPending}
              onClick={async () => {
                await suspend.mutateAsync({ orgId: suspending!.id, reason });
                toast(t('admin.suspended', { name: pick(suspending!) }));
                setSuspending(null);
                setReason('');
              }}
            >
              {t('admin.suspend')}
            </Button>
          </>
        }
      >
        <p className="mb-3 text-ink-muted">{t('admin.suspendBody')}</p>
        <Field label={t('admin.reason')}>
          <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </Dialog>
    </div>
  );
}
