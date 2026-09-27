import type { FC } from "react";
import { useEffect, useMemo, useState } from "react";
import styled, { keyframes } from "styled-components";
import { useTranslation } from "react-i18next";
import { theme } from "../../theme";
import { useBandContext } from "../../context/useBandContext";
import { useOpenInBand } from "../../hooks/useOpenInBand";
import { getUpcomingShowsForBands } from "../../services/showsService";
import type { Show } from "../../services/showsService";
import { getUpcomingRehearsalsForBands } from "../../services/rehearsalsService";
import type { Rehearsal } from "../../services/rehearsalsService";
import { eventLink, eventPath, mergeUpcomingEvents } from "../../utils/upcomingEvents";
import { UpcomingEventRow } from "./UpcomingEventRow";

/** Rows shown before "Show all {n}". */
export const VISIBLE_EVENTS = 6;

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; shows: Show[]; rehearsals: Rehearsal[] };

/**
 * Upcoming shows and rehearsals of every band the user belongs to (spec
 * my-upcoming-events §2, §3.4). Renders nothing with fewer than two bands.
 * Loads its own data, independently of the band dashboard: a failure is an
 * inline line + Retry, never a toast and never reportNetworkFailure() (the
 * band dashboard stays the one reporter, decision 6).
 */
export const MyUpcomingEvents: FC = () => {
  const { t, i18n } = useTranslation();
  const { bands } = useBandContext();
  const openInBand = useOpenInBand();
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [expanded, setExpanded] = useState(false);

  // A stable key: a refreshBands() that returns the same bands (new array,
  // new objects) must not refetch.
  const bandKey = useMemo(
    () =>
      bands
        .map((band) => band.id)
        .sort((a, b) => a - b)
        .join(","),
    [bands]
  );
  const enabled = bands.length >= 2;

  useEffect(() => {
    if (!enabled) return;
    const ids = bandKey.split(",").map(Number);
    // Cleanup runs when the key changes: a response for an old key never
    // overwrites a newer one.
    let stale = false;
    setLoad({ status: "loading" });
    Promise.all([getUpcomingShowsForBands(ids), getUpcomingRehearsalsForBands(ids)])
      .then(([shows, rehearsals]) => {
        if (!stale) setLoad({ status: "ready", shows, rehearsals });
      })
      .catch((error) => {
        console.error(error);
        if (!stale) setLoad({ status: "error" });
      });
    return () => {
      stale = true;
    };
  }, [enabled, bandKey, attempt]);

  // Names and avatars from the current bands, so a rename shows without a refetch.
  const bandById = useMemo(() => new Map(bands.map((band) => [band.id, band])), [bands]);
  const bandNameById = useMemo(
    () => new Map(bands.map((band) => [band.id, band.name])),
    [bands]
  );
  const events = useMemo(
    () => (load.status === "ready" ? mergeUpcomingEvents(load.shows, load.rehearsals, bandNameById) : []),
    [load, bandNameById]
  );

  if (!enabled) return null;

  const locale = i18n.language.startsWith("es") ? "es-ES" : "en-US";
  const visible = expanded ? events : events.slice(0, VISIBLE_EVENTS);

  return (
    <Section aria-labelledby="my-upcoming-events-title">
      <Header>
        <Title id="my-upcoming-events-title">
          <i className="bi bi-calendar-week" aria-hidden="true"></i>
          {t("home.myUpcomingEvents")}
        </Title>
        <Hint>{t("home.myUpcomingEventsHint")}</Hint>
      </Header>
      <Content>
        {load.status === "loading" ? (
          <SkeletonLine data-testid="my-upcoming-events-loading" aria-busy="true" />
        ) : load.status === "error" ? (
          <ErrorLine>
            <span>
              <i className="bi bi-exclamation-circle" aria-hidden="true"></i> {t("home.myEventsLoadError")}
            </span>
            <TextButton type="button" onClick={() => setAttempt((n) => n + 1)}>
              {t("common.retry")}
            </TextButton>
          </ErrorLine>
        ) : events.length === 0 ? (
          <EmptyLine>{t("home.noMyUpcomingEvents")}</EmptyLine>
        ) : (
          <>
            <EventsList>
              {visible.map((event) => {
                const band = bandById.get(event.bandId);
                const link = eventLink(event);
                return (
                  <UpcomingEventRow
                    key={`${event.type}-${event.id}`}
                    event={event}
                    locale={locale}
                    bandName={band?.name ?? ""}
                    bandAvatarUrl={band?.avatar_url}
                    onOpen={() => openInBand(event.bandId, eventPath(event))}
                    onOpenLink={link ? () => openInBand(event.bandId, link.path) : undefined}
                  />
                );
              })}
            </EventsList>
            {events.length > VISIBLE_EVENTS && (
              <ToggleRow>
                <TextButton type="button" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
                  {expanded ? t("home.showFewerEvents") : t("home.showAllEvents", { count: events.length })}
                  <i className={expanded ? "bi bi-chevron-up" : "bi bi-chevron-down"} aria-hidden="true"></i>
                </TextButton>
              </ToggleRow>
            )}
          </>
        )}
      </Content>
    </Section>
  );
};

const pulse = keyframes`
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
`;

const Section = styled.section`
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.lg};
  overflow: hidden;
  margin-bottom: ${theme.space[2]};
`;

const Header = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: ${theme.space[1]} ${theme.space[4]};
  padding: ${theme.space[4]};
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-tertiary);
`;

const Title = styled.h2`
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};

  i {
    color: ${theme.colors.brand.primary};
  }
`;

const Hint = styled.span`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-tertiary);
`;

const Content = styled.div`
  padding: ${theme.space[4]};
`;

const EventsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[3]};
`;

const SkeletonLine = styled.div`
  height: 72px;
  border-radius: ${theme.radius.md};
  background: var(--color-bg-tertiary);
  animation: ${pulse} 1.4s ease-in-out infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const ErrorLine = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: ${theme.space[2]};
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);

  i {
    color: ${theme.colors.semantic.warning};
  }
`;

const EmptyLine = styled.p`
  margin: 0;
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-tertiary);
`;

const ToggleRow = styled.div`
  display: flex;
  justify-content: center;
  margin-top: ${theme.space[3]};
`;

const TextButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[1]};
  background: transparent;
  border: none;
  padding: ${theme.space[1]} ${theme.space[2]};
  color: ${theme.colors.brand.primary};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;

  &:hover {
    color: ${theme.colors.brand.primaryHover};
  }
`;
