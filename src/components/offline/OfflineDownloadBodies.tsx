import type { FC } from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import { theme } from "../../theme";
import type { DownloadProgress, OfflineSnapshot } from "../../services/offlineSetlistService";
import type { DownloadFailureCode, FinishedDownload } from "../../context/offlineDownloadController";
import type { PlanSummary } from "../../lib/offlineDownloadUi";
import {
  failureMessageKey,
  formatBytes,
  formatSavedDate,
  groupMissingBySong,
  reasonKey,
} from "../../lib/offlineDownloadUi";

/**
 * Presentational parts of the offline download flow (PR 2.3). No portal and no
 * service calls, so they render with renderToStaticMarkup in tests; the modal
 * and the action wire them up.
 */

export interface PlatformHints {
  ios: boolean;
  standalone: boolean;
}

export const OfflineDownloadConfirmBody: FC<{ summary: PlanSummary; platform: PlatformHints }> = ({
  summary,
  platform,
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  return (
    <Details data-testid="offline-confirm">
      <Facts>
        <li>{t("offline.confirm.songs", { count: summary.songCount })}</li>
        {summary.filesToDownload > 0 ? (
          <li>
            {t("offline.confirm.pdfs", { count: summary.filesToDownload })}
            {summary.bytesToDownload > 0 && (
              <> · {t("offline.confirm.size", { size: formatBytes(summary.bytesToDownload, locale) })}</>
            )}
          </li>
        ) : (
          <li>{t("offline.confirm.nothingToDownload")}</li>
        )}
        {summary.filesWithUnknownSize > 0 && (
          <li>{t("offline.confirm.unknownSize", { count: summary.filesWithUnknownSize })}</li>
        )}
        {summary.filesAlreadyPresent > 0 && (
          <li>
            {t("offline.confirm.alreadyPresent", {
              count: summary.filesAlreadyPresent,
              size: formatBytes(summary.bytesAlreadyPresent, locale),
            })}
          </li>
        )}
      </Facts>
      {summary.quotaWarning && (
        <Note $tone="warning" role="alert">
          <i className="bi bi-exclamation-triangle" />
          <span>
            {summary.freeBytes !== null
              ? t("offline.confirm.quotaWarning", { free: formatBytes(summary.freeBytes, locale) })
              : t("offline.confirm.quotaWarningNoEstimate")}
          </span>
        </Note>
      )}
      {platform.ios && (
        <Note $tone="info">
          <i className="bi bi-phone" />
          <span>{t("offline.confirm.iosSaved")}</span>
        </Note>
      )}
      {platform.ios && !platform.standalone && (
        <Note $tone="warning" data-testid="offline-ios-hint">
          <i className="bi bi-box-arrow-down" />
          <span>{t("offline.confirm.iosInstallHint")}</span>
        </Note>
      )}
    </Details>
  );
};

export const OfflineDownloadProgressBody: FC<{ progress: DownloadProgress | null }> = ({ progress }) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const total = progress?.filesTotal ?? 0;
  const done = progress?.filesDone ?? 0;
  const ratio =
    progress && progress.bytesTotal > 0
      ? Math.min(1, progress.bytesDone / progress.bytesTotal)
      : total > 0
        ? done / total
        : 0;
  const status =
    !progress || progress.state === "planning"
      ? t("offline.progress.preparing")
      : progress.state === "committing"
        ? t("offline.progress.committing")
        : null;
  return (
    <Details data-testid="offline-progress">
      <Bar role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)}>
        <BarFill style={{ width: `${Math.round(ratio * 100)}%` }} />
      </Bar>
      <Facts>
        <li>{t("offline.progress.files", { done, total })}</li>
        {progress && progress.bytesTotal > 0 && (
          <li>
            {t("offline.progress.bytes", {
              done: formatBytes(progress.bytesDone, locale),
              total: formatBytes(progress.bytesTotal, locale),
            })}
          </li>
        )}
        {status && <li>{status}</li>}
        {progress?.currentFile && (
          <li>
            <Current>
              {t("offline.progress.current", {
                song: progress.currentFile.songTitle || t("offline.result.unknownSong"),
                pdf: progress.currentFile.name || t("offline.result.unknownPdf"),
              })}
            </Current>
          </li>
        )}
      </Facts>
      <Note $tone="info">
        <i className="bi bi-phone" />
        <span>{t("offline.progress.keepOpen")}</span>
      </Note>
    </Details>
  );
};

