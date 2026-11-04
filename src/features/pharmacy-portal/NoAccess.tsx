import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { EmptyState, buttonClass } from '../../components/ui';
import type { Perm } from '../../data';
import { usePharmacyCtx } from './context';

/** "ليس لديك صلاحية" page (SPEC §11). */
export function NoAccess({ messageKey = 'portal.noAccess' }: { messageKey?: string }) {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={Lock}
      title={t(messageKey)}
      body={t('portal.noAccessBody')}
      actions={
        <Link to="/pharmacy-portal" className={buttonClass('secondary')}>
          {t('common.back')}
        </Link>
      }
    />
  );
}

/** Shows the page only with the permission; otherwise the no-access page. */
export function RequirePerm({ perm, ownerOnly, children }: { perm?: Perm; ownerOnly?: boolean; children: ReactNode }) {
  const { can, membership } = usePharmacyCtx();
  if (ownerOnly && membership.role !== 'owner') return <NoAccess messageKey="portal.ownerOnly" />;
  if (perm && !can(perm)) return <NoAccess />;
  return <>{children}</>;
}
