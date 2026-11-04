import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadText } from './download';

afterEach(() => vi.restoreAllMocks());

describe('downloadText', () => {
  it('clicks a temporary link with the file name and frees the URL', () => {
    const create = vi.fn(() => 'blob:x');
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    downloadText('a.csv', 'x');
    expect(click).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledWith('blob:x');
    expect(document.querySelector('a[download]')).toBeNull();
  });
});
