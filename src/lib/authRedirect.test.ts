import { describe, expect, it } from 'vitest';
import { callbackUrl, readCallback, safeFrom } from './authRedirect';

describe('safeFrom', () => {
  it('keeps same-site paths only', () => {
    expect(safeFrom('/medicine/x?gov=gaza')).toBe('/medicine/x?gov=gaza');
    for (const bad of ['https://evil.test', '//evil.test', '/\\evil.test', 'medicine', null, 3]) expect(safeFrom(bad)).toBeNull();
  });

  it('never returns to the callback itself', () => {
    expect(safeFrom('/auth/callback?from=/')).toBeNull();
  });
});

describe('callbackUrl', () => {
  it('points at the callback page and keeps where the user came from', () => {
    expect(callbackUrl('https://madad.test', '/register/pharmacy')).toBe('https://madad.test/auth/callback?from=%2Fregister%2Fpharmacy');
    expect(callbackUrl('https://madad.test', 'https://evil.test')).toBe('https://madad.test/auth/callback');
    expect(callbackUrl('http://localhost:4174')).toBe('http://localhost:4174/auth/callback');
  });
});

describe('readCallback', () => {
  it('reads the return page and errors from the query or the hash', () => {
    expect(readCallback('?from=%2Fme&code=abc')).toEqual({ from: '/me', error: null });
    expect(readCallback('?error=access_denied&error_description=User+cancelled')).toEqual({ from: null, error: 'User cancelled' });
    expect(readCallback('', '#error=server_error')).toEqual({ from: null, error: 'server_error' });
  });
});
