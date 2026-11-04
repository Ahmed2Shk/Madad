import { describe, expect, it } from 'vitest';
import { suppress } from './suppression';

describe('suppress', () => {
  it('hides cells under 5 but keeps zeros and larger counts', () => {
    expect(suppress([[0, 4, 5, 12]]).cells).toEqual([[0, null, 5, 12]]);
  });

  it('hides a row total that would reveal a hidden cell by subtraction', () => {
    const m = suppress([
      [10, 3],
      [8, 9],
    ]);
    expect(m.rowTotals).toEqual([null, 17]);
    expect(m.colTotals).toEqual([18, null]);
  });

  it('keeps every total when nothing is hidden', () => {
    const m = suppress([
      [5, 6],
      [7, 0],
    ]);
    expect(m.rowTotals).toEqual([11, 7]);
    expect(m.colTotals).toEqual([12, 6]);
    expect(m.total).toBe(18);
  });

  it('handles an empty matrix', () => {
    expect(suppress([])).toEqual({ cells: [], rowTotals: [], colTotals: [], total: 0 });
  });
});
