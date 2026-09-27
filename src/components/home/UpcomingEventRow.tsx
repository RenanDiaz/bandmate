import styled from "styled-components";
import { useTranslation } from "react-i18next";
import { theme } from "../../theme";
import type { UpcomingEvent } from "../../utils/upcomingEvents";

interface UpcomingEventRowProps {
  event: UpcomingEvent;
  /** "es-ES" | "en-US", as Home computes it. */
  locale: string;
  /** Renders the band chip when given (My upcoming events, PR 1.2). */
  bandName?: string;
  onOpen: () => void;
  /** The Setlist / Show chip (PR 1.2); omitted → no chip. */
  onOpenLink?: () => void;
}

/** One upcoming show or rehearsal: date block, type badge, name, place, date/time and countdown. */
export const UpcomingEventRow = ({ event, locale, onOpen }: UpcomingEventRowProps) => {
  const { t } = useTranslation();

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
    <ShowItem onClick={onOpen}>
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
