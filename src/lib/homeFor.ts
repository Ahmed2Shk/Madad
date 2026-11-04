// Where an account lands after sign-in (SPEC §7 A-02): admin → /admin, organization member →
// its portal, patient → the page they came from.
import type { Me } from '../data/types';

export function homeFor(me: Me, from?: string | null): string {
  if (me.platformRole) return '/admin';
  const m = me.memberships[0];
  if (m) return m.orgType === 'pharmacy' ? '/pharmacy-portal' : '/provider';
  return from && from.startsWith('/') && !from.startsWith('//') ? from : '/';
}
