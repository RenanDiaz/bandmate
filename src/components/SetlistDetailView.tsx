import type { FC } from "react";
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Container, Spinner, Modal, ModalHeader, ModalBody, ModalFooter, Button, FormGroup, Label, Input } from "reactstrap";
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
import { getSetlist, updateSetlist, updateSetlistYouTubePlaylist, isSongItem, isBreakItem, isSectionItem } from "../services/setlistsService";
import type { Setlist, SetlistItem } from "../services/setlistsService";
import { getBandSongs } from "../services/songsService";
import type { Song } from "../services/songsService";
import { SEO } from "./SEO";
import { useTranslation } from "react-i18next";
import { youtubeService, type PlaylistCreationResult } from "../services/youtubeService";

// Forward declare styled components used in SortableSongCard
const SongCard = styled.div<{ $isDragging?: boolean }>`
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
  touch-action: none;

  &:hover {
    color: ${theme.colors.brand.primary};
  }

  &:active {
    cursor: grabbing;
    color: ${theme.colors.brand.primary};
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

// Sortable song card component for reorder mode
interface SortableSongCardProps {
  song: Song;
  index: number;
  notes?: string;
  formatDuration: (seconds: number) => string;
}

const SortableSongCard: FC<SortableSongCardProps> = ({
  song,
  index,
  notes,
  formatDuration,
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
    </SongCard>
  );
};

const SetlistDetailView: FC = () => {
  const { setlistId } = useParams<{ setlistId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [setlistItems, setSetlistItems] = useState<SetlistItem[]>([]);
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [saving, setSaving] = useState(false);

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
  const [exportOptions, setExportOptions] = useState({
    includeDescription: true,
    includeSongCount: true,
    includeTotalDuration: true,
    includeArtist: true,
    includeKey: true,
    includeTempo: true,
    includeDuration: true,
    includeNotes: true,
  });

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

  // Get only song items for reordering
  const songItemsOnly = setlistItems.filter(isSongItem);
  const songsForReorder = songItemsOnly
    .map((item) => getSongById(item.song_id))
    .filter((song): song is Song => song !== undefined);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = songsForReorder.findIndex((song) => song.id === active.id);
      const newIndex = songsForReorder.findIndex((song) => song.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedSongs = arrayMove(songsForReorder, oldIndex, newIndex);

        // Update setlistItems with new song order
        const newSongItems: SetlistItem[] = reorderedSongs.map((song, index) => {
          const existingItem = songItemsOnly.find((item) => item.song_id === song.id);
          return {
            type: "song" as const,
            song_id: song.id,
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
      }
    }
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
      alert("Failed to save order. Please try again.");
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

        // Load all items in order
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

      const result = await youtubeService.createPlaylistFromSetlist(
        setlist.name,
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
      alert(t("youtubeMusic.authError"));
    }
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

  const handleExportAsText = () => {
    if (!setlist) return;

    // Build the text content
    let textContent = `${setlist.name}\n`;
    textContent += "=".repeat(setlist.name.length) + "\n\n";

    if (exportOptions.includeDescription && setlist.description) {
      textContent += `${setlist.description}\n\n`;
    }

    if (exportOptions.includeSongCount) {
      textContent += `Songs: ${songItemsOnly.length}\n`;
    }

    const totalDuration = calculateTotalDuration();
    if (exportOptions.includeTotalDuration && totalDuration > 0) {
      textContent += `Total Duration: ${formatDuration(totalDuration)}\n`;
    }

    if (exportOptions.includeSongCount || (exportOptions.includeTotalDuration && totalDuration > 0)) {
      textContent += "\n";
    }

    textContent += "SETLIST\n";
    textContent += "-".repeat(50) + "\n\n";

    // Export only songs (not special items) for the text export
    songsForReorder.forEach((song, index) => {
      textContent += `${index + 1}. ${song.title}`;
      if (exportOptions.includeArtist && song.artist) {
        textContent += ` - ${song.artist}`;
      }
      textContent += "\n";

      const metadata = [];
      if (exportOptions.includeKey && song.key) metadata.push(`Key: ${song.key}`);
      if (exportOptions.includeTempo && song.tempo) metadata.push(`Tempo: ${song.tempo} BPM`);
      if (exportOptions.includeDuration && song.duration) metadata.push(`Duration: ${formatDuration(song.duration)}`);

      if (metadata.length > 0) {
        textContent += `   ${metadata.join(" | ")}\n`;
      }

      const notes = getSetlistSongNotes(song.id);
      if (exportOptions.includeNotes && notes) {
        textContent += `   Note: ${notes}\n`;
      }

      textContent += "\n";
    });

    // Create a blob and download it
    const blob = new Blob([textContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${setlist.name.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // Close the modal
    setShowExportModal(false);
  };

  const toggleExportOption = (option: keyof typeof exportOptions) => {
    setExportOptions((prev) => ({
      ...prev,
      [option]: !prev[option],
    }));
  };

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
        <Header>
          <HeaderTop>
            <BackLink onClick={() => navigate("/setlists")}>
              <i className="bi bi-arrow-left"></i>
              {t('setlists.detail.backToSetlists')}
            </BackLink>
            <ActionButtons>
              {isReorderMode ? (
                <>
                  <ActionButton
                    onClick={handleCancelReorder}
                    $variant="edit"
                    disabled={saving}
                  >
                    <i className="bi bi-x-lg"></i>
                    {t('common.cancel')}
                  </ActionButton>
                  <ActionButton
                    onClick={handleSaveOrder}
                    $variant="perform"
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <Spinner size="sm" style={{ marginRight: "8px" }} />
                        {t('common.saving')}
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-lg"></i>
                        {t('setlists.detail.saveOrder')}
                      </>
                    )}
                  </ActionButton>
                </>
              ) : (
                <>
                  <ActionButton
                    onClick={() => setIsReorderMode(true)}
                    $variant="edit"
                    disabled={songsForReorder.length < 2}
                    title={t('setlists.detail.reorder')}
                  >
                    <i className="bi bi-arrow-down-up"></i>
                    {t('setlists.detail.reorder')}
                  </ActionButton>
                  <ActionButton
                    onClick={() => navigate(`/setlists/${setlistId}/edit`)}
                    $variant="edit"
                  >
                    <i className="bi bi-pencil"></i>
                    {t('setlists.editSetlist')}
                  </ActionButton>
                  <ActionButton
                    onClick={() => navigate(`/setlists/${setlistId}/print`)}
                    $variant="edit"
                    disabled={setlistItems.length === 0}
                    title={t('setlists.print')}
                  >
                    <i className="bi bi-printer"></i>
                    {t('setlists.print')}
                  </ActionButton>
                  <ActionButton
                    onClick={() => setShowExportModal(true)}
                    $variant="edit"
                    disabled={songItemsOnly.length === 0}
                    title={t('setlists.export')}
                  >
                    <i className="bi bi-file-text"></i>
                    {t('setlists.export')}
                  </ActionButton>
                  <ActionButton
                    onClick={() => setShowYouTubeModal(true)}
                    $variant="edit"
                    disabled={songItemsOnly.length === 0}
                    title={t("youtubeMusic.exportToYouTube")}
                  >
                    <i className="bi bi-youtube"></i>
                    YouTube
                  </ActionButton>
                  <ActionButton
                    onClick={() => navigate(`/setlists/${setlistId}/perform`)}
                    $variant="perform"
                    disabled={setlistItems.length === 0}
                  >
                    <i className="bi bi-play-circle"></i>
                    {t('setlists.detail.startPerformance')}
                  </ActionButton>
                </>
              )}
            </ActionButtons>
          </HeaderTop>

          <SetlistTitle>{setlist.name}</SetlistTitle>

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
          </MetadataBar>
        </Header>

        {isReorderMode && (
          <ReorderBanner>
            <i className="bi bi-info-circle"></i>
            {t('setlists.detail.reorderHint')}
          </ReorderBanner>
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
                items={songsForReorder.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                {songsForReorder.map((song, index) => (
                  <SortableSongCard
                    key={song.id}
                    song={song}
                    index={index}
                    notes={getSetlistSongNotes(song.id)}
                    formatDuration={formatDuration}
                  />
                ))}
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

      {/* Export Options Modal */}
      <Modal isOpen={showExportModal} toggle={() => setShowExportModal(false)} size="lg">
        <ModalHeader toggle={() => setShowExportModal(false)}>
          {t('setlists.export.title')}
        </ModalHeader>
        <ModalBody>
          <ExportOptionsContainer>
            <OptionSection>
              <SectionTitle>{t('setlists.export.setlistInfo')}</SectionTitle>
              <FormGroup check>
                <Input
                  type="checkbox"
                  id="includeDescription"
                  checked={exportOptions.includeDescription}
                  onChange={() => toggleExportOption("includeDescription")}
                  disabled={!setlist?.description}
                />
                <Label check for="includeDescription">
                  {t('setlists.export.includeDescription')}
                  {!setlist?.description && <DisabledNote>{t('setlists.export.noDescription')}</DisabledNote>}
                </Label>
              </FormGroup>
              <FormGroup check>
                <Input
                  type="checkbox"
                  id="includeSongCount"
                  checked={exportOptions.includeSongCount}
                  onChange={() => toggleExportOption("includeSongCount")}
                />
                <Label check for="includeSongCount">
                  {t('setlists.export.includeSongCount')}
                </Label>
              </FormGroup>
              <FormGroup check>
                <Input
                  type="checkbox"
                  id="includeTotalDuration"
                  checked={exportOptions.includeTotalDuration}
                  onChange={() => toggleExportOption("includeTotalDuration")}
                  disabled={calculateTotalDuration() === 0}
                />
                <Label check for="includeTotalDuration">
                  {t('setlists.export.includeTotalDuration')}
                  {calculateTotalDuration() === 0 && <DisabledNote>{t('setlists.export.noDurations')}</DisabledNote>}
                </Label>
              </FormGroup>
            </OptionSection>

            <OptionSection>
              <SectionTitle>{t('setlists.export.songDetails')}</SectionTitle>
              <FormGroup check>
                <Input
                  type="checkbox"
                  id="includeArtist"
                  checked={exportOptions.includeArtist}
                  onChange={() => toggleExportOption("includeArtist")}
                />
                <Label check for="includeArtist">
                  {t('setlists.export.includeArtist')}
                </Label>
              </FormGroup>
              <FormGroup check>
                <Input
                  type="checkbox"
                  id="includeKey"
                  checked={exportOptions.includeKey}
                  onChange={() => toggleExportOption("includeKey")}
                />
                <Label check for="includeKey">
                  {t('setlists.export.includeKey')}
                </Label>
              </FormGroup>
              <FormGroup check>
                <Input
                  type="checkbox"
                  id="includeTempo"
                  checked={exportOptions.includeTempo}
                  onChange={() => toggleExportOption("includeTempo")}
                />
                <Label check for="includeTempo">
                  {t('setlists.export.includeTempo')}
                </Label>
              </FormGroup>
              <FormGroup check>
                <Input
                  type="checkbox"
                  id="includeDuration"
                  checked={exportOptions.includeDuration}
                  onChange={() => toggleExportOption("includeDuration")}
                />
                <Label check for="includeDuration">
                  {t('setlists.export.includeDuration')}
                </Label>
              </FormGroup>
              <FormGroup check>
                <Input
                  type="checkbox"
                  id="includeNotes"
                  checked={exportOptions.includeNotes}
                  onChange={() => toggleExportOption("includeNotes")}
                />
                <Label check for="includeNotes">
                  {t('setlists.export.includeNotes')}
                </Label>
              </FormGroup>
            </OptionSection>
          </ExportOptionsContainer>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={() => setShowExportModal(false)}>
            {t('common.cancel')}
          </Button>
          <Button color="primary" onClick={handleExportAsText}>
            <i className="bi bi-download"></i> {t('setlists.export')}
          </Button>
        </ModalFooter>
      </Modal>

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

const HeaderTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${theme.space[6]};

  @media (max-width: ${theme.breakpoints.md}) {
    flex-direction: column;
    align-items: flex-start;
    gap: ${theme.space[4]};
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

  &:hover {
    color: ${theme.colors.brand.primary};
  }

  i {
    font-size: ${theme.fontSizes.bodyLg};
  }
`;

