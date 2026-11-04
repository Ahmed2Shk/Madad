// TanStack Query hooks over the repositories. Keys under 'public' are persisted to IndexedDB for
// offline use (SPEC §11); keys under 'me' hold account data and are never persisted.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRepos } from './index';
import { DEFAULT_FRESHNESS } from '../lib/freshness';
import type {
  FavoriteType,
  GovFilter,
  NewInquiry,
  NewReport,
  PublicSettings,
  Repos,
  SearchLogEntry,
  Session,
  StockChange,
} from './types';

const use =
  <T>(fn: (r: Repos) => Promise<T>) =>
  () =>
    getRepos().then(fn);

const DAY = 86_400_000;

export const keys = {
  catalog: ['public', 'catalog'] as const,
  settings: ['public', 'settings'] as const,
  search: (q: string, gov: GovFilter) => ['public', 'search', q, gov] as const,
  medicinePharmacies: (id: string, gov: GovFilter) => ['public', 'medicine', id, gov] as const,
  pharmacy: (id: string) => ['public', 'pharmacy', id] as const,
  pharmacyReports: (id: string) => ['public', 'pharmacy-reports', id] as const,
  pharmacies: (gov: GovFilter) => ['public', 'pharmacies', gov] as const,
  recent: (gov: GovFilter) => ['public', 'recent', gov] as const,
  top: (gov: GovFilter) => ['public', 'top', gov] as const,
  session: ['me', 'session'] as const,
  favorites: ['me', 'favorites'] as const,
  alerts: ['me', 'alerts'] as const,
  notifications: ['me', 'notifications'] as const,
};

// ---------------------------------------------------------------- public reads

export const useCatalog = () =>
  useQuery({ queryKey: keys.catalog, queryFn: use((r) => r.catalog.load()), staleTime: DAY, gcTime: 7 * DAY });

export const useSettings = () =>
  useQuery({ queryKey: keys.settings, queryFn: use((r) => r.settings.get()), staleTime: 5 * 60_000 });

/** Admin-tunable freshness windows; defaults until the settings load. */
export function useFreshnessSettings(): PublicSettings {
  return useSettings().data ?? DEFAULT_FRESHNESS;
}

export const useMedicineSearch =(q: string, gov: GovFilter) =>
  useQuery({
    queryKey: keys.search(q, gov),
    queryFn: use((r) => r.availability.searchMedicines(q, gov)),
    enabled: q.trim().length > 0,
  });

export const usePharmaciesFor = (medicineId: string, gov: GovFilter) =>
  useQuery({
    queryKey: keys.medicinePharmacies(medicineId, gov),
    queryFn: use((r) => r.availability.pharmaciesFor(medicineId, gov)),
  });

export const usePharmacy = (id: string) =>
  useQuery({ queryKey: keys.pharmacy(id), queryFn: use((r) => r.orgs.pharmacy(id)) });

export const usePharmacyReports = (id: string) =>
  useQuery({ queryKey: keys.pharmacyReports(id), queryFn: use((r) => r.availability.pharmacyReports(id)) });

export const usePharmacies = (gov: GovFilter) =>
  useQuery({ queryKey: keys.pharmacies(gov), queryFn: use((r) => r.orgs.pharmacies(gov)) });

export const useRecentlyUpdated = (gov: GovFilter) =>
  useQuery({ queryKey: keys.recent(gov), queryFn: use((r) => r.availability.recentlyUpdated(gov, 60, 3)) });

export const useTopSearched = (gov: GovFilter) =>
  useQuery({ queryKey: keys.top(gov), queryFn: use((r) => r.insights.topSearched(gov, 4)), staleTime: 60 * 60_000 });

// ---------------------------------------------------------------- writes without an account

export const logSearch = (entry: SearchLogEntry) => getRepos().then((r) => r.insights.logSearch(entry));

export const useSubmitReport = () => useMutation({ mutationFn: (rep: NewReport) => getRepos().then((r) => r.reports.submit(rep)) });

/** Pharmacy portal writes (PH-02). Invalidates every public read so patients see it at once. */
export function useUpdateStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pharmacyId, changes }: { pharmacyId: string; changes: StockChange[] }) =>
      getRepos().then((r) => r.availability.updateStock(pharmacyId, changes)),
    onSuccess: () => qc.invalidateQueries(),
  });
}

// ---------------------------------------------------------------- account

export const useSession = () => useQuery({ queryKey: keys.session, queryFn: use((r) => r.account.session()) });

export function useSignInDemo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => getRepos().then((r) => r.account.signInDemoPatient()),
    onSuccess: (s: Session) => {
      qc.setQueryData(keys.session, s);
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

export function useSignOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => getRepos().then((r) => r.account.signOut()),
    onSuccess: () => {
      qc.setQueryData(keys.session, null);
      qc.removeQueries({ queryKey: ['me'], predicate: (q) => q.queryKey[1] !== 'session' });
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Pick<Session, 'displayName' | 'phone'>>) =>
      getRepos().then((r) => r.account.updateProfile(patch)),
    onSuccess: (s) => qc.setQueryData(keys.session, s),
  });
}

const signedIn = (s: Session | null | undefined) => !!s;

export function useFavorites() {
  const { data: session } = useSession();
  return useQuery({ queryKey: keys.favorites, queryFn: use((r) => r.account.favorites()), enabled: signedIn(session) });
}

export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ type, id }: { type: FavoriteType; id: string }) =>
      getRepos().then((r) => r.account.toggleFavorite(type, id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.favorites }),
  });
}

export function useAlerts() {
  const { data: session } = useSession();
  return useQuery({ queryKey: keys.alerts, queryFn: use((r) => r.account.alerts()), enabled: signedIn(session) });
}

export function useCreateAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ medicineId, gov }: { medicineId: string; gov: GovFilter }) =>
      getRepos().then((r) => r.account.createAlert(medicineId, gov)),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.alerts }),
  });
}

export function useStopAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => getRepos().then((r) => r.account.stopAlert(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.alerts }),
  });
}

export function useNotifications() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: keys.notifications,
    queryFn: use((r) => r.account.notifications()),
    enabled: signedIn(session),
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => getRepos().then((r) => r.account.markNotificationsRead()),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.notifications }),
  });
}

export const useSendInquiry = () =>
  useMutation({ mutationFn: (inq: NewInquiry) => getRepos().then((r) => r.account.sendInquiry(inq)) });

export const exportMyData = () => getRepos().then((r) => r.account.exportData());

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => getRepos().then((r) => r.account.deleteAccount()),
    onSuccess: () => {
      qc.setQueryData(keys.session, null);
      qc.removeQueries({ queryKey: ['me'], predicate: (q) => q.queryKey[1] !== 'session' });
    },
  });
}
