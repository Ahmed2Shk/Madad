// Governorates are a fixed reference list shipped with the app (SPEC §16).
import raw from './mock/seed/governorates.json';
import type { Governorate } from './types';

export const GOVERNORATES: Governorate[] = raw.map((g) => ({
  id: g.id,
  region: g.region as Governorate['region'],
  nameAr: g.name_ar,
  nameEn: g.name_en,
  center: g.center,
  areas: g.areas.map((a) => ({ id: a.id, nameAr: a.name_ar, nameEn: a.name_en })),
}));

const byId = new Map(GOVERNORATES.map((g) => [g.id, g]));
export const governorateById = (id: string) => byId.get(id);
