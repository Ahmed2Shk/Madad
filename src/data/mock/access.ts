// What Postgres RLS will enforce in phase 4, mirrored for mock mode: who is signed in, and what they may do.
import type { Me, Membership, Perm } from '../types';
import { store, type MockState, type UserRow } from './store';

export class AccessError extends Error {
  constructor(public readonly code: 'not_signed_in' | 'forbidden') {
    super(code);
  }
}

export const LATENCY_MS = 120;
export const latency = <T>(value: T): Promise<T> => new Promise((r) => setTimeout(() => r(value), LATENCY_MS));

export function currentUser(s: MockState = store.get()): UserRow | null {
  return s.users.find((u) => u.id === s.sessionUserId) ?? null;
}

export function requireUser(): UserRow {
  const u = currentUser();
  if (!u) throw new AccessError('not_signed_in');
  return u;
}

/** has_org_perm(org_id, perm): the signed-in user is a member with that permission. */
export function hasOrgPerm(orgId: string, perm: Perm | 'member', s: MockState = store.get()): boolean {
  const m = currentUser(s)?.memberships.find((x) => x.orgId === orgId);
  if (!m) return false;
  return perm === 'member' || m.perms[perm] === true;
}

export function requireOrgPerm(orgId: string, perm: Perm | 'member') {
  requireUser();
  if (!hasOrgPerm(orgId, perm)) throw new AccessError('forbidden');
}

export function requireOwner(orgId: string) {
  const u = requireUser();
  if (u.memberships.find((m) => m.orgId === orgId)?.memberRole !== 'owner') throw new AccessError('forbidden');
}

export function toMe(u: UserRow, s: MockState = store.get()): Me {
  const memberships: Membership[] = u.memberships.flatMap((m) => {
    const o = s.orgs.find((x) => x.id === m.orgId);
    return o
      ? [{ orgId: o.id, orgType: o.type, orgNameAr: o.nameAr, orgNameEn: o.nameEn, role: m.memberRole, perms: m.perms, verificationStatus: o.verificationStatus }]
      : [];
  });
  return { userId: u.id, displayName: u.displayName, email: u.email, phone: u.phone, platformRole: u.platformRole, memberships };
}
