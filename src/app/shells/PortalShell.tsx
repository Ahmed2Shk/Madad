import { ChevronDown, type LucideIcon } from 'lucide-react';
import { useState, ViewTransition, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { LanguageSwitch, OfflineBanner, Wordmark } from '../../components/ui';
import { cn } from '../../lib/cn';

export interface PortalNavItem {
  to: string;
  key: string;
  Icon: LucideIcon;
}

/**
 * Sidebar + header + breadcrumb (SPEC §5 PortalShell). The sidebar sits on the
 * start side, so it is on the right in Arabic. Below lg it becomes a dropdown.
 */
export function PortalShell({
  titleKey,
  nav,
  headerExtra,
  account,
  banner,
  children,
}: {
  titleKey: string;
  nav: PortalNavItem[];
  /** Start side of the header: e.g. the pharmacy name and its status badge. */
  headerExtra?: ReactNode;
  /** End side of the header, next to the language switch. */
  account?: ReactNode;
  /** Shown above every page, e.g. "طلبك قيد المراجعة". */
  banner?: ReactNode;
  /** Defaults to the route outlet. */
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const current =
    [...nav].sort((a, b) => b.to.length - a.to.length).find((n) => pathname === n.to || pathname.startsWith(`${n.to}/`)) ??
    nav[0];

  const links = (onPick?: () => void) => (
    <ul className="space-y-1">
      {nav.map(({ to, key, Icon }) => (
        <li key={to}>
          <NavLink
            to={to}
            end
            onClick={onPick}
            className={({ isActive }) =>
              cn(
                'flex min-h-11 items-center gap-3 rounded-control px-3 font-medium',
                isActive ? 'bg-mint text-primary' : 'text-ink hover:bg-canvas',
              )
            }
          >
            <Icon aria-hidden className="size-5 shrink-0" />
            {t(key)}
          </NavLink>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-64 shrink-0 border-e border-border bg-surface lg:block">
        <div className="flex h-16 items-center px-5">
          <Wordmark />
        </div>
        <p className="px-5 pb-2 text-micro font-medium text-ink-muted">{t(titleKey)}</p>
        <nav aria-label={t('nav.main')} className="px-3">
          {links()}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <OfflineBanner />
        <header className="border-b border-border bg-surface">
          <div className="flex h-16 items-center gap-3 px-4 lg:px-6">
            <div className="lg:hidden">
              <Wordmark />
            </div>
            <div className="hidden min-w-0 flex-1 lg:block">{headerExtra}</div>
            <div className="ms-auto flex items-center gap-2">
              <LanguageSwitch />
              {account}
            </div>
          </div>
          <div className="border-t border-border px-4 py-2 lg:hidden">
            <button
              type="button"
              aria-expanded={menuOpen}
              aria-controls="portal-menu"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex min-h-11 w-full items-center justify-between rounded-control border border-border px-3 font-medium"
            >
              <span>{current ? t(current.key) : t('nav.menu')}</span>
              <ChevronDown aria-hidden className={cn('size-5 transition-transform', menuOpen && 'rotate-180')} />
            </button>
            {menuOpen && (
              <nav id="portal-menu" aria-label={t('nav.main')} className="pt-2">
                {links(() => setMenuOpen(false))}
              </nav>
            )}
          </div>
        </header>

        <nav aria-label={t('nav.breadcrumb')} className="px-4 pt-4 text-meta text-ink-muted lg:px-6">
          <ol className="flex items-center gap-2">
            <li>{t(titleKey)}</li>
            {current && (
              <>
                <li aria-hidden>/</li>
                <li aria-current="page" className="text-ink">
                  {t(current.key)}
                </li>
              </>
            )}
          </ol>
        </nav>

        {banner && <div className="px-4 pt-4 lg:px-6">{banner}</div>}

        <main id="main" className="w-full max-w-content flex-1 px-4 py-4 lg:px-6">
          <ViewTransition>
            <div>{children ?? <Outlet />}</div>
          </ViewTransition>
        </main>
      </div>
    </div>
  );
}
