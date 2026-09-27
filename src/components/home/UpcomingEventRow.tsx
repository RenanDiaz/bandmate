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

/** Countdowns up to this many days away are emphasised; later ones are plain. */
export const SOON_DAYS = 7;

/**
 * One upcoming show or rehearsal, two lines (spec my-upcoming-events §2):
 * the date block (weekday, day, month), then the name, then one meta line
 * with the band chip, type, place, time and countdown. The Setlist / Show
 * chip sits on the right.
 */
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
  const isRehearsal = event.type === "rehearsal";
  const eventDate = new Date(event.date + "T00:00:00");

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

  const daysUntil = (): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const countdown = (diffDays: number): string => {
    if (diffDays === 0) return t("home.today");
    if (diffDays === 1) return t("home.tomorrow");
    if (diffDays <= 7) return t("home.inDays", { count: diffDays });

    const weeks = Math.floor(diffDays / 7);
    const remainingDays = diffDays % 7;

    if (remainingDays === 0) {
      return t("home.inWeeks", { count: weeks });
    }

    if (weeks === 1) {
      return t("home.inWeekAndDays", { days: remainingDays, count: remainingDays });
    }

    return t("home.inWeeksAndDays", { weeks, days: remainingDays, count: remainingDays });
  };

  const days = daysUntil();
  const place = event.type === "show" ? event.data.venue : event.data.location;

  return (
    <Row data-testid="upcoming-event-row" onClick={onOpen}>
      <DateBlock $isRehearsal={isRehearsal} data-testid="event-date">
        <DateWeekday>{eventDate.toLocaleDateString(locale, { weekday: "short" })}</DateWeekday>
        <DateDay>{eventDate.getDate()}</DateDay>
        <DateMonth>{eventDate.toLocaleDateString(locale, { month: "short" })}</DateMonth>
      </DateBlock>
      <Details>
        <Name>{event.data.name}</Name>
        <Meta data-testid="event-meta">
          {bandName && (
            <BandChip title={bandName}>
              <BandAvatar name={bandName} avatarUrl={bandAvatarUrl} size={16} initialFallback />
              <BandChipName>{bandName}</BandChipName>
            </BandChip>
          )}
          <EventType $isRehearsal={isRehearsal}>
            <i className={isRehearsal ? "bi bi-music-note-beamed" : "bi bi-mic"} aria-hidden="true"></i>
            {isRehearsal ? t("home.rehearsal") : t("home.show")}
          </EventType>
          {place && <Place>{place}</Place>}
          {event.time && <span>{formatTime(event.time)}</span>}
          <Countdown $soon={days <= SOON_DAYS} data-testid="event-countdown" data-soon={days <= SOON_DAYS}>
            {countdown(days)}
          </Countdown>
        </Meta>
      </Details>
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
    </Row>
  );
};

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  padding: ${theme.space[2]} ${theme.space[3]};
  border-radius: ${theme.radius.md};
  cursor: pointer;
  transition: background ${theme.transitions.fast} ease;

  &:hover {
    background: var(--color-bg-tertiary);
  }

  /* Narrow: the link chip would squeeze the name, so it drops under the
     meta line, aligned with the text (spec §2, AC12). */
  @media (max-width: ${theme.breakpoints.md}) {
    display: grid;
    grid-template-columns: 48px minmax(0, 1fr);
    align-items: start;
  }
`;

const DateBlock = styled.div<{ $isRehearsal?: boolean }>`
  width: 48px;
  height: 52px;
  background: ${(props) => (props.$isRehearsal ? theme.colors.accent.cyan : theme.gradients.brandPrimary)};
  border-radius: ${theme.radius.md};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  flex-shrink: 0;
  color: white;
`;

const DateWeekday = styled.span`
  font-size: 10px;
  font-weight: ${theme.fontWeights.medium};
  line-height: 1;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.85;
`;

const DateDay = styled.span`
  font-size: ${theme.fontSizes.bodyLg};
  font-weight: ${theme.fontWeights.bold};
  line-height: 1;
`;

const DateMonth = styled.span`
  font-size: 10px;
  font-weight: ${theme.fontWeights.medium};
  line-height: 1;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.85;
`;

const Details = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: ${theme.space[1]};
`;

const Name = styled.div`
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

/** One line: band · type · place · time · countdown, separated by dots. */
const Meta = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-tertiary);
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  column-gap: ${theme.space[1]};
  row-gap: 2px;
  min-width: 0;

  > * + *::before {
    content: "·";
    margin-right: ${theme.space[1]};
    color: var(--color-text-disabled);
  }
`;

const BandChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[1]};
  max-width: 100%;
  color: var(--color-text-secondary);
  font-weight: ${theme.fontWeights.medium};

  > div {
    border-radius: ${theme.radius.sm};
    font-size: 9px;
  }
`;

const BandChipName = styled.span`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const EventType = styled.span<{ $isRehearsal?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[1]};
  color: ${(props) => (props.$isRehearsal ? theme.colors.accent.cyan : theme.colors.brand.primary)};
  white-space: nowrap;

  i {
    font-size: ${theme.fontSizes.bodyXs};
  }
`;

const Place = styled.span`
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
`;

/** Plain text; amber only when the event is close, so the colour means something. */
const Countdown = styled.span<{ $soon: boolean }>`
  white-space: nowrap;
  color: ${(props) => (props.$soon ? theme.colors.accent.amber : "inherit")};
  font-weight: ${(props) => (props.$soon ? theme.fontWeights.medium : theme.fontWeights.regular)};
`;

const LinkChip = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[1]};
  flex-shrink: 0;
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

  @media (max-width: ${theme.breakpoints.md}) {
    grid-column: 2;
    justify-self: start;
    margin-top: ${theme.space[1]};
  }
`;
