import { describe, expect, it } from 'vitest';
import { homeFor } from './homeFor';
import type { Me } from '../data/types';
import { DEFAULT_PERMS } from '../data/perms';

const base: Me = { userId: 'u', displayName: 'x', email: 'x@madad.test', phone: null, platformRole: null, memberships: [] };
const member = (orgType: 'pharmacy' | 'hospital'): Me => ({
  ...base,
  memberships: [{ orgId: 'o', orgType, orgNameAr: 'ا', orgNameEn: 'a', role: 'owner', perms: DEFAULT_PERMS.owner, verificationStatus: 'pending' }],
});

describe('homeFor', () => {
  it('sends admins to /admin', () => {
    expect(homeFor({ ...base, platformRole: 'reviewer' }, '/x')).toBe('/admin');
  });

  it('sends pharmacy members to their portal, others to the provider portal', () => {
    expect(homeFor(member('pharmacy'))).toBe('/pharmacy-portal');
    expect(homeFor(member('hospital'))).toBe('/provider');
  });

  it('sends patients back where they came from', () => {
    expect(homeFor(base, '/medicine/ors?gov=gaza')).toBe('/medicine/ors?gov=gaza');
    expect(homeFor(base)).toBe('/');
  });

  it('never redirects off-site', () => {
    expect(homeFor(base, '//evil.example')).toBe('/');
    expect(homeFor(base, 'https://evil.example')).toBe('/');
  });
});
