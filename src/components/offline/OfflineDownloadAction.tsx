import type { FC, ReactElement } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Spinner } from "reactstrap";
import styled from "styled-components";
import { theme } from "../../theme";
import { useBandContext } from "../../context/useBandContext";
import { useToast } from "../../context/useToast";
import { getOfflineDownloadController } from "../../context/offlineDownloadController";
import { useInterruptedDownload, useOfflineDownloadState, useOfflineSnapshotMeta } from "../../hooks/useOfflineDownload";
import type { OfflineSnapshotMeta } from "../../services/offlineSetlistService";
import { removeSnapshot } from "../../services/offlineSetlistService";
import { formatSavedDate, notDownloadedCount, offlineBadgeState } from "../../lib/offlineDownloadUi";
import type { OfflineBadgeState } from "../../lib/offlineDownloadUi";
import { ConfirmModal } from "../ConfirmModal";
import type { OfflineDownloadVariant } from "./useOfflineDownloadFlow";
import { useOfflineDownloadFlow } from "./useOfflineDownloadFlow";

/**
 * "Make available offline" (PR 2.3, §4.1): plan → confirmation → progress →
 * result. Available to every band role, guests included (A7). Downloads need
 * a connection and a valid session; without them the action is disabled with
 * "Needs a connection" (A8). PR 3.2: an outdated copy offers "Update offline
 * copy" (the same flow: the plan only fetches files the device lacks); a copy
 * deleted on the server offers nothing but Remove.
 */

type Variant = OfflineDownloadVariant;

interface ActionProps {
  setlistId: string;
  setlistName: string;
  /**
   * "setlist": link-style action inside OfflineStatusRow, under the setlist title, next to the
   *   badge and Remove (docs/specs/setlist-actions-layout.md §2.5). Not rendered on its own.
   * "show": the show's linked setlist ("Get this show ready offline"), with its badge;
   *   the action stays when it is saved (A3: re-plans, downloads nothing present).
   * "toolbar": compact, for performance mode's top bar. No Remove there: a mis-tap on
   * stage must not delete the copy performance mode renders from.
   */
  variant: Variant;
  /**
   * Toolbar: false when performance mode already renders from the snapshot, whose
   * source badge says the same thing. A partial badge still shows (it explains Retry).
   */
  showSavedBadge?: boolean;
}

export const OfflineDownloadAction: FC<ActionProps> = ({ setlistId, setlistName, variant, showSavedBadge = true }) => {
  const { t } = useTranslation();
  const meta = useOfflineSnapshotMeta(setlistId);
  const { active } = useOfflineDownloadState();
  const flow = useOfflineDownloadFlow(setlistId, setlistName, variant);
  const running = active?.setlistId === setlistId ? active : null;
  const compact = variant === "toolbar";
  const Button = variant === "setlist" ? RowActionButton : ActionButton;
  const state = meta ? offlineBadgeState(meta) : null;

  let button: ReactElement | null = null;
  if (running) {
    const p = running.progress;
    const label = p
      ? t("offline.action.downloading", { done: p.filesDone, total: p.filesTotal })
      : t("offline.action.preparing");
    button = (
      <Button type="button" onClick={flow.openModal} title={label} $compact={compact}>
        <Spinner size="sm" />
        <span>{label}</span>
      </Button>
    );
  } else if (meta === undefined || state === "deleted") {
    button = null; // still reading the store / nothing to download from a deleted setlist (D5)
  } else if (meta && state === "outdated") {
    const count = notDownloadedCount(meta);
    const label = flow.canDownload ? t("offline.update.button") : t("offline.action.needsConnection");
    const update = (
      <Button
        type="button"
        onClick={() => void flow.begin({ update: true })}
        disabled={!flow.canDownload || flow.planning}
        title={flow.canDownload ? t("offline.update.hint", { count }) : label}
        aria-label={label}
        $compact={compact}
      >
        {flow.planning ? <Spinner size="sm" /> : <i className={`bi ${flow.canDownload ? "bi-cloud-arrow-down" : "bi-wifi-off"}`} />}
        <span>{flow.planning ? t("offline.action.preparing") : label}</span>
      </Button>
    );
    // The detail says why (D2); the toolbar and the show keep it to the button.
    button =
      variant === "setlist" ? (
        <Notice role="status" $tone="info" data-testid="offline-update-notice">
          <i className="bi bi-cloud-arrow-down" aria-hidden="true" />
          <span>{t("offline.update.notice", { count })}</span>
          <NoticeActions>{update}</NoticeActions>
        </Notice>
      ) : (
        update
      );
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
      <Button
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
      </Button>
    );
  }

  // The toolbar on the snapshot hides the plain saved badge (the source badge says it),
  // never one that explains something: partial (Retry) or deleted.
  const showBadge =
    variant !== "setlist" && !running && meta && (showSavedBadge || state === "partial" || state === "deleted");
  return (
    <>
      {showBadge && <OfflineBadge meta={meta} compact={compact} />}
      {button}
      {flow.elements}
    </>
  );
};

