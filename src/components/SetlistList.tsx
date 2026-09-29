import { useState, type FC } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Setlist } from "../services/setlistsService";
import type { OfflineSnapshotMeta } from "../services/offlineSetlistService";
import { useOfflineSnapshotMetas } from "../hooks/useOfflineDownload";
import { OfflineBadge } from "./offline/OfflineDownloadAction";
import { isSongItem } from "../services/setlistsService";
import styled from "styled-components";
import { theme } from "../theme";
import {
  Dropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
} from "reactstrap";
import { iconButtonCss, outlinedCss } from "./setlist/actionButtons";

interface Props {
  setlists: Setlist[];
  onDelete: (setlist: Setlist) => void;
  canEdit: boolean;
}

// Individual setlist card (docs/specs/setlist-actions-layout.md §3): one
// actions block for every size and input — Perform always visible, the
// editing actions behind a "More actions" menu. No hover-reveal.
const SetlistCardItem: FC<{
  setlist: Setlist;
  onDelete: (setlist: Setlist) => void;
  onView: (setlistId: string) => void;
  onPerform: (setlistId: string) => void;
  onEditSongs: (setlistId: string) => void;
  canEdit: boolean;
  offlineMeta?: OfflineSnapshotMeta;
}> = ({ setlist, onDelete, onView, onPerform, onEditSongs, canEdit, offlineMeta }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const toggleDropdown = () => setDropdownOpen((prev) => !prev);
  const { t } = useTranslation();

  const songCount = setlist.songs?.filter(isSongItem).length || 0;
  const moreLabel = t("common.moreActions");

  return (
    <SetlistCard onClick={() => onView(setlist.id)} $clickable>
      <SetlistHeader>
        <SetlistIcon>
          <i className="bi bi-music-note-list"></i>
        </SetlistIcon>

        <SetlistInfo>
          <SetlistName>
            <SetlistNameLink to={`/setlists/${setlist.id}`} onClick={(e) => e.stopPropagation()}>
              {setlist.name}
            </SetlistNameLink>
          </SetlistName>
          {setlist.description && (
            <SetlistDescription title={setlist.description}>{setlist.description}</SetlistDescription>
          )}
        </SetlistInfo>

        <CardActions onClick={(e) => e.stopPropagation()}>
          <PerformButton
            type="button"
            onClick={() => onPerform(setlist.id)}
            title={t('setlists.performTooltip')}
            aria-label={t('setlists.perform')}
            disabled={songCount === 0}
          >
            <i className="bi bi-play-circle"></i>
            <span>{t('setlists.perform')}</span>
          </PerformButton>
          {canEdit && (
            <MoreMenu isOpen={dropdownOpen} toggle={toggleDropdown}>
              <DropdownToggle
                tag="button"
                type="button"
                className="setlist-card-more"
                title={moreLabel}
                aria-label={moreLabel}
              >
                <i className="bi bi-three-dots-vertical"></i>
              </DropdownToggle>
              <DropdownMenu end dark container="body">
                <DropdownItem onClick={() => onEditSongs(setlist.id)}>
                  <i className="bi bi-pencil me-2"></i> {t('common.edit')}
                </DropdownItem>
                <DropdownItem divider />
                <DropdownItem onClick={() => onDelete(setlist)} className="text-danger">
                  <i className="bi bi-trash me-2"></i> {t('common.delete')}
                </DropdownItem>
              </DropdownMenu>
            </MoreMenu>
          )}
        </CardActions>
      </SetlistHeader>

      <MetadataRow>
        <MetadataBadge>
          <i className="bi bi-music-note-beamed"></i>
          {t('setlists.songCount', { count: songCount })}
        </MetadataBadge>
        {offlineMeta && <OfflineBadge meta={offlineMeta} />}
      </MetadataRow>
    </SetlistCard>
  );
};

