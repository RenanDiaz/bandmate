import styled from "styled-components";
import { useTranslation } from "react-i18next";
import { theme } from "../../theme";
import { BandAvatar } from "../BandAvatar";
import { eventLink } from "../../utils/upcomingEvents";
import type { UpcomingEvent } from "../../utils/upcomingEvents";

interface UpcomingEventRowProps {
  event: UpcomingEvent;
  /** "es-ES" | "en-US", as Home computes it. */
  locale: string;
  /** Renders the band chip when given (My upcoming events). */
  bandName?: string;
  bandAvatarUrl?: string | null;
  onOpen: () => void;
  /** The Setlist / Show chip (`eventLink`); omitted → no chip. */
  onOpenLink?: () => void;
}

/** One upcoming show or rehearsal: date block, type badge, name, place, date/time and countdown. */
export const UpcomingEventRow = ({
  event,
  locale,
  bandName,
  bandAvatarUrl,
  onOpen,
  onOpenLink,
}: UpcomingEventRowProps) => {
  const { t } = useTranslation();
  const link = onOpenLink ? eventLink(event) : null;

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString + "T00:00:00");
    return date.toLocaleDateString(locale, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (timeString: string): string => {
    const [hours, minutes] = timeString.split(":");
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return date.toLocaleTimeString(locale, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getDaysUntil = (eventDate: string): string => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const event = new Date(eventDate + "T00:00:00");
    const diffTime = event.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return t('home.today');
    if (diffDays === 1) return t('home.tomorrow');
    if (diffDays <= 7) return t('home.inDays', { count: diffDays });

    const weeks = Math.floor(diffDays / 7);
    const remainingDays = diffDays % 7;

    if (remainingDays === 0) {
      return t('home.inWeeks', { count: weeks });
    }

    if (weeks === 1) {
      return t('home.inWeekAndDays', { days: remainingDays, count: remainingDays });
    }

    return t('home.inWeeksAndDays', { weeks, days: remainingDays, count: remainingDays });
  };

  return (
    <ShowItem data-testid="upcoming-event-row" onClick={onOpen}>
      <ShowDate $isRehearsal={event.type === 'rehearsal'}>
        <ShowDay>
          {new Date(event.date + "T00:00:00").getDate()}
        </ShowDay>
        <ShowMonth>
          {new Date(event.date + "T00:00:00").toLocaleDateString(locale, {
            month: "short",
          })}
        </ShowMonth>
      </ShowDate>
      <ShowDetails>
        <EventTypeRow>
          <EventTypeBadge $isRehearsal={event.type === 'rehearsal'}>
            <i className={event.type === 'show' ? 'bi bi-mic' : 'bi bi-music-note-beamed'}></i>
            {event.type === 'show' ? t('home.show') : t('home.rehearsal')}
          </EventTypeBadge>
        </EventTypeRow>
        <ShowName>{event.data.name}</ShowName>
        {event.type === 'show' && event.data.venue && (
          <ShowVenue>{event.data.venue}</ShowVenue>
        )}
        {event.type === 'rehearsal' && event.data.location && (
          <ShowVenue>{event.data.location}</ShowVenue>
        )}
        <ShowMeta>
          <span>{formatDate(event.date)}</span>
          {event.time && (
            <span> {t('home.at')} {formatTime(event.time)}</span>
          )}
          <CountdownBadge>{getDaysUntil(event.date)}</CountdownBadge>
        </ShowMeta>
      </ShowDetails>
      {(bandName || link) && (
        <RowAside>
          {bandName && (
            <BandChip title={bandName}>
              <BandAvatar name={bandName} avatarUrl={bandAvatarUrl} size={18} initialFallback />
              <BandChipName>{bandName}</BandChipName>
            </BandChip>
          )}
          {link && onOpenLink && (
            <LinkChip
              type="button"
              onClick={(e) => {
                // A real button inside the clickable row: its click (mouse,
                // Enter or Space) must not also open the event.
                e.stopPropagation();
                onOpenLink();
              }}
            >
              <i className={link.labelKey === "home.setlist" ? "bi bi-list-ul" : "bi bi-mic"} aria-hidden="true"></i>
              {t(link.labelKey)}
            </LinkChip>
          )}
        </RowAside>
      )}
    </ShowItem>
  );
};

const ShowItem = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${theme.space[3]};
  padding: ${theme.space[3]};
  background: var(--color-bg-tertiary);
  border-radius: ${theme.radius.md};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  &:hover {
    background: var(--color-bg-elevated);
    transform: translateX(4px);
  }
`;

const ShowDate = styled.div<{ $isRehearsal?: boolean }>`
  width: 48px;
  height: 48px;
  background: ${(props) => props.$isRehearsal ? theme.colors.accent.cyan : theme.gradients.brandPrimary};
  border-radius: ${theme.radius.md};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

const ShowDay = styled.span`
  font-size: ${theme.fontSizes.bodyLg};
  font-weight: ${theme.fontWeights.bold};
  color: white;
  line-height: 1;
`;

const ShowMonth = styled.span`
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.medium};
  color: rgba(255, 255, 255, 0.8);
  text-transform: uppercase;
`;

const ShowDetails = styled.div`
  flex: 1;
  min-width: 0;
`;

const ShowName = styled.div`
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin-bottom: ${theme.space[1]};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ShowVenue = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
  margin-bottom: ${theme.space[1]};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const EventTypeRow = styled.div`
  margin-bottom: ${theme.space[1]};
`;

const EventTypeBadge = styled.span<{ $isRehearsal?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[1]};
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.medium};
  color: ${(props) => props.$isRehearsal ? theme.colors.accent.cyan : theme.colors.brand.primary};
  text-transform: uppercase;
  letter-spacing: 0.5px;

  i {
    font-size: ${theme.fontSizes.bodyXs};
  }
`;

const ShowMeta = styled.div`
  font-size: ${theme.fontSizes.bodyXs};
  color: var(--color-text-tertiary);
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  flex-wrap: wrap;
`;

const CountdownBadge = styled.span`
  display: inline-flex;
  align-items: center;
  background: ${theme.colors.accent.amber}20;
  color: ${theme.colors.accent.amber};
  padding: ${theme.space[1]} ${theme.space[2]};
  border-radius: ${theme.radius.sm};
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.medium};
`;

const RowAside = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: space-between;
  align-self: stretch;
  gap: ${theme.space[2]};
  flex-shrink: 0;
  max-width: 40%;
`;

const BandChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[1]};
  max-width: 100%;
  font-size: ${theme.fontSizes.bodyXs};
  color: var(--color-text-secondary);

  > div {
    border-radius: ${theme.radius.sm};
    font-size: 10px;
  }
`;

const BandChipName = styled.span`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const LinkChip = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[1]};
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.sm};
  padding: ${theme.space[1]} ${theme.space[2]};
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.medium};
  color: ${theme.colors.brand.primary};
  cursor: pointer;
  white-space: nowrap;
  transition: all ${theme.transitions.fast} ease;

  &:hover {
    border-color: ${theme.colors.brand.primary};
  }

  &:focus-visible {
    outline: 2px solid ${theme.colors.brand.primary};
    outline-offset: 2px;
  }
`;
