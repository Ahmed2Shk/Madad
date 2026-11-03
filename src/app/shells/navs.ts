import {
  Activity,
  BookOpen,
  Building2,
  CirclePlus,
  Flag,
  History,
  LayoutDashboard,
  ListChecks,
  Map,
  MessageSquare,
  Pill,
  RefreshCw,
  ScrollText,
  Settings,
  ShieldCheck,
  Store,
  Users,
} from 'lucide-react';
import type { PortalNavItem } from './PortalShell';

const ph = '/pharmacy-portal';
const ad = '/admin';

/** SPEC §8 sidebar order. */
export const pharmacyNav: PortalNavItem[] = [
  { to: ph, key: 'portal.pharmacy.nav.dashboard', Icon: LayoutDashboard },
  { to: `${ph}/update`, key: 'portal.pharmacy.nav.update', Icon: RefreshCw },
  { to: `${ph}/medicines`, key: 'portal.pharmacy.nav.medicines', Icon: Pill },
  { to: `${ph}/medicines/add`, key: 'portal.pharmacy.nav.add', Icon: CirclePlus },
  { to: `${ph}/history`, key: 'portal.pharmacy.nav.history', Icon: History },
  { to: `${ph}/inquiries`, key: 'portal.pharmacy.nav.inquiries', Icon: MessageSquare },
  { to: `${ph}/profile`, key: 'portal.pharmacy.nav.profile', Icon: Store },
  { to: `${ph}/team`, key: 'portal.pharmacy.nav.team', Icon: Users },
  { to: `${ph}/settings`, key: 'portal.pharmacy.nav.settings', Icon: Settings },
];

/** SPEC §10 sidebar order. */
export const adminNav: PortalNavItem[] = [
  { to: ad, key: 'portal.admin.nav.overview', Icon: LayoutDashboard },
  { to: `${ad}/verification`, key: 'portal.admin.nav.verification', Icon: ShieldCheck },
  { to: `${ad}/organizations`, key: 'portal.admin.nav.organizations', Icon: Building2 },
  { to: `${ad}/catalog`, key: 'portal.admin.nav.catalog', Icon: BookOpen },
  { to: `${ad}/data-quality`, key: 'portal.admin.nav.dataQuality', Icon: Activity },
  { to: `${ad}/unmet-demand`, key: 'portal.admin.nav.unmetDemand', Icon: Map },
  { to: `${ad}/reports`, key: 'portal.admin.nav.reports', Icon: Flag },
  { to: `${ad}/moderation`, key: 'portal.admin.nav.moderation', Icon: ListChecks },
  { to: `${ad}/users`, key: 'portal.admin.nav.users', Icon: Users },
  { to: `${ad}/audit`, key: 'portal.admin.nav.audit', Icon: ScrollText },
  { to: `${ad}/settings`, key: 'portal.admin.nav.settings', Icon: Settings },
];
