import type { FC } from "react";
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Container, Spinner } from "reactstrap";
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
import { getSetlist, updateSetlist } from "../services/setlistsService";
import type { Setlist, SetlistSong } from "../services/setlistsService";
import { getBandSongs } from "../services/songsService";
import type { Song } from "../services/songsService";

// Sortable song card component
interface SortableSetlistSongCardProps {
  setlistSong: SetlistSong;
  index: number;
  song: Song;
  formatDuration: (seconds: number) => string;
  onUpdateNotes: (position: number, notes: string) => void;
  onRemove: (position: number) => void;
  totalSongs: number;
}

const SortableSetlistSongCard: FC<SortableSetlistSongCardProps> = ({
  setlistSong,
  index,
  song,
  formatDuration,
  onUpdateNotes,
  onRemove,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: setlistSong.song_id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <SetlistSongCard
      ref={setNodeRef}
      style={style}
      $isDragging={isDragging}
    >
      <DragHandle {...attributes} {...listeners}>
        <i className="bi bi-grip-vertical"></i>
      </DragHandle>
      <SongPosition>{index + 1}</SongPosition>
      <SongDetails>
        <SongTitle>{song.title}</SongTitle>
        {song.artist && <SongArtist>{song.artist}</SongArtist>}
        <SongMetadata>
          {song.key && <MetaBadge>{song.key}</MetaBadge>}
          {song.tempo && <MetaBadge>{song.tempo} BPM</MetaBadge>}
          {song.duration && <MetaBadge>{formatDuration(song.duration)}</MetaBadge>}
        </SongMetadata>
        <NotesInput
          placeholder="Add notes for this song..."
          value={setlistSong.notes || ""}
          onChange={(e) => onUpdateNotes(index, e.target.value)}
        />
      </SongDetails>
      <SongActions>
        <ActionButton
          onClick={() => onRemove(index)}
          title="Remove from setlist"
          $variant="delete"
        >
          <i className="bi bi-trash"></i>
        </ActionButton>
      </SongActions>
    </SetlistSongCard>
  );
};

