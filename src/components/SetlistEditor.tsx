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
import type { Setlist, SetlistItem, SetlistSongItem, SetlistBreakItem, SetlistSectionItem, SetlistNoteItem } from "../services/setlistsService";
import { getBandSongs } from "../services/songsService";
import type { Song } from "../services/songsService";
import { useTranslation } from "react-i18next";

// Helper to generate unique IDs for special items
const generateItemId = () => `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Sortable song card component
interface SortableSetlistSongCardProps {
  setlistSong: SetlistSongItem;
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

// Sortable special item card component
interface SortableSpecialItemCardProps {
  item: SetlistBreakItem | SetlistSectionItem | SetlistNoteItem;
  itemId: string;
  onEdit: () => void;
  onRemove: () => void;
}

const SortableSpecialItemCard: FC<SortableSpecialItemCardProps> = ({
  item,
  itemId,
  onEdit,
  onRemove,
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
    <SpecialItemCard
      ref={setNodeRef}
      style={style}
      $isDragging={isDragging}
      $type={item.type}
    >
      <DragHandle {...attributes} {...listeners}>
        <i className="bi bi-grip-vertical"></i>
      </DragHandle>
      <SpecialItemIcon $type={item.type}>
        <i className={getIcon()}></i>
      </SpecialItemIcon>
      <SpecialItemContent>
        <SpecialItemType>{getTypeLabel()}</SpecialItemType>
        <SpecialItemLabel>{item.label}</SpecialItemLabel>
        {isBreakItem(item) && item.duration && (
          <SpecialItemDuration>
            <i className="bi bi-clock"></i> {item.duration} min
          </SpecialItemDuration>
        )}
      </SpecialItemContent>
      <SongActions>
        <ActionButton onClick={onEdit} title={t("common.edit")}>
          <i className="bi bi-pencil"></i>
        </ActionButton>
        <ActionButton onClick={onRemove} title={t("common.remove")} $variant="delete">
          <i className="bi bi-trash"></i>
        </ActionButton>
      </SongActions>
    </SpecialItemCard>
  );
};

const SetlistEditor: FC = () => {
  const { setlistId } = useParams<{ setlistId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [availableSongs, setAvailableSongs] = useState<Song[]>([]);
  const [setlistItems, setSetlistItems] = useState<SetlistItem[]>([]);
  const [itemIds, setItemIds] = useState<Map<SetlistItem, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal state for adding/editing special items
  const [isSpecialItemModalOpen, setIsSpecialItemModalOpen] = useState(false);
  const [specialItemType, setSpecialItemType] = useState<"break" | "section" | "note">("break");
  const [specialItemLabel, setSpecialItemLabel] = useState("");
  const [specialItemDuration, setSpecialItemDuration] = useState<number | undefined>(undefined);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);

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

  // Get the stable ID for an item
  const getStableItemId = (item: SetlistItem): string => {
    const existingId = itemIds.get(item);
    if (existingId) return existingId;

    // Generate new ID if not found
    const newId = isSongItem(item) ? item.song_id : generateItemId();
    return newId;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setSetlistItems((items) => {
        const oldIndex = items.findIndex((item) => getStableItemId(item) === active.id);
        const newIndex = items.findIndex((item) => getStableItemId(item) === over.id);

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

  useEffect(() => {
    if (!setlistId) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const setlistData = await getSetlist(setlistId);
        setSetlist(setlistData);

        // Load all items and generate stable IDs
        const items = setlistData.songs || [];
        const newItemIds = new Map<SetlistItem, string>();
        items.forEach((item) => {
          const id = isSongItem(item) ? item.song_id : generateItemId();
          newItemIds.set(item, id);
        });
        setItemIds(newItemIds);
        setSetlistItems(items);

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
        songs: setlistItems,
      });
      navigate("/setlists");
    } catch (error) {
      console.error("Failed to save setlist:", error);
      alert("Failed to save setlist. Please try again.");
    }
    setSaving(false);
  };

  const handleAddSong = (song: Song) => {
    const songItems = setlistItems.filter(isSongItem);
    const isAlreadyAdded = songItems.some((s) => s.song_id === song.id);
    if (isAlreadyAdded) return;

    const newSong: SetlistSongItem = {
      type: "song",
      song_id: song.id,
      position: setlistItems.length,
      notes: "",
    };

    // Add to itemIds map
    setItemIds((prev) => {
      const newMap = new Map(prev);
      newMap.set(newSong, song.id);
      return newMap;
    });

    setSetlistItems([...setlistItems, newSong]);
  };

  const handleRemoveItem = (index: number) => {
    const filtered = setlistItems.filter((_, i) => i !== index);
    // Reindex positions
    const reindexed = filtered.map((item, i) => ({
      ...item,
      position: i,
    }));
    setSetlistItems(reindexed);
  };

  const handleUpdateNotes = (index: number, notes: string) => {
    const updated = setlistItems.map((item, i) => {
      if (i === index && isSongItem(item)) {
        return { ...item, notes };
      }
      return item;
    });
    setSetlistItems(updated);
  };

  // Special item handlers
  const openAddSpecialItemModal = (type: "break" | "section" | "note") => {
    setSpecialItemType(type);
    setSpecialItemLabel("");
    setSpecialItemDuration(type === "break" ? 15 : undefined);
    setEditingItemIndex(null);
    setShowAddMenu(false);
    setIsSpecialItemModalOpen(true);
  };

  const openEditSpecialItemModal = (index: number) => {
    const item = setlistItems[index];
    if (isSongItem(item)) return;

    setSpecialItemType(item.type);
    setSpecialItemLabel(item.label);
    setSpecialItemDuration(isBreakItem(item) ? item.duration : undefined);
    setEditingItemIndex(index);
    setIsSpecialItemModalOpen(true);
  };

  const handleSaveSpecialItem = () => {
    if (!specialItemLabel.trim()) return;

    if (editingItemIndex !== null) {
      // Edit existing item
      const updated = setlistItems.map((item, i) => {
        if (i === editingItemIndex) {
          const baseItem = { position: item.position, label: specialItemLabel.trim() };
          if (specialItemType === "break") {
            return { ...baseItem, type: "break" as const, duration: specialItemDuration };
          } else if (specialItemType === "section") {
            return { ...baseItem, type: "section" as const };
          } else {
            return { ...baseItem, type: "note" as const };
          }
        }
        return item;
      });
      setSetlistItems(updated);
    } else {
      // Add new item
      let newItem: SetlistItem;
      const position = setlistItems.length;

      if (specialItemType === "break") {
        newItem = {
          type: "break",
          label: specialItemLabel.trim(),
          duration: specialItemDuration,
          position,
        };
      } else if (specialItemType === "section") {
        newItem = {
          type: "section",
          label: specialItemLabel.trim(),
          position,
        };
      } else {
        newItem = {
          type: "note",
          label: specialItemLabel.trim(),
          position,
        };
      }

      // Add to itemIds map
      const newId = generateItemId();
      setItemIds((prev) => {
        const newMap = new Map(prev);
        newMap.set(newItem, newId);
        return newMap;
      });

      setSetlistItems([...setlistItems, newItem]);
    }

    setIsSpecialItemModalOpen(false);
  };

  const getSongById = (songId: string): Song | undefined => {
    return availableSongs.find((s) => s.id === songId);
  };

  // Get only song items for filtering
  const songItemsInSetlist = setlistItems.filter(isSongItem);

  const filteredAvailableSongs = availableSongs
    .filter((song) => {
      // Hide songs already added to the setlist
      const isAlreadyAdded = songItemsInSetlist.some((s) => s.song_id === song.id);
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
    return songItemsInSetlist.reduce((total, setlistSong) => {
      const song = getSongById(setlistSong.song_id);
      return total + (song?.duration || 0);
    }, 0);
  };

  // Count items by type for stats
  const songCount = songItemsInSetlist.length;
  const specialItemCount = setlistItems.length - songCount;

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
                    : songItemsInSetlist.length === availableSongs.length
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
                {songCount} {songCount === 1 ? t("setlists.items.song").toLowerCase() : t("setlists.songs").toLowerCase()}
                {specialItemCount > 0 && <> · {specialItemCount} {specialItemCount === 1 ? "item" : "items"}</>}
                {totalDuration > 0 && <> · {formatDuration(totalDuration)}</>}
              </PanelStats>
            </PanelHeader>

            {/* Add special item button */}
            <AddItemBar>
              <AddItemDropdownWrapper>
                <AddItemButton onClick={() => setShowAddMenu(!showAddMenu)}>
                  <i className="bi bi-plus-lg"></i>
                  {t("setlists.items.addSpecialItem")}
                  <i className={`bi bi-chevron-${showAddMenu ? "up" : "down"}`}></i>
                </AddItemButton>
                {showAddMenu && (
                  <AddItemMenu>
                    <AddItemMenuItem onClick={() => openAddSpecialItemModal("section")}>
                      <i className="bi bi-bookmark"></i>
                      {t("setlists.items.addSection")}
                    </AddItemMenuItem>
                    <AddItemMenuItem onClick={() => openAddSpecialItemModal("break")}>
                      <i className="bi bi-pause-circle"></i>
                      {t("setlists.items.addBreak")}
                    </AddItemMenuItem>
                    <AddItemMenuItem onClick={() => openAddSpecialItemModal("note")}>
                      <i className="bi bi-sticky"></i>
                      {t("setlists.items.addNote")}
                    </AddItemMenuItem>
                  </AddItemMenu>
                )}
              </AddItemDropdownWrapper>
            </AddItemBar>

            <SetlistSongsList>
              {setlistItems.length === 0 ? (
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
                    items={setlistItems.map((item) => getStableItemId(item))}
                    strategy={verticalListSortingStrategy}
                  >
                    {setlistItems.map((item, index) => {
                      if (isSongItem(item)) {
                        const song = getSongById(item.song_id);
                        if (!song) return null;

                        return (
                          <SortableSetlistSongCard
                            key={item.song_id}
                            setlistSong={item}
                            index={index}
                            song={song}
                            formatDuration={formatDuration}
                            onUpdateNotes={handleUpdateNotes}
                            onRemove={handleRemoveItem}
                            totalSongs={setlistItems.length}
                          />
                        );
                      } else {
                        // Special item (break, section, note)
                        return (
                          <SortableSpecialItemCard
                            key={getStableItemId(item)}
                            item={item}
                            itemId={getStableItemId(item)}
                            onEdit={() => openEditSpecialItemModal(index)}
                            onRemove={() => handleRemoveItem(index)}
                          />
                        );
                      }
                    })}
                  </SortableContext>
                </DndContext>
              )}
            </SetlistSongsList>
          </SetlistPanel>
        </EditorGrid>
      </Container>

      {/* Special Item Modal */}
      <Modal isOpen={isSpecialItemModalOpen} toggle={() => setIsSpecialItemModalOpen(false)}>
        <ModalHeader toggle={() => setIsSpecialItemModalOpen(false)}>
          {editingItemIndex !== null ? t("common.edit") : t("common.add")}{" "}
          {specialItemType === "break"
            ? t("setlists.items.break")
            : specialItemType === "section"
            ? t("setlists.items.section")
            : t("setlists.items.note")}
        </ModalHeader>
        <ModalBody>
          <FormGroup>
            <Label for="specialItemLabel">
              {specialItemType === "break"
                ? t("setlists.items.breakLabel")
                : specialItemType === "section"
                ? t("setlists.items.sectionLabel")
                : t("setlists.items.noteLabel")}
            </Label>
            <Input
              type="text"
              id="specialItemLabel"
              value={specialItemLabel}
              onChange={(e) => setSpecialItemLabel(e.target.value)}
              placeholder={t(`setlists.items.placeholders.${specialItemType}`)}
              autoFocus
            />
          </FormGroup>
          {specialItemType === "break" && (
            <FormGroup>
              <Label for="specialItemDuration">{t("setlists.items.duration")}</Label>
              <Input
                type="number"
                id="specialItemDuration"
                value={specialItemDuration || ""}
                onChange={(e) => setSpecialItemDuration(e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="15"
                min={1}
                max={120}
              />
            </FormGroup>
          )}
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={() => setIsSpecialItemModalOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button color="primary" onClick={handleSaveSpecialItem} disabled={!specialItemLabel.trim()}>
            {t("common.save")}
          </Button>
        </ModalFooter>
      </Modal>
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

// Special item styles
const getItemTypeColor = (type: string) => {
  switch (type) {
    case "break":
      return theme.colors.semantic.warning;
    case "section":
      return theme.colors.brand.primary;
    case "note":
      return theme.colors.semantic.info;
    default:
      return theme.colors.dark.text.secondary;
  }
};

const SpecialItemCard = styled.div<{ $isDragging?: boolean; $type: string }>`
  background: ${(props) =>
    props.$isDragging ? theme.colors.dark.bg.elevated : theme.colors.dark.bg.primary};
  border: 1px solid ${(props) =>
    props.$isDragging ? getItemTypeColor(props.$type) : theme.colors.dark.border.default};
  border-left: 3px solid ${(props) => getItemTypeColor(props.$type)};
  border-radius: ${theme.radius.base};
  padding: ${theme.space[3]} ${theme.space[4]};
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  transition: all ${theme.transitions.fast} ease;
  opacity: ${(props) => (props.$isDragging ? 0.9 : 1)};
  box-shadow: ${(props) => (props.$isDragging ? theme.shadows.lg : "none")};
  z-index: ${(props) => (props.$isDragging ? 10 : "auto")};

  &:hover {
    border-color: ${(props) => getItemTypeColor(props.$type)};
  }
