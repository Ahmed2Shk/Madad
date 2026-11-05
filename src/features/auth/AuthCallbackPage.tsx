// A-02 · العودة من الدخول بحساب Google. Supabase Auth exchanges the one-time code when the data layer
// loads; this page waits for the account, then sends it where a normal sign-in would (homeFor).
import { LoaderCircle, LogIn, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { buttonClass } from '../../components/ui';
import { useMe } from '../../data/portalQueries';
import { readCallback } from '../../lib/authRedirect';
import { homeFor } from '../../lib/homeFor';
import { AuthCard } from './AuthCard';

export default function AuthCallbackPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { from, error } = useMemo(() => readCallback(location.search, location.hash), [location.search, location.hash]);
  const me = useMe();

  useEffect(() => {
    if (!error && me.data) navigate(homeFor(me.data, from), { replace: true });
  }, [error, me.data, from, navigate]);

  const failed = !!error || me.isError || (me.isSuccess && !me.data);
  if (failed) {
    return (
      <AuthCard title={t('auth.callbackFailed')} icon={TriangleAlert}>
        <p role="alert" className="text-ink-muted">
          {typeof navigator !== 'undefined' && !navigator.onLine ? t('errors.network') : t('auth.callbackFailedBody')}
        </p>
        <Link to="/login" state={from ? { from } : undefined} className={`${buttonClass('primary', 'md', true)} mt-5`}>
          <LogIn aria-hidden className="size-4" />
          {t('nav.login')}
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t('auth.callbackTitle')} icon={LogIn}>
      <p role="status" className="flex items-center gap-2 text-ink-muted">
        <LoaderCircle aria-hidden className="size-5 text-secondary motion-safe:animate-spin" />
        {t('auth.callbackWait')}
      </p>
    </AuthCard>
  );
}
