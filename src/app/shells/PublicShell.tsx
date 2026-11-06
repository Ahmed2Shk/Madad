import { Bell, ChevronDown, LayoutDashboard, UserRound } from 'lucide-react';
import { useState, ViewTransition } from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import { useTranslation } from 'react-i18next';
import { LanguageSwitch, OfflineBanner, Wordmark, buttonClass } from '../../components/ui';
import { useMe } from '../../data/portalQueries';
import { useNotifications, useSession } from '../../data/queries';
import { homeFor } from '../../lib/homeFor';
import { SignInPromptProvider } from '../../features/account/SignInPrompt';
import { cn } from '../../lib/cn';

const nav = [
  { to: '/', key: 'nav.search' },
  { to: '/pharmacies', key: 'nav.pharmacies' },
  { to: '/directory', key: 'nav.directory' },
  { to: '/for-organizations', key: 'nav.forOrganizations' },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn('flex min-h-11 items-center rounded-control px-3 font-medium hover:bg-mint', isActive ? 'bg-mint text-primary' : 'text-ink');

function AccountLinks({ onPick }: { onPick?: () => void }) {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const { data: notifications } = useNotifications();
  const { data: me } = useMe();
  const portal = me ? (me.platformRole ? '/admin' : me.memberships[0] ? homeFor(me) : null) : null;
  const unread = notifications?.filter((n) => !n.readAt).length ?? 0;
  if (!session)
    return (
      <NavLink to="/login" onClick={onPick} className={buttonClass('primary')}>
        {t('nav.login')}
      </NavLink>
    );
  return (
    <div className="flex items-center gap-1">
      {portal && (
        <Link to={portal} onClick={onPick} className={buttonClass('secondary')}>
          <LayoutDashboard aria-hidden className="size-4" />
          {t('nav.myPortal')}
        </Link>
      )}
      <Link
        to="/me/notifications"
        onClick={onPick}
        aria-label={unread ? t('nav.notificationsUnread', { count: unread }) : t('nav.notifications')}
        className="relative inline-flex size-11 items-center justify-center rounded-control text-primary hover:bg-mint"
      >
        <Bell aria-hidden className="size-5" />
        {unread > 0 && (
          <span aria-hidden className="absolute end-1.5 top-1.5 min-w-4 rounded-full bg-bad-text px-1 text-center text-micro leading-4 text-white">
            {unread}
          </span>
        )}
      </Link>
      <NavLink to="/me/favorites" onClick={onPick} className={linkClass}>
        {t('nav.favorites')}
      </NavLink>
      <NavLink to="/me" end onClick={onPick} className={linkClass}>
        <UserRound aria-hidden className="me-1.5 size-5" />
        {t('nav.account')}
      </NavLink>
    </div>
  );
}

/**
 * Fixed horizontal header on every patient page (SPEC §5, §7). Desktop first;
 * on narrow pages the nav collapses into a dropdown. No bottom tab bar.
 */
export function PublicShell() {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);

  return (
    <SignInPromptProvider>
      {/* @container lets a page band span the full width (P-01 hero) without 100vw scrollbar overflow. */}
      <div className="@container flex min-h-dvh flex-col">
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
                <AccountLinks />
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
            <nav id="public-menu" aria-label={t('nav.main')} className="space-y-2 border-t border-border px-4 py-2 lg:hidden">
              <ul className="space-y-1">
                {nav.map((n) => (
                  <li key={n.to}>
                    <NavLink to={n.to} end={n.to === '/'} onClick={close} className={linkClass}>
                      {t(n.key)}
                    </NavLink>
                  </li>
                ))}
              </ul>
              <AccountLinks onPick={close} />
            </nav>
          )}
        </header>

        <main id="main" className="mx-auto min-h-dvh w-full max-w-content flex-1 px-4 py-8">
          {/* Pages cross-fade when they change (React <ViewTransition>; off with reduced motion). */}
          <ViewTransition>
            <div>
              <Outlet />
            </div>
          </ViewTransition>
        </main>

        <footer className="border-t border-border bg-surface">
          <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-4 px-4 py-6 text-meta text-ink-muted">
            <span>{t('app.fullName')}</span>
            <nav aria-label={t('nav.footer')} className="flex flex-wrap gap-4">
              <Link to="/about" className="hover:text-primary">
                {t('info.about')}
              </Link>
              <Link to="/privacy" className="hover:text-primary">
                {t('info.privacy')}
              </Link>
              <Link to="/terms" className="hover:text-primary">
                {t('info.terms')}
              </Link>
              <Link to="/about#contact" className="hover:text-primary">
                {t('info.contact')}
              </Link>
            </nav>
          </div>
        </footer>
      </div>
    </SignInPromptProvider>
  );
}
