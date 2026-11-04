import type { OrgType } from './types';

/** Documents per organization type (SPEC §7 A-05 step 3). The admin can change this list in AD-11. */
export const REQUIRED_DOCS_DEFAULT: Record<OrgType, string[]> = {
  pharmacy: ['practice_license', 'pharmacy_license', 'contact_id'],
  hospital: ['facility_license', 'contact_id'],
  medical_point: ['authorization_letter', 'contact_id'],
  humanitarian: ['registration_certificate', 'contact_id'],
};
