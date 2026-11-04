// The catalog as mock mode serves it: the shipped file plus what the MADAD team added or
// re-aliased in AD-04. Postgres keeps this in the medicines table (SPEC §13).
import { mapCatalog, type RawCatalog } from '../catalog';
import { store } from './store';
import medicinesSeed from './seed/medicines.json';
import categoriesSeed from './seed/categories.json';

const shipped = { version: 1, categories: categoriesSeed, medicines: medicinesSeed } as RawCatalog;

export function currentCatalog(base: RawCatalog = shipped) {
  const { catalogAdditions, aliasOverrides } = store.get();
  return mapCatalog({
    ...base,
    medicines: [...base.medicines, ...catalogAdditions].map((m) => (aliasOverrides[m.id] ? { ...m, aliases: aliasOverrides[m.id]! } : m)),
  });
}
