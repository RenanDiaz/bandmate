import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import Footer from "../Footer";
import { createTestI18n } from "../../test/i18n";

const i18n = createTestI18n();

describe("Footer (app-header spec AC4)", () => {
  it("links About, Privacy and Terms, in that order", () => {
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <Footer />
        </MemoryRouter>
      </I18nextProvider>
    );
    const links = [...html.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/g)].map(([, href, text]) => [
      href,
      text.trim(),
    ]);
    expect(links).toEqual([
      ["/about", "About"],
      ["/privacy", "Privacy Policy"],
      ["/terms", "Terms of Service"],
    ]);
  });
});
