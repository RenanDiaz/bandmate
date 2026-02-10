/**
 * Polyfills for older browsers (Safari < 18 / iOS < 18).
 *
 * URL.parse() is used internally by pdfjs-dist v5.x but only exists in
 * Safari 18+.  Without this polyfill the PDF viewer crashes the entire
 * React tree on older iOS devices.
 */

// Type augmentation – TypeScript's DOM lib doesn't include URL.parse yet.
declare global {
  interface URLConstructor {
    parse(url: string, base?: string | URL): URL | null;
  }
}

if (typeof URL.parse !== "function") {
  URL.parse = function (url: string, base?: string | URL): URL | null {
    try {
      return new URL(url, base);
    } catch {
      return null;
    }
  };
}

export {};
