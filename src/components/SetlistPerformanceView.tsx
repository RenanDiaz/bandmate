import { Component, type FC, type ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Spinner } from "reactstrap";
import styled from "styled-components";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { theme } from "../theme";
import {
  isSongItem,
  isBreakItem,
  isSectionItem,
  getSetlistItemKey,
} from "../services/setlistsService";
import type { SetlistSpecialItem } from "../services/setlistsService";
import type { Song } from "../services/songsService";
import { SEO } from "./SEO";
import { useTranslation } from "react-i18next";
import { useToast } from "../context/useToast";
import { SyncControls } from "./SyncControls";
import { usePerformanceSync } from "../hooks/usePerformanceSync";
import { useLocalBackingTracks } from "../hooks/useLocalBackingTracks";
import { BackingTrackPlayer } from "./BackingTrackPlayer";
import type { BackingTrackPlayerHandle } from "./BackingTrackPlayer";
import { SyncedLyricsDisplay } from "./SyncedLyricsDisplay";
import SheetMusicViewer from "./SheetMusicViewer";
import type { SheetMusicViewerHandle } from "./SheetMusicViewer";
import SheetMusicUpload from "./SheetMusicUpload";
import {
  type SheetMusic,
  getInstrumentIcon,
} from "../services/songSheetMusicService";
import { resolveInitialSheetMusic } from "../services/sheetMusicPreferencesService";
import { useSetlistPerformanceData } from "../hooks/useSetlistPerformanceData";
import { OfflineDownloadAction } from "./offline/OfflineDownloadAction";
import { useBandContext } from "../context/useBandContext";
import {
  readPerformPosition,
  readPreferredContentView,
  writePerformPosition,
  writePreferredContentView,
} from "../lib/performPosition";
import { usePerformItems } from "../hooks/usePerformItems";
import { isSongTarget, performanceTargetKey, type PerformanceTarget } from "../hooks/performanceTarget";

// Error Boundary to prevent PDF viewer crashes from taking down the entire app
interface PDFErrorBoundaryProps {
  children: ReactNode;
  fallbackMessage: string;
  retryLabel: string;
}

interface PDFErrorBoundaryState {
  hasError: boolean;
}

class PDFErrorBoundary extends Component<PDFErrorBoundaryProps, PDFErrorBoundaryState> {
  state: PDFErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): PDFErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("SheetMusicViewer crashed:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "1rem", padding: "2rem", textAlign: "center", color: "var(--color-text-secondary)" }}>
          <i className="bi bi-exclamation-triangle" style={{ fontSize: "3rem", color: "var(--color-text-tertiary)" }} />
          <p style={{ margin: 0, fontSize: "1rem" }}>{this.props.fallbackMessage}</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)", padding: "0.5rem 1rem", borderRadius: "0.5rem", cursor: "pointer" }}
          >
            {this.props.retryLabel}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Sortable song list item for reorder mode
interface SortableSongListItemProps {
  song: Song;
  index: number;
  isActive: boolean;
  onClick: () => void;
}

const SortableSongListItem: FC<SortableSongListItemProps> = ({
  song,
  index,
  isActive,
  onClick,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: song.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <SongListItem
      ref={setNodeRef}
      style={style}
      $active={isActive}
      $isDragging={isDragging}
      onClick={onClick}
    >
      <SongListDragHandle {...attributes} {...listeners} onClick={(e) => e.stopPropagation()}>
        <i className="bi bi-grip-vertical"></i>
      </SongListDragHandle>
      <SongListPosition>{index + 1}</SongListPosition>
      <SongListInfo>
        <SongListTitle>{song.title}</SongListTitle>
        {song.artist && <SongListArtist>{song.artist}</SongListArtist>}
      </SongListInfo>
      {isActive && (
        <SongListIndicator>
          <i className="bi bi-play-fill"></i>
        </SongListIndicator>
      )}
    </SongListItem>
  );
};

// Sortable row for breaks / sections / notes in reorder mode, so they keep
// their place relative to the songs instead of being pushed to the end.
interface SortableSpecialListItemProps {
  item: SetlistSpecialItem;
  itemId: string;
}

const SortableSpecialListItem: FC<SortableSpecialListItemProps> = ({ item, itemId }) => {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: itemId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const icon = isBreakItem(item)
    ? "bi-pause-circle"
    : isSectionItem(item)
    ? "bi-bookmark"
    : "bi-sticky";

  return (
    <SpecialListItem
      ref={setNodeRef}
      style={style}
      type="button"
      $active={false}
      $isDragging={isDragging}
      $type={item.type}
    >
      <SongListDragHandle {...attributes} {...listeners} onClick={(e) => e.stopPropagation()}>
        <i className="bi bi-grip-vertical"></i>
      </SongListDragHandle>
      <SpecialListIcon $type={item.type}>
        <i className={icon}></i>
      </SpecialListIcon>
      <SongListInfo>
        <SongListTitle>{item.label}</SongListTitle>
        {isBreakItem(item) && item.duration && (
          <SongListArtist>{t("performance.durationMinutes", { count: item.duration })}</SongListArtist>
        )}
      </SongListInfo>
    </SpecialListItem>
  );
};

/** Route wrapper: `/setlists/:setlistId/perform`. */
const SetlistPerformanceView: FC = () => {
  const { setlistId } = useParams<{ setlistId: string }>();
  return <PerformanceView target={setlistId ? { kind: "setlist", setlistId } : undefined} />;
};

/**
 * Performance mode for a setlist or, with a song target, one song from the
 * library: the same view with the setlist-only chrome hidden
 * (docs/specs/song-performance.md §2).
 */