const SetlistEditor: FC = () => {
  const { setlistId } = useParams<{ setlistId: string }>();
  const navigate = useNavigate();

  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [availableSongs, setAvailableSongs] = useState<Song[]>([]);
  const [selectedSongs, setSelectedSongs] = useState<SetlistSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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
      setSelectedSongs((items) => {
        const oldIndex = items.findIndex((item) => item.song_id === active.id);
        const newIndex = items.findIndex((item) => item.song_id === over.id);

        const reordered = arrayMove(items, oldIndex, newIndex);
        // Reindex positions
        return reordered.map((song, index) => ({
          ...song,
          position: index,
        }));
      });
    }
  };

  useEffect(() => {
    if (!setlistId) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const setlistData = await getSetlist(setlistId);
        setSetlist(setlistData);
        setSelectedSongs(setlistData.songs || []);

        const songsData = await getBandSongs(setlistData.band_id);
        setAvailableSongs(songsData);
      } catch (error) {
        console.error("Failed to load setlist:", error);
        alert("Failed to load setlist. Please try again.");
        navigate("/setlists");
      }
      setLoading(false);
    };

    loadData();
  }, [setlistId, navigate]);

  const handleSave = async () => {
    if (!setlist) return;

    setSaving(true);
    try {
      await updateSetlist(setlist.id, {
        songs: selectedSongs,
      });
      navigate("/setlists");
    } catch (error) {
      console.error("Failed to save setlist:", error);
      alert("Failed to save setlist. Please try again.");
    }
    setSaving(false);
  };

  const handleAddSong = (song: Song) => {
    const isAlreadyAdded = selectedSongs.some((s) => s.song_id === song.id);
    if (isAlreadyAdded) return;

    const newSong: SetlistSong = {
      song_id: song.id,
      position: selectedSongs.length,
      notes: "",
    };

    setSelectedSongs([...selectedSongs, newSong]);
  };

  const handleRemoveSong = (position: number) => {
    const filtered = selectedSongs.filter((s) => s.position !== position);
    // Reindex positions
    const reindexed = filtered.map((song, index) => ({
      ...song,
      position: index,
    }));
    setSelectedSongs(reindexed);
  };

  const handleUpdateNotes = (position: number, notes: string) => {
    const updated = selectedSongs.map((song) =>
      song.position === position ? { ...song, notes } : song
    );
    setSelectedSongs(updated);
  };

  const getSongById = (songId: string): Song | undefined => {
    return availableSongs.find((s) => s.id === songId);
  };

  const filteredAvailableSongs = availableSongs
    .filter((song) => {
      // Hide songs already added to the setlist
      const isAlreadyAdded = selectedSongs.some((s) => s.song_id === song.id);
      if (isAlreadyAdded) return false;

      // Filter by search query
      const query = searchQuery.toLowerCase();
      return (
        song.title.toLowerCase().includes(query) ||
        (song.artist && song.artist.toLowerCase().includes(query))
      );
    })
    // Sort by artist then title
    .sort((a, b) => {
      const artistA = a.artist || "";
      const artistB = b.artist || "";
      const artistCompare = artistA.localeCompare(artistB, undefined, { sensitivity: "base" });
      if (artistCompare !== 0) return artistCompare;
      return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
    });

  const calculateTotalDuration = (): number => {
    return selectedSongs.reduce((total, setlistSong) => {
      const song = getSongById(setlistSong.song_id);
      return total + (song?.duration || 0);
    }, 0);
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <PageWrapper>
        <Container>
          <LoadingContainer>
            <Spinner color="primary" style={{ width: "3rem", height: "3rem" }} />
            <LoadingText>Loading setlist editor...</LoadingText>
          </LoadingContainer>
        </Container>
      </PageWrapper>
    );
  }

  if (!setlist) {
    return (
      <PageWrapper>
        <Container>
          <MessageCard>
            <MessageIcon>
              <i className="bi bi-exclamation-triangle"></i>
            </MessageIcon>
            <MessageTitle>Setlist Not Found</MessageTitle>
            <MessageText>The requested setlist could not be found.</MessageText>
          </MessageCard>
        </Container>
      </PageWrapper>
    );
  }

  const totalDuration = calculateTotalDuration();

  return (
    <PageWrapper>
      <Container>
        <Header>
          <HeaderLeft>
            <BackButton onClick={() => navigate("/setlists")}>
              <i className="bi bi-arrow-left"></i>
            </BackButton>
            <HeaderInfo>
              <SetlistTitle>{setlist.name}</SetlistTitle>
              {setlist.venue && (
                <SetlistMeta>
                  <i className="bi bi-geo-alt"></i> {setlist.venue}
                </SetlistMeta>
              )}
              {setlist.event_date && (
                <SetlistMeta>
                  <i className="bi bi-calendar-event"></i>{" "}
                  {new Date(setlist.event_date).toLocaleDateString()}
                </SetlistMeta>
              )}
            </HeaderInfo>
          </HeaderLeft>
          <HeaderActions>
            <CancelButton onClick={() => navigate("/setlists")} disabled={saving}>
              Cancel
            </CancelButton>
            <SaveButton onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Spinner size="sm" style={{ marginRight: "8px" }} />
                  Saving...
                </>
              ) : (
                <>
                  <i className="bi bi-check-circle"></i>
                  Save Setlist
                </>
              )}
            </SaveButton>
          </HeaderActions>
        </Header>

        <EditorGrid>
          <SongLibraryPanel>
            <PanelHeader>
              <PanelTitle>
                <i className="bi bi-music-note-beamed"></i>
                Song Library
              </PanelTitle>
              <PanelStats>{filteredAvailableSongs.length} available</PanelStats>
            </PanelHeader>

            <SearchBox>
              <i className="bi bi-search"></i>
              <SearchInput
                type="text"
                placeholder="Search songs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </SearchBox>

            <SongLibraryList>
              {filteredAvailableSongs.length === 0 ? (
                <EmptyMessage>
                  {searchQuery
                    ? "No songs match your search"
                    : selectedSongs.length === availableSongs.length
                    ? "All songs added to setlist"
                    : "No songs in library"}
                </EmptyMessage>
              ) : (
                filteredAvailableSongs.map((song) => (
                  <LibrarySongCard key={song.id}>
                    <SongInfo>
                      <SongTitle>{song.title}</SongTitle>
                      {song.artist && <SongArtist>{song.artist}</SongArtist>}
                      <SongMetadata>
                        {song.key && <MetaBadge>{song.key}</MetaBadge>}
                        {song.tempo && <MetaBadge>{song.tempo} BPM</MetaBadge>}
                        {song.duration && <MetaBadge>{formatDuration(song.duration)}</MetaBadge>}
                      </SongMetadata>
                    </SongInfo>
                    <AddButton
                      onClick={() => handleAddSong(song)}
                      title="Add to setlist"
                    >
                      <i className="bi bi-plus-circle"></i>
                    </AddButton>
                  </LibrarySongCard>
                ))
              )}
            </SongLibraryList>
          </SongLibraryPanel>

          <SetlistPanel>
            <PanelHeader>
              <PanelTitle>
                <i className="bi bi-music-note-list"></i>
                Setlist
              </PanelTitle>
              <PanelStats>
                {selectedSongs.length} songs
                {totalDuration > 0 && <> · {formatDuration(totalDuration)}</>}
              </PanelStats>
            </PanelHeader>

            <SetlistSongsList>
              {selectedSongs.length === 0 ? (
                <EmptyState>
                  <EmptyIcon>
                    <i className="bi bi-music-note-list"></i>
                  </EmptyIcon>
                  <EmptyTitle>No songs in setlist</EmptyTitle>
                  <EmptyText>Add songs from the library on the left</EmptyText>
                </EmptyState>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={selectedSongs.map((s) => s.song_id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {selectedSongs.map((setlistSong, index) => {
                      const song = getSongById(setlistSong.song_id);
                      if (!song) return null;

                      return (
                        <SortableSetlistSongCard
                          key={setlistSong.song_id}
                          setlistSong={setlistSong}
                          index={index}
                          song={song}
                          formatDuration={formatDuration}
                          onUpdateNotes={handleUpdateNotes}
                          onRemove={handleRemoveSong}
                          totalSongs={selectedSongs.length}
                        />
                      );
                    })}
                  </SortableContext>
                </DndContext>
              )}
            </SetlistSongsList>
          </SetlistPanel>
        </EditorGrid>
      </Container>
    </PageWrapper>
  );
};

