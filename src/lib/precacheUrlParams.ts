/**
 * Query parameter *names* the service worker's precache lookup ignores
 * (Workbox `ignoreURLParametersMatching`, used by vite.config.ts). Applies to
 * precache lookups only, never to runtime caching.
 *
 * The first two are Workbox's defaults. The third matches only a parameter
 * whose name is exactly 32 lower-case hex characters: bootstrap-icons.css asks
 * for its fonts as `bootstrap-icons.woff2?<32-hex>` (a bare key, no value), and
 * without it the lookup missed offline and every icon was blank (PR 2.5).
 * `?v=<hex>`, upper-case, other lengths and ordinary params are kept.
 */
export const PRECACHE_IGNORED_URL_PARAMS: RegExp[] = [/^utm_/, /^fbclid$/, /^[0-9a-f]{32}$/];
