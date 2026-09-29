import "./polyfills";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "styled-components";
import { BrowserRouter } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
// Brand wordmark font, self-hosted so it is precached and renders offline.
// Only 700 is used (Logo, Login title).
import "@fontsource/space-grotesk/700.css";
import "./styles/design-tokens.css";
import theme from "./theme";
import './i18n';
import { applyFlagParams } from "./lib/featureFlags";

// `?flag=push` / `?flag=-push` toggles a per-device feature flag on
// devices without a console; drop the param before the router reads the URL.
const withoutFlagParams = applyFlagParams(window.location.href);
if (withoutFlagParams !== null) window.history.replaceState(window.history.state, "", withoutFlagParams);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);

// Dev only: window.__bandmateOffline drives the offline download engine from
// the console (see src/lib/devOfflineHook.ts). `import.meta.env.DEV` is false in
// production builds, so this branch and the module are dropped entirely.
if (import.meta.env.DEV) {
  void import("./lib/devOfflineHook").then((m) => m.installOfflineDevHook());
}

// The build prerenders the landing into index.html so crawlers and slow
// connections get real content (see src/entry-server.tsx). `createRoot` throws
// that markup away on its first commit, so drop the stylesheet that went with
// it — its class names came from a different module order than the client's and
// have no reason to linger. Two frames: one for React to commit, one to paint.
requestAnimationFrame(() =>
  requestAnimationFrame(() => document.getElementById("prerender-styles")?.remove())
);