// Styled Components

const PageWrapper = styled.div`
  min-height: calc(100vh - 80px);
  background: ${theme.colors.dark.bg.primary};
  padding: ${theme.space[6]} 0;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${theme.space[4]};
  margin-bottom: ${theme.space[6]};
  padding-bottom: ${theme.space[4]};
  border-bottom: 1px solid ${theme.colors.dark.border.default};

  @media (max-width: ${theme.breakpoints.md}) {
    flex-direction: column;
    align-items: flex-start;
  }
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[4]};
`;

const BackButton = styled.button`
  background: ${theme.colors.dark.bg.secondary};
  border: 1px solid ${theme.colors.dark.border.default};
  color: ${theme.colors.dark.text.primary};
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
    background: ${theme.colors.dark.bg.elevated};
    border-color: ${theme.colors.brand.primary};
    color: ${theme.colors.brand.primary};
    transform: translateY(-1px);
  }
`;

const HeaderInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[1]};
`;

const SetlistTitle = styled.h1`
  font-size: ${theme.fontSizes.h2};
  font-weight: ${theme.fontWeights.bold};
  color: ${theme.colors.dark.text.primary};
  margin: 0;
  line-height: ${theme.lineHeights.tight};
`;

const SetlistMeta = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.dark.text.secondary};
  display: flex;
  align-items: center;
  gap: ${theme.space[1]};

  i {
    color: ${theme.colors.brand.primary};
  }
`;

const HeaderActions = styled.div`
  display: flex;
  gap: ${theme.space[3]};

  @media (max-width: ${theme.breakpoints.md}) {
    width: 100%;
  }
`;

const CancelButton = styled.button`
  background: transparent;
  border: 1px solid ${theme.colors.dark.border.default};
  color: ${theme.colors.dark.text.primary};
  padding: ${theme.space[3]} ${theme.space[5]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  &:hover:not(:disabled) {
    background: ${theme.colors.dark.bg.elevated};
    border-color: ${theme.colors.dark.border.strong};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const SaveButton = styled.button`
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

  i {
    font-size: ${theme.fontSizes.bodyLg};
  }

  &:hover:not(:disabled) {
    background: ${theme.colors.brand.primaryHover};
    transform: translateY(-1px);
    box-shadow: ${theme.shadows.md};
  }

  &:disabled {
    background: ${theme.colors.dark.bg.elevated};
    color: ${theme.colors.dark.text.disabled};
    cursor: not-allowed;
  }
