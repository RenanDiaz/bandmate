import type { FC, ReactElement } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Spinner } from "reactstrap";
import styled from "styled-components";
import { theme } from "../../theme";
import { useBandContext } from "../../context/useBandContext";
import { useToast } from "../../context/useToast";
import { getOfflineDownloadController } from "../../context/offlineDownloadController";
import { useInterruptedDownload, useOfflineDownloadState, useOfflineSnapshotMeta } from "../../hooks/useOfflineDownload";
import type { DownloadPlan, OfflineSnapshotMeta } from "../../services/offlineSetlistService";
import { planDownload, removeSnapshot } from "../../services/offlineSetlistService";
import { formatSavedDate, summarizePlan } from "../../lib/offlineDownloadUi";
import { isIOS, isStandalone } from "../../lib/platform";
import { ConfirmModal } from "../ConfirmModal";
import { OfflineDownloadConfirmBody } from "./OfflineDownloadBodies";
import { OfflineDownloadModal } from "./OfflineDownloadModal";

/**
 * "Make available offline" (PR 2.3, §4.1): plan → confirmation → progress →
 * result. Available to every band role, guests included (A7). Downloads need
 * a connection and a valid session; without them the action is disabled with
 * "Needs a connection" (A8).
 */

type Variant = "setlist" | "show" | "toolbar";

/** Plan, confirm and the progress/result modal for one setlist; used by the action button. */
function useOfflineDownloadFlow(setlistId: string, setlistName: string, variant: Variant) {
  const { t } = useTranslation();
  const controller = getOfflineDownloadController();
  const { isOnline, authMode } = useBandContext();
  const { active, results } = useOfflineDownloadState();
  const canDownload = isOnline && authMode === "session";
  const [planning, setPlanning] = useState(false);
  const [plan, setPlan] = useState<DownloadPlan | null>(null);
  const [modalFor, setModalFor] = useState<string | null>(null);
  const platform = useMemo(() => ({ ios: isIOS(), standalone: isStandalone() }), []);
  // The page variants show their setlist's progress and results themselves
  // (the modal opens on its own, A4); the toolbar leaves results to the
  // app-wide toast notifier unless its modal is open.
  const ownsResults = variant !== "toolbar";
  const runningHere = active?.setlistId === setlistId;
  const result = results[setlistId];

  // While the modal is meant to show a setlist, claim it before anything can
  // finish, so the notifier never races the modal for the result.
  const viewerRef = useRef<(() => void) | null>(null);
  const showModal = useCallback(
    (id: string | null) => {
      viewerRef.current?.();
      viewerRef.current = id ? controller.attachViewer(id) : null;
      setModalFor(id);
    },
    [controller]
  );
  useEffect(() => () => viewerRef.current?.(), []);
  useEffect(() => (ownsResults ? controller.attachViewer(setlistId) : undefined), [controller, ownsResults, setlistId]);

  // Back on the page mid-download, or a result arrived while hidden: show it (A4).
  useEffect(() => {
    if (!ownsResults) return;
    if (runningHere || (result && result.state !== "cancelled")) setModalFor((current) => current ?? setlistId);
  }, [ownsResults, runningHere, result, setlistId]);

  const begin = useCallback(async () => {
    // Invisible until there is progress or a result; claims a plan failure.
    showModal(setlistId);
    setPlanning(true);
    try {
      setPlan(await planDownload(setlistId));
    } catch (error) {
      controller.reportPlanFailure(setlistId, error);
    } finally {
      setPlanning(false);
    }
  }, [controller, setlistId, showModal]);

  const confirm = () => {
    if (!plan) return;
    const confirmed = plan;
    setPlan(null);
    void controller.start(confirmed, setlistName);
  };

  const elements = (
    <>
      <ConfirmModal
        isOpen={plan !== null}
        tone="primary"
        title={t(variant === "show" ? "offline.confirm.titleShow" : "offline.confirm.title")}
        message={t("offline.confirm.message", { setlist: setlistName })}
        confirmLabel={t("offline.confirm.confirm")}
        onConfirm={confirm}
        // Cancel stores nothing: the plan is only dropped (A1).
        onClose={() => {
          setPlan(null);
          showModal(null);
        }}
      >
        {plan && <OfflineDownloadConfirmBody summary={summarizePlan(plan)} platform={platform} />}
      </ConfirmModal>
      {modalFor && (
        <OfflineDownloadModal
          setlistId={modalFor}
          canRetry={canDownload}
          onClose={() => showModal(null)}
          onRetry={() => void begin()}
          onViewRunning={(id) => showModal(id)}
        />
      )}
    </>
  );

  return { begin, planning, canDownload, openModal: () => showModal(setlistId), elements };
}

