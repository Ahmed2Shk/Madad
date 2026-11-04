import { BadgeCheck, ExternalLink, Hourglass, LogOut, UserRound } from 'lucide-react';
import { useMemo } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button, Skeleton, StatusBadge } from '../../components/ui';
import { useMe } from '../../data/portalQueries';
import { useSignOut } from '../../data/queries';
import { useLang } from '../../hooks/useLang';
import { NoAccess } from '../../features/pharmacy-portal/NoAccess';
import { PharmacyContext, type PharmacyCtx } from '../../features/pharmacy-portal/context';
import { PortalShell } from './PortalShell';
import { pharmacyNav } from './navs';

/**
 * Pharmacy portal shell (SPEC §8): signed-in pharmacy members only. Unverified pharmacies get the
 * full portal with a "under review" banner; nothing they do is public until approval.
 */
export default function PharmacyShell() {
  const { t } = useTranslation();
  const { pick } = useLang();
  const location = useLocation();
  const navigate = useNavigate();
  const me = useMe();
  const signOut = useSignOut();
  const membership = me.data?.memberships.find((m) => m.orgType === 'pharmacy');

  const ctx = useMemo<PharmacyCtx | null>(
    () => (membership ? { orgId: membership.orgId, membership, can: (p) => membership.perms[p] === true } : null),
    [membership],
  );

  if (me.isPending) return <Skeleton className="m-6 h-96" />;
  if (!me.data) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (!membership || !ctx)
    return (
      <PortalShell titleKey="portal.pharmacy.title" nav={[]}>
        <NoAccess messageKey="portal.notPharmacyMember" />
      </PortalShell>
    );

  const approved = membership.verificationStatus === 'approved';
  const orgName = pick({ nameAr: membership.orgNameAr, nameEn: membership.orgNameEn || membership.orgNameAr });

  return (
    <PharmacyContext.Provider value={ctx}>
      <PortalShell
        titleKey="portal.pharmacy.title"
        nav={pharmacyNav}
        headerExtra={
          <div className="flex items-center gap-3">
            <span className="truncate text-section">{orgName}</span>
            {approved ? (
              <span className="inline-flex items-center gap-1 text-meta text-ok-text">
                <BadgeCheck aria-hidden className="size-4 text-ok-icon" />
                {t('pharmacy.verified')}
              </span>
            ) : (
              <StatusBadge status="pending_review" />
            )}
          </div>
        }
        account={
          <div className="flex items-center gap-1">
            <span className="hidden items-center gap-1.5 text-meta text-ink-muted xl:inline-flex">
              <UserRound aria-hidden className="size-4" />
              {me.data.displayName} · {t(`roles.${membership.role}`)}
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
        banner={
          !approved && (
            <p role="status" className="flex flex-wrap items-center gap-2 rounded-card bg-review-bg p-3 text-review-text">
              <Hourglass aria-hidden className="size-5 text-review-icon" />
              {t(membership.verificationStatus === 'needs_info' ? 'portal.bannerNeedsInfo' : 'portal.bannerPending')}
              <Link to="/register/status" className="font-semibold underline-offset-4 hover:underline">
                {t('portal.viewApplication')}
              </Link>
            </p>
          )
        }
      />
    </PharmacyContext.Provider>
  );
}
