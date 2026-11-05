// Mock sign-in, sign-up and organization registration (A-02..A-06). Supabase Auth replaces this in phase 4.
import { DEFAULT_PERMS } from '../perms';
import { DEFAULT_PREFS } from '../providerTypes';
import type { AuthRepo, RegistrationRepo } from '../types';
import { AccessError, currentUser, latency, requireOwner, requireUser, toMe } from './access';
import { audit, newId, store } from './store';

const normEmail = (e: string) => e.trim().toLowerCase();

export const authRepo: AuthRepo = {
  me() {
    const u = currentUser();
    return latency(u ? toMe(u) : null);
  },
  signIn(email, password) {
    const u = store.get().users.find((x) => normEmail(x.email) === normEmail(email));
    if (!u || u.password === null || u.password !== password) return latency(null);
    store.mutate((s) => {
      s.sessionUserId = u.id;
    });
    return latency(toMe(u));
  },
  signUp(input) {
    if (store.get().users.some((x) => normEmail(x.email) === normEmail(input.email)))
      return latency({ ok: false as const, reason: 'email_taken' as const });
    const me = store.mutate((s) => {
      const u = {
        id: `u-${newId()}`,
        role: 'patient',
        displayName: input.displayName.trim(),
        email: normEmail(input.email),
        phone: input.phone,
        password: input.password,
        platformRole: null,
        memberships: [],
        suspended: false,
        prefs: { ...DEFAULT_PREFS },
        joinedAt: new Date().toISOString(),
      };
      s.users.push(u);
      s.sessionUserId = u.id;
      return toMe(u, s);
    });
    return latency({ ok: true as const, me });
  },
  // Mock: nothing is sent. In the prototype, Supabase can only email the project team (SPEC §12).
  requestPasswordReset: () => latency(undefined),
  // Mock mode has no external sign-in: the Google button stays hidden.
  oauthProviders: () => latency([]),
  signInWithOAuth: () => Promise.reject(new Error('not_supported')),
};

export const registrationRepo: RegistrationRepo = {
  submit(draft) {
    const email = normEmail(draft.account.email);
    const signedIn = currentUser();
    if (!signedIn && store.get().users.some((x) => normEmail(x.email) === email))
      return latency({ ok: false as const, reason: 'email_taken' as const });
    const now = new Date().toISOString();
    const orgId = store.mutate((s) => {
      const id = `${draft.org.type === 'pharmacy' ? 'ph' : 'pr'}-${newId()}`;
      s.orgs.push({
        id,
        type: draft.org.type,
        nameAr: draft.org.nameAr.trim(),
        nameEn: draft.org.nameEn.trim(),
        governorate: draft.org.governorate,
        area: draft.org.area,
        addressText: draft.org.addressText.trim(),
        landmark: draft.org.landmark.trim() || null,
        locationPrecision: draft.org.locationPrecision,
        phone: draft.org.phone.trim(),
        whatsapp: draft.org.whatsapp.trim() || null,
        hours: draft.org.hours,
        description: null,
        website: null,
        locations: [],
        temporarilyClosed: null,
        verificationStatus: 'pending',
        reviewerNote: null,
        events: [{ action: 'submitted', note: null, createdAt: now }],
        documents: draft.documents.map(({ file: _file, ...d }) => ({ ...d, status: 'pending' as const })),
        invitations: [],
        suspendedReason: null,
        // Real names are never seeded, but anything registered in the demo is still demo data.
        isDemo: true,
        infoUpdatedAt: now,
        private: {
          licenseNo: draft.org.licenseNo.trim(),
          exactLat: draft.org.lat,
          exactLng: draft.org.lng,
          contactPerson: `${draft.account.contactName.trim()} · ${draft.account.contactRole.trim()}`,
        },
      });
      const membership = { orgId: id, memberRole: 'owner' as const, perms: DEFAULT_PERMS.owner };
      if (signedIn) {
        s.users.find((u) => u.id === signedIn.id)!.memberships.push(membership);
      } else {
        const userId = `u-${newId()}`;
        s.users.push({
          id: userId,
          role: 'org_owner',
          displayName: draft.account.contactName.trim(),
          email,
          phone: draft.account.phone.trim() || null,
          password: draft.account.password,
          platformRole: null,
          memberships: [membership],
          suspended: false,
          prefs: { ...DEFAULT_PREFS },
          joinedAt: now,
        });
        s.sessionUserId = userId;
      }
      audit(s, 'verification.submitted', 'organization', id, null, { status: 'pending' });
      return id;
    });
    return latency({ ok: true as const, orgId });
  },
  myStatus() {
    const u = currentUser();
    const m = u?.memberships[0];
    const o = m && store.get().orgs.find((x) => x.id === m.orgId);
    return latency(
      o
        ? { orgId: o.id, orgType: o.type, nameAr: o.nameAr, nameEn: o.nameEn, status: o.verificationStatus, reviewerNote: o.reviewerNote, events: o.events }
        : null,
    );
  },
  resubmit(orgId, note, documents) {
    requireUser();
    requireOwner(orgId);
    store.mutate((s) => {
      const o = s.orgs.find((x) => x.id === orgId)!;
      if (o.verificationStatus !== 'needs_info') throw new AccessError('forbidden');
      o.verificationStatus = 'pending';
      o.events.push({ action: 'resubmitted', note: note.trim() || null, createdAt: new Date().toISOString() });
      o.documents.push(...documents.map(({ file: _file, ...d }) => ({ ...d, status: 'pending' as const })));
      audit(s, 'verification.resubmitted', 'organization', orgId, { status: 'needs_info' }, { status: 'pending' });
    });
    return latency(undefined);
  },
};
