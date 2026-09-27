import type { FC, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import styled, { css } from "styled-components";
import { useDraggable } from "@dnd-kit/core";
import { theme } from "../../theme";
import type { Song } from "../../services/songsService";
import type { InputCapabilities } from "../../hooks/useInputCapabilities";
import { usePickerState } from "../../hooks/usePickerState";
import { getLocalToday } from "../../lib/dateUtils";
import {
  ENERGY_BANDS,
  EMPTY_PICKER_FILTERS,
  PICKER_SORTS,
  filterByPicker,
  filterBySearch,
  hasActivePickerFilters,
  pickerFacets,
  sortForPicker,
  type PickerFilters,
  type PickerSort,
} from "../../utils/songFilters";
import { PLAYED_STATUSES, type SongSignals } from "../../utils/songSignals";
import { PickerFilterChip } from "./PickerFilterChip";
import { formatSignalLine } from "./signalLine";
import { pickerDragId } from "./pickerDnd";

export interface SongPickerProps {
  /** Not yet in the setlist. */
  songs: Song[];
  /** The band's library size, to tell "no songs" from "all added". */
  totalSongs: number;
  /** null when setlists/shows failed to load: no signal line, no Played chip or history sorts. */
  signals: ReadonlyMap<string, SongSignals> | null;
  /** Single "+". */
  onAdd: (song: Song) => void;
  /** "Add N", in selection order. `asMedley` stays false until setlist-medleys ships. */
  onAddSelected: (songs: Song[], options: { asMedley: boolean }) => void;
  onEditSong?: (song: Song) => void;
  /** Wide: a panel beside the setlist. Narrow: a full-screen sheet. */
  layout: "panel" | "sheet";
  capabilities: InputCapabilities;
  /** Sheet only: the close button. */
  onClose?: () => void;
  /** YYYY-MM-DD; defaults to the local date (tests pin it). */
  today?: string;
}

const HISTORY_SORTS: readonly PickerSort[] = ["most_played", "longest_since_played"];
const NO_SIGNALS: ReadonlyMap<string, SongSignals> = new Map();

const formatDuration = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/**
 * The setlist builder's song picker (docs/specs/setlist-builder.md §3):
 * history signal per row, filter chips, sort, multi-select with "Add N",
 * and the single "+". Filters and sort are remembered per device.
 */
export const SongPicker: FC<SongPickerProps> = ({
  songs,
  totalSongs,
  signals,
  onAdd,
  onAddSelected,
  onEditSong,
  layout,
  capabilities,
  onClose,
  today: todayProp,
}) => {
  const { t, i18n } = useTranslation();
  const today = todayProp ?? getLocalToday();
  const pointer = capabilities.hover && capabilities.finePointer;
  const touch = !pointer;
  // Keyboard shortcuts, focus-after-add and drag-to-insert: wide + pointer only (§2).
  const keyboardMode = layout === "panel" && pointer;

  const [pickerState, setPickerState] = usePickerState();
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // The keyboard highlight only shows while the search has focus.
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const hasSignals = signals !== null;
  const signalMap = signals ?? NO_SIGNALS;
  // Without signals a stored Played filter or history sort would hide or scramble everything.
  const filters = useMemo<PickerFilters>(
    () => (hasSignals ? pickerState.filters : { ...pickerState.filters, played: [] }),
    [hasSignals, pickerState.filters]
  );
  const sort: PickerSort = hasSignals || !HISTORY_SORTS.includes(pickerState.sort) ? pickerState.sort : "artist_title_asc";

  const facets = useMemo(() => pickerFacets(songs), [songs]);
  const visible = useMemo(
    () => sortForPicker(filterByPicker(filterBySearch(songs, query), filters, signalMap, today), sort, signalMap),
    [songs, query, filters, signalMap, today, sort]
  );

  const songsById = useMemo(() => new Map(songs.map((song) => [song.id, song])), [songs]);
  // Songs that left the list (added, deleted) drop out of the selection.
  const selection = selectedIds.filter((id) => songsById.has(id));
  const selectedSet = new Set(selection);
  const filtersActive = hasActivePickerFilters(filters);

  useEffect(() => {
    setHighlight(0);
  }, [query, filters, sort]);

  useEffect(() => {
    if (!keyboardMode) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [keyboardMode]);

  useEffect(() => {
    if (!keyboardMode) return;
    const row = listRef.current?.querySelector<HTMLElement>(`[data-picker-index="${highlight}"]`);
    row?.scrollIntoView?.({ block: "nearest" });
  }, [highlight, keyboardMode]);

  const setFilters = (next: PickerFilters) => setPickerState({ ...pickerState, filters: next });
  const setFilter = <K extends keyof PickerFilters>(field: K, value: PickerFilters[K]) =>
    setFilters({ ...pickerState.filters, [field]: value });

  const addOne = (song: Song) => {
    onAdd(song);
    if (keyboardMode) searchRef.current?.focus();
  };

  const toggle = (songId: string) => {
    setSelectedIds((ids) => {
      const current = ids.filter((id) => songsById.has(id));
      return current.includes(songId) ? current.filter((id) => id !== songId) : [...current, songId];
    });
    setAnchorId(songId);
  };

  /** Shift+click on pointer: select every visible row between the anchor and this one. */
  const selectRange = (songId: string) => {
    const from = anchorId ? visible.findIndex((song) => song.id === anchorId) : -1;
    const to = visible.findIndex((song) => song.id === songId);
    if (from === -1 || to === -1) {
      toggle(songId);
      return;
    }
    const [start, end] = from < to ? [from, to] : [to, from];
    const range = visible.slice(start, end + 1).map((song) => song.id);
    setSelectedIds((ids) => {
      const current = ids.filter((id) => songsById.has(id));
      return [...current, ...range.filter((id) => !current.includes(id))];
    });
    setAnchorId(songId);
  };

  const addSelected = () => {
    const chosen = selection.map((id) => songsById.get(id)).filter((song): song is Song => !!song);
    if (chosen.length === 0) return;
    onAddSelected(chosen, { asMedley: false });
    setSelectedIds([]);
    setAnchorId(null);
  };

  const onSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (!keyboardMode || visible.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((index) => Math.min(index + 1, visible.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      addOne(visible[Math.min(highlight, visible.length - 1)]);
    }
  };

  const clearFilters = () => setFilters(EMPTY_PICKER_FILTERS);

  const sortOptions = PICKER_SORTS.filter((option) => hasSignals || !HISTORY_SORTS.includes(option));
  const activeFilterCount = (Object.keys(filters) as (keyof PickerFilters)[]).filter((f) => filters[f].length > 0).length;

  const emptyMessage = (() => {
    if (totalSongs === 0) {
      return (
        <>
          <div>{t("setlists.editor.noSongsInLibrary")}</div>
          <EmptyLink to="/songs">{t("setlists.picker.goToSongs")}</EmptyLink>
        </>
      );
    }
    if (songs.length === 0) return t("setlists.editor.allSongsAdded");
    if (filtersActive) {
      return (
        <>
          <div>{t("setlists.picker.noMatchFilters")}</div>
          <TextButton type="button" onClick={clearFilters}>
            {t("setlists.picker.clearFilters")}
          </TextButton>
        </>
      );
    }
    return t("setlists.editor.noSongsMatch");
  })();

  const showFooter = layout === "sheet" || selection.length > 0;

  return (
    <PickerRoot $layout={layout}>
      <PickerHeader>
        <PickerTitle $layout={layout}>
          <i className="bi bi-music-note-beamed" aria-hidden="true"></i>
          {t("setlists.picker.title")}
        </PickerTitle>
        <HeaderRight>
          <PickerCount>
            {visible.length} {t("setlists.editor.available")}
          </PickerCount>
          {layout === "sheet" && onClose && (
            <IconButton type="button" $touch={touch} onClick={onClose} aria-label={t("common.close")} title={t("common.close")}>
              <i className="bi bi-x-lg" aria-hidden="true"></i>
            </IconButton>
          )}
        </HeaderRight>
      </PickerHeader>

      <SearchBox>
        <i className="bi bi-search" aria-hidden="true"></i>
        <SearchInput
          ref={searchRef}
          type="search"
          placeholder={t("setlists.editor.searchSongs")}
          aria-label={t("setlists.editor.searchSongs")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onSearchKeyDown}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
        />
      </SearchBox>

      <Toolbar>
        <FiltersToggle
          type="button"
          $touch={touch}
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((open) => !open)}
        >
          <i className="bi bi-funnel" aria-hidden="true"></i>
          {t("setlists.picker.filters")}
          {activeFilterCount > 0 && ` · ${activeFilterCount}`}
        </FiltersToggle>
        <SortSelect
          $touch={touch}
          aria-label={t("setlists.picker.sort.label")}
          value={sort}
          onChange={(event) => setPickerState({ ...pickerState, sort: event.target.value as PickerSort })}
        >
          {sortOptions.map((option) => (
            <option key={option} value={option}>
              {t(`setlists.picker.sort.${option}`)}
            </option>
          ))}
        </SortSelect>
      </Toolbar>

      <ChipsRow $open={filtersOpen}>
        {facets.tags.length > 0 && (
          <PickerFilterChip
            label={t("setlists.picker.filter.tags")}
            options={facets.tags.map((value) => ({ value, label: value }))}
            selected={filters.tags}
            onChange={(value) => setFilter("tags", value)}
            touch={touch}
          />
        )}
        {facets.keys.length > 0 && (
          <PickerFilterChip
            label={t("setlists.picker.filter.key")}
            options={facets.keys.map((value) => ({ value, label: value }))}
            selected={filters.keys}
            onChange={(value) => setFilter("keys", value)}
            touch={touch}
          />
        )}
        {facets.languages.length >= 2 && (
          <PickerFilterChip
            label={t("setlists.picker.filter.language")}
            options={facets.languages.map((value) => ({ value, label: value }))}
            selected={filters.languages}
            onChange={(value) => setFilter("languages", value)}
            touch={touch}
          />
        )}
        {facets.hasEnergy && (
          <PickerFilterChip
            label={t("setlists.picker.filter.energy")}
            options={ENERGY_BANDS.map((value) => ({ value, label: t(`setlists.picker.energy.${value}`) }))}
            selected={filters.energy}
            onChange={(value) => setFilter("energy", value)}
            touch={touch}
          />
        )}
        {hasSignals && (
          <PickerFilterChip
            label={t("setlists.picker.filter.played")}
            options={PLAYED_STATUSES.map((value) => ({ value, label: t(`setlists.picker.played.${value}`) }))}
            selected={filters.played}
            onChange={(value) => setFilter("played", value)}
            touch={touch}
          />
        )}
        {filtersActive && (
          <TextButton type="button" onClick={clearFilters}>
            {t("setlists.picker.clearFilters")}
          </TextButton>
        )}
      </ChipsRow>

      <PickerList ref={listRef}>
        {visible.length === 0 ? (
          <EmptyMessage>{emptyMessage}</EmptyMessage>
        ) : (
          visible.map((song, index) => (
            <PickerRow
              key={song.id}
              song={song}
              index={index}
              signalLine={hasSignals ? formatSignalLine(signalMap.get(song.id), t, i18n.language, today) : null}
              selected={selectedSet.has(song.id)}
              highlighted={keyboardMode && searchFocused && index === highlight}
              touch={touch}
              draggable={keyboardMode}
              onToggle={toggle}
              onSelectRange={selectRange}
              onAdd={addOne}
              onEditSong={onEditSong}
            />
          ))
        )}
      </PickerList>

      {showFooter && (
        <PickerFooter>
          <FooterButton type="button" $touch={touch} onClick={() => setSelectedIds([])} disabled={selection.length === 0}>
            {t("setlists.picker.clearSelection")}
          </FooterButton>
          <FooterButton
            type="button"
            $touch={touch}
            $primary
            onClick={addSelected}
            disabled={selection.length === 0}
          >
            <i className="bi bi-plus-lg" aria-hidden="true"></i>
            {selection.length > 0
              ? t("setlists.picker.addSelected", { count: selection.length })
              : t("setlists.picker.addSongs")}
          </FooterButton>
        </PickerFooter>
      )}
    </PickerRoot>
  );
};

interface PickerRowProps {
  song: Song;
  index: number;
  signalLine: string | null;
  selected: boolean;
  highlighted: boolean;
  touch: boolean;
  draggable: boolean;
  onToggle: (songId: string) => void;
  onSelectRange: (songId: string) => void;
  onAdd: (song: Song) => void;
  onEditSong?: (song: Song) => void;
}

const PickerRow: FC<PickerRowProps> = ({
  song,
  index,
  signalLine,
  selected,
  highlighted,
  touch,
  draggable,
  onToggle,
  onSelectRange,
  onAdd,
  onEditSong,
}) => {
  const { t } = useTranslation();
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: pickerDragId(song.id),
    disabled: !draggable,
    data: { song },
  });

  // Touch: the whole row toggles. Pointer: the checkbox does (Shift = range).
  const onRowClick = touch ? () => onToggle(song.id) : undefined;
  const onCheckboxClick = (event: ReactMouseEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (!touch && event.shiftKey) onSelectRange(song.id);
    else onToggle(song.id);
  };
  const stop = (event: ReactMouseEvent) => event.stopPropagation();

  return (
    <RowCard
      ref={setNodeRef}
      {...(draggable ? listeners : {})}
      data-picker-index={index}
      $selected={selected}
      $highlighted={highlighted}
      $touch={touch}
      $dragging={isDragging}
      $draggable={draggable}
      onClick={onRowClick}
    >
      <RowCheckbox
        type="checkbox"
        checked={selected}
        readOnly
        onClick={onCheckboxClick}
        onPointerDown={(event) => event.stopPropagation()}
        aria-label={t("setlists.picker.selectSong", { title: song.title })}
        $touch={touch}
      />
      <RowInfo>
        <RowTitle>{song.title}</RowTitle>
        {song.artist && <RowArtist>{song.artist}</RowArtist>}
        <RowMeta>
          {song.key && <MetaBadge>{song.key}</MetaBadge>}
          {song.tempo ? <MetaBadge>{song.tempo} BPM</MetaBadge> : null}
          {song.duration ? <MetaBadge>{formatDuration(song.duration)}</MetaBadge> : null}
        </RowMeta>
        {signalLine && <SignalLine>{signalLine}</SignalLine>}
      </RowInfo>
      <RowActions onClick={stop} onPointerDown={(event) => event.stopPropagation()}>
        {onEditSong && (
          <RowButton
            type="button"
            // Pointer: revealed on row hover / focus. Touch: always visible.
            className={touch ? undefined : "picker-reveal"}
            $touch={touch}
            onClick={() => onEditSong(song)}
            title={t("songs.editSongTooltip")}
            aria-label={t("songs.editSongTooltip")}
          >
            <i className="bi bi-pencil" aria-hidden="true"></i>
          </RowButton>
        )}
        <RowButton
          type="button"
          $touch={touch}
          $add
          onClick={() => onAdd(song)}
          title={t("setlists.editor.addToSetlist")}
          aria-label={t("setlists.editor.addToSetlist")}
        >
          <i className="bi bi-plus-circle" aria-hidden="true"></i>
        </RowButton>
      </RowActions>
    </RowCard>
  );
};

