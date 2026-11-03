// Availability × freshness model — SPEC §3.
// Phase 0 ships the types only; freshnessOf() and displayOf() land in phase 1 with their tests.

export type Reported = 'available' | 'limited' | 'unavailable';
export type Freshness = 'fresh' | 'stale' | 'expired';
export type Display = 'available' | 'limited' | 'needs_update' | 'unconfirmed' | 'unavailable';
