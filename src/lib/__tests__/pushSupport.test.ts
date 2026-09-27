import { describe, expect, it, vi } from "vitest";
import {
  PushSupportError,
  base64UrlToBytes,
  getPushStatus,
  subscribeThisDevice,
  syncThisDevice,
  unsubscribeThisDevice,
  updateThisDeviceLocale,
} from "../pushSupport";
import type { PushEnv } from "../pushSupport";

vi.mock("../../services/pushSubscriptionService", () => ({
  savePushSubscription: vi.fn(),
  deletePushSubscription: vi.fn(),
  updatePushSubscriptionLocale: vi.fn(),
}));

// 65-byte P-256 public key, base64url (the shape `npm run vapid-keys` prints).
const KEY = "BAAsQ9dISkxZUjMpY9Ypo_n7VZKw27MWDh8I-S-NgGXAIuAmBbdYVP20vQCfY1beLP73iG7dvI6C2VEbZIyscio";

function fakeSubscription(endpoint = "https://push.example/ep1", key = base64UrlToBytes(KEY)) {
  return {
    endpoint,
    options: { applicationServerKey: key.buffer },
    toJSON: () => ({ endpoint, keys: { p256dh: "p256dh-value", auth: "auth-value" } }),
    unsubscribe: vi.fn(async () => true),
  } as unknown as PushSubscription & { unsubscribe: ReturnType<typeof vi.fn> };
}

function env(overrides: Partial<PushEnv> = {}, existing: PushSubscription | null = null) {
  let current = existing;
  const pushManager = {
    getSubscription: vi.fn(async () => current),
    subscribe: vi.fn(async () => {
      current = fakeSubscription("https://push.example/new");
      return current;
    }),
  };
  const permission: { value: NotificationPermission } = { value: "default" };
  const base: PushEnv = {
    ios: false,
    standalone: false,
    notification: {
      get permission() {
        return permission.value;
      },
      requestPermission: vi.fn(async () => {
        permission.value = "granted";
        return "granted" as NotificationPermission;
      }),
    },
    getRegistration: vi.fn(async () => ({ pushManager }) as unknown as ServiceWorkerRegistration),
    vapidPublicKey: KEY,
    save: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
    updateLocale: vi.fn(async () => {}),
  };
  return { env: { ...base, ...overrides }, pushManager, permission };
}

describe("pushSupport status", () => {
  it("iOS in a browser tab needs the installed app", async () => {
    expect(await getPushStatus(env({ ios: true, standalone: false, notification: null, getRegistration: null }).env)).toBe(
      "needs-install"
    );
  });

  it("without Notification or PushManager it is unsupported", async () => {
    expect(await getPushStatus(env({ notification: null }).env)).toBe("unsupported");
    expect(await getPushStatus(env({ getRegistration: null }).env)).toBe("unsupported");
  });

  it("reports denied, off and on", async () => {
    const denied = env();
    denied.permission.value = "denied";
    expect(await getPushStatus(denied.env)).toBe("denied");
    expect(await getPushStatus(env().env)).toBe("off");
    expect(await getPushStatus(env({}, fakeSubscription()).env)).toBe("on");
    expect(await getPushStatus(env({ ios: true, standalone: true }, fakeSubscription()).env)).toBe("on");
  });

  it("never waits for a worker to check the status", async () => {
    const { env: e } = env();
    await getPushStatus(e);
    expect(e.getRegistration).toHaveBeenCalledWith(false);
  });
});