const BADGE: Record<OfflineBadgeState, { icon: string; color: string; label: string; short: string; hint?: string }> = {
  available: {
    icon: "bi-cloud-check",
    color: theme.colors.semantic.success,
    label: "offline.badge.available",
    short: "offline.badge.availableShort",
  },
  partial: {
    icon: "bi-cloud-slash",
    color: theme.colors.semantic.warning,
    label: "offline.badge.partial",
    short: "offline.badge.partialShort",
  },
  outdated: {
    icon: "bi-cloud-arrow-down",
    color: theme.colors.semantic.info,
    label: "offline.badge.outdated",
    short: "offline.badge.outdatedShort",
    hint: "offline.badge.outdatedHint",
  },
  deleted: {
    icon: "bi-cloud-minus",
    color: theme.colors.semantic.error,
    label: "offline.badge.deleted",
    short: "offline.badge.deletedShort",
    hint: "offline.badge.deletedHint",
  },
};

/** §6.6: none (no copy), "Available offline · {date}", "Partial", "Outdated", "Deleted on server". */
export const OfflineBadge: FC<{ meta: OfflineSnapshotMeta; compact?: boolean }> = ({ meta, compact }) => {
  const { t, i18n } = useTranslation();
  const date = formatSavedDate(meta.savedAt, i18n.language);
  const state = offlineBadgeState(meta);
  const look = BADGE[state];
  const full = t(look.label, { date });
  return (
    <Badge $color={look.color} title={look.hint ? t(look.hint) : full} data-testid="offline-badge" data-state={state}>
      <i className={`bi ${look.icon}`} />
      <span>{compact ? t(look.short) : full}</span>
    </Badge>
  );
};

/** Remove offline copy + its confirmation (§6.6 F3). `onRemoved` runs after a successful removal. */
export const RemoveOfflineCopy: FC<{ setlistId: string; setlistName: string; onRemoved?: () => void }> = ({
  setlistId,
  setlistName,
  onRemoved,
}) => {
  const { t } = useTranslation();
  const toast = useToast();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);

  const remove = async () => {
    setRemoving(true);
    let removed = false;
    try {
      await removeSnapshot(setlistId);
      removed = true;
      toast.success(t("offline.remove.success"));
    } catch (error) {
      console.error("Could not remove the offline copy:", error);
      toast.error(t("offline.remove.error"));
    } finally {
      setRemoving(false);
      setConfirmRemove(false);
    }
    if (removed) onRemoved?.();
  };

  return (
    <>
      <LinkButton type="button" onClick={() => setConfirmRemove(true)}>
        <i className="bi bi-trash" /> {t("offline.remove.button")}
      </LinkButton>
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
    </>
  );
};

/**
 * Setlist detail, under the title: the one line that owns the setlist's
 * offline state. "Make available offline" / progress / Retry (the `setlist`
 * variant of OfflineDownloadAction), the saved badge + Remove, and the
 * interrupted-download notice with Resume / Discard.
 */
export const OfflineStatusRow: FC<{ setlistId: string; setlistName: string }> = ({ setlistId, setlistName }) => {
  const { t, i18n } = useTranslation();
  const { isOnline } = useBandContext();
  const meta = useOfflineSnapshotMeta(setlistId);
  const interrupted = useInterruptedDownload(setlistId);
  const { active } = useOfflineDownloadState();
  const controller = getOfflineDownloadController();
  const [resuming, setResuming] = useState(false);

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

  return (
    <Row data-testid="offline-status-row">
      {showMeta && <OfflineBadge meta={meta} />}
      <OfflineDownloadAction setlistId={setlistId} setlistName={setlistName} variant="setlist" />
      {showMeta && <RemoveOfflineCopy setlistId={setlistId} setlistName={setlistName} />}
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

const Badge = styled.span<{ $color: string }>`
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[1]};
  padding: 2px ${theme.space[2]};
  border-radius: ${theme.radius.full};
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.semibold};
  white-space: nowrap;
  color: ${(p) => p.$color};
  background: ${(p) => p.$color}1f;
  border: 1px solid ${(p) => p.$color}55;
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

/** The `setlist` variant: a link in the status row, icon in the brand colour. */
const RowActionButton = styled(LinkButton)<{ $compact?: boolean }>`
  min-height: 40px;
  font-weight: ${theme.fontWeights.medium};

  i {
    color: ${theme.colors.brand.primary};
  }

  &:disabled i {
    color: var(--color-text-secondary);
  }
`;

const Notice = styled.div<{ $tone?: "warning" | "info" }>`
  flex-basis: 100%;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${theme.space[2]};
  padding: ${theme.space[2]} ${theme.space[3]};
  border-radius: ${theme.radius.base};
  border: 1px solid ${(p) => noticeTone(p.$tone)}55;
  background: ${(p) => noticeTone(p.$tone)}14;
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-primary);

  > i {
    color: ${(p) => noticeTone(p.$tone)};
  }
`;

function noticeTone(tone: "warning" | "info" | undefined): string {
  return tone === "info" ? theme.colors.semantic.info : theme.colors.semantic.warning;
}

const NoticeActions = styled.div`
  display: flex;
  gap: ${theme.space[3]};
  margin-left: auto;
`;
