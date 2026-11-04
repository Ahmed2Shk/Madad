import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter } from 'react-router';
import { PublicShell } from './shells/PublicShell';
import HomePage from '../features/search/HomePage';
import NotFound from './NotFound';
import UnderConstruction from './UnderConstruction';
import { CardSkeleton } from '../components/ui';
import { adminNav } from './shells/navs';

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
const LoginPage = lazy(() => import('../features/auth/LoginPage'));
const SignupPage = lazy(() => import('../features/auth/SignupPage'));
const ResetPage = lazy(() => import('../features/auth/ResetPage'));
const ForOrganizationsPage = lazy(() => import('../features/auth/ForOrganizationsPage'));
const RegisterPage = lazy(() => import('../features/auth/RegisterPage'));
const StatusPage = lazy(() => import('../features/auth/StatusPage'));
const PharmacyShell = lazy(() => import('./shells/PharmacyShell'));
const DashboardPage = lazy(() => import('../features/pharmacy-portal/DashboardPage'));
const QuickUpdatePage = lazy(() => import('../features/pharmacy-portal/QuickUpdatePage'));
const MedicinesPage = lazy(() => import('../features/pharmacy-portal/MedicinesPage'));
const AddMedicinePage = lazy(() => import('../features/pharmacy-portal/AddMedicinePage'));
const HistoryPage = lazy(() => import('../features/pharmacy-portal/HistoryPage'));
const InquiriesPage = lazy(() => import('../features/pharmacy-portal/InquiriesPage'));
const ProfilePage = lazy(() => import('../features/pharmacy-portal/ProfilePage'));
const TeamPage = lazy(() => import('../features/pharmacy-portal/TeamPage'));
const AdminShell = lazy(() => import('./shells/AdminShell'));

const page = (node: ReactNode) => <Suspense fallback={<CardSkeleton />}>{node}</Suspense>;

// Screens of later phases (P-07/P-08 and the provider portal arrive in phase 5).
const placeholders = ['directory', 'org/:id', 'provider'];

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
      { path: 'login', element: page(<LoginPage />) },
      { path: 'signup', element: page(<SignupPage />) },
      { path: 'reset', element: page(<ResetPage />) },
      { path: 'for-organizations', element: page(<ForOrganizationsPage />) },
      { path: 'register/status', element: page(<StatusPage />) },
      { path: 'register/:type', element: page(<RegisterPage />) },
      ...placeholders.map((path) => ({ path, element: <UnderConstruction /> })),
      { path: '*', element: <NotFound /> },
    ],
  },
  {
    path: '/pharmacy-portal',
    element: page(<PharmacyShell />),
    children: [
      { index: true, element: page(<DashboardPage />) },
      { path: 'update', element: page(<QuickUpdatePage />) },
      { path: 'medicines', element: page(<MedicinesPage />) },
      { path: 'medicines/add', element: page(<AddMedicinePage />) },
      { path: 'history', element: page(<HistoryPage />) },
      { path: 'inquiries', element: page(<InquiriesPage />) },
      { path: 'profile', element: page(<ProfilePage />) },
      { path: 'team', element: page(<TeamPage />) },
      // PH-09 and PH-10 arrive in phase 5 (docs/DECISIONS.md).
      { path: 'notifications', element: <UnderConstruction /> },
      { path: 'settings', element: <UnderConstruction /> },
    ],
  },
  {
    path: '/admin',
    element: page(<AdminShell />),
    children: [{ index: true, element: <UnderConstruction /> }, ...childPaths(adminNav, '/admin')],
  },
]);
