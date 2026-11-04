// Small-cell suppression for the unmet-demand map (SPEC §10 AD-06, docs/DECISIONS.md #3).
// A cell under the threshold is hidden. A row or column total is hidden too when it contains any
// hidden cell, because total − visible cells would reveal it (or the sum of the hidden ones).

export const MIN_CELL = 5;

export interface SuppressedMatrix {
  /** null = hidden. */
  cells: (number | null)[][];
  rowTotals: (number | null)[];
  colTotals: (number | null)[];
  /** Grand total of all searches: shown, it does not reveal any single cell. */
  total: number;
}

export function suppress(counts: number[][], min = MIN_CELL): SuppressedMatrix {
  const cells = counts.map((row) => row.map((v) => (v > 0 && v < min ? null : v)));
  const rowTotals = counts.map((row, i) => (cells[i]!.some((c) => c === null) ? null : row.reduce((a, b) => a + b, 0)));
  const cols = counts[0]?.length ?? 0;
  const colTotals = Array.from({ length: cols }, (_, j) =>
    cells.some((row) => row[j] === null) ? null : counts.reduce((a, row) => a + (row[j] ?? 0), 0),
  );
  const total = counts.flat().reduce((a, b) => a + b, 0);
  return { cells, rowTotals, colTotals, total };
}
