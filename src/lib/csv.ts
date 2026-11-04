// Minimal RFC 4180 CSV for the catalog import (AD-04) and the aggregated exports (AD-06, AD-10).

/** Parses CSV text into rows of cells: quoted fields, doubled quotes, CRLF or LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

/** First row = headers; returns one object per data row. */
export function csvToObjects(text: string): Record<string, string>[] {
  const [header, ...rest] = parseCsv(text.replace(/^\uFEFF/, ''));
  if (!header) return [];
  const keys = header.map((h) => h.trim());
  return rest.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

const esc = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV with a UTF-8 BOM so spreadsheet apps open Arabic correctly. */
export function toCsv(header: string[], rows: unknown[][]): string {
  return `\uFEFF${[header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n')}\r\n`;
}