export interface ResultBodyProps {
  result: FinishedDownload;
  /** Labels for missing files (done-with-errors); null falls back to generic labels. */
  snapshot: Pick<OfflineSnapshot, "songsById" | "sheetMusicBySongId"> | null;
  /** For download-in-progress: the setlist this tab is downloading, if any. */
  runningSetlistName: string | null;
}

/** i18n key for a failure, with the download-in-progress split between this tab and another. */
function failureKey(code: DownloadFailureCode | null, runningHere: boolean): string {
  if (code === "download-in-progress" && !runningHere) return "offline.failure.downloadInProgressElsewhere";
  return failureMessageKey(code);
}

export const OfflineDownloadResultBody: FC<ResultBodyProps> = ({ result, snapshot, runningSetlistName }) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;

  if (result.state === "done" && result.meta) {
    return (
      <Details data-testid="offline-result-done">
        <Note $tone="success">
          <i className="bi bi-cloud-check" />
          <span>{t("offline.badge.available", { date: formatSavedDate(result.meta.savedAt, locale) })}</span>
        </Note>
      </Details>
    );
  }

  if (result.state === "done-with-errors") {
    const groups = groupMissingBySong(result.missingFiles, snapshot);
    return (
      <Details data-testid="offline-result-partial">
        <Intro>{t("offline.result.partialIntro")}</Intro>
        <Groups>
          {groups.map((group) => (
            <li key={group.songId}>
              <SongTitle>{group.songTitle ?? t("offline.result.unknownSong")}</SongTitle>
              <Files>
                {group.files.map((file) => (
                  <li key={file.sheetMusicId}>
                    <i className="bi bi-file-earmark-pdf" /> {file.name ?? t("offline.result.unknownPdf")}
                    <Reason>
                      {" — "}
                      {t(reasonKey(file.reason))}
                      {file.bytes ? ` (${formatBytes(file.bytes, locale)})` : ""}
                    </Reason>
                  </li>
                ))}
              </Files>
            </li>
          ))}
        </Groups>
      </Details>
    );
  }

  const runningHere = runningSetlistName !== null;
  return (
    <Details data-testid={`offline-result-failed-${result.failureCode ?? "unknown"}`}>
      <Note $tone="error" role="alert">
        <i className="bi bi-x-circle" />
        <span>{t(failureKey(result.failureCode, runningHere), { setlist: runningSetlistName ?? "" })}</span>
      </Note>
    </Details>
  );
};

// Styled Components
const Details = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[3]};
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
`;

const Facts = styled.ul`
  margin: 0;
  padding-left: ${theme.space[5]};
  display: flex;
  flex-direction: column;
  gap: ${theme.space[1]};
  color: var(--color-text-primary);
`;

const toneColor = {
  warning: theme.colors.semantic.warning,
  info: theme.colors.semantic.info,
  error: theme.colors.semantic.error,
  success: theme.colors.semantic.success,
} as const;

const Note = styled.div<{ $tone: keyof typeof toneColor }>`
  display: flex;
  gap: ${theme.space[2]};
  align-items: flex-start;
  padding: ${theme.space[2]} ${theme.space[3]};
  border-radius: ${theme.radius.base};
  border: 1px solid ${(p) => toneColor[p.$tone]}55;
  background: ${(p) => toneColor[p.$tone]}14;
  color: var(--color-text-primary);
  line-height: ${theme.lineHeights.relaxed};

  i {
    color: ${(p) => toneColor[p.$tone]};
    margin-top: 2px;
  }
`;

const Bar = styled.div`
  height: 8px;
  border-radius: ${theme.radius.full};
  background: var(--color-bg-elevated);
  overflow: hidden;
`;

const BarFill = styled.div`
  height: 100%;
  background: ${theme.colors.brand.primary};
  transition: width ${theme.transitions.base} ease;
`;

const Current = styled.span`
  color: var(--color-text-secondary);
  word-break: break-word;
`;

const Intro = styled.p`
  margin: 0;
`;

const Groups = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${theme.space[2]};
  max-height: 40vh;
  overflow-y: auto;
`;

const SongTitle = styled.div`
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
`;

const Files = styled.ul`
  list-style: none;
  margin: 0;
  padding-left: ${theme.space[3]};
`;

const Reason = styled.span`
  color: var(--color-text-secondary);
`;
