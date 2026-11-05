import { describe, expect, it } from 'vitest';
import { REQUIRED_DOCS_DEFAULT } from '../requiredDocs';
import { iso, toAvailability, toMembership, toPlatformSettings, toPublicPharmacy, toPublicSettings, toThread, type OrgDbRow } from './map';

const org: OrgDbRow = {
  id: 'a3f1c0de-0000-4000-8000-000000000001',
  type: 'pharmacy',
  name_ar: 'صيدلية',
  name_en: 'Pharmacy',
  governorate: 'gaza',
  area: 'center',
  address_text: 'غزة',
  landmark: null,
  location_precision: 'area',
  public_lat: 31.5,
  public_lng: 34.4,
  phone: '059',
  whatsapp: null,
  hours: {},
  description: null,
  verification_status: 'approved',
  suspended_reason: null,
  temporarily_closed: true,
  closed_reason: 'صيانة',
  info_updated_at: '2026-11-05T10:00:00.123456+00:00',
};

describe('supabase row mappers', () => {
  it('normalizes Postgres timestamps to the ISO form mock mode uses', () => {
    expect(iso('2026-11-05T10:00:00.123456+00:00')).toBe('2026-11-05T10:00:00.123Z');
    expect(iso(null)).toBeNull();
  });

  it('never exposes coordinates unless precision is exact', () => {
    const p = toPublicPharmacy(org, null);
    expect([p.publicLat, p.publicLng]).toEqual([null, null]);
    expect(p.temporarilyClosed).toEqual({ reason: 'صيانة' });
    expect(toPublicPharmacy({ ...org, location_precision: 'exact' }, null).publicLat).toBe(31.5);
  });

  it('reads numeric prices that PostgREST may send as strings', () => {
    const r = toAvailability({ pharmacy_id: 'p', medicine_id: 'm', reported_status: 'available', reported_at: '2026-11-05T10:00:00+00:00', price_ils: '9.50', price_updated_at: null });
    expect(r.priceIls).toBe(9.5);
    expect(r.priceUpdatedAt).toBeNull();
  });

  it('orders inquiry messages oldest first', () => {
    const t = toThread({
      id: 'q', org_id: 'o', medicine_id: null, subject: 's', status: 'new', patient_name: '', created_at: '2026-11-05T10:00:00Z', updated_at: '2026-11-05T11:00:00Z',
      inquiry_messages: [
        { sender_side: 'org', body: 'b', created_at: '2026-11-05T11:00:00Z' },
        { sender_side: 'patient', body: 'a', created_at: '2026-11-05T10:00:00Z' },
      ],
    });
    expect(t.messages.map((m) => m.body)).toEqual(['a', 'b']);
    expect(t.patientName).toBe('—');
  });

  it('accepts an embedded organization as an object or a one-item list', () => {
    const o = { type: 'pharmacy' as const, name_ar: 'ص', name_en: 'P', verification_status: 'pending' as const };
    const base = { org_id: 'o', member_role: 'owner' as const, perms: {} as never };
    expect(toMembership({ ...base, organizations: o })[0]?.verificationStatus).toBe('pending');
    expect(toMembership({ ...base, organizations: [o] })).toHaveLength(1);
    expect(toMembership({ ...base, organizations: null })).toEqual([]);
  });

  it('reads settings stored as JSON numbers or strings, with defaults', () => {
    const s = toPublicSettings([
      { key: 'fresh_hours', value: '36' },
      { key: 'expire_hours', value: 72 },
      { key: 'disclaimer_ar', value: null },
    ]);
    expect(s).toMatchObject({ freshHours: 36, expireHours: 72, priceMaxDays: 14, disclaimerAr: null, requiredDocs: REQUIRED_DOCS_DEFAULT });
    expect(toPlatformSettings([{ key: 'rejection_reasons', value: ['x'] }]).rejectionReasons).toEqual(['x']);
  });
});
