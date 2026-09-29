import type { FC } from "react";
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Container, Spinner, Modal, ModalHeader, ModalBody, ModalFooter, Button, FormGroup, Input } from "reactstrap";
import styled from "styled-components";
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { theme } from "../theme";
import {
  getSetlist,
  updateSetlist,
  updateSetlistYouTubePlaylist,
  isSongItem,
  isBreakItem,
  isSectionItem,
  getSetlistItemKey,
} from "../services/setlistsService";
import type { Setlist, SetlistItem, SetlistBreakItem, SetlistSectionItem, SetlistNoteItem } from "../services/setlistsService";
import { getBandSongs, updateSong } from "../services/songsService";
import type { Song, UpdateSongInput } from "../services/songsService";
import { optimizeSetlistOrder, type SetlistOptimization } from "../services/aiSetlistService";
import { groqService, GroqApiError } from "../services/groqService";
import { getShowsBySetlistId, getUpcomingShowsWithoutSetlist, updateShow } from "../services/showsService";
import type { Show } from "../services/showsService";
import { SEO } from "./SEO";
import { NewRequestModal } from "./NewRequestModal";
import { EditSetlistModal } from "./EditSetlistModal";
import { EditSongModal } from "./EditSongModal";
import { SetlistTextExportModal } from "./SetlistTextExportModal";
import { useTranslation } from "react-i18next";
import { youtubeService, type PlaylistCreationResult } from "../services/youtubeService";
import { useBandContext } from "../context/useBandContext";
import { isNetworkError } from "../lib/networkErrors";
import { useToast } from "../context/useToast";
import { OfflineStatusRow } from "./offline/OfflineDownloadAction";
import { OfflineSetlistDetail } from "./offline/OfflineSetlistDetail";
import { getSnapshotMeta } from "../services/offlineSetlistService";
import { isPermissionDenied } from "../services/permissionError";
import { canEditContent, canManageEvents } from "../services/bandMembersService";
import { SetlistHeaderActions } from "./setlist/SetlistHeaderActions";
import { ReorderToolbar } from "./setlist/ReorderToolbar";
import { SetlistRowMenu } from "./setlist-builder/SetlistRowMenu";
import { useSortableSensors } from "../hooks/useSortableSensors";
import { useOfflineUpdateCheckOnOpen } from "../hooks/useOfflineUpdateCheck";
import { moveItem, type MoveTarget } from "../utils/setlistMove";

// Forward declare styled components used in SortableSongCard
const SongCard = styled.div<{ $isDragging?: boolean }>`
  position: relative;
  background: ${(props) =>
    props.$isDragging ? 'var(--color-bg-elevated)' : 'var(--color-bg-secondary)'};
  border: 1px solid ${(props) =>
    props.$isDragging ? theme.colors.brand.primary : 'var(--color-border)'};
  border-radius: ${theme.radius.lg};
  padding: ${theme.space[4]};
  display: flex;
  align-items: flex-start;
  gap: ${theme.space[4]};
  transition: all ${theme.transitions.fast} ease;
  opacity: ${(props) => (props.$isDragging ? 0.9 : 1)};
  box-shadow: ${(props) => (props.$isDragging ? theme.shadows.lg : "none")};
  z-index: ${(props) => (props.$isDragging ? 10 : "auto")};

  &:hover {
    border-color: ${theme.colors.brand.primary};
    box-shadow: var(--shadow-sm);
  }

  @media (max-width: ${theme.breakpoints.md}) {
    flex-direction: column;
    gap: ${theme.space[3]};
  }
`;

const DragHandle = styled.button`
  background: transparent;
  border: none;
  color: var(--color-text-tertiary);
  width: 24px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  transition: all ${theme.transitions.fast} ease;
  flex-shrink: 0;
  font-size: ${theme.fontSizes.h3};
  padding: 0;
  /* Long-press drags on touch: no scrolling, text selection or callout. */
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;

  @media (pointer: coarse) {
    width: 36px;
    height: 44px;
  }

  &:hover {
    color: ${theme.colors.brand.primary};
  }

  &:active {
    cursor: grabbing;
    color: ${theme.colors.brand.primary};
  }
`;

/** The row menu, at the row's end; top-right where the card stacks (< md). */
const RowMenuSlot = styled.div`
  margin-left: auto;
  flex-shrink: 0;
  align-self: flex-start;

  @media (max-width: ${theme.breakpoints.md}) {
    position: absolute;
    top: ${theme.space[3]};
    right: ${theme.space[3]};
  }
`;

const SongPositionWrapper = styled.div`
  position: relative;
  flex-shrink: 0;
`;

const SongPosition = styled.div`
  width: 36px;
  height: 36px;
  background: ${theme.gradients.brandPrimary};
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.bold};
  color: white;
  flex-shrink: 0;
`;

const BackingTracksBadge = styled.div`
  position: absolute;
  bottom: -4px;
  right: -4px;
  width: 20px;
  height: 20px;
  background: ${theme.colors.semantic.success};
  border: 2px solid var(--color-bg-secondary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 10px;
  box-shadow: var(--shadow-sm);
  transition: all ${theme.transitions.fast} ease;
  cursor: help;

  ${SongCard}:hover & {
    transform: scale(1.1);
  }
`;

const SongInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const SongTitle = styled.div`
  font-size: ${theme.fontSizes.bodyLg};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin-bottom: ${theme.space[1]};
`;

const SongArtist = styled.div`
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-secondary);
  margin-bottom: ${theme.space[2]};
`;

const SongNotes = styled.div`
  background: ${theme.colors.semantic.warningBgDark};
  border: 1px solid ${theme.colors.semantic.warning};
  border-radius: ${theme.radius.sm};
  padding: ${theme.space[2]} ${theme.space[3]};
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-primary);
  display: flex;
  align-items: flex-start;
  gap: ${theme.space[2]};
  margin-top: ${theme.space[2]};
`;

const NotesIcon = styled.div`
  color: ${theme.colors.semantic.warning};
  font-size: ${theme.fontSizes.body};
  flex-shrink: 0;
  margin-top: 2px;
`;

const SongMetadata = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${theme.space[2]};
  align-items: center;

  @media (max-width: ${theme.breakpoints.md}) {
    width: 100%;
  }
`;

const MetaBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[1]};
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  padding: ${theme.space[1]} ${theme.space[2]};
  border-radius: ${theme.radius.sm};
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.medium};
  white-space: nowrap;

  i {
    font-size: ${theme.fontSizes.bodySm};
    color: ${theme.colors.brand.primary};
  }
`;

const SongActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  flex-shrink: 0;

  @media (max-width: ${theme.breakpoints.md}) {
    width: 100%;
    justify-content: flex-end;
  }
`;

const EditSongButton = styled.button`
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  width: 36px;
  height: 36px;
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  padding: 0;

  &:hover {
    border-color: ${theme.colors.brand.primary};
    color: ${theme.colors.brand.primary};
    background: var(--color-bg-tertiary);
  }
`;

// Opens performance mode on this song (`?song=`).
const PerformFromHereButton = styled(EditSongButton)`
  font-size: 1.1rem;
