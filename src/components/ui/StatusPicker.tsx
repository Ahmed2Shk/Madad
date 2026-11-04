import { CircleAlert, CircleCheck, CircleX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Reported } from '../../lib/freshness';
import { cn } from '../../lib/cn';

const OPTIONS: { value: Reported; key: string; Icon: typeof CircleCheck; on: string }[] = [
  { value: 'available', key: 'status.available', Icon: CircleCheck, on: 'bg-ok-bg text-ok-text border-ok-icon' },
  { value: 'limited', key: 'update.limitedShort', Icon: CircleAlert, on: 'bg-warn-bg text-warn-text border-warn-icon' },
  { value: 'unavailable', key: 'status.unavailable', Icon: CircleX, on: 'bg-bad-bg text-bad-text border-bad-icon' },
];

/** Three grouped buttons: متوفر · محدود · غير متوفر, the current one lit in its status color (PH-02). */
export function StatusPicker({
  value,
  onChange,
  label,
  disabled,
}: {
  value: Reported;
  onChange: (v: Reported) => void;
  label: string;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-control border border-border bg-surface p-0.5">
      {OPTIONS.map(({ value: v, key, Icon, on }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          disabled={disabled}
          onClick={() => onChange(v)}
          className={cn(
            'inline-flex min-h-11 items-center gap-1.5 rounded-[8px] border px-3 font-medium transition-colors disabled:opacity-50',
            value === v ? on : 'border-transparent text-ink-muted hover:bg-canvas',
          )}
        >
          <Icon aria-hidden className="size-4" />
          {t(key)}
        </button>
      ))}
    </div>
  );
}
