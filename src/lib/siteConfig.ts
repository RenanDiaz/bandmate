/**
 * Single source of truth for anything that needs the site's public identity:
 * SEO meta, the prerendered landing shell, robots.txt and sitemap.xml.
 *
 * `SITE_URL` is the canonical origin. Everything else (Open Graph URLs, the
 * canonical link, the sitemap) derives from it, so switching between apex and
 * `www` is a one-line change here plus the matching redirect in vercel.json.
 */
export const SITE_URL = 'https://www.bandmate.space';

export const SITE_NAME = 'Bandmate';

/** Absolute URL of the 1200x630 social card. Regenerate with `npm run og`. */
export const OG_IMAGE = `${SITE_URL}/og-image.png`;
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

/** The band that dogfoods Bandmate — used for social proof on the landing. */
export const REFERENCE_BAND = {
  name: 'Still Louder',
  url: 'https://still-louder.com',
} as const;

/**
 * Routes that are safe to index and worth listing in the sitemap. Everything
 * else is band-scoped, single-use (invite links) or too thin to index (/login),
 * and gets a `noindex` from the SEO component.
 */
export const PUBLIC_ROUTES = ['/', '/about', '/privacy', '/terms'] as const;

/**
 * FAQ entries on the landing, in order. Lives here rather than in the component
 * so the FAQPage structured data can be built from the same list without
 * importing a React module.
 */
export const FAQ_ITEMS = ['signup', 'stage', 'data', 'solo'] as const;

export const absoluteUrl = (path: string): string =>
  path === '/' ? `${SITE_URL}/` : `${SITE_URL}${path}`;
