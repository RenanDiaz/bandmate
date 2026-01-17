import { useState, type FC } from "react";
import { useNavigate } from "react-router-dom";
import type { Setlist } from "../services/setlistsService";
import styled from "styled-components";
import { theme } from "../theme";
import {
  Dropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
} from "reactstrap";

interface Props {
  setlists: Setlist[];
  onDelete: (setlist: Setlist) => void;
}

// Individual setlist card component to manage its own dropdown state
const SetlistCardItem: FC<{
  setlist: Setlist;
  onDelete: (setlist: Setlist) => void;
  onView: (setlistId: string) => void;
  onPerform: (setlistId: string) => void;
  onEditSongs: (setlistId: string) => void;
}> = ({ setlist, onDelete, onView, onPerform, onEditSongs }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const toggleDropdown = () => setDropdownOpen((prev) => !prev);

  const songCount = setlist.songs?.length || 0;

  return (
    <SetlistCard onClick={() => onView(setlist.id)} $clickable>
      <SetlistHeader>
        <SetlistIcon>
          <i className="bi bi-music-note-list"></i>
        </SetlistIcon>

        <SetlistInfo>
          <SetlistName>{setlist.name}</SetlistName>
          <MetadataRow>
            <MetadataBadge>
              <i className="bi bi-music-note-beamed"></i>
              {songCount} {songCount === 1 ? "song" : "songs"}
            </MetadataBadge>
          </MetadataRow>
        </SetlistInfo>

        {/* Desktop: Inline action buttons */}
        <ActionButtons>
          <ActionButton
            onClick={(e) => {
              e.stopPropagation();
              onPerform(setlist.id);
            }}
            title="Start performance mode"
            $variant="perform"
            disabled={songCount === 0}
          >
            <i className="bi bi-play-circle"></i>
          </ActionButton>
          <ActionButton
            onClick={(e) => {
              e.stopPropagation();
              onEditSongs(setlist.id);
            }}
            title="Edit setlist"
            $variant="edit"
          >
            <i className="bi bi-pencil"></i>
          </ActionButton>
          <ActionButton
            onClick={(e) => {
              e.stopPropagation();
              onDelete(setlist);
            }}
            title="Delete setlist"
            $variant="delete"
          >
            <i className="bi bi-trash"></i>
          </ActionButton>
        </ActionButtons>

        {/* Mobile: Dropdown menu */}
        <MobileDropdownWrapper onClick={(e) => e.stopPropagation()}>
          <Dropdown isOpen={dropdownOpen} toggle={toggleDropdown}>
            <DropdownToggle tag="button" className="mobile-actions-toggle">
              <i className="bi bi-three-dots-vertical"></i>
            </DropdownToggle>
            <DropdownMenu end dark container="body">
              <DropdownItem
                onClick={(e) => {
                  e.stopPropagation();
                  onPerform(setlist.id);
                }}
                disabled={songCount === 0}
              >
                <i className="bi bi-play-circle me-2 text-success"></i> Perform
              </DropdownItem>
              <DropdownItem onClick={(e) => {
                e.stopPropagation();
                onEditSongs(setlist.id);
              }}>
                <i className="bi bi-pencil me-2"></i> Edit
              </DropdownItem>
              <DropdownItem divider />
              <DropdownItem onClick={(e) => {
                e.stopPropagation();
                onDelete(setlist);
              }} className="text-danger">
                <i className="bi bi-trash me-2"></i> Delete
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </MobileDropdownWrapper>
      </SetlistHeader>

      {setlist.description && (
        <SetlistDescription>{setlist.description}</SetlistDescription>
      )}
    </SetlistCard>
  );
};

export const SetlistList: FC<Props> = ({ setlists, onDelete }) => {
  const navigate = useNavigate();

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
        />
      ))}
    </SetlistsGrid>
  );
};

// Styled Components

const SetlistsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: ${theme.space[4]};
  margin-top: ${theme.space[6]};

  @media (max-width: ${theme.breakpoints.md}) {
    grid-template-columns: 1fr;
  }
