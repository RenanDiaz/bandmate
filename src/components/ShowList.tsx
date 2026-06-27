import { useState, type FC } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Show } from "../services/showsService";
import { markShowCompleted, markShowCancelled } from "../services/showsService";
import { downloadShowICS } from "../lib/calendarExport";
import styled from "styled-components";
import { theme } from "../theme";
import { getLocalToday, isToday } from "../lib/dateUtils";
import {
  Dropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
} from "reactstrap";
import { ConfirmModal } from "./ConfirmModal";
import { useToast } from "../context/useToast";

type ConfirmState = { title: string; message: string; confirmLabel: string; action: () => Promise<void> };

interface Props {
  shows: Show[];
  onEdit: (show: Show) => void;
  onDelete: (show: Show) => void;
  onReload: () => void;
  canEdit?: boolean;
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
  const today = getLocalToday();
  if (status === "cancelled") return theme.colors.semantic.error;
  if (status === "completed" || eventDate < today) return 'var(--color-text-tertiary)';
  if (isToday(eventDate)) return theme.colors.semantic.success;
  return theme.colors.brand.primary;
};

// Individual show card component to manage its own dropdown state
const ShowCardItem: FC<{
  show: Show;
  onEdit: (show: Show) => void;
  onDelete: (show: Show) => void;
  onView: (showId: string) => void;
  onMarkCompleted: (show: Show) => void;
  onMarkCancelled: (show: Show) => void;
  canEdit: boolean;
}> = ({ show, onEdit, onDelete, onView, onMarkCompleted, onMarkCancelled, canEdit }) => {
  const { t } = useTranslation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const toggleDropdown = () => setDropdownOpen((prev) => !prev);

  const today = getLocalToday();
  const isPast = show.event_date < today;
  const isCancelled = show.status === "cancelled";
  const isCompleted = show.status === "completed";
  const isShowToday = isToday(show.event_date) && !isCancelled && !isCompleted;
  const canChangeStatus = !isCancelled && !isCompleted;
  const isUpcoming = !isPast && !isCancelled && show.status === "upcoming";

  const getStatusLabel = () => {
    if (show.status === "cancelled") return t('shows.statusCancelled');
    if (show.status === "completed") return t('shows.statusCompleted');
    if (show.event_date < today) return t('shows.past');
    if (isShowToday) return t('shows.happeningNow');
    return t('shows.statusUpcoming');
  };

  const getDaysUntil = (): string => {
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const event = new Date(show.event_date + "T00:00:00");
    const diffTime = event.getTime() - todayDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return t('shows.today');
    if (diffDays === 1) return t('shows.tomorrow');
    if (diffDays < 0) return t('shows.daysAgo', { count: Math.abs(diffDays) });
    if (diffDays <= 7) return t('shows.inDays', { count: diffDays });

    const weeks = Math.floor(diffDays / 7);
    const remainingDays = diffDays % 7;

    if (remainingDays === 0) {
      return t('shows.inWeeks', { count: weeks });
    }

    return t('shows.inWeeksDays', { weeks, days: remainingDays });
  };

  return (
    <ShowCard $isPast={isPast} $isCancelled={isCancelled} $isToday={isShowToday} onClick={() => onView(show.id)} $clickable>
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
              <i className="bi bi-door-open"></i> {t('shows.doors')}: {formatTime(show.doors_time)}
            </ShowDoors>
          )}
          <MetadataRow>
            <StatusBadge $color={getStatusColor(show.status, show.event_date)}>
              {getStatusLabel()}
            </StatusBadge>
            {isUpcoming && (
              <CountdownBadge>
                <i className="bi bi-clock"></i> {getDaysUntil()}
              </CountdownBadge>
            )}
            {show.setlist_id && (
              <SetlistBadge>
                <i className="bi bi-music-note-list"></i> {t('shows.setlistLinked')}
              </SetlistBadge>
            )}
          </MetadataRow>
        </ShowInfo>

        {/* Desktop: Inline action buttons */}
        {canEdit && (
          <ActionButtons>
            <ActionButton
              onClick={(e) => {
                e.stopPropagation();
                onEdit(show);
              }}
              title={t('shows.editShowTooltip')}
              $variant="edit"
            >
              <i className="bi bi-pencil"></i>
            </ActionButton>
            {canChangeStatus && (
              <>
                <ActionButton
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkCompleted(show);
                  }}
                  title={t('shows.markCompleted')}
                  $variant="complete"
                >
                  <i className="bi bi-check-circle"></i>
                </ActionButton>
                <ActionButton
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkCancelled(show);
                  }}
                  title={t('shows.cancelShowTooltip')}
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
              title={t('shows.deleteShowTooltip')}
              $variant="delete"
            >
              <i className="bi bi-trash"></i>
            </ActionButton>
            <ActionButton
              onClick={(e) => {
                e.stopPropagation();
                downloadShowICS(show);
              }}
              title={t('shows.addToCalendar')}
              $variant="view"
            >
              <i className="bi bi-calendar-plus"></i>
            </ActionButton>
          </ActionButtons>
        )}

        {/* Mobile: Dropdown menu */}
        {canEdit && (
          <MobileDropdownWrapper onClick={(e) => e.stopPropagation()}>
            <Dropdown isOpen={dropdownOpen} toggle={toggleDropdown}>
              <DropdownToggle tag="button" className="mobile-actions-toggle">
                <i className="bi bi-three-dots-vertical"></i>
              </DropdownToggle>
              <DropdownMenu end dark container="body">
                <DropdownItem onClick={(e) => {
                  e.stopPropagation();
                  onEdit(show);
                }}>
                  <i className="bi bi-pencil me-2"></i> {t('common.edit')}
                </DropdownItem>
                {canChangeStatus && (
                  <>
                    <DropdownItem onClick={(e) => {
                      e.stopPropagation();
                      onMarkCompleted(show);
                    }}>
                      <i className="bi bi-check-circle me-2 text-success"></i> {t('shows.markCompletedAction')}
                    </DropdownItem>
                    <DropdownItem onClick={(e) => {
                      e.stopPropagation();
                      onMarkCancelled(show);
                    }}>
                      <i className="bi bi-x-circle me-2 text-warning"></i> {t('shows.cancelShow')}
                    </DropdownItem>
                  </>
                )}
                <DropdownItem onClick={(e) => {
                  e.stopPropagation();
                  downloadShowICS(show);
                }}>
                  <i className="bi bi-calendar-plus me-2"></i> {t('shows.addToCalendar')}
                </DropdownItem>
                <DropdownItem divider />
                <DropdownItem onClick={(e) => {
                  e.stopPropagation();
                  onDelete(show);
                }} className="text-danger">
                  <i className="bi bi-trash me-2"></i> {t('common.delete')}
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </MobileDropdownWrapper>
        )}
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
};