`;

const EditorGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${theme.space[6]};
  max-width: 1400px;
  margin: 0 auto;

  @media (max-width: ${theme.breakpoints.lg}) {
    grid-template-columns: 1fr;
  }
`;

const SongLibraryPanel = styled.div`
  background: ${theme.colors.dark.bg.secondary};
  border: 1px solid ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.lg};
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 280px);
  overflow: hidden;
`;

const SetlistPanel = styled.div`
  background: ${theme.colors.dark.bg.secondary};
  border: 1px solid ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.lg};
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 280px);
  overflow: hidden;
`;

const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${theme.space[5]};
  border-bottom: 1px solid ${theme.colors.dark.border.default};
`;

const PanelTitle = styled.h2`
  font-size: ${theme.fontSizes.h3};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.dark.text.primary};
  margin: 0;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};

  i {
    color: ${theme.colors.brand.primary};
  }
`;

const PanelStats = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.dark.text.secondary};
  font-weight: ${theme.fontWeights.medium};
`;

const SearchBox = styled.div`
  padding: ${theme.space[4]} ${theme.space[5]};
  border-bottom: 1px solid ${theme.colors.dark.border.default};
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};

  i {
    color: ${theme.colors.dark.text.tertiary};
    font-size: ${theme.fontSizes.body};
  }
`;

const SearchInput = styled.input`
  flex: 1;
  background: transparent;
  border: none;
  color: ${theme.colors.dark.text.primary};
  font-size: ${theme.fontSizes.body};
  outline: none;
  font-family: ${theme.fonts.sans};

  &::placeholder {
    color: ${theme.colors.dark.text.tertiary};
  }
`;

const SongLibraryList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${theme.space[4]};
  display: flex;
  flex-direction: column;
  gap: ${theme.space[3]};
`;

const SetlistSongsList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${theme.space[4]};
  display: flex;
  flex-direction: column;
  gap: ${theme.space[3]};
`;

const LibrarySongCard = styled.div`
  background: ${theme.colors.dark.bg.primary};
  border: 1px solid ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.base};
  padding: ${theme.space[3]};
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  transition: all ${theme.transitions.fast} ease;

  &:hover {
    border-color: ${theme.colors.brand.primary};
  }
`;

const SetlistSongCard = styled.div<{ $isDragging?: boolean }>`
  background: ${(props) =>
    props.$isDragging ? theme.colors.dark.bg.elevated : theme.colors.dark.bg.primary};
  border: 1px solid ${(props) =>
    props.$isDragging ? theme.colors.brand.primary : theme.colors.dark.border.default};
  border-radius: ${theme.radius.base};
  padding: ${theme.space[4]};
  display: flex;
  align-items: flex-start;
  gap: ${theme.space[3]};
  transition: all ${theme.transitions.fast} ease;
  opacity: ${(props) => (props.$isDragging ? 0.9 : 1)};
  box-shadow: ${(props) => (props.$isDragging ? theme.shadows.lg : "none")};
  z-index: ${(props) => (props.$isDragging ? 10 : "auto")};

  &:hover {
    border-color: ${theme.colors.brand.primary};
  }
`;

const DragHandle = styled.button`
  background: transparent;
  border: none;
  color: ${theme.colors.dark.text.tertiary};
  width: 24px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  transition: all ${theme.transitions.fast} ease;
  flex-shrink: 0;
  font-size: ${theme.fontSizes.bodyLg};
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

const SongPosition = styled.div`
  background: ${theme.gradients.brandPrimary};
  color: white;
  width: 32px;
  height: 32px;
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: ${theme.fontWeights.semibold};
  font-size: ${theme.fontSizes.body};
  flex-shrink: 0;
`;

const SongInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const SongDetails = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: ${theme.space[2]};
`;

const SongTitle = styled.div`
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.dark.text.primary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const SongArtist = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.dark.text.secondary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const SongMetadata = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${theme.space[2]};
`;

