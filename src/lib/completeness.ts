// Profile completeness for PH-07 ("80%: ينقص ساعات العمل").
import type { OrgProfile } from '../data/types';

const CHECKS: [string, (p: OrgProfile) => boolean][] = [
  ['name', (p) => p.nameAr.trim().length > 0],
  ['license', (p) => p.licenseNo.trim().length > 0],
  ['address', (p) => p.addressText.trim().length > 0],
  ['landmark', (p) => !!p.landmark?.trim()],
  ['phone', (p) => p.phone.trim().length > 0],
  ['whatsapp', (p) => !!p.whatsapp?.trim()],
  ['hours', (p) => Object.keys(p.hours).length > 0],
  ['location', (p) => p.locationPrecision !== 'exact' || (p.exactLat != null && p.exactLng != null)],
];

export function profileCompleteness(p: OrgProfile): { percent: number; missing: string[] } {
  const missing = CHECKS.filter(([, ok]) => !ok(p)).map(([k]) => k);
  return { percent: Math.round(((CHECKS.length - missing.length) / CHECKS.length) * 100), missing };
}
