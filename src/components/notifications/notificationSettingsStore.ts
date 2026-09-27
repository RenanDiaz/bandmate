import { useSyncExternalStore } from "react";

/**
 * Whether the notification settings modal is open. It lives outside the user
 * menu because the mobile drawer closes (and unmounts the menu) when a row is
 * tapped; `NotificationSettingsHost` (in App) renders the modal.
 */
let open = false;
const listeners = new Set<() => void>();

function set(value: boolean): void {
  if (open === value) return;
  open = value;
  listeners.forEach((listener) => listener());
}

export const openNotificationSettings = (): void => set(true);
export const closeNotificationSettings = (): void => set(false);

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useNotificationSettingsOpen(): boolean {
  return useSyncExternalStore(subscribe, () => open, () => false);
}
