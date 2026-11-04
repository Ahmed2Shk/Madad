import { UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, CardSkeleton, EmptyState } from '../../components/ui';
import { useSession } from '../../data/queries';
import { useRequireSession } from './useRequireSession';

/** Account pages: content when signed in, otherwise a calm prompt to sign in. */
export function SignedInOnly({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const session = useSession();
  const requireSession = useRequireSession();
  if (session.isPending) return <CardSkeleton />;
  if (!session.data)
    return (
      <EmptyState
        icon={UserRound}
        title={t('auth.pageTitle')}
        body={t('auth.pageBody')}
        actions={<Button onClick={() => requireSession(() => undefined)}>{t('nav.login')}</Button>}
      />
    );
  return <>{children}</>;
}
