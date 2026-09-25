/**
 * iOS / installed-app detection for the offline download copy (spec §9.1):
 * on iOS a home-screen app has its own storage, separate from Safari, so a
 * copy saved in a Safari tab is not available in the installed app.
 */

export interface PlatformEnv {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
  /** iOS Safari's non-standard flag for home-screen apps. */
  standalone?: boolean;
  matchMedia?: (query: string) => { matches: boolean };
}

function defaultEnv(): PlatformEnv {
  if (typeof navigator === "undefined") return {};
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
    standalone: (navigator as { standalone?: boolean }).standalone,
    matchMedia: typeof window !== "undefined" && window.matchMedia ? (q) => window.matchMedia(q) : undefined,
  };
}

/** iPhone, iPod, iPad — including iPadOS, which reports itself as a Mac with touch. */
export function isIOS(env: PlatformEnv = defaultEnv()): boolean {
  const ua = env.userAgent ?? "";
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return env.platform === "MacIntel" && (env.maxTouchPoints ?? 0) > 1;
}

/** Running as an installed app (display-mode: standalone), not in a browser tab. */
export function isStandalone(env: PlatformEnv = defaultEnv()): boolean {
  if (env.standalone === true) return true;
  try {
    return env.matchMedia?.("(display-mode: standalone)").matches === true;
  } catch {
    return false;
  }
}