`;

const SpecialItemIcon = styled.div<{ $type: string }>`
  width: 32px;
  height: 32px;
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${theme.fontSizes.bodyLg};
  flex-shrink: 0;
  background: ${(props) => {
    switch (props.$type) {
      case "break":
        return theme.colors.semantic.warningBgDark;
      case "section":
        return "rgba(139, 92, 246, 0.15)";
      case "note":
        return theme.colors.semantic.infoBgDark;
      default:
        return theme.colors.dark.bg.tertiary;
    }
  }};
  color: ${(props) => getItemTypeColor(props.$type)};
`;

const SpecialItemContent = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: ${theme.space[1]};
`;

const SpecialItemType = styled.div`
  font-size: ${theme.fontSizes.bodyXs};
  color: ${theme.colors.dark.text.tertiary};
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: ${theme.fontWeights.medium};
`;

const SpecialItemLabel = styled.div`
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.dark.text.primary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const SpecialItemDuration = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.dark.text.secondary};
  display: flex;
  align-items: center;
  gap: ${theme.space[1]};

  i {
    font-size: ${theme.fontSizes.bodyXs};
  }
`;

const AddItemBar = styled.div`
  padding: ${theme.space[3]} ${theme.space[4]};
  border-bottom: 1px solid ${theme.colors.dark.border.default};
`;

