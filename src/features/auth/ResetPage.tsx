// A-04 استعادة كلمة المرور — same answer whether or not the email exists.
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, MailCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Button, Field, inputClass } from '../../components/ui';
import { useRequestReset } from '../../data/portalQueries';
import { env } from '../../lib/env';
import { AuthCard } from './AuthCard';

const schema = z.object({ email: z.string().trim().email('email') });

export default function ResetPage() {
  const { t } = useTranslation();
  const reset = useRequestReset();
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState } = useForm<{ email: string }>({ resolver: zodResolver(schema), defaultValues: { email: '' } });

  const onSubmit = handleSubmit(async (f) => {
    await reset.mutateAsync(f.email);
    setSent(true);
  });

  return (
    <AuthCard title={t('auth.resetTitle')} icon={KeyRound}>
      {sent ? (
        <div role="status" className="space-y-3">
          <p className="flex items-start gap-2">
            <MailCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-ok-icon" />
            {t('auth.resetSent')}
          </p>
          {env.demo && <p className="text-meta text-ink-muted">{t('auth.resetDemoNote')}</p>}
          <Link to="/login" className="font-medium text-primary hover:underline">
            {t('auth.backToLogin')}
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <p className="text-ink-muted">{t('auth.resetIntro')}</p>
          <Field label={t('account.email')} error={formState.errors.email?.message}>
            <input type="email" autoComplete="email" dir="ltr" className={inputClass} {...register('email')} />
          </Field>
          <Button type="submit" block loading={reset.isPending}>
            {t('auth.sendLink')}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
