import type { FC } from "react";
import styled from "styled-components";
import { useTranslation } from "react-i18next";
import { theme } from "../theme";
import { formatShowClock } from "../lib/showClock";
import type { ShowClock } from "../lib/showClock";

interface ShowClockControlProps {
  status: ShowClock["status"];
  elapsedMs: number;
  /** The first song has a backing track on this device: playing it starts the clock. */
  autoStartArmed: boolean;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
}

/**
 * The show clock in performance mode's top bar (docs/specs/show-clock.md).
 * Presentational: state and persistence live in useShowClock.
 */
export const ShowClockControl: FC<ShowClockControlProps> = ({
  status,
  elapsedMs,
  autoStartArmed,
  onStart,
  onPause,
  onReset,
}) => {
  const { t } = useTranslation();
  const time = formatShowClock(elapsedMs);

  if (status === "idle") {
    return (
      <ClockGroup $status={status}>
        <ClockButton
          type="button"
          onClick={onStart}
          title={autoStartArmed ? t("performance.showClock.startAuto") : t("performance.showClock.start")}
          aria-label={t("performance.showClock.start")}
        >
          <i className="bi bi-stopwatch" aria-hidden="true"></i>
          <ClockTime>{time}</ClockTime>
          {autoStartArmed && <i className="bi bi-music-note-beamed" aria-hidden="true" data-testid="show-clock-auto"></i>}
        </ClockButton>
      </ClockGroup>
    );
  }

  return (
    <ClockGroup $status={status}>
      <ClockReadout role="timer" aria-label={t("performance.showClock.label")} title={t("performance.showClock.label")}>
        <i className="bi bi-stopwatch" aria-hidden="true"></i>
        <ClockTime>{time}</ClockTime>
      </ClockReadout>
      {status === "running" ? (
        <ClockIconButton
          type="button"
          onClick={onPause}
          title={t("performance.showClock.stop")}
          aria-label={t("performance.showClock.stop")}
        >
          <i className="bi bi-pause-fill" aria-hidden="true"></i>
        </ClockIconButton>
      ) : (
        <>
          <ClockIconButton
            type="button"
            onClick={onStart}
            title={t("performance.showClock.resume")}
            aria-label={t("performance.showClock.resume")}
          >
            <i className="bi bi-play-fill" aria-hidden="true"></i>
          </ClockIconButton>
          <ClockIconButton
            type="button"
            onClick={onReset}
            title={t("performance.showClock.reset")}
            aria-label={t("performance.showClock.reset")}
          >
            <i className="bi bi-arrow-counterclockwise" aria-hidden="true"></i>
          </ClockIconButton>
        </>
      )}
    </ClockGroup>
  );
};

export default ShowClockControl;

const ClockGroup = styled.div<{ $status: ShowClock["status"] }>`
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[1]};
  flex-shrink: 0;
  padding: 2px;
  background: var(--color-bg-tertiary);
  border-radius: ${theme.radius.base};
  color: ${(props) =>
    props.$status === "running"
      ? "var(--color-text-primary)"
      : props.$status === "paused"
        ? theme.colors.semantic.warning
        : "var(--color-text-secondary)"};
`;

const ClockTime = styled.span`
  font-variant-numeric: tabular-nums;
  font-weight: ${theme.fontWeights.medium};
`;

const ClockReadout = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[2]};
  padding: ${theme.space[1]} ${theme.space[2]};
  font-size: ${theme.fontSizes.body};
  white-space: nowrap;
`;

const ClockButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[2]};
  min-height: 36px;
  padding: ${theme.space[1]} ${theme.space[3]};
  background: transparent;
  border: none;
  border-radius: ${theme.radius.base};
  color: inherit;
  font-size: ${theme.fontSizes.body};
  white-space: nowrap;
  cursor: pointer;

  &:hover {
    color: var(--color-text-primary);
  }
`;

const ClockIconButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: transparent;
  border: none;
  border-radius: ${theme.radius.base};
  color: var(--color-text-secondary);
  font-size: ${theme.fontSizes.bodyLg};
  cursor: pointer;

  &:hover {
    color: var(--color-text-primary);
    background: var(--color-bg-secondary);
  }
`;
