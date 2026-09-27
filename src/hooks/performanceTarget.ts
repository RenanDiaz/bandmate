/**
 * What performance mode renders: a setlist, or one song from the library
 * (docs/specs/song-performance.md §3.1).
 */
export type PerformanceTarget = { kind: "setlist"; setlistId: string } | { kind: "song"; songId: string };

const SONG_KEY_PREFIX = "song:";

/** Stable id for memory keys and for the synthetic setlist: setlistId, or "song:<songId>". */
export function performanceTargetKey(t: PerformanceTarget): string {
  return t.kind === "song" ? `${SONG_KEY_PREFIX}${t.songId}` : t.setlistId;
}

export function isSongTarget(t: PerformanceTarget): t is Extract<PerformanceTarget, { kind: "song" }> {
  return t.kind === "song";
}
