import { CircleAlert } from 'lucide-react';
import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/cn';

/**
 * Label + control + hint + error under the field (SPEC §11 "خطأ نموذج"). The control gets its id,
 * aria-invalid and aria-describedby wired automatically.
 */
export function Field({
  label,
  hint,
  error,
  optional,
  children,
  className,
}: {
  label: string;
  hint?: string;
  /** An i18n key under errors.* or a ready message. */
  error?: string;
  optional?: boolean;
  children: ReactElement<Record<string, unknown>>;
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  const id = useId();
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  const message = error ? (i18n.exists(`errors.${error}`) ? t(`errors.${error}`) : error) : undefined;
  const describedBy = [hint && hintId, message && errId].filter(Boolean).join(' ') || undefined;
  const control = isValidElement(children)
    ? cloneElement(children, { id, 'aria-invalid': message ? true : undefined, 'aria-describedby': describedBy })
    : children;
  return (
    <div className={cn('space-y-1', className)}>
      <label htmlFor={id} className="block font-medium">
        {label}
        {optional && <span className="ms-1 text-meta font-normal text-ink-muted">({t('common.optional')})</span>}
      </label>
      {control}
      {hint && (
        <p id={hintId} className="text-meta text-ink-muted">
          {hint}
        </p>
      )}
      {message && <FieldError id={errId}>{message}</FieldError>}
    </div>
  );
}

export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="flex items-center gap-1 text-meta text-bad-text">
      <CircleAlert aria-hidden className="size-4 shrink-0" />
      {children}
    </p>
  );
}
