import type { ReactNode } from 'react';
import { DemoBadge, ToastProvider } from '../components/ui';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      {children}
      <DemoBadge />
    </ToastProvider>
  );
}
