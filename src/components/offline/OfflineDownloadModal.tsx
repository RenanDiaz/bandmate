import type { FC } from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import { theme } from "../../theme";
import { getOfflineDownloadController } from "../../context/offlineDownloadController";
import { useOfflineDownloadState } from "../../hooks/useOfflineDownload";
import type { OfflineSnapshot } from "../../services/offlineSetlistService";
import { getSnapshot } from "../../services/offlineSetlistService";
import { OfflineDownloadProgressBody, OfflineDownloadResultBody } from "./OfflineDownloadBodies";

interface Props {
  /** The setlist whose download (running or finished) this shows. */
  setlistId: string;
  onClose: () => void;
  /** Re-plan and confirm again (partial result, or a failure worth retrying). */
  onRetry: () => void;
  /** Switch to another setlist's running download (download-in-progress). */
  onViewRunning: (setlistId: string) => void;
  canRetry: boolean;
}

/** Failures a new plan can fix; the others need something else first (sign in, another tab, storage). */
const RETRYABLE = new Set(["offline", "plan-stale", "quota-rows", "unknown"]);

/**
 * Progress and result of an offline download (PR 2.3, §4.1). Everything it
 * shows comes from the download controller, so closing it (or leaving the
 * page) never stops the download, and reopening it re-attaches (A4).
 */
export const OfflineDownloadModal: FC<Props> = ({ setlistId, onClose, onRetry, onViewRunning, canRetry }) => {
  const { t } = useTranslation();
  const { active, results } = useOfflineDownloadState();
  const controller = getOfflineDownloadController();
  const running = active?.setlistId === setlistId ? active : null;
  const result = running ? null : results[setlistId] ?? null;
  const [snapshot, setSnapshot] = useState<Pick<OfflineSnapshot, "songsById" | "sheetMusicBySongId"> | null>(null);

  // Labels for missing PDFs come from the committed (partial) snapshot.
  useEffect(() => {
    if (result?.state !== "done-with-errors") return;
    let cancelled = false;
    void getSnapshot(setlistId).then((s) => {
      if (!cancelled) setSnapshot(s);
    });
    return () => {
      cancelled = true;
    };
  }, [result?.state, setlistId]);

  // A cancelled download just closes.
  useEffect(() => {
    if (result?.state === "cancelled") {
      controller.clearResult(setlistId);
      onClose();
    }
  }, [result?.state, setlistId, controller, onClose]);

  if (!running && (!result || result.state === "cancelled")) return null;

  const close = () => {
    if (result) controller.clearResult(setlistId);
    onClose();
  };

  let title: string;
  if (running) title = t("offline.progress.title");
  else if (result?.state === "done") title = t("offline.result.doneTitle");
  else if (result?.state === "done-with-errors") title = t("offline.result.partialTitle");
  else title = t("offline.result.failedTitle");

  const otherRunning =
    result?.failureCode === "download-in-progress" && active && active.setlistId !== setlistId ? active : null;
  const showRetry =
    !!result &&
    (result.state === "done-with-errors" || (result.state === "failed" && RETRYABLE.has(result.failureCode ?? "")));

  return createPortal(
    <>
      <Overlay onClick={running ? onClose : close} />
      <Container role="dialog" aria-modal="true" aria-labelledby="offline-download-title">
        <Header>
          <Title id="offline-download-title">
            <i className={`bi ${running ? "bi-cloud-arrow-down" : result?.state === "done" ? "bi-cloud-check" : "bi-cloud-slash"}`} />
            {title}
          </Title>
          {(running?.setlistName || result?.meta?.setlistName) && (
            <Subtitle>{running?.setlistName || result?.meta?.setlistName}</Subtitle>
          )}
        </Header>
        <Body>
          {running ? (
            <OfflineDownloadProgressBody progress={running.progress} />
          ) : result ? (
            <OfflineDownloadResultBody
              result={result}
              snapshot={snapshot}
              runningSetlistName={otherRunning ? otherRunning.setlistName : null}
            />
          ) : null}
          <Actions>
            {running ? (
              <>
                <SecondaryButton type="button" onClick={onClose}>
                  {t("offline.progress.hide")}
                </SecondaryButton>
                <DangerButton type="button" onClick={() => controller.cancel(setlistId)}>
                  {t("offline.progress.cancel")}
                </DangerButton>
              </>
            ) : (
              <>
                <SecondaryButton type="button" onClick={close}>
                  {t("offline.result.close")}
                </SecondaryButton>
                {otherRunning && (
                  <PrimaryButton
                    type="button"
                    onClick={() => {
                      controller.clearResult(setlistId);
                      onViewRunning(otherRunning.setlistId);
                    }}
                  >
                    {t("offline.result.viewRunning")}
                  </PrimaryButton>
                )}
                {showRetry && (
                  <PrimaryButton
                    type="button"
                    disabled={!canRetry}
                    title={canRetry ? undefined : t("offline.action.needsConnection")}
                    onClick={() => {
                      controller.clearResult(setlistId);
                      onRetry();
                    }}
                  >
                    {t("offline.result.retry")}
                  </PrimaryButton>
                )}
              </>
            )}
          </Actions>
        </Body>
      </Container>
    </>,
    document.body
  );
};

// Styled Components (same look as ConfirmModal)
const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: ${theme.zIndex.modal};
`;

const Container = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.lg};
  width: 90%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
  z-index: ${theme.zIndex.modal + 10};
  box-shadow: var(--shadow-xl);
`;

const Header = styled.div`
  padding: ${theme.space[5]} ${theme.space[5]} 0;
`;

const Title = styled.h2`
  font-size: ${theme.fontSizes.h3};
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

const Subtitle = styled.div`
  margin-top: ${theme.space[1]};
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
`;

const Body = styled.div`
  padding: ${theme.space[5]};
  display: flex;
  flex-direction: column;
  gap: ${theme.space[5]};
`;

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${theme.space[3]};
  justify-content: flex-end;
`;

const BaseButton = styled.button`
  padding: ${theme.space[3]} ${theme.space[5]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const SecondaryButton = styled(BaseButton)`
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);

  &:hover:not(:disabled) {
    background: var(--color-bg-elevated);
  }
`;

const PrimaryButton = styled(BaseButton)`
  background: ${theme.colors.brand.primary};
  border: none;
  color: white;

  &:hover:not(:disabled) {
    filter: brightness(1.05);
  }
`;

const DangerButton = styled(BaseButton)`
  background: transparent;
  border: 1px solid ${theme.colors.semantic.error};
  color: ${theme.colors.semantic.error};

  &:hover:not(:disabled) {
    background: ${theme.colors.semantic.error}1a;
  }
`;
