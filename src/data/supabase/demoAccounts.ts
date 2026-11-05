// The seeded demo accounts (same file mock mode and supabase/seed.sql use). Supabase mode signs in
// to them with the shared demo password, which the login page already shows in demo mode (A-02).
import users from '../mock/seed/users.json';

/** Seed user id (as in the role switcher) → email. */
export const DEMO_EMAILS: Record<string, string> = Object.fromEntries(users.filter((u) => u.password).map((u) => [u.id, u.email]));

export const DEMO_PASSWORD = users.find((u) => u.password)?.password ?? '';
