import { CircleAlert, CircleCheck, CircleHelp, CircleX, Clock, Hourglass, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Display } from '../../lib/freshness';
import { cn } from '../../lib/cn';

export type BadgeStatus = Display | 'pending_review';

/** Icon + text + color per SPEC §5. Color is never the only signal. */
const styles: Record<BadgeStatus, { Icon: LucideIcon; pill: string; icon: string }> = {
  available: { Icon: CircleCheck, pill: 'bg-ok-bg text-ok-text', icon: 'text-ok-icon' },
  limited: { Icon: CircleAlert, pill: 'bg-warn-bg text-warn-text', icon: 'text-warn-icon' },
  needs_update: { Icon: Clock, pill: 'bg-warn-bg text-warn-text', icon: 'text-warn-icon' },
  unavailable: { Icon: CircleX, pill: 'bg-bad-bg text-bad-text', icon: 'text-bad-icon' },
  unconfirmed: { Icon: CircleHelp, pill: 'bg-unknown-bg text-unknown-text', icon: 'text-unknown-icon' },
  pending_review: { Icon: Hourglass, pill: 'bg-review-bg text-review-text', icon: 'text-review-icon' },
};

export function StatusBadge({ status, className }: { status: BadgeStatus; className?: string }) {
  const { t } = useTranslation();
  const { Icon, pill, icon } = styles[status];
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-meta font-medium', pill, className)}
      data-status={status}
    >
      <Icon aria-hidden className={cn('size-4 shrink-0', icon)} />
      {t(`status.${status}`)}
    </span>
  );
}
