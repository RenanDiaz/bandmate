import type { ReactNode } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { ToastContainer } from "../components/ToastContainer";
import { ToastContext, type Toast, type ToastContextType, type ToastType } from "./toast";

// Errors linger a little longer so they are easy to read; others auto-dismiss faster.
const DURATIONS: Record<ToastType, number> = {
  success: 4000,
  info: 4000,
  warning: 5000,
  error: 6000,
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (type: ToastType, message: string) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => dismissToast(id), DURATIONS[type]);
    },
    [dismissToast]
  );

  const success = useCallback((message: string) => showToast("success", message), [showToast]);
  const error = useCallback((message: string) => showToast("error", message), [showToast]);
  const warning = useCallback((message: string) => showToast("warning", message), [showToast]);
  const info = useCallback((message: string) => showToast("info", message), [showToast]);

  // The rendered list stays out of the value, so the value never changes and
  // `useToast()` can go in effect deps without re-running them on each toast.
  const value = useMemo<ToastContextType>(
    () => ({ showToast, success, error, warning, info, dismissToast }),
    [showToast, success, error, warning, info, dismissToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
};
