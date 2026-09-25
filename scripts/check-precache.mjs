#!/usr/bin/env node
// Fails the build when a shell file in dist/ is missing from the service
// worker's precache manifest.
//
// Workbox drops files above `maximumFileSizeToCacheInBytes` (or outside
// `globPatterns`) with only a warning, and the app then fails to start offline.
// Run by `npm run build` after the client build; see vite.config.ts.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = fileURLToPath(new URL("../dist/", import.meta.url));
const SW_FILE = join(DIST, "sw.js");
const SHELL_EXTENSIONS = /\.(?:js|mjs|css|html)$/;
// The worker and its runtime are loaded by the browser, not precached.
const NOT_PRECACHED = [/^sw\.js$/, /^workbox-[\w-]+\.js$/];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

let sw;
try {
  sw = readFileSync(SW_FILE, "utf8");
} catch {
  console.error(`[check-precache] ${SW_FILE} not found — did the client build run?`);
  process.exit(1);
}

const precached = new Set([...sw.matchAll(/\burl:\s*"([^"]+)"/g)].map((m) => m[1]));
if (precached.size === 0) {
  console.error("[check-precache] No precache manifest found in dist/sw.js.");
  process.exit(1);
}

const shellFiles = walk(DIST)
  .map((path) => relative(DIST, path).split(sep).join("/"))
  .filter((file) => SHELL_EXTENSIONS.test(file))
  .filter((file) => !NOT_PRECACHED.some((pattern) => pattern.test(file)));

const missing = shellFiles.filter((file) => !precached.has(file));

if (missing.length > 0) {
  console.error("[check-precache] These files are not in the service worker precache,");
  console.error("so the app would not start offline:");
  for (const file of missing) {
    const bytes = statSync(join(DIST, file)).size;
    console.error(`  - ${file} (${bytes.toLocaleString("en-US")} B)`);
  }
  console.error(
    "Check `maximumFileSizeToCacheInBytes`, `globPatterns` and `globIgnores` in vite.config.ts."
  );
  process.exit(1);
}

console.log(`[check-precache] OK — ${shellFiles.length} shell files precached.`);