export const ShowList: FC<Props> = ({ shows, onEdit, onDelete, onReload, canEdit = true }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const runConfirm = async () => {
    if (!confirm) return;
    setConfirmBusy(true);
    try {
      await confirm.action();
    } finally {
      setConfirmBusy(false);
      setConfirm(null);
    }
  };

  const handleViewShow = (showId: string) => {
    navigate(`/shows/${showId}`);
  };

  const handleMarkCompleted = async (show: Show) => {
    try {
      await markShowCompleted(show.id);
      onReload();
    } catch (error) {
      console.error("Failed to mark show as completed:", error);
      toast.error(t('shows.updateStatusError'));
    }
  };

  const handleMarkCancelled = async (show: Show) => {
    setConfirm({
      title: t('shows.cancelShow'),
      message: t('shows.cancelConfirm', { name: show.name }),
      confirmLabel: t('shows.cancelShow'),
      action: async () => {
        try {
          await markShowCancelled(show.id);
          onReload();
        } catch (error) {
          console.error("Failed to cancel show:", error);
          toast.error(t('shows.cancelError'));
        }
      },
    });
  };

  return (
    <>
      <ShowsGrid>
        {shows.map((show) => (
          <ShowCardItem
            key={show.id}
            show={show}
            onEdit={onEdit}
            onDelete={onDelete}
            onView={handleViewShow}
            onMarkCompleted={handleMarkCompleted}
            onMarkCancelled={handleMarkCancelled}
            canEdit={canEdit}
          />
        ))}
      </ShowsGrid>

      <ConfirmModal
        isOpen={confirm !== null}
        title={confirm?.title ?? ""}
        message={confirm?.message ?? ""}
        confirmLabel={confirm?.confirmLabel}
        tone="danger"
        busy={confirmBusy}
        onConfirm={runConfirm}
        onClose={() => setConfirm(null)}
      />
    </>
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

const ShowCard = styled.div<{ $isPast: boolean; $isCancelled: boolean; $isToday?: boolean; $clickable?: boolean }>`
  background: var(--color-bg-secondary);
  border: 1px solid ${(props) => props.$isToday ? `${theme.colors.semantic.success}50` : 'var(--color-border)'};
  border-radius: ${theme.radius.lg};
  overflow: hidden;
  transition: all ${theme.transitions.base} ease;
  opacity: ${(props) => (props.$isPast || props.$isCancelled ? 0.7 : 1)};
  cursor: ${(props) => (props.$clickable ? "pointer" : "default")};
  ${(props) => props.$isToday && `box-shadow: 0 0 0 1px ${theme.colors.semantic.success}30;`}

  &:hover {
    border-color: ${(props) => props.$isToday ? theme.colors.semantic.success : theme.colors.brand.primary};
    box-shadow: var(--shadow-md);
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
      ? 'var(--color-bg-tertiary)'
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
  color: var(--color-text-primary);
  margin: 0 0 ${theme.space[2]} 0;
  line-height: ${theme.lineHeights.snug};
  text-decoration: ${(props) => (props.$isCancelled ? "line-through" : "none")};
`;

const ShowVenue = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
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
  color: var(--color-text-secondary);
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
  color: var(--color-text-tertiary);
  margin-bottom: ${theme.space[2]};
  display: flex;
  align-items: center;
  gap: ${theme.space[1]};

  i {
    color: var(--color-text-tertiary);
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
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
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

const ActionButton = styled.button<{
  $variant: "view" | "edit" | "complete" | "cancel" | "delete";
}>`
  background: transparent;
  border: 1px solid var(--color-border);
  color: ${(props) => {
    if (props.$variant === "complete") return theme.colors.semantic.success;
    if (props.$variant === "cancel") return theme.colors.accent.amber;
    if (props.$variant === "delete") return theme.colors.semantic.error;
    return 'var(--color-text-secondary)';
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
      return 'var(--color-bg-elevated)';
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
      return 'var(--color-bg-elevated)';
    }};
  }
`;

const ShowNotes = styled.div`
  padding: ${theme.space[3]} ${theme.space[4]};
  margin: 0;
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
  line-height: ${theme.lineHeights.relaxed};
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-tertiary);
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
  color: var(--color-text-tertiary);
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  border-top: 1px solid var(--color-border-subtle);

  i {
    color: var(--color-text-tertiary);
  }
`;