// Styled Components

const PickerRoot = styled.div<{ $layout: "panel" | "sheet" }>`
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  background: var(--color-bg-secondary);

  ${(props) =>
    props.$layout === "panel"
      ? css`
          border: 1px solid var(--color-border);
          border-radius: ${theme.radius.lg};
          max-height: calc(100vh - 280px);
          overflow: hidden;
        `
      : css`
          height: 100%;
        `}
`;

const PickerHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${theme.space[3]};
  padding: ${theme.space[4]} ${theme.space[5]};
  border-bottom: 1px solid var(--color-border);
`;

const PickerTitle = styled.h2<{ $layout: "panel" | "sheet" }>`
  font-size: ${(props) => (props.$layout === "sheet" ? theme.fontSizes.bodyLg : theme.fontSizes.h3)};
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

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
`;

const PickerCount = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
  font-weight: ${theme.fontWeights.medium};
  white-space: nowrap;
`;

const touchSize = (touch: boolean) => (touch ? "44px" : "32px");

const IconButton = styled.button<{ $touch: boolean }>`
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  width: ${(props) => touchSize(props.$touch)};
  height: ${(props) => touchSize(props.$touch)};
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
`;

const SearchBox = styled.div`
  padding: ${theme.space[3]} ${theme.space[5]};
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};

  i {
    color: var(--color-text-tertiary);
  }
`;