`;

// Sortable song card component for reorder mode
interface SortableSongCardProps {
  song: Song;
  index: number;
  notes?: string;
  formatDuration: (seconds: number) => string;
  /** Position in the full item list (songs and special items), for the row menu. */
  itemIndex: number;
  count: number;
  onMove: (index: number, target: MoveTarget) => void;
}

const SortableSongCard: FC<SortableSongCardProps> = ({
  song,
  index,
  notes,
  formatDuration,
  itemIndex,
  count,
  onMove,
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
    <SongCard ref={setNodeRef} style={style} $isDragging={isDragging}>
      <DragHandle {...attributes} {...listeners}>
        <i className="bi bi-grip-vertical"></i>
      </DragHandle>
      <SongPositionWrapper>
        <SongPosition>{index + 1}</SongPosition>
        {song.has_backing_tracks && (
          <BackingTracksBadge title="Has Backing Tracks / Sequences">
            <i className="bi bi-headphones-fill"></i>
          </BackingTracksBadge>
        )}
      </SongPositionWrapper>
      <SongInfo>
        <SongTitle>{song.title}</SongTitle>
        {song.artist && <SongArtist>{song.artist}</SongArtist>}
        {notes && (
          <SongNotes>
            <NotesIcon>
              <i className="bi bi-sticky"></i>
            </NotesIcon>
            {notes}
          </SongNotes>
        )}
      </SongInfo>
      <SongMetadata>
        {song.key && (
          <MetaBadge>
            <i className="bi bi-music-note-beamed"></i>
            {song.key}
          </MetaBadge>
        )}
        {song.tempo && (
          <MetaBadge>
            <i className="bi bi-speedometer2"></i>
            {song.tempo} BPM
          </MetaBadge>
        )}
        {song.duration && (
          <MetaBadge>
            <i className="bi bi-clock"></i>
            {formatDuration(song.duration)}
          </MetaBadge>
        )}
      </SongMetadata>
      <RowMenuSlot>
        <SetlistRowMenu
          index={itemIndex}
          count={count}
          itemLabel={song.title}
          onMove={(target) => onMove(itemIndex, target)}
        />
      </RowMenuSlot>
    </SongCard>
  );
};

// Sortable special item card component for reorder mode
interface SortableSpecialItemCardProps {
  item: SetlistBreakItem | SetlistSectionItem | SetlistNoteItem;
  itemId: string;
  itemIndex: number;
  count: number;
  onMove: (index: number, target: MoveTarget) => void;
}

const SortableSpecialItemCard: FC<SortableSpecialItemCardProps> = ({
  item,
  itemId,
  itemIndex,
  count,
  onMove,
}) => {
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

  const getIcon = () => {
    if (isBreakItem(item)) return "bi-pause-circle";
    if (isSectionItem(item)) return "bi-bookmark";
    return "bi-sticky";
  };

  const getTypeLabel = () => {
    if (isBreakItem(item)) return t("setlists.items.break");
    if (isSectionItem(item)) return t("setlists.items.section");
    return t("setlists.items.note");
  };

  return (
    <SortableSpecialItemCardWrapper
      ref={setNodeRef}
      style={style}
      $isDragging={isDragging}
      $type={item.type}
    >
      <DragHandle {...attributes} {...listeners}>
        <i className="bi bi-grip-vertical"></i>
      </DragHandle>
      <SpecialItemIconReorder $type={item.type}>
        <i className={`bi ${getIcon()}`}></i>
      </SpecialItemIconReorder>
      <SpecialItemInfoReorder>
        <SpecialItemTypeReorder>{getTypeLabel()}</SpecialItemTypeReorder>
        <SpecialItemLabelReorder>{item.label}</SpecialItemLabelReorder>
        {isBreakItem(item) && item.duration && (
          <SpecialItemDurationReorder>
            <i className="bi bi-clock"></i> {item.duration} min
          </SpecialItemDurationReorder>
        )}
      </SpecialItemInfoReorder>
      <SetlistRowMenu
        index={itemIndex}
        count={count}
        itemLabel={item.label}
        onMove={(target) => onMove(itemIndex, target)}
      />
    </SortableSpecialItemCardWrapper>
  );
};

/** PostgREST "no rows" from `.single()`: the setlist is gone or RLS hides it. */
function isSetlistGone(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === "PGRST116";
}

const SetlistDetailView: FC = () => {
  const { setlistId } = useParams<{ setlistId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { selectedBand, reportNetworkFailure, reportNetworkSuccess } = useBandContext();
  useOfflineUpdateCheckOnOpen(setlistId);
  const toast = useToast();

  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [setlistItems, setSetlistItems] = useState<SetlistItem[]>([]);
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  // D5 (PR 3.2): the server no longer returns the setlist, but this device has a copy.
  const [goneOnServer, setGoneOnServer] = useState(false);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [saving, setSaving] = useState(false);

  // Show linking state
  const [linkedShows, setLinkedShows] = useState<Show[]>([]);
  const [availableShows, setAvailableShows] = useState<Show[]>([]);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [selectedShowId, setSelectedShowId] = useState<string>("");
  const [linkingShow, setLinkingShow] = useState(false);

  // Propose setlist modal state
  const [showProposeModal, setShowProposeModal] = useState(false);

  // Edit setlist modal state
  const [showEditModal, setShowEditModal] = useState(false);

  // Edit song modal state
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [isEditSongModalOpen, setIsEditSongModalOpen] = useState(false);

  // AI Optimization state
  const [isOptimizeModalOpen, setIsOptimizeModalOpen] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [optimization, setOptimization] = useState<SetlistOptimization | null>(null);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);

  // Helper to get song by ID
  const getSongById = (songId: string): Song | undefined => {
    return allSongs.find((s) => s.id === songId);
  };
  const [showExportModal, setShowExportModal] = useState(false);
  const [showYouTubeModal, setShowYouTubeModal] = useState(false);
  const [youtubeExporting, setYoutubeExporting] = useState(false);
  const [youtubeProgress, setYoutubeProgress] = useState({ current: 0, total: 0, songTitle: "" });
  const [youtubeResult, setYoutubeResult] = useState<PlaylistCreationResult | null>(null);
  const [hasYouTubeAccess, setHasYouTubeAccess] = useState<boolean | null>(null);

  // Mouse + long-press touch + keyboard; the row menu is the non-drag path (setlist-builder §3.5)
  const sensors = useSortableSensors();


  // Get only song items for reordering
  const songItemsOnly = setlistItems.filter(isSongItem);

  // Memoised so the export preview only reformats when the setlist changes.
  const exportInput = useMemo(
    () => ({
      name: setlist?.name ?? "",
      description: setlist?.description,
      items: setlistItems,
      songsById: new Map(allSongs.map((song) => [song.id, song])),
      show: linkedShows[0],
    }),
    [setlist?.name, setlist?.description, setlistItems, allSongs, linkedShows],
  );
  const songsForReorder = songItemsOnly
    .map((item) => getSongById(item.song_id))
    .filter((song): song is Song => song !== undefined);

  // Editing actions are hidden by role (docs/specs/setlist-actions-layout.md §1.5);
  // the services still throw PermissionError as the safety net.
  const canEdit = canEditContent(selectedBand?.user_role ?? null);
  const canLinkShow = canManageEvents(selectedBand?.user_role ?? null);
  const canOptimize = groqService.isConfigured() && songsForReorder.length >= 3;

  const handleEditSong = (song: Song) => {
    setEditingSong(song);
    setIsEditSongModalOpen(true);
  };

  const handleSaveSong = async (songId: string, updates: UpdateSongInput) => {
    const updatedSong = await updateSong(songId, updates);
    // Refresh the song in place so the setlist keeps its order and scroll position
    setAllSongs((prevSongs) =>
      prevSongs.map((song) => (song.id === songId ? updatedSong : song))
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setSetlistItems((items) => {
        const oldIndex = items.findIndex((item) => getSetlistItemKey(item) === active.id);
        const newIndex = items.findIndex((item) => getSetlistItemKey(item) === over.id);

        if (oldIndex === -1 || newIndex === -1) return items;

        const reordered = arrayMove(items, oldIndex, newIndex);
        // Reindex positions
        return reordered.map((item, index) => ({
          ...item,
          position: index,
        }));
      });
    }
  };

  const handleMoveItem = (index: number, target: MoveTarget) => {
    setSetlistItems((items) => moveItem(items, index, target));
  };

  const handleSaveOrder = async () => {
    if (!setlist) return;

    setSaving(true);
    try {
      // Update all items with new positions
      const updatedItems = setlistItems.map((item, index) => ({
        ...item,
        position: index,
      }));

      await updateSetlist(setlist.id, { songs: updatedItems });

      // Update local setlist state
      setSetlist({
        ...setlist,
        songs: updatedItems,
      });

      setSetlistItems(updatedItems);
      setIsReorderMode(false);
    } catch (error) {
      console.error("Failed to save order:", error);
      toast.error(isPermissionDenied(error) ? t("common.noPermission") : t("setlists.detail.saveOrderError"));
    }
    setSaving(false);
  };

  const handleCancelReorder = () => {
    // Restore original order from setlist
    if (setlist) {
      const orderedItems = [...(setlist.songs || [])].sort((a, b) => a.position - b.position);
      setSetlistItems(orderedItems);
    }
    setIsReorderMode(false);
  };

  // AI Optimization handlers
  const handleOptimizeOrder = async () => {
    if (!setlist) return;

    setOptimizing(true);
    setOptimizeError(null);
    setOptimization(null);
    setIsOptimizeModalOpen(true);

    try {
      const result = await optimizeSetlistOrder(setlist, allSongs);
      setOptimization(result);
    } catch (error) {
      console.error("Failed to optimize setlist:", error);
      if (error instanceof GroqApiError && error.status === 413) {
        setOptimizeError(t("ai.requestTooLarge"));
      } else {
        setOptimizeError(
          error instanceof Error ? error.message : t("ai.generationError")
        );
      }
    } finally {
      setOptimizing(false);
    }
  };

  const handleApplyOptimization = () => {
    if (!optimization) return;

    // Create new order based on suggested order
    const newSongItems: SetlistItem[] = optimization.suggestedOrder.map((songId, index) => {
      const existingItem = songItemsOnly.find((item) => item.song_id === songId);
      return {
        type: "song" as const,
        song_id: songId,
        position: index,
        notes: existingItem?.notes || "",
      };
    });

    // Non-song items get placed after songs
    const nonSongItems = setlistItems.filter((item) => !isSongItem(item));
    const updatedItems: SetlistItem[] = [
      ...newSongItems,
      ...nonSongItems.map((item, index) => ({
        ...item,
        position: newSongItems.length + index,
      })),
    ];

    setSetlistItems(updatedItems);
    setIsOptimizeModalOpen(false);
    setOptimization(null);
  };

  useEffect(() => {
    if (!setlistId) return;

    const loadData = async () => {
      setLoading(true);
      setGoneOnServer(false);
      try {
        const setlistData = await getSetlist(setlistId);
        reportNetworkSuccess();
        setSetlist(setlistData);

        // Load all songs for the band
        const songsData = await getBandSongs(setlistData.band_id);
        setAllSongs(songsData);

        // Load all items in order (they already carry stable ids, see normalizeSetlistItem)
        const orderedItems = [...(setlistData.songs || [])].sort((a, b) => a.position - b.position);
        setSetlistItems(orderedItems);

        // Load shows that use this setlist
        const linkedShowsData = await getShowsBySetlistId(setlistId);
        setLinkedShows(linkedShowsData);

        // Load available shows (upcoming without setlist)
        const availableShowsData = await getUpcomingShowsWithoutSetlist(setlistData.band_id);
        setAvailableShows(availableShowsData);
      } catch (error) {
        console.error("Failed to load setlist:", error);
        // Weak signal: the route switches to the
        // offline detail once isOnline drops, so no toast and no bounce (§7.3).
        if (isNetworkError(error)) {
          reportNetworkFailure();
        } else if (isSetlistGone(error) && (await getSnapshotMeta(setlistId))) {
          // Deleted (or access lost) with a copy on this device: show the copy,
          // which says so and offers Remove, instead of bouncing (D5).
          setGoneOnServer(true);
        } else {
          toast.error(t("setlists.detail.loadError"));
          navigate("/setlists");
        }
      }
      setLoading(false);
    };

    loadData();
  }, [setlistId, navigate, reportNetworkFailure, reportNetworkSuccess]);

  // Check YouTube access on mount
  useEffect(() => {
    const checkYouTubeAccess = async () => {
      const hasAccess = await youtubeService.hasYouTubeAccess();
      setHasYouTubeAccess(hasAccess);
    };
    checkYouTubeAccess();
  }, []);

  const handleExportToYouTube = async () => {
    if (!setlist) return;

    setYoutubeExporting(true);
    setYoutubeResult(null);
    setYoutubeProgress({ current: 0, total: songsForReorder.length, songTitle: "" });

    try {
      const songs = songsForReorder.map((song) => ({
        title: song.title,
        artist: song.artist || undefined,
      }));

      const playlistTitle = selectedBand ? `${selectedBand.name}: ${setlist.name}` : setlist.name;
      const result = await youtubeService.createPlaylistFromSetlist(
        playlistTitle,
        songs,
        setlist.description || `Setlist created with Bandmate`,
        (current, total, songTitle) => {
          setYoutubeProgress({ current, total, songTitle });
        }
      );

      setYoutubeResult(result);

      // Save the playlist URL if successful
      if (result.success && result.playlistUrl) {
        try {
          const updatedSetlist = await updateSetlistYouTubePlaylist(setlist.id, result.playlistUrl);
          setSetlist(updatedSetlist);
        } catch (saveError) {
          console.error("Failed to save YouTube playlist URL:", saveError);
        }
      }
    } catch (error) {
      setYoutubeResult({
        success: false,
        addedSongs: 0,
        failedSongs: [],
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    setYoutubeExporting(false);
  };

  const handleRequestYouTubeAccess = async () => {
    try {
      await youtubeService.requestAuthorization();
    } catch (error) {
      console.error("Failed to request YouTube authorization:", error);
      toast.error(t("youtubeMusic.authError"));
    }
  };

  const handleLinkToShow = async () => {
    if (!selectedShowId || !setlistId) return;

    setLinkingShow(true);
    try {
      await updateShow(selectedShowId, { setlist_id: setlistId });

      // Refresh linked shows
      const linkedShowsData = await getShowsBySetlistId(setlistId);
      setLinkedShows(linkedShowsData);

      // Refresh available shows
      if (setlist) {
        const availableShowsData = await getUpcomingShowsWithoutSetlist(setlist.band_id);
        setAvailableShows(availableShowsData);
      }

      setShowLinkModal(false);
      setSelectedShowId("");
    } catch (error) {
      console.error("Failed to link setlist to show:", error);
      toast.error(isPermissionDenied(error) ? t("common.noPermission") : t("setlists.detail.linkError"));
    }
    setLinkingShow(false);
  };

  const formatShowDate = (dateString: string): string => {
    const date = new Date(dateString + "T00:00:00");
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const calculateTotalDuration = (): number => {
    return songItemsOnly
      .map((item) => getSongById(item.song_id))
      .filter((song): song is Song => song !== undefined)
      .reduce((total, song) => total + (song.duration || 0), 0);
  };

  const getSetlistSongNotes = (songId: string): string | undefined => {
    if (!setlist) return undefined;
    const setlistSong = setlist.songs
      .filter(isSongItem)
      .find((s) => s.song_id === songId);
    return setlistSong?.notes;
  };


  if (goneOnServer) return <OfflineSetlistDetail online />;

  if (loading) {
    return (
      <LoadingContainer>
        <Spinner color="primary" style={{ width: "3rem", height: "3rem" }} />
        <LoadingText>{t('setlists.detail.loading')}</LoadingText>
      </LoadingContainer>
    );
  }

  if (!setlist) {
    return (
      <ErrorContainer>
        <ErrorIcon>
          <i className="bi bi-exclamation-triangle"></i>
        </ErrorIcon>
        <ErrorTitle>{t('setlists.detail.notFound')}</ErrorTitle>
        <ErrorText>{t('setlists.detail.notFoundText')}</ErrorText>
        <BackButton onClick={() => navigate("/setlists")}>
          <i className="bi bi-arrow-left"></i>
          {t('setlists.detail.backToSetlists')}
        </BackButton>
      </ErrorContainer>
    );
  }

  const totalDuration = calculateTotalDuration();

  return (
    <ViewContainer>
      <SEO
        title={setlist.name}
        description={`View and manage the ${setlist.name} setlist. ${songItemsOnly.length} songs with a total duration of ${Math.floor(totalDuration / 60)} minutes.`}
      />
      <StyledContainer>
        <BackLink onClick={() => navigate("/setlists")}>
          <i className="bi bi-arrow-left"></i>
          {t('setlists.detail.backToSetlists')}
        </BackLink>

        <Header>
          <HeaderRow>
            <SetlistTitle>{setlist.name}</SetlistTitle>
            <SetlistHeaderActions
              canEdit={canEdit}
              itemCount={setlistItems.length}
              songCount={songItemsOnly.length}
              reorderMode={isReorderMode}
              onPerform={() => navigate(`/setlists/${setlistId}/perform`)}
              onEdit={() => navigate(`/setlists/${setlistId}/edit`)}
              onReorder={() => setIsReorderMode(true)}
              onRename={() => setShowEditModal(true)}
              onPrint={() => navigate(`/setlists/${setlistId}/print`)}
              onExport={() => setShowExportModal(true)}
              onYouTube={() => setShowYouTubeModal(true)}
              onPropose={() => setShowProposeModal(true)}
            />
          </HeaderRow>

          <OfflineStatusRow setlistId={setlist.id} setlistName={setlist.name} />

          {setlist.description && (
            <SetlistDescription>{setlist.description}</SetlistDescription>
          )}

          <MetadataBar>
            <MetadataItem>
              <i className="bi bi-music-note-beamed"></i>
              {songItemsOnly.length} {songItemsOnly.length === 1 ? t('setlists.items.song').toLowerCase() : t('setlists.songs').toLowerCase()}
            </MetadataItem>
            {totalDuration > 0 && (
              <MetadataItem>
                <i className="bi bi-clock"></i>
                Total: {formatDuration(totalDuration)}
              </MetadataItem>
            )}
            {linkedShows.length > 0 ? (
              <LinkedShowBadge onClick={() => navigate(`/shows/${linkedShows[0].id}`)}>
                <i className="bi bi-calendar-event-fill"></i>
                {t('setlists.detail.linkedToShow')}: {linkedShows[0].name}
              </LinkedShowBadge>
            ) : canLinkShow ? (
              <LinkToShowButton onClick={() => setShowLinkModal(true)}>
                <i className="bi bi-link-45deg"></i>
                {t('setlists.detail.linkToShow')}
              </LinkToShowButton>
            ) : null}
          </MetadataBar>
        </Header>

        {isReorderMode && (
          <ReorderToolbar
            canOptimize={canOptimize}
            saving={saving}
            optimizing={optimizing}
            onCancel={handleCancelReorder}
            onOptimize={() => void handleOptimizeOrder()}
            onSave={() => void handleSaveOrder()}
          />
        )}

        {setlistItems.length === 0 ? (
          <EmptyState>
            <EmptyIcon>
              <i className="bi bi-music-note-list"></i>
            </EmptyIcon>
            <EmptyTitle>{t('setlists.detail.noSongsYet')}</EmptyTitle>
            <EmptyText>{t('setlists.detail.noSongsYetText')}</EmptyText>
          </EmptyState>
        ) : isReorderMode ? (
          <SongsList>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={setlistItems.map(getSetlistItemKey)}
                strategy={verticalListSortingStrategy}
              >
                {(() => {
                  let songNumber = 0;
                  return setlistItems.map((item, itemIndex) => {
                    if (isSongItem(item)) {
                      const song = getSongById(item.song_id);
                      if (!song) return null;
                      songNumber++;
                      return (
                        <SortableSongCard
                          key={item.song_id}
                          song={song}
                          index={songNumber - 1}
                          notes={getSetlistSongNotes(song.id)}
                          formatDuration={formatDuration}
                          itemIndex={itemIndex}
                          count={setlistItems.length}
                          onMove={handleMoveItem}
                        />
                      );
                    } else {
                      // Special item (break, section, note)
                      const itemId = getSetlistItemKey(item);
                      return (
                        <SortableSpecialItemCard
                          key={itemId}
                          item={item}
                          itemId={itemId}
                          itemIndex={itemIndex}
                          count={setlistItems.length}
                          onMove={handleMoveItem}
                        />
                      );
                    }
                  });
                })()}
              </SortableContext>
            </DndContext>
          </SongsList>
        ) : (
          <SongsList>
            {(() => {
              let songNumber = 0;
              return setlistItems.map((item, index) => {
                if (isSongItem(item)) {
                  const song = getSongById(item.song_id);
                  if (!song) return null;
                  songNumber++;
                  const notes = getSetlistSongNotes(song.id);
                  return (
                    <SongCard key={`song-${item.song_id}`}>
                      <SongPositionWrapper>
                        <SongPosition>{songNumber}</SongPosition>
                        {song.has_backing_tracks && (
                          <BackingTracksBadge title={t('songs.hasBackingTracksShort')}>
                            <i className="bi bi-headphones-fill"></i>
                          </BackingTracksBadge>
                        )}
                      </SongPositionWrapper>
                      <SongInfo>
                        <SongTitle>{song.title}</SongTitle>
                        {song.artist && <SongArtist>{song.artist}</SongArtist>}
                        {notes && (
                          <SongNotes>
                            <NotesIcon>
                              <i className="bi bi-sticky"></i>
                            </NotesIcon>
                            {notes}
                          </SongNotes>
                        )}
                      </SongInfo>
                      <SongMetadata>
                        {song.key && (
                          <MetaBadge>
                            <i className="bi bi-music-note-beamed"></i>
                            {song.key}
                          </MetaBadge>
                        )}
                        {song.tempo && (
                          <MetaBadge>
                            <i className="bi bi-speedometer2"></i>
                            {song.tempo} BPM
                          </MetaBadge>
                        )}
                        {song.duration && (
                          <MetaBadge>
                            <i className="bi bi-clock"></i>
                            {formatDuration(song.duration)}
                          </MetaBadge>
                        )}
                      </SongMetadata>
                      <SongActions>
                        <PerformFromHereButton
                          onClick={() =>
                            navigate(`/setlists/${setlistId}/perform?song=${encodeURIComponent(song.id)}`)
                          }
                          title={t("setlists.detail.performFromHere")}
                          aria-label={t("setlists.detail.performFromHere")}
                        >
                          <i className="bi bi-play-fill"></i>
                        </PerformFromHereButton>
                        {canEdit && (
                          <EditSongButton
                            onClick={() => handleEditSong(song)}
                            title={t("songs.editSongTooltip")}
                            aria-label={t("songs.editSongTooltip")}
                          >
                            <i className="bi bi-pencil"></i>
                          </EditSongButton>
                        )}
                      </SongActions>
                    </SongCard>
                  );
                } else {
                  // Special item (break, section, note)
                  const getIcon = () => {
                    if (isBreakItem(item)) return "bi-pause-circle";
                    if (isSectionItem(item)) return "bi-bookmark";
                    return "bi-sticky";
                  };
                  const typeLabel = isBreakItem(item)
                    ? t("setlists.items.break")
                    : isSectionItem(item)
                    ? t("setlists.items.section")
                    : t("setlists.items.note");
                  return (
                    <SpecialItemCard key={`special-${index}`} $type={item.type}>
                      <SpecialItemIcon $type={item.type}>
                        <i className={`bi ${getIcon()}`}></i>
                      </SpecialItemIcon>
                      <SpecialItemInfo>
                        <SpecialItemType>{typeLabel}</SpecialItemType>
                        <SpecialItemLabel>{item.label}</SpecialItemLabel>
                        {isBreakItem(item) && item.duration && (
                          <SpecialItemDuration>
                            <i className="bi bi-clock"></i> {item.duration} min
                          </SpecialItemDuration>
                        )}
                      </SpecialItemInfo>
                    </SpecialItemCard>
                  );
                }
              });
            })()}
          </SongsList>
        )}
      </StyledContainer>

      <SetlistTextExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        input={exportInput}
      />

      {/* YouTube Music Export Modal */}
      <Modal isOpen={showYouTubeModal} toggle={() => !youtubeExporting && setShowYouTubeModal(false)} size="md">
        <ModalHeader toggle={() => !youtubeExporting && setShowYouTubeModal(false)}>
          <i className="bi bi-youtube me-2" style={{ color: "#FF0000" }}></i>
          {t("youtubeMusic.title")}
        </ModalHeader>
        <ModalBody>
          {hasYouTubeAccess === false ? (
            <YouTubeAuthPrompt>
              <AuthIcon>
                <i className="bi bi-youtube"></i>
              </AuthIcon>
              <AuthTitle>{t("youtubeMusic.authRequired")}</AuthTitle>
              <AuthText>{t("youtubeMusic.authDescription")}</AuthText>
              <Button color="danger" onClick={handleRequestYouTubeAccess}>
                <i className="bi bi-google me-2"></i>
                {t("youtubeMusic.connectGoogle")}
              </Button>
            </YouTubeAuthPrompt>
          ) : youtubeResult ? (
            <YouTubeResultContainer>
              {youtubeResult.success ? (
                <>
                  <ResultIcon $success>
                    <i className="bi bi-check-circle-fill"></i>
                  </ResultIcon>
                  <ResultTitle>{t("youtubeMusic.playlistCreated")}</ResultTitle>
                  <ResultStats>
                    <StatRow>
                      <span>{t("youtubeMusic.songsAdded")}:</span>
                      <strong>{youtubeResult.addedSongs}</strong>
                    </StatRow>
                    {youtubeResult.failedSongs.length > 0 && (
                      <StatRow $warning>
                        <span>{t("youtubeMusic.songsNotFound")}:</span>
                        <strong>{youtubeResult.failedSongs.length}</strong>
                      </StatRow>
                    )}
                  </ResultStats>
                  {youtubeResult.failedSongs.length > 0 && (
                    <FailedSongsList>
                      <FailedSongsTitle>{t("youtubeMusic.couldNotFind")}:</FailedSongsTitle>
                      {youtubeResult.failedSongs.map((song, i) => (
                        <FailedSongItem key={i}>{song}</FailedSongItem>
                      ))}
                    </FailedSongsList>
                  )}
                  <OpenPlaylistButton
                    href={youtubeResult.playlistUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <i className="bi bi-box-arrow-up-right me-2"></i>
                    {t("youtubeMusic.openPlaylist")}
                  </OpenPlaylistButton>
                </>
              ) : (
                <>
                  <ResultIcon $success={false}>
                    <i className="bi bi-exclamation-circle-fill"></i>
                  </ResultIcon>
                  <ResultTitle>{t("youtubeMusic.exportFailed")}</ResultTitle>
                  <ErrorMessage>{youtubeResult.error}</ErrorMessage>
                </>
              )}
            </YouTubeResultContainer>
          ) : youtubeExporting ? (
            <YouTubeProgressContainer>
              <Spinner color="danger" style={{ width: "3rem", height: "3rem" }} />
              <ProgressTitle>{t("youtubeMusic.creatingPlaylist")}</ProgressTitle>
              <ProgressText>
                {t("youtubeMusic.addingSong", {
                  current: youtubeProgress.current,
                  total: youtubeProgress.total,
                })}
              </ProgressText>
              <CurrentSong>{youtubeProgress.songTitle}</CurrentSong>
              <ProgressBar>
                <ProgressFill
                  style={{
                    width: `${(youtubeProgress.current / youtubeProgress.total) * 100}%`,
                  }}
                />
              </ProgressBar>
            </YouTubeProgressContainer>
          ) : setlist?.youtube_playlist_url ? (
            <YouTubeExistingPlaylist>
              <ExistingPlaylistIcon>
                <i className="bi bi-check-circle-fill"></i>
              </ExistingPlaylistIcon>
              <ExistingPlaylistTitle>{t("youtubeMusic.playlistExists")}</ExistingPlaylistTitle>
              <ExistingPlaylistText>
                {t("youtubeMusic.playlistExistsDescription")}
              </ExistingPlaylistText>
              <OpenPlaylistButton
                href={setlist.youtube_playlist_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <i className="bi bi-box-arrow-up-right me-2"></i>
                {t("youtubeMusic.openPlaylist")}
              </OpenPlaylistButton>
              <CreateNewPlaylistLink onClick={handleExportToYouTube}>
                <i className="bi bi-plus-circle me-2"></i>
                {t("youtubeMusic.createNewPlaylist")}
              </CreateNewPlaylistLink>
            </YouTubeExistingPlaylist>
          ) : (
            <YouTubeExportPreview>
              <PreviewTitle>{t("youtubeMusic.createPlaylist")}</PreviewTitle>
              <PreviewText>
                {t("youtubeMusic.willCreate", { name: setlist?.name })}
              </PreviewText>
              <PreviewStats>
                <PreviewStat>
                  <i className="bi bi-music-note-beamed"></i>
                  {songsForReorder.length} {t("youtubeMusic.songs")}
                </PreviewStat>
              </PreviewStats>
              <PreviewNote>
                <i className="bi bi-info-circle me-2"></i>
                {t("youtubeMusic.note")}
              </PreviewNote>
            </YouTubeExportPreview>
          )}
        </ModalBody>
        <ModalFooter>
          {youtubeResult || setlist?.youtube_playlist_url ? (
            <Button
              color="secondary"
              onClick={() => {
                setShowYouTubeModal(false);
                setYoutubeResult(null);
              }}
            >
              {t("common.close")}
            </Button>
          ) : (
            <>
              <Button
                color="secondary"
                onClick={() => setShowYouTubeModal(false)}
                disabled={youtubeExporting}
              >
                {t("common.cancel")}
              </Button>
              {hasYouTubeAccess !== false && (
                <Button
                  color="danger"
                  onClick={handleExportToYouTube}
                  disabled={youtubeExporting || songItemsOnly.length === 0}
                >
                  <i className="bi bi-youtube me-2"></i>
                  {t("youtubeMusic.createPlaylistButton")}
                </Button>
              )}
            </>
          )}
        </ModalFooter>
      </Modal>

      {/* Link to Show Modal */}
      <Modal isOpen={showLinkModal} toggle={() => !linkingShow && setShowLinkModal(false)} size="md">
        <ModalHeader toggle={() => !linkingShow && setShowLinkModal(false)}>
          <i className="bi bi-link-45deg me-2"></i>
          {t("setlists.detail.linkToShowTitle")}
        </ModalHeader>
        <ModalBody>
          {availableShows.length > 0 ? (
            <>
              <LinkModalDescription>
                {t("setlists.detail.linkToShowDescription")}
              </LinkModalDescription>
              <FormGroup>
                <Input
                  type="select"
                  value={selectedShowId}
                  onChange={(e) => setSelectedShowId(e.target.value)}
                  disabled={linkingShow}
                >
                  <option value="">{t("setlists.detail.selectShow")}</option>
                  {availableShows.map((show) => (
                    <option key={show.id} value={show.id}>
                      {show.name} - {formatShowDate(show.event_date)}
                      {show.venue && ` @ ${show.venue}`}
                    </option>
                  ))}
                </Input>
              </FormGroup>
            </>
          ) : (
            <NoShowsMessage>
              <NoShowsIcon>
                <i className="bi bi-calendar-x"></i>
              </NoShowsIcon>
              <NoShowsTitle>{t("setlists.detail.noUpcomingShows")}</NoShowsTitle>
              <NoShowsText>{t("setlists.detail.noUpcomingShowsHint")}</NoShowsText>
              <CreateShowLink onClick={() => navigate("/shows")}>
                <i className="bi bi-plus-circle me-2"></i>
                {t("setlists.detail.createNewShow")}
              </CreateShowLink>
            </NoShowsMessage>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            color="secondary"
            onClick={() => setShowLinkModal(false)}
            disabled={linkingShow}
          >
            {t("common.cancel")}
          </Button>
          {availableShows.length > 0 && (
            <Button
              color="primary"
              onClick={handleLinkToShow}
              disabled={linkingShow || !selectedShowId}
            >
              {linkingShow ? (
                <>
                  <Spinner size="sm" style={{ marginRight: "8px" }} />
                  {t("common.saving")}
                </>
              ) : (
                <>
                  <i className="bi bi-link-45deg me-2"></i>
                  {t("setlists.detail.linkToShow")}
                </>
              )}
            </Button>
          )}
        </ModalFooter>
      </Modal>

      {/* Propose Setlist Modal */}
      {setlist && (
        <NewRequestModal
          isOpen={showProposeModal}
          onClose={() => setShowProposeModal(false)}
          bandId={setlist.band_id}
          onCreated={() => setShowProposeModal(false)}
          prefillSetlistId={setlist.id}
          prefillType="setlist_proposal"
        />
      )}

      {/* Edit Setlist Modal */}
      <EditSetlistModal
        setlist={setlist}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onUpdated={(updatedSetlist) => {
          setSetlist(updatedSetlist);
          setShowEditModal(false);
        }}
      />

      {/* Edit Song Modal */}
      <EditSongModal
        song={editingSong}
        isOpen={isEditSongModalOpen}
        onClose={() => setIsEditSongModalOpen(false)}
        onSave={handleSaveSong}
      />

      {/* AI Optimization Modal */}
      <Modal isOpen={isOptimizeModalOpen} toggle={() => !optimizing && setIsOptimizeModalOpen(false)} size="lg">
        <ModalHeader toggle={() => !optimizing && setIsOptimizeModalOpen(false)}>
          <i className="bi bi-magic" style={{ marginRight: "8px", color: theme.colors.brand.primary }}></i>
          {t("ai.optimizeOrder")}
        </ModalHeader>
        <ModalBody>
          {optimizing && (
            <OptimizingContainer>
              <Spinner color="primary" style={{ width: "3rem", height: "3rem" }} />
              <OptimizingText>{t("ai.optimizing")}</OptimizingText>
            </OptimizingContainer>
          )}

          {optimizeError && (
            <OptimizeErrorMessage>
              <i className="bi bi-exclamation-triangle"></i>
              {optimizeError}
            </OptimizeErrorMessage>
          )}

          {optimization && !optimizing && (
            <>
              <OptimizationSection>
                <OptimizationSectionTitle>
                  <i className="bi bi-lightbulb"></i>
                  {t("ai.reasoning")}
                </OptimizationSectionTitle>
                <ReasoningText>{optimization.overallReasoning}</ReasoningText>
              </OptimizationSection>

              {optimization.changes.length > 0 && (
                <OptimizationSection>
                  <OptimizationSectionTitle>
                    <i className="bi bi-arrow-left-right"></i>
                    {t("ai.suggestedChanges")}
                  </OptimizationSectionTitle>
                  <ChangesList>
                    {optimization.changes.map((change, index) => (
                      <ChangeItem key={index}>
                        <ChangeIcon>
                          <i className="bi bi-arrow-right"></i>
                        </ChangeIcon>
                        <ChangeContent>
                          <ChangeSongTitle>"{change.songTitle}"</ChangeSongTitle>
                          <ChangeMove>
                            {t("ai.moveFrom")} #{change.from + 1} {t("ai.moveTo")} #{change.to + 1}
                          </ChangeMove>
                          <ChangeReason>{change.reason}</ChangeReason>
                        </ChangeContent>
                      </ChangeItem>
                    ))}
                  </ChangesList>
                </OptimizationSection>
              )}

              <OptimizationSection>
                <OptimizationSectionTitle>
                  <i className="bi bi-list-ol"></i>
                  {t("ai.newOrder")}
                </OptimizationSectionTitle>
                <NewOrderList>
                  {optimization.suggestedOrder.map((songId, index) => {
                    const song = getSongById(songId);
                    if (!song) return null;
                    return (
                      <NewOrderItem key={songId}>
                        <NewOrderPosition>{index + 1}</NewOrderPosition>
                        <NewOrderSong>
                          <strong>{song.title}</strong>
                          {song.artist && <span> - {song.artist}</span>}
                        </NewOrderSong>
                      </NewOrderItem>
                    );
                  })}
                </NewOrderList>
              </OptimizationSection>
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={() => setIsOptimizeModalOpen(false)} disabled={optimizing}>
            {t("common.cancel")}
          </Button>
          {optimization && !optimizing && (
            <Button color="primary" onClick={handleApplyOptimization}>
              <i className="bi bi-check-circle" style={{ marginRight: "8px" }}></i>
              {t("ai.applyChanges")}
            </Button>
          )}
        </ModalFooter>
      </Modal>
    </ViewContainer>
  );
};

// Styled Components

const ViewContainer = styled.div`
  min-height: calc(100vh - 72px);
  background: var(--color-bg-primary);
  padding: ${theme.space[8]} 0;
