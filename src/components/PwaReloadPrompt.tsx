import type { FC } from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { matchPath, useLocation } from "react-router-dom";
import { Workbox } from "workbox-window";
import styled from "styled-components";
import { theme } from "../theme";

// vite-plugin-pwa serves the worker from these URLs (`injectRegister: false`
// in vite.config.ts, so nothing else registers it). The dev worker is an ES
// module; the build emits a classic one.
const SW_URL = import.meta.env.DEV ? "/dev-sw.js?dev-sw" : "/sw.js";
const SW_TYPE = import.meta.env.DEV ? "module" : "classic";

/** Routes where the page must never reload on its own: a show is running. */
const NO_RELOAD_ROUTES = ["/setlists/:setlistId/perform"];

/**
 * Registers the PWA service worker and shows an in-app prompt when a new
 * version is waiting (`registerType: 'prompt'`).
 *
 * The page reloads only when the user taps Reload. Nothing here calls
 * `skipWaiting` on its own, and the prompt stays hidden on the perform route
 * until the user leaves it. Registration uses workbox-window directly rather
 * than `virtual:pwa-register`, because the latter reloads every tab when
 * *another* tab accepts the update — including one in the middle of a show.
 * Here that case only raises the prompt.
 */
export const PwaReloadPrompt: FC = () => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [needRefresh, setNeedRefresh] = useState(false);
  const wbRef = useRef<Workbox | null>(null);
  const hasWaitingRef = useRef(false);
  const reloadRequestedRef = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const wb = new Workbox(SW_URL, { scope: "/", type: SW_TYPE });
    wbRef.current = wb;

    wb.addEventListener("waiting", () => {
      hasWaitingRef.current = true;
      setNeedRefresh(true);
    });
    wb.addEventListener("controlling", (event) => {
      if (!event.isUpdate) return;
      hasWaitingRef.current = false;
      if (reloadRequestedRef.current) {
        window.location.reload();
      } else {
        // Another tab activated the new worker. This tab keeps running the old
        // bundle until the user chooses to reload.
        setNeedRefresh(true);
      }
    });
    wb.addEventListener("installed", (event) => {
      if (!event.isUpdate) console.log("App ready to work offline");
    });

    wb.register().catch((error) => {
      console.error("Service worker registration failed", error);
    });
  }, []);

  const handleReload = () => {
    reloadRequestedRef.current = true;
    if (hasWaitingRef.current && wbRef.current) {
      // Reloads from the `controlling` listener once the new worker takes over.
      wbRef.current.messageSkipWaiting();
    } else {
      window.location.reload();
    }
  };

  const onNoReloadRoute = NO_RELOAD_ROUTES.some((pattern) => matchPath(pattern, pathname));
  if (!needRefresh || onNoReloadRoute) return null;

  return (
    <Banner role="alert">
      <Content>
        <i className="bi bi-arrow-clockwise"></i>
        <span>{t("pwa.newContentAvailable")}</span>
      </Content>
      <Actions>
        <DismissButton type="button" onClick={() => setNeedRefresh(false)}>
          {t("common.close")}
        </DismissButton>
        <ReloadButton type="button" onClick={handleReload}>
          {t("pwa.reload")}
        </ReloadButton>
      </Actions>
    </Banner>
  );
};

const Banner = styled.div`
  position: fixed;
  bottom: ${theme.space[4]};
  left: 50%;
  transform: translateX(-50%);
  z-index: ${theme.zIndex.tooltip + 20};
  display: flex;
  align-items: center;
  gap: ${theme.space[4]};
  flex-wrap: wrap;
  justify-content: center;
  padding: ${theme.space[3]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  border: 1px solid ${theme.colors.brand.primary};
  background: var(--color-bg-secondary);
  box-shadow: var(--shadow-lg);
  max-width: min(480px, calc(100vw - ${theme.space[6]}));
  animation: bannerIn ${theme.transitions.base} ease;

  @keyframes bannerIn {
    from {
      opacity: 0;
      transform: translate(-50%, 12px);
    }
    to {
      opacity: 1;
      transform: translate(-50%, 0);
    }
  }
`;

const Content = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  color: var(--color-text-primary);
  font-size: ${theme.fontSizes.bodySm};

  i {
    color: ${theme.colors.brand.primary};
    font-size: ${theme.fontSizes.bodyLg};
  }
`;

const Actions = styled.div`
  display: flex;
  gap: ${theme.space[2]};
`;

const DismissButton = styled.button`
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  padding: ${theme.space[2]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  &:hover {
    background: var(--color-bg-elevated);
    border-color: var(--color-border-strong);
  }
`;

const ReloadButton = styled.button`
  background: ${theme.colors.brand.primary};
  border: none;
  color: white;
  padding: ${theme.space[2]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  &:hover {
    background: ${theme.colors.brand.primaryHover};
  }
`;