export const PerformanceView: FC<{ target: PerformanceTarget | undefined }> = ({ target }) => {
  const isSong = target ? isSongTarget(target) : false;
  // Memory keys (position, backing tracks): the setlist id, or "song:<songId>".
  const targetKey = target ? performanceTargetKey(target) : "";
  const setlistId = target?.kind === "setlist" ? target.setlistId : undefined;
  // Load errors bounce to the list; Exit and Escape go back to the page that
  // opened performance mode, else (opened directly: reload, PWA relaunch) to
  // the setlist's detail or /songs.
  const exitPath = isSong ? "/songs" : "/setlists";
  const exitFallbackPath = setlistId ? `/setlists/${setlistId}` : exitPath;
  const navigate = useNavigate();
  // The router's first entry has key "default"; read at mount, since dropping
  // `?song=` replaces the entry (new key) without adding one.
  const location = useLocation();
  const openedInAppRef = useRef(location.key !== "default");
  const exitPerformance = useCallback(() => {
    if (openedInAppRef.current) navigate(-1);
    else navigate(exitFallbackPath);
  }, [navigate, exitFallbackPath]);
  const { t } = useTranslation();
  const toast = useToast();

  const { user, isOnline } = useBandContext();
  const userId = user?.id ?? null;

  const perf = useSetlistPerformanceData(target);
  const setlist = perf.setlist;
  const { capabilities } = perf;
  const onSnapshot = perf.source === "snapshot";
  const preferredSheetMusicIds = perf.preferredSheetMusicIds;
  const [isReorderMode, setIsReorderMode] = useState(false);
  // Local copy of the items (drag-and-drop reorders it before it is saved) and
  // the current index; never reseeded while reordering (§8.1).
  const { setlistItems, setSetlistItems, currentIndex, setCurrentIndex } = usePerformItems(perf.items, isReorderMode);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSongList, setShowSongList] = useState(false);
  const [contentView, setContentView] = useState<"chords" | "lyrics" | "sheetMusic">(readPreferredContentView);
  const [sheetMusicList, setSheetMusicList] = useState<SheetMusic[]>([]);
  const [selectedSheetMusicId, setSelectedSheetMusicId] = useState<string | null>(null);
  // Refs mirror the preferences so the list loader can read them without
  // re-running (and remounting the PDF viewer) every time a preference changes.
  const preferredSheetMusicIdsRef = useRef<Record<string, string>>({});
  // Instrument of the last PDF this user picked in this band (device-local shortcut).
  const preferredInstrumentRef = useRef<string | null>(null);
  const unavailableSheetMusicIdsRef = useRef<ReadonlySet<string>>(new Set());
  const selectedSheetMusicIdRef = useRef<string | null>(null);
  const [sheetMusicUrl, setSheetMusicUrl] = useState<string | null>(null);
  const [sheetMusicLoading, setSheetMusicLoading] = useState(false);
  const [showAddPdfModal, setShowAddPdfModal] = useState(false);
  // pdf.js failed on a resolved PDF: a retryable view error, never a missing file.
  const [pdfViewerError, setPdfViewerError] = useState(false);
  const [pdfReloadKey, setPdfReloadKey] = useState(0);
  // A2: the saved position is applied once, when the data is ready; its PDF
  // only for the restored song.
  const positionRestoredRef = useRef(false);
  // `?song=<songId>` ("Start here" in the setlist detail) opens on that song
  // instead of the saved position; read once, then dropped from the URL so a
  // reload restores the saved position.
  const [searchParams, setSearchParams] = useSearchParams();
  const startSongIdRef = useRef<string | null>(isSong ? null : searchParams.get("song"));
  const pendingRestoredPdfRef = useRef<{ index: number; sheetMusicId: string } | null>(null);
  // The song the current PDF selection belongs to (a row refresh keeps it).
  const selectionSongIdRef = useRef<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [showFullPlayerInSheet, setShowFullPlayerInSheet] = useState(false);
  const fullPlayerHideTimerRef = useRef<number | null>(null);
  const [pdfCurrentPage, setPdfCurrentPage] = useState(1);
  const [pdfNumPages, setPdfNumPages] = useState<number | null>(null);
  const [invertPdfColors, setInvertPdfColors] = useState(() => {
    return localStorage.getItem("bandmate_invert_pdf") === "true";
  });
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem("bandmate_performance_font_size");
    return saved ? Number(saved) : 100;
  });
  const [showFontSizeDropdown, setShowFontSizeDropdown] = useState(false);
  const fontSizeDropdownRef = useRef<HTMLDivElement>(null);
  const fontSizeButtonRef = useRef<HTMLButtonElement>(null);
  const songListRef = useRef<HTMLDivElement>(null);
  const sheetMusicViewerRef = useRef<SheetMusicViewerHandle>(null);
  const backingTrackRef = useRef<BackingTrackPlayerHandle>(null);

  // Helper to get song by ID
  const getSongById = (songId: string): Song | undefined => {
    return perf.songsById[songId];
  };

  // Get info about the next item for "Up Next" display
  const getNextItemInfo = (): { type: "song" | "break" | "section" | "note" | "end"; label: string } | null => {
    if (currentIndex >= setlistItems.length - 1) {
      return { type: "end", label: t("setlists.items.endOfSetlist") };
    }

    const nextItem = setlistItems[currentIndex + 1];
    if (isSongItem(nextItem)) {
      const song = getSongById(nextItem.song_id);
      return { type: "song", label: song?.title || "Unknown Song" };
    } else if (isBreakItem(nextItem)) {
      return { type: "break", label: nextItem.label };
    } else if (isSectionItem(nextItem)) {
      return { type: "section", label: nextItem.label };
    } else {
      return { type: "note", label: nextItem.label };
    }
  };

  // Handle sync index updates from viewers
  const handleSyncIndexChange = useCallback((index: number) => {
    setCurrentIndex(index);
  }, [setCurrentIndex]);

  // Handle sync playback updates from host (for viewers)
  const handleSyncPlaybackChange = useCallback((timeMs: number, isPlaying: boolean) => {
    // Convert ms to seconds for the display
    setAudioCurrentTime(timeMs / 1000);
    setIsAudioPlaying(isPlaying);
  }, []);

  // Performance sync hook
  const {
    role: syncRole,
    isConnected: isSyncConnected,
    isLoading: isSyncLoading,
    error: syncError,
    playbackTimeMs: syncedPlaybackTimeMs,
    isAudioPlaying: syncedIsAudioPlaying,
    startHosting,
    joinExistingSession,
    leaveSession,
    syncSongIndex,
    syncPlaybackState,
    forceEndSession,
    takeOverSession,
    hasActiveSession,
    activeSessionSetlistId,
    hostDisplayName,
    sessionCreatedAt,
    canManageOrphanedSession,
  } = usePerformanceSync({
    setlistId: setlistId || "",
    bandId: setlist?.band_id || 0,
    onSongIndexChange: handleSyncIndexChange,
    onPlaybackChange: handleSyncPlaybackChange,
    enabled: capabilities.canSync,
  });

  // Local backing tracks hook
  const {
    loadTrack,
    removeTrack,
    getTrackUrl,
    getTrackInfo,
    hadTrackPreviously,
  } = useLocalBackingTracks(targetKey);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      // Reorder the full list (songs and special items alike) so breaks,
      // sections and notes keep their place relative to the songs.
      setSetlistItems((items) => {
        const oldIndex = items.findIndex((item) => getSetlistItemKey(item) === active.id);
        const newIndex = items.findIndex((item) => getSetlistItemKey(item) === over.id);

        if (oldIndex === -1 || newIndex === -1) return items;

        return arrayMove(items, oldIndex, newIndex).map((item, index) => ({
          ...item,
          position: index,
        }));
      });
    }
  };

  const handleSaveOrder = async () => {
    if (!setlist) return;

    setSaving(true);
    try {
      // Update positions for all items
      const updatedItems = setlistItems.map((item, index) => ({
        ...item,
        position: index,
      }));

      await perf.saveOrder(updatedItems);

      setSetlistItems(updatedItems);
      setIsReorderMode(false);
    } catch (error) {
      console.error("Failed to save order:", error);
      toast.error(t("setlists.detail.saveOrderError"));
    }
    setSaving(false);
  };

  const handleCancelReorder = () => {
    if (setlist) {
      // Reset to original order from setlist
      const orderedItems = [...(setlist.songs || [])].sort((a, b) => a.position - b.position);
      setSetlistItems(orderedItems);
      setCurrentIndex(0);
    }
    setIsReorderMode(false);
  };

  const canStartReorder = capabilities.canReorder && setlistItems.length >= 2 && syncRole !== "viewer";

  const toggleReorderMode = () => {
    if (isReorderMode) {
      handleCancelReorder();
    } else if (canStartReorder) {
      setShowSongList(true);
      setIsReorderMode(true);
    }
  };


  // A2: restore the saved position once the data is ready (clamped: the
  // setlist may have changed); a position older than 12 h is gone on read.
  useEffect(() => {
    if (perf.status !== "ready" || positionRestoredRef.current || !targetKey) return;
    positionRestoredRef.current = true;
    const startSongId = startSongIdRef.current;
    if (startSongId) {
      startSongIdRef.current = null;
      setSearchParams(
        (params) => {
          params.delete("song");
          return params;
        },
        { replace: true }
      );
      const startIndex = perf.items.findIndex((item) => isSongItem(item) && item.song_id === startSongId);
      // A song no longer in the setlist falls back to the saved position.
      if (startIndex >= 0) {
        setCurrentIndex(startIndex);
        return;
      }
    }
    if (!userId) return;
    const saved = readPerformPosition(userId, targetKey);
    if (!saved || perf.items.length === 0) return;
    const index = Math.min(saved.currentIndex, perf.items.length - 1);
    setCurrentIndex(index);
    setContentView(saved.contentView);
    pendingRestoredPdfRef.current = saved.selectedSheetMusicId ? { index, sheetMusicId: saved.selectedSheetMusicId } : null;
  }, [perf.status, perf.items, targetKey, userId, setCurrentIndex, setSearchParams]);

  // A2: save it on every change, for every source (after the restore ran).
  useEffect(() => {
    if (perf.status !== "ready" || !positionRestoredRef.current || !userId || !targetKey) return;
    writePerformPosition(userId, targetKey, { currentIndex, contentView, selectedSheetMusicId });
  }, [perf.status, userId, targetKey, currentIndex, contentView, selectedSheetMusicId]);

  // A failed load bounces back to the list, as before, except with no
  // offline copy and no connection: that renders "Not available offline"
  // below, with no toast and no bounce (B8). A song that is not found renders
  // "Song not found" + Back instead (song spec §2).
  const songNotFound = isSong && perf.status === "error" && perf.error === "not-found";
  useEffect(() => {
    if (perf.status !== "error" || perf.unavailableOffline || songNotFound) return;
    toast.error(t(isSong ? "songs.loadError" : "setlists.detail.loadError"));
    navigate(exitPath);
  }, [perf.status, perf.unavailableOffline, songNotFound, isSong, exitPath, navigate]);

  useEffect(() => {
    // Keyboard navigation
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        handleNextNav();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        handlePrevNav();
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (isFullscreen) {
          exitFullscreen();
        } else {
          exitPerformance();
        }
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreen();
      } else if ((e.key === "l" || e.key === "L") && !isSong) {
        // A song target has no list.
        e.preventDefault();
        setShowSongList((prev) => !prev);
      } else if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        toggleContentView();
      } else if (e.key === "d" || e.key === "D") {
        e.preventDefault();
        toggleInvertPdfColors();
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        increaseFontSize();
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        decreaseFontSize();
      } else if (e.key === "0") {
        e.preventDefault();
        resetFontSize();
      } else if ((e.key === "r" || e.key === "R") && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // A no-op when reordering isn't allowed (offline, guest, viewer, B5).
        if (!isReorderMode && !canStartReorder) return;
        e.preventDefault();
        toggleReorderMode();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, setlistItems.length, isFullscreen, exitPerformance, isSong, isReorderMode, canStartReorder]);

  // Close font size dropdown on click outside
  useEffect(() => {
    if (!showFontSizeDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        fontSizeDropdownRef.current &&
        !fontSizeDropdownRef.current.contains(e.target as Node) &&
        fontSizeButtonRef.current &&
        !fontSizeButtonRef.current.contains(e.target as Node)
      ) {
        setShowFontSizeDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showFontSizeDropdown]);

  // Scroll to top and reset audio time when song changes
  useEffect(() => {
    const songDisplay = document.querySelector('[data-song-display]');
    if (songDisplay) {
      songDisplay.scrollTop = 0;
    }
    // Reset audio tracking state
    setAudioCurrentTime(0);
    setIsAudioPlaying(false);
    // Reset PDF page tracking
    setPdfCurrentPage(1);
    setPdfNumPages(null);
    // Hide the temporary full-player overlay when switching songs
    setShowFullPlayerInSheet(false);
    if (fullPlayerHideTimerRef.current !== null) {
      window.clearTimeout(fullPlayerHideTimerRef.current);
      fullPlayerHideTimerRef.current = null;
    }
  }, [currentIndex]);

  // Cleanup the overlay timer on unmount
  useEffect(() => {
    return () => {
      if (fullPlayerHideTimerRef.current !== null) {
        window.clearTimeout(fullPlayerHideTimerRef.current);
        fullPlayerHideTimerRef.current = null;
      }
    };
  }, []);

  // Hide overlay when leaving sheet music view
  useEffect(() => {
    if (contentView !== "sheetMusic") {
      setShowFullPlayerInSheet(false);
      if (fullPlayerHideTimerRef.current !== null) {
        window.clearTimeout(fullPlayerHideTimerRef.current);
        fullPlayerHideTimerRef.current = null;
      }
    }
  }, [contentView]);

  // Show the full backing-track player as a temporary overlay in sheet view,
  // and (re)start the auto-hide timer.
  const FULL_PLAYER_HIDE_MS = 7000;
  const showFullPlayerTemporarily = useCallback(() => {
    setShowFullPlayerInSheet(true);
    backingTrackRef.current?.expand();
    if (fullPlayerHideTimerRef.current !== null) {
      window.clearTimeout(fullPlayerHideTimerRef.current);
    }
    fullPlayerHideTimerRef.current = window.setTimeout(() => {
      setShowFullPlayerInSheet(false);
      fullPlayerHideTimerRef.current = null;
    }, FULL_PLAYER_HIDE_MS);
  }, []);

  // Reset the auto-hide timer (e.g., when user interacts with the overlay).
  const extendFullPlayerTimer = useCallback(() => {
    if (!showFullPlayerInSheet) return;
    if (fullPlayerHideTimerRef.current !== null) {
      window.clearTimeout(fullPlayerHideTimerRef.current);
    }
    fullPlayerHideTimerRef.current = window.setTimeout(() => {
      setShowFullPlayerInSheet(false);
      fullPlayerHideTimerRef.current = null;
    }, FULL_PLAYER_HIDE_MS);
  }, [showFullPlayerInSheet]);

  // Auto-scroll to active song when song list opens
  useEffect(() => {
    if (showSongList && songListRef.current) {
      const activeItem = songListRef.current.querySelector('[data-active="true"]');
      if (activeItem) {
        activeItem.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
  }, [showSongList]);

  // Mirror the preferences into the refs. This effect must stay declared
  // before the lookup effect below: effects run in declaration order, so on
  // the render where the data arrives the refs are filled before the lookup
  // resolves the initial PDF.
  useEffect(() => {
    preferredSheetMusicIdsRef.current = perf.preferredSheetMusicIds;
    preferredInstrumentRef.current = perf.preferredInstrument;
    unavailableSheetMusicIdsRef.current = perf.unavailableSheetMusicIds;
  }, [perf.preferredSheetMusicIds, perf.preferredInstrument, perf.unavailableSheetMusicIds]);
  useEffect(() => {
    selectedSheetMusicIdRef.current = selectedSheetMusicId;
  }, [selectedSheetMusicId]);

  // Pick the current song's sheet music from the prefetched lists.
  const loadSheetMusicList = useCallback(() => {
    const currentItem = setlistItems[currentIndex];
    const isItemSong = currentItem && isSongItem(currentItem);
    const songForItem = isItemSong ? perf.songsById[currentItem.song_id] : null;

    if (!songForItem) {
      setSheetMusicList([]);
      setSelectedSheetMusicId(null);
      setSheetMusicUrl(null);
      return;
    }

    const list = perf.sheetMusicBySongId[songForItem.id] ?? [];
    setSheetMusicList(list);
    const sameSong = selectionSongIdRef.current === songForItem.id;
    selectionSongIdRef.current = songForItem.id;

    // A2: the restored PDF, only for the restored song, if it still exists.
    const restored = pendingRestoredPdfRef.current;
    if (restored && restored.index === currentIndex) {
      pendingRestoredPdfRef.current = null;
      if (list.some((sm) => sm.id === restored.sheetMusicId)) {
        setSelectedSheetMusicId(restored.sheetMusicId);
        return;
      }
    }

    // A row refresh on the same song keeps the selected PDF if it still exists (§8.2).
    const current = selectedSheetMusicIdRef.current;
    if (sameSong && current && list.some((sm) => sm.id === current)) return;

    // Open this user's preferred PDF, else the one matching their instrument,
    // else the band's first one; on the device first (snapshot source).
    const available = list.filter((sm) => !unavailableSheetMusicIdsRef.current.has(sm.id));
    const initial = resolveInitialSheetMusic(
      available.length > 0 ? available : list,
      preferredSheetMusicIdsRef.current[songForItem.id],
      preferredInstrumentRef.current
    );
    setSelectedSheetMusicId(initial?.id ?? null);
  }, [currentIndex, setlistItems, perf.songsById, perf.sheetMusicBySongId]);

  // Selecting a PDF also remembers it as this user's default for the song.
  const { selectSheetMusic, retryStaleSheetMusic } = perf;
  const handleSelectSheetMusic = useCallback(
    (sheetMusic: SheetMusic) => {
      if (perf.unavailableSheetMusicIds.has(sheetMusic.id)) return; // "Not downloaded"
      setSelectedSheetMusicId(sheetMusic.id);
      selectSheetMusic(sheetMusic);
    },
    [selectSheetMusic, perf.unavailableSheetMusicIds]
  );

  useEffect(() => {
    loadSheetMusicList();
  }, [loadSheetMusicList]);

  // If the sheet music prefetch failed, try again on song change and when
  // entering the sheet music view (no-op once it has loaded).
  useEffect(() => {
    retryStaleSheetMusic();
  }, [currentIndex, contentView, retryStaleSheetMusic]);

  // Load sheet music URL when selected sheet music changes
  const { resolvePdfUrl } = perf;
  useEffect(() => {
    // Set by the cleanup when the selection changes again, so a slow stale
    // resolution never replaces the current PDF.
    let cancelled = false;

    setPdfViewerError(false);
    const loadSheetMusicUrl = async () => {
      const selectedSheetMusic = sheetMusicList.find((sm) => sm.id === selectedSheetMusicId);

      // Not on the device: rendered as "Not downloaded", nothing to resolve.
      if (!selectedSheetMusic?.file_url || unavailableSheetMusicIdsRef.current.has(selectedSheetMusic.id)) {
        setSheetMusicUrl(null);
        // A cancelled resolution no longer clears the flag itself.
        setSheetMusicLoading(false);
        return;
      }

      setSheetMusicLoading(true);
      try {
        const url = await resolvePdfUrl(selectedSheetMusic);
        if (cancelled) return;
        setSheetMusicUrl(url);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load sheet music URL:", err);
        setSheetMusicUrl(null);
      } finally {
        if (!cancelled) setSheetMusicLoading(false);
      }
    };

    loadSheetMusicUrl();
    return () => {
      cancelled = true;
    };
    // pdfReloadKey: "Try again" after a viewer error re-resolves (fresh blob URL).
    // The unavailable set: a PDF found unreadable stops resolving.
  }, [selectedSheetMusicId, sheetMusicList, resolvePdfUrl, pdfReloadKey, perf.unavailableSheetMusicIds]);

  // Handle audio time update (host syncs to viewers)
  const handleAudioTimeUpdate = useCallback((timeInSeconds: number) => {
    setAudioCurrentTime(timeInSeconds);
    // Sync to viewers every 500ms to reduce network traffic
    if (syncRole === "host") {
      const timeMs = Math.round(timeInSeconds * 1000);
      syncPlaybackState(timeMs, isAudioPlaying);
    }
  }, [syncRole, isAudioPlaying, syncPlaybackState]);

  // Handle audio playing state change (host syncs to viewers)
  const handleAudioPlayingChange = useCallback((playing: boolean) => {
    setIsAudioPlaying(playing);
    if (syncRole === "host") {
      const timeMs = Math.round(audioCurrentTime * 1000);
      syncPlaybackState(timeMs, playing);
    }
  }, [syncRole, audioCurrentTime, syncPlaybackState]);

  // Use synced values for viewers
  const displayAudioTime = syncRole === "viewer" ? syncedPlaybackTimeMs / 1000 : audioCurrentTime;
  const displayIsPlaying = syncRole === "viewer" ? syncedIsAudioPlaying : isAudioPlaying;

  const handlePrevSong = () => {
    // Viewers can't control navigation
    if (syncRole === "viewer") return;

    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      // Sync to other devices if hosting
      if (syncRole === "host") {
        syncSongIndex(newIndex);
      }
    }
  };

  const handleNextSong = () => {
    // Viewers can't control navigation
    if (syncRole === "viewer") return;

    if (currentIndex < setlistItems.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      // Sync to other devices if hosting
      if (syncRole === "host") {
        syncSongIndex(newIndex);
      }
    }
  };

  // Navigation wrappers: in sheet music mode, navigate PDF pages first, then songs
  const handlePrevNav = () => {
    if (syncRole === "viewer") return;
    if (sheetMusicViewerRef.current) {
      const navigated = sheetMusicViewerRef.current.goToPrevPage();
      if (!navigated) handlePrevSong();
    } else {
      handlePrevSong();
    }
  };

  const handleNextNav = () => {
    if (syncRole === "viewer") return;
    if (sheetMusicViewerRef.current) {
      const navigated = sheetMusicViewerRef.current.goToNextPage();
      if (!navigated) handleNextSong();
    } else {
      handleNextSong();
    }
  };

  const handleGoToSong = (index: number) => {
    // Viewers can't control navigation
    if (syncRole === "viewer") return;

    setCurrentIndex(index);
    setShowSongList(false);
    // Sync to other devices if hosting
    if (syncRole === "host") {
      syncSongIndex(index);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      exitFullscreen();
    }
  };

  const exitFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    setIsFullscreen(false);
  };

  // A user's pick becomes the default for the next setlist or song (the
  // saved position still wins where there is one).
  const chooseContentView = useCallback((view: "chords" | "lyrics" | "sheetMusic") => {
    setContentView(view);
    writePreferredContentView(view);
  }, []);

  // Same order as the toolbar: Lyrics → Chords → Sheet music.
  const toggleContentView = useCallback(() => {
    setContentView((prev) => {
      const next = prev === "lyrics" ? "chords" : prev === "chords" ? "sheetMusic" : "lyrics";
      writePreferredContentView(next);
      return next;
    });
  }, []);

  const toggleInvertPdfColors = useCallback(() => {
    setInvertPdfColors((prev) => {
      const next = !prev;
      localStorage.setItem("bandmate_invert_pdf", String(next));
      return next;
    });
  }, []);

  const FONT_SIZE_MIN = 50;
  const FONT_SIZE_MAX = 200;
  const FONT_SIZE_STEP = 10;

  const increaseFontSize = useCallback(() => {
    setFontSize((prev) => {
      const next = Math.min(prev + FONT_SIZE_STEP, FONT_SIZE_MAX);
      localStorage.setItem("bandmate_performance_font_size", String(next));
      return next;
    });
  }, []);

  const decreaseFontSize = useCallback(() => {
    setFontSize((prev) => {
      const next = Math.max(prev - FONT_SIZE_STEP, FONT_SIZE_MIN);
      localStorage.setItem("bandmate_performance_font_size", String(next));
      return next;
    });
  }, []);

  const resetFontSize = useCallback(() => {
    setFontSize(100);
    localStorage.setItem("bandmate_performance_font_size", "100");
  }, []);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getSetlistSongNotes = (songId: string): string | undefined => {
    if (!setlist) return undefined;
    const setlistSong = setlist.songs
      .filter(isSongItem)
      .find((s) => s.song_id === songId);
    return setlistSong?.notes;
  };

  // No offline copy and no connection (§8.2 rule 3, B8).
  if (perf.status === "error" && perf.unavailableOffline) {
    return (
      <ErrorContainer>
        <ErrorIcon>
          <i className="bi bi-wifi-off"></i>
        </ErrorIcon>
        <ErrorTitle>{t("performance.notAvailableOffline")}</ErrorTitle>
        <ErrorText>{t("performance.notAvailableOfflineHint")}</ErrorText>
        <BackButton onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(exitPath))}>
          <i className="bi bi-arrow-left"></i>
          {t("performance.back")}
        </BackButton>
      </ErrorContainer>
    );
  }

  if (songNotFound) {
    return (
      <ErrorContainer>
        <ErrorIcon>
          <i className="bi bi-exclamation-triangle"></i>
        </ErrorIcon>
        <ErrorTitle>{t("songs.notFound")}</ErrorTitle>
        <BackButton onClick={() => navigate("/songs")}>
          <i className="bi bi-arrow-left"></i>
          {t("songs.backToSongs")}
        </BackButton>
      </ErrorContainer>
    );
  }

  // "error" keeps the spinner for the one render before the bounce above.
  if (perf.status !== "ready") {
    return (
      <LoadingContainer>
        <Spinner color="primary" style={{ width: "3rem", height: "3rem" }} />
        <LoadingText>{t("performance.loadingView")}</LoadingText>
      </LoadingContainer>
    );
  }

  if (!setlist || setlistItems.length === 0) {
    return (
      <ErrorContainer>
        <ErrorIcon>
          <i className="bi bi-exclamation-triangle"></i>
        </ErrorIcon>
        <ErrorTitle>{t("performance.unableToLoad")}</ErrorTitle>
        <ErrorText>
          {!setlist ? t("performance.setlistNotFound") : t("performance.noSongs")}
        </ErrorText>
        <BackButton onClick={() => navigate("/setlists")}>
          <i className="bi bi-arrow-left"></i>
          {t("performance.backToSetlists")}
        </BackButton>
      </ErrorContainer>
    );
  }

  // Get current item and determine if it's a song or special item
  const currentItem = setlistItems[currentIndex];
  const isCurrentItemSong = isSongItem(currentItem);
  const currentSong = isCurrentItemSong ? getSongById(currentItem.song_id) : null;
  const currentNotes = currentSong ? getSetlistSongNotes(currentSong.id) : null;
  const nextItemInfo = getNextItemInfo();

  // Song count for the page description
  const songItemsOnly = setlistItems.filter(isSongItem);
  // The song target's only song (the synthetic setlist has one item).
  const targetSong = isSong ? currentSong : null;

  // Determine what content to display with smart fallback
  const getDisplayContent = (): { type: "chords" | "lyrics" | "none"; content: string } => {
    if (!currentSong) return { type: "none", content: "" };

    const hasChords = Boolean(currentSong.chords);
    const hasLyrics = Boolean(currentSong.lyrics);

    if (contentView === "chords") {
      if (hasChords) {
        return { type: "chords", content: currentSong.chords! };
      } else if (hasLyrics) {
        return { type: "lyrics", content: currentSong.lyrics! };
      }
    } else {
      // contentView === "lyrics"
      if (hasLyrics) {
        return { type: "lyrics", content: currentSong.lyrics! };
      } else if (hasChords) {
        return { type: "chords", content: currentSong.chords! };
      }
    }

    return { type: "none", content: "" };
  };

  const displayContent = getDisplayContent();

  // Get the correct sections based on content type being displayed
  const getDisplaySections = () => {
    if (!currentSong?.timing_data) return [];
    const timingData = currentSong.timing_data;

    // Use the new separate sections format if available
    if (displayContent.type === "chords" && timingData.chordSectionTimings?.length) {
      return timingData.chordSectionTimings;
    }
    if (displayContent.type === "lyrics" && timingData.lyricsSectionTimings?.length) {
      return timingData.lyricsSectionTimings;
    }

    // Fallback to legacy sectionTimings
    return timingData.sectionTimings || [];
  };

  const displaySections = getDisplaySections();

  return (
    <PerformanceContainer>
      <SEO
        title={`${setlist.name} - Performance Mode`}
        description={
          isSong
            ? `Performance mode for ${setlist.name}. Fullscreen lyrics and chords view for live performances.`
            : `Performance mode for ${setlist.name}. Fullscreen lyrics and chords view for live performances with ${songItemsOnly.length} songs.`
        }
      />
      {/* Top Bar */}
      <TopBar>
        <TopBarRow>
          <TopBarLeft>
            <ExitButton onClick={exitPerformance} title={t("performance.exit")}>
              <i className="bi bi-x-lg"></i>
            </ExitButton>
            <SetlistInfo>
              <SetlistName>{setlist.name}</SetlistName>
              {targetSong?.artist && <SongSubtitle>{targetSong.artist}</SongSubtitle>}
            </SetlistInfo>
            {onSnapshot && !isSong && (
              <SourceBadge $offline={!isOnline} title={isOnline ? t("performance.offlineCopyBadgeHint") : undefined}>
                <i className={`bi ${isOnline ? "bi-cloud-check" : "bi-wifi-off"}`}></i>
                <span>{isOnline ? t("performance.offlineCopyBadge") : t("performance.offlineBadge")}</span>
              </SourceBadge>
            )}
          </TopBarLeft>

          {!isSong && (
            <SongCounter>
              {currentIndex + 1} / {setlistItems.length}
            </SongCounter>
          )}
        </TopBarRow>

        <TopBarControls>
          {isReorderMode ? (
            <ReorderActions>
              <ReorderActionButton onClick={handleCancelReorder} $variant="cancel" disabled={saving}>
                <i className="bi bi-x-lg"></i>
                {t("common.cancel")}
              </ReorderActionButton>
              <ReorderActionButton onClick={handleSaveOrder} $variant="save" disabled={saving}>
                {saving ? (
                  <>
                    <Spinner size="sm" style={{ marginRight: "4px" }} />
                    {t("common.saving")}
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-lg"></i>
                    {t("common.save")}
                  </>
                )}
              </ReorderActionButton>
            </ReorderActions>
          ) : (
            <>
              {!isSong && (
              <SyncControls
                role={syncRole}
                isConnected={isSyncConnected}
                isLoading={isSyncLoading}
                error={syncError}
                hasActiveSession={hasActiveSession}
                activeSessionSetlistId={activeSessionSetlistId}
                currentSetlistId={setlistId || ""}
                hostDisplayName={hostDisplayName}
                sessionCreatedAt={sessionCreatedAt}
                canManageOrphanedSession={canManageOrphanedSession}
                onStartHosting={startHosting}
                onJoinSession={joinExistingSession}
                onLeaveSession={leaveSession}
                onForceEndSession={forceEndSession}
                onTakeOverSession={takeOverSession}
                disabled={!capabilities.canSync && !isSyncConnected}
                disabledReason={t("performanceSync.needsConnection")}
              />
              )}
              {/* Self-contained (reads the offline service itself); no Remove here. */}
              {!isSong && (
                <OfflineDownloadAction setlistId={setlist.id} setlistName={setlist.name} variant="toolbar" />
              )}
              <ViewToggleGroup>
                <ViewToggleButton
                  onClick={() => chooseContentView("lyrics")}
                  $active={contentView === "lyrics"}
                  title={t("performance.showLyrics", "Show Lyrics")}
                >
                  <i className="bi bi-mic"></i>
                  {t("performance.lyrics", "Lyrics")}
                </ViewToggleButton>
                <ViewToggleButton
                  onClick={() => chooseContentView("chords")}
                  $active={contentView === "chords"}
                  title={t("performance.showChords", "Show Chords")}
                >
                  <i className="bi bi-music-note"></i>
                  {t("performance.chords", "Chords")}
                </ViewToggleButton>
                {isCurrentItemSong && (
                  <ViewToggleButton
                    onClick={() => chooseContentView("sheetMusic")}
                    $active={contentView === "sheetMusic"}
                    title={t("performance.showSheetMusic", "Show Sheet Music")}
                  >
                    <i className="bi bi-file-earmark-music"></i>
                    {t("performance.sheetMusic", "Sheet")}
                  </ViewToggleButton>
                )}
              </ViewToggleGroup>
              {contentView === "sheetMusic" && sheetMusicList.length > 0 && (
                <IconButton
                  onClick={toggleInvertPdfColors}
                  title={t("sheetMusic.invertColors", "Invert Colors (D)")}
                  $active={invertPdfColors}
                >
                  <i className={`bi bi-${invertPdfColors ? "sun" : "moon"}`}></i>
                </IconButton>
              )}
              {contentView !== "sheetMusic" && (
                <FontSizeButtonWrapper>
                  <IconButton
                    ref={fontSizeButtonRef}
                    onClick={() => setShowFontSizeDropdown((v) => !v)}
                    title={t("performance.fontSize", "Font size")}
                    $active={showFontSizeDropdown}
                  >
                    <i className="bi bi-fonts"></i>
                  </IconButton>
                  {showFontSizeDropdown && (
                    <FontSizeDropdown ref={fontSizeDropdownRef}>
                      <IconButton
                        onClick={decreaseFontSize}
                        title={t("performance.decreaseFontSize", "Decrease font size (-)")}
                        disabled={fontSize <= FONT_SIZE_MIN}
                      >
                        <i className="bi bi-dash"></i>
                      </IconButton>
                      <FontSizeLabel
                        onClick={resetFontSize}
                        title={t("performance.resetFontSize", "Reset font size (0)")}
                      >
                        {fontSize}%
                      </FontSizeLabel>
                      <IconButton
                        onClick={increaseFontSize}
                        title={t("performance.increaseFontSize", "Increase font size (+)")}
                        disabled={fontSize >= FONT_SIZE_MAX}
                      >
                        <i className="bi bi-plus"></i>
                      </IconButton>
                    </FontSizeDropdown>
                  )}
                </FontSizeButtonWrapper>
              )}
              {capabilities.canReorder && (
                <IconButton
                  onClick={toggleReorderMode}
                  title={t("performance.reorderSongsShortcut")}
                  $active={false}
                  disabled={!canStartReorder}
                >
                  <i className="bi bi-arrow-down-up"></i>
                </IconButton>
              )}
              {!isSong && (
                <IconButton
                  onClick={() => setShowSongList(!showSongList)}
                  title={t("performance.songListShortcut")}
                  $active={showSongList}
                >
                  <i className="bi bi-list-ul"></i>
                </IconButton>
              )}
              <IconButton onClick={toggleFullscreen} title={t("performance.fullscreenShortcut")}>
                <i className={`bi bi-${isFullscreen ? "fullscreen-exit" : "arrows-fullscreen"}`}></i>
              </IconButton>
            </>
          )}
        </TopBarControls>
      </TopBar>

      {/* Main Content Area */}
      <MainContent>
        {/* Song List Sidebar */}
        {showSongList && !isSong && (
          <>
          <SongListBackdrop onClick={() => setShowSongList(false)} />
          <SongListSidebar>
            <SidebarHeader>
              {isReorderMode ? t("performance.reorderSongs") : t("performance.setlist")}
              {isReorderMode && (
                <SidebarHint>{t("performance.dragToReorder")}</SidebarHint>
              )}
            </SidebarHeader>
            <SongListItems ref={songListRef}>
              {isReorderMode ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={setlistItems.map(getSetlistItemKey)}
                    strategy={verticalListSortingStrategy}
                  >
                    {setlistItems.map((item, index) => {
                      if (isSongItem(item)) {
                        const song = getSongById(item.song_id);
                        if (!song) return null;
                        return (
                          <SortableSongListItem
                            key={item.song_id}
                            song={song}
                            index={index}
                            isActive={false}
                            onClick={() => {}}
                          />
                        );
                      }
                      const itemId = getSetlistItemKey(item);
                      return (
                        <SortableSpecialListItem key={itemId} item={item} itemId={itemId} />
                      );
                    })}
                  </SortableContext>
                </DndContext>
              ) : (
                setlistItems.map((item, index) => {
                  if (isSongItem(item)) {
                    const song = getSongById(item.song_id);
                    if (!song) return null;
                    return (
                      <SongListItem
                        key={`song-${item.song_id}`}
                        $active={index === currentIndex}
                        data-active={index === currentIndex}
                        onClick={() => handleGoToSong(index)}
                      >
                        <SongListPosition>{index + 1}</SongListPosition>
                        <SongListInfo>
                          <SongListTitle>{song.title}</SongListTitle>
                          {song.artist && <SongListArtist>{song.artist}</SongListArtist>}
                        </SongListInfo>
                        {index === currentIndex && (
                          <SongListIndicator>
                            <i className="bi bi-play-fill"></i>
                          </SongListIndicator>
                        )}
                      </SongListItem>
                    );
                  } else {
                    // Special item (break, section, note)
                    const getIcon = () => {
                      if (isBreakItem(item)) return "bi-pause-circle";
                      if (isSectionItem(item)) return "bi-bookmark";
                      return "bi-sticky";
                    };
                    return (
                      <SpecialListItem
                        key={`special-${index}-${item.type}`}
                        $active={index === currentIndex}
                        data-active={index === currentIndex}
                        $type={item.type}
                        onClick={() => handleGoToSong(index)}
                      >
                        <SpecialListIcon $type={item.type}>
                          <i className={getIcon()}></i>
                        </SpecialListIcon>
                        <SongListInfo>
                          <SongListTitle>{item.label}</SongListTitle>
                          {isBreakItem(item) && item.duration && (
                            <SongListArtist>{t("performance.durationMinutes", { count: item.duration })}</SongListArtist>
                          )}
                        </SongListInfo>
                        {index === currentIndex && (
                          <SongListIndicator>
                            <i className="bi bi-play-fill"></i>
                          </SongListIndicator>
                        )}
                      </SpecialListItem>
                    );
                  }
                })
              )}
            </SongListItems>
          </SongListSidebar>
          </>
        )}

        {/* Song/Item Display */}
        <SongDisplay data-song-display $isSheetMusic={contentView === "sheetMusic" && sheetMusicList.length > 0}>
          {isCurrentItemSong && currentSong ? (
            <>
              <SongHeader $compact={contentView === "sheetMusic" && sheetMusicList.length > 0}>
                <SongTitleLarge $compact={contentView === "sheetMusic" && sheetMusicList.length > 0}>
                  {currentSong.title}
                  {currentSong.artist && contentView === "sheetMusic" && sheetMusicList.length > 0 && (
                    <SongArtistInline> — {currentSong.artist}</SongArtistInline>
                  )}
                </SongTitleLarge>
                {/* Hide metadata and notes in sheet music mode to maximize PDF space.
                    Artist and metadata share one wrapping row so lyrics/chords start
                    high on the screen (mobile, large text). */}
                {!(contentView === "sheetMusic" && sheetMusicList.length > 0) && (
                  <>
                    {(currentSong.artist || currentSong.key || currentSong.tempo || currentSong.duration) && (
                      <SongMetadataBar>
                        {currentSong.artist && <SongArtistLarge>{currentSong.artist}</SongArtistLarge>}
                        {currentSong.key && (
                          <MetaBadgeLarge>
                            <i className="bi bi-music-note-beamed" aria-hidden="true"></i>
                            {t("performance.meta.key", { key: currentSong.key })}
                          </MetaBadgeLarge>
                        )}
                        {currentSong.tempo && (
                          <MetaBadgeLarge>
                            <i className="bi bi-speedometer2" aria-hidden="true"></i>
                            {t("performance.meta.bpm", { tempo: currentSong.tempo })}
                          </MetaBadgeLarge>
                        )}
                        {currentSong.duration && (
                          <MetaBadgeLarge>
                            <i className="bi bi-clock" aria-hidden="true"></i>
                            {formatDuration(currentSong.duration)}
                          </MetaBadgeLarge>
                        )}
                      </SongMetadataBar>
                    )}

                    {currentNotes && !isSong && (
                      <NotesBox>
                        <NotesLabel>
                          <i className="bi bi-sticky" aria-hidden="true"></i>
                          {t("performance.meta.notes")}
                        </NotesLabel>
                        <NotesText>{currentNotes}</NotesText>
                      </NotesBox>
                    )}
                  </>
                )}

                {/* Backing Track Player - only visible to host or when not in sync mode, hidden (not unmounted) in sheet music mode to preserve playback */}
                {(syncRole === "host" || syncRole === null) && currentSong?.has_backing_tracks && (
                  <BackingTrackPlayerWrapper
                    $sheetMode={contentView === "sheetMusic" && sheetMusicList.length > 0}
                    $overlayVisible={showFullPlayerInSheet}
                    onClickCapture={showFullPlayerInSheet ? extendFullPlayerTimer : undefined}
                  >
                    <BackingTrackPlayer
                      ref={backingTrackRef}
                      songId={currentSong.id}
                      trackUrl={getTrackUrl(currentSong.id)}
                      trackFileName={getTrackInfo(currentSong.id)?.fileName || null}
                      hadTrackPreviously={hadTrackPreviously(currentSong.id)}
                      onLoadTrack={loadTrack}
                      onRemoveTrack={removeTrack}
                      isHost={syncRole === "host" || syncRole === null}
                      onTimeUpdate={handleAudioTimeUpdate}
                      onPlayingChange={handleAudioPlayingChange}
                    />
                  </BackingTrackPlayerWrapper>
                )}
              </SongHeader>

              <SongContent $fullHeight={contentView === "sheetMusic"} $fontScale={fontSize}>
                {contentView === "sheetMusic" && sheetMusicList.length > 0 ? (
                  <SheetMusicWrapper>
                    {/* Sheet Music Selector - only show if multiple exist */}
                    {sheetMusicList.length > 1 && (
                      <SheetMusicSelector>
                        {sheetMusicList.map((sm) => {
                          const isPreferred = preferredSheetMusicIds[sm.song_id] === sm.id;
                          const notDownloaded = perf.unavailableSheetMusicIds.has(sm.id);
                          return (
                            <SheetMusicSelectorItem
                              key={sm.id}
                              type="button"
                              $active={sm.id === selectedSheetMusicId}
                              onClick={() => handleSelectSheetMusic(sm)}
                              disabled={notDownloaded}
                              title={
                                notDownloaded
                                  ? t("sheetMusic.notDownloaded")
                                  : isPreferred
                                    ? t("sheetMusic.myDefault")
                                    : t("sheetMusic.selectRemembers")
                              }
                            >
                              <i className={getInstrumentIcon(sm.instrument)} />
                              <span>{sm.name}</span>
                              {notDownloaded && <NotDownloadedTag>{t("sheetMusic.notDownloaded")}</NotDownloadedTag>}
                              {isPreferred && (
                                <PreferredMark
                                  className="bi bi-star-fill"
                                  aria-label={t("sheetMusic.myDefault")}
                                />
                              )}
                            </SheetMusicSelectorItem>
                          );
                        })}
                      </SheetMusicSelector>
                    )}
                    {selectedSheetMusicId && perf.unavailableSheetMusicIds.has(selectedSheetMusicId) ? (
                      <EmptyContent>
                        <i className="bi bi-cloud-slash"></i>
                        <p>{t("sheetMusic.notOnDevice")}</p>
                      </EmptyContent>
                    ) : sheetMusicLoading ? (
                      <EmptyContent>
                        <i className="bi bi-hourglass-split"></i>
                        <p>{t("sheetMusic.loading", "Loading sheet music...")}</p>
                      </EmptyContent>
                    ) : pdfViewerError ? (
                      <EmptyContent>
                        <i className="bi bi-exclamation-triangle"></i>
                        <p>{t("sheetMusic.openError")}</p>
                        <AddPdfButton
                          type="button"
                          onClick={() => {
                            // Release + re-resolve (a fresh blob URL) and remount the viewer.
                            setPdfViewerError(false);
                            setSheetMusicUrl(null);
                            setPdfReloadKey((key) => key + 1);
                          }}
                        >
                          <i className="bi bi-arrow-repeat"></i>
                          {t("sheetMusic.tryAgain")}
                        </AddPdfButton>
                      </EmptyContent>
                    ) : sheetMusicUrl ? (
                      <PDFErrorBoundary
                        retryLabel={t("performance.retry")}
                        fallbackMessage={
                          onSnapshot && !isOnline
                            ? t("sheetMusic.offlineViewerError")
                            : t("sheetMusic.loadError", "Failed to load sheet music. Your browser may not support this feature.")
                        }
                      >
                        <SheetMusicViewer
                          key={`${selectedSheetMusicId}-${pdfReloadKey}`}
                          ref={sheetMusicViewerRef}
                          onLoadError={() => setPdfViewerError(true)}
                          pdfUrl={sheetMusicUrl}
                          pageTimings={sheetMusicList.find((sm) => sm.id === selectedSheetMusicId)?.page_timings}
                          currentTime={displayAudioTime}
                          isPlaying={displayIsPlaying}
                          onPageChange={(page) => setPdfCurrentPage(page)}
                          onNumPagesLoaded={(numPages) => setPdfNumPages(numPages)}
                          invertColors={invertPdfColors}
                        />
                      </PDFErrorBoundary>
                    ) : (
                      <EmptyContent>
                        <i className="bi bi-file-earmark-x"></i>
                        <p>{t("sheetMusic.loadError", "Failed to load sheet music")}</p>
                      </EmptyContent>
                    )}
                    {/* Mini audio controls overlay for sheet music view */}
                    {(syncRole === "host" || syncRole === null) && currentSong?.has_backing_tracks && getTrackUrl(currentSong.id) && !showFullPlayerInSheet && (
                      <MiniAudioOverlay>
                        <MiniAudioButton
                          onClick={() => backingTrackRef.current?.stop()}
                          title={t("backingTrack.stop", "Stop")}
                        >
                          <i className="bi bi-stop-fill" />
                        </MiniAudioButton>
                        <MiniAudioPlayButton
                          onClick={() => backingTrackRef.current?.togglePlayPause()}
                          $isPlaying={displayIsPlaying}
                          title={displayIsPlaying ? t("backingTrack.pause", "Pause") : t("backingTrack.play", "Play")}
                        >
                          <i className={`bi bi-${displayIsPlaying ? "pause-fill" : "play-fill"}`} />
                        </MiniAudioPlayButton>
                        <MiniAudioTimeButton
                          type="button"
                          onClick={showFullPlayerTemporarily}
                          title={t("backingTrack.openFullPlayer", "Open full player")}
                          aria-label={t("backingTrack.openFullPlayer", "Open full player")}
                        >
                          {formatDuration(Math.floor(displayAudioTime))}
                          <i className="bi bi-chevron-down" aria-hidden="true" />
                        </MiniAudioTimeButton>
                      </MiniAudioOverlay>
                    )}
                  </SheetMusicWrapper>
                ) : contentView === "sheetMusic" ? (
                  <EmptyContent>
                    <i className="bi bi-file-earmark-music"></i>
                    <p>{t("performance.noSheetMusicForSong", "No PDF uploaded for this song")}</p>
                    {capabilities.canUpload && (
                      <AddPdfButton type="button" onClick={() => setShowAddPdfModal(true)}>
                        <i className="bi bi-cloud-arrow-up"></i>
                        {t("performance.addSheetMusic", "Add PDF")}
                      </AddPdfButton>
                    )}
                  </EmptyContent>
                ) : displayContent.type !== "none" && (displaySections.length > 0 || currentSong.timing_data?.lineTimings?.length) ? (
                  <SyncedLyricsDisplay
                    content={displayContent.content}
                    contentType={displayContent.type}
                    sections={displaySections}
                    lineTimings={currentSong.timing_data?.lineTimings}
                    currentTime={displayAudioTime}
                    isPlaying={displayIsPlaying}
                    fontScale={fontSize / 100}
                  />
                ) : (
                  <>
                    {displayContent.type === "chords" && (
                      <ContentSection>
                        <SectionLabel>
                          <i className="bi bi-music-note"></i>
                          {t("performance.chords", "Chords")}
                        </SectionLabel>
                        <ContentText>{displayContent.content}</ContentText>
                      </ContentSection>
                    )}

                    {displayContent.type === "lyrics" && (
                      <ContentSection>
                        <SectionLabel>
                          <i className="bi bi-mic"></i>
                          {t("performance.lyrics", "Lyrics")}
                        </SectionLabel>
                        <ContentText>{displayContent.content}</ContentText>
                      </ContentSection>
                    )}

                    {displayContent.type === "none" && (
                      <EmptyContent>
                        <i className="bi bi-music-note-beamed"></i>
                        <p>{t("performance.noContent")}</p>
                      </EmptyContent>
                    )}
                  </>
                )}
              </SongContent>
            </>
          ) : (
            /* Special Item Display */
            <SpecialItemDisplay $type={currentItem.type}>
              <SpecialItemIconLarge $type={currentItem.type}>
                <i className={`bi ${isBreakItem(currentItem) ? "bi-pause-circle" : isSectionItem(currentItem) ? "bi-bookmark" : "bi-sticky"}`}></i>
              </SpecialItemIconLarge>
              <SpecialItemTypeBadge $type={currentItem.type}>
                {isBreakItem(currentItem) ? t("setlists.items.break") : isSectionItem(currentItem) ? t("setlists.items.section") : t("setlists.items.note")}
              </SpecialItemTypeBadge>
              <SpecialItemLabelLarge>{(currentItem as { label: string }).label}</SpecialItemLabelLarge>
              {isBreakItem(currentItem) && currentItem.duration && (
                <SpecialItemDurationLarge>
                  <i className="bi bi-clock"></i>
                  {currentItem.duration} {t("setlists.items.duration").split(" ")[0].toLowerCase()}
                </SpecialItemDurationLarge>
              )}
            </SpecialItemDisplay>
          )}

          {/* Up Next Indicator - hidden in sheet music mode to maximize PDF space */}
          {nextItemInfo && !isSong && !(contentView === "sheetMusic" && sheetMusicList.length > 0) && (
            <UpNextBar $type={nextItemInfo.type}>
              <UpNextLabel>{t("setlists.items.upNext")}:</UpNextLabel>
              <UpNextContent>
                {nextItemInfo.type === "song" && <i className="bi bi-music-note-beamed"></i>}
                {nextItemInfo.type === "break" && <i className="bi bi-pause-circle"></i>}
                {nextItemInfo.type === "section" && <i className="bi bi-bookmark"></i>}
                {nextItemInfo.type === "note" && <i className="bi bi-sticky"></i>}
                {nextItemInfo.type === "end" && <i className="bi bi-flag-fill"></i>}
                <UpNextText>{nextItemInfo.label}</UpNextText>
              </UpNextContent>
            </UpNextBar>
          )}
        </SongDisplay>
      </MainContent>

      {/* Bottom Navigation (a song target has no prev/next; arrows still turn PDF pages) */}
      {!isSong && (
      <BottomNav>
        <NavButton
          onClick={handlePrevNav}
          disabled={syncRole === "viewer" || (currentIndex === 0 && pdfCurrentPage <= 1)}
        >
          <i className="bi bi-chevron-left"></i>
          <span>{t("performance.previous")}</span>
        </NavButton>

        <NavCenter>
          <ProgressBar>
            <ProgressFill $percent={((currentIndex + 1) / setlistItems.length) * 100} />
          </ProgressBar>
          <KeyboardHint>
            {syncRole === "viewer"
              ? t("performance.hintViewer")
              : t("performance.hintHost")}
          </KeyboardHint>
        </NavCenter>

        <NavButton
          onClick={handleNextNav}
          disabled={syncRole === "viewer" || (currentIndex === setlistItems.length - 1 && pdfCurrentPage >= (pdfNumPages || 1))}
        >
          <span>{t("performance.next")}</span>
          <i className="bi bi-chevron-right"></i>
        </NavButton>
      </BottomNav>
      )}

      {/* Mobile Floating Toggle Button */}
      <MobileToggleButton onClick={toggleContentView} $contentType={contentView}>
        <i className={`bi bi-${contentView === "chords" ? "music-note" : contentView === "sheetMusic" ? "file-earmark-music" : "mic"}`}></i>
        <MobileToggleLabel>
          {contentView === "chords"
            ? t("performance.chords", "Chords")
            : contentView === "sheetMusic"
            ? t("performance.sheet", "Sheet")
            : t("performance.lyrics", "Lyrics")}
        </MobileToggleLabel>
      </MobileToggleButton>

      {/* Add PDF Modal */}
      {showAddPdfModal && capabilities.canUpload && currentSong && setlist && (
        <AddPdfModalOverlay onClick={() => setShowAddPdfModal(false)}>
          <AddPdfModalContainer onClick={(e) => e.stopPropagation()}>
            <AddPdfModalHeader>
              <AddPdfModalTitle>
                <i className="bi bi-file-earmark-music"></i>
                {t("sheetMusic.title")} — {currentSong.title}
              </AddPdfModalTitle>
              <AddPdfModalCloseButton
                type="button"
                onClick={() => setShowAddPdfModal(false)}
                aria-label={t("common.close")}
              >
                <i className="bi bi-x-lg"></i>
              </AddPdfModalCloseButton>
            </AddPdfModalHeader>
            <AddPdfModalBody>
              <SheetMusicUpload
                songId={currentSong.id}
                bandId={setlist.band_id}
                onUpdate={perf.onSheetMusicUploaded}
              />
            </AddPdfModalBody>
          </AddPdfModalContainer>
        </AddPdfModalOverlay>
      )}
    </PerformanceContainer>
  );
};

