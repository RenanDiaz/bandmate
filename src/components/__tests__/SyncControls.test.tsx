import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import i18next from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import en from "../../i18n/locales/en.json";
import { SyncControls } from "../SyncControls";

const i18n = i18next.createInstance();
void i18n.use(initReactI18next).init({
  lng: "en",
  resources: { en: { translation: en } },
  interpolation: { escapeValue: false },
  initImmediate: false,
});

const props = {
  role: null,
  isConnected: false,
  isLoading: false,
  error: null,
  hasActiveSession: false,
  activeSessionSetlistId: null,
  currentSetlistId: "s1",
  hostDisplayName: null,
  sessionCreatedAt: null,
  canManageOrphanedSession: false,
  onStartHosting: vi.fn(),
  onJoinSession: vi.fn(),
  onLeaveSession: vi.fn(),
  onForceEndSession: vi.fn(),
  onTakeOverSession: vi.fn(),
};

const html = (disabled: boolean) =>
  renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <SyncControls {...props} disabled={disabled} disabledReason={en.performanceSync.needsConnection} />
    </I18nextProvider>
  );

describe("SyncControls offline (B4)", () => {
  it("disabled: an inert trigger that says why", () => {
    const markup = html(true);
    expect(markup).toContain("Sync sessions need a connection");
    expect(markup).toMatch(/<button[^>]*disabled/);
    expect(markup).not.toContain(`>${en.performanceSync.sync}<`);
  });

  it("enabled: the normal trigger", () => {
    const markup = html(false);
    expect(markup).toContain(`>${en.performanceSync.sync}<`);
    expect(markup).not.toContain("Sync sessions need a connection");
  });
});
