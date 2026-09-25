import type { FC } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { theme } from "../../theme";
import type { OfflineSnapshotMeta } from "../../services/offlineSetlistService";
import { OfflineBadge } from "./OfflineDownloadAction";
import { PrimaryButton } from "./offlineStyles";

/**
 * Snapshots saved on this device (name, saved date + completeness, Perform).
 * The one list of the offline home and of `/setlists` offline (§7.3).
 * Presentational: the caller reads and filters the metas.
 */
export const OfflineSetlistList: FC<{ metas: OfflineSnapshotMeta[] }> = ({ metas }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <List data-testid="offline-setlist-list">
      {metas.map((meta) => (
        <Row key={meta.setlistId}>
          <RowLink type="button" onClick={() => navigate(`/setlists/${meta.setlistId}`)}>
            <Icon aria-hidden="true">
              <i className="bi bi-music-note-list" />
            </Icon>
            <Info>
              <Name>{meta.setlistName || t("offline.home.untitled")}</Name>
              <OfflineBadge meta={meta} />
            </Info>
          </RowLink>
          <PrimaryButton type="button" onClick={() => navigate(`/setlists/${meta.setlistId}/perform`)}>
            <i className="bi bi-play-fill" aria-hidden="true" /> {t("offline.list.perform")}
          </PrimaryButton>
        </Row>
      ))}
    </List>
  );
};

const List = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${theme.space[3]};
`;

const Row = styled.li`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.lg};
  padding: ${theme.space[3]} ${theme.space[4]};
`;

const RowLink = styled.button`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  background: transparent;
  border: none;
  padding: 0;
  text-align: left;
  color: inherit;
  cursor: pointer;
`;

const Icon = styled.span`
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: ${theme.radius.md};
  background: ${theme.gradients.brandPrimary};
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${theme.fontSizes.h5};
`;

const Info = styled.span`
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${theme.space[1]};
`;

const Name = styled.span`
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  overflow-wrap: anywhere;
`;
