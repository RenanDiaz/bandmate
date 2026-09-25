import type { FC, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import { theme } from "../../theme";
import { PrimaryLink } from "./offlineStyles";
import { SchemaWipeNotice } from "./SchemaWipeNotice";

/** Icon, title, text and an action: the one layout of every offline message screen (PR 2.5). */
export const OfflineMessage: FC<{ icon: string; title: string; text?: string; children?: ReactNode }> = ({
  icon,
  title,
  text,
  children,
}) => (
  <Wrapper role="status">
    <Icon>
      <i className={`bi ${icon}`} aria-hidden="true" />
    </Icon>
    <MessageTitle>{title}</MessageTitle>
    {text && <MessageText>{text}</MessageText>}
    {children && <Actions>{children}</Actions>}
  </Wrapper>
);

const GoHome: FC = () => {
  const { t } = useTranslation();
  return (
    <PrimaryLink to="/">
      <i className="bi bi-house" aria-hidden="true" /> {t("offline.screen.goHome")}
    </PrimaryLink>
  );
};

/** Every route without an offline screen (shows, songs, requests, settings…), §7.3. */
export const NeedsConnection: FC = () => {
  const { t } = useTranslation();
  return (
    <OfflineMessage icon="bi-wifi-off" title={t("offline.needsConnection.title")} text={t("offline.needsConnection.text")}>
      <GoHome />
    </OfflineMessage>
  );
};

/** Offline with a user and nothing on the device (§7.2). Never the BandSelector. */
export const OfflineEmptyState: FC = () => {
  const { t } = useTranslation();
  return (
    <>
      <NoticeSlot>
        <SchemaWipeNotice />
      </NoticeSlot>
      <OfflineMessage icon="bi-cloud-slash" title={t("offline.empty.title")} text={t("offline.empty.text")} />
    </>
  );
};

/** `/setlists/:id` offline without a snapshot (§7.3). */
export const OfflineNotAvailable: FC = () => {
  const { t } = useTranslation();
  return (
    <OfflineMessage
      icon="bi-wifi-off"
      title={t("offline.detail.notAvailableTitle")}
      text={t("offline.detail.notAvailableText")}
    >
      <GoHome />
    </OfflineMessage>
  );
};

/**
 * `session-lost` (§7.1): the copies are hidden, not deleted. A count only —
 * the device may have changed hands, so no setlist names.
 */
export const OfflineLockedHome: FC<{ count: number }> = ({ count }) => {
  const { t } = useTranslation();
  return (
    <OfflineMessage icon="bi-lock" title={t("offline.locked.title")} text={t("offline.locked.text", { count })}>
      <PrimaryLink to="/login">
        <i className="bi bi-box-arrow-in-right" aria-hidden="true" /> {t("offline.locked.signIn")}
      </PrimaryLink>
    </OfflineMessage>
  );
};

const Wrapper = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${theme.space[3]};
  padding: ${theme.space[8]} ${theme.space[4]};
  text-align: center;
  max-width: 560px;
  margin: 0 auto;
`;

const Icon = styled.div`
  font-size: ${theme.fontSizes.displayLg};
  color: ${theme.colors.brand.primary};
  opacity: 0.8;
`;

const MessageTitle = styled.h2`
  font-size: ${theme.fontSizes.h3};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin: 0;
`;

const MessageText = styled.p`
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-secondary);
  margin: 0;
`;

const Actions = styled.div`
  margin-top: ${theme.space[4]};
  display: flex;
  gap: ${theme.space[2]};
  flex-wrap: wrap;
  justify-content: center;
`;

const NoticeSlot = styled.div`
  width: 100%;
  max-width: 960px;
  margin: 0 auto;
  padding: ${theme.space[4]} ${theme.space[4]} 0;

  &:empty {
    display: none;
  }
`;
