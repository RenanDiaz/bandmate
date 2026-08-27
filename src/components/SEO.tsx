import type { FC } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { OG_IMAGE, OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH, PUBLIC_ROUTES, SITE_NAME, absoluteUrl } from "../lib/siteConfig";

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogType?: string;
  ogImage?: string;
  /** Force the robots directive instead of deriving it from the route. */
  noIndex?: boolean;
}

const DEFAULT_TITLE = "Bandmate — Band management for self-managed bands";
const DEFAULT_DESCRIPTION =
  "The setlist stops living in the group chat. Bandmate keeps your repertoire, setlists, rehearsals and shows in one place — built for bands that manage themselves.";
const DEFAULT_KEYWORDS =
  "band management, setlist manager, song organizer, rehearsal planner, gig planner, band app, gestión de bandas, setlist, repertorio";

/** Only marketing/legal routes are indexable; everything else is band-scoped. */
const isIndexable = (pathname: string): boolean =>
  (PUBLIC_ROUTES as readonly string[]).includes(pathname);

export const SEO: FC<SEOProps> = ({
  title,
  description = DEFAULT_DESCRIPTION,
  keywords = DEFAULT_KEYWORDS,
  ogType = "website",
  ogImage = OG_IMAGE,
  noIndex,
}) => {
  const { pathname } = useLocation();
  const { i18n } = useTranslation();

  const fullTitle = title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE;
  const canonical = absoluteUrl(pathname);
  const blockIndexing = noIndex ?? !isIndexable(pathname);
  const locale = i18n.language.startsWith("es") ? "es_ES" : "en_US";
  const alternateLocale = locale === "es_ES" ? "en_US" : "es_ES";
  // Relative overrides still need to be absolute for crawlers.
  const absoluteOgImage = ogImage.startsWith("http") ? ogImage : absoluteUrl(ogImage);

  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <link rel="canonical" href={canonical} />
      <meta name="robots" content={blockIndexing ? "noindex, nofollow" : "index, follow"} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={ogType} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:url" content={canonical} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={absoluteOgImage} />
      <meta property="og:image:width" content={String(OG_IMAGE_WIDTH)} />
      <meta property="og:image:height" content={String(OG_IMAGE_HEIGHT)} />
      <meta property="og:image:alt" content={`${SITE_NAME} — ${description}`} />
      <meta property="og:locale" content={locale} />
      <meta property="og:locale:alternate" content={alternateLocale} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={absoluteOgImage} />
      <meta name="twitter:image:alt" content={`${SITE_NAME} — ${description}`} />

      {/* Additional Meta Tags */}
      <meta name="application-name" content={SITE_NAME} />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="apple-mobile-web-app-title" content={SITE_NAME} />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="theme-color" content="#8B5CF6" />
    </>
  );
};