// Styled Components

const PerformanceContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--color-bg-primary);
  display: flex;
  flex-direction: column;
  z-index: ${theme.zIndex.modal};
`;

const TopBar = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[3]};
  padding: ${theme.space[4]} ${theme.space[6]};
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;

  @media (min-width: ${theme.breakpoints.md}) {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: ${theme.space[4]};
  }
`;

const TopBarRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${theme.space[4]};
  min-width: 0;

  @media (min-width: ${theme.breakpoints.md}) {
    flex: 1;
    justify-content: flex-start;
  }
`;

/** §8.3: "Offline" (no connection, on the snapshot) or a subtle "Offline copy" (online, on the snapshot). */
const SourceBadge = styled.span<{ $offline: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[1]};
  flex-shrink: 0;
  padding: 2px ${theme.space[2]};
  border-radius: ${theme.radius.full};
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.medium};
  white-space: nowrap;
  color: ${(props) => (props.$offline ? theme.colors.semantic.warning : theme.colors.dark.text.tertiary)};
  border: 1px solid ${(props) => (props.$offline ? theme.colors.semantic.warning : theme.colors.dark.border.default)};
  background: ${(props) => (props.$offline ? theme.colors.semantic.warning + "1a" : "transparent")};
`;

const TopBarLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  min-width: 0;
  flex: 1;

  @media (min-width: ${theme.breakpoints.md}) {
    gap: ${theme.space[4]};
    flex: unset;
  }
