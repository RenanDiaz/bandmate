import type { FC } from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { registerSW } from "virtual:pwa-register";
import styled from "styled-components";
import { theme } from "../theme";

/**
 * Registers the PWA service worker and shows an in-app, styled prompt when a
 * new version is available, replacing the native `confirm()` reload dialog.
 */
export const PwaReloadPrompt: FC = () => {
  const { t } = useTranslation();
  const [needRefresh, setNeedRefresh] = useState(false);
  const updateSW = useRef<((reload?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    updateSW.current = registerSW({
      onNeedRefresh() {
        setNeedRefresh(true);
      },
      onOfflineReady() {
        console.log("App ready to work offline");
      },
    });
  }, []);

  if (!needRefresh) return null;

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
        <ReloadButton type="button" onClick={() => updateSW.current?.(true)}>
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
