import { describe, expect, it } from 'vitest';
import { clearQueue, enqueue, queued } from './offlineQueue';
import type { KeyValueStore } from './searchLog';

const memory = (): KeyValueStore => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
};

describe('offline queue', () => {
  it('keeps the device time of each change', () => {
    const s = memory();
    enqueue(s, 'ph', [{ medicineId: 'a', status: 'available', clientUpdatedAt: '2026-11-04T08:00:00.000Z' }]);
    expect(queued(s, 'ph')).toEqual([{ medicineId: 'a', status: 'available', clientUpdatedAt: '2026-11-04T08:00:00.000Z' }]);
  });

  it('keeps only the latest edit per medicine', () => {
    const s = memory();
    enqueue(s, 'ph', [{ medicineId: 'a', status: 'available', clientUpdatedAt: '2026-11-04T08:00:00.000Z' }]);
    enqueue(s, 'ph', [{ medicineId: 'a', status: 'unavailable', clientUpdatedAt: '2026-11-04T09:00:00.000Z' }]);
    enqueue(s, 'ph', [{ medicineId: 'a', status: 'limited', clientUpdatedAt: '2026-11-04T07:00:00.000Z' }]); // older, ignored
    expect(queued(s, 'ph')).toEqual([{ medicineId: 'a', status: 'unavailable', clientUpdatedAt: '2026-11-04T09:00:00.000Z' }]);
  });

  it('keeps queues apart per pharmacy and clears one', () => {
    const s = memory();
    enqueue(s, 'ph1', [{ medicineId: 'a', status: 'available', clientUpdatedAt: '2026-11-04T08:00:00.000Z' }]);
    enqueue(s, 'ph2', [{ medicineId: 'b', status: 'available', clientUpdatedAt: '2026-11-04T08:00:00.000Z' }]);
    clearQueue(s, 'ph1');
    expect(queued(s, 'ph1')).toEqual([]);
    expect(queued(s, 'ph2')).toHaveLength(1);
  });

  it('survives unreadable storage', () => {
    const s = memory();
    s.setItem('madad.queue.ph', '{broken');
    expect(queued(s, 'ph')).toEqual([]);
  });
});
