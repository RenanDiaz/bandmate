import { describe, expect, it, vi } from "vitest";
import { createScreenWakeLock } from "../wakeLock";

function fakeEnv() {
  const sentinels: Array<{ released: boolean; release: ReturnType<typeof vi.fn>; fire: () => void }> = [];
  const wakeLock = {
    request: vi.fn(async () => {
      let onRelease: () => void = () => undefined;
      const s = {
        released: false,
        release: vi.fn(async () => {
          s.released = true;
        }),
        addEventListener: (_t: "release", fn: () => void) => {
          onRelease = fn;
        },
        fire: () => {
          s.released = true;
          onRelease();
        },
      };
      sentinels.push(s);
      return s;
    }),
  };
  const listeners = new Set<() => void>();
  const document = {
    visibilityState: "visible" as DocumentVisibilityState,
    addEventListener: (_t: string, fn: () => void) => void listeners.add(fn),
    removeEventListener: (_t: string, fn: () => void) => void listeners.delete(fn),
  };
  const setVisible = (visible: boolean) => {
    document.visibilityState = visible ? "visible" : "hidden";
    for (const fn of listeners) fn();
  };
  return { env: { wakeLock, document }, wakeLock, sentinels, setVisible, listeners };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("createScreenWakeLock", () => {
  it("requests on acquire and releases on release", async () => {
    const f = fakeEnv();
    const lock = createScreenWakeLock(() => f.env);
    lock.acquire();
    lock.acquire();
    await tick();
    expect(f.wakeLock.request).toHaveBeenCalledTimes(1);
    lock.release();
    expect(f.sentinels[0].release).toHaveBeenCalled();
    expect(f.listeners.size).toBe(0);
  });

  it("re-acquires when the page is visible again after the system released it", async () => {
    const f = fakeEnv();
    const lock = createScreenWakeLock(() => f.env);
    lock.acquire();
    await tick();
    f.setVisible(false);
    f.sentinels[0].fire(); // browsers release the lock when hidden
    f.setVisible(true);
    await tick();
    expect(f.wakeLock.request).toHaveBeenCalledTimes(2);
    lock.release();
  });

  it("does not request while hidden", async () => {
    const f = fakeEnv();
    f.env.document.visibilityState = "hidden";
    const lock = createScreenWakeLock(() => f.env);
    lock.acquire();
    await tick();
    expect(f.wakeLock.request).not.toHaveBeenCalled();
  });

  it("is a no-op without the API and never throws on refusal", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(() => {
      const none = createScreenWakeLock(() => ({}));
      none.acquire();
      none.release();
    }).not.toThrow();
    const refusing = createScreenWakeLock(() => ({ wakeLock: { request: () => Promise.reject(new Error("NotAllowedError")) } }));
    refusing.acquire();
    await tick();
    expect(warn).toHaveBeenCalled();
  });

  it("releases a lock granted after release() was called", async () => {
    const f = fakeEnv();
    const lock = createScreenWakeLock(() => f.env);
    lock.acquire();
    lock.release();
    await tick();
    expect(f.sentinels[0].release).toHaveBeenCalled();
  });
});
