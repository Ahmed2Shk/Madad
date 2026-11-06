import { CircleAlert, CircleCheck, CircleX } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Reported } from '../../lib/freshness';
import { cn } from '../../lib/cn';

const OPTIONS: { value: Reported; key: string; Icon: typeof CircleCheck; text: string; pill: string }[] = [
  { value: 'available', key: 'status.available', Icon: CircleCheck, text: 'text-ok-text', pill: 'bg-ok-bg border-ok-icon' },
  { value: 'limited', key: 'update.limitedShort', Icon: CircleAlert, text: 'text-warn-text', pill: 'bg-warn-bg border-warn-icon' },
  { value: 'unavailable', key: 'status.unavailable', Icon: CircleX, text: 'text-bad-text', pill: 'bg-bad-bg border-bad-icon' },
];

/**
 * Three grouped buttons: متوفر · محدود · غير متوفر (PH-02). The lit background slides to the chosen
 * option in its status color; it jumps into place on first render and only animates on a change.
 */
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
  const group = useRef<HTMLDivElement>(null);
  const buttons = useRef<Partial<Record<Reported, HTMLButtonElement | null>>>({});
  const [pill, setPill] = useState<{ start: number; width: number } | null>(null);
  const [animate, setAnimate] = useState(false);

  useLayoutEffect(() => {
    const box = group.current;
    if (!box) return;
    // Measured from the inline-start edge, so the same numbers work in Arabic (RTL) and English (LTR).
    const place = () => {
      const b = buttons.current[value];
      if (!b) return;
      const rtl = getComputedStyle(box).direction === 'rtl';
      const start = rtl ? box.clientWidth - b.offsetLeft - b.offsetWidth : b.offsetLeft;
      setPill({ start, width: b.offsetWidth });
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(box);
    return () => ro.disconnect();
  }, [value]);

  const current = OPTIONS.find((o) => o.value === value)!;
  return (
    <div
      ref={group}
      role="radiogroup"
      aria-label={label}
      className="relative inline-flex rounded-control border border-border bg-surface p-0.5"
    >
      {pill && (
        <span
          aria-hidden
          className={cn(
            'absolute inset-y-0.5 rounded-[8px] border',
            current.pill,
            animate && 'transition-[inset-inline-start,width,background-color,border-color] duration-300 ease-spring',
            disabled && 'opacity-50',
          )}
          style={{ insetInlineStart: pill.start, width: pill.width }}
        />
      )}
      {OPTIONS.map(({ value: v, key, Icon, text }) => (
        <button
          key={v}
          ref={(el) => {
            buttons.current[v] = el;
          }}
          type="button"
          role="radio"
          aria-checked={value === v}
          disabled={disabled}
          onClick={() => {
            setAnimate(true);
            onChange(v);
          }}
          className={cn(
            'relative inline-flex min-h-11 items-center gap-1.5 rounded-[8px] border border-transparent px-3 font-medium transition-colors duration-200 disabled:opacity-50',
            value === v ? text : 'text-ink-muted hover:bg-canvas/60',
            // Before the first measurement there is no sliding background yet: light the button itself.
            !pill && value === v && current.pill,
          )}
        >
          <Icon aria-hidden className="size-4" />
          {t(key)}
        </button>
      ))}
    </div>
  );
}
