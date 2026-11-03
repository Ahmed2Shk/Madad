import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/cn';

export function LanguageSwitch({ className }: { className?: string }) {
  const { t, i18n } = useTranslation();
  const next = i18n.language === 'en' ? 'ar' : 'en';
  return (
    <button
      type="button"
      onClick={() => void i18n.changeLanguage(next)}
      lang={next}
      className={cn(
        'inline-flex min-h-11 items-center gap-1.5 rounded-control px-3 font-medium text-primary hover:bg-mint',
        className,
      )}
    >
      <Languages aria-hidden className="size-5" />
      {t('lang.short')}
      {/* Visible text stays in the accessible name (WCAG 2.5.3). */}
      <span className="sr-only"> · {t('lang.label')}</span>
    </button>
  );
}
