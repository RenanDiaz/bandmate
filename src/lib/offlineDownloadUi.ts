import type {
  DownloadPlan,
  OfflineMissingFile,
  OfflineSnapshot,
} from "../services/offlineSetlistService";
import type { DownloadFailureCode } from "../context/offlineDownloadController";

/**
 * Pure helpers behind the "Make available offline" UI (PR 2.3). No React, no
 * service calls: the components pass what they read.
 */

/** Decimal units, like the iOS/Android storage settings the user compares against. */
export function formatBytes(bytes: number, locale?: string): string {
  const units = ["B", "KB", "MB", "GB"];
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit++;
  }
  const digits = unit === 0 || value >= 10 ? 0 : 1;
  const formatted = new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value);
  return `${formatted} ${units[unit]}`;
}

export interface PlanSummary {
  songCount: number;
  filesToDownload: number;
  bytesToDownload: number;
  filesWithUnknownSize: number;
  filesAlreadyPresent: number;
  bytesAlreadyPresent: number;
  /** Free space by the (approximate) estimate, or null when the browser gives none. */
  freeBytes: number | null;
  /** §4.5: headroom below 110 % of the bytes to download. Advisory: the download is still allowed. */
  quotaWarning: boolean;
}

export const QUOTA_HEADROOM_FACTOR = 1.1;

export function quotaWarning(plan: Pick<DownloadPlan, "estimate" | "bytesToDownload">): boolean {
  if (!plan.estimate) return false;
  const free = plan.estimate.quota - plan.estimate.usage;
  return free < plan.bytesToDownload * QUOTA_HEADROOM_FACTOR;
}

export function summarizePlan(plan: DownloadPlan): PlanSummary {
  return {
    songCount: plan.songCount,
    filesToDownload: plan.filesToDownload.length,
    bytesToDownload: plan.bytesToDownload,
    filesWithUnknownSize: plan.filesWithUnknownSize,
    filesAlreadyPresent: plan.filesAlreadyPresent.length,
    bytesAlreadyPresent: plan.bytesAlreadyPresent,
    freeBytes: plan.estimate ? Math.max(0, plan.estimate.quota - plan.estimate.usage) : null,
    quotaWarning: quotaWarning(plan),
  };
}

export interface MissingSongGroup {
  songId: string;
  /** null when the song is not in the snapshot (the UI shows a generic label). */
  songTitle: string | null;
  files: Array<{ sheetMusicId: string; name: string | null; reason: OfflineMissingFile["reason"]; bytes: number | null }>;
}

type SnapshotLabels = Pick<OfflineSnapshot, "songsById" | "sheetMusicBySongId">;

/** Missing PDFs grouped by song, in the order they were reported (the setlist order). */
export function groupMissingBySong(missing: OfflineMissingFile[], snapshot: SnapshotLabels | null): MissingSongGroup[] {
  const groups = new Map<string, MissingSongGroup>();
  for (const file of missing) {
    let group = groups.get(file.songId);
    if (!group) {
      group = { songId: file.songId, songTitle: snapshot?.songsById[file.songId]?.title ?? null, files: [] };
      groups.set(file.songId, group);
    }
    const name =
      snapshot?.sheetMusicBySongId[file.songId]?.find((sm) => sm.id === file.sheetMusicId)?.name ?? null;
    group.files.push({ sheetMusicId: file.sheetMusicId, name, reason: file.reason, bytes: file.bytes });
  }
  return [...groups.values()];
}

export const FAILURE_CODES: DownloadFailureCode[] = [
  "not-authenticated",
  "offline",
  "setlist-not-found",
  "download-in-progress",
  "plan-stale",
  "storage-unavailable",
  "quota-rows",
  "cancelled",
  "unknown",
];

/** i18n key for a failed download or plan (§5.4). */
export function failureMessageKey(code: DownloadFailureCode | null): string {
  return `offline.failure.${code && FAILURE_CODES.includes(code) ? code : "unknown"}`;
}

/** i18n key for a missing file's reason. */
export function reasonKey(reason: OfflineMissingFile["reason"]): string {
  return `offline.reason.${reason}`;
}

/** "Sep 25, 2026" in the UI language. */
export function formatSavedDate(iso: string, locale?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" });
}
