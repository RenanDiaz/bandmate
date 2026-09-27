import type { FC } from "react";
import { useEffect, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { matchPath, useLocation } from "react-router-dom";
import styled from "styled-components";
import { getPwaUpdater } from "../lib/pwaUpdates";
import { theme } from "../theme";

/** Routes where the page must never reload on its own: a show is running. */
const NO_RELOAD_ROUTES = ["/setlists/:setlistId/perform", "/songs/:songId/perform"];

/**
 * Registers the PWA service worker (through `getPwaUpdater()`) and shows an
 * in-app prompt when a new version is waiting (`registerType: 'prompt'`).
 *
 * The page reloads only when the user taps Reload. Nothing here calls
 * `skipWaiting` on its own, and the prompt stays hidden on the perform routes
 * until the user leaves it. Registration uses workbox-window directly rather
 * than `virtual:pwa-register`, because the latter reloads every tab when
 * *another* tab accepts the update — including one in the middle of a show.
 * Here that case only raises the prompt.
 */
export const PwaReloadPrompt: FC = () => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const updater = getPwaUpdater();
  const needRefresh = useSyncExternalStore(updater.subscribe, updater.getNeedRefresh, () => false);

  useEffect(() => {
    updater.start();
  }, [updater]);

  const onNoReloadRoute = NO_RELOAD_ROUTES.some((pattern) => matchPath(pattern, pathname));
  if (!needRefresh || onNoReloadRoute) return null;

  return (
    <Banner role="alert">
      <Content>
        <i className="bi bi-arrow-clockwise"></i>
        <span>{t("pwa.newContentAvailable")}</span>
      </Content>
      <Actions>
        <DismissButton type="button" onClick={() => updater.dismiss()}>
          {t("common.close")}
        </DismissButton>
        <ReloadButton type="button" onClick={() => updater.applyUpdate()}>
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
