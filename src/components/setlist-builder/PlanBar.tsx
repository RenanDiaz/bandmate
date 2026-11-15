import { useEffect, useId, useState, type FC } from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import { theme } from "../../theme";
import { noIosZoom } from "../ui/fields";
import { formatClock } from "../../utils/setlistText";
import type { PlanProgress } from "../../utils/setlistPlan";

/**
 * Totals and target of a setlist (docs/specs/setlist-builder.md §4.1):
 * "12 songs · 48:20 of music · 58:20 with breaks   Target [60] min ████░░ 48 / 60".
 * Progress is music + breaks against the target; over it the bar turns amber
 * and reads "63 / 60 (+3)". No target: totals only. Presentational (no
 * service calls) so it renders with `renderToStaticMarkup`.
 */
export interface PlanBarProps {
  progress: PlanProgress;
  targetMinutes: number | null;
  onTargetChange?: (minutes: number | null) => void;
  /** Detail view: shows the target, no input. */
  readOnly?: boolean;
  /** False when the page already shows the counts (detail header). */
  showTotals?: boolean;
}

const T = "setlists.plan";

/** Whole minutes, rounded down: 58:20 → 58. */
const minutesOf = (seconds: number) => Math.floor(seconds / 60);

export const PlanBar: FC<PlanBarProps> = ({
  progress,
  targetMinutes,
  onTargetChange,
  readOnly = false,
  showTotals = true,
}) => {
  const { t } = useTranslation();
  const inputId = useId();
  // Local text so typing "6" on the way to "60" doesn't fight the parsed value.
  const [draft, setDraft] = useState(targetMinutes === null ? "" : String(targetMinutes));
  useEffect(() => {
    setDraft(targetMinutes === null ? "" : String(targetMinutes));
  }, [targetMinutes]);

  const hasTarget = progress.targetSeconds !== undefined && progress.ratio !== undefined;
  const over = progress.overBySeconds !== undefined;
  const hasBreaks = progress.totalSeconds > progress.musicSeconds;

  const commit = (text: string) => {
    setDraft(text);
    const value = Number.parseInt(text, 10);
    onTargetChange?.(Number.isFinite(value) && value > 0 ? value : null);
  };

  return (
    <Bar data-testid="plan-bar">
      {showTotals && (
        <Totals>
          <span>{t(`${T}.songs`, { count: progress.songCount })}</span>
          {progress.musicSeconds > 0 && <span>{t(`${T}.music`, { duration: formatClock(progress.musicSeconds) })}</span>}
          {hasBreaks && <span>{t(`${T}.withBreaks`, { duration: formatClock(progress.totalSeconds) })}</span>}
        </Totals>
      )}

      {(!readOnly || hasTarget) && (
        <TargetRow>
          {readOnly ? (
            <TargetLabel as="span">{t(`${T}.target`)}</TargetLabel>
          ) : (
            <>
              <TargetLabel htmlFor={inputId}>{t(`${T}.target`)}</TargetLabel>
              <TargetInput
                id={inputId}
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                placeholder="—"
                value={draft}
                onChange={(e) => commit(e.target.value)}
                aria-describedby={hasTarget ? `${inputId}-progress` : undefined}
              />
              <Unit>{t(`${T}.minutes`)}</Unit>
            </>
          )}

          {hasTarget && (
            <Progress id={`${inputId}-progress`} $over={over} data-over={over}>
              <Track
                role="progressbar"
                aria-label={t(`${T}.progressLabel`)}
                aria-valuemin={0}
                aria-valuemax={minutesOf(progress.targetSeconds!)}
                aria-valuenow={minutesOf(progress.totalSeconds)}
              >
                <Fill $over={over} style={{ width: `${Math.min(100, progress.ratio! * 100)}%` }} />
              </Track>
              <ProgressText>
                {over
                  ? t(`${T}.over`, {
                      total: minutesOf(progress.totalSeconds),
                      target: minutesOf(progress.targetSeconds!),
                      over: minutesOf(progress.overBySeconds!),
                    })
                  : t(`${T}.under`, {
                      total: minutesOf(progress.totalSeconds),
                      target: minutesOf(progress.targetSeconds!),
                    })}
              </ProgressText>
            </Progress>
          )}
        </TargetRow>
      )}
    </Bar>
  );
};

const Bar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${theme.space[2]} ${theme.space[4]};
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
`;

const Totals = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${theme.space[1]};

  > span + span::before {
    content: "·";
    margin-right: ${theme.space[1]};
    color: var(--color-text-disabled);
  }
`;

const TargetRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  flex-wrap: wrap;
`;

const TargetLabel = styled.label`
  margin: 0;
  color: var(--color-text-secondary);
`;

const TargetInput = styled.input`
  width: 4.5rem;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  border-radius: ${theme.radius.base};
  padding: ${theme.space[1]} ${theme.space[2]};
  font-size: ${theme.fontSizes.bodySm};
  ${noIosZoom}
  text-align: right;

  &:focus {
    outline: none;
    border-color: ${theme.colors.brand.primary};
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.15);
  }
`;

const Unit = styled.span`
  color: var(--color-text-tertiary);
`;

const Progress = styled.div<{ $over: boolean }>`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  color: ${(p) => (p.$over ? theme.colors.semantic.warning : "var(--color-text-primary)")};
  font-weight: ${theme.fontWeights.medium};
  font-variant-numeric: tabular-nums;
`;

const Track = styled.div`
  width: 6rem;
  height: 6px;
  border-radius: ${theme.radius.full};
  background: var(--color-bg-tertiary);
  overflow: hidden;
`;

const Fill = styled.div<{ $over: boolean }>`
  height: 100%;
  border-radius: inherit;
  background: ${(p) => (p.$over ? theme.colors.semantic.warning : theme.colors.brand.primary)};
`;

const ProgressText = styled.span`
  white-space: nowrap;
`;
