// Hooks for sign-in, registration and the pharmacy portal. All keys live under 'me', so they are
// never persisted to IndexedDB and are dropped on sign-out.
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { getRepos } from './index';
import { keys } from './queries';
import type {
  DocumentMeta,
  InquiryStatus,
  Me,
  MedicineRequestInput,
  MemberRole,
  OAuthProvider,
  OrgProfilePatch,
  Perms,
  RegistrationDraft,
  Reported,
  SignUpInput,
  StockChange,
} from './types';

const portal = (orgId: string) => ['me', 'portal', orgId] as const;
export const portalKeys = {
  all: portal,
  overview: (id: string) => [...portal(id), 'overview'] as const,
  stock: (id: string) => [...portal(id), 'stock'] as const,
  history: (id: string) => [...portal(id), 'history'] as const,
  requests: (id: string) => [...portal(id), 'requests'] as const,
  inquiries: (id: string) => [...portal(id), 'inquiries'] as const,
  profile: (id: string) => [...portal(id), 'profile'] as const,
  team: (id: string) => [...portal(id), 'team'] as const,
  registration: ['me', 'registration'] as const,
};

/** After any sign-in change: forget every account-scoped query and set the new identity. */
function setIdentity(qc: QueryClient, me: Me | null) {
  qc.removeQueries({ queryKey: ['me'] });
  qc.setQueryData(keys.me, me);
  qc.setQueryData(keys.session, me && { userId: me.userId, displayName: me.displayName, email: me.email, phone: me.phone });
}

// ---------------------------------------------------------------- auth

export const useMe = () => useQuery({ queryKey: keys.me, queryFn: () => getRepos().then((r) => r.auth.me()) });

/** External sign-in providers turned on in this project (none in mock mode). */
export const useOAuthProviders = () =>
  useQuery({ queryKey: ['public', 'oauth-providers'] as const, queryFn: () => getRepos().then((r) => r.auth.oauthProviders()), staleTime: 60 * 60_000 });

export const useOAuthSignIn = () =>
  useMutation({ mutationFn: ({ provider, from }: { provider: OAuthProvider; from: string | null }) => getRepos().then((r) => r.auth.signInWithOAuth(provider, from)) });

export function useSignIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => getRepos().then((r) => r.auth.signIn(email, password)),
    onSuccess: (me) => me && setIdentity(qc, me),
  });
}

export function useSignUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SignUpInput) => getRepos().then((r) => r.auth.signUp(input)),
    onSuccess: (res) => res.ok && setIdentity(qc, res.me),
  });
}

export const useRequestReset = () =>
  useMutation({ mutationFn: (email: string) => getRepos().then((r) => r.auth.requestPasswordReset(email)) });

// ---------------------------------------------------------------- registration

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (draft: RegistrationDraft) => getRepos().then((r) => r.registration.submit(draft)),
    onSuccess: async (res) => {
      if (!res.ok) return;
      const me = await getRepos().then((r) => r.auth.me());
      setIdentity(qc, me);
    },
  });
}

export const useRegistrationStatus = () =>
  useQuery({ queryKey: portalKeys.registration, queryFn: () => getRepos().then((r) => r.registration.myStatus()) });

export function useResubmit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, note, documents }: { orgId: string; note: string; documents: DocumentMeta[] }) =>
      getRepos().then((r) => r.registration.resubmit(orgId, note, documents)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });
}

// ---------------------------------------------------------------- pharmacy portal

const p = <T>(fn: (r: Awaited<ReturnType<typeof getRepos>>['pharmacyPortal']) => Promise<T>) => () =>
  getRepos().then((r) => fn(r.pharmacyPortal));

export const usePortalOverview = (orgId: string) =>
  useQuery({ queryKey: portalKeys.overview(orgId), queryFn: p((r) => r.overview(orgId)) });
export const usePortalStock = (orgId: string) => useQuery({ queryKey: portalKeys.stock(orgId), queryFn: p((r) => r.stock(orgId)) });
export const usePortalHistory = (orgId: string) =>
  useQuery({ queryKey: portalKeys.history(orgId), queryFn: p((r) => r.history(orgId)) });