`;

const StyledContainer = styled(Container)`
  max-width: 900px;
`;

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: ${theme.space[4]};
`;

const LoadingText = styled.p`
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-secondary);
  margin: 0;
`;

const ErrorContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
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

const Header = styled.div`
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.lg};
  padding: ${theme.space[6]};
  margin-bottom: ${theme.space[6]};
`;

const HeaderRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${theme.space[4]};
  margin-bottom: ${theme.space[4]};

  @media (max-width: ${theme.breakpoints.md}) {
    gap: ${theme.space[3]};
  }
`;

const BackLink = styled.button`
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  font-size: ${theme.fontSizes.body};
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  transition: all ${theme.transitions.fast} ease;
  padding: 0;
  min-height: 40px;
  margin-bottom: ${theme.space[3]};

  &:hover {
    color: ${theme.colors.brand.primary};
  }

  i {
    font-size: ${theme.fontSizes.bodyLg};
  }
`;

const SetlistTitle = styled.h1`
  font-size: ${theme.fontSizes.displayMd};
  font-weight: ${theme.fontWeights.bold};
  color: var(--color-text-primary);
  margin: 0;
  /* Keep at least ~320px for the name; the actions wrap under it otherwise. */
  flex: 1 1 320px;
  min-width: 0;
  overflow-wrap: anywhere;
  line-height: ${theme.lineHeights.tight};

  @media (max-width: ${theme.breakpoints.md}) {
    font-size: ${theme.fontSizes.h1};
  }
