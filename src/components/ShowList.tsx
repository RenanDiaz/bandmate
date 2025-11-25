import type { FC } from "react";
import { useNavigate } from "react-router-dom";
import type { Show } from "../services/showsService";
import { markShowCompleted, markShowCancelled } from "../services/showsService";
import styled from "styled-components";
import { theme } from "../theme";

interface Props {
  shows: Show[];
  onEdit: (show: Show) => void;
  onDelete: (show: Show) => void;
  onReload: () => void;
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatTime = (timeString: string): string => {
  const [hours, minutes] = timeString.split(":");
  const date = new Date();
  date.setHours(parseInt(hours), parseInt(minutes));
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const getStatusColor = (status: string, eventDate: string) => {
  const today = new Date().toISOString().split("T")[0];
  if (status === "cancelled") return theme.colors.semantic.error;
  if (status === "completed" || eventDate < today) return theme.colors.dark.text.tertiary;
  return theme.colors.semantic.success;
};

const getStatusLabel = (status: string, eventDate: string) => {
  const today = new Date().toISOString().split("T")[0];
  if (status === "cancelled") return "Cancelled";
  if (status === "completed") return "Completed";
  if (eventDate < today) return "Past";
  return "Upcoming";
};

const getDaysUntil = (eventDate: string): string => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const event = new Date(eventDate + "T00:00:00");
  const diffTime = event.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 0) return `${Math.abs(diffDays)} days ago`;
  if (diffDays <= 7) return `In ${diffDays} days`;
  if (diffDays <= 30) return `In ${Math.ceil(diffDays / 7)} weeks`;
  return `In ${Math.ceil(diffDays / 30)} months`;
};

export const ShowList: FC<Props> = ({ shows, onEdit, onDelete, onReload }) => {
  const navigate = useNavigate();

  const handleViewShow = (showId: string) => {
    navigate(`/shows/${showId}`);
  };

  const handleMarkCompleted = async (show: Show) => {
    try {
      await markShowCompleted(show.id);
      onReload();
    } catch (error) {
      console.error("Failed to mark show as completed:", error);
      alert("Failed to update show status. Please try again.");
    }
  };

  const handleMarkCancelled = async (show: Show) => {
    const confirmed = window.confirm(
      `Are you sure you want to cancel "${show.name}"?`
    );
    if (!confirmed) return;

    try {
      await markShowCancelled(show.id);
      onReload();
    } catch (error) {
      console.error("Failed to cancel show:", error);
      alert("Failed to cancel show. Please try again.");
    }
  };

  return (
    <ShowsGrid>
      {shows.map((show) => {
        const today = new Date().toISOString().split("T")[0];
        const isPast = show.event_date < today;
        const isCancelled = show.status === "cancelled";
        const isUpcoming = !isPast && !isCancelled && show.status === "upcoming";

        return (
          <ShowCard key={show.id} $isPast={isPast} $isCancelled={isCancelled}>
            <ShowHeader>
              <DateBadge $isPast={isPast} $isCancelled={isCancelled}>
                <DateDay>
                  {new Date(show.event_date + "T00:00:00").getDate()}
                </DateDay>
                <DateMonth>
                  {new Date(show.event_date + "T00:00:00").toLocaleDateString("en-US", { month: "short" })}
                </DateMonth>
              </DateBadge>

              <ShowInfo>
                <ShowName $isCancelled={isCancelled}>{show.name}</ShowName>
                {show.venue && (
                  <ShowVenue>
                    <i className="bi bi-geo-alt"></i> {show.venue}
                  </ShowVenue>
                )}
                <ShowDateTime>
                  <i className="bi bi-calendar-event"></i> {formatDate(show.event_date)}
                  {show.event_time && (
                    <>
                      {" "}at {formatTime(show.event_time)}
                    </>
                  )}
                </ShowDateTime>
                {show.doors_time && (
                  <ShowDoors>
                    <i className="bi bi-door-open"></i> Doors: {formatTime(show.doors_time)}
                  </ShowDoors>
                )}
                <MetadataRow>
                  <StatusBadge $color={getStatusColor(show.status, show.event_date)}>
                    {getStatusLabel(show.status, show.event_date)}
                  </StatusBadge>
                  {isUpcoming && (
                    <CountdownBadge>
                      <i className="bi bi-clock"></i> {getDaysUntil(show.event_date)}
                    </CountdownBadge>
                  )}
                  {show.setlist_id && (
                    <SetlistBadge>
                      <i className="bi bi-music-note-list"></i> Setlist linked
                    </SetlistBadge>
                  )}
                </MetadataRow>
              </ShowInfo>

              <ActionButtons>
                <ActionButton
                  onClick={(e) => {
                    e.stopPropagation();
                    handleViewShow(show.id);
                  }}
                  title="View show details"
                  $variant="view"
                >
                  <i className="bi bi-eye"></i>
                </ActionButton>
                <ActionButton
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(show);
                  }}
                  title="Edit show"
                  $variant="edit"
                >
                  <i className="bi bi-pencil"></i>
                </ActionButton>
                {isUpcoming && (
                  <>
                    <ActionButton
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkCompleted(show);
                      }}
                      title="Mark as completed"
                      $variant="complete"
                    >
                      <i className="bi bi-check-circle"></i>
                    </ActionButton>
                    <ActionButton
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkCancelled(show);
                      }}
                      title="Cancel show"
                      $variant="cancel"
                    >
                      <i className="bi bi-x-circle"></i>
                    </ActionButton>
                  </>
                )}
                <ActionButton
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(show);
                  }}
                  title="Delete show"
                  $variant="delete"
                >
                  <i className="bi bi-trash"></i>
                </ActionButton>
              </ActionButtons>
            </ShowHeader>

            {show.notes && (
              <ShowNotes>
                <i className="bi bi-sticky"></i> {show.notes}
              </ShowNotes>
            )}

            {show.venue_address && (
              <ShowAddress>
                <i className="bi bi-pin-map"></i> {show.venue_address}
              </ShowAddress>
            )}
          </ShowCard>
        );
      })}
    </ShowsGrid>
  );
};

