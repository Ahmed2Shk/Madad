// Maps the compact public catalog file (public/catalog.json, generated from the seeds) to app types.
import type { Catalog, DosageForm } from './types';

interface RawMedicine {
  id: string;
  name_ar: string;
  name_en: string;
  generic_name: string;
  strength: string;
  dosage_form: string;
  pack_size: string;
  manufacturer: string | null;
  barcode: string | null;
  aliases: string[];
  category_id: string;
}

export interface RawCatalog {
  version: number;
  categories: { id: string; name_ar: string; name_en: string }[];
  medicines: RawMedicine[];
}

export function mapCatalog(raw: RawCatalog): Catalog {
  return {
    version: raw.version,
    categories: raw.categories.map((c) => ({ id: c.id, nameAr: c.name_ar, nameEn: c.name_en })),
    medicines: raw.medicines.map((m) => ({
      id: m.id,
      nameAr: m.name_ar,
      nameEn: m.name_en,
      genericName: m.generic_name,
      strength: m.strength,
      dosageForm: m.dosage_form as DosageForm,
      packSize: m.pack_size,
      manufacturer: m.manufacturer,
      barcode: m.barcode,
      aliases: m.aliases,
      categoryId: m.category_id,
    })),
  };
}

/** The offline catalog: precached by the service worker, refreshed daily by the query cache. */
export async function fetchCatalog(): Promise<Catalog> {
  const res = await fetch('/catalog.json');
  if (!res.ok) throw new Error(`catalog ${res.status}`);
  return mapCatalog((await res.json()) as RawCatalog);
}