export const SetlistList: FC<Props> = ({ setlists, onDelete, canEdit }) => {
  const navigate = useNavigate();
  const offlineMetas = useOfflineSnapshotMetas();

  const handleViewSetlist = (setlistId: string) => {
    navigate(`/setlists/${setlistId}`);
  };

  const handlePerformSetlist = (setlistId: string) => {
    navigate(`/setlists/${setlistId}/perform`);
  };

  const handleEditSongs = (setlistId: string) => {
    navigate(`/setlists/${setlistId}/edit`);
  };

  return (
    <SetlistsGrid>
      {setlists.map((setlist) => (
        <SetlistCardItem
          key={setlist.id}
          setlist={setlist}
          onDelete={onDelete}
          onView={handleViewSetlist}
          onPerform={handlePerformSetlist}
          onEditSongs={handleEditSongs}
          canEdit={canEdit}
          offlineMeta={offlineMetas[setlist.id]}
        />
      ))}
    </SetlistsGrid>
  );
};

// Styled Components

const SetlistsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: ${theme.space[4]};
  margin-top: ${theme.space[6]};

  @media (max-width: ${theme.breakpoints.md}) {
    grid-template-columns: 1fr;
    gap: ${theme.space[3]};
  }
`;

const SetlistCard = styled.div<{ $clickable?: boolean }>`
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.lg};
  overflow: hidden;
  transition: border-color ${theme.transitions.base} ease, box-shadow ${theme.transitions.base} ease;
  cursor: ${(props) => (props.$clickable ? "pointer" : "default")};
  display: flex;
  flex-direction: column;

  &:hover {
    border-color: ${theme.colors.brand.primary};
    box-shadow: var(--shadow-md);
  }
`;

// Same anatomy as the song cards: icon · name + description · actions on
// one row, then the badges on the card's full width.
const SetlistHeader = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${theme.space[3]};
  padding: ${theme.space[4]};

  @media (max-width: ${theme.breakpoints.sm}) {
    padding: ${theme.space[3]};
  }
`;

const SetlistIcon = styled.div`
  width: 48px;
  height: 48px;
  background: ${theme.gradients.brandPrimary};
  border-radius: ${theme.radius.md};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${theme.fontSizes.h3};
  color: white;
  flex-shrink: 0;

  @media (max-width: ${theme.breakpoints.sm}) {
    width: 40px;
    height: 40px;
    font-size: ${theme.fontSizes.h4};
  }
`;

const SetlistInfo = styled.div`
  flex: 1;
  min-width: 0;
  min-height: 48px;
  display: flex;
  flex-direction: column;
  justify-content: center;

  @media (max-width: ${theme.breakpoints.sm}) {
    min-height: 40px;
  }
`;

const SetlistName = styled.h3`
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin: 0;
  line-height: ${theme.lineHeights.snug};
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow-wrap: anywhere;
`;

const SetlistDescription = styled.p`
  margin: 2px 0 0;
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
  line-height: ${theme.lineHeights.snug};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const MetadataRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${theme.space[2]};
  padding: 0 ${theme.space[4]} ${theme.space[4]};

  @media (max-width: ${theme.breakpoints.sm}) {
    padding: 0 ${theme.space[3]} ${theme.space[3]};
  }
`;

const MetadataBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[1]};
  height: 28px;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  padding: 0 ${theme.space[2]};
  border-radius: ${theme.radius.sm};
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.medium};
  white-space: nowrap;

  i {
    font-size: ${theme.fontSizes.bodySm};
    color: ${theme.colors.brand.primary};
  }
`;

const SetlistNameLink = styled(Link)`
  color: inherit;
  text-decoration: none;

  &:hover {
    color: ${theme.colors.brand.primary};
  }
`;

const CardActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  flex-shrink: 0;
  align-self: flex-start;
`;

/** Perform: outlined in the success colour, always visible; icon-only below sm. */
const PerformButton = styled.button`
  ${outlinedCss}
  color: ${theme.colors.semantic.success};
  border-color: ${theme.colors.semantic.success}55;

  i {
    color: ${theme.colors.semantic.success};
  }

  &:hover:not(:disabled) {
    background: ${theme.colors.semantic.successBgDark};
    border-color: ${theme.colors.semantic.success};
    color: ${theme.colors.semantic.success};
  }

  @media (max-width: ${theme.breakpoints.sm}) {
    width: 40px;
    min-width: 40px;
    padding: 0;

    span {
      display: none;
    }
  }
`;

// reactstrap's toggle passes `innerRef`, which a styled tag would leak to the
// DOM, so the toggle is a plain button styled through its class.
const MoreMenu = styled(Dropdown)`
  .setlist-card-more {
    ${iconButtonCss}
  }
`;