`;

const TopBarControls = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  flex-wrap: wrap;
  justify-content: flex-end;

  @media (min-width: ${theme.breakpoints.md}) {
    gap: ${theme.space[3]};
    flex-wrap: nowrap;
  }
`;

const ExitButton = styled.button`
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  width: 40px;
  height: 40px;
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  font-size: ${theme.fontSizes.bodyLg};

  &:hover {
    background: ${theme.colors.semantic.errorBgDark};
    border-color: ${theme.colors.semantic.error};
    color: ${theme.colors.semantic.error};
  }
`;

const SetlistInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[1]};
  min-width: 0;
  flex: 1;
`;

const SetlistName = styled.div`
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  @media (min-width: ${theme.breakpoints.md}) {
    font-size: ${theme.fontSizes.bodyLg};
  }
`;

const SongSubtitle = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const SongCounter = styled.div`
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.medium};
  color: var(--color-text-primary);
  padding: ${theme.space[2]} ${theme.space[4]};
  background: var(--color-bg-tertiary);
  border-radius: ${theme.radius.base};
`;

const ViewToggleGroup = styled.div`
  display: flex;
  gap: ${theme.space[2]};
  background: var(--color-bg-tertiary);
  padding: ${theme.space[1]};
  border-radius: ${theme.radius.base};
  border: 1px solid var(--color-border);

  @media (max-width: ${theme.breakpoints.md}) {
    display: none;
  }
