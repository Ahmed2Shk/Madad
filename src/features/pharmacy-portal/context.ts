import { createContext, useContext } from 'react';
import type { Membership, Perm } from '../../data';

export interface PharmacyCtx {
  orgId: string;
  membership: Membership;
  /** UI hint only; the data layer enforces the same permission (SPEC §4). */
  can: (perm: Perm) => boolean;
}

export const PharmacyContext = createContext<PharmacyCtx | null>(null);

export function usePharmacyCtx(): PharmacyCtx {
  const ctx = useContext(PharmacyContext);
  if (!ctx) throw new Error('usePharmacyCtx needs the pharmacy portal shell');
  return ctx;
}
