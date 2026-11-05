// Hooks for phase 5: the medical directory (public), the provider portal, AD-08/AD-09 and PH-09/PH-10.
// Directory keys live under 'public' (persisted for offline); everything else under 'me'.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRepos } from './index';
import type { AnnouncementInput, GovFilter, ModerationItem, NotificationPrefs, ProgramStatus, ProviderProfilePatch, ProviderType, ServiceInput } from './types';

type R = Awaited<ReturnType<typeof getRepos>>;
const run = <T>(fn: (r: R) => Promise<T>) => () => getRepos().then(fn);

export const providerKeys = {
  directory: (type: ProviderType | 'all', gov: GovFilter) => ['public', 'directory', type, gov] as const,
  provider: (id: string, preview = false) => [preview ? 'me' : 'public', 'provider', id] as const,
  services: (orgId: string) => ['me', 'provider', orgId, 'services'] as const,
  announcements: (orgId: string) => ['me', 'provider', orgId, 'announcements'] as const,
  profile: (orgId: string) => ['me', 'provider', orgId, 'profile'] as const,
  moderation: ['me', 'admin', 'moderation'] as const,
  users: ['me', 'admin', 'users'] as const,
  prefs: ['me', 'prefs'] as const,
};

// ---------------------------------------------------------------- public directory (P-07, P-08)

export const useDirectory = (type: ProviderType | 'all', gov: GovFilter) =>
  useQuery({
    queryKey: providerKeys.directory(type, gov),
    queryFn: run((r) => r.directory.providers({ type: type === 'all' ? undefined : type, gov })),
  });

export const useProvider = (id: string, preview = false) =>
  useQuery({ queryKey: providerKeys.provider(id, preview), queryFn: run((r) => r.directory.provider(id, { preview })) });

// ---------------------------------------------------------------- provider portal (PR-01..PR-08)

export const useProviderServices = (orgId: string, enabled = true) =>
  useQuery({ queryKey: providerKeys.services(orgId), queryFn: run((r) => r.providerPortal.services(orgId)), enabled });
export const useProviderAnnouncements = (orgId: string) =>
  useQuery({ queryKey: providerKeys.announcements(orgId), queryFn: run((r) => r.providerPortal.announcements(orgId)) });
export const useProviderProfile = (orgId: string) => useQuery({ queryKey: providerKeys.profile(orgId), queryFn: run((r) => r.providerPortal.profile(orgId)) });

/** Every write refreshes the portal and the public pages that show the same content. */
function useWrite<V, T>(fn: (r: R, v: V) => Promise<T>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (v: V) => getRepos().then((r) => fn(r, v)), onSuccess: () => qc.invalidateQueries() });
}

export const useSaveService = (orgId: string) => useWrite((r, input: ServiceInput) => r.providerPortal.saveService(orgId, input));
export const useDeleteService = (orgId: string) => useWrite((r, id: string) => r.providerPortal.deleteService(orgId, id));
export const useSetProgramStatus = (orgId: string) =>
  useWrite((r, v: { id: string; status: ProgramStatus }) => r.providerPortal.setProgramStatus(orgId, v.id, v.status));
export const useSaveAnnouncement = (orgId: string) =>
  useWrite((r, v: { input: AnnouncementInput; submit: boolean }) => r.providerPortal.saveAnnouncement(orgId, v.input, v.submit));
export const useDeleteAnnouncement = (orgId: string) => useWrite((r, id: string) => r.providerPortal.deleteAnnouncement(orgId, id));
export const useUpdateProviderProfile = (orgId: string) => useWrite((r, patch: ProviderProfilePatch) => r.providerPortal.updateProfile(orgId, patch));

// ---------------------------------------------------------------- AD-08, AD-09

export const useModerationQueue = () => useQuery({ queryKey: providerKeys.moderation, queryFn: run((r) => r.admin.moderationQueue()) });
export const useModerate = () =>
  useWrite((r, v: { kind: ModerationItem['kind']; id: string; decision: 'approve' | 'reject'; reason: string }) => r.admin.moderate(v.kind, v.id, v.decision, v.reason));
export const useAdminUsers = () => useQuery({ queryKey: providerKeys.users, queryFn: run((r) => r.admin.users()) });
export const useSetUserSuspended = () => useWrite((r, v: { userId: string; suspended: boolean }) => r.admin.setUserSuspended(v.userId, v.suspended));
export const useSetPlatformRole = () =>
  useWrite((r, v: { userId: string; role: 'reviewer' | 'super_admin' | null }) => r.admin.setPlatformRole(v.userId, v.role));

// ---------------------------------------------------------------- PH-10 account settings

export const usePrefs = () => useQuery({ queryKey: providerKeys.prefs, queryFn: run((r) => r.account.prefs()) });
export const useUpdatePrefs = () => useWrite((r, patch: Partial<NotificationPrefs>) => r.account.updatePrefs(patch));
export const useChangePassword = () => useMutation({ mutationFn: (pw: string) => getRepos().then((r) => r.account.changePassword(pw)) });
export const useSignOutOthers = () => useMutation({ mutationFn: () => getRepos().then((r) => r.account.signOutOtherDevices()) });
