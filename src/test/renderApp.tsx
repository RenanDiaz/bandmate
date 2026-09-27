import type { ContextType, ReactElement } from "react";
import { render } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { BandContext } from "../context/BandContext";
import { ToastProvider } from "../context/ToastContext";
import type { Band } from "../services/bandsService";
import { createTestI18n } from "./i18n";
import { LocationProbe } from "./LocationProbe";

/**
 * DOM test helpers (jsdom files only): render under the providers the app
 * uses, with a hand-made BandContext value instead of the real provider (no
 * auth controller, no Supabase).
 */

export type BandContextValue = NonNullable<ContextType<typeof BandContext>>;

export function bandContext(overrides: Partial<BandContextValue> = {}): BandContextValue {
  return {
    selectedBand: null,
    setSelectedBand: vi.fn(),
    user: { id: "user-a" },
    authMode: "session",
    setShowBandSelector: vi.fn(),
    showBandSelector: false,
    bands: [],
    refreshBands: vi.fn(),
    isResolvingBand: false,
    isCheckingAuth: false,
    isOnline: true,
    reportNetworkFailure: vi.fn(),
    reportNetworkSuccess: vi.fn(),
    hiddenOfflineCount: 0,
    ...overrides,
  };
}

export function testBand(id = 7, name = `Band ${id}`): Band {
  return { id, name, owner_id: "owner", created_at: "2026-01-01T00:00:00Z" };
}

const i18n = createTestI18n();

export function renderApp(
  ui: ReactElement,
  // `history`: in-app entries before `path` (back navigation).
  { ctx, path = "/", history = [] }: { ctx: BandContextValue; path?: string; history?: string[] }
) {
  const wrap = (value: BandContextValue) => (
    <I18nextProvider i18n={i18n}>
      <BandContext.Provider value={value}>
        <ToastProvider>
          <MemoryRouter initialEntries={[...history, path]} initialIndex={history.length}>
            {ui}
            <LocationProbe />
          </MemoryRouter>
        </ToastProvider>
      </BandContext.Provider>
    </I18nextProvider>
  );
  const result = render(wrap(ctx));
  // Re-render with another context value (e.g. isOnline flips), same tree:
  // the router keeps its location.
  const setContext = (next: BandContextValue) => result.rerender(wrap(next));
  return { ...result, setContext };
}
