import { createContext, useContext } from 'react';

export type ToastKind = 'success' | 'error';
/** An optional button in the toast (PH-02 «تراجع»); clicking it runs `onClick` and closes the toast. */
export interface ToastAction {
  label: string;
  onClick: () => void;
}
export type ShowToast = (message: string, kind?: ToastKind, options?: { action?: ToastAction; durationMs?: number }) => void;

export const ToastContext = createContext<ShowToast | null>(null);

export function useToast(): ShowToast {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
