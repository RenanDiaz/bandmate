import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { PUBLIC_ROUTES, SITE_URL, absoluteUrl } from './src/lib/siteConfig'

const rootDir = dirname(fileURLToPath(import.meta.url))
const SSR_ENTRY = resolve(rootDir, 'dist-ssr/entry-server.js')

/** App routes that are band-scoped or single-use and must stay out of the index. */
const DISALLOWED_PATHS = [
  '/songs',
  '/setlists',
  '/shows',
  '/rehearsals',
  '/requests',
  '/bands',
  '/invite',
]

/**
 * Bakes the landing route into `index.html` and emits robots.txt / sitemap.xml.
 *
 * `npm run build` runs the SSR build first (see package.json), so by the time
 * the client build transforms the HTML there is a `dist-ssr/entry-server.js` to
 * import. If it is missing the build still succeeds — it just ships the old
 * empty-shell HTML — so a partial build never fails silently at deploy time.
 */
function bandmateSeo(): Plugin {
  return {
    name: 'bandmate-seo',
    apply: 'build',

    transformIndexHtml: {
      order: 'post',
      async handler(html) {
        if (!existsSync(SSR_ENTRY)) {
          console.warn(
            `[bandmate-seo] No SSR bundle at ${SSR_ENTRY} — skipping landing prerender. ` +
              'Run `npm run build` (which builds the SSR entry first) instead of `vite build`.'
          )
          return html
        }

        // Cache-bust so repeated builds in one process pick up a fresh bundle.
        const { render } = await import(
          `${pathToFileURL(SSR_ENTRY).href}?v=${readFileSync(SSR_ENTRY).length}`
        )
        const { html: appHtml, css, faqJsonLd } = render('en') as {
          html: string
          css: string
          faqJsonLd: string
        }

        return html
          .replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`)
          .replace(
            '</head>',
            `  <script type="application/ld+json">${faqJsonLd}</script>\n` +
              `  <style id="prerender-styles">${css}</style>\n  </head>`
          )
      },
    },

    generateBundle() {
      const today = new Date().toISOString().slice(0, 10)

      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source:
          [
            'User-agent: *',
            ...DISALLOWED_PATHS.map((path) => `Disallow: ${path}`),
            '',
            `Sitemap: ${SITE_URL}/sitemap.xml`,
          ].join('\n') + '\n',
      })

      const urls = PUBLIC_ROUTES.map(
        (route) =>
          '  <url>\n' +
          `    <loc>${absoluteUrl(route)}</loc>\n` +
          `    <lastmod>${today}</lastmod>\n` +
          `    <priority>${route === '/' ? '1.0' : '0.5'}</priority>\n` +
          '  </url>'
      ).join('\n')

      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source:
          '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
          `${urls}\n` +
          '</urlset>\n',
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ isSsrBuild }) => ({
  // Bundle the UI libraries into the SSR pass instead of leaving them as bare
  // imports: several still ship dual CJS/ESM builds whose default export Node
  // resolves to a namespace object, which blows up as `styled.div is not a
  // function` the moment the prerender runs.
  ssr: {
    noExternal: [
      'styled-components',
      'reactstrap',
      'react-router',
      'react-router-dom',
      'react-i18next',
      'i18next',
    ],
  },
  plugins: [
    react(),
    // The SSR pass only needs to produce a renderable module — no service
    // worker, no prerender-into-itself.
    ...(isSsrBuild
      ? []
      : [
          bandmateSeo(),
          VitePWA({
            // A new worker waits until the user taps Reload in
            // PwaReloadPrompt, which also registers it (hence no injected
            // registration script). `autoUpdate` would skip waiting and reload
            // the page mid-show.
            registerType: 'prompt',
            injectRegister: false,
            includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'og-image.png'],
            manifest: {
              name: 'Bandmate',
              short_name: 'Bandmate',
              description: "Manage your band's songs, setlists, shows, and members in one place",
              theme_color: '#8B5CF6',
              background_color: '#0A0A0B',
              display: 'standalone',
              start_url: '/',
              icons: [
                {
                  src: '/icon-192.png',
                  sizes: '192x192',
                  type: 'image/png',
                  purpose: 'any maskable',
                },
                {
                  src: '/icon-512.png',
                  sizes: '512x512',
                  type: 'image/png',
                  purpose: 'any maskable',
                },
              ],
            },
            workbox: {
              // Cache navigation requests
              navigateFallback: '/index.html',
              navigateFallbackDenylist: [/^\/api/, /^\/robots\.txt$/, /^\/sitemap\.xml$/],

              // The default adds only js/wasm/css/html; `mjs` picks up the
              // bundled pdf.js worker so the PDF viewer can start offline, and
              // `woff2` the self-hosted Space Grotesk and Bootstrap Icons fonts
              // so the shell looks the same offline.
              globPatterns: ['**/*.{js,mjs,wasm,css,html,woff2}'],

              // Workbox leaves out anything above this (default 2 MiB) and the
              // app then can't start offline. The main bundle is ~2 MB, so the
              // next dependency would cross it; 5 MiB gives headroom until the
              // bundle is code-split. Files that `globPatterns`/`globIgnores`
              // skip are dropped with no warning at all, so
              // scripts/check-precache.mjs (run by `npm run build`) fails the
              // build if any shell file is missing from the manifest.
              maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,

              // Runtime caching strategies
              runtimeCaching: [
                {
                  // Cache Supabase REST and auth calls only. Storage
                  // (`/storage/v1/`, signed PDF URLs) is left to the browser so
                  // PDF bytes are never copied into this cache.
                  urlPattern: ({ url }) =>
                    url.hostname.endsWith('supabase.co') &&
                    (url.pathname.startsWith('/rest/v1/') || url.pathname.startsWith('/auth/v1/')),
                  handler: 'NetworkFirst',
                  options: {
                    cacheName: 'supabase-api',
                    // Fall back to the cache instead of hanging on weak signal.
                    networkTimeoutSeconds: 4,
                    expiration: {
                      maxEntries: 100,
                      maxAgeSeconds: 60 * 60, // 1 hour
                    },
                    cacheableResponse: {
                      statuses: [0, 200],
                    },
                  },
                },
                {
                  // Cache static assets
                  urlPattern: /\.(?:js|css|woff2?|png|jpg|jpeg|svg|gif|webp)$/,
                  handler: 'CacheFirst',
                  options: {
                    cacheName: 'static-assets',
                    expiration: {
                      maxEntries: 100,
                      maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                    },
                  },
                },
              ],
            },
            devOptions: {
              enabled: true,
              type: 'module',
            },
          }),
        ]),
  ],
}))