const SearchInput = styled.input`
  flex: 1;
  min-width: 0;
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

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${theme.space[3]};
  padding: ${theme.space[3]} ${theme.space[5]} 0;

  @media (min-width: ${theme.breakpoints.md}) {
    justify-content: flex-end;
  }
`;

const FiltersToggle = styled.button<{ $touch: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[2]};
  min-height: ${(props) => touchSize(props.$touch)};
  padding: 0 ${theme.space[3]};
  border-radius: ${theme.radius.base};
  border: 1px solid var(--color-border);
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
  font-size: ${theme.fontSizes.bodySm};
  cursor: pointer;

  @media (min-width: ${theme.breakpoints.md}) {
    display: none;
  }
`;

const SortSelect = styled.select<{ $touch: boolean }>`
  min-height: ${(props) => touchSize(props.$touch)};
  padding: 0 ${theme.space[3]};
  border-radius: ${theme.radius.base};
  border: 1px solid var(--color-border);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: ${theme.fontSizes.bodySm};
  max-width: 60%;
`;

const ChipsRow = styled.div<{ $open: boolean }>`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${theme.space[2]};
  padding: ${theme.space[3]} ${theme.space[5]};
  border-bottom: 1px solid var(--color-border);

  &:empty {
    display: none;
  }

  @media (max-width: calc(${theme.breakpoints.md} - 0.02px)) {
    display: ${(props) => (props.$open ? "flex" : "none")};
  }