export const useMedicineRequests = (orgId: string) =>
  useQuery({ queryKey: portalKeys.requests(orgId), queryFn: p((r) => r.requests(orgId)) });
export const usePortalInquiries = (orgId: string) =>
  useQuery({ queryKey: portalKeys.inquiries(orgId), queryFn: p((r) => r.inquiries(orgId)), refetchInterval: 30_000 });
export const useOrgProfile = (orgId: string) => useQuery({ queryKey: portalKeys.profile(orgId), queryFn: p((r) => r.profile(orgId)) });
export const useTeam = (orgId: string) => useQuery({ queryKey: portalKeys.team(orgId), queryFn: p((r) => r.team(orgId)) });

/** Portal writes refresh both the portal and every public read, so patients see changes at once. */
function usePortalMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries() });
}

export const useSaveStock = (orgId: string) =>
  usePortalMutation((changes: StockChange[]) => getRepos().then((r) => r.availability.updateStock(orgId, changes)));
export const useConfirmAll = (orgId: string) =>
  usePortalMutation((pricesToo: boolean) => getRepos().then((r) => r.availability.confirmAll(orgId, { pricesToo })));
export const useSetListed = (orgId: string) =>
  usePortalMutation(({ medicineId, listed }: { medicineId: string; listed: boolean }) => getRepos().then((r) => r.pharmacyPortal.setListed(orgId, medicineId, listed)));
export const useRemoveMedicine = (orgId: string) =>
  usePortalMutation((medicineId: string) => getRepos().then((r) => r.pharmacyPortal.removeMedicine(orgId, medicineId)));
export const useAddMedicine = (orgId: string) =>
  usePortalMutation(({ medicineId, status }: { medicineId: string; status: Reported }) => getRepos().then((r) => r.pharmacyPortal.addMedicine(orgId, medicineId, status)));
export const useAddMedicines = (orgId: string) =>
  usePortalMutation(({ medicineIds, status }: { medicineIds: string[]; status: Reported }) => getRepos().then((r) => r.pharmacyPortal.addMedicines(orgId, medicineIds, status)));
export const useSetQuantity = (orgId: string) =>
  usePortalMutation(({ medicineId, quantity, lowThreshold }: { medicineId: string; quantity: number; lowThreshold: number }) =>
    getRepos().then((r) => r.pharmacyPortal.setQuantity(orgId, medicineId, quantity, lowThreshold)),
  );
export const useRequestMedicine = (orgId: string) =>
  usePortalMutation((input: MedicineRequestInput) => getRepos().then((r) => r.pharmacyPortal.requestMedicine(orgId, input)));
export const useReplyInquiry = (orgId: string) =>
  usePortalMutation(({ id, body }: { id: string; body: string }) => getRepos().then((r) => r.pharmacyPortal.replyInquiry(orgId, id, body)));
export const useSetInquiryStatus = (orgId: string) =>
  usePortalMutation(({ id, status }: { id: string; status: InquiryStatus }) => getRepos().then((r) => r.pharmacyPortal.setInquiryStatus(orgId, id, status)));
export const useUpdateOrgProfile = (orgId: string) =>
  usePortalMutation((patch: OrgProfilePatch) => getRepos().then((r) => r.pharmacyPortal.updateProfile(orgId, patch)));
export const useInvite = (orgId: string) =>
  usePortalMutation(({ email, role }: { email: string; role: MemberRole }) => getRepos().then((r) => r.pharmacyPortal.invite(orgId, email, role)));
export const useUpdateMember = (orgId: string) =>
  usePortalMutation(({ key, role, perms }: { key: string; role?: MemberRole; perms?: Perms }) =>
    getRepos().then((r) => r.pharmacyPortal.updateMember(orgId, key, { role, perms })),
  );
export const useRemoveMember = (orgId: string) =>
  usePortalMutation((key: string) => getRepos().then((r) => r.pharmacyPortal.removeMember(orgId, key)));
