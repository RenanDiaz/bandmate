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
import { getSetlist, updateSetlist, isSongItem, isBreakItem, isSectionItem } from "../services/setlistsService";
import type { Setlist, SetlistItem } from "../services/setlistsService";
import { getBandSongs } from "../services/songsService";
import type { Song } from "../services/songsService";
import { SEO } from "./SEO";
import { useTranslation } from "react-i18next";

// Forward declare styled components used in SortableSongCard
const SongCard = styled.div<{ $isDragging?: boolean }>`
  background: ${(props) =>
    props.$isDragging ? theme.colors.dark.bg.elevated : theme.colors.dark.bg.secondary};
  border: 1px solid ${(props) =>
    props.$isDragging ? theme.colors.brand.primary : theme.colors.dark.border.default};
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
    box-shadow: ${theme.shadows.sm};
  }

  @media (max-width: ${theme.breakpoints.md}) {
    flex-direction: column;
    gap: ${theme.space[3]};
  }
`;

const DragHandle = styled.button`
  background: transparent;
  border: none;
  color: ${theme.colors.dark.text.tertiary};
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
  border: 2px solid ${theme.colors.dark.bg.secondary};
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 10px;
  box-shadow: ${theme.shadows.sm};
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
  color: ${theme.colors.dark.text.primary};
  margin-bottom: ${theme.space[1]};
`;

const SongArtist = styled.div`
  font-size: ${theme.fontSizes.body};
  color: ${theme.colors.dark.text.secondary};
  margin-bottom: ${theme.space[2]};
`;

const SongNotes = styled.div`
  background: ${theme.colors.semantic.warningBgDark};
  border: 1px solid ${theme.colors.semantic.warning};
  border-radius: ${theme.radius.sm};
  padding: ${theme.space[2]} ${theme.space[3]};
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.dark.text.primary};
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
  background: ${theme.colors.dark.bg.tertiary};
  border: 1px solid ${theme.colors.dark.border.default};
  color: ${theme.colors.dark.text.secondary};
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
        <LoadingText>Loading setlist...</LoadingText>
      </LoadingContainer>
    );
  }

  if (!setlist) {
    return (
      <ErrorContainer>
        <ErrorIcon>
          <i className="bi bi-exclamation-triangle"></i>
        </ErrorIcon>
        <ErrorTitle>Setlist Not Found</ErrorTitle>
        <ErrorText>The setlist you're looking for doesn't exist or has been deleted.</ErrorText>
        <BackButton onClick={() => navigate("/setlists")}>
          <i className="bi bi-arrow-left"></i>
          Back to Setlists
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
              Back to Setlists
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
                    Cancel
                  </ActionButton>
                  <ActionButton
                    onClick={handleSaveOrder}
                    $variant="perform"
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <Spinner size="sm" style={{ marginRight: "8px" }} />
                        Saving...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-lg"></i>
                        Save Order
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
                    title={songsForReorder.length < 2 ? "Need at least 2 songs to reorder" : "Reorder songs"}
                  >
                    <i className="bi bi-arrow-down-up"></i>
                    Reorder
                  </ActionButton>
                  <ActionButton
                    onClick={() => navigate(`/setlists/${setlistId}/edit`)}
                    $variant="edit"
                  >
                    <i className="bi bi-pencil"></i>
                    Edit Setlist
                  </ActionButton>
                  <ActionButton
                    onClick={() => navigate(`/setlists/${setlistId}/print`)}
                    $variant="edit"
                    disabled={setlistItems.length === 0}
                    title="Print setlist"
                  >
                    <i className="bi bi-printer"></i>
                    Print
                  </ActionButton>
                  <ActionButton
                    onClick={() => setShowExportModal(true)}
                    $variant="edit"
                    disabled={songItemsOnly.length === 0}
                    title="Export as text file"
                  >
                    <i className="bi bi-file-text"></i>
                    Export
                  </ActionButton>
                  <ActionButton
                    onClick={() => navigate(`/setlists/${setlistId}/perform`)}
                    $variant="perform"
                    disabled={setlistItems.length === 0}
                  >
                    <i className="bi bi-play-circle"></i>
                    Start Performance
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
              {songItemsOnly.length} {songItemsOnly.length === 1 ? "song" : "songs"}
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
            Drag songs to reorder. Click "Save Order" when done.
          </ReorderBanner>
        )}

        {setlistItems.length === 0 ? (
          <EmptyState>
            <EmptyIcon>
              <i className="bi bi-music-note-list"></i>
            </EmptyIcon>
            <EmptyTitle>No Songs Yet</EmptyTitle>
            <EmptyText>This setlist doesn't have any songs. Click "Edit Setlist" to add songs.</EmptyText>
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
          Export Setlist Options
        </ModalHeader>
        <ModalBody>
          <ExportOptionsContainer>
            <OptionSection>
              <SectionTitle>Setlist Information</SectionTitle>
              <FormGroup check>
                <Input
                  type="checkbox"
                  id="includeDescription"
                  checked={exportOptions.includeDescription}
                  onChange={() => toggleExportOption("includeDescription")}
                  disabled={!setlist?.description}
                />
                <Label check for="includeDescription">
                  Include description
                  {!setlist?.description && <DisabledNote>(no description)</DisabledNote>}
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
                  Include song count
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
                  Include total duration
                  {calculateTotalDuration() === 0 && <DisabledNote>(no durations)</DisabledNote>}
                </Label>
              </FormGroup>
            </OptionSection>

            <OptionSection>
              <SectionTitle>Song Details</SectionTitle>
              <FormGroup check>
                <Input
                  type="checkbox"
                  id="includeArtist"
                  checked={exportOptions.includeArtist}
                  onChange={() => toggleExportOption("includeArtist")}
                />
                <Label check for="includeArtist">
                  Include artist names
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
                  Include song keys
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
                  Include tempo (BPM)
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
                  Include song durations
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
                  Include song notes
                </Label>
              </FormGroup>
            </OptionSection>
          </ExportOptionsContainer>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={() => setShowExportModal(false)}>
            Cancel
          </Button>
          <Button color="primary" onClick={handleExportAsText}>
            <i className="bi bi-download"></i> Export
          </Button>
        </ModalFooter>
      </Modal>
    </ViewContainer>
  );
};

// Styled Components

const ViewContainer = styled.div`
  min-height: calc(100vh - 72px);
  background: ${theme.colors.dark.bg.primary};
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
  color: ${theme.colors.dark.text.secondary};
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
  color: ${theme.colors.dark.text.primary};
  margin: 0;
