import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useBandContext } from "../../context/useBandContext";
import { getOfflineDownloadController } from "../../context/offlineDownloadController";
import { useOfflineDownloadState } from "../../hooks/useOfflineDownload";
import type { DownloadPlan } from "../../services/offlineSetlistService";
import { planDownload } from "../../services/offlineSetlistService";
import { summarizePlan } from "../../lib/offlineDownloadUi";
import { isIOS, isStandalone } from "../../lib/platform";
import { ConfirmModal } from "../ConfirmModal";
import { OfflineDownloadConfirmBody } from "./OfflineDownloadBodies";
import { OfflineDownloadModal } from "./OfflineDownloadModal";

export type OfflineDownloadVariant = "setlist" | "show" | "toolbar";

/**
 * Plan, confirm and the progress/result modal for one setlist: used by the
 * action button and by the schema-wipe notice's Download buttons (PR 2.5).
 * Render `elements` next to whatever calls `begin()`. `begin({ update: true })`
 * (PR 3.2, an outdated copy) is the same plan and download — the plan only
 * fetches files the device lacks — with "Update offline copy" wording.
 */
export function useOfflineDownloadFlow(setlistId: string, setlistName: string, variant: OfflineDownloadVariant) {
  const { t } = useTranslation();
  const controller = getOfflineDownloadController();
  const { isOnline, authMode } = useBandContext();
  const { active, results } = useOfflineDownloadState();
  const canDownload = isOnline && authMode === "session";
  const [planning, setPlanning] = useState(false);
  const [plan, setPlan] = useState<DownloadPlan | null>(null);
  const [updating, setUpdating] = useState(false);
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

  const begin = useCallback(async (opts: { update?: boolean } = {}) => {
    setUpdating(!!opts.update);
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
        title={t(updating ? "offline.update.title" : variant === "show" ? "offline.confirm.titleShow" : "offline.confirm.title")}
        message={t(updating ? "offline.update.message" : "offline.confirm.message", { setlist: setlistName })}
        confirmLabel={t(updating ? "offline.update.confirm" : "offline.confirm.confirm")}
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