`;

const TextButton = styled.button`
  background: transparent;
  border: none;
  color: ${theme.colors.brand.primary};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  padding: ${theme.space[2]};
  cursor: pointer;
  text-decoration: underline;
`;

const PickerList = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: ${theme.space[4]};
  display: flex;
  flex-direction: column;
  gap: ${theme.space[3]};
`;

const EmptyMessage = styled.div`
  text-align: center;
  padding: ${theme.space[8]} ${theme.space[4]};
  color: var(--color-text-tertiary);
  font-size: ${theme.fontSizes.body};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${theme.space[2]};
`;

const EmptyLink = styled(Link)`
  color: ${theme.colors.brand.primary};
  font-size: ${theme.fontSizes.bodySm};
`;

const RowCard = styled.div<{
  $selected: boolean;
  $highlighted: boolean;
  $touch: boolean;
  $dragging: boolean;
  $draggable: boolean;
}>`
  background: ${(props) => (props.$selected ? "rgba(139, 92, 246, 0.12)" : "var(--color-bg-primary)")};
  border: 1px solid
    ${(props) => (props.$selected || props.$highlighted ? theme.colors.brand.primary : "var(--color-border)")};
  box-shadow: ${(props) => (props.$highlighted ? `0 0 0 2px rgba(139, 92, 246, 0.35)` : "none")};
  border-radius: ${theme.radius.base};
  padding: ${theme.space[3]};
  min-height: ${(props) => (props.$touch ? "56px" : "auto")};
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: ${theme.space[3]};
  opacity: ${(props) => (props.$dragging ? 0.4 : 1)};
  cursor: ${(props) => (props.$touch ? "pointer" : props.$draggable ? "grab" : "default")};
  transition: border-color ${theme.transitions.fast} ease;
  user-select: none;

  &:hover {
    border-color: ${theme.colors.brand.primary};
  }

  ${() =>
    css`
      .picker-reveal {
        opacity: 0;
      }
      &:hover .picker-reveal,
      &:focus-within .picker-reveal {
        opacity: 1;
      }
    `}
`;

