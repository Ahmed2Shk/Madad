import { createContext, useContext } from 'react';

export interface AdminCtx {
  role: 'reviewer' | 'super_admin';
}

export const AdminContext = createContext<AdminCtx | null>(null);

export function useAdminCtx(): AdminCtx {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdminCtx needs the admin shell');
  return ctx;
}
