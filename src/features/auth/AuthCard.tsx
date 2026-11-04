import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

/** Centered card shared by the sign-in, sign-up and reset screens. */
export function AuthCard({ title, icon: Icon, children, wide }: { title: string; icon: LucideIcon; children: ReactNode; wide?: boolean }) {
  return (
    <div className={cn('mx-auto w-full', wide ? 'max-w-3xl' : 'max-w-md')}>
      <section className="rounded-card border border-border bg-surface p-6 shadow-card">
        <span className="flex size-12 items-center justify-center rounded-control bg-mint">
          <Icon aria-hidden className="size-6 text-secondary" />
        </span>
        <h1 className="text-page mt-3 mb-5">{title}</h1>
        {children}
      </section>
    </div>
  );
}
