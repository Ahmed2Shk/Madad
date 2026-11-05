// A-03 إنشاء حساب مريض — name, email, password; mobile optional; no medical fields.
import { zodResolver } from '@hookform/resolvers/zod';
import { UserPlus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Button, Field, FieldError, PasswordInput, inputClass } from '../../components/ui';
import { useSignUp } from '../../data/portalQueries';
import { homeFor } from '../../lib/homeFor';
import { AuthCard } from './AuthCard';
import { GoogleSignIn } from './GoogleSignIn';

const schema = z
  .object({
    displayName: z.string().trim().min(2, 'required').max(60, 'tooLong'),
    email: z.string().trim().email('email'),
    password: z.string().min(8, 'passwordShort'),
    confirm: z.string(),
    phone: z
      .string()
      .trim()
      .refine((v) => v === '' || /^[+\d][\d\s-]{6,16}$/.test(v), 'phone'),
    terms: z.literal(true, { message: 'terms' }),
  })
  .refine((f) => f.password === f.confirm, { path: ['confirm'], message: 'passwordMismatch' });
type Form = z.input<typeof schema>;

export default function SignupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? null;
  const signUp = useSignUp();
  const { register, handleSubmit, formState, setError } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { displayName: '', email: '', password: '', confirm: '', phone: '', terms: false as unknown as true },
    shouldFocusError: true,
  });
  const err = (k: keyof Form) => formState.errors[k]?.message;

  const onSubmit = handleSubmit(async (f) => {
    const res = await signUp.mutateAsync({ displayName: f.displayName, email: f.email, password: f.password, phone: f.phone || null });
    if (!res.ok) return setError('email', { message: 'emailTaken' }, { shouldFocus: true });
    navigate(homeFor(res.me, from), { replace: true });
  });

  return (
    <AuthCard title={t('auth.signupTitle')} icon={UserPlus}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label={t('account.name')} error={err('displayName')}>
          <input autoComplete="name" className={inputClass} {...register('displayName')} />
        </Field>
        <Field label={t('account.email')} error={err('email')}>
          <input type="email" autoComplete="email" dir="ltr" className={inputClass} {...register('email')} />
        </Field>
        <Field label={t('auth.password')} hint={t('auth.passwordHint')} error={err('password')}>
          <PasswordInput autoComplete="new-password" {...register('password')} />
        </Field>
        <Field label={t('auth.confirmPassword')} error={err('confirm')}>
          <PasswordInput autoComplete="new-password" {...register('confirm')} />
        </Field>
        <Field label={t('account.phone')} optional hint={t('auth.phoneHint')} error={err('phone')}>
          <input type="tel" autoComplete="tel" dir="ltr" className={inputClass} {...register('phone')} />
        </Field>
        <div>
          <label className="flex min-h-11 items-start gap-2">
            <input type="checkbox" className="mt-1 size-4 accent-primary" aria-invalid={!!err('terms')} {...register('terms')} />
            <span>
              {t('auth.agreePrefix')}{' '}
              <Link to="/terms" className="text-primary hover:underline">
                {t('info.terms')}
              </Link>{' '}
              {t('auth.agreeAnd')}{' '}
              <Link to="/privacy" className="text-primary hover:underline">
                {t('info.privacy')}
              </Link>
            </span>
          </label>
          {err('terms') && <FieldError>{t('errors.terms')}</FieldError>}
        </div>
        <Button type="submit" block loading={signUp.isPending}>
          {t('auth.createAccount')}
        </Button>
        <p className="text-center text-meta text-ink-muted">
          {t('auth.haveAccount')}{' '}
          <Link to="/login" state={location.state} className="font-medium text-primary hover:underline">
            {t('nav.login')}
          </Link>
        </p>
      </form>
      <GoogleSignIn from={from} />
    </AuthCard>
  );
}