`;

const ViewToggleButton = styled.button<{ $active: boolean }>`
  background: ${(props) =>
    props.$active ? theme.colors.brand.primary : "transparent"};
  border: none;
  color: ${(props) =>
    props.$active ? "white" : 'var(--color-text-secondary)'};
  padding: ${theme.space[2]} ${theme.space[4]};
  border-radius: ${theme.radius.sm};
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};

  i {
    font-size: ${theme.fontSizes.body};
  }

  &:hover {
    background: ${(props) =>
      props.$active ? theme.colors.brand.primaryHover : 'var(--color-bg-elevated)'};
    color: ${(props) =>
      props.$active ? "white" : theme.colors.brand.primary};
  }
`;

const IconButton = styled.button<{ $active?: boolean }>`
  background: ${(props) =>
    props.$active ? theme.colors.brand.primary : "transparent"};
  border: 1px solid ${(props) =>
    props.$active ? theme.colors.brand.primary : 'var(--color-border)'};
  color: ${(props) =>
    props.$active ? "white" : 'var(--color-text-secondary)'};
  width: 40px;
  height: 40px;
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  font-size: ${theme.fontSizes.bodyLg};

  &:hover:not(:disabled) {
    background: ${(props) =>
      props.$active ? theme.colors.brand.primaryHover : 'var(--color-bg-elevated)'};
    border-color: ${theme.colors.brand.primary};
    color: ${(props) =>
      props.$active ? "white" : theme.colors.brand.primary};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const FontSizeButtonWrapper = styled.div`
  position: relative;
`;

const FontSizeDropdown = styled.div`
  position: absolute;
  top: calc(100% + ${theme.space[2]});
  right: 0;
  display: flex;
  align-items: center;
  gap: ${theme.space[1]};
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.base};
  padding: ${theme.space[1]};
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  z-index: ${theme.zIndex.dropdown};
`;

const FontSizeLabel = styled.button`
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  font-size: ${theme.fontSizes.bodySm};
  font-family: ${theme.fonts.mono};
  font-weight: ${theme.fontWeights.medium};
  padding: 0 ${theme.space[1]};
  min-width: 3rem;
  text-align: center;
  cursor: pointer;
  transition: color ${theme.transitions.fast} ease;

  &:hover {
    color: ${theme.colors.brand.primary};
  }
`;

const ReorderActions = styled.div`
  display: flex;
  gap: ${theme.space[2]};
`;

const ReorderActionButton = styled.button<{ $variant: "cancel" | "save" }>`
  background: ${(props) =>
    props.$variant === "save" ? theme.colors.semantic.success : "transparent"};
  border: 1px solid ${(props) =>
    props.$variant === "save" ? theme.colors.semantic.success : 'var(--color-border)'};
  color: ${(props) =>
    props.$variant === "save" ? "white" : 'var(--color-text-secondary)'};
  padding: ${theme.space[2]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};

  &:hover:not(:disabled) {
    background: ${(props) =>
      props.$variant === "save" ? "#059669" : 'var(--color-bg-elevated)'};
    border-color: ${(props) =>
      props.$variant === "save" ? "#059669" : 'var(--color-border-strong)'};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const MainContent = styled.div`
  flex: 1;
  display: flex;
  overflow: hidden;
`;

const SongListBackdrop = styled.div`
  display: none;

  @media (max-width: ${theme.breakpoints.md}) {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 10;
  }
`;

const SongListSidebar = styled.div`
  width: 320px;
  background: var(--color-bg-secondary);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;

  @media (max-width: ${theme.breakpoints.md}) {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    top: auto;
    width: 100%;
    max-height: 60vh;
    border-right: none;
    border-top: 1px solid var(--color-border);
    border-radius: ${theme.radius.lg} ${theme.radius.lg} 0 0;
    z-index: 11;
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.3);
    padding-bottom: env(safe-area-inset-bottom, 0);
  }