`;

const SetlistDescription = styled.p`
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-secondary);
  line-height: ${theme.lineHeights.relaxed};
  margin: 0 0 ${theme.space[6]} 0;
`;

const MetadataBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${theme.space[3]};
`;

const MetadataItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  padding: ${theme.space[2]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};

  i {
    font-size: ${theme.fontSizes.body};
    color: ${theme.colors.brand.primary};
  }
`;

const LinkedShowBadge = styled.button`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  background: ${theme.colors.semantic.successBgDark};
  border: 1px solid ${theme.colors.semantic.success};
  color: ${theme.colors.semantic.success};
  padding: ${theme.space[2]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  i {
    font-size: ${theme.fontSizes.body};
  }

  &:hover {
    background: ${theme.colors.semantic.success};
    color: white;
    transform: translateY(-1px);
  }
`;

const LinkToShowButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  background: transparent;
  border: 1px dashed var(--color-border);
  color: var(--color-text-secondary);
  padding: ${theme.space[2]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  i {
    font-size: ${theme.fontSizes.body};
  }

  &:hover {
    background: var(--color-bg-tertiary);
    border-color: ${theme.colors.brand.primary};
    border-style: solid;
    color: ${theme.colors.brand.primary};
  }
`;

const EmptyState = styled.div`
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.lg};
  padding: ${theme.space[12]} ${theme.space[6]};
  text-align: center;
`;

const EmptyIcon = styled.div`
  font-size: ${theme.fontSizes.displayLg};
  color: var(--color-text-tertiary);
  margin-bottom: ${theme.space[4]};
  opacity: 0.5;
`;

const EmptyTitle = styled.h3`
  font-size: ${theme.fontSizes.h3};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin: 0 0 ${theme.space[2]} 0;
`;

const EmptyText = styled.p`
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-secondary);
  margin: 0;
`;

const SongsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[3]};
`;

// Special item card styles
const SpecialItemCard = styled.div<{ $type: string }>`
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
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
  border-radius: ${theme.radius.lg};
  padding: ${theme.space[4]};
  display: flex;
  align-items: center;
  gap: ${theme.space[4]};
  transition: all ${theme.transitions.fast} ease;

  &:hover {
    border-color: ${theme.colors.brand.primary};
    box-shadow: var(--shadow-sm);
  }
