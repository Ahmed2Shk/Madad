import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter } from 'react-router';
import { PublicShell } from './shells/PublicShell';
import HomePage from '../features/search/HomePage';
import NotFound from './NotFound';
import UnderConstruction from './UnderConstruction';
import { CardSkeleton } from '../components/ui';
import { adminNav, pharmacyNav } from './shells/navs';

// Every page but the home page is its own chunk, and the portals load separately,
// so the public path stays under budget (SPEC §11).
const SearchPage = lazy(() => import('../features/search/SearchPage'));
const MedicinePage = lazy(() => import('../features/medicine/MedicinePage'));
const PharmacyPage = lazy(() => import('../features/pharmacy-public/PharmacyPage'));
const PharmaciesPage = lazy(() => import('../features/pharmacy-public/PharmaciesPage'));
const FavoritesPage = lazy(() => import('../features/account/FavoritesPage'));
const NotificationsPage = lazy(() => import('../features/account/NotificationsPage'));
const AccountPage = lazy(() => import('../features/account/AccountPage'));
const InfoPage = lazy(() => import('../features/info/InfoPage'));
const PharmacyShell = lazy(() => import('./shells/PharmacyShell'));
const AdminShell = lazy(() => import('./shells/AdminShell'));

const page = (node: ReactNode) => <Suspense fallback={<CardSkeleton />}>{node}</Suspense>;

// Screens of later phases (A-01..A-06 arrive in phase 2, P-07/P-08 in phase 5).
const placeholders = ['directory', 'org/:id', 'for-organizations', 'login', 'signup', 'reset', 'register/status', 'register/:type'];

const childPaths = (nav: { to: string }[], base: string) =>
  nav.filter((n) => n.to !== base).map((n) => ({ path: n.to.slice(base.length + 1), element: <UnderConstruction /> }));

export const router = createBrowserRouter([
  {
    element: <PublicShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'search', element: page(<SearchPage />) },
      { path: 'medicine/:id', element: page(<MedicinePage />) },
      { path: 'pharmacy/:id', element: page(<PharmacyPage />) },
      { path: 'pharmacies', element: page(<PharmaciesPage />) },
      { path: 'me', element: page(<AccountPage />) },
      { path: 'me/favorites', element: page(<FavoritesPage />) },
      { path: 'me/notifications', element: page(<NotificationsPage />) },
      { path: 'about', element: page(<InfoPage page="about" />) },
      { path: 'privacy', element: page(<InfoPage page="privacy" />) },
      { path: 'terms', element: page(<InfoPage page="terms" />) },
      ...placeholders.map((path) => ({ path, element: <UnderConstruction /> })),
      { path: '*', element: <NotFound /> },
    ],
  },
  {
    path: '/pharmacy-portal',
    element: page(<PharmacyShell />),
    children: [{ index: true, element: <UnderConstruction /> }, ...childPaths(pharmacyNav, '/pharmacy-portal')],
  },
  {
    path: '/admin',
    element: page(<AdminShell />),
    children: [{ index: true, element: <UnderConstruction /> }, ...childPaths(adminNav, '/admin')],
  },
]);
