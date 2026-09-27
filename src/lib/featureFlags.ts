/**
 * Feature flags. Each one names the PR that removes it.
 *
 * Offline downloads (PR 2.3), performance mode's snapshot source (PR 2.4) and
 * the offline screens (PR 2.5) stay hidden until the §11 device checklist
 * passes; the flag is removed in PR 2.6. On with `VITE_OFFLINE_DOWNLOADS=true` at build time (e.g. Vercel
 * Preview) or, per device, `localStorage.bandmate_flag_offline = "1"` (testing
 * against production). Read on every call, so the override needs only a reload.
 */

export const OFFLINE_FLAG_STORAGE_KEY = "bandmate_flag_offline";

export interface FlagEnv {
  envValue?: string;
  storage?: Pick<Storage, "getItem"> | null;
}

function defaultEnv(): FlagEnv {
  let storage: FlagEnv["storage"] = null;
  try {
    storage = typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    storage = null; // access itself can throw (blocked storage)
  }
  return { envValue: import.meta.env.VITE_OFFLINE_DOWNLOADS, storage };
}

export function isOfflineDownloadsEnabled(env: FlagEnv = defaultEnv()): boolean {
  if (env.envValue === "true") return true;
  try {
    return env.storage?.getItem(OFFLINE_FLAG_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Band push notifications (docs/specs/band-push-notifications.md §1
 * decision 8): the Notifications row and settings stay hidden until the
 * Phase 1 device checklist passes; the flag is removed after it. On with
 * `VITE_PUSH_NOTIFICATIONS=true` at build time or, per device,
 * `localStorage.bandmate_flag_push = "1"`. It hides the UI only: the database
 * triggers run regardless (no subscriptions → nothing is sent).
 */
export const PUSH_FLAG_STORAGE_KEY = "bandmate_flag_push";

function pushEnv(): FlagEnv {
  return { ...defaultEnv(), envValue: import.meta.env.VITE_PUSH_NOTIFICATIONS };
}

export function isPushNotificationsEnabled(env: FlagEnv = pushEnv()): boolean {
  if (env.envValue === "true") return true;
  try {
    return env.storage?.getItem(PUSH_FLAG_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}
