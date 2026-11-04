import { Eye, EyeOff } from 'lucide-react';
import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { inputClass } from './formStyles';

/** Password input with a show/hide button; extra props (id, aria-*) land on the input, so <Field> wires it. */
export const PasswordInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function PasswordInput(props, ref) {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input ref={ref} type={show ? 'text' : 'password'} dir="ltr" className={`${inputClass} pe-12`} {...props} />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? t('auth.hidePassword') : t('auth.showPassword')}
        aria-pressed={show}
        className="absolute end-1 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-control text-ink-muted hover:bg-canvas"
      >
        {show ? <EyeOff aria-hidden className="size-5" /> : <Eye aria-hidden className="size-5" />}
      </button>
    </div>
  );
});