`;

const SidebarHeader = styled.div`
  padding: ${theme.space[4]} ${theme.space[5]};
  border-bottom: 1px solid var(--color-border);
  font-size: ${theme.fontSizes.h4};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;

  @media (max-width: ${theme.breakpoints.md}) {
    padding-top: ${theme.space[5]};

    &::before {
      content: "";
      position: absolute;
      top: ${theme.space[2]};
      left: 50%;
      transform: translateX(-50%);
      width: 36px;
      height: 4px;
      background: var(--color-border-strong);
      border-radius: ${theme.radius.full};
    }
  }
`;

const SidebarHint = styled.span`
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.medium};
  color: ${theme.colors.brand.primary};
  background: ${theme.colors.brand.primary}20;
  padding: ${theme.space[1]} ${theme.space[2]};
  border-radius: ${theme.radius.sm};
`;

const SongListItems = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${theme.space[2]};
`;

const SongListItem = styled.button<{ $active: boolean; $isDragging?: boolean }>`
  width: 100%;
  background: ${(props) =>
    props.$isDragging
      ? 'var(--color-bg-elevated)'
      : props.$active
      ? theme.colors.brand.primary
      : "transparent"};
  border: 1px solid ${(props) =>
    props.$isDragging || props.$active ? theme.colors.brand.primary : 'var(--color-border)'};
  color: ${(props) =>
    props.$active ? "white" : 'var(--color-text-primary)'};
  padding: ${theme.space[3]};
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  margin-bottom: ${theme.space[2]};
  text-align: left;
  opacity: ${(props) => (props.$isDragging ? 0.9 : 1)};
  box-shadow: ${(props) => (props.$isDragging ? theme.shadows.lg : "none")};
  z-index: ${(props) => (props.$isDragging ? 10 : "auto")};

  @media (max-width: ${theme.breakpoints.md}) {
    padding: ${theme.space[2]} ${theme.space[3]};
    gap: ${theme.space[2]};
    margin-bottom: ${theme.space[1]};
  }

  &:hover {
    background: ${(props) =>
      props.$active ? theme.colors.brand.primaryHover : 'var(--color-bg-elevated)'};
    border-color: ${theme.colors.brand.primary};
  }
`;

