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
import { getSetlist, updateSetlist, isSongItem, isBreakItem, isSectionItem, isNoteItem } from "../services/setlistsService";
import type { Setlist, SetlistItem, SetlistSongItem, SetlistBreakItem, SetlistSectionItem, SetlistNoteItem } from "../services/setlistsService";
import { getBandSongs } from "../services/songsService";
import type { Song } from "../services/songsService";
import { optimizeSetlistOrder, type SetlistOptimization } from "../services/aiSetlistService";
import { groqService, GroqApiError } from "../services/groqService";
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
  const { t } = useTranslation();
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
          placeholder={t('setlists.editor.addNotesPlaceholder')}
          value={setlistSong.notes || ""}
          onChange={(e) => onUpdateNotes(index, e.target.value)}
        />
      </SongDetails>
      <SongActions>
        <ActionButton
          onClick={() => onRemove(index)}
          title={t('setlists.editor.removeFromSetlist')}
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

  // AI Optimization state
  const [isOptimizeModalOpen, setIsOptimizeModalOpen] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [optimization, setOptimization] = useState<SetlistOptimization | null>(null);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);

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
        alert(t('setlists.editor.loadError'));
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
      alert(t('setlists.editor.saveError'));
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

  // AI Optimization handlers
  const handleOptimizeOrder = async () => {
    if (!setlist) return;

    setOptimizing(true);
    setOptimizeError(null);
    setOptimization(null);
    setIsOptimizeModalOpen(true);

    try {
      const result = await optimizeSetlistOrder(setlist, availableSongs);
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

    const reorderedItems: SetlistItem[] = [];

    // Check if we have section-aware optimization
    const hasSections = optimization.sections && optimization.sections.length > 0;
    const hasOptimizedSections = optimization.optimizedSections && optimization.optimizedSections.length > 0;

    if (hasSections && hasOptimizedSections) {
      // Rebuild the setlist section by section, preserving structure
      let currentItemIndex = 0;

      // Build a map of songId -> notes that should appear before it
      const notesBeforeSong: Record<string, SetlistNoteItem[]> = {};
      let pendingNotes: SetlistNoteItem[] = [];

      for (const item of setlistItems) {
        if (isNoteItem(item)) {
          pendingNotes.push(item);
        } else if (isSongItem(item)) {
          if (pendingNotes.length > 0) {
            notesBeforeSong[item.song_id] = [...pendingNotes];
            pendingNotes = [];
          }
        } else if (isSectionItem(item) || isBreakItem(item)) {
          // Section/break resets pending notes
          pendingNotes = [];
        }
      }

      // Iterate through optimized sections and rebuild
      optimization.optimizedSections!.forEach((optSection, idx) => {
        // Find the matching original section
        const originalSection = optimization.sections![idx];
        if (originalSection?.label) {
          // Find the divider item in the original setlist
          const dividerItem = setlistItems.find(
            (item) =>
              (isSectionItem(item) || isBreakItem(item)) &&
              item.label === originalSection.label
          );
          if (dividerItem) {
            reorderedItems.push({ ...dividerItem, position: currentItemIndex++ });
          }
        }

        // Add songs in optimized order, with their attached notes
        optSection.suggestedOrder.forEach((songId) => {
          // Add notes that should appear before this song
          const notes = notesBeforeSong[songId];
          if (notes) {
            notes.forEach((note) => {
              reorderedItems.push({ ...note, position: currentItemIndex++ });
            });
          }

          // Add the song
          const songItem = setlistItems.find(
            (item) => isSongItem(item) && item.song_id === songId
          ) as SetlistSongItem | undefined;
          if (songItem) {
            reorderedItems.push({ ...songItem, position: currentItemIndex++ });
          }
        });
      });

      // Add any remaining notes that weren't attached to songs
      // (these would be notes at the very end after all songs)
      const usedNoteLabels = new Set(
        Object.values(notesBeforeSong).flat().map((n) => n.label + n.position)
      );
      setlistItems.forEach((item) => {
        if (isNoteItem(item)) {
          const itemKey = item.label + item.position;
          if (!usedNoteLabels.has(itemKey)) {
            // Check if this note was already added
            const alreadyAdded = reorderedItems.some(
              (r) => isNoteItem(r) && r.label === item.label
            );
            if (!alreadyAdded) {
              reorderedItems.push({ ...item, position: currentItemIndex++ });
            }
          }
        }
      });
    } else {
      // No sections - use simpler approach but still preserve notes attached to songs
      const notesBeforeSong: Record<string, SetlistNoteItem[]> = {};
      let pendingNotes: SetlistNoteItem[] = [];

      for (const item of setlistItems) {
        if (isNoteItem(item)) {
          pendingNotes.push(item);
        } else if (isSongItem(item)) {
          if (pendingNotes.length > 0) {
            notesBeforeSong[item.song_id] = [...pendingNotes];
            pendingNotes = [];
          }
        }
      }

      let currentIndex = 0;

      // Add songs in optimized order with their attached notes
      optimization.suggestedOrder.forEach((songId) => {
        // Add notes before this song
        const notes = notesBeforeSong[songId];
        if (notes) {
          notes.forEach((note) => {
            reorderedItems.push({ ...note, position: currentIndex++ });
          });
        }

        // Add the song
        const songItem = setlistItems.find(
          (item) => isSongItem(item) && item.song_id === songId
        ) as SetlistSongItem | undefined;
        if (songItem) {
          reorderedItems.push({ ...songItem, position: currentIndex++ });
        }
      });

      // Add section/break items at the end (they shouldn't be here if there are no sections, but just in case)
      setlistItems.forEach((item) => {
        if (isSectionItem(item) || isBreakItem(item)) {
          reorderedItems.push({ ...item, position: currentIndex++ });
        }
      });

      // Add any unattached notes at the end
      const attachedNoteLabels = new Set(
        Object.values(notesBeforeSong).flat().map((n) => n.label)
      );
      setlistItems.forEach((item) => {
        if (isNoteItem(item) && !attachedNoteLabels.has(item.label)) {
          reorderedItems.push({ ...item, position: currentIndex++ });
        }
      });
    }

    setSetlistItems(reorderedItems);
    setIsOptimizeModalOpen(false);
    setOptimization(null);
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
            <LoadingText>{t('setlists.editor.loading')}</LoadingText>
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
            <MessageTitle>{t('setlists.editor.notFound')}</MessageTitle>
            <MessageText>{t('setlists.editor.notFoundText')}</MessageText>
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
              {t('common.cancel')}
            </CancelButton>
            <SaveButton onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Spinner size="sm" style={{ marginRight: "8px" }} />
                  {t('common.saving')}
                </>
              ) : (
                <>
                  <i className="bi bi-check-circle"></i>
                  {t('setlists.editor.saveSetlist')}
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
                {t('setlists.editor.songLibrary')}
              </PanelTitle>
              <PanelStats>{filteredAvailableSongs.length} {t('setlists.editor.available')}</PanelStats>
            </PanelHeader>

            <SearchBox>
              <i className="bi bi-search"></i>
              <SearchInput
                type="text"
                placeholder={t('setlists.editor.searchSongs')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </SearchBox>

            <SongLibraryList>
              {filteredAvailableSongs.length === 0 ? (
                <EmptyMessage>
                  {searchQuery
                    ? t('setlists.editor.noSongsMatch')
                    : songItemsInSetlist.length === availableSongs.length
                    ? t('setlists.editor.allSongsAdded')
                    : t('setlists.editor.noSongsInLibrary')}
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
                      title={t('setlists.editor.addToSetlist')}
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
                {t('setlists.title')}
              </PanelTitle>
              <PanelStats>
                {songCount} {songCount === 1 ? t("setlists.items.song").toLowerCase() : t("setlists.songs").toLowerCase()}
                {specialItemCount > 0 && <> · {specialItemCount} {specialItemCount === 1 ? t("setlists.editor.item") : t("setlists.editor.items")}</>}
                {totalDuration > 0 && <> · {formatDuration(totalDuration)}</>}
              </PanelStats>
            </PanelHeader>

            {/* Add special item button and AI optimize */}
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
              {groqService.isConfigured() && songItemsInSetlist.length >= 3 && (
                <OptimizeButton onClick={handleOptimizeOrder} disabled={optimizing}>
                  <i className="bi bi-magic"></i>
                  {t("ai.optimizeOrder")}
                </OptimizeButton>
              )}
            </AddItemBar>

            <SetlistSongsList>
              {setlistItems.length === 0 ? (
                <EmptyState>
                  <EmptyIcon>
                    <i className="bi bi-music-note-list"></i>
                  </EmptyIcon>
                  <EmptyTitle>{t('setlists.editor.noSongsInSetlist')}</EmptyTitle>
                  <EmptyText>{t('setlists.editor.addSongsHint')}</EmptyText>
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
              {/* Show section info while optimizing */}
              {setlistItems.some((item) => isSectionItem(item) || isBreakItem(item)) && (
                <OptimizingSubtext>{t("ai.optimizingPerSection")}</OptimizingSubtext>
              )}
            </OptimizingContainer>
          )}

          {optimizeError && (
            <ErrorMessage>
              <i className="bi bi-exclamation-triangle"></i>
              {optimizeError}
            </ErrorMessage>
          )}

          {optimization && !optimizing && (
            <>
              {/* Show sections detected info */}
              {optimization.sections && optimization.sections.length > 1 && (
                <SectionsInfoBanner>
                  <i className="bi bi-layers"></i>
                  <span>
                    {t("ai.sectionsDetected", { count: optimization.sections.length })} — {t("ai.sectionsPreserved")}
                  </span>
                </SectionsInfoBanner>
              )}

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
    </PageWrapper>
  );
};

// Styled Components

const PageWrapper = styled.div`
  min-height: calc(100vh - 80px);
  background: var(--color-bg-primary);
  padding: ${theme.space[6]} 0;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${theme.space[4]};
  margin-bottom: ${theme.space[6]};
  padding-bottom: ${theme.space[4]};
  border-bottom: 1px solid var(--color-border);

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
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
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
    background: var(--color-bg-elevated);
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
  color: var(--color-text-primary);
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
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  padding: ${theme.space[3]} ${theme.space[5]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  &:hover:not(:disabled) {
    background: var(--color-bg-elevated);
    border-color: var(--color-border-strong);
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
    box-shadow: var(--shadow-md);
  }

  &:disabled {
    background: var(--color-bg-elevated);
    color: var(--color-text-disabled);
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
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.lg};
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 280px);
  overflow: hidden;
`;

const SetlistPanel = styled.div`
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
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
  border-bottom: 1px solid var(--color-border);
`;

const PanelTitle = styled.h2`
  font-size: ${theme.fontSizes.h3};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
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
  color: var(--color-text-secondary);
  font-weight: ${theme.fontWeights.medium};
`;

const SearchBox = styled.div`
  padding: ${theme.space[4]} ${theme.space[5]};
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};

  i {
    color: var(--color-text-tertiary);
    font-size: ${theme.fontSizes.body};
  }
`;

const SearchInput = styled.input`
  flex: 1;
  background: transparent;
  border: none;
  color: var(--color-text-primary);
  font-size: ${theme.fontSizes.body};
  outline: none;
  font-family: ${theme.fonts.sans};

  &::placeholder {
    color: var(--color-text-tertiary);
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
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
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
    props.$isDragging ? 'var(--color-bg-elevated)' : 'var(--color-bg-primary)'};
  border: 1px solid ${(props) =>
    props.$isDragging ? theme.colors.brand.primary : 'var(--color-border)'};
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
  color: var(--color-text-tertiary);
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
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const SongArtist = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
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
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  padding: ${theme.space[1]} ${theme.space[2]};
  border-radius: ${theme.radius.sm};
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.medium};
  white-space: nowrap;
`;

const NotesInput = styled.input`
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  padding: ${theme.space[2]} ${theme.space[3]};
  border-radius: ${theme.radius.sm};
  font-size: ${theme.fontSizes.bodySm};
  transition: all ${theme.transitions.fast} ease;
  font-family: ${theme.fonts.sans};

  &::placeholder {
    color: var(--color-text-tertiary);
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
  flex-shrink: 0;
  font-size: ${theme.fontSizes.bodyLg};

  &:hover {
    background: var(--color-bg-elevated);
    border-color: ${theme.colors.brand.primary};
    color: ${theme.colors.brand.primary};
  }
`;

const ActionButton = styled.button<{ $variant?: "delete" }>`
  background: transparent;
  border: 1px solid var(--color-border);
  color: ${(props) =>
    props.$variant === "delete" ? theme.colors.semantic.error : 'var(--color-text-secondary)'};
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
        : 'var(--color-bg-elevated)'};
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
  color: var(--color-text-tertiary);
  font-size: ${theme.fontSizes.body};
`;

const EmptyState = styled.div`
  text-align: center;
  padding: ${theme.space[10]} ${theme.space[6]};
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
  margin-bottom: ${theme.space[2]};
`;

const EmptyText = styled.p`
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-secondary);
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
  color: var(--color-text-secondary);
  margin: 0;
`;

const MessageCard = styled.div`
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.lg};
  padding: ${theme.space[12]};
  text-align: center;
  margin-top: ${theme.space[12]};
`;

const MessageIcon = styled.div`
  font-size: ${theme.fontSizes.displayLg};
  color: var(--color-text-tertiary);
  margin-bottom: ${theme.space[4]};
  opacity: 0.5;
`;

const MessageTitle = styled.h2`
  font-size: ${theme.fontSizes.h2};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin-bottom: ${theme.space[2]};
`;

const MessageText = styled.p`
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-secondary);
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
      return 'var(--color-text-secondary)';
  }
};

const SpecialItemCard = styled.div<{ $isDragging?: boolean; $type: string }>`
  background: ${(props) =>
    props.$isDragging ? 'var(--color-bg-elevated)' : 'var(--color-bg-primary)'};
  border: 1px solid ${(props) =>
    props.$isDragging ? getItemTypeColor(props.$type) : 'var(--color-border)'};
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
        return 'var(--color-bg-tertiary)';
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
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: ${theme.fontWeights.medium};
`;

const SpecialItemLabel = styled.div`
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const SpecialItemDuration = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  gap: ${theme.space[1]};

  i {
    font-size: ${theme.fontSizes.bodyXs};
  }
`;

const AddItemBar = styled.div`
  padding: ${theme.space[3]} ${theme.space[4]};
  border-bottom: 1px solid var(--color-border);
  display: flex;
  gap: ${theme.space[3]};
  align-items: center;
`;

const AddItemDropdownWrapper = styled.div`
  position: relative;
  flex: 1;
`;

const AddItemButton = styled.button`
  background: var(--color-bg-tertiary);
  border: 1px dashed var(--color-border);
  color: var(--color-text-secondary);
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
    background: var(--color-bg-elevated);
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
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.base};
  margin-top: ${theme.space[1]};
  overflow: hidden;
  z-index: 100;
  box-shadow: var(--shadow-lg);
`;

const AddItemMenuItem = styled.button`
  background: transparent;
  border: none;
  color: var(--color-text-primary);
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
    background: var(--color-bg-tertiary);
    color: ${theme.colors.brand.primary};
  }

  i {
    font-size: ${theme.fontSizes.bodyLg};
    width: 20px;
    text-align: center;
  }
`;

// AI Optimization Styles
const OptimizeButton = styled.button`
  background: linear-gradient(135deg, ${theme.colors.brand.primary}, #6366f1);
  border: none;
  color: white;
  padding: ${theme.space[2]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};

  i {
    font-size: ${theme.fontSizes.body};
  }

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

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

const OptimizingSubtext = styled.p`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-tertiary);
  margin: ${theme.space[2]} 0 0 0;
  font-style: italic;
`;

const SectionsInfoBanner = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  background: rgba(139, 92, 246, 0.1);
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: ${theme.radius.base};
  padding: ${theme.space[3]} ${theme.space[4]};
  margin-bottom: ${theme.space[4]};
  color: ${theme.colors.brand.primary};
  font-size: ${theme.fontSizes.bodySm};

  i {
    font-size: ${theme.fontSizes.bodyLg};
  }
`;

const ErrorMessage = styled.div`
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

export default SetlistEditor;
