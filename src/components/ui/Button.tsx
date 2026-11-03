import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { LoaderCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/cn';
import { buttonClass, type ButtonSize, type ButtonVariant } from './buttonClass';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, block = false, className, children, disabled, ...rest },
  ref,
) {
  const { t } = useTranslation();
  return (
    <button
      ref={ref}
      type="button"
      className={cn(buttonClass(variant, size, block), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <LoaderCircle aria-hidden className="size-4 motion-safe:animate-spin" />}
      {loading && <span className="sr-only">{t('common.loading')}</span>}
      {children}
    </button>
  );
});
