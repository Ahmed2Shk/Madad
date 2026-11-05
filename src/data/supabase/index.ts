// VITE_DATA_MODE=supabase: the same Repos contract as mock mode, backed by Postgres, RLS and RPC.
// There is no Realtime (SPEC §12): after any change we notify subscribers, the query cache
// refetches, and other tabs or devices catch up on focus.
import type { Repos } from '../types';
import { auth, authNotify } from './client';
import { adminRepo } from './adminRepo';
import { authRepo, demoRepo, registrationRepo } from './authRepos';
import { pharmacyPortalRepo } from './portalRepo';
import { directoryRepo, providerPortalRepo } from './providerRepos';
import { accountRepo, availabilityRepo, catalogRepo, insightsRepo, orgRepo, reportsRepo, settingsRepo } from './publicRepos';

const listeners = new Set<() => void>();
const notifyHere = () => listeners.forEach((l) => l());

// Other tabs of the same browser hear about a change at once (as in mock mode), with no network.
const tabs = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('madad.data');
if (tabs) tabs.onmessage = notifyHere;

const emit = () => {
  notifyHere();
  tabs?.postMessage('changed');
};

auth.onAuthStateChange((event) => {
  // Token refreshes and the initial session change nothing the screens show.
  // Each tab gets its own auth event (auth-js syncs sessions across tabs), so this stays local.
  if (authNotify.paused) return;
  if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') setTimeout(notifyHere, 0);
});

/** Wraps the methods that change data so a successful call refreshes every screen. */
function notifying<T extends object>(repo: T, mutators: (keyof T)[]): T {
  const out = { ...repo };
  for (const k of mutators) {
    const fn = repo[k] as (...a: unknown[]) => Promise<unknown>;
    (out as Record<keyof T, unknown>)[k] = async (...args: unknown[]) => {
      const r = await fn(...args);
      emit();
      return r;
    };
  }
  return out;
}

export const supabaseRepos: Repos = {
  admin: notifying(adminRepo, [
    'reviewOrg', 'setDocumentStatus', 'suspendOrg', 'reactivateOrg', 'addCatalogMedicine', 'setAliases', 'importCatalog',
    'reviewRequest', 'remindPharmacy', 'hideReport', 'updateReport', 'updateSettings', 'moderate', 'setUserSuspended', 'setPlatformRole',
  ]),
  demo: notifying(demoRepo, ['reset']),
  auth: authRepo,
  registration: notifying(registrationRepo, ['submit', 'resubmit']),
  pharmacyPortal: notifying(pharmacyPortalRepo, [
    'setListed', 'removeMedicine', 'addMedicine', 'setQuantity', 'requestMedicine', 'replyInquiry', 'setInquiryStatus',
    'updateProfile', 'invite', 'updateMember', 'removeMember',
  ]),
  catalog: catalogRepo,
  availability: notifying(availabilityRepo, ['updateStock', 'confirmAll']),
  orgs: orgRepo,
  insights: insightsRepo,
  settings: settingsRepo,
  account: notifying(accountRepo, ['updateProfile', 'toggleFavorite', 'createAlert', 'stopAlert', 'markNotificationsRead', 'sendInquiry', 'deleteAccount', 'changePassword', 'updatePrefs']),
  reports: reportsRepo,
  directory: directoryRepo,
  providerPortal: notifying(providerPortalRepo, ['saveService', 'deleteService', 'setProgramStatus', 'saveAnnouncement', 'deleteAnnouncement', 'updateProfile']),
  subscribe(listener) {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },
};
