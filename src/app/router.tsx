import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter } from 'react-router';
import { PublicShell } from './shells/PublicShell';
import HomePage from '../features/search/HomePage';
import NotFound from './NotFound';
import UnderConstruction from './UnderConstruction';
import { CardSkeleton } from '../components/ui';
import { adminNav, pharmacyNav } from './shells/navs';

// Portals ship as separate lazy chunks so the public path stays small (SPEC §11).
const PharmacyShell = lazy(() => import('./shells/PharmacyShell'));
const AdminShell = lazy(() => import('./shells/AdminShell'));

const suspense = (node: ReactNode) => <Suspense fallback={<CardSkeleton />}>{node}</Suspense>;

const publicPlaceholders = [
  'search',
  'medicine/:id',
  'pharmacy/:id',
  'pharmacies',
  'directory',
  'org/:id',
  'me',
  'me/favorites',
  'me/notifications',
  'about',
  'privacy',
  'terms',
  'for-organizations',
  'login',
  'signup',
  'reset',
  'register/status',
  'register/:type',
];

const childPaths = (nav: { to: string }[], base: string) =>
  nav.filter((n) => n.to !== base).map((n) => ({ path: n.to.slice(base.length + 1), element: <UnderConstruction /> }));

export const router = createBrowserRouter([
  {
    element: <PublicShell />,
    children: [
      { index: true, element: <HomePage /> },
      ...publicPlaceholders.map((path) => ({ path, element: <UnderConstruction /> })),
      { path: '*', element: <NotFound /> },
    ],
  },
  {
    path: '/pharmacy-portal',
    element: suspense(<PharmacyShell />),
    children: [{ index: true, element: <UnderConstruction /> }, ...childPaths(pharmacyNav, '/pharmacy-portal')],
  },
  {
    path: '/admin',
    element: suspense(<AdminShell />),
    children: [{ index: true, element: <UnderConstruction /> }, ...childPaths(adminNav, '/admin')],
  },
]);
