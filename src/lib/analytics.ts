// Vercel Web Analytics: page views and where visits come from (referrer,
// country, device), cookieless and with no per-user id. It loads Vercel's own
// script instead of the `@vercel/analytics` package, whose optional Remix peer
// (React 18) makes npm refuse to install it next to React 19. The protocol is
// the one that package uses: a `window.va` queue the script drains on load.

export interface AnalyticsEvent {
  type: "pageview" | "event";
  url: string;
}

type VaQueueFn = (command: string, payload?: unknown) => void;

declare global {
  interface Window {
    va?: VaQueueFn;
    vaq?: unknown[][];
  }
}

/** Served by Vercel on every deployment once Web Analytics is enabled. */
export const ANALYTICS_SCRIPT_SRC = "/_vercel/insights/script.js";

/**
 * Keep only origin + path. Query strings can carry an invitation token
 * (`/invite/accept?token=…`) and the hash is never a page, so neither leaves
 * the browser.
 */
export function sanitizeAnalyticsEvent(event: AnalyticsEvent): AnalyticsEvent | null {
  try {
    const url = new URL(event.url);
    return { ...event, url: url.origin + url.pathname };
  } catch {
    return null;
  }
}

/**
 * Inject the script once. Production only (the path 404s in `npm run dev`),
 * and not while offline: the service worker doesn't cache it, so the request
 * would only fail.
 */
export function installAnalytics(doc: Document = document, win: Window = window): void {
  if (doc.querySelector(`script[src="${ANALYTICS_SCRIPT_SRC}"]`)) return;
  if (win.navigator.onLine === false) return;

  win.va =
    win.va ??
    ((...args: unknown[]) => {
      (win.vaq = win.vaq ?? []).push(args);
    });
  win.va("beforeSend", sanitizeAnalyticsEvent);

  const script = doc.createElement("script");
  script.src = ANALYTICS_SCRIPT_SRC;
  script.defer = true;
  doc.head.appendChild(script);
}
