import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { removeIgnoredSearchParams } from "workbox-precaching/utils/removeIgnoredSearchParams.js";
import { PRECACHE_IGNORED_URL_PARAMS } from "../precacheUrlParams";

// Workbox's own helper, as the precache route runs it on every lookup.
const strip = (url: string) => {
  const u = removeIgnoredSearchParams(new URL(url, "https://www.bandmate.space"), PRECACHE_IGNORED_URL_PARAMS);
  return u.pathname + u.search;
};

describe("precache ignored URL params (bootstrap-icons offline)", () => {
  it("strips the cache-buster bootstrap-icons.css really uses", () => {
    const css = readFileSync("node_modules/bootstrap-icons/font/bootstrap-icons.css", "utf8");
    const fontUrls = [...css.matchAll(/url\("?([^")]+\.woff2?\?[^")]+)"?\)/g)].map((m) => m[1]);
    expect(fontUrls.length).toBeGreaterThan(0);
    for (const url of fontUrls) {
      const path = `/assets/${url.split("/").pop()}`;
      expect(strip(path)).toBe(path.split("?")[0]);
    }
  });

  it("keeps every other parameter", () => {
    const hex = "e34853135f9e39acf64315236852cd5a";
    for (const url of [
      `/assets/index.js?v=${hex}`, // hex as a value
      `/assets/index.js?${hex.toUpperCase()}`,
      `/assets/index.js?${hex.slice(1)}`, // 31
      `/assets/index.js?${hex}b`, // 33
      "/assets/index.js?select=*&band_id=eq.7",
      "/index.html?token=abc",
    ]) {
      expect(strip(url)).toBe(url);
    }
    expect(strip("/index.html?utm_source=x&fbclid=y&token=abc")).toBe("/index.html?token=abc");
  });
});
