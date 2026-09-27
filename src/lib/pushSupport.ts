import { isIOS, isStandalone } from "./platform";
import {
  deletePushSubscription,
  savePushSubscription,
  updatePushSubscriptionLocale,
} from "../services/pushSubscriptionService";
import type { PushSubscriptionKeys } from "../services/pushSubscriptionService";

/**
 * This device's Web Push state (docs/specs/band-push-notifications.md §2.2,
 * §3.4). Plain TS with injectable browser APIs, unit-tested.
 *
 * It never registers a service worker: it uses the registration PwaUpdater
 * made (the Workbox worker, which imports public/push-sw.js in builds).
 */

export type PushStatus = "unsupported" | "needs-install" | "denied" | "off" | "on";

export interface PushEnv {
  ios: boolean;
  standalone: boolean;
  /** null when the browser has no Notification API */
  notification: { permission: NotificationPermission; requestPermission: () => Promise<NotificationPermission> } | null;
  /**
   * null when there is no service worker or PushManager. `wait`: wait (bounded)
   * for a registration still starting; without it, none means no subscription.
   */
  getRegistration: ((wait: boolean) => Promise<Pick<ServiceWorkerRegistration, "pushManager"> | undefined>) | null;
  vapidPublicKey: string | undefined;
  save: (subscription: PushSubscriptionKeys, locale: string) => Promise<void>;
  remove: (endpoint: string) => Promise<void>;
  updateLocale: (endpoint: string, locale: string) => Promise<void>;
}

/** How long sign-out waits for the row delete before going on (the sender drops dead endpoints anyway). */
export const REMOVE_TIMEOUT_MS = 3000;
const REGISTRATION_TIMEOUT_MS = 5000;

export type PushSupportErrorCode = "unsupported" | "denied" | "dismissed" | "no-key" | "no-worker" | "failed";

export class PushSupportError extends Error {
  readonly code: PushSupportErrorCode;

  constructor(code: PushSupportErrorCode, message?: string) {
    super(message ?? code);
    this.name = "PushSupportError";
    this.code = code;
  }
}

function browserEnv(): PushEnv {
  const hasNotification = typeof Notification !== "undefined";
  const hasPush =
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof window !== "undefined" &&
    "PushManager" in window;
  return {
    ios: isIOS(),
    standalone: isStandalone(),
    notification: hasNotification
      ? {
          get permission() {
            return Notification.permission;
          },
          requestPermission: () => Notification.requestPermission(),
        }
      : null,
    getRegistration: hasPush
      ? async (wait) => {
          const existing = await navigator.serviceWorker.getRegistration("/");
          if (existing || !wait) return existing;
          return Promise.race([
            navigator.serviceWorker.ready,
            new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), REGISTRATION_TIMEOUT_MS)),
          ]);
        }
      : null,
    vapidPublicKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
    save: savePushSubscription,
    remove: deletePushSubscription,
    updateLocale: updatePushSubscriptionLocale,
  };
}

/** base64url (the VAPID public key) → bytes for `applicationServerKey`. */
export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a) return false;
  const bytes = new Uint8Array(a);
  if (bytes.length !== b.length) return false;
  return bytes.every((value, i) => value === b[i]);
}

function toKeys(subscription: PushSubscription): PushSubscriptionKeys {
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) throw new PushSupportError("failed", "subscription without keys");
  return { endpoint: json.endpoint, p256dh, auth };
}

async function currentSubscription(env: PushEnv): Promise<PushSubscription | null> {
  if (!env.getRegistration) return null;
  const registration = await env.getRegistration(false);
  return (await registration?.pushManager.getSubscription()) ?? null;
}

/**
 * What the settings modal shows for this device. `on` means this browser is
 * subscribed; whether the server still has the row is `syncThisDevice`'s job.
 */
export async function getPushStatus(env: PushEnv = browserEnv()): Promise<PushStatus> {
  // iOS / iPadOS only offers Web Push to the app added to the Home Screen.
  if (env.ios && !env.standalone) return "needs-install";
  if (!env.notification || !env.getRegistration) return "unsupported";
  if (env.notification.permission === "denied") return "denied";
  try {
    return (await currentSubscription(env)) ? "on" : "off";
  } catch {
    return "off";
  }
}

/**
 * Turn notifications on for this device. Call it straight from the tap
 * handler: iOS only shows the permission prompt inside a user gesture, so the
 * prompt is the first thing it does.
 */
export async function subscribeThisDevice(locale: string, env: PushEnv = browserEnv()): Promise<void> {
  if (!env.notification || !env.getRegistration) throw new PushSupportError("unsupported");
  const permission =
    env.notification.permission === "granted" ? "granted" : await env.notification.requestPermission();
  if (permission === "denied") throw new PushSupportError("denied");
  if (permission !== "granted") throw new PushSupportError("dismissed");
  if (!env.vapidPublicKey) throw new PushSupportError("no-key", "VITE_VAPID_PUBLIC_KEY is not set");

  const registration = await env.getRegistration(true);
  if (!registration) throw new PushSupportError("no-worker");
  const key = base64UrlToBytes(env.vapidPublicKey);

  let subscription = await registration.pushManager.getSubscription();
  // A subscription made with other VAPID keys can't be reused (keys rotated).
  if (subscription && !sameKey(subscription.options.applicationServerKey, key)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  if (!subscription) {
    try {
      subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    } catch (error) {
      throw new PushSupportError("failed", error instanceof Error ? error.message : String(error));
    }
  }

  try {
    await env.save(toKeys(subscription), locale);
  } catch (error) {
    // No row, no pushes: don't leave the browser looking subscribed.
    await subscription.unsubscribe().catch(() => {});
    throw new PushSupportError("failed", error instanceof Error ? error.message : String(error));
  }
}

/**
 * Re-register this browser's existing subscription for the current user
 * (the row may have been dropped after a 404/410) and refresh its language.
 * Only called where the user looks at their notification settings — never on
 * app start: after someone else signed in on this browser, it would subscribe
 * them without asking.
 */
export async function syncThisDevice(locale: string, env: PushEnv = browserEnv()): Promise<void> {
  const subscription = await currentSubscription(env);
  if (subscription) await env.save(toKeys(subscription), locale);
}

/** The app's language changed: follow it in the pushes, if this device is subscribed. */
export async function updateThisDeviceLocale(locale: string, env: PushEnv = browserEnv()): Promise<void> {
  const subscription = await currentSubscription(env);
  if (subscription) await env.updateLocale(subscription.endpoint, locale);
}

/**
 * Turn notifications off for this device: delete the row (bounded, so an
 * offline sign-out isn't held up), then unsubscribe the browser, which works
 * offline. A row left behind points at a dead endpoint and the sender deletes
 * it on the next push (404/410).
 */
export async function unsubscribeThisDevice(env: PushEnv = browserEnv()): Promise<void> {
  const subscription = await currentSubscription(env);
  if (!subscription) return;
  try {
    await Promise.race([
      env.remove(subscription.endpoint),
      new Promise((resolve) => setTimeout(resolve, REMOVE_TIMEOUT_MS)),
    ]);
  } catch (error) {
    console.warn("Push subscription row not deleted:", error);
  }
  await subscription.unsubscribe();
}
