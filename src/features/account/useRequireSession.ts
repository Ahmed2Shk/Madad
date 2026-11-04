import { createContext, useContext } from 'react';

export type RequireSession = (action: () => void, reasonKey?: string) => void;

export const RequireSessionContext = createContext<RequireSession | null>(null);

/** Runs `action` now if signed in, otherwise asks the user to sign in first. */
export function useRequireSession(): RequireSession {
  const run = useContext(RequireSessionContext);
  if (!run) throw new Error('useRequireSession needs <SignInPromptProvider>');
  return run;
}
