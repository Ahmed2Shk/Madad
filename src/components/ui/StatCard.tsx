import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { cn } from '../../lib/cn';

type Tone = 'neutral' | 'ok' | 'warn' | 'unknown' | 'review';

const tones: Record<Tone, { card: string; icon: string }> = {
  neutral: { card: 'border-border bg-surface', icon: 'bg-mint text-secondary' },
  ok: { card: 'border-border bg-surface', icon: 'bg-ok-bg text-ok-icon' },
  warn: { card: 'border-warn-icon bg-warn-bg', icon: 'bg-surface text-warn-icon' },
  unknown: { card: 'border-border bg-unknown-bg', icon: 'bg-surface text-unknown-icon' },
  review: { card: 'border-border bg-surface', icon: 'bg-review-bg text-review-icon' },
};

/** Number + label + optional change line (SPEC §5). A `to` makes the whole card a link. */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'neutral',
  note,
  to,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone?: Tone;
  note?: string;
  to?: string;
}) {
  const body = (
    <>
      <span className={cn('flex size-10 items-center justify-center rounded-control', tones[tone].icon)}>
        <Icon aria-hidden className="size-5" />
      </span>
      <span className="mt-3 block text-[28px] leading-tight font-semibold">
        <bdi>{value}</bdi>
      </span>
      <span className="block text-meta text-ink-muted">{label}</span>
      {note && <span className="mt-1 block text-micro text-ink-muted">{note}</span>}
    </>
  );
  const cls = cn('block rounded-card border p-4 shadow-card', tones[tone].card, to && 'hover:border-secondary');
  return to ? (
    <Link to={to} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
