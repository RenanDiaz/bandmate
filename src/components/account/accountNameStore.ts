import { useSyncExternalStore } from "react";

/**
 * Whether the "Your name" dialog is open. Outside the user menu for the same
 * reason as the notification settings: the mobile drawer unmounts the menu
 * when a row is tapped. `AccountNameHost` (in App) renders the dialog.
 */
let open = false;
const listeners = new Set<() => void>();

function set(value: boolean): void {
  if (open === value) return;
  open = value;
  listeners.forEach((listener) => listener());
}

export const openAccountName = (): void => set(true);
export const closeAccountName = (): void => set(false);

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAccountNameOpen(): boolean {
  return useSyncExternalStore(subscribe, () => open, () => false);
}
