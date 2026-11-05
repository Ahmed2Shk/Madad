// PH-10 الإعدادات — change password, active sessions, notification choices, and the hour of the daily
// reminder to update availability (shown in the portal at that hour; there is no push or SMS).
import { KeyRound, LogOut, Monitor } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, CardSkeleton, Field, PasswordInput, useToast } from '../../components/ui';
import { DEFAULT_PREFS, type NotificationPrefs } from '../../data';
import { useChangePassword, usePrefs, useSignOutOthers, useUpdatePrefs } from '../../data/providerQueries';

const SWITCHES: (keyof Omit<NotificationPrefs, 'reminderHour'>)[] = ['inquiries', 'verification', 'catalog', 'platform'];

export default function PharmacySettingsPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const prefs = usePrefs();
  const update = useUpdatePrefs();
  const change = useChangePassword();
  const others = useSignOutOthers();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [tried, setTried] = useState(false);
  const p = prefs.data ?? DEFAULT_PREFS;
  const pwError = pw.length < 8 ? 'passwordShort' : pw !== pw2 ? 'passwordMismatch' : undefined;

  const savePrefs = async (patch: Partial<NotificationPrefs>) => {
    await update.mutateAsync(patch);
    toast(t('phSettings.saved'));
  };

  if (prefs.isPending) return <CardSkeleton />;

  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-page">{t('portal.pharmacy.nav.settings')}</h1>

      <section className="space-y-4 rounded-card border border-border bg-surface p-5">
        <h2 className="text-section flex items-center gap-2">
          <KeyRound aria-hidden className="size-5 text-secondary" />
          {t('phSettings.password')}
        </h2>
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setTried(true);
            if (pwError) return;
            await change.mutateAsync(pw);
            setPw('');
            setPw2('');
            setTried(false);
            toast(t('phSettings.passwordChanged'));
          }}
        >
          <Field label={t('phSettings.newPassword')} hint={t('auth.passwordHint')} error={tried && pw.length < 8 ? 'passwordShort' : undefined}>
            <PasswordInput autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          </Field>
          <Field label={t('auth.confirmPassword')} error={tried && pwError === 'passwordMismatch' ? 'passwordMismatch' : undefined}>
            <PasswordInput autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </Field>
          <div className="md:col-span-2">
            <Button type="submit" loading={change.isPending}>
              {t('phSettings.changePassword')}
            </Button>
          </div>
        </form>
      </section>

      <section className="space-y-3 rounded-card border border-border bg-surface p-5">
        <h2 className="text-section flex items-center gap-2">
          <Monitor aria-hidden className="size-5 text-secondary" />
          {t('phSettings.sessions')}
        </h2>
        <p className="text-meta">{t('phSettings.thisDevice')}</p>
        <Button
          variant="secondary"
          loading={others.isPending}
          onClick={async () => {
            await others.mutateAsync();
            toast(t('phSettings.othersSignedOut'));
          }}
        >
          <LogOut aria-hidden className="size-4" />
          {t('phSettings.signOutOthers')}
        </Button>
      </section>

      <section className="space-y-3 rounded-card border border-border bg-surface p-5">
        <h2 className="text-section">{t('phSettings.notifications')}</h2>
        <ul className="space-y-1">
          {SWITCHES.map((k) => (
            <li key={k}>
              <label className="flex min-h-11 items-center gap-3">
                <input type="checkbox" className="size-4 accent-primary" checked={p[k]} disabled={update.isPending} onChange={(e) => void savePrefs({ [k]: e.target.checked })} />
                {t(`phSettings.pref.${k}`)}
              </label>
            </li>
          ))}
        </ul>
        <p className="text-micro text-ink-muted">{t('phSettings.freshnessAlways')}</p>
      </section>

      <section className="space-y-3 rounded-card border border-border bg-surface p-5">
        <h2 className="text-section">{t('phSettings.reminder')}</h2>
        <Field label={t('phSettings.reminderHour')} hint={t('phSettings.reminderHint')}>
          <select
            value={p.reminderHour ?? ''}
            disabled={update.isPending}
            onChange={(e) => void savePrefs({ reminderHour: e.target.value === '' ? null : Number(e.target.value) })}
            className="min-h-11 w-full rounded-control border border-border bg-surface px-3 md:w-60"
          >
            <option value="">{t('phSettings.noReminder')}</option>
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {`${String(h).padStart(2, '0')}:00`}
              </option>
            ))}
          </select>
        </Field>
      </section>
    </div>
  );
}