// Styled Components

const ShowsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
  gap: ${theme.space[4]};
  margin-top: ${theme.space[4]};

  @media (max-width: ${theme.breakpoints.md}) {
    grid-template-columns: 1fr;
  }
`;

const ShowCard = styled.div<{ $isPast: boolean; $isCancelled: boolean }>`
  background: ${theme.colors.dark.bg.secondary};
  border: 1px solid ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.lg};
  overflow: hidden;
  transition: all ${theme.transitions.base} ease;
  opacity: ${(props) => (props.$isPast || props.$isCancelled ? 0.7 : 1)};

  &:hover {
    border-color: ${theme.colors.brand.primary};
    box-shadow: ${theme.shadows.md};
    opacity: 1;
  }
`;

const ShowHeader = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${theme.space[3]};
  padding: ${theme.space[4]};
`;

const DateBadge = styled.div<{ $isPast: boolean; $isCancelled: boolean }>`
  width: 60px;
  height: 60px;
  background: ${(props) =>
    props.$isCancelled
      ? theme.colors.semantic.errorBgDark
      : props.$isPast
      ? theme.colors.dark.bg.tertiary
      : theme.gradients.brandPrimary};
  border-radius: ${theme.radius.md};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

const DateDay = styled.div`
  font-size: ${theme.fontSizes.h2};
  font-weight: ${theme.fontWeights.bold};
  color: white;
  line-height: 1;
`;

const DateMonth = styled.div`
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.semibold};
  color: rgba(255, 255, 255, 0.8);
  text-transform: uppercase;
  letter-spacing: ${theme.letterSpacing.wide};
`;

const ShowInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const ShowName = styled.h3<{ $isCancelled: boolean }>`
  font-size: ${theme.fontSizes.bodyLg};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.dark.text.primary};
  margin: 0 0 ${theme.space[2]} 0;
  line-height: ${theme.lineHeights.snug};
  text-decoration: ${(props) => (props.$isCancelled ? "line-through" : "none")};
`;

const ShowVenue = styled.div`
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

const ShowDateTime = styled.div`
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

const ShowDoors = styled.div`
  font-size: ${theme.fontSizes.bodyXs};
  color: ${theme.colors.dark.text.tertiary};
  margin-bottom: ${theme.space[2]};
  display: flex;
  align-items: center;
  gap: ${theme.space[1]};

  i {
    color: ${theme.colors.dark.text.tertiary};
  }
`;

const MetadataRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${theme.space[2]};
  margin-top: ${theme.space[2]};
`;

