import { describe, expect, it } from 'vitest';
import { csvToObjects, parseCsv, toCsv } from './csv';

describe('parseCsv', () => {
  it('handles quotes, commas inside quotes and CRLF', () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi"""\r\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
    ]);
  });

  it('skips blank lines', () => {
    expect(parseCsv('a\n\n\nb\n')).toEqual([['a'], ['b']]);
  });
});

describe('csvToObjects', () => {
  it('maps rows to header keys and strips a BOM', () => {
    expect(csvToObjects('\uFEFFname_ar,strength\nباراسيتامول,500 ملغ\n')).toEqual([{ name_ar: 'باراسيتامول', strength: '500 ملغ' }]);
  });
});

describe('toCsv', () => {
  it('escapes and round-trips', () => {
    const csv = toCsv(['a', 'b'], [['x, y', 'q"q'], [1, null]]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(parseCsv(csv.slice(1))).toEqual([
      ['a', 'b'],
      ['x, y', 'q"q'],
      ['1', ''],
    ]);
  });
});
