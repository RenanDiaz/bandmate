import type { FC } from "react";
import { useParams } from "react-router-dom";
import { PerformanceView } from "./SetlistPerformanceView";

/** Route wrapper: `/songs/:songId/perform` (docs/specs/song-performance.md §3.4). */
const SongPerformanceView: FC = () => {
  const { songId } = useParams<{ songId: string }>();
  return <PerformanceView target={songId ? { kind: "song", songId } : undefined} />;
};

export default SongPerformanceView;
