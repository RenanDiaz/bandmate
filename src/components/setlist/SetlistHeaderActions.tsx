import { useState, type FC } from "react";
import { useTranslation } from "react-i18next";
import { Dropdown, DropdownItem, DropdownMenu, DropdownToggle } from "reactstrap";
import styled from "styled-components";
import { theme } from "../../theme";
import { FilledButton, OutlinedButton, iconButtonCss } from "./actionButtons";

/**
 * Setlist detail header actions (docs/specs/setlist-actions-layout.md §2):
 * Perform (the one filled button), Edit (editors) and a "More actions" menu
 * with the rest. Items are hidden by role and disabled by state. Purely
 * presentational: the view owns the handlers and modals.
 */
export interface SetlistHeaderActionsProps {
  canEdit: boolean;
  /** Songs plus special items. */
  itemCount: number;
  songCount: number;
  /** Everything is disabled while the reorder toolbar is up. */
  reorderMode: boolean;
  onPerform: () => void;
  onEdit: () => void;
  onReorder: () => void;
  onRename: () => void;
  onPrint: () => void;
  onExport: () => void;
  onYouTube: () => void;
  onPropose: () => void;
}

export const SetlistHeaderActions: FC<SetlistHeaderActionsProps> = ({
  canEdit,
  itemCount,
  songCount,
  reorderMode,
  onPerform,
  onEdit,
  onReorder,
  onRename,
  onPrint,
  onExport,
  onYouTube,
  onPropose,
}) => {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const moreLabel = t("common.moreActions");

  return (
    <Actions>
      <PerformButton
        type="button"
        onClick={onPerform}
        disabled={reorderMode || itemCount === 0}
        title={t("setlists.detail.startPerformance")}
      >
        <i className="bi bi-play-circle" />
        <span>{t("setlists.detail.startPerformance")}</span>
      </PerformButton>
      {canEdit && (
        <EditButton
          type="button"
          onClick={onEdit}
          disabled={reorderMode}
          title={t("setlists.editSetlist")}
          aria-label={t("setlists.editSetlist")}
        >
          <i className="bi bi-music-note-list" />
          <span>{t("setlists.editSetlist")}</span>
        </EditButton>
      )}
      <MoreMenu isOpen={menuOpen} toggle={() => setMenuOpen((open) => !open)}>
        <DropdownToggle
          tag="button"
          type="button"
          className="setlist-more-toggle"
          disabled={reorderMode}
          title={moreLabel}
          aria-label={moreLabel}
        >
          <i className="bi bi-three-dots-vertical" />
        </DropdownToggle>
        <DropdownMenu end dark container="body">
          {canEdit && (
            <>
              <DropdownItem onClick={onReorder} disabled={songCount < 2}>
                <i className="bi bi-arrow-down-up me-2" /> {t("setlists.detail.reorder")}
              </DropdownItem>
              <DropdownItem onClick={onRename}>
                <i className="bi bi-pencil me-2" /> {t("setlists.renameSetlist")}
              </DropdownItem>
              <DropdownItem divider />
            </>
          )}
          <DropdownItem onClick={onPrint} disabled={itemCount === 0}>
            <i className="bi bi-printer me-2" /> {t("setlists.print")}
          </DropdownItem>
          <DropdownItem onClick={onExport} disabled={songCount === 0}>
            <i className="bi bi-file-text me-2" /> {t("setlists.export.button")}
          </DropdownItem>
          <DropdownItem onClick={onYouTube} disabled={songCount === 0}>
            <i className="bi bi-youtube me-2" /> {t("youtubeMusic.exportToYouTube")}
          </DropdownItem>
          <DropdownItem divider />
          <DropdownItem onClick={onPropose}>
            <i className="bi bi-chat-square-text me-2" /> {t("requests.proposeSetlist")}
          </DropdownItem>
        </DropdownMenu>
      </MoreMenu>
    </Actions>
  );
};

// Styled Components

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  flex-shrink: 0;
  margin-left: auto; /* stays right-aligned when wrapped under the title */

  @media (max-width: ${theme.breakpoints.md}) {
    width: 100%;
  }
`;

const PerformButton = styled(FilledButton)`
  @media (max-width: ${theme.breakpoints.md}) {
    flex: 1;
  }
`;

// reactstrap's toggle passes `innerRef`, which a styled tag would leak to the
// DOM, so the toggle is a plain button styled through its class.
const MoreMenu = styled(Dropdown)`
  .setlist-more-toggle {
    ${iconButtonCss}
  }
`;

const EditButton = styled(OutlinedButton)`
  @media (max-width: ${theme.breakpoints.sm}) {
    width: 40px;
    min-width: 40px;
    padding: 0;

    span {
      display: none;
    }
  }
`;
