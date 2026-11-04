import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { EmptyState, buttonClass } from '../../components/ui';
import { useAdminCtx } from './context';

/** Settings, users and the audit log are for the system admin only (SPEC §4). */
export function RequireSuperAdmin({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { role } = useAdminCtx();
  if (role !== 'super_admin')
    return (
      <EmptyState
        icon={Lock}
        title={t('admin.superOnly')}
        body={t('portal.noAccessBody')}
        actions={
          <Link to="/admin" className={buttonClass('secondary')}>
            {t('common.back')}
          </Link>
        }
      />
    );
  return <>{children}</>;
}
