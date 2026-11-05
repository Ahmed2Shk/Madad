// AD-09 المستخدمون — search, type, status and join date; suspend or reactivate an account, and assign
// MADAD team roles. System admin only (docs/DECISIONS.md, phases 2–3 #8).
import { Ban, RotateCcw, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CardSkeleton, ConfirmDialog, DataTable, EmptyState, ErrorBanner, Button, useToast, type Column } from '../../components/ui';
import type { AdminUser } from '../../data';
import { useMe } from '../../data/portalQueries';
import { useAdminUsers, useSetPlatformRole, useSetUserSuspended } from '../../data/providerQueries';
import { useLang } from '../../hooks/useLang';
import { formatDateTime } from '../../lib/format';
import { cn } from '../../lib/cn';
import { RequireSuperAdmin } from './RequireSuperAdmin';

export default function UsersPage() {
  return (
    <RequireSuperAdmin>
      <Users_ />
    </RequireSuperAdmin>
  );
}

function Users_() {
  const { t } = useTranslation();
  const { pick, lang } = useLang();
  const toast = useToast();
  const me = useMe();
  const users = useAdminUsers();
  const suspend = useSetUserSuspended();
  const setRole = useSetPlatformRole();
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const [confirming, setConfirming] = useState<AdminUser | null>(null);

  const rows = useMemo(
    () => (users.data ?? []).filter((u) => (type === 'all' || u.type === type) && (status === 'all' || (status === 'suspended') === u.suspended)),
    [users.data, type, status],
  );

  const columns: Column<AdminUser>[] = [
    {
      key: 'name',
      header: t('users.name'),
      cell: (u) => (
        <span>
          <span className="block font-medium">{u.displayName}</span>
          <span className="block text-micro text-ink-muted" dir="ltr">
            {u.email}
          </span>
        </span>
      ),
      sortValue: (u) => u.displayName,
    },
    {
      key: 'type',
      header: t('users.type'),
      cell: (u) => (
        <span>
          {t(`users.types.${u.type}`)}
          {u.memberships.map((m) => (
            <span key={m.orgId} className="block text-micro text-ink-muted">
              {pick({ nameAr: m.orgNameAr, nameEn: m.orgNameEn || m.orgNameAr })} · {t(`roles.${m.role}`)}
            </span>
          ))}
        </span>
      ),
      sortValue: (u) => u.type,
    },
    {
      key: 'status',
      header: t('users.status'),
      cell: (u) => (
        <span className={cn('rounded-full px-2 py-0.5 text-micro font-medium', u.suspended ? 'bg-bad-bg text-bad-text' : 'bg-ok-bg text-ok-text')}>
          {t(u.suspended ? 'users.suspended' : 'users.active')}
        </span>
      ),
      sortValue: (u) => (u.suspended ? 1 : 0),
    },
    { key: 'joined', header: t('users.joined'), cell: (u) => <bdi dir="ltr">{formatDateTime(new Date(u.joinedAt), lang)}</bdi>, sortValue: (u) => u.joinedAt },
    {
      key: 'role',
      header: t('users.teamRole'),
      cell: (u) => (
        <select
          aria-label={t('users.teamRoleFor', { name: u.displayName })}
          value={u.platformRole ?? ''}
          disabled={u.userId === me.data?.userId || setRole.isPending}
          onChange={async (e) => {
            await setRole.mutateAsync({ userId: u.userId, role: (e.target.value || null) as AdminUser['platformRole'] });
            toast(t('users.roleSaved'));
          }}
          className="min-h-10 rounded-control border border-border bg-surface px-2"
        >
          <option value="">{t('users.noTeamRole')}</option>
          <option value="reviewer">{t('demo.roles.reviewer')}</option>
          <option value="super_admin">{t('demo.roles.admin')}</option>
        </select>
      ),
    },
    {
      key: 'actions',
      header: t('table.actions'),
      cell: (u) =>
        u.userId === me.data?.userId ? (
          <span className="text-micro text-ink-muted">{t('users.you')}</span>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setConfirming(u)}>
            {u.suspended ? <RotateCcw aria-hidden className="size-4" /> : <Ban aria-hidden className="size-4 text-bad-icon" />}
            {t(u.suspended ? 'users.reactivate' : 'users.suspend')}
          </Button>
        ),
    },
  ];

  if (users.isPending) return <CardSkeleton />;
  if (users.isError) return <ErrorBanner onRetry={() => void users.refetch()} />;

  const select = 'min-h-11 rounded-control border border-border bg-surface px-3 text-meta';
  return (
    <div className="space-y-5">
      <h1 className="text-page">{t('portal.admin.nav.users')}</h1>
      <div className="flex flex-wrap gap-3">
        <select aria-label={t('users.type')} value={type} onChange={(e) => setType(e.target.value)} className={select}>
          <option value="all">{t('users.allTypes')}</option>
          {(['patient', 'organization', 'team'] as const).map((x) => (
            <option key={x} value={x}>
              {t(`users.types.${x}`)}
            </option>
          ))}
        </select>
        <select aria-label={t('users.status')} value={status} onChange={(e) => setStatus(e.target.value)} className={select}>
          <option value="all">{t('users.allStatuses')}</option>
          <option value="active">{t('users.active')}</option>
          <option value="suspended">{t('users.suspended')}</option>
        </select>
      </div>
      <DataTable
        caption={t('portal.admin.nav.users')}
        rows={rows}
        columns={columns}
        rowKey={(u) => u.userId}
        searchText={(u) => `${u.displayName} ${u.email}`}
        cardTitle={(u) => u.displayName}
        empty={<EmptyState icon={Users} title={t('users.empty')} />}
      />
      <ConfirmDialog
        open={!!confirming}
        title={t(confirming?.suspended ? 'users.reactivateTitle' : 'users.suspendTitle', { name: confirming?.displayName ?? '' })}
        body={t(confirming?.suspended ? 'users.reactivateBody' : 'users.suspendBody')}
        confirmLabel={t(confirming?.suspended ? 'users.reactivate' : 'users.suspend')}
        danger={!confirming?.suspended}
        loading={suspend.isPending}
        onClose={() => setConfirming(null)}
        onConfirm={async () => {
          await suspend.mutateAsync({ userId: confirming!.userId, suspended: !confirming!.suspended });
          setConfirming(null);
          toast(t('users.saved'));
        }}
      />
    </div>
  );
}
