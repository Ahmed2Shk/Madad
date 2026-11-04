import { describe, expect, it } from 'vitest';
import { likelyDuplicates, similarity } from './similarity';

describe('similarity', () => {
  it('is 1 for identical text after normalization', () => {
    expect(similarity('إنسولين', 'انسولين')).toBe(1);
  });

  it('is high for the same medicine written differently', () => {
    expect(similarity('باراسيتامول 500 ملغ', 'باراسيتامول 500')).toBeGreaterThan(0.6);
    expect(similarity('Paracetamol500mg', 'Paracetamol 500')).toBeGreaterThan(0.5);
  });

  it('is low for different medicines', () => {
    expect(similarity('مونتيلوكاست 10', 'باراسيتامول 500')).toBeLessThan(0.2);
  });

  it('is 0 for empty input', () => {
    expect(similarity('', 'x')).toBe(0);
  });
});

describe('likelyDuplicates', () => {
  const catalog = [
    { id: 'para', names: ['باراسيتامول 500', 'Paracetamol 500', 'Paracetamol'] },
    { id: 'ibu', names: ['إيبوبروفين 400', 'Ibuprofen 400'] },
  ];

  it('finds the existing medicine for a near-duplicate request', () => {
    expect(likelyDuplicates(['باراسيتامول 500 ملغ', 'Paracetamol 500mg'], catalog)[0]?.id).toBe('para');
  });

  it('returns nothing for a new medicine', () => {
    expect(likelyDuplicates(['مونتيلوكاست 10', 'Montelukast 10'], catalog)).toEqual([]);
  });
});
