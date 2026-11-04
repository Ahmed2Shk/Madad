import { Check } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface Chip {
  id: string;
  label: string;
  on: boolean;
  disabled?: boolean;
}

/** Toggle chips that wrap to a new line when the page is narrow (SPEC §5). */
export function FilterChips({ chips, onToggle, label }: { chips: Chip[]; onToggle: (id: string) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {chips.map((c) => (
        <button
          key={c.id}
          type="button"
          aria-pressed={c.on}
          disabled={c.disabled}
          onClick={() => onToggle(c.id)}
          className={cn(
            'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 font-medium transition-colors lg:min-h-10',
            'disabled:cursor-not-allowed disabled:opacity-50',
            c.on ? 'border-primary bg-mint text-primary' : 'border-border bg-surface text-ink hover:bg-canvas',
          )}
        >
          {c.on && <Check aria-hidden className="size-4" />}
          {c.label}
        </button>
      ))}
    </div>
  );
}