`;

const SpecialItemIcon = styled.div<{ $type: string }>`
  width: 40px;
  height: 40px;
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${theme.fontSizes.h3};
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

const SpecialItemInfo = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${theme.space[1]};
`;

const SpecialItemType = styled.div`
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: ${theme.letterSpacing.wide};
`;

const SpecialItemLabel = styled.div`
  font-size: ${theme.fontSizes.bodyLg};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
`;

const SpecialItemDuration = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  gap: ${theme.space[1]};

  i {
    color: ${theme.colors.semantic.warning};
  }
`;

// Sortable special item card styles for reorder mode
const SortableSpecialItemCardWrapper = styled.div<{ $isDragging?: boolean; $type: string }>`
  background: ${(props) =>
    props.$isDragging ? 'var(--color-bg-elevated)' : 'var(--color-bg-secondary)'};
  border: 1px solid ${(props) =>
    props.$isDragging ? theme.colors.brand.primary : 'var(--color-border)'};
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
  border-radius: ${theme.radius.lg};
  padding: ${theme.space[4]};
  display: flex;
  align-items: center;
  gap: ${theme.space[4]};
  transition: all ${theme.transitions.fast} ease;
  opacity: ${(props) => (props.$isDragging ? 0.9 : 1)};
  box-shadow: ${(props) => (props.$isDragging ? theme.shadows.lg : "none")};
  z-index: ${(props) => (props.$isDragging ? 10 : "auto")};

  &:hover {
    border-color: ${theme.colors.brand.primary};
    box-shadow: var(--shadow-sm);
  }
`;

