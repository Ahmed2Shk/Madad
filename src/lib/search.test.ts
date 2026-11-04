import { describe, expect, it } from 'vitest';
import { matchCatalog, searchTextOf, type Searchable } from './search';

const m = (id: string, nameAr: string, nameEn: string, genericName: string, extra: Partial<Searchable> = {}) => ({
  id,
  nameAr,
  nameEn,
  genericName,
  strength: '',
  aliases: [],
  barcode: null,
  ...extra,
});

const catalog: Searchable[] = [
  m('ins-asp', 'إنسولين نوفورابيد', 'NovoRapid', 'Insulin aspart', { strength: '100 وحدة/مل', barcode: '6250000000011' }),
  m('ins-gla', 'إنسولين لانتوس', 'Lantus', 'Insulin glargine'),
  m('para', 'باراسيتامول 500', 'Paracetamol 500', 'Paracetamol', { strength: '500 ملغ', strengthEn: '500 mg', aliases: ['بنادول', 'Panadol'] }),
  m('salb', 'سالبوتامول بخاخ', 'Salbutamol inhaler', 'Salbutamol'),
];

const ids = (q: string) => matchCatalog(catalog, q).map((x) => x.id);

describe('matchCatalog', () => {
  it('انسولين, إنسولين and insulin give the same result', () => {
    expect(ids('انسولين').sort()).toEqual(['ins-asp', 'ins-gla']);
    expect(ids('إنسولين').sort()).toEqual(['ins-asp', 'ins-gla']);
    expect(ids('insulin').sort()).toEqual(['ins-asp', 'ins-gla']);
    expect(ids('INSULIN').sort()).toEqual(['ins-asp', 'ins-gla']);
  });

  it('finds by alias', () => {
    expect(ids('بنادول')).toEqual(['para']);
    expect(ids('panadol')).toEqual(['para']);
  });

  it('handles digits glued to names', () => {
    expect(ids('باراسيتامول500')).toEqual(['para']);
    expect(ids('باراسيتامول ٥٠٠')).toEqual(['para']);
  });

  it('finds by English strength', () => {
    expect(ids('paracetamol 500 mg')).toEqual(['para']);
  });

  it('matches a barcode exactly', () => {
    expect(ids('6250000000011')).toEqual(['ins-asp']);
    expect(ids('6250000000099')).toEqual([]);
  });

  it('uses the phonetic fallback only when nothing else matches', () => {
    expect(ids('صالبوتامول')).toEqual(['salb']);
  });

  it('returns nothing for empty or unknown input', () => {
    expect(ids('   ')).toEqual([]);
    expect(ids('دواء غير موجود')).toEqual([]);
  });
});

describe('searchTextOf', () => {
  it('joins and normalizes every searchable field', () => {
    expect(searchTextOf(catalog[2]!)).toContain('بنادول');
    expect(searchTextOf(catalog[0]!)).toContain('6250000000011');
  });
});
