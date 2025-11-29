import type { FC } from "react";
import { Helmet } from "react-helmet-async";

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogType?: string;
  ogImage?: string;
}

const DEFAULT_TITLE = "Bandmate - Band Management Made Easy";
const DEFAULT_DESCRIPTION = "Manage your band's songs, setlists, shows, and members in one place. Built for musicians by musicians.";
const DEFAULT_KEYWORDS = "band management, setlist manager, song organizer, music collaboration, band app, gig planner";

export const SEO: FC<SEOProps> = ({
  title,
  description = DEFAULT_DESCRIPTION,
  keywords = DEFAULT_KEYWORDS,
  ogType = "website",
  ogImage = "/og-image.png",
}) => {
  const fullTitle = title ? `${title} | Bandmate` : DEFAULT_TITLE;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* Additional Meta Tags */}
      <meta name="application-name" content="Bandmate" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="apple-mobile-web-app-title" content="Bandmate" />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="theme-color" content="#8B5CF6" />
    </Helmet>
  );
};