const SpecialItemIconReorder = styled.div<{ $type: string }>`
  width: 36px;
  height: 36px;
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${theme.fontSizes.h3};
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

const SpecialItemInfoReorder = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${theme.space[1]};
  min-width: 0;
`;

const SpecialItemTypeReorder = styled.div`
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: ${theme.letterSpacing.wide};
`;

const SpecialItemLabelReorder = styled.div`
  font-size: ${theme.fontSizes.bodyLg};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
`;

const SpecialItemDurationReorder = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  gap: ${theme.space[1]};

  i {
    color: ${theme.colors.semantic.warning};
  }
`;

// YouTube Export Modal Styles
const YouTubeAuthPrompt = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: ${theme.space[6]};
`;

const AuthIcon = styled.div`
  font-size: 4rem;
  color: #ff0000;
  margin-bottom: ${theme.space[4]};
`;

const AuthTitle = styled.h3`
  font-size: ${theme.fontSizes.h3};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin-bottom: ${theme.space[2]};
`;

const AuthText = styled.p`
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-secondary);
  margin-bottom: ${theme.space[6]};
  line-height: ${theme.lineHeights.relaxed};
`;

const YouTubeProgressContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: ${theme.space[6]};
`;

const ProgressTitle = styled.h3`
  font-size: ${theme.fontSizes.h3};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin: ${theme.space[4]} 0 ${theme.space[2]} 0;