const AddItemDropdownWrapper = styled.div`
  position: relative;
`;

const AddItemButton = styled.button`
  background: ${theme.colors.dark.bg.tertiary};
  border: 1px dashed ${theme.colors.dark.border.default};
  color: ${theme.colors.dark.text.secondary};
  padding: ${theme.space[2]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  width: 100%;
  justify-content: center;

  &:hover {
    background: ${theme.colors.dark.bg.elevated};
    border-color: ${theme.colors.brand.primary};
    color: ${theme.colors.brand.primary};
  }

  i:first-child {
    font-size: ${theme.fontSizes.body};
  }

  i:last-child {
    font-size: ${theme.fontSizes.bodyXs};
    margin-left: auto;
  }
`;

const AddItemMenu = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: ${theme.colors.dark.bg.elevated};
  border: 1px solid ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.base};
  margin-top: ${theme.space[1]};
  overflow: hidden;
  z-index: 100;
  box-shadow: ${theme.shadows.lg};
`;

const AddItemMenuItem = styled.button`
  background: transparent;
  border: none;
  color: ${theme.colors.dark.text.primary};
  padding: ${theme.space[3]} ${theme.space[4]};
  font-size: ${theme.fontSizes.body};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  width: 100%;
  text-align: left;

  &:hover {
    background: ${theme.colors.dark.bg.tertiary};
    color: ${theme.colors.brand.primary};
  }

  i {
    font-size: ${theme.fontSizes.bodyLg};
    width: 20px;
    text-align: center;
  }
`;

export default SetlistEditor;
