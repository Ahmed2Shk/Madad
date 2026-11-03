import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function EmptyState({
  icon: Icon,
  title,
  body,
  actions,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-mint">
        <Icon aria-hidden className="size-7 text-secondary" />
      </span>
      <h2 className="text-section">{title}</h2>
      {body && <p className="max-w-md text-ink-muted">{body}</p>}
      {actions && <div className="mt-2 flex flex-wrap justify-center gap-3">{actions}</div>}
    </div>
  );
}
