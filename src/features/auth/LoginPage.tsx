// A-02 تسجيل الدخول الموحد — one form for patients, organizations and the MADAD team.
import { zodResolver } from '@hookform/resolvers/zod';
import { FlaskConical, LogIn } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Button, Field, FieldError, PasswordInput, inputClass } from '../../components/ui';
import { useSignIn } from '../../data/portalQueries';
import { env } from '../../lib/env';
import { homeFor } from '../../lib/homeFor';
import { AuthCard } from './AuthCard';

const schema = z.object({
  email: z.string().trim().email('email'),
  password: z.string().min(1, 'required'),
  remember: z.boolean(),
});
type Form = z.infer<typeof schema>;

// Demo accounts from src/data/mock/seed/users.json (mock mode only).
const DEMO_ACCOUNTS = ['patient', 'owner', 'staff', 'reviewer', 'admin'] as const;
const DEMO_PASSWORD = 'madad-demo-2026';

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? null;
  const signIn = useSignIn();
  const [failed, setFailed] = useState(false);
  const { register, handleSubmit, formState, setValue } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '', remember: true },
    shouldFocusError: true,
  });

  const onSubmit = handleSubmit(async (f) => {
    setFailed(false);
    const me = await signIn.mutateAsync({ email: f.email, password: f.password });
    if (!me) return setFailed(true);
    navigate(homeFor(me, from), { replace: true });
  });

  return (
    <AuthCard title={t('auth.loginTitle')} icon={LogIn}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {failed && (
          <div role="alert">
            <FieldError>{t('auth.badCredentials')}</FieldError>
          </div>
        )}
        <Field label={t('account.email')} error={formState.errors.email?.message}>
          <input type="email" autoComplete="email" dir="ltr" className={inputClass} {...register('email')} />
        </Field>
        <Field label={t('auth.password')} error={formState.errors.password?.message}>
          <PasswordInput autoComplete="current-password" {...register('password')} />
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" className="size-4 accent-primary" {...register('remember')} />
            {t('auth.remember')}
          </label>
          <Link to="/reset" className="text-primary hover:underline">
            {t('auth.forgot')}
          </Link>
        </div>
        <Button type="submit" block loading={signIn.isPending}>
          {t('nav.login')}
        </Button>
        <p className="text-center text-meta text-ink-muted">
          {t('auth.noAccount')}{' '}
          <Link to="/signup" state={location.state} className="font-medium text-primary hover:underline">
            {t('auth.signupLink')}
          </Link>
          {' · '}
          <Link to="/for-organizations" className="font-medium text-primary hover:underline">
            {t('nav.forOrganizations')}
          </Link>
        </p>
      </form>

      {env.demo && (
        <aside className="mt-6 space-y-2 rounded-card border border-warn-icon bg-warn-bg p-4 text-meta text-warn-text">
          <p className="flex items-center gap-2 font-semibold">
            <FlaskConical aria-hidden className="size-4 text-warn-icon" />
            {t('auth.demoAccounts')}
          </p>
          <p>
            {t('auth.demoPassword')} <bdi dir="ltr" className="font-semibold">{DEMO_PASSWORD}</bdi>
          </p>
          <ul className="flex flex-wrap gap-2">
            {DEMO_ACCOUNTS.map((a) => (
              <li key={a}>
                <button
                  type="button"
                  onClick={() => {
                    setValue('email', `${a}@madad.test`);
                    setValue('password', DEMO_PASSWORD);
                  }}
                  className="inline-flex min-h-10 items-center rounded-full border border-warn-icon bg-surface px-3 font-medium hover:bg-canvas"
                >
                  {t(`auth.demoRole.${a}`)}
                </button>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </AuthCard>
  );
}
