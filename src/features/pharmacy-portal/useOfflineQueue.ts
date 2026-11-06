import { useCallback, useEffect, useRef, useState } from 'react';
import type { StockChange } from '../../data';
import { useSaveStock } from '../../data/portalQueries';
import { useOnline } from '../../hooks/useOnline';
import { HOLD_MS, heldSaves, holdSave, takeHeld } from '../../lib/heldSaves';
import { enqueue, queued, removeSent } from '../../lib/offlineQueue';
import { safeStorage } from '../../lib/storage';

export type SendResult = 'sent' | 'queued';

/**
 * PH-02 saving (SPEC §8):
 * - `hold` keeps a save on the device for HOLD_MS so it can be undone (`undo`), then sends it.
 * - Everything goes out through the offline queue in device storage, and leaves it only after the
 *   server has it. So a failed request, a lost connection or a closed tab never loses a change;
 *   it goes the next time this screen is open and online. Every change keeps its device time.
 * - Leaving the screen or putting the tab in the background stops waiting and sends at once.
 */
export function useOfflineQueue(orgId: string) {
  const online = useOnline();
  const { mutateAsync, isPending } = useSaveStock(orgId);
  const [waiting, setWaiting] = useState(() => queued(safeStorage, orgId).length);
  // Bumped when more arrived during a send, so the effect below sends again.
  const [again, setAgain] = useState(0);

  // One send at a time; whatever arrives meanwhile goes in the next one.
  const sending = useRef<Promise<boolean> | null>(null);
  const flush = useCallback((): Promise<boolean> => {
    if (sending.current) return sending.current;
    const changes = queued(safeStorage, orgId);
    if (changes.length === 0) return Promise.resolve(true);
    if (!navigator.onLine) {
      return Promise.resolve().then(() => {
        setWaiting(changes.length);
        return false;
      });
    }
    const run = mutateAsync(changes)
      .then(() => {
        const left = removeSent(safeStorage, orgId, changes);
        setWaiting(left.length);
        return true;
      })
      .catch(() => {
        setWaiting(queued(safeStorage, orgId).length);
        return false;
      })
      .finally(() => {
        sending.current = null;
        if (navigator.onLine && queued(safeStorage, orgId).length > 0) setAgain((n) => n + 1);
      });
    sending.current = run;
    return run;
  }, [mutateAsync, orgId]);

  // When the connection returns, send what is waiting.
  useEffect(() => {
    if (online && (waiting > 0 || again > 0)) void flush();
  }, [online, waiting, again, flush]);

  // Held saves: one timer each. Moving a held save into the queue is what makes it safe.
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const release = useCallback(
    (id: string) => {
      clearTimeout(timers.current.get(id));
      timers.current.delete(id);
      const changes = takeHeld(safeStorage, orgId, id);
      if (changes) enqueue(safeStorage, orgId, changes);
      return changes !== null;
    },
    [orgId],
  );

  const hold = useCallback(
    (changes: StockChange[], onDone: (result: SendResult) => void) => {
      const held = holdSave(safeStorage, orgId, changes, Date.now());
      timers.current.set(
        held.id,
        setTimeout(() => {
          if (release(held.id)) void flush().then((ok) => onDone(ok ? 'sent' : 'queued'));
        }, HOLD_MS),
      );
      return held.id;
    },
    [orgId, release, flush],
  );

  /** Takes a held save back before it is sent. False when it has already gone. */
  const undo = useCallback(
    (id: string) => {
      clearTimeout(timers.current.get(id));
      timers.current.delete(id);
      return takeHeld(safeStorage, orgId, id) !== null;
    },
    [orgId],
  );

  const sendHeldNow = useCallback(() => {
    let moved = false;
    for (const h of heldSaves(safeStorage, orgId)) moved = release(h.id) || moved;
    if (moved) void flush();
  }, [orgId, release, flush]);

  useEffect(() => {
    // Left by a tab that closed during its hold: send it once the screen is up.
    const leftovers = setTimeout(sendHeldNow, 0);
    const onHide = () => {
      if (document.visibilityState === 'hidden') sendHeldNow();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', sendHeldNow);
    return () => {
      clearTimeout(leftovers);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', sendHeldNow);
      sendHeldNow();
    };
  }, [sendHeldNow]);

  return { hold, undo, waiting, saving: isPending };
}