const RowCheckbox = styled.input<{ $touch: boolean }>`
  flex-shrink: 0;
  width: ${(props) => (props.$touch ? "22px" : "16px")};
  height: ${(props) => (props.$touch ? "22px" : "16px")};
  accent-color: ${theme.colors.brand.primary};
  cursor: pointer;
`;

const RowInfo = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const RowTitle = styled.div`
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const RowArtist = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const RowMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${theme.space[2]};
  margin-top: 2px;

  &:empty {
    display: none;
  }
`;

const MetaBadge = styled.span`
  display: inline-flex;
  align-items: center;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  padding: 0 ${theme.space[2]};
  border-radius: ${theme.radius.sm};
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.medium};
  white-space: nowrap;
`;

const SignalLine = styled.div`
  font-size: ${theme.fontSizes.bodyXs};
  color: var(--color-text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const RowActions = styled.div`
  display: flex;
  gap: ${theme.space[2]};
  flex-shrink: 0;
`;

const RowButton = styled.button<{ $touch: boolean; $add?: boolean }>`
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  width: ${(props) => (props.$touch ? "44px" : "36px")};
  height: ${(props) => (props.$touch ? "44px" : "36px")};
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: ${(props) => (props.$add ? theme.fontSizes.bodyLg : theme.fontSizes.body)};
  transition: all ${theme.transitions.fast} ease;

  &:hover,
  &:focus-visible {
    background: var(--color-bg-elevated);
    border-color: ${theme.colors.brand.primary};
    color: ${theme.colors.brand.primary};
  }
`;

const PickerFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${theme.space[3]};
  padding: ${theme.space[3]} ${theme.space[5]};
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  padding-bottom: calc(${theme.space[3]} + env(safe-area-inset-bottom, 0px));
`;

const FooterButton = styled.button<{ $touch: boolean; $primary?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[2]};
  min-height: ${(props) => touchSize(props.$touch)};
  padding: 0 ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  cursor: pointer;
  border: 1px solid ${(props) => (props.$primary ? theme.colors.brand.primary : "var(--color-border)")};
  background: ${(props) => (props.$primary ? theme.colors.brand.primary : "transparent")};
  color: ${(props) => (props.$primary ? "white" : "var(--color-text-primary)")};
  white-space: nowrap;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
