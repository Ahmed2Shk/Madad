import { cn } from '../../lib/cn';

/** Gray placeholder shaped like the content; no central spinners (SPEC §11). */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('rounded-control bg-unknown-bg motion-safe:animate-pulse', className)} />;
}

export function CardSkeleton() {
  return (
    <div className="space-y-3 rounded-card border border-border bg-surface p-4 shadow-card">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-6 w-24 rounded-full" />
    </div>
  );
}
