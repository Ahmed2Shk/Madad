import { describe, expect, it } from 'vitest';
import { profileCompleteness } from './completeness';
import type { OrgProfile } from '../data/types';

const full: OrgProfile = {
  id: 'ph',
  type: 'pharmacy',
  nameAr: 'صيدلية',
  nameEn: 'Pharmacy',
  licenseNo: 'L-1',
  governorate: 'gaza',
  area: 'center',
  addressText: 'غزة',
  landmark: 'قرب الدوار',
  locationPrecision: 'exact',
  exactLat: 31.5,
  exactLng: 34.4,
  phone: '059-000-0000',
  whatsapp: '059-000-0000',
  hours: { sat: [['08:00', '20:00']] },
  description: null,
  temporarilyClosed: null,
  verificationStatus: 'approved',
};

describe('profileCompleteness', () => {
  it('is 100% with everything filled', () => {
    expect(profileCompleteness(full)).toEqual({ percent: 100, missing: [] });
  });

  it('lists what is missing', () => {
    const r = profileCompleteness({ ...full, hours: {}, whatsapp: null });
    expect(r.missing).toEqual(['whatsapp', 'hours']);
    expect(r.percent).toBe(75);
  });

  it('needs a pin only when the precision is exact', () => {
    expect(profileCompleteness({ ...full, exactLat: null, exactLng: null }).missing).toEqual(['location']);
    expect(profileCompleteness({ ...full, exactLat: null, exactLng: null, locationPrecision: 'area' }).missing).toEqual([]);
  });
});
