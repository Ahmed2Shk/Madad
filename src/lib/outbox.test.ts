import { describe, expect, it } from 'vitest';
import { addToOutbox, flushOutbox, OUTBOX_MAX, outboxItems } from './outbox';

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe('outbox', () => {
  it('keeps items with the device time, in order', () => {
    const s = memory();
    addToOutbox(s, 'inq', { n: 1 }, new Date('2026-11-05T10:00:00Z'));
    addToOutbox(s, 'inq', { n: 2 }, new Date('2026-11-05T10:05:00Z'));
    expect(outboxItems<{ n: number }>(s, 'inq').map((x) => [x.payload.n, x.at])).toEqual([
      [1, '2026-11-05T10:00:00.000Z'],
      [2, '2026-11-05T10:05:00.000Z'],
    ]);
  });

  it('refuses more than OUTBOX_MAX items', () => {
    const s = memory();
    for (let i = 0; i < OUTBOX_MAX; i++) expect(addToOutbox(s, 'inq', i)).toBe(true);
    expect(addToOutbox(s, 'inq', 'one too many')).toBe(false);
  });

  it('removes what was sent and keeps the rest after a failure', async () => {
    const s = memory();
    for (const n of [1, 2, 3]) addToOutbox(s, 'inq', n);
    const sent = await flushOutbox<number>(s, 'inq', async (n) => {
      if (n === 2) throw new Error('offline again');
    });
    expect(sent).toBe(1);
    expect(outboxItems<number>(s, 'inq').map((x) => x.payload)).toEqual([2, 3]);
  });

  it('survives broken storage content', () => {
    const s = memory();
    s.setItem('madad.outbox.inq', 'not json');
    expect(outboxItems(s, 'inq')).toEqual([]);
  });
});
