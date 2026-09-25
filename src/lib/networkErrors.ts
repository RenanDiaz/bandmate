import { isAuthRetryableFetchError } from "@supabase/supabase-js";

// What each engine puts in the TypeError when fetch() can't reach the server.
const FETCH_FAILURE_MESSAGES = [
  "failed to fetch", // Chromium
  "load failed", // Safari
  "networkerror when attempting to fetch resource", // Firefox
  "network request failed", // React Native / polyfills
];

function isFetchFailureMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return FETCH_FAILURE_MESSAGES.some((m) => lower.includes(m));
}

/**
 * True when a request failed because the server couldn't be reached (offline,
 * weak signal, captive portal, aborted or timed out), false for an answer
 * from the server (HTTP 4xx/5xx, PostgREST or auth errors with a code).
 *
 * Recognizes:
 * - the `TypeError` fetch() rejects with;
 * - a `DOMException` named `AbortError` or `TimeoutError`;
 * - postgrest-js's wrapper for a rejected fetch: `{ message: "TypeError: …",
 *   code: "" }` (PostgrestBuilder turns the rejection into an error object);
 * - auth-js's `AuthRetryableFetchError`.
 */
export function isNetworkError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if (isAuthRetryableFetchError(error)) return true;

  const { name, message, code } = error as { name?: unknown; message?: unknown; code?: unknown };
  if (name === "AbortError" || name === "TimeoutError") return true;
  if (typeof message !== "string") return false;
  if (error instanceof TypeError) return isFetchFailureMessage(message);

  // postgrest-js: `${fetchError.name}: ${fetchError.message}` with an empty code.
  if (code === "" || code === undefined) {
    if (/^(AbortError|TimeoutError)\b/.test(message)) return true;
    if (/^(TypeError|FetchError)\b/.test(message)) return isFetchFailureMessage(message);
  }
  return false;
}
