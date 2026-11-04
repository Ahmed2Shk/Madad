// Demo-mode helpers behind the floating role switcher (SPEC §4). Refused outside VITE_DEMO=true.
import { env } from '../../lib/env';
import type { DemoRepo } from '../types';
import { AccessError, latency, toMe } from './access';
import { store } from './store';

export const demoRepo: DemoRepo = {
  signInAs(userId) {
    if (!env.demo) throw new AccessError('forbidden');
    const u = userId ? store.get().users.find((x) => x.id === userId) : null;
    store.mutate((s) => {
      s.sessionUserId = u?.id ?? null;
    });
    return latency(u ? toMe(u) : null);
  },
  reset() {
    if (!env.demo) throw new AccessError('forbidden');
    store.reset();
    return latency(undefined);
  },
};