`;

const SetlistCard = styled.div<{ $clickable?: boolean }>`
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.lg};
  overflow: hidden;
  transition: all ${theme.transitions.base} ease;
  cursor: ${(props) => (props.$clickable ? "pointer" : "default")};

  &:hover {
    border-color: ${theme.colors.brand.primary};
    box-shadow: var(--shadow-md);
  }
`;

const SetlistHeader = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${theme.space[3]};
  padding: ${theme.space[4]};
  transition: all ${theme.transitions.fast} ease;
`;

const SetlistIcon = styled.div`
  width: 56px;
  height: 56px;
  background: ${theme.gradients.brandPrimary};
  border-radius: ${theme.radius.md};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${theme.fontSizes.h2};
  color: white;
  flex-shrink: 0;
`;

const SetlistInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const SetlistName = styled.h3`
  font-size: ${theme.fontSizes.bodyLg};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin: 0 0 ${theme.space[2]} 0;
  line-height: ${theme.lineHeights.snug};
`;

const MetadataRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${theme.space[2]};
  margin-top: ${theme.space[2]};
`;

const MetadataBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[1]};
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  padding: ${theme.space[1]} ${theme.space[2]};
  border-radius: ${theme.radius.sm};
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.medium};
  white-space: nowrap;

  i {
    font-size: ${theme.fontSizes.bodySm};
    color: ${theme.colors.brand.primary};
  }
`;

const ActionButtons = styled.div`
  display: flex;
  gap: ${theme.space[2]};
  opacity: 0;
  transition: opacity ${theme.transitions.fast} ease;

  ${SetlistHeader}:hover & {
    opacity: 1;
  }

  /* Hide on mobile - use dropdown instead */
  @media (max-width: ${theme.breakpoints.md}) {
    display: none;
  }

  @media (hover: none) and (min-width: ${theme.breakpoints.md}) {
    opacity: 1;
  }
`;

const MobileDropdownWrapper = styled.div`
  display: none;

  @media (max-width: ${theme.breakpoints.md}) {
    display: block;
    flex-shrink: 0;
  }

  .mobile-actions-toggle {
    background: transparent;
    border: 1px solid var(--color-border);
    color: var(--color-text-secondary);
    width: 40px;
    height: 40px;
    border-radius: ${theme.radius.base};
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all ${theme.transitions.fast} ease;
    font-size: ${theme.fontSizes.bodyLg};

    &:hover,
    &:focus {
      background: var(--color-bg-elevated);
      border-color: ${theme.colors.brand.primary};
      color: ${theme.colors.brand.primary};
    }

    &::after {
      display: none; /* Remove default caret */
    }
  }
`;

const ActionButton = styled.button<{ $variant: "perform" | "view" | "edit" | "delete" }>`
  background: transparent;
  border: 1px solid var(--color-border);
  color: ${(props) => {
    if (props.$variant === "perform") return theme.colors.semantic.success;
    if (props.$variant === "delete") return theme.colors.semantic.error;
    return 'var(--color-text-secondary)';
  }};
  width: 36px;
  height: 36px;
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  flex-shrink: 0;

  &:hover:not(:disabled) {
    background: ${(props) => {
      if (props.$variant === "perform") return theme.colors.semantic.successBgDark;
      if (props.$variant === "delete") return theme.colors.semantic.errorBgDark;
      return 'var(--color-bg-elevated)';
    }};
    border-color: ${(props) => {
      if (props.$variant === "perform") return theme.colors.semantic.success;
      if (props.$variant === "delete") return theme.colors.semantic.error;
      return theme.colors.brand.primary;
    }};
    color: ${(props) => {
      if (props.$variant === "perform") return theme.colors.semantic.success;
      if (props.$variant === "delete") return theme.colors.semantic.error;
      return theme.colors.brand.primary;
    }};
    transform: translateY(-1px);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const SetlistDescription = styled.p`
  padding: 0 ${theme.space[4]} ${theme.space[4]} ${theme.space[4]};
  margin: 0;
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
  line-height: ${theme.lineHeights.relaxed};
  border-top: 1px solid var(--color-border);
  padding-top: ${theme.space[3]};
`;
