// Floating demo role switcher (SPEC §4): moves between the four interfaces without signing in,
// plus "إعادة ضبط بيانات العرض". Only loaded when VITE_DEMO=true; never part of a production build.
import { del } from 'idb-keyval';
import { RotateCcw, Users } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '../../components/ui';
import { useDemoReset, useDemoSwitch } from '../../data/adminQueries';
import { useMe } from '../../data/portalQueries';
import { cn } from '../../lib/cn';

// userId is the seed id; the email identifies the account in both modes (Supabase ids are UUIDs).
const ROLES: { key: string; userId: string | null; email: string | null; home: string }[] = [
  { key: 'visitor', userId: null, email: null, home: '/' },
  { key: 'patient', userId: 'u-patient', email: 'patient@madad.test', home: '/' },
  { key: 'owner', userId: 'u-ph-owner', email: 'owner@madad.test', home: '/pharmacy-portal' },
  { key: 'staff', userId: 'u-ph-staff', email: 'staff@madad.test', home: '/pharmacy-portal' },
  { key: 'provider', userId: 'u-org-owner', email: 'org@madad.test', home: '/provider' },
  { key: 'reviewer', userId: 'u-reviewer', email: 'reviewer@madad.test', home: '/admin' },
  { key: 'admin', userId: 'u-admin', email: 'admin@madad.test', home: '/admin' },
];

export default function RoleSwitcher() {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const switchTo = useDemoSwitch();
  const reset = useDemoReset();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const current = ROLES.find((r) => r.email === (me?.email ?? null))?.key;

  const pick = async (r: (typeof ROLES)[number]) => {
    await switchTo.mutateAsync(r.userId);
    // A full navigation: each interface mounts fresh, as it would after a real sign-in.
    window.location.assign(r.home);
  };

  const doReset = async () => {
    await reset.mutateAsync();
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith('madad.') && k !== 'madad.lang') localStorage.removeItem(k);
    } catch {
      // storage blocked: the in-memory store was reset anyway
    }
    await del('madad.query-cache').catch(() => undefined);
    window.location.assign('/');
  };

  return (
    <div className="fixed start-3 bottom-14 z-40 flex flex-col items-start gap-2">
      {open && (
        <div id="demo-roles" className="w-64 rounded-card border border-border bg-surface p-3 shadow-dialog">
          <p className="mb-2 text-micro font-medium text-ink-muted">{t('demo.switchTitle')}</p>
          <ul className="space-y-1">
            {ROLES.map((r) => (
              <li key={r.key}>
                <button
                  type="button"
                  aria-current={current === r.key ? 'true' : undefined}
                  disabled={switchTo.isPending}
                  onClick={() => void pick(r)}
                  className={cn('flex min-h-10 w-full items-center rounded-control px-3 text-start', current === r.key ? 'bg-mint font-semibold text-primary' : 'hover:bg-canvas')}
                >
                  {t(`demo.roles.${r.key}`)}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="mt-2 flex min-h-10 w-full items-center gap-2 rounded-control border border-border px-3 text-meta text-bad-text hover:bg-bad-bg"
          >
            <RotateCcw aria-hidden className="size-4" />
            {t('demo.reset')}
          </button>
        </div>
      )}
      <button
        type="button"
        aria-expanded={open}
        aria-controls="demo-roles"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-4 font-medium text-white shadow-dialog"
      >
        <Users aria-hidden className="size-4" />
        {current ? t(`demo.roles.${current}`) : t('demo.switch')}
      </button>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t('demo.resetTitle')}
        body={t('demo.resetBody')}
        confirmLabel={t('demo.resetConfirm')}
        loading={reset.isPending}
        onConfirm={() => void doReset()}
      />
    </div>
  );
}