const StatusBadge = styled.span<{ $color: string }>`
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[1]};
  background: ${(props) => props.$color}20;
  border: 1px solid ${(props) => props.$color}40;
  color: ${(props) => props.$color};
  padding: ${theme.space[1]} ${theme.space[2]};
  border-radius: ${theme.radius.sm};
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.semibold};
  text-transform: uppercase;
  letter-spacing: ${theme.letterSpacing.wide};
`;

const CountdownBadge = styled.span`
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

  i {
    color: ${theme.colors.accent.amber};
  }
`;

const SetlistBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[1]};
  background: ${theme.colors.brand.primary}20;
  border: 1px solid ${theme.colors.brand.primary}40;
  color: ${theme.colors.brand.primary};
  padding: ${theme.space[1]} ${theme.space[2]};
  border-radius: ${theme.radius.sm};
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.medium};
`;

const ActionButtons = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${theme.space[1]};
  opacity: 0;
  transition: opacity ${theme.transitions.fast} ease;

  ${ShowHeader}:hover & {
    opacity: 1;
  }

  /* Always visible on touch devices */
  @media (max-width: ${theme.breakpoints.md}) {
    opacity: 1;
  }

  @media (hover: none) {
    opacity: 1;
  }
`;

const ActionButton = styled.button<{
  $variant: "view" | "edit" | "complete" | "cancel" | "delete";
}>`
  background: transparent;
  border: 1px solid ${theme.colors.dark.border.default};
  color: ${(props) => {
    if (props.$variant === "complete") return theme.colors.semantic.success;
    if (props.$variant === "cancel") return theme.colors.accent.amber;
    if (props.$variant === "delete") return theme.colors.semantic.error;
    return theme.colors.dark.text.secondary;
  }};
  width: 32px;
  height: 32px;
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  flex-shrink: 0;
  font-size: ${theme.fontSizes.bodySm};

  &:hover {
    background: ${(props) => {
      if (props.$variant === "complete") return theme.colors.semantic.successBgDark;
      if (props.$variant === "cancel") return theme.colors.semantic.warningBgDark;
      if (props.$variant === "delete") return theme.colors.semantic.errorBgDark;
      return theme.colors.dark.bg.elevated;
    }};
    border-color: ${(props) => {
      if (props.$variant === "complete") return theme.colors.semantic.success;
      if (props.$variant === "cancel") return theme.colors.accent.amber;
      if (props.$variant === "delete") return theme.colors.semantic.error;
      return theme.colors.brand.primary;
    }};
    color: ${(props) => {
      if (props.$variant === "complete") return theme.colors.semantic.success;
      if (props.$variant === "cancel") return theme.colors.accent.amber;
      if (props.$variant === "delete") return theme.colors.semantic.error;
      return theme.colors.brand.primary;
    }};
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
    background: ${(props) => {
      if (props.$variant === "complete") return theme.colors.semantic.successBgDark;
      if (props.$variant === "cancel") return theme.colors.semantic.warningBgDark;
      if (props.$variant === "delete") return theme.colors.semantic.errorBgDark;
      return theme.colors.dark.bg.elevated;
    }};
  }

  /* Larger touch targets on mobile */
  @media (max-width: ${theme.breakpoints.md}) {
    width: 40px;
    height: 40px;
    font-size: ${theme.fontSizes.body};
  }
`;

const ShowNotes = styled.div`
  padding: ${theme.space[3]} ${theme.space[4]};
  margin: 0;
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.dark.text.secondary};
  line-height: ${theme.lineHeights.relaxed};
  border-top: 1px solid ${theme.colors.dark.border.default};
  background: ${theme.colors.dark.bg.tertiary};
  display: flex;
  align-items: flex-start;
  gap: ${theme.space[2]};

  i {
    color: ${theme.colors.accent.amber};
    flex-shrink: 0;
    margin-top: 2px;
  }
`;

const ShowAddress = styled.div`
  padding: ${theme.space[2]} ${theme.space[4]} ${theme.space[3]};
  font-size: ${theme.fontSizes.bodyXs};
  color: ${theme.colors.dark.text.tertiary};
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  border-top: 1px solid ${theme.colors.dark.border.subtle};

  i {
    color: ${theme.colors.dark.text.tertiary};
  }
`;