describe("pushSupport subscribe", () => {
  it("asks permission first, subscribes with the VAPID key and saves the row with the locale", async () => {
    const { env: e, pushManager } = env();
    await subscribeThisDevice("es-PA", e);

    expect(e.notification?.requestPermission).toHaveBeenCalledTimes(1);
    expect(e.getRegistration).toHaveBeenCalledWith(true);
    const options = pushManager.subscribe.mock.calls[0] as unknown as [PushSubscriptionOptionsInit];
    expect(options[0].userVisibleOnly).toBe(true);
    expect(new Uint8Array(options[0].applicationServerKey as Uint8Array)).toEqual(base64UrlToBytes(KEY));
    expect(e.save).toHaveBeenCalledWith(
      { endpoint: "https://push.example/new", p256dh: "p256dh-value", auth: "auth-value" },
      "es-PA"
    );
  });

  it("maps a refused and a dismissed prompt", async () => {
    const refused = env();
    vi.mocked(refused.env.notification!.requestPermission).mockResolvedValueOnce("denied");
    await expect(subscribeThisDevice("en", refused.env)).rejects.toMatchObject({ code: "denied" });

    const dismissed = env();
    vi.mocked(dismissed.env.notification!.requestPermission).mockResolvedValueOnce("default");
    await expect(subscribeThisDevice("en", dismissed.env)).rejects.toMatchObject({ code: "dismissed" });
    expect(dismissed.pushManager.subscribe).not.toHaveBeenCalled();
  });

  it("fails without a VAPID key or a worker", async () => {
    await expect(subscribeThisDevice("en", env({ vapidPublicKey: undefined }).env)).rejects.toMatchObject({
      code: "no-key",
    });
    await expect(subscribeThisDevice("en", env({ getRegistration: vi.fn(async () => undefined) }).env)).rejects.toMatchObject({
      code: "no-worker",
    });
  });

  it("reuses a subscription with the same key and replaces one made with other keys", async () => {
    const same = fakeSubscription();
    const reuse = env({}, same);
    await subscribeThisDevice("en", reuse.env);
    expect(reuse.pushManager.subscribe).not.toHaveBeenCalled();
    expect(reuse.env.save).toHaveBeenCalledWith(expect.objectContaining({ endpoint: "https://push.example/ep1" }), "en");

    const old = fakeSubscription("https://push.example/old", new Uint8Array(65).fill(7));
    const rotated = env({}, old);
    await subscribeThisDevice("en", rotated.env);
    expect(old.unsubscribe).toHaveBeenCalledTimes(1);
    expect(rotated.pushManager.subscribe).toHaveBeenCalledTimes(1);
  });

  it("unsubscribes the browser again when the row can't be saved", async () => {
    const { env: e, pushManager } = env({ save: vi.fn(async () => Promise.reject(new Error("rls"))) });
    await expect(subscribeThisDevice("en", e)).rejects.toBeInstanceOf(PushSupportError);
    const created = (await pushManager.getSubscription()) as unknown as { unsubscribe: ReturnType<typeof vi.fn> };
    expect(created.unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe("pushSupport sync, locale and unsubscribe", () => {
  it("sync re-saves an existing subscription and does nothing without one", async () => {
    const withSub = env({}, fakeSubscription());
    await syncThisDevice("es", withSub.env);
    expect(withSub.env.save).toHaveBeenCalledTimes(1);

    const without = env();
    await syncThisDevice("es", without.env);
    expect(without.env.save).not.toHaveBeenCalled();
  });

  it("updates the locale only when subscribed", async () => {
    const withSub = env({}, fakeSubscription());
    await updateThisDeviceLocale("es", withSub.env);
    expect(withSub.env.updateLocale).toHaveBeenCalledWith("https://push.example/ep1", "es");

    const without = env();
    await updateThisDeviceLocale("es", without.env);
    expect(without.env.updateLocale).not.toHaveBeenCalled();
  });

  it("deletes the row, then unsubscribes the browser", async () => {
    const sub = fakeSubscription();
    const order: string[] = [];
    const { env: e } = env({ remove: vi.fn(async () => void order.push("remove")) }, sub);
    sub.unsubscribe.mockImplementation(async () => {
      order.push("unsubscribe");
      return true;
    });
    await unsubscribeThisDevice(e);
    expect(order).toEqual(["remove", "unsubscribe"]);
  });

  it("still unsubscribes the browser when the row delete fails or hangs", async () => {
    vi.useFakeTimers();
    try {
      const failing = fakeSubscription();
      await unsubscribeThisDevice(env({ remove: vi.fn(async () => Promise.reject(new Error("offline"))) }, failing).env);
      expect(failing.unsubscribe).toHaveBeenCalledTimes(1);

      const hanging = fakeSubscription();
      const done = unsubscribeThisDevice(env({ remove: vi.fn(() => new Promise<void>(() => {})) }, hanging).env);
      await vi.advanceTimersByTimeAsync(3000);
      await done;
      expect(hanging.unsubscribe).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does nothing without a subscription or a service worker", async () => {
    const { env: e } = env();
    await unsubscribeThisDevice(e);
    expect(e.remove).not.toHaveBeenCalled();
    await expect(unsubscribeThisDevice(env({ getRegistration: null }).env)).resolves.toBeUndefined();
  });
});

describe("base64UrlToBytes", () => {
  it("decodes an unpadded base64url P-256 key", () => {
    const bytes = base64UrlToBytes(KEY);
    expect(bytes.length).toBe(65);
    expect(bytes[0]).toBe(4); // uncompressed point
  });
});
