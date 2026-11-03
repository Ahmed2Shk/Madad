import { describe, expect, it } from 'vitest';
import ar from './ar.json';
import en from './en.json';

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe('i18n resources', () => {
  it('ar and en define the same keys', () => {
    expect(keys(en).sort()).toEqual(keys(ar).sort());
  });

  it('no Arabic string uses Eastern Arabic digits', () => {
    const values = JSON.stringify(ar);
    expect(values).not.toMatch(/[٠-٩]/);
  });
});