const ActionButtons = styled.div`
  display: flex;
  gap: ${theme.space[3]};

  @media (max-width: ${theme.breakpoints.md}) {
    width: 100%;
    flex-direction: column;
  }
`;

const ActionButton = styled.button<{ $variant: "edit" | "perform" }>`
  background: ${(props) =>
    props.$variant === "perform" ? theme.colors.semantic.success : theme.colors.brand.primary};
  border: none;
  color: white;
  padding: ${theme.space[3]} ${theme.space[5]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};

  i {
    font-size: ${theme.fontSizes.bodyLg};
  }

  &:hover:not(:disabled) {
    background: ${(props) =>
      props.$variant === "perform"
        ? "#059669" // Darker green for hover (success hover)
        : theme.colors.brand.primaryHover};
    transform: translateY(-1px);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: ${theme.breakpoints.md}) {
    justify-content: center;
  }
`;

const SetlistTitle = styled.h1`
  font-size: ${theme.fontSizes.displayMd};
  font-weight: ${theme.fontWeights.bold};
  color: var(--color-text-primary);
  margin: 0 0 ${theme.space[4]} 0;
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

const ReorderBanner = styled.div`
  background: ${theme.colors.brand.primary}20;
  border: 1px solid ${theme.colors.brand.primary};
  border-radius: ${theme.radius.base};
  padding: ${theme.space[3]} ${theme.space[4]};
  margin-bottom: ${theme.space[4]};
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  font-size: ${theme.fontSizes.body};
  color: ${theme.colors.brand.primary};
  font-weight: ${theme.fontWeights.medium};

  i {
    font-size: ${theme.fontSizes.bodyLg};
  }
`;

const SongsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[3]};
`;

const ExportOptionsContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${theme.space[6]};

  @media (max-width: ${theme.breakpoints.md}) {
    grid-template-columns: 1fr;
  }
`;

const OptionSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[3]};
`;

const SectionTitle = styled.h3`
  font-size: ${theme.fontSizes.bodyLg};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin: 0 0 ${theme.space[2]} 0;
  padding-bottom: ${theme.space[2]};
  border-bottom: 1px solid var(--color-border);
`;

const DisabledNote = styled.span`
  font-size: ${theme.fontSizes.bodyXs};
  color: var(--color-text-tertiary);
  font-style: italic;
  margin-left: ${theme.space[2]};
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

export default SetlistDetailView;
