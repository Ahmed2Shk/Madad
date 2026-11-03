import { SearchX } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { EmptyState, buttonClass } from '../components/ui';

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={SearchX}
      title={t('notFound.title')}
      body={t('notFound.body')}
      actions={
        <Link to="/" className={buttonClass('primary')}>
          {t('notFound.home')}
        </Link>
      }
    />
  );
}
