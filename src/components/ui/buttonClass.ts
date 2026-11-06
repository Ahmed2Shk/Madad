import { cn } from '../../lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'md' | 'sm';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover active:bg-primary-hover',
  secondary: 'border border-primary bg-surface text-primary hover:bg-mint active:bg-mint',
  danger: 'border border-bad-text bg-surface text-bad-text hover:bg-bad-bg active:bg-bad-bg',
  ghost: 'text-primary hover:bg-mint active:bg-mint',
};

/** Button look, shared with links styled as buttons. 'md' = 44px touch target, 'sm' = 38px for dense tables. */
export const buttonClass = (variant: ButtonVariant = 'primary', size: ButtonSize = 'md', block = false) =>
  cn(
    'press inline-flex items-center justify-center gap-2 rounded-control px-4 font-medium',
    'disabled:cursor-not-allowed disabled:opacity-50',
    size === 'md' ? 'min-h-11' : 'min-h-[38px] text-meta',
    block && 'w-full',
    variants[variant],
  );
