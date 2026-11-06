// PR-01 لوحة التحكم — profile completeness, published services, active programmes, new inquiries
// and what has not been updated for 30 days; verification, latest inquiries, announcements in review.
import { CalendarClock, CircleCheck, HandHeart, Megaphone, MessageSquare, Plus, RefreshCw, ShieldCheck, Stethoscope, UserRoundCheck } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { CardSkeleton, ErrorBanner, Freshness, StatCard, StatusBadge, buttonClass } from '../../components/ui';
import { usePortalInquiries } from '../../data/portalQueries';
import { useProviderAnnouncements, useProviderProfile, useProviderServices } from '../../data/providerQueries';
import { useSettings } from '../../data/queries';
import { useNow } from '../../hooks/useNow';
import { profileCompleteness } from '../../lib/completeness';
import { DEFAULT_PROGRAM_CONFIRM_DAYS } from '../../lib/programs';
import { programDisplay } from '../directory/programDisplay';
import { usePharmacyCtx } from '../pharmacy-portal/context';

const STALE_DAYS = 30;

export default function ProviderDashboardPage() {
  const { t } = useTranslation();
  const now = useNow();
  const { orgId, membership } = usePharmacyCtx();
  const confirmDays = useSettings().data?.programConfirmDays ?? DEFAULT_PROGRAM_CONFIRM_DAYS;
  const services = useProviderServices(orgId);
  const announcements = useProviderAnnouncements(orgId);
  const inquiries = usePortalInquiries(orgId);
  const profile = useProviderProfile(orgId);

  if (services.isPending || profile.isPending) return <CardSkeleton />;
  if (services.isError || profile.isError) return <ErrorBanner onRetry={() => void services.refetch()} />;

  const items = services.data ?? [];
  const published = items.filter((s) => s.reviewStatus === 'approved');
  const programs = published.filter((s) => s.kind === 'program');
  const active = programs.filter((s) => programDisplay(s, now, confirmDays) === 'active').length;
  const needsConfirm = programs.filter((s) => programDisplay(s, now, confirmDays) === 'needs_update').length;
  const staleBefore = now.getTime() - STALE_DAYS * 86_400_000;
  const stale = published.filter((s) => new Date(s.kind === 'program' && s.confirmedAt ? s.confirmedAt : s.updatedAt).getTime() < staleBefore).length;
  const newInquiries = (inquiries.data ?? []).filter((q) => q.status === 'new');
  const inReview = (announcements.data ?? []).filter((a) => a.reviewStatus === 'pending');
  const complete = profileCompleteness(profile.data!);

  return (
    <div className="space-y-6">
      <h1 className="text-page">{t('portal.provider.nav.dashboard')}</h1>

      <div className="rise-children grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label={t('provider.stat.completeness')} value={`${complete.percent}%`} icon={UserRoundCheck} tone={complete.percent === 100 ? 'ok' : 'warn'} to="/provider/profile" />
        <StatCard label={t('provider.stat.published')} value={published.filter((s) => s.kind !== 'program').length} icon={Stethoscope} to="/provider/services" />
        <StatCard label={t('provider.stat.active')} value={active} icon={HandHeart} tone="ok" note={needsConfirm ? t('provider.stat.needsConfirm', { count: needsConfirm }) : undefined} to="/provider/programs" />
        <StatCard label={t('provider.stat.inquiries')} value={newInquiries.length} icon={MessageSquare} tone={newInquiries.length ? 'review' : 'neutral'} to="/provider/inquiries" />
        <StatCard label={t('provider.stat.stale', { days: STALE_DAYS })} value={stale} icon={CalendarClock} tone={stale ? 'warn' : 'ok'} to="/provider/services" />
      </div>

      <div className="rise-children grid gap-4 lg:grid-cols-3">
        <section className="space-y-3 rounded-card border border-border bg-surface p-5 shadow-card">
          <h2 className="text-section flex items-center gap-2">
            <ShieldCheck aria-hidden className="size-5 text-secondary" />
            {t('provider.verification')}
          </h2>
          {membership.verificationStatus === 'approved' ? (
            <p className="flex items-center gap-2 text-ok-text">
              <CircleCheck aria-hidden className="size-5 text-ok-icon" />
              {t('provider.verified')}
            </p>
          ) : (
            <>
              <StatusBadge status="pending_review" />
              <Link to="/register/status" className="block text-primary hover:underline">
                {t('portal.viewApplication')}
              </Link>
            </>
          )}
        </section>

        <section className="space-y-3 rounded-card border border-border bg-surface p-5 shadow-card">
          <h2 className="text-section">{t('provider.latestInquiries')}</h2>
          {newInquiries.length === 0 ? (
            <p className="text-meta text-ink-muted">{t('provider.noNewInquiries')}</p>
          ) : (
            <ul className="rise-children space-y-2">
              {newInquiries.slice(0, 3).map((q) => (
                <li key={q.id}>
                  <Link to="/provider/inquiries" className="block rounded-control p-2 hover:bg-canvas">
                    <span className="font-medium">{q.subject}</span>
                    <span className="block text-micro text-ink-muted">
                      {q.patientName} · <Freshness at={q.createdAt} bare />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3 rounded-card border border-border bg-surface p-5 shadow-card">
          <h2 className="text-section">{t('provider.inReview')}</h2>
          {inReview.length === 0 ? (
            <p className="text-meta text-ink-muted">{t('provider.nothingInReview')}</p>
          ) : (
            <ul className="space-y-1 text-meta">
              {inReview.map((a) => (
                <li key={a.id} className="flex items-center gap-2">
                  <Megaphone aria-hidden className="size-4 text-review-icon" />
                  {a.title}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="quick-title" className="space-y-3">
        <h2 id="quick-title" className="text-section">
          {t('provider.quickActions')}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Link to="/provider/services" className={buttonClass('primary')}>
            <Plus aria-hidden className="size-4" />
            {t('provider.addService')}
          </Link>
          <Link to="/provider/programs" className={buttonClass('secondary')}>
            <RefreshCw aria-hidden className="size-4" />
            {t('provider.updatePrograms')}
          </Link>
          <Link to="/provider/announcements" className={buttonClass('secondary')}>
            <Megaphone aria-hidden className="size-4" />
            {t('provider.newAnnouncement')}
          </Link>
        </div>
      </section>
    </div>
  );
}
