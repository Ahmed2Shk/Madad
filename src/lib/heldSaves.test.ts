import { describe, expect, it } from 'vitest';
import type { StockChange } from '../data/types';
import { HOLD_MS, heldSaves, holdSave, takeHeld } from './heldSaves';

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};
const change = (medicineId: string, at: string): StockChange => ({ medicineId, status: 'available', clientUpdatedAt: at });

describe('held saves (PH-02 undo)', () => {
  it('keeps a save with its send time and the device time of each change', () => {
    const s = memory();
    const h = holdSave(s, 'org', [change('m1', '2026-11-06T10:00:00.000Z')], 1_000);
    expect(h.sendAt).toBe(1_000 + HOLD_MS);
    expect(heldSaves(s, 'org')).toEqual([h]);
    expect(heldSaves(s, 'org')[0]!.changes[0]!.clientUpdatedAt).toBe('2026-11-06T10:00:00.000Z');
  });

  it('gives a held save out once: a second take (sent, or undone) gets nothing', () => {
    const s = memory();
    const h = holdSave(s, 'org', [change('m1', '2026-11-06T10:00:00.000Z')], 1_000);
    expect(takeHeld(s, 'org', h.id)).toHaveLength(1);
    expect(takeHeld(s, 'org', h.id)).toBeNull();
    expect(heldSaves(s, 'org')).toEqual([]);
  });

  it('keeps separate saves apart and per pharmacy', () => {
    const s = memory();
    const a = holdSave(s, 'org', [change('m1', '2026-11-06T10:00:00.000Z')], 1_000);
    const b = holdSave(s, 'org', [change('m2', '2026-11-06T10:00:02.000Z')], 3_000);
    holdSave(s, 'other', [change('m3', '2026-11-06T10:00:03.000Z')], 3_000);
    expect(takeHeld(s, 'org', a.id)?.[0]?.medicineId).toBe('m1');
    expect(heldSaves(s, 'org').map((h) => h.id)).toEqual([b.id]);
    expect(heldSaves(s, 'other')).toHaveLength(1);
  });

  it('survives broken storage content', () => {
    const s = memory();
    s.setItem('madad.held.org', 'not json');
    expect(heldSaves(s, 'org')).toEqual([]);
    expect(takeHeld(s, 'org', 'x')).toBeNull();
  });
});
