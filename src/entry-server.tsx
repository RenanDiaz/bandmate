/**
 * Build-time renderer for the landing route.
 *
 * The app itself stays a pure SPA — this entry exists only so `/` ships with
 * real markup in `index.html`. Without it the document is an empty `<div id="root">`,
 * which means search engines index nothing and link-preview crawlers (WhatsApp,
 * Discord, Slack) see no content at all, because none of them wait for hydration.
 *
 * The output is deliberately *not* hydrated: `main.tsx` uses `createRoot`, which
 * discards the prerendered DOM and renders the real app over it. That keeps this
 * file free of any obligation to match the client tree exactly.
 */
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router";
import { ThemeProvider } from "styled-components";
import { ServerStyleSheet } from "styled-components";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { createInstance } from "i18next";

import { LandingPage } from "./components/LandingPage";
import { FAQ_ITEMS } from "./lib/siteConfig";
import theme from "./theme";
import en from "./i18n/locales/en.json";
import es from "./i18n/locales/es.json";

export interface RenderResult {
  html: string;
  css: string;
  /** FAQPage JSON-LD built from the same copy the FAQ section renders. */
  faqJsonLd: string;
}

/**
 * @param language Locale to bake into the static shell. Visitors get their own
 *   language the moment the SPA boots; this only decides what a crawler reads.
 */
export function render(language = "en"): RenderResult {
  // A dedicated instance: the app's shared one installs a browser language
  // detector that has no meaning during a build.
  const i18n = createInstance();
  i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, es: { translation: es } },
    lng: language,
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  });

  const sheet = new ServerStyleSheet();
  try {
    const html = renderToString(
      sheet.collectStyles(
        <I18nextProvider i18n={i18n}>
          <ThemeProvider theme={theme}>
            <StaticRouter location="/">
              <LandingPage />
            </StaticRouter>
          </ThemeProvider>
        </I18nextProvider>
      )
    );

    // Strip the wrapper so styled-components' client runtime does not try to
    // rehydrate a sheet whose class names came from a different module order.
    const css = sheet.getStyleTags().replace(/<\/?style[^>]*>/g, "");

    const faqJsonLd = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ_ITEMS.map((key) => ({
        "@type": "Question",
        name: i18n.t(`landing.faq.${key}.q`),
        acceptedAnswer: {
          "@type": "Answer",
          text: i18n.t(`landing.faq.${key}.a`),
        },
      })),
      // Escaped so the copy can never close the <script> that carries it.
    }).replace(/</g, "\\u003c");

    return { html, css, faqJsonLd };
  } finally {
    sheet.seal();
  }
}
