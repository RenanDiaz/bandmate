# Landing page & SEO

The app is a single-page app, but the marketing landing at `/` is **prerendered
at build time**. This document explains why, and what you have to keep in mind
when touching it.

## Why prerender at all

Before this, requesting `https://www.bandmate.space/` returned an empty
`<div id="root"></div>` plus a few meta tags. That has three concrete costs:

- Search engines index an empty page (or nothing at all).
- Link-preview crawlers — WhatsApp, Instagram DMs, Discord, Slack — do not run
  JavaScript and do not wait for hydration, so shared links look broken.
- Visitors see a blank frame until a ~2 MB bundle parses.

Only `/` is prerendered. The authenticated app stays a pure SPA; nothing about
routing, auth or data loading changed.

## How it works

| Piece | Role |
|---|---|
| `src/components/LandingPage.tsx` | The landing itself. No context, no data fetching, no browser APIs — it must render identically in Node and in the browser. |
| `src/components/AppPreview.tsx` | The hero visual: the setlist view drawn with the app's own design tokens and clearly-labelled sample data. |
| `src/entry-server.tsx` | Renders `<LandingPage />` with `renderToString`, collects the styled-components CSS, and builds the FAQ structured data. |
| `bandmateSeo()` in `vite.config.ts` | Injects that HTML, CSS and JSON-LD into `index.html`, and emits `robots.txt` and `sitemap.xml`. |
| `src/lib/siteConfig.ts` | Canonical origin, OG image, indexable routes. Single source of truth. |

`npm run build` therefore runs three steps:

```
tsc -b
vite build --ssr src/entry-server.tsx --outDir dist-ssr   # produces the renderer
vite build                                                # injects its output
```

Running plain `vite build` still succeeds — it just logs a warning and ships the
old empty shell, so a half-run build never fails silently at deploy time.

The prerendered markup is **not hydrated**. `main.tsx` uses `createRoot`, which
discards the static DOM on its first commit and renders the real app over it.
That is why `entry-server.tsx` is free to render a signed-out landing regardless
of who is visiting, and why `main.tsx` drops the `#prerender-styles` tag two
frames after mount.

## Rules when editing

1. **Keep `LandingPage` SSR-safe.** No `window`, `localStorage`, `useBandContext`,
   Supabase or `Date.now()`. If you need any of those, put them in a child that
   the landing does not render.
2. **All copy goes through `t()`**, in both `en.json` and `es.json`. The
   prerendered shell is English (a crawler has no language preference to read);
   visitors get their own language the moment the SPA boots.
3. **Change the canonical host in one place** — `SITE_URL` in `siteConfig.ts` —
   and update the matching host redirect in `vercel.json` at the same time.
4. **Adding an indexable route?** Add it to `PUBLIC_ROUTES`. That single list
   drives both the sitemap and the `noindex` decision in `SEO.tsx`.

## Assets

- `npm run og` regenerates `public/og-image.png` (1200×630) from `scripts/generate-og-image.mjs`.
- `npm run icons` regenerates the PWA icons.

Both are committed, so a normal build does not need `sharp`.

## Known gaps

- The hero shows a faithful mock of the setlist view, not a screenshot of a live
  band's data. Swapping in a real screenshot is a copy/asset change only.
- There is no signed-out demo yet. That remains the single highest-leverage
  conversion change: it would let visitors touch the app before handing over an
  email, and it would supply the real hero screenshot for free.
- The brand colour is still `#8B5CF6` (Tailwind's `violet-500`). Moving off it is
  a whole-app design change — `theme.ts`, `design-tokens.css`, the icons and the
  `theme-color` meta — and was deliberately left out of this pass.
