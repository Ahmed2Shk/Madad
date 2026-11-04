import { ExternalLink, LogOut, ShieldCheck } from 'lucide-react';
import { useMemo } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button, Skeleton } from '../../components/ui';
import { useMe } from '../../data/portalQueries';
import { useSignOut } from '../../data/queries';
import { AdminContext } from '../../features/admin/context';
import { NoAccess } from '../../features/pharmacy-portal/NoAccess';
import { PortalShell } from './PortalShell';
import { adminNav } from './navs';

// System-admin-only sections (SPEC §4): reviewers do not see them in the sidebar.
const SUPER_ONLY = new Set(['/admin/users', '/admin/audit', '/admin/settings']);

/** Admin panel shell (SPEC §10): MADAD team only, desktop first. */
export default function AdminShell() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const me = useMe();
  const signOut = useSignOut();
  const role = me.data?.platformRole ?? null;
  const ctx = useMemo(() => (role ? { role } : null), [role]);
  const nav = useMemo(() => adminNav.filter((n) => role === 'super_admin' || !SUPER_ONLY.has(n.to)), [role]);

  if (me.isPending) return <Skeleton className="m-6 h-96" />;
  if (!me.data) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (!ctx)
    return (
      <PortalShell titleKey="portal.admin.title" nav={[]}>
        <NoAccess messageKey="admin.notTeam" />
      </PortalShell>
    );

  return (
    <AdminContext.Provider value={ctx}>
      <PortalShell
        titleKey="portal.admin.title"
        nav={nav}
        headerExtra={
          <span className="inline-flex items-center gap-2 text-section">
            <ShieldCheck aria-hidden className="size-5 text-secondary" />
            {t('portal.admin.title')}
          </span>
        }
        account={
          <div className="flex items-center gap-1">
            <span className="hidden text-meta text-ink-muted xl:inline">
              {me.data.displayName} · {t(`admin.roles.${ctx.role}`)}
            </span>
            <Link to="/" className="inline-flex size-11 items-center justify-center rounded-control text-primary hover:bg-mint" aria-label={t('portal.viewSite')}>
              <ExternalLink aria-hidden className="size-5" />
            </Link>
            <Button
              variant="ghost"
              aria-label={t('account.signOut')}
              onClick={async () => {
                await signOut.mutateAsync();
                navigate('/', { replace: true });
              }}
            >
              <LogOut aria-hidden className="size-5" />
            </Button>
          </div>
        }
      />
    </AdminContext.Provider>
  );
}
