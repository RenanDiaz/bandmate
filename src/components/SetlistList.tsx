import type { FC } from "react";
import { useNavigate } from "react-router-dom";
import type { Setlist } from "../services/setlistsService";
import styled from "styled-components";
import { theme } from "../theme";

interface Props {
  setlists: Setlist[];
  onEdit: (setlist: Setlist) => void;
  onDelete: (setlist: Setlist) => void;
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const SetlistList: FC<Props> = ({ setlists, onEdit, onDelete }) => {
  const navigate = useNavigate();

  const handleViewSetlist = (setlistId: string) => {
    navigate(`/setlists/${setlistId}`);
  };

  const handlePerformSetlist = (setlistId: string) => {
    navigate(`/setlists/${setlistId}/perform`);
  };

  return (
    <SetlistsGrid>
      {setlists.map((setlist) => {
        const songCount = setlist.songs?.length || 0;

        return (
          <SetlistCard key={setlist.id}>
            <SetlistHeader>
              <SetlistIcon>
                <i className="bi bi-music-note-list"></i>
              </SetlistIcon>

              <SetlistInfo>
                <SetlistName>{setlist.name}</SetlistName>
                {setlist.venue && <SetlistVenue><i className="bi bi-geo-alt"></i> {setlist.venue}</SetlistVenue>}
                {setlist.event_date && (
                  <SetlistDate>
                    <i className="bi bi-calendar-event"></i> {formatDate(setlist.event_date)}
                  </SetlistDate>
                )}
                <MetadataRow>
                  <MetadataBadge>
                    <i className="bi bi-music-note-beamed"></i>
                    {songCount} {songCount === 1 ? "song" : "songs"}
                  </MetadataBadge>
                </MetadataRow>
              </SetlistInfo>

              <ActionButtons>
                <ActionButton
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePerformSetlist(setlist.id);
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
                    handleViewSetlist(setlist.id);
                  }}
                  title="View setlist"
                  $variant="view"
                >
                  <i className="bi bi-eye"></i>
                </ActionButton>
                <ActionButton
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(setlist);
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
            </SetlistHeader>

            {setlist.description && (
              <SetlistDescription>{setlist.description}</SetlistDescription>
            )}
          </SetlistCard>
        );
      })}
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

const SetlistCard = styled.div`
  background: ${theme.colors.dark.bg.secondary};
  border: 1px solid ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.lg};
  overflow: hidden;
  transition: all ${theme.transitions.base} ease;

  &:hover {
    border-color: ${theme.colors.brand.primary};
    box-shadow: ${theme.shadows.md};
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
  color: ${theme.colors.dark.text.primary};
  margin: 0 0 ${theme.space[2]} 0;
  line-height: ${theme.lineHeights.snug};
`;

const SetlistVenue = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.dark.text.secondary};
  margin-bottom: ${theme.space[1]};
  display: flex;
  align-items: center;
  gap: ${theme.space[1]};

  i {
    color: ${theme.colors.brand.primary};
  }
`;

const SetlistDate = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.dark.text.secondary};
  margin-bottom: ${theme.space[2]};
  display: flex;
  align-items: center;
  gap: ${theme.space[1]};

  i {
    color: ${theme.colors.brand.primary};
  }
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
  background: ${theme.colors.dark.bg.tertiary};
  border: 1px solid ${theme.colors.dark.border.default};
  color: ${theme.colors.dark.text.secondary};
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
`;

const ActionButton = styled.button<{ $variant: "perform" | "view" | "edit" | "delete" }>`
  background: transparent;
  border: 1px solid ${theme.colors.dark.border.default};
  color: ${(props) => {
    if (props.$variant === "perform") return theme.colors.semantic.success;
    if (props.$variant === "delete") return theme.colors.semantic.error;
    return theme.colors.dark.text.secondary;
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
      return theme.colors.dark.bg.elevated;
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
  color: ${theme.colors.dark.text.secondary};
  line-height: ${theme.lineHeights.relaxed};
  border-top: 1px solid ${theme.colors.dark.border.default};
  padding-top: ${theme.space[3]};
`;