const SongListDragHandle = styled.div`
  color: var(--color-text-tertiary);
  width: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  transition: all ${theme.transitions.fast} ease;
  flex-shrink: 0;
  font-size: ${theme.fontSizes.bodyLg};
  touch-action: none;

  &:hover {
    color: ${theme.colors.brand.primary};
  }

  &:active {
    cursor: grabbing;
    color: ${theme.colors.brand.primary};
  }
`;

const SongListPosition = styled.div`
  width: 28px;
  height: 28px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: ${theme.radius.sm};
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: ${theme.fontWeights.semibold};
  font-size: ${theme.fontSizes.bodySm};
  flex-shrink: 0;

  @media (max-width: ${theme.breakpoints.md}) {
    width: 24px;
    height: 24px;
    font-size: ${theme.fontSizes.bodyXs};
  }
`;

const SongListInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const SongListTitle = styled.div`
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.medium};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  @media (max-width: ${theme.breakpoints.md}) {
    font-size: ${theme.fontSizes.bodySm};
  }
`;

const SongListArtist = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  opacity: 0.8;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: ${theme.space[1]};

  @media (max-width: ${theme.breakpoints.md}) {
    font-size: ${theme.fontSizes.bodyXs};
    margin-top: 0;
  }
`;

const SongListIndicator = styled.div`
  font-size: ${theme.fontSizes.bodyLg};
  flex-shrink: 0;
`;

const SongDisplay = styled.div<{ $isSheetMusic?: boolean }>`
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow-y: ${({ $isSheetMusic }) => ($isSheetMusic ? "hidden" : "auto")};
  min-height: 0;
  padding: ${({ $isSheetMusic }) => ($isSheetMusic ? `${theme.space[2]} ${theme.space[3]}` : `${theme.space[8]} ${theme.space[10]}`)};

  @media (max-width: ${theme.breakpoints.lg}) {
    padding: ${({ $isSheetMusic }) => ($isSheetMusic ? `${theme.space[2]} ${theme.space[2]}` : `${theme.space[6]} ${theme.space[6]}`)};
  }

  @media (max-width: ${theme.breakpoints.md}) {
    padding: ${({ $isSheetMusic }) => ($isSheetMusic ? `${theme.space[1]} ${theme.space[1]}` : `${theme.space[3]} ${theme.space[4]}`)};
  }
`;

const SongHeader = styled.div<{ $compact?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${({ $compact }) => ($compact ? "0" : theme.space[4])};
  margin-bottom: ${({ $compact }) => ($compact ? theme.space[1] : theme.space[6])};
  flex-shrink: 0;

  @media (max-width: ${theme.breakpoints.md}) {
    gap: ${({ $compact }) => ($compact ? "0" : theme.space[2])};
    margin-bottom: ${({ $compact }) => ($compact ? "0" : theme.space[3])};
  }
`;

const SongTitleLarge = styled.h1<{ $compact?: boolean }>`
  font-size: ${({ $compact }) => $compact ? theme.fontSizes.h3 : theme.fontSizes.displayMd};
  font-weight: ${theme.fontWeights.bold};
  color: var(--color-text-primary);
  margin: 0;
  line-height: ${theme.lineHeights.tight};
  overflow-wrap: anywhere;
  ${({ $compact }) => $compact && `
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `}

  @media (max-width: ${theme.breakpoints.md}) {
    font-size: ${({ $compact }) => $compact ? theme.fontSizes.body : theme.fontSizes.h2};
  }
`;

const SongArtistInline = styled.span`
  font-weight: ${theme.fontWeights.regular};
  color: var(--color-text-secondary);
  font-size: ${theme.fontSizes.body};
`;

// Artist + key/tempo/duration on one wrapping row: artist first, then chips.
const SongMetadataBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${theme.space[2]} ${theme.space[3]};

  @media (max-width: ${theme.breakpoints.md}) {
    gap: ${theme.space[1]} ${theme.space[2]};
  }
`;

const SongArtistLarge = styled.div`
  font-size: ${theme.fontSizes.h3};
  color: var(--color-text-secondary);
  margin-right: ${theme.space[1]};
  overflow-wrap: anywhere;

  @media (max-width: ${theme.breakpoints.md}) {
    font-size: ${theme.fontSizes.body};
  }
`;

const MetaBadgeLarge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[2]};
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  padding: ${theme.space[1]} ${theme.space[3]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.medium};
  white-space: nowrap;

  i {
    color: ${theme.colors.brand.primary};
  }

  @media (max-width: ${theme.breakpoints.md}) {
    gap: ${theme.space[1]};
    padding: 0.125rem ${theme.space[2]};
    font-size: ${theme.fontSizes.bodySm};
  }
`;

const NotesBox = styled.div`
  background: ${theme.colors.semantic.warningBgDark};
  border: 1px solid ${theme.colors.semantic.warning};
  border-radius: ${theme.radius.base};
  padding: ${theme.space[3]} ${theme.space[4]};

  /* Mobile: label and text on one line to save a row. */
  @media (max-width: ${theme.breakpoints.md}) {
    display: flex;
    align-items: baseline;
    gap: ${theme.space[2]};
    padding: ${theme.space[2]} ${theme.space[3]};
  }
`;

const NotesLabel = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.semantic.warning};
  margin-bottom: ${theme.space[1]};

  @media (max-width: ${theme.breakpoints.md}) {
    flex-shrink: 0;
    margin-bottom: 0;
  }
`;

const NotesText = styled.div`
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-primary);
  line-height: ${theme.lineHeights.relaxed};
  white-space: pre-wrap;
`;

const SongContent = styled.div<{ $fullHeight?: boolean; $fontScale?: number }>`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[8]};
  --performance-font-scale: ${(props) => (props.$fontScale || 100) / 100};
  ${(props) => props.$fullHeight && `
    flex: 1;
    min-height: 0;
  `}
`;

const SheetMusicWrapper = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
`;

const MiniAudioOverlay = styled.div`
  position: absolute;
  top: ${theme.space[2]};
  right: ${theme.space[2]};
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  background: rgba(10, 10, 11, 0.85);
  backdrop-filter: blur(8px);
  padding: ${theme.space[2]} ${theme.space[3]};
  border-radius: ${theme.radius.full};
  border: 1px solid ${theme.colors.dark.border.default};
  z-index: 15;
  transition: opacity 0.2s ease;
`;

const MiniAudioButton = styled.button`
  width: 32px;
  height: 32px;
  border-radius: ${theme.radius.full};
  border: 1px solid ${theme.colors.dark.border.default};
  background: transparent;
  color: ${theme.colors.dark.text.secondary};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: ${theme.fontSizes.body};
  transition: all 0.15s ease;

  &:hover {
    background: ${theme.colors.dark.bg.elevated};
    color: ${theme.colors.dark.text.primary};
  }
`;

const MiniAudioPlayButton = styled.button<{ $isPlaying: boolean }>`
  width: 36px;
  height: 36px;
  border-radius: ${theme.radius.full};
  border: none;
  background: ${({ $isPlaying }) =>
    $isPlaying ? theme.colors.brand.primary : theme.colors.brand.primary};
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: ${theme.fontSizes.bodyLg};
  transition: all 0.15s ease;

  &:hover {
    background: ${theme.colors.brand.primaryHover};
    transform: scale(1.05);
  }
`;

const MiniAudioTimeButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[1]};
  font-size: ${theme.fontSizes.bodySm};
  font-family: ${theme.fonts.mono};
  color: ${theme.colors.dark.text.secondary};
  min-width: 40px;
  padding: ${theme.space[1]} ${theme.space[2]};
  border: 1px solid transparent;
  border-radius: ${theme.radius.full};
  background: transparent;
  cursor: pointer;
  transition: all 0.15s ease;

  i {
    font-size: ${theme.fontSizes.bodySm};
    opacity: 0.7;
  }

  &:hover {
    color: ${theme.colors.dark.text.primary};
    background: ${theme.colors.dark.bg.elevated};
    border-color: ${theme.colors.dark.border.default};

    i {
      opacity: 1;
    }
  }
`;

const BackingTrackPlayerWrapper = styled.div<{ $sheetMode: boolean; $overlayVisible: boolean }>`
  ${({ $sheetMode, $overlayVisible }) => {
    if (!$sheetMode) return "";
    if (!$overlayVisible) return "display: none;";
    return `
      position: absolute;
      top: ${theme.space[2]};
      left: ${theme.space[2]};
      right: ${theme.space[2]};
      z-index: 25;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
      border-radius: ${theme.radius.lg};
      animation: backingTrackOverlayIn 0.2s ease;

      @keyframes backingTrackOverlayIn {
        from {
          opacity: 0;
          transform: translateY(-8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `;
  }}
`;

const SheetMusicSelector = styled.div`
  display: flex;
  gap: ${theme.space[2]};
  flex-wrap: wrap;
  padding: ${theme.space[1]} ${theme.space[2]};
  background: ${theme.colors.dark.bg.secondary};
  border: 1px solid ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.base};
  margin-bottom: ${theme.space[2]};
  flex-shrink: 0;
`;

const SheetMusicSelectorItem = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  padding: ${theme.space[2]} ${theme.space[3]};
  background: ${(props) =>
    props.$active ? theme.colors.brand.primary : "transparent"};
  border: 1px solid ${(props) =>
    props.$active ? theme.colors.brand.primary : theme.colors.dark.border.default};
  border-radius: ${theme.radius.sm};
  color: ${(props) =>
    props.$active ? "white" : theme.colors.dark.text.primary};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  i {
    font-size: ${theme.fontSizes.body};
  }

  &:hover:not(:disabled) {
    background: ${(props) =>
      props.$active ? theme.colors.brand.primaryHover : theme.colors.dark.bg.elevated};
    border-color: ${theme.colors.brand.primary};
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const NotDownloadedTag = styled.span`
  font-size: ${theme.fontSizes.bodyXs};
  color: ${theme.colors.dark.text.tertiary};
  font-weight: ${theme.fontWeights.regular};
`;

const PreferredMark = styled.i`
  && {
    font-size: ${theme.fontSizes.bodyXs};
    color: ${theme.colors.semantic.warning};
  }
`;

const ContentSection = styled.div`
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.lg};
  padding: ${theme.space[6]};

  @media (max-width: ${theme.breakpoints.md}) {
    padding: ${theme.space[3]} ${theme.space[4]};
  }
`;

const SectionLabel = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: ${theme.colors.brand.primary};
  margin-bottom: ${theme.space[3]};

  @media (max-width: ${theme.breakpoints.md}) {
    margin-bottom: ${theme.space[2]};
  }
`;

const ContentText = styled.pre`
  font-family: ${theme.fonts.mono};
  font-size: calc(${theme.fontSizes.bodyLg} * var(--performance-font-scale, 1));
  color: var(--color-text-primary);
  line-height: ${theme.lineHeights.loose};
  white-space: pre-wrap;
  margin: 0;

  @media (max-width: ${theme.breakpoints.md}) {
    font-size: calc(${theme.fontSizes.body} * var(--performance-font-scale, 1));
  }
`;

