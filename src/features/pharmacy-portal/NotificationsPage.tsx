// PH-09 الإشعارات — reports whose freshness ran out, new inquiries, verification decisions, approved
// medicine requests and platform messages, filtered by the choices made in PH-10.
import { Bell, Clock } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { CardSkeleton, EmptyState, Freshness, buttonClass } from '../../components/ui';
import { DEFAULT_PREFS, type AppNotification, type NotificationPrefs } from '../../data';
import { usePortalStock } from '../../data/portalQueries';
import { usePrefs } from '../../data/providerQueries';
import { useFreshnessSettings, useMarkNotificationsRead, useNotifications } from '../../data/queries';
import { useNow } from '../../hooks/useNow';
import { freshnessOf } from '../../lib/freshness';
import { NotificationText } from '../account/NotificationsPage';
import { usePharmacyCtx } from './context';

/** Which PH-10 switch controls each kind; kinds not listed always show. */
const prefOf: Partial<Record<AppNotification['kind'], keyof NotificationPrefs>> = {
  inquiry_new: 'inquiries',
  verification: 'verification',
  medicine_approved: 'catalog',
  platform: 'platform',
};

export default function PharmacyNotificationsPage() {
  const { t } = useTranslation();
  const now = useNow();
  const { orgId } = usePharmacyCtx();
  const settings = useFreshnessSettings();
  const stock = usePortalStock(orgId);
  const notifications = useNotifications();
  const prefs = usePrefs();
  const markRead = useMarkNotificationsRead();
  const p = prefs.data ?? DEFAULT_PREFS;

  // Not stored: computed now from the pharmacy's own reports, so it is never out of date.
  const counts = useMemo(() => {
    const c = { stale: 0, expired: 0 };
    for (const r of stock.data ?? []) {
      if (!r.isListed) continue;
      const f = freshnessOf(new Date(r.reportedAt), now, settings.freshHours, settings.expireHours);
      if (f !== 'fresh') c[f]++;
    }
    return c;
  }, [stock.data, now, settings]);

  const list = (notifications.data ?? []).filter((n) => n.kind !== 'alert_met' && n.kind !== 'inquiry_reply' && (!prefOf[n.kind] || p[prefOf[n.kind]!] !== false));
  const unread = list.some((n) => !n.readAt);
  const { mutate } = markRead;
  useEffect(() => {
    if (!unread) return;
    const id = setTimeout(() => mutate(), 1500);
    return () => clearTimeout(id);
  }, [unread, mutate]);

  if (notifications.isPending) return <CardSkeleton />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-page">{t('portal.pharmacy.nav.notifications')}</h1>
        <Link to="/pharmacy-portal/settings" className="text-meta text-primary hover:underline">
          {t('phNotif.prefsLink')}
        </Link>
      </div>

      {counts.stale + counts.expired > 0 && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-warn-bg p-4 text-warn-text">
          <p className="flex items-center gap-2 font-medium">
            <Clock aria-hidden className="size-5 text-warn-icon" />
            {t('phNotif.freshness', { stale: counts.stale, expired: counts.expired })}
          </p>
          <Link to="/pharmacy-portal/update?filter=needs" className={buttonClass('primary', 'sm')}>
            {t('phNotif.updateNow')}
          </Link>
        </section>
      )}

      {list.length === 0 ? (
        <EmptyState icon={Bell} title={t('phNotif.emptyTitle')} body={t('phNotif.emptyBody')} />
      ) : (
        <ul className="divide-y divide-border rounded-card border border-border bg-surface">
          {list.map((n) => (
            <li key={n.id} className="flex flex-col gap-1 p-4">
              <p className={n.readAt ? '' : 'font-semibold'}>
                <NotificationText n={n} />
              </p>
              <span className="flex flex-wrap items-center gap-3 text-micro text-ink-muted">
                <Freshness at={n.createdAt} bare />
                {n.link && (
                  <Link to={n.link} className="text-primary hover:underline">
                    {t('notifications.open')}
                  </Link>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
