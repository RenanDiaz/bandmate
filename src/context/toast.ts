import { createContext } from "react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

/** Stable for the provider's lifetime: safe in effect and callback deps. */
export interface ToastContextType {
  /** Show a toast of an explicit type. */
  showToast: (type: ToastType, message: string) => void;
  /** Convenience helpers. */
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
  /** Manually dismiss a toast by id. */
  dismissToast: (id: number) => void;
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined);