`;

const ProgressText = styled.p`
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-secondary);
  margin-bottom: ${theme.space[2]};
`;

const CurrentSong = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.brand.primary};
  font-weight: ${theme.fontWeights.medium};
  margin-bottom: ${theme.space[4]};
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 8px;
  background: var(--color-bg-tertiary);
  border-radius: ${theme.radius.base};
  overflow: hidden;
`;

const ProgressFill = styled.div`
  height: 100%;
  background: #ff0000;
  border-radius: ${theme.radius.base};
  transition: width 0.3s ease;
`;

const YouTubeResultContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: ${theme.space[4]};
`;

const ResultIcon = styled.div<{ $success: boolean }>`
  font-size: 3rem;
  color: ${(props) =>
    props.$success ? theme.colors.semantic.success : theme.colors.semantic.error};
  margin-bottom: ${theme.space[4]};
`;

const ResultTitle = styled.h3`
  font-size: ${theme.fontSizes.h3};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin-bottom: ${theme.space[4]};
`;

const ResultStats = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[2]};
  margin-bottom: ${theme.space[4]};
`;

const StatRow = styled.div<{ $warning?: boolean }>`
  display: flex;
  gap: ${theme.space[3]};
  font-size: ${theme.fontSizes.body};
  color: ${(props) =>
    props.$warning ? theme.colors.semantic.warning : 'var(--color-text-secondary)'};

  strong {
    color: ${(props) =>
      props.$warning ? theme.colors.semantic.warning : 'var(--color-text-primary)'};
  }
`;

