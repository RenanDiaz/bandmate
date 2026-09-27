/* Band push notifications (docs/specs/band-push-notifications.md §1 decision 4).
 *
 * Loaded into the Workbox-generated worker with `importScripts` (vite.config.ts),
 * so it must stay a dependency-free classic script. Only `push` and
 * `notificationclick` live here: no fetch handling, no caching, and never
 * `skipWaiting` / `clientsClaim` (the app reloads only when the user taps
 * Reload).
 *
 * The payload is the JSON built by supabase/functions/_shared/pushMessages.ts:
 * { title, body, url, tag }. Every push shows a notification: browsers require
 * it (userVisibleOnly) and Safari drops subscriptions that receive silent ones.
 */

self.addEventListener("push", (event) => {
  let message = null;
  try {
    message = event.data ? event.data.json() : null;
  } catch {
    message = null;
  }

  const title = (message && typeof message.title === "string" && message.title) || "Bandmate";
  const options = {
    body: (message && typeof message.body === "string" && message.body) || "",
    tag: (message && typeof message.tag === "string" && message.tag) || undefined,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: (message && typeof message.url === "string" && message.url) || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const raw = (event.notification.data && event.notification.data.url) || "/";
  // Only paths of this app: a payload can't send the user elsewhere.
  const target = new URL(raw, self.location.origin);
  const url = target.origin === self.location.origin ? target.href : self.location.origin + "/";

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const client = windows.find((c) => new URL(c.url).origin === self.location.origin);
      if (client) {
        // navigate() needs a controlled client; fall back to a new window.
        try {
          const focused = await client.focus();
          if ("navigate" in focused) {
            await focused.navigate(url);
            return;
          }
        } catch {
          // fall through
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});