interface ActionProps {
  setlistId: string;
  setlistName: string;
  /**
   * "setlist": button in the setlist detail header (status and Remove are in OfflineStatusRow).
   * "show": the show's linked setlist ("Get this show ready offline"), with its badge;
   *   the action stays when it is saved (A3: re-plans, downloads nothing present).
   * "toolbar": compact, for performance mode's top bar. No Remove there: a mis-tap on
   * stage must not delete the copy performance mode renders from.
   */
  variant: Variant;
}

export const OfflineDownloadAction: FC<ActionProps> = ({ setlistId, setlistName, variant }) => {
  const { t } = useTranslation();
  const meta = useOfflineSnapshotMeta(setlistId);
  const { active } = useOfflineDownloadState();
  const flow = useOfflineDownloadFlow(setlistId, setlistName, variant);
  const running = active?.setlistId === setlistId ? active : null;
  const compact = variant === "toolbar";

  let button: ReactElement | null = null;
  if (running) {
    const p = running.progress;
    const label = p
      ? t("offline.action.downloading", { done: p.filesDone, total: p.filesTotal })
      : t("offline.action.preparing");
    button = (
      <ActionButton type="button" onClick={flow.openModal} title={label} $compact={compact}>
        <Spinner size="sm" />
        <span>{label}</span>
      </ActionButton>
    );
  } else if (meta === undefined) {
    button = null; // still reading the store
  } else if (!meta || meta.completeness === "partial" || variant === "show") {
    // The show keeps its action when the setlist is saved: it re-plans the
    // same snapshot and downloads nothing already present (A3).
    const retry = meta?.completeness === "partial";
    const label = !flow.canDownload
      ? t("offline.action.needsConnection")
      : retry
        ? t("offline.action.retry")
        : variant === "show"
          ? t("offline.action.showReady")
          : t("offline.action.makeAvailable");
    button = (
      <ActionButton
        type="button"
        onClick={() => void flow.begin()}
        disabled={!flow.canDownload || flow.planning}
        title={label}
        $compact={compact}
      >
        {flow.planning ? (
          <Spinner size="sm" />
        ) : (
          <i className={`bi ${!flow.canDownload ? "bi-wifi-off" : retry ? "bi-arrow-repeat" : "bi-cloud-arrow-down"}`} />
        )}
        <span>{flow.planning ? t("offline.action.preparing") : label}</span>
      </ActionButton>
    );
  }

  const showBadge = variant !== "setlist" && !running && meta;
  return (
    <>
      {showBadge && <OfflineBadge meta={meta} compact={compact} />}
      {button}
      {flow.elements}
    </>
  );
};

export const OfflineBadge: FC<{ meta: OfflineSnapshotMeta; compact?: boolean }> = ({ meta, compact }) => {
  const { t, i18n } = useTranslation();
  const date = formatSavedDate(meta.savedAt, i18n.language);
  const partial = meta.completeness === "partial";
  const full = t(partial ? "offline.badge.partial" : "offline.badge.available", { date });
  return (
    <Badge $partial={partial} title={full} data-testid="offline-badge">
      <i className={`bi ${partial ? "bi-cloud-slash" : "bi-cloud-check"}`} />
      <span>{compact ? t(partial ? "offline.badge.partialShort" : "offline.badge.availableShort") : full}</span>
    </Badge>
  );
};

/**
 * Setlist detail, under the title: saved badge + Remove, and the
 * interrupted-download notice with Resume / Discard.
 */
