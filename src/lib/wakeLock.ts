/**
 * Screen Wake Lock while an offline download runs (PR 2.3). iOS suspends a
 * page's JavaScript when the screen locks or the PWA goes to the background,
 * which interrupts a long download; keeping the screen on avoids the first.
 *
 * Feature-detected: without `navigator.wakeLock` (or when the request is
 * refused: low battery, not visible) it does nothing. The browser releases the
 * lock whenever the page is hidden, so it is requested again on
 * `visibilitychange` while still wanted. Never throws.
 */

interface WakeLockSentinelLike {
  released?: boolean;
  release(): Promise<void>;
  addEventListener?(type: "release", listener: () => void): void;
}

interface WakeLockLike {
  request(type: "screen"): Promise<WakeLockSentinelLike>;
}

/** The part of `document` used here (a real Document satisfies it). */
export interface VisibilityTarget {
  visibilityState: DocumentVisibilityState;
  addEventListener(type: "visibilitychange", listener: () => void): void;
  removeEventListener(type: "visibilitychange", listener: () => void): void;
}

export interface WakeLockEnv {
  wakeLock?: WakeLockLike;
  document?: VisibilityTarget;
}

export interface ScreenWakeLock {
  /** Keep the screen on until release(). Idempotent. */
  acquire(): void;
  release(): void;
}

function defaultEnv(): WakeLockEnv {
  return {
    wakeLock: typeof navigator !== "undefined" ? (navigator as { wakeLock?: WakeLockLike }).wakeLock : undefined,
    document: typeof document !== "undefined" ? document : undefined,
  };
}

export function createScreenWakeLock(getEnv: () => WakeLockEnv = defaultEnv): ScreenWakeLock {
  let wanted = false;
  let sentinel: WakeLockSentinelLike | null = null;
  let requesting = false;
  let doc: WakeLockEnv["document"];

  const request = () => {
    const { wakeLock } = getEnv();
    if (!wanted || sentinel || requesting || !wakeLock?.request) return;
    if (doc && doc.visibilityState !== "visible") return;
    requesting = true;
    wakeLock
      .request("screen")
      .then((lock) => {
        requesting = false;
        if (!wanted) {
          void lock.release().catch(() => undefined);
          return;
        }
        sentinel = lock;
        lock.addEventListener?.("release", () => {
          if (sentinel === lock) sentinel = null;
        });
      })
      .catch((error: unknown) => {
        requesting = false;
        console.warn("Screen wake lock unavailable:", error);
      });
  };

  const onVisibility = () => {
    if (doc?.visibilityState === "visible") {
      if (sentinel?.released) sentinel = null;
      request();
    }
  };

  return {
    acquire() {
      if (wanted) return;
      wanted = true;
      doc = getEnv().document;
      doc?.addEventListener("visibilitychange", onVisibility);
      request();
    },
    release() {
      if (!wanted) return;
      wanted = false;
      doc?.removeEventListener("visibilitychange", onVisibility);
      doc = undefined;
      const lock = sentinel;
      sentinel = null;
      void lock?.release().catch(() => undefined);
    },
  };
}
