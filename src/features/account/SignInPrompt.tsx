// "Sign in to continue" for actions that need an account (P-09, favorites, alerts).
// Phase 1 has no login page yet (A-02 is phase 2); demo mode offers the seeded patient account.
import { UserRound } from 'lucide-react';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button, Dialog, buttonClass } from '../../components/ui';
import { useSession, useSignInDemo } from '../../data/queries';
import { env } from '../../lib/env';
import { RequireSessionContext, type RequireSession } from './useRequireSession';

export function SignInPromptProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const signIn = useSignInDemo();
  const location = useLocation();
  const [reason, setReason] = useState<string | null>(null);
  const pending = useRef<(() => void) | null>(null);

  const run = useCallback<RequireSession>(
    (action, reasonKey = 'auth.reasonGeneric') => {
      if (session) return action();
      pending.current = action;
      setReason(reasonKey);
    },
    [session],
  );

  const close = () => {
    pending.current = null;
    setReason(null);
  };

  const continueAsDemo = async () => {
    await signIn.mutateAsync();
    const action = pending.current;
    close();
    action?.(); // back to the same place, finishing what the user started
  };

  return (
    <RequireSessionContext.Provider value={run}>
      {children}
      <Dialog open={reason !== null} onClose={close} title={t('auth.promptTitle')} size="sm">
        <div className="space-y-4">
          <p className="flex items-start gap-3">
            <UserRound aria-hidden className="mt-0.5 size-5 shrink-0 text-secondary" />
            {reason && t(reason)}
          </p>
          <div className="flex flex-col gap-2">
            {env.demo && (
              <Button onClick={continueAsDemo} loading={signIn.isPending} block>
                {t('auth.continueDemo')}
              </Button>
            )}
            <Link
              to="/login"
              state={{ from: location.pathname + location.search }}
              onClick={close}
              className={buttonClass(env.demo ? 'secondary' : 'primary', 'md', true)}
            >
              {t('nav.login')}
            </Link>
          </div>
        </div>
      </Dialog>
    </RequireSessionContext.Provider>
  );
}
