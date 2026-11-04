// P-11 الإشعارات وتنبيهات التوفر — in-site notifications only (Web Push is a later phase).
import { Bell, BellOff, CheckCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button, CardSkeleton, EmptyState, Freshness, Tabs, useToast } from '../../components/ui';
import { governorateById, type AppNotification } from '../../data';
import { useAlerts, useCatalog, useMarkNotificationsRead, useNotifications, usePharmacies, useStopAlert } from '../../data/queries';
import { useLang } from '../../hooks/useLang';
import { formatRelative } from '../../lib/format';
import { useNow } from '../../hooks/useNow';
import { SignedInOnly } from './SignedInOnly';

function NotificationText({ n }: { n: AppNotification }) {
  const { t } = useTranslation();
  const { pick, lang } = useLang();
  const now = useNow();
  const catalog = useCatalog();
  const pharmacies = usePharmacies('all');
  if (n.kind === 'alert_met') {
    const p = pharmacies.data?.find((x) => x.id === n.data.pharmacyId);
    return (
      <>
        {t('notifications.alertMet', {
          pharmacy: pick(p),
          gov: pick(governorateById(n.data.governorate ?? '')),
          medicine: pick(catalog.data?.medicines.find((m) => m.id === n.data.medicineId)),
          time: formatRelative(new Date(n.createdAt), now, lang),
        })}
      </>
    );
  }
  return <>{n.data.text ?? ''}</>;
}

function Notifications() {
  const { t } = useTranslation();
  const { pick } = useLang();
  const toast = useToast();
  const [tab, setTab] = useState('notifications');
  const notifications = useNotifications();
  const alerts = useAlerts();
  const markRead = useMarkNotificationsRead();
  const stop = useStopAlert();
  const catalog = useCatalog();
  const unread = notifications.data?.filter((n) => !n.readAt).length ?? 0;

  const { mutate: markAllRead } = markRead;
  useEffect(() => {
    if (tab === 'notifications' && unread > 0) {
      const id = setTimeout(() => markAllRead(), 1500);
      return () => clearTimeout(id);
    }
  }, [tab, unread, markAllRead]);

  const activeAlerts = (alerts.data ?? []).filter((a) => a.active || a.notifiedAt);

  return (
    <div className="space-y-4">
      <h1 className="text-page">{t('notifications.title')}</h1>
      <Tabs
        label={t('notifications.title')}
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'notifications', label: t('notifications.tab'), count: unread },
          { id: 'alerts', label: t('notifications.myAlerts'), count: (alerts.data ?? []).filter((a) => a.active).length },
        ]}
      >
        {tab === 'notifications' ? (
          notifications.isPending ? (
            <CardSkeleton />
          ) : !notifications.data?.length ? (
            <EmptyState icon={Bell} title={t('notifications.emptyTitle')} body={t('notifications.emptyBody')} />
          ) : (
            <ul aria-live="polite" className="space-y-3">
              {notifications.data.map((n) => (
                <li key={n.id} className={n.readAt ? 'rounded-card border border-border bg-surface p-4' : 'rounded-card border border-secondary bg-mint p-4'}>
                  <p>
                    <NotificationText n={n} />
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <Freshness at={n.createdAt} />
                    {n.link && (
                      <Link to={n.link} className="font-medium text-primary">
                        {t('notifications.view')}
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : alerts.isPending ? (
          <CardSkeleton />
        ) : activeAlerts.length === 0 ? (
          <EmptyState icon={BellOff} title={t('alerts.emptyTitle')} body={t('alerts.emptyBody')} />
        ) : (
          <ul className="space-y-3">
            {activeAlerts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface p-4">
                <div>
                  <p className="font-semibold">{pick(catalog.data?.medicines.find((m) => m.id === a.medicineId))}</p>
                  <p className="text-meta text-ink-muted">
                    {a.governorate === 'all' ? t('gov.anywhere') : pick(governorateById(a.governorate))}
                  </p>
                </div>
                {a.active ? (
                  <Button
                    variant="danger"
                    size="sm"
                    loading={stop.isPending && stop.variables === a.id}
                    onClick={async () => {
                      await stop.mutateAsync(a.id);
                      toast(t('alerts.stopped'));
                    }}
                  >
                    {t('alerts.stop')}
                  </Button>
                ) : (
                  <span className="inline-flex items-center gap-1 text-meta text-ok-text">
                    <CheckCircle2 aria-hidden className="size-4 text-ok-icon" />
                    {t('alerts.met')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Tabs>
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <SignedInOnly>
      <Notifications />
    </SignedInOnly>
  );
}
