import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { del, get, set } from 'idb-keyval';
import { useEffect, type ReactNode } from 'react';
import { DemoBadge, ToastProvider } from '../components/ui';
import { getRepos } from '../data';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: 'offlineFirst',
      staleTime: 30_000,
      gcTime: 7 * 86_400_000,
      retry: 2,
      refetchOnWindowFocus: true,
    },
  },
});

// Last results live in IndexedDB with their time, so the site opens offline (SPEC §11).
const persister = createAsyncStoragePersister({
  storage: {
    getItem: (k) => get<string>(k).then((v) => v ?? null),
    setItem: (k, v) => set(k, v),
    removeItem: (k) => del(k),
  },
  key: 'madad.query-cache',
});

function RepoSync() {
  useEffect(() => {
    let off = () => {};
    void getRepos().then((r) => {
      off = r.subscribe(() => void queryClient.invalidateQueries());
    });
    return () => off();
  }, []);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 7 * 86_400_000,
        dehydrateOptions: { shouldDehydrateQuery: (q) => q.queryKey[0] === 'public' && q.state.status === 'success' },
      }}
    >
      <ToastProvider>
        <RepoSync />
        {children}
        <DemoBadge />
      </ToastProvider>
    </PersistQueryClientProvider>
  );
}