export const OfflineStatusRow: FC<{ setlistId: string; setlistName: string }> = ({ setlistId, setlistName }) => {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const { isOnline } = useBandContext();
  const meta = useOfflineSnapshotMeta(setlistId);
  const interrupted = useInterruptedDownload(setlistId);
  const { active } = useOfflineDownloadState();
  const controller = getOfflineDownloadController();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [resuming, setResuming] = useState(false);

  const remove = async () => {
    setRemoving(true);
    try {
      await removeSnapshot(setlistId);
      toast.success(t("offline.remove.success"));
    } catch (error) {
      console.error("Could not remove the offline copy:", error);
      toast.error(t("offline.remove.error"));
    } finally {
      setRemoving(false);
      setConfirmRemove(false);
    }
  };

  // The page's action shows the result (or the notifier toasts it).
  const resume = async () => {
    setResuming(true);
    try {
      await controller.resume();
    } finally {
      setResuming(false);
    }
  };

  const showMeta = meta && active?.setlistId !== setlistId;
  if (!showMeta && !interrupted) return null;

  return (
    <Row>
      {showMeta && (
        <>
          <OfflineBadge meta={meta} />
          <LinkButton type="button" onClick={() => setConfirmRemove(true)}>
            <i className="bi bi-trash" /> {t("offline.remove.button")}
          </LinkButton>
        </>
      )}
      {interrupted && (
        <Notice role="status">
          <i className="bi bi-pause-circle" />
          <span>
            <strong>{t("offline.interrupted.title")}</strong>{" "}
            {t("offline.interrupted.message", { date: formatSavedDate(interrupted.startedAt, i18n.language) })}
          </span>
          <NoticeActions>
            <LinkButton
              type="button"
              onClick={() => void resume()}
              disabled={!isOnline || resuming || !!active}
              title={isOnline ? undefined : t("offline.interrupted.needsConnection")}
            >
              {resuming ? <Spinner size="sm" /> : <i className="bi bi-play-fill" />}{" "}
              {isOnline ? t("offline.interrupted.resume") : t("offline.interrupted.needsConnection")}
            </LinkButton>
            <LinkButton type="button" onClick={() => controller.discard(setlistId)} disabled={resuming}>
              {t("offline.interrupted.discard")}
            </LinkButton>
          </NoticeActions>
        </Notice>
      )}
      <ConfirmModal
        isOpen={confirmRemove}
        tone="danger"
        title={t("offline.remove.title")}
        message={t("offline.remove.message", { setlist: setlistName })}
        confirmLabel={t("offline.remove.confirm")}
        busy={removing}
        onConfirm={() => void remove()}
        onClose={() => setConfirmRemove(false)}
      />
    </Row>
  );
};

// Styled Components
const ActionButton = styled.button<{ $compact?: boolean }>`
  background: transparent;
  border: 1px solid ${theme.colors.brand.primary};
  color: var(--color-text-primary);
  padding: ${theme.space[2]} ${theme.space[3]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${theme.space[2]};
  white-space: nowrap;
  transition: all ${theme.transitions.fast} ease;

  i {
    font-size: ${theme.fontSizes.body};
    color: ${theme.colors.brand.primary};
  }

  ${(p) =>
    p.$compact &&
    `
    padding: ${theme.space[1]} ${theme.space[2]};
    span { display: none; }
  `}

  &:hover:not(:disabled) {
    background: ${theme.colors.brand.primary}1f;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    border-color: var(--color-border);

    i {
      color: var(--color-text-secondary);
    }
  }
`;

const Badge = styled.span<{ $partial: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[1]};
  padding: 2px ${theme.space[2]};
  border-radius: ${theme.radius.full};
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.semibold};
  white-space: nowrap;
  color: ${(p) => (p.$partial ? theme.colors.semantic.warning : theme.colors.semantic.success)};
  background: ${(p) => (p.$partial ? theme.colors.semantic.warning : theme.colors.semantic.success)}1f;
  border: 1px solid ${(p) => (p.$partial ? theme.colors.semantic.warning : theme.colors.semantic.success)}55;
`;

const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${theme.space[2]} ${theme.space[3]};
  margin: ${theme.space[2]} 0;
`;

const LinkButton = styled.button`
  background: none;
  border: none;
  padding: 0;
  color: var(--color-text-secondary);
  font-size: ${theme.fontSizes.bodySm};
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[1]};

  &:hover:not(:disabled) {
    color: var(--color-text-primary);
    text-decoration: underline;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const Notice = styled.div`
  flex-basis: 100%;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${theme.space[2]};
  padding: ${theme.space[2]} ${theme.space[3]};
  border-radius: ${theme.radius.base};
  border: 1px solid ${theme.colors.semantic.warning}55;
  background: ${theme.colors.semantic.warning}14;
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-primary);

  > i {
    color: ${theme.colors.semantic.warning};
  }
`;

const NoticeActions = styled.div`
  display: flex;
  gap: ${theme.space[3]};
  margin-left: auto;
`;
