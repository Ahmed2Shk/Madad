import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { useTranslation } from 'react-i18next';
import { LanguageSwitch, OfflineBanner, Wordmark, buttonClass } from '../../components/ui';
import { cn } from '../../lib/cn';

const nav = [
  { to: '/', key: 'nav.search' },
  { to: '/pharmacies', key: 'nav.pharmacies' },
  { to: '/directory', key: 'nav.directory' },
  { to: '/for-organizations', key: 'nav.forOrganizations' },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn('flex min-h-11 items-center rounded-control px-3 font-medium hover:bg-mint', isActive ? 'bg-mint text-primary' : 'text-ink');

/**
 * Fixed horizontal header on every patient page (SPEC §5, §7). Desktop first;
 * on narrow pages the nav collapses into a dropdown. No bottom tab bar.
 */
export function PublicShell() {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-50 focus:bg-surface focus:p-2"
      >
        {t('app.skipToContent')}
      </a>
      <OfflineBanner />
      <header className="sticky top-0 z-30 border-b border-border bg-surface">
        <div className="mx-auto flex h-16 max-w-content items-center gap-6 px-4">
          <Wordmark />
          <nav aria-label={t('nav.main')} className="hidden flex-1 items-center gap-1 lg:flex">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'} className={linkClass}>
                {t(n.key)}
              </NavLink>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-2">
            <LanguageSwitch />
            <div className="hidden lg:block">
              <NavLink to="/login" className={buttonClass('primary')}>
                {t('nav.login')}
              </NavLink>
            </div>
            <button
              type="button"
              aria-expanded={menuOpen}
              aria-controls="public-menu"
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-control border border-border px-3 font-medium lg:hidden"
            >
              {t('nav.menu')}
              <ChevronDown aria-hidden className={cn('size-5 transition-transform', menuOpen && 'rotate-180')} />
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav id="public-menu" aria-label={t('nav.main')} className="border-t border-border px-4 py-2 lg:hidden">
            <ul className="space-y-1">
              {[...nav, { to: '/login', key: 'nav.login' }].map((n) => (
                <li key={n.to}>
                  <NavLink to={n.to} end={n.to === '/'} onClick={close} className={linkClass}>
                    {t(n.key)}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>

      <main id="main" className="mx-auto w-full max-w-content flex-1 px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
