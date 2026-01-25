import type { FC } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
import { getSetlist, updateSetlist, isSongItem, isBreakItem, isSectionItem } from "../services/setlistsService";
import type { Setlist, SetlistItem } from "../services/setlistsService";
import { getBandSongs } from "../services/songsService";
import type { Song } from "../services/songsService";
import { SEO } from "./SEO";
import { useTranslation } from "react-i18next";
import { SyncControls } from "./SyncControls";
import { usePerformanceSync } from "../hooks/usePerformanceSync";
import { useLocalBackingTracks } from "../hooks/useLocalBackingTracks";
import { BackingTrackPlayer } from "./BackingTrackPlayer";
import { SyncedLyricsDisplay } from "./SyncedLyricsDisplay";
import SheetMusicViewer from "./SheetMusicViewer";
import { getSheetMusicUrl } from "../services/sheetMusicStorageService";
import {
  getSheetMusicForSong,
  type SheetMusic,
  getInstrumentIcon,
} from "../services/songSheetMusicService";

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

const SetlistPerformanceView: FC = () => {
  const { setlistId } = useParams<{ setlistId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [setlistItems, setSetlistItems] = useState<SetlistItem[]>([]);
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSongList, setShowSongList] = useState(false);
  const [contentView, setContentView] = useState<"chords" | "lyrics" | "sheetMusic">("chords");
  const [sheetMusicList, setSheetMusicList] = useState<SheetMusic[]>([]);
  const [selectedSheetMusicId, setSelectedSheetMusicId] = useState<string | null>(null);
  const [sheetMusicUrl, setSheetMusicUrl] = useState<string | null>(null);
  const [sheetMusicLoading, setSheetMusicLoading] = useState(false);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const songListRef = useRef<HTMLDivElement>(null);

  // Helper to get song by ID
  const getSongById = (songId: string): Song | undefined => {
    return allSongs.find((s) => s.id === songId);
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
  }, []);

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
  });

  // Local backing tracks hook
  const {
    loadTrack,
    removeTrack,
    getTrackUrl,
    getTrackInfo,
    hadTrackPreviously,
  } = useLocalBackingTracks(setlistId || "");

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
      // Only reorder song items
      const songItems = setlistItems.filter(isSongItem);
      const oldIndex = songItems.findIndex((item) => getSongById(item.song_id)?.id === active.id);
      const newIndex = songItems.findIndex((item) => getSongById(item.song_id)?.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newSongItems = arrayMove(songItems, oldIndex, newIndex);

        // Rebuild setlistItems maintaining special items in their positions
        // For simplicity, just update song order - positions will be recalculated on save
        const nonSongItems = setlistItems.filter((item) => !isSongItem(item));
        const newItems: SetlistItem[] = newSongItems.map((item, index) => ({
          ...item,
          position: index,
        }));

        // Append non-song items at the end (simplified for reorder mode)
        nonSongItems.forEach((item, index) => {
          newItems.push({ ...item, position: newSongItems.length + index });
        });

        setSetlistItems(newItems);
      }
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

      await updateSetlist(setlist.id, { songs: updatedItems });

      setSetlist({
        ...setlist,
        songs: updatedItems,
      });

      setSetlistItems(updatedItems);
      setIsReorderMode(false);
    } catch (error) {
      console.error("Failed to save order:", error);
      alert("Failed to save order. Please try again.");
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

  const toggleReorderMode = () => {
    if (isReorderMode) {
      handleCancelReorder();
    } else {
      setShowSongList(true);
      setIsReorderMode(true);
    }
  };

  useEffect(() => {
    if (!setlistId) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const setlistData = await getSetlist(setlistId);
        setSetlist(setlistData);

        // Load all songs for the band
        const songsData = await getBandSongs(setlistData.band_id);
        setAllSongs(songsData);

        // Store all items in order (songs and special items)
        const orderedItems = [...(setlistData.songs || [])].sort((a, b) => a.position - b.position);
        setSetlistItems(orderedItems);
      } catch (error) {
        console.error("Failed to load setlist:", error);
        alert("Failed to load setlist. Please try again.");
        navigate("/setlists");
      }
      setLoading(false);
    };

    loadData();
  }, [setlistId, navigate]);

  useEffect(() => {
    // Keyboard navigation
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        handleNextSong();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        handlePrevSong();
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (isFullscreen) {
          exitFullscreen();
        } else {
          navigate("/setlists");
        }
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        setShowSongList((prev) => !prev);
      } else if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        toggleContentView();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, setlistItems.length, isFullscreen, navigate]);

  // Scroll to top and reset audio time when song changes
  useEffect(() => {
    const songDisplay = document.querySelector('[data-song-display]');
    if (songDisplay) {
      songDisplay.scrollTop = 0;
    }
    // Reset audio tracking state
    setAudioCurrentTime(0);
    setIsAudioPlaying(false);
  }, [currentIndex]);

  // Auto-scroll to active song when song list opens
  useEffect(() => {
    if (showSongList && songListRef.current) {
      const activeItem = songListRef.current.querySelector('[data-active="true"]');
      if (activeItem) {
        activeItem.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
  }, [showSongList]);

  // Load sheet music list when song changes
  useEffect(() => {
    const loadSheetMusicList = async () => {
      // Get current song from state
      const currentItem = setlistItems[currentIndex];
      const isItemSong = currentItem && isSongItem(currentItem);
      const songForItem = isItemSong ? allSongs.find((s) => s.id === currentItem.song_id) : null;

      if (!songForItem) {
        setSheetMusicList([]);
        setSelectedSheetMusicId(null);
        setSheetMusicUrl(null);
        return;
      }

      try {
        const list = await getSheetMusicForSong(songForItem.id);
        setSheetMusicList(list);
        // Always select first sheet music when song changes
        if (list.length > 0) {
          setSelectedSheetMusicId(list[0].id);
        } else {
          setSelectedSheetMusicId(null);
        }
      } catch (err) {
        console.error("Failed to load sheet music list:", err);
        setSheetMusicList([]);
        setSelectedSheetMusicId(null);
      }
    };

    loadSheetMusicList();
  }, [currentIndex, setlistItems, allSongs]);

  // Load sheet music URL when selected sheet music changes
  useEffect(() => {
    const loadSheetMusicUrl = async () => {
      const selectedSheetMusic = sheetMusicList.find((sm) => sm.id === selectedSheetMusicId);

      if (!selectedSheetMusic?.file_url) {
        setSheetMusicUrl(null);
        return;
      }

      setSheetMusicLoading(true);
      try {
        const url = await getSheetMusicUrl(selectedSheetMusic.file_url);
        setSheetMusicUrl(url);
      } catch (err) {
        console.error("Failed to load sheet music URL:", err);
        setSheetMusicUrl(null);
      } finally {
        setSheetMusicLoading(false);
      }
    };

    loadSheetMusicUrl();
  }, [selectedSheetMusicId, sheetMusicList]);

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

  const toggleContentView = useCallback(() => {
    setContentView((prev) => {
      if (prev === "chords") return "lyrics";
      // Will check for sheet music in the toggle - if no sheet music, go back to chords
      if (prev === "lyrics") return "sheetMusic";
      return "chords";
    });
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

  if (loading) {
    return (
      <LoadingContainer>
        <Spinner color="primary" style={{ width: "3rem", height: "3rem" }} />
        <LoadingText>Loading performance view...</LoadingText>
      </LoadingContainer>
    );
  }

  if (!setlist || setlistItems.length === 0) {
    return (
      <ErrorContainer>
        <ErrorIcon>
          <i className="bi bi-exclamation-triangle"></i>
        </ErrorIcon>
        <ErrorTitle>Unable to Load Setlist</ErrorTitle>
        <ErrorText>
          {!setlist ? "Setlist not found" : "No songs in this setlist"}
        </ErrorText>
        <BackButton onClick={() => navigate("/setlists")}>
          <i className="bi bi-arrow-left"></i>
          Back to Setlists
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

  // Get only song items for sidebar display
  const songItemsOnly = setlistItems.filter(isSongItem);
  const songsForSidebar = songItemsOnly
    .map((item) => getSongById(item.song_id))
    .filter((song): song is Song => song !== undefined);

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
        description={`Performance mode for ${setlist.name}. Fullscreen lyrics and chords view for live performances with ${songItemsOnly.length} songs.`}
      />
      {/* Top Bar */}
      <TopBar>
        <TopBarRow>
          <TopBarLeft>
            <ExitButton onClick={() => navigate("/setlists")} title="Exit (ESC)">
              <i className="bi bi-x-lg"></i>
            </ExitButton>
            <SetlistInfo>
              <SetlistName>{setlist.name}</SetlistName>
            </SetlistInfo>
          </TopBarLeft>

          <SongCounter>
            {currentIndex + 1} / {setlistItems.length}
          </SongCounter>
        </TopBarRow>

        <TopBarControls>
          {isReorderMode ? (
            <ReorderActions>
              <ReorderActionButton onClick={handleCancelReorder} $variant="cancel" disabled={saving}>
                <i className="bi bi-x-lg"></i>
                Cancel
              </ReorderActionButton>
              <ReorderActionButton onClick={handleSaveOrder} $variant="save" disabled={saving}>
                {saving ? (
                  <>
                    <Spinner size="sm" style={{ marginRight: "4px" }} />
                    Saving...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-lg"></i>
                    Save
                  </>
                )}
              </ReorderActionButton>
            </ReorderActions>
          ) : (
            <>
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
              />
              <ViewToggleGroup>
                <ViewToggleButton
                  onClick={() => setContentView("chords")}
                  $active={contentView === "chords"}
                  title={t("performance.showChords", "Show Chords")}
                >
                  <i className="bi bi-music-note"></i>
                  {t("performance.chords", "Chords")}
                </ViewToggleButton>
                <ViewToggleButton
                  onClick={() => setContentView("lyrics")}
                  $active={contentView === "lyrics"}
                  title={t("performance.showLyrics", "Show Lyrics")}
                >
                  <i className="bi bi-mic"></i>
                  {t("performance.lyrics", "Lyrics")}
                </ViewToggleButton>
                {sheetMusicList.length > 0 && (
                  <ViewToggleButton
                    onClick={() => setContentView("sheetMusic")}
                    $active={contentView === "sheetMusic"}
                    title={t("performance.showSheetMusic", "Show Sheet Music")}
                  >
                    <i className="bi bi-file-earmark-music"></i>
                    {t("performance.sheetMusic", "Sheet")}
                  </ViewToggleButton>
                )}
              </ViewToggleGroup>
              <IconButton
                onClick={toggleReorderMode}
                title="Reorder Songs (R)"
                $active={false}
                disabled={songsForSidebar.length < 2 || syncRole === "viewer"}
              >
                <i className="bi bi-arrow-down-up"></i>
              </IconButton>
              <IconButton
                onClick={() => setShowSongList(!showSongList)}
                title="Song List (L)"
                $active={showSongList}
              >
                <i className="bi bi-list-ul"></i>
              </IconButton>
              <IconButton onClick={toggleFullscreen} title="Fullscreen (F)">
                <i className={`bi bi-${isFullscreen ? "fullscreen-exit" : "arrows-fullscreen"}`}></i>
              </IconButton>
            </>
          )}
        </TopBarControls>
      </TopBar>

      {/* Main Content Area */}
      <MainContent>
        {/* Song List Sidebar */}
        {showSongList && (
          <>
          <SongListBackdrop onClick={() => setShowSongList(false)} />
          <SongListSidebar>
            <SidebarHeader>
              {isReorderMode ? "Reorder Songs" : "Setlist"}
              {isReorderMode && (
                <SidebarHint>Drag to reorder</SidebarHint>
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
                    items={songsForSidebar.map((s) => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {songsForSidebar.map((song, index) => (
                      <SortableSongListItem
                        key={song.id}
                        song={song}
                        index={index}
                        isActive={false}
                        onClick={() => {}}
                      />
                    ))}
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
                            <SongListArtist>{item.duration} min</SongListArtist>
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
                <SongTitleLarge>{currentSong.title}</SongTitleLarge>
                {currentSong.artist && <SongArtistLarge>{currentSong.artist}</SongArtistLarge>}

                <SongMetadataBar>
                  {currentSong.key && (
                    <MetaBadgeLarge>
                      <i className="bi bi-music-note-beamed"></i>
                      Key: {currentSong.key}
                    </MetaBadgeLarge>
                  )}
                  {currentSong.tempo && (
                    <MetaBadgeLarge>
                      <i className="bi bi-speedometer2"></i>
                      {currentSong.tempo} BPM
                    </MetaBadgeLarge>
                  )}
                  {currentSong.duration && (
                    <MetaBadgeLarge>
                      <i className="bi bi-clock"></i>
                      {formatDuration(currentSong.duration)}
                    </MetaBadgeLarge>
                  )}
                </SongMetadataBar>

                {currentNotes && (
                  <NotesBox>
                    <NotesLabel>
                      <i className="bi bi-sticky"></i>
                      Notes:
                    </NotesLabel>
                    <NotesText>{currentNotes}</NotesText>
                  </NotesBox>
                )}

                {/* Backing Track Player - only visible to host or when not in sync mode */}
                {(syncRole === "host" || syncRole === null) && (
                  <BackingTrackPlayer
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
                )}
              </SongHeader>

              <SongContent $fullHeight={contentView === "sheetMusic"}>
                {contentView === "sheetMusic" && sheetMusicList.length > 0 ? (
                  <SheetMusicWrapper>
                    {/* Sheet Music Selector - only show if multiple exist */}
                    {sheetMusicList.length > 1 && (
                      <SheetMusicSelector>
                        {sheetMusicList.map((sm) => (
                          <SheetMusicSelectorItem
                            key={sm.id}
                            $active={sm.id === selectedSheetMusicId}
                            onClick={() => setSelectedSheetMusicId(sm.id)}
                          >
                            <i className={getInstrumentIcon(sm.instrument)} />
                            <span>{sm.name}</span>
                          </SheetMusicSelectorItem>
                        ))}
                      </SheetMusicSelector>
                    )}
                    {sheetMusicLoading ? (
                      <EmptyContent>
                        <i className="bi bi-hourglass-split"></i>
                        <p>{t("sheetMusic.loading", "Loading sheet music...")}</p>
                      </EmptyContent>
                    ) : sheetMusicUrl ? (
                      <SheetMusicViewer
                        pdfUrl={sheetMusicUrl}
                        pageTimings={sheetMusicList.find((sm) => sm.id === selectedSheetMusicId)?.page_timings}
                        currentTime={displayAudioTime}
                        isPlaying={displayIsPlaying}
                      />
                    ) : (
                      <EmptyContent>
                        <i className="bi bi-file-earmark-x"></i>
                        <p>{t("sheetMusic.loadError", "Failed to load sheet music")}</p>
                      </EmptyContent>
                    )}
                  </SheetMusicWrapper>
                ) : displayContent.type !== "none" && (displaySections.length > 0 || currentSong.timing_data?.lineTimings?.length) ? (
                  <SyncedLyricsDisplay
                    content={displayContent.content}
                    contentType={displayContent.type}
                    sections={displaySections}
                    lineTimings={currentSong.timing_data?.lineTimings}
                    currentTime={displayAudioTime}
                    isPlaying={displayIsPlaying}
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
                        <p>No chords or lyrics available for this song</p>
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

          {/* Up Next Indicator */}
          {nextItemInfo && (
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

      {/* Bottom Navigation */}
      <BottomNav>
        <NavButton
          onClick={handlePrevSong}
          disabled={currentIndex === 0 || syncRole === "viewer"}
        >
          <i className="bi bi-chevron-left"></i>
          <span>Previous</span>
        </NavButton>

        <NavCenter>
          <ProgressBar>
            <ProgressFill $percent={((currentIndex + 1) / setlistItems.length) * 100} />
          </ProgressBar>
          <KeyboardHint>
            {syncRole === "viewer"
              ? "Following host • ESC to exit • F for fullscreen • L for list"
              : "Use arrow keys or click to navigate • ESC to exit • F for fullscreen • L for list • T to toggle view"}
          </KeyboardHint>
        </NavCenter>

        <NavButton
          onClick={handleNextSong}
          disabled={currentIndex === setlistItems.length - 1 || syncRole === "viewer"}
        >
          <span>Next</span>
          <i className="bi bi-chevron-right"></i>
        </NavButton>
      </BottomNav>

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
  overflow-y: ${({ $isSheetMusic }) => ($isSheetMusic ? "hidden" : "auto")};
  min-height: 0;
  padding: ${({ $isSheetMusic }) => ($isSheetMusic ? `${theme.space[4]} ${theme.space[4]}` : `${theme.space[8]} ${theme.space[10]}`)};

  @media (max-width: ${theme.breakpoints.lg}) {
    padding: ${({ $isSheetMusic }) => ($isSheetMusic ? `${theme.space[3]} ${theme.space[3]}` : `${theme.space[6]} ${theme.space[6]}`)};
  }

  @media (max-width: ${theme.breakpoints.md}) {
    padding: ${({ $isSheetMusic }) => ($isSheetMusic ? `${theme.space[2]} ${theme.space[2]}` : `${theme.space[4]} ${theme.space[4]}`)};
  }
`;

const SongHeader = styled.div<{ $compact?: boolean }>`
  margin-bottom: ${({ $compact }) => ($compact ? theme.space[3] : theme.space[8])};
  flex-shrink: 0;

  @media (max-width: ${theme.breakpoints.md}) {
    margin-bottom: ${({ $compact }) => ($compact ? theme.space[2] : theme.space[4])};
  }
`;

const SongTitleLarge = styled.h1`
  font-size: ${theme.fontSizes.displayLg};
  font-weight: ${theme.fontWeights.bold};
  color: var(--color-text-primary);
  margin: 0 0 ${theme.space[3]} 0;
  line-height: ${theme.lineHeights.tight};

  @media (max-width: ${theme.breakpoints.md}) {
    font-size: ${theme.fontSizes.displayMd};
  }
`;

const SongArtistLarge = styled.div`
  font-size: ${theme.fontSizes.h2};
  color: var(--color-text-secondary);
  margin-bottom: ${theme.space[6]};

  @media (max-width: ${theme.breakpoints.md}) {
    font-size: ${theme.fontSizes.h3};
  }
`;

const SongMetadataBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${theme.space[3]};
  margin-bottom: ${theme.space[6]};
`;

const MetaBadgeLarge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[2]};
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  padding: ${theme.space[3]} ${theme.space[5]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodyLg};
  font-weight: ${theme.fontWeights.medium};

  i {
    font-size: ${theme.fontSizes.h4};
    color: ${theme.colors.brand.primary};
  }
`;

const NotesBox = styled.div`
  background: ${theme.colors.semantic.warningBgDark};
  border: 1px solid ${theme.colors.semantic.warning};
  border-radius: ${theme.radius.base};
  padding: ${theme.space[4]} ${theme.space[5]};
  margin-top: ${theme.space[4]};
`;

const NotesLabel = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.semantic.warning};
  margin-bottom: ${theme.space[2]};

  i {
    font-size: ${theme.fontSizes.bodyLg};
  }
`;

const NotesText = styled.div`
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-primary);
  line-height: ${theme.lineHeights.relaxed};
  white-space: pre-wrap;
`;

const SongContent = styled.div<{ $fullHeight?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[8]};
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
`;

const SheetMusicSelector = styled.div`
  display: flex;
  gap: ${theme.space[2]};
  flex-wrap: wrap;
  padding: ${theme.space[2]};
  background: ${theme.colors.dark.bg.secondary};
  border: 1px solid ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.base};
  margin-bottom: ${theme.space[4]};
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

  &:hover {
    background: ${(props) =>
      props.$active ? theme.colors.brand.primaryHover : theme.colors.dark.bg.elevated};
    border-color: ${theme.colors.brand.primary};
  }
`;

const ContentSection = styled.div`
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.lg};
  padding: ${theme.space[6]};
`;

const SectionLabel = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  font-size: ${theme.fontSizes.h3};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.brand.primary};
  margin-bottom: ${theme.space[5]};

  i {
    font-size: ${theme.fontSizes.h2};
  }
`;

const ContentText = styled.pre`
  font-family: ${theme.fonts.mono};
  font-size: ${theme.fontSizes.bodyLg};
  color: var(--color-text-primary);
  line-height: ${theme.lineHeights.loose};
  white-space: pre-wrap;
  margin: 0;

  @media (max-width: ${theme.breakpoints.md}) {
    font-size: ${theme.fontSizes.body};
  }
`;

const EmptyContent = styled.div`
  text-align: center;
  padding: ${theme.space[12]} ${theme.space[6]};
  color: var(--color-text-tertiary);

  i {
    font-size: ${theme.fontSizes.displayLg};
    margin-bottom: ${theme.space[4]};
    opacity: 0.5;
  }

  p {
    font-size: ${theme.fontSizes.bodyLg};
    margin: 0;
  }
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
const SpecialListItem = styled.button<{ $active: boolean; $type: string }>`
  width: 100%;
  background: ${(props) =>
    props.$active ? theme.colors.brand.primary : "transparent"};
  border: 1px solid ${(props) =>
    props.$active ? theme.colors.brand.primary : 'var(--color-border)'};
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
