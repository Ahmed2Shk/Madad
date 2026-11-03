import { Hammer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../components/ui';

/** Placeholder for routes whose screens belong to later phases. */
export default function UnderConstruction() {
  const { t } = useTranslation();
  return <EmptyState icon={Hammer} title={t('common.underConstruction')} body={t('common.underConstructionHint')} />;
}
