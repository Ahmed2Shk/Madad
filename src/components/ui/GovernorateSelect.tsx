import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { GOVERNORATES, type GovFilter } from '../../data';
import { useLang } from '../../hooks/useLang';
import { cn } from '../../lib/cn';

export function GovernorateSelect({
  value,
  onChange,
  allowAll = true,
  className,
  hideLabel = false,
}: {
  value: GovFilter;
  onChange: (gov: GovFilter) => void;
  allowAll?: boolean;
  className?: string;
  hideLabel?: boolean;
}) {
  const { t } = useTranslation();
  const { pick } = useLang();
  const id = useId();
  const groups = [
    { key: 'gaza', label: t('gov.regionGaza') },
    { key: 'west_bank', label: t('gov.regionWestBank') },
  ] as const;
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={id} className={cn('text-meta font-medium', hideLabel && 'sr-only')}>
        {t('gov.label')}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 rounded-control border border-border bg-surface px-3 text-ink"
      >
        {allowAll && <option value="all">{t('gov.all')}</option>}
        {groups.map((g) => (
          <optgroup key={g.key} label={g.label}>
            {GOVERNORATES.filter((x) => x.region === g.key).map((x) => (
              <option key={x.id} value={x.id}>
                {pick(x)}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
