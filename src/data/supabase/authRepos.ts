// Supabase Auth by email and password (SPEC §12: confirmation off in the prototype), organization
// registration with documents in the private org-docs bucket, and the demo role switcher.
import { callbackUrl } from '../../lib/authRedirect';
import { env } from '../../lib/env';
import type { AuthRepo, DemoRepo, DocumentMeta, Me, OAuthProvider, RegistrationRepo, SignUpInput } from '../types';
import { auth, db, must, rpc, storage } from './client';
import { DEMO_EMAILS, DEMO_PASSWORD } from './demoAccounts';
import { toEvent, toMembership, type OrgDbRow, type PrivateDbRow } from './map';
import { currentUserId } from './publicRepos';

export async function loadMe(userId: string): Promise<Me> {
  const [{ data }, profile, members] = await Promise.all([
    auth.getSession(),
    db.from('profiles').select('full_name, phone, platform_role').eq('id', userId).single(),
    db
      .from('org_members')
      .select('org_id, member_role, perms, organizations(type, name_ar, name_en, verification_status)')
      .eq('user_id', userId)
      .order('created_at'),
  ]);
  const p = must(profile) as { full_name: string; phone: string | null; platform_role: Me['platformRole'] };
  return {
    userId,
    displayName: p.full_name,
    email: data.session?.user.email ?? '',
    phone: p.phone,
    platformRole: p.platform_role,
    memberships: (must(members) as unknown as Parameters<typeof toMembership>[0][]).flatMap(toMembership),
  };
}

const emailTaken = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === 'user_already_exists' || e.code === 'email_exists' || /already (been )?registered/i.test(e.message ?? ''));

async function signUpUser(input: SignUpInput): Promise<{ ok: true; userId: string } | { ok: false; reason: 'email_taken' }> {
  const { data, error } = await auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: { data: { full_name: input.displayName.trim(), phone: input.phone } },
  });
  if (emailTaken(error)) return { ok: false, reason: 'email_taken' };
  if (error) throw error;
  // With email confirmation on, Supabase answers an existing address with a user that has no identities.
  if (!data.user || data.user.identities?.length === 0) return { ok: false, reason: 'email_taken' };
  if (!data.session) throw new Error('email_confirmation_required');
  return { ok: true, userId: data.user.id };
}

export const authRepo: AuthRepo = {
  async me() {
    const id = await currentUserId();
    return id ? loadMe(id) : null;
  },

  async signIn(email, password) {
    const { data, error } = await auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    // Generic on purpose: never says whether the email exists (A-02).
    if (error || !data.user) return null;
    return loadMe(data.user.id);
  },

  async signUp(input) {
    const r = await signUpUser(input);
    return r.ok ? { ok: true, me: await loadMe(r.userId) } : r;
  },

  async requestPasswordReset(email) {
    // The free plan only emails the project team (SPEC §12); the answer is the same either way.
    await auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${window.location.origin}/reset` }).catch(() => undefined);
  },

  async oauthProviders() {
    // Public auth settings: the button appears by itself once Google is turned on in Supabase.
    const res = await fetch(`${env.supabaseUrl}/auth/v1/settings`, { headers: { apikey: env.supabaseAnonKey } });
    if (!res.ok) return [];
    const s = (await res.json()) as { external?: Record<string, boolean> };
    return (['google'] as OAuthProvider[]).filter((p) => s.external?.[p] === true);
  },

  async signInWithOAuth(provider, from) {
    const { error } = await auth.signInWithOAuth({ provider, options: { redirectTo: callbackUrl(window.location.origin, from) } });
    if (error) throw error;
  },
};

// ---------------------------------------------------------------- registration

/** Document metadata for the RPC; `upload` asks it for a storage path when we hold the file itself. */
const docsArg = (documents: DocumentMeta[]) =>
  documents.map((d) => ({ docType: d.docType, fileName: d.fileName, size: d.size, mime: d.mime, upload: d.file instanceof File }));

/** Uploads each file to the path the RPC returned. A failed upload leaves the metadata for the reviewer. */
async function uploadDocuments(documents: DocumentMeta[], uploads: { fileName: string; path: string }[]) {
  await Promise.all(
    uploads.map(async (u) => {
      const file = documents.find((d) => d.fileName === u.fileName && d.file instanceof File)?.file;
      if (!file) return;
      const { error } = await storage.from('org-docs').upload(u.path, file, { contentType: file.type, upsert: false });
      if (error) console.warn('document upload failed', u.fileName, error.message);
    }),
  );
}

export const registrationRepo: RegistrationRepo = {
  async submit(draft) {
    if (!(await currentUserId())) {
      const r = await signUpUser({
        displayName: draft.account.contactName,
        email: draft.account.email,
        password: draft.account.password,
        phone: draft.account.phone.trim() || null,
      });
      if (!r.ok) return r;
    }
    const { password: _password, ...account } = draft.account;
    const out = await rpc<{ orgId: string; uploads: { fileName: string; path: string }[] }>('register_org', {
      draft: { account, org: draft.org, documents: docsArg(draft.documents) },
    });
    await uploadDocuments(draft.documents, out.uploads);
    return { ok: true, orgId: out.orgId };
  },

  async myStatus() {
    const id = await currentUserId();
    if (!id) return null;
    const m = must(await db.from('org_members').select('org_id').eq('user_id', id).order('created_at').limit(1)) as { org_id: string }[];
    if (!m[0]) return null;
    const orgId = m[0].org_id;
    const [org, priv, events] = await Promise.all([
      db.from('organizations').select('id, type, name_ar, name_en, verification_status').eq('id', orgId).single(),
      db.from('organization_private').select('reviewer_notes').eq('org_id', orgId).maybeSingle(),
      db.from('verification_events').select('action, note, created_at').eq('org_id', orgId).order('created_at'),
    ]);
    const o = must(org) as Pick<OrgDbRow, 'id' | 'type' | 'name_ar' | 'name_en' | 'verification_status'>;
    const p = must(priv) as Pick<PrivateDbRow, 'reviewer_notes'> | null;
    return {
      orgId: o.id,
      orgType: o.type,
      nameAr: o.name_ar,
      nameEn: o.name_en,
      status: o.verification_status,
      reviewerNote: p?.reviewer_notes ?? null,
      events: must(events).map(toEvent),
    };
  },

  async resubmit(orgId, note, documents) {
    const out = await rpc<{ uploads: { fileName: string; path: string }[] }>('resubmit_org', { org: orgId, note, documents: docsArg(documents) });
    await uploadDocuments(documents, out.uploads);
  },
};

// ---------------------------------------------------------------- demo (VITE_DEMO=true only)

export const demoRepo: DemoRepo = {
  async signInAs(userId) {
    if (!env.demo) throw new Error('forbidden');
    // Signing in replaces the session; signing out first would let the open page refetch as a visitor.
    if (!userId) {
      await auth.signOut();
      return null;
    }
    const email = DEMO_EMAILS[userId];
    if (!email) throw new Error('unknown_demo_account');
    const { data, error } = await auth.signInWithPassword({ email, password: DEMO_PASSWORD });
    if (error || !data.user) throw error ?? new Error('sign_in_failed');
    return loadMe(data.user.id);
  },

  async reset() {
    if (!env.demo) throw new Error('forbidden');
    await rpc('demo_reset');
    await auth.signOut();
  },
};

