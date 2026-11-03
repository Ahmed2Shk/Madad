import { createContext, useContext } from 'react';

export type ToastKind = 'success' | 'error';
export type ShowToast = (message: string, kind?: ToastKind) => void;

export const ToastContext = createContext<ShowToast | null>(null);

export function useToast(): ShowToast {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
