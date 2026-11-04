// Default team permissions per role (SPEC §4 table). Owners can tick boxes per member afterwards.
import { PERMS, type MemberRole, type Perm, type Perms } from './types';

const make = (on: Perm[]): Perms => Object.fromEntries(PERMS.map((p) => [p, on.includes(p)])) as Perms;

export const DEFAULT_PERMS: Record<MemberRole, Perms> = {
  owner: make([...PERMS]),
  manager: make(['availability', 'prices', 'medicines', 'publish', 'inquiries', 'profile', 'reports']),
  staff: make(['availability', 'inquiries', 'reports']),
  viewer: make(['reports']),
};