`;

const ErrorText = styled.p`
  font-size: ${theme.fontSizes.body};
  color: ${theme.colors.dark.text.secondary};
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
  background: ${theme.colors.dark.bg.secondary};
  border: 1px solid ${theme.colors.dark.border.default};
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
  color: ${theme.colors.dark.text.secondary};
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
  color: ${theme.colors.dark.text.primary};
  margin: 0 0 ${theme.space[4]} 0;
  line-height: ${theme.lineHeights.tight};

  @media (max-width: ${theme.breakpoints.md}) {
    font-size: ${theme.fontSizes.h1};
  }
`;

const SetlistDescription = styled.p`
  font-size: ${theme.fontSizes.body};
  color: ${theme.colors.dark.text.secondary};
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
  background: ${theme.colors.dark.bg.tertiary};
  border: 1px solid ${theme.colors.dark.border.default};
  color: ${theme.colors.dark.text.primary};
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
  background: ${theme.colors.dark.bg.secondary};
  border: 1px solid ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.lg};
  padding: ${theme.space[12]} ${theme.space[6]};
  text-align: center;
`;

const EmptyIcon = styled.div`
  font-size: ${theme.fontSizes.displayLg};
  color: ${theme.colors.dark.text.tertiary};
  margin-bottom: ${theme.space[4]};
  opacity: 0.5;
`;

const EmptyTitle = styled.h3`
  font-size: ${theme.fontSizes.h3};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.dark.text.primary};
  margin: 0 0 ${theme.space[2]} 0;
`;

const EmptyText = styled.p`
  font-size: ${theme.fontSizes.body};
  color: ${theme.colors.dark.text.secondary};
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
  color: ${theme.colors.dark.text.primary};
  margin: 0 0 ${theme.space[2]} 0;
  padding-bottom: ${theme.space[2]};
  border-bottom: 1px solid ${theme.colors.dark.border.default};
`;

const DisabledNote = styled.span`
  font-size: ${theme.fontSizes.bodyXs};
  color: ${theme.colors.dark.text.tertiary};
  font-style: italic;
  margin-left: ${theme.space[2]};
`;

// Special item card styles
const SpecialItemCard = styled.div<{ $type: string }>`
  background: ${theme.colors.dark.bg.secondary};
  border: 1px solid ${theme.colors.dark.border.default};
  border-left: 3px solid ${(props) => {
    switch (props.$type) {
      case "break":
        return theme.colors.semantic.warning;
      case "section":
        return theme.colors.semantic.info;
      case "note":
        return theme.colors.semantic.success;
      default:
        return theme.colors.dark.border.default;
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
    box-shadow: ${theme.shadows.sm};
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
        return theme.colors.dark.bg.tertiary;
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
        return theme.colors.dark.text.secondary;
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
  color: ${theme.colors.dark.text.tertiary};
  text-transform: uppercase;
  letter-spacing: ${theme.letterSpacing.wide};
`;

const SpecialItemLabel = styled.div`
  font-size: ${theme.fontSizes.bodyLg};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.dark.text.primary};
`;

const SpecialItemDuration = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.dark.text.secondary};
  display: flex;
  align-items: center;
  gap: ${theme.space[1]};

  i {
    color: ${theme.colors.semantic.warning};
  }
`;

export default SetlistDetailView;