const MetaBadge = styled.span`
  display: inline-flex;
  align-items: center;
  background: ${theme.colors.dark.bg.tertiary};
  border: 1px solid ${theme.colors.dark.border.default};
  color: ${theme.colors.dark.text.secondary};
  padding: ${theme.space[1]} ${theme.space[2]};
  border-radius: ${theme.radius.sm};
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.medium};
  white-space: nowrap;
`;

const NotesInput = styled.input`
  background: ${theme.colors.dark.bg.secondary};
  border: 1px solid ${theme.colors.dark.border.default};
  color: ${theme.colors.dark.text.primary};
  padding: ${theme.space[2]} ${theme.space[3]};
  border-radius: ${theme.radius.sm};
  font-size: ${theme.fontSizes.bodySm};
  transition: all ${theme.transitions.fast} ease;
  font-family: ${theme.fonts.sans};

  &::placeholder {
    color: ${theme.colors.dark.text.tertiary};
  }

  &:focus {
    outline: none;
    border-color: ${theme.colors.brand.primary};
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  }
`;

const SongActions = styled.div`
  display: flex;
  gap: ${theme.space[2]};
  flex-shrink: 0;
`;

const AddButton = styled.button`
  background: transparent;
  border: 1px solid ${theme.colors.dark.border.default};
  color: ${theme.colors.dark.text.secondary};
  width: 36px;
  height: 36px;
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  flex-shrink: 0;
  font-size: ${theme.fontSizes.bodyLg};

  &:hover {
    background: ${theme.colors.dark.bg.elevated};
    border-color: ${theme.colors.brand.primary};
    color: ${theme.colors.brand.primary};
  }
`;

const ActionButton = styled.button<{ $variant?: "delete" }>`
  background: transparent;
  border: 1px solid ${theme.colors.dark.border.default};
  color: ${(props) =>
    props.$variant === "delete" ? theme.colors.semantic.error : theme.colors.dark.text.secondary};
  width: 32px;
  height: 32px;
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  flex-shrink: 0;

  &:hover:not(:disabled) {
    background: ${(props) =>
      props.$variant === "delete"
        ? theme.colors.semantic.errorBgDark
        : theme.colors.dark.bg.elevated};
    border-color: ${(props) =>
      props.$variant === "delete" ? theme.colors.semantic.error : theme.colors.brand.primary};
    color: ${(props) =>
      props.$variant === "delete" ? theme.colors.semantic.error : theme.colors.brand.primary};
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const EmptyMessage = styled.div`
  text-align: center;
  padding: ${theme.space[8]} ${theme.space[4]};
  color: ${theme.colors.dark.text.tertiary};
  font-size: ${theme.fontSizes.body};
`;

const EmptyState = styled.div`
  text-align: center;
  padding: ${theme.space[10]} ${theme.space[6]};
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
  margin-bottom: ${theme.space[2]};
`;

const EmptyText = styled.p`
  font-size: ${theme.fontSizes.body};
  color: ${theme.colors.dark.text.secondary};
  margin: 0;
  line-height: ${theme.lineHeights.relaxed};
`;

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${theme.space[12]} 0;
  gap: ${theme.space[4]};
`;

const LoadingText = styled.p`
  font-size: ${theme.fontSizes.body};
  color: ${theme.colors.dark.text.secondary};
  margin: 0;
`;

const MessageCard = styled.div`
  background: ${theme.colors.dark.bg.secondary};
  border: 1px solid ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.lg};
  padding: ${theme.space[12]};
  text-align: center;
  margin-top: ${theme.space[12]};
`;

const MessageIcon = styled.div`
  font-size: ${theme.fontSizes.displayLg};
  color: ${theme.colors.dark.text.tertiary};
  margin-bottom: ${theme.space[4]};
  opacity: 0.5;
`;

const MessageTitle = styled.h2`
  font-size: ${theme.fontSizes.h2};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.dark.text.primary};
  margin-bottom: ${theme.space[2]};
`;

const MessageText = styled.p`
  font-size: ${theme.fontSizes.body};
  color: ${theme.colors.dark.text.secondary};
  margin: 0;
  line-height: ${theme.lineHeights.relaxed};
`;

export default SetlistEditor;
