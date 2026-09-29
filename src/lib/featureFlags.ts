/**
 * Feature flags. Each one names the PR that removes it. A flag is on with its
 * `VITE_*` variable at build time (e.g. Vercel Preview) or, per device, its
 * localStorage key set to "1" (testing against production), which devices
 * without a console set with `?flag=<name>` (`applyFlagParams`). Read on every
 * call, so the override needs only a reload.
 *
 * (The offline-downloads flag was removed in PR 2.6 of the offline spec.)
 */

export interface FlagEnv {
  envValue?: string;
  storage?: Pick<Storage, "getItem"> | null;
}

function deviceStorage(): Storage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null; // access itself can throw (blocked storage)
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
  return { envValue: import.meta.env.VITE_PUSH_NOTIFICATIONS, storage: deviceStorage() };
}

export function isPushNotificationsEnabled(env: FlagEnv = pushEnv()): boolean {
  if (env.envValue === "true") return true;
  try {
    return env.storage?.getItem(PUSH_FLAG_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** URL names accepted by `?flag=`, mapped to their per-device storage keys. */
const FLAG_PARAM_KEYS: Record<string, string> = {
  push: PUSH_FLAG_STORAGE_KEY,
};

/**
 * `?flag=push` sets the per-device override and `?flag=-push` removes it
 * (several with commas or repeated params), for devices where
 * the console can't be opened. Called once from `main.tsx` before the first
 * render. Returns the URL without the `flag` params when there were any
 * (the caller `replaceState`s it), else null. Unknown names are ignored but
 * still dropped from the URL. Like the override itself, it only shows UI.
 */
export function applyFlagParams(
  href: string,
  storage: Pick<Storage, "setItem" | "removeItem"> | null = deviceStorage(),
): string | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  const values = url.searchParams.getAll("flag");
  if (values.length === 0) return null;
  for (const raw of values.flatMap((v) => v.split(","))) {
    const name = raw.trim();
    const off = name.startsWith("-");
    const key = FLAG_PARAM_KEYS[off ? name.slice(1) : name];
    if (!key) continue;
    try {
      if (off) storage?.removeItem(key);
      else storage?.setItem(key, "1");
    } catch {
      // blocked storage: nothing to persist, the flag stays off
    }
  }
  url.searchParams.delete("flag");
  return url.pathname + url.search + url.hash;
}
