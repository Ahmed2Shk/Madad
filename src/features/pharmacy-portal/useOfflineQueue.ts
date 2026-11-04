import { useCallback, useEffect, useRef, useState } from 'react';
import type { StockChange } from '../../data';
import { useSaveStock } from '../../data/portalQueries';
import { useOnline } from '../../hooks/useOnline';
import { clearQueue, enqueue, queued } from '../../lib/offlineQueue';
import { safeStorage } from '../../lib/storage';

/**
 * Saves now when online; otherwise queues on the device and sends when the connection returns
 * (SPEC §8 PH-02). Returns how many changes are waiting.
 */
export function useOfflineQueue(orgId: string) {
  const online = useOnline();
  const save = useSaveStock(orgId);
  const [waiting, setWaiting] = useState(() => queued(safeStorage, orgId).length);
  const { mutateAsync, isPending } = save;

  // When the connection returns, send what was queued (each change keeps its device time).
  const flushing = useRef(false);
  useEffect(() => {
    if (!online || waiting === 0 || flushing.current) return;
    flushing.current = true;
    const changes = queued(safeStorage, orgId);
    void mutateAsync(changes)
      .then(() => {
        clearQueue(safeStorage, orgId);
        setWaiting(0);
      })
      .finally(() => {
        flushing.current = false;
      });
  }, [online, waiting, mutateAsync, orgId]);

  const submit = useCallback(
    async (changes: StockChange[]): Promise<'sent' | 'queued'> => {
      if (!navigator.onLine) {
        setWaiting(enqueue(safeStorage, orgId, changes).length);
        return 'queued';
      }
      await mutateAsync(changes);
      return 'sent';
    },
    [mutateAsync, orgId],
  );

  return { submit, waiting, saving: isPending };
}