const FailedSongsList = styled.div`
  width: 100%;
  max-height: 150px;
  overflow-y: auto;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.base};
  padding: ${theme.space[3]};
  margin-bottom: ${theme.space[4]};
  text-align: left;
`;

const FailedSongsTitle = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.semantic.warning};
  margin-bottom: ${theme.space[2]};
`;

const FailedSongItem = styled.div`
  font-size: ${theme.fontSizes.bodyXs};
  color: var(--color-text-secondary);
  padding: ${theme.space[1]} 0;
  border-bottom: 1px solid var(--color-border-subtle);

  &:last-child {
    border-bottom: none;
  }
`;

const OpenPlaylistButton = styled.a`
  display: inline-flex;
  align-items: center;
  background: #ff0000;
  color: white;
  padding: ${theme.space[3]} ${theme.space[6]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  text-decoration: none;
  transition: all ${theme.transitions.fast} ease;

  &:hover {
    background: #cc0000;
    color: white;
    transform: translateY(-1px);
  }
`;

const YouTubeExistingPlaylist = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: ${theme.space[4]};
`;

const ExistingPlaylistIcon = styled.div`
  font-size: 3rem;
  color: ${theme.colors.semantic.success};
  margin-bottom: ${theme.space[4]};
`;

const ExistingPlaylistTitle = styled.h3`
  font-size: ${theme.fontSizes.h3};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin-bottom: ${theme.space[2]};
`;

const ExistingPlaylistText = styled.p`
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-secondary);
  margin-bottom: ${theme.space[6]};
  line-height: ${theme.lineHeights.relaxed};
`;

const CreateNewPlaylistLink = styled.button`
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  font-size: ${theme.fontSizes.bodySm};
  cursor: pointer;
  margin-top: ${theme.space[4]};
  display: flex;
  align-items: center;
  transition: all ${theme.transitions.fast} ease;

  &:hover {
    color: ${theme.colors.brand.primary};
  }
`;

const ErrorMessage = styled.p`
  font-size: ${theme.fontSizes.body};
  color: ${theme.colors.semantic.error};
  background: ${theme.colors.semantic.errorBgDark};
  border: 1px solid ${theme.colors.semantic.error};
  border-radius: ${theme.radius.base};
  padding: ${theme.space[3]} ${theme.space[4]};
  margin: 0;
`;

const YouTubeExportPreview = styled.div`
  padding: ${theme.space[4]};
`;

const PreviewTitle = styled.h3`
  font-size: ${theme.fontSizes.h3};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin-bottom: ${theme.space[2]};
`;

const PreviewText = styled.p`
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-secondary);
  margin-bottom: ${theme.space[4]};
  line-height: ${theme.lineHeights.relaxed};
`;

const PreviewStats = styled.div`
  display: flex;
  gap: ${theme.space[4]};
  margin-bottom: ${theme.space[4]};
`;

const PreviewStat = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  padding: ${theme.space[2]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-primary);

  i {
    color: #ff0000;
  }
`;

const PreviewNote = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-tertiary);
  background: var(--color-bg-tertiary);
  border-radius: ${theme.radius.base};
  padding: ${theme.space[3]};
  line-height: ${theme.lineHeights.relaxed};
`;

// Link to Show Modal Styles
const LinkModalDescription = styled.p`
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-secondary);
  margin-bottom: ${theme.space[4]};
  line-height: ${theme.lineHeights.relaxed};
`;

const NoShowsMessage = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: ${theme.space[6]};
`;

const NoShowsIcon = styled.div`
  font-size: 3rem;
  color: var(--color-text-tertiary);
  margin-bottom: ${theme.space[4]};
  opacity: 0.5;
`;

const NoShowsTitle = styled.h3`
  font-size: ${theme.fontSizes.h3};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin-bottom: ${theme.space[2]};
`;

const NoShowsText = styled.p`
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-secondary);
  margin-bottom: ${theme.space[6]};
  line-height: ${theme.lineHeights.relaxed};
`;

const CreateShowLink = styled.button`
  display: inline-flex;
  align-items: center;
  background: ${theme.colors.brand.primary};
  color: white;
  padding: ${theme.space[3]} ${theme.space[6]};
  border: none;
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  &:hover {
    background: ${theme.colors.brand.primaryHover};
    transform: translateY(-1px);
  }
`;

// AI Optimization Styles
const OptimizingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${theme.space[10]} 0;
  gap: ${theme.space[4]};
`;

const OptimizingText = styled.p`
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-secondary);
  margin: 0;
`;

const OptimizeErrorMessage = styled.div`
  background: ${theme.colors.semantic.errorBgDark};
  border: 1px solid ${theme.colors.semantic.error};
  border-radius: ${theme.radius.base};
  padding: ${theme.space[4]};
  color: ${theme.colors.semantic.error};
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};

  i {
    font-size: ${theme.fontSizes.h3};
  }
`;

const OptimizationSection = styled.div`
  margin-bottom: ${theme.space[5]};

  &:last-child {
    margin-bottom: 0;
  }
`;

const OptimizationSectionTitle = styled.h4`
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin: 0 0 ${theme.space[3]} 0;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};

  i {
    color: ${theme.colors.brand.primary};
  }
`;

const ReasoningText = styled.p`
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-secondary);
  line-height: ${theme.lineHeights.relaxed};
  margin: 0;
  background: var(--color-bg-tertiary);
  padding: ${theme.space[4]};
  border-radius: ${theme.radius.base};
  border-left: 3px solid ${theme.colors.brand.primary};
`;

const ChangesList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[3]};
`;

const ChangeItem = styled.div`
  display: flex;
  gap: ${theme.space[3]};
  padding: ${theme.space[3]};
  background: var(--color-bg-tertiary);
  border-radius: ${theme.radius.base};
`;

const ChangeIcon = styled.div`
  color: ${theme.colors.brand.primary};
  font-size: ${theme.fontSizes.bodyLg};
  flex-shrink: 0;
  margin-top: 2px;
`;

const ChangeContent = styled.div`
  flex: 1;
`;

const ChangeSongTitle = styled.div`
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin-bottom: ${theme.space[1]};
`;

const ChangeMove = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.brand.primary};
  margin-bottom: ${theme.space[1]};
`;

const ChangeReason = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
`;

const NewOrderList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[2]};
  max-height: 300px;
  overflow-y: auto;
`;

const NewOrderItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  padding: ${theme.space[2]} ${theme.space[3]};
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.sm};
`;

const NewOrderPosition = styled.div`
  background: ${theme.gradients.brandPrimary};
  color: white;
  width: 28px;
  height: 28px;
  border-radius: ${theme.radius.sm};
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: ${theme.fontWeights.semibold};
  font-size: ${theme.fontSizes.bodySm};
  flex-shrink: 0;
`;

const NewOrderSong = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-primary);

  span {
    color: var(--color-text-secondary);
  }
`;

export default SetlistDetailView;
