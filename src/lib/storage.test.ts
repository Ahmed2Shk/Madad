import { afterEach, describe, expect, it, vi } from 'vitest';
import { readJson, safeStorage } from './storage';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('safeStorage', () => {
  it('reads and writes', () => {
    safeStorage.setItem('k', 'v');
    expect(safeStorage.getItem('k')).toBe('v');
  });

  it('swallows storage errors', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => safeStorage.setItem('k', 'v')).not.toThrow();
    expect(safeStorage.getItem('k')).toBeNull();
  });
});

describe('readJson', () => {
  it('parses stored JSON or returns the fallback', () => {
    safeStorage.setItem('j', '{"a":1}');
    expect(readJson('j', {})).toEqual({ a: 1 });
    safeStorage.setItem('bad', '{oops');
    expect(readJson('bad', 'fallback')).toBe('fallback');
    expect(readJson('missing', 3)).toBe(3);
  });
});
