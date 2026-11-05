import { describe, expect, it } from 'vitest';
import { announcementStateOf, programDisplayOf } from './programs';

const now = new Date('2026-11-05T12:00:00Z');
const ago = (days: number, minutes = 0) => new Date(now.getTime() - days * 86_400_000 - minutes * 60_000);

describe('programDisplayOf (phase 5 acceptance)', () => {
  it('an active program not confirmed for more than 7 days shows needs_update', () => {
    expect(programDisplayOf('active', ago(9), now)).toBe('needs_update');
    expect(programDisplayOf('active', ago(2), now)).toBe('active');
  });

  it('keeps the exact boundary: 7 days is still active, 7 days and a minute is not', () => {
    expect(programDisplayOf('active', ago(7), now)).toBe('active');
    expect(programDisplayOf('active', ago(7, 1), now)).toBe('needs_update');
    expect(programDisplayOf('active', null, now)).toBe('needs_update');
  });

  it('follows the admin setting (AD-11)', () => {
    expect(programDisplayOf('active', ago(9), now, 10)).toBe('active');
  });

  it('only active programs expire; a past end date means ended', () => {
    expect(programDisplayOf('paused', ago(60), now)).toBe('paused');
    expect(programDisplayOf('info', ago(60), now)).toBe('info');
    expect(programDisplayOf('active', ago(1), now, 7, '2026-11-04')).toBe('ended');
    expect(programDisplayOf('active', ago(1), now, 7, '2026-11-05')).toBe('active');
  });
});

describe('announcementStateOf', () => {
  it('covers draft, pending, rejected, scheduled, published and expired', () => {
    expect(announcementStateOf('draft', ago(1), null, now)).toBe('draft');
    expect(announcementStateOf('pending', ago(1), null, now)).toBe('pending');
    expect(announcementStateOf('rejected', ago(1), null, now)).toBe('rejected');
    expect(announcementStateOf('approved', new Date(now.getTime() + 3_600_000), null, now)).toBe('scheduled');
    expect(announcementStateOf('approved', ago(1), null, now)).toBe('published');
    expect(announcementStateOf('approved', ago(3), ago(1), now)).toBe('expired');
    expect(announcementStateOf('pending', ago(3), ago(1), now)).toBe('expired');
  });
});