const EmptyContent = styled.div`
  text-align: center;
  padding: ${theme.space[12]} ${theme.space[6]};
  color: var(--color-text-tertiary);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${theme.space[4]};

  i {
    font-size: ${theme.fontSizes.displayLg};
    margin-bottom: 0;
    opacity: 0.5;
  }

  p {
    font-size: ${theme.fontSizes.bodyLg};
    margin: 0;
  }
`;

const AddPdfButton = styled.button`
  background: ${theme.colors.brand.primary};
  border: none;
  color: white;
  padding: ${theme.space[3]} ${theme.space[5]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[2]};
  transition: all ${theme.transitions.fast} ease;

  &:hover {
    background: ${theme.colors.brand.primaryHover};
  }

  i {
    font-size: ${theme.fontSizes.body};
    margin-bottom: 0;
    opacity: 1;
  }
`;

const AddPdfModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: ${theme.zIndex.modal};
  padding: ${theme.space[4]};
  animation: fadeIn 0.2s ease;

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

const AddPdfModalContainer = styled.div`
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.lg};
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: var(--shadow-xl);
`;

const AddPdfModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${theme.space[4]} ${theme.space[5]};
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
`;

const AddPdfModalTitle = styled.h2`
  margin: 0;
  font-size: ${theme.fontSizes.h4};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};

  i {
    color: ${theme.colors.brand.primary};
  }
`;

const AddPdfModalCloseButton = styled.button`
  background: transparent;
  border: none;
  color: var(--color-text-tertiary);
  width: 36px;
  height: 36px;
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  &:hover {
    background: var(--color-bg-elevated);
    color: var(--color-text-primary);
  }
`;

const AddPdfModalBody = styled.div`
  padding: ${theme.space[5]};
  overflow-y: auto;
`;

const BottomNav = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[6]};
  padding: ${theme.space[4]} ${theme.space[6]};
  background: var(--color-bg-secondary);
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;

  @media (max-width: ${theme.breakpoints.md}) {
    gap: ${theme.space[3]};
    padding: ${theme.space[3]} ${theme.space[4]};
  }
`;

const NavButton = styled.button`
  background: ${theme.colors.brand.primary};
  border: none;
  color: white;
  padding: ${theme.space[3]} ${theme.space[6]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  min-width: 120px;
  justify-content: center;

  i {
    font-size: ${theme.fontSizes.bodyLg};
  }

  &:hover:not(:disabled) {
    background: ${theme.colors.brand.primaryHover};
    transform: translateY(-1px);
  }

  &:disabled {
    background: var(--color-bg-elevated);
    color: var(--color-text-disabled);
    cursor: not-allowed;
    opacity: 0.5;
  }

  @media (max-width: ${theme.breakpoints.md}) {
    min-width: 100px;
    padding: ${theme.space[2]} ${theme.space[4]};
    font-size: ${theme.fontSizes.bodySm};

    span {
      display: none;
    }
  }
`;

const NavCenter = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${theme.space[2]};
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 8px;
  background: var(--color-bg-tertiary);
  border-radius: ${theme.radius.full};
  overflow: hidden;
`;

const ProgressFill = styled.div<{ $percent: number }>`
  width: ${(props) => props.$percent}%;
  height: 100%;
  background: ${theme.gradients.brandPrimary};
  transition: width ${theme.transitions.base} ease;
`;

const KeyboardHint = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-tertiary);
  text-align: center;

  @media (max-width: ${theme.breakpoints.md}) {
    display: none;
  }
`;

const LoadingContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--color-bg-primary);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${theme.space[4]};
`;

const LoadingText = styled.p`
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-secondary);
  margin: 0;
`;

const ErrorContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--color-bg-primary);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${theme.space[4]};
  padding: ${theme.space[6]};
  text-align: center;
`;

const ErrorIcon = styled.div`
  font-size: ${theme.fontSizes.displayLg};
  color: ${theme.colors.semantic.error};
  opacity: 0.8;
`;

const ErrorTitle = styled.h2`
  font-size: ${theme.fontSizes.h2};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin: 0;
`;

const ErrorText = styled.p`
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-secondary);
  margin: 0;
`;

const BackButton = styled.button`
  background: ${theme.colors.brand.primary};
  border: none;
  color: white;
  padding: ${theme.space[3]} ${theme.space[6]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  margin-top: ${theme.space[6]};

  &:hover {
    background: ${theme.colors.brand.primaryHover};
    transform: translateY(-1px);
  }
`;

const MobileToggleButton = styled.button<{ $contentType: "chords" | "lyrics" | "sheetMusic" }>`
  position: fixed;
  bottom: 120px;
  right: ${theme.space[4]};
  width: 64px;
  height: 64px;
  border-radius: ${theme.radius.full};
  background: ${(props) =>
    props.$contentType === "chords"
      ? theme.colors.brand.primary
      : props.$contentType === "sheetMusic"
      ? theme.colors.accent.amber
      : theme.colors.semantic.info};
  border: none;
  color: white;
  display: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${theme.space[1]};
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  transition: all ${theme.transitions.fast} ease;
  z-index: 10;

  i {
    font-size: ${theme.fontSizes.h3};
  }

  &:active {
    transform: scale(0.95);
  }

  @media (max-width: ${theme.breakpoints.md}) {
    display: flex;
  }
`;

const MobileToggleLabel = styled.span`
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.semibold};
  text-transform: uppercase;
  letter-spacing: ${theme.letterSpacing.wide};
`;

// Special item styled components for sidebar
const SpecialListItem = styled.button<{ $active: boolean; $type: string; $isDragging?: boolean }>`
  width: 100%;
  background: ${(props) =>
    props.$isDragging
      ? 'var(--color-bg-elevated)'
      : props.$active
      ? theme.colors.brand.primary
      : "transparent"};
  border: 1px solid ${(props) =>
    props.$isDragging || props.$active ? theme.colors.brand.primary : 'var(--color-border)'};
  border-left: 3px solid ${(props) => {
    switch (props.$type) {
      case "break":
        return theme.colors.semantic.warning;
      case "section":
        return theme.colors.semantic.info;
      case "note":
        return theme.colors.semantic.success;
      default:
        return 'var(--color-border)';
    }
  }};
  color: ${(props) =>
    props.$active ? "white" : 'var(--color-text-primary)'};
  padding: ${theme.space[3]};
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  margin-bottom: ${theme.space[2]};
  text-align: left;
  opacity: ${(props) => (props.$isDragging ? 0.9 : 1)};
  box-shadow: ${(props) => (props.$isDragging ? theme.shadows.lg : "none")};
  z-index: ${(props) => (props.$isDragging ? 10 : "auto")};

  &:hover {
    background: ${(props) =>
      props.$active ? theme.colors.brand.primaryHover : 'var(--color-bg-elevated)'};
    border-color: ${theme.colors.brand.primary};
  }
`;

const SpecialListIcon = styled.div<{ $type: string }>`
  width: 28px;
  height: 28px;
  border-radius: ${theme.radius.sm};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${theme.fontSizes.body};
  flex-shrink: 0;
  background: ${(props) => {
    switch (props.$type) {
      case "break":
        return theme.colors.semantic.warningBgDark;
      case "section":
        return theme.colors.semantic.infoBgDark;
      case "note":
        return theme.colors.semantic.successBgDark;
      default:
        return 'var(--color-bg-tertiary)';
    }
  }};
  color: ${(props) => {
    switch (props.$type) {
      case "break":
        return theme.colors.semantic.warning;
      case "section":
        return theme.colors.semantic.info;
      case "note":
        return theme.colors.semantic.success;
      default:
        return 'var(--color-text-secondary)';
    }
  }};
`;

// Special item display (main content area)
const SpecialItemDisplay = styled.div<{ $type: string }>`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${theme.space[6]};
  text-align: center;
  padding: ${theme.space[8]};
  background: ${(props) => {
    switch (props.$type) {
      case "break":
        return theme.colors.semantic.warningBgDark;
      case "section":
        return theme.colors.semantic.infoBgDark;
      case "note":
        return theme.colors.semantic.successBgDark;
      default:
        return 'var(--color-bg-secondary)';
    }
  }};
  border: 1px solid ${(props) => {
    switch (props.$type) {
      case "break":
        return theme.colors.semantic.warning;
      case "section":
        return theme.colors.semantic.info;
      case "note":
        return theme.colors.semantic.success;
      default:
        return 'var(--color-border)';
    }
  }};
  border-radius: ${theme.radius.lg};
  margin-bottom: ${theme.space[6]};
`;

const SpecialItemIconLarge = styled.div<{ $type: string }>`
  width: 120px;
  height: 120px;
  border-radius: ${theme.radius.full};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${theme.fontSizes.displayLg};
  background: ${(props) => {
    switch (props.$type) {
      case "break":
        return `${theme.colors.semantic.warning}30`;
      case "section":
        return `${theme.colors.semantic.info}30`;
      case "note":
        return `${theme.colors.semantic.success}30`;
      default:
        return 'var(--color-bg-tertiary)';
    }
  }};
  color: ${(props) => {
    switch (props.$type) {
      case "break":
        return theme.colors.semantic.warning;
      case "section":
        return theme.colors.semantic.info;
      case "note":
        return theme.colors.semantic.success;
      default:
        return 'var(--color-text-secondary)';
    }
  }};

  i {
    font-size: 3rem;
  }

  @media (max-width: ${theme.breakpoints.md}) {
    width: 80px;
    height: 80px;

    i {
      font-size: 2rem;
    }
  }
`;

const SpecialItemTypeBadge = styled.div<{ $type: string }>`
  display: inline-block;
  padding: ${theme.space[2]} ${theme.space[4]};
  border-radius: ${theme.radius.full};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  text-transform: uppercase;
  letter-spacing: ${theme.letterSpacing.wide};
  background: ${(props) => {
    switch (props.$type) {
      case "break":
        return theme.colors.semantic.warning;
      case "section":
        return theme.colors.semantic.info;
      case "note":
        return theme.colors.semantic.success;
      default:
        return 'var(--color-bg-tertiary)';
    }
  }};
  color: var(--color-bg-primary);
`;

const SpecialItemLabelLarge = styled.div`
  font-size: ${theme.fontSizes.displayMd};
  font-weight: ${theme.fontWeights.bold};
  color: var(--color-text-primary);
  line-height: ${theme.lineHeights.tight};

  @media (max-width: ${theme.breakpoints.md}) {
    font-size: ${theme.fontSizes.h1};
  }
`;

const SpecialItemDurationLarge = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  font-size: ${theme.fontSizes.h3};
  color: var(--color-text-secondary);

  i {
    color: ${theme.colors.semantic.warning};
  }
`;

// Up Next indicator
const UpNextBar = styled.div<{ $type: string }>`
  display: flex;
  align-items: center;
  gap: ${theme.space[4]};
  padding: ${theme.space[4]} ${theme.space[5]};
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-left: 3px solid ${(props) => {
    switch (props.$type) {
      case "song":
        return theme.colors.brand.primary;
      case "break":
        return theme.colors.semantic.warning;
      case "section":
        return theme.colors.semantic.info;
      case "note":
        return theme.colors.semantic.success;
      case "end":
        return theme.colors.semantic.error;
      default:
        return 'var(--color-border)';
    }
  }};
  border-radius: ${theme.radius.base};
  margin-top: auto;
`;

const UpNextLabel = styled.span`
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: ${theme.letterSpacing.wide};
`;

const UpNextContent = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  color: var(--color-text-primary);
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.medium};

  i {
    color: ${theme.colors.brand.primary};
  }
`;

const UpNextText = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export default SetlistPerformanceView;
