import { useState } from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import { theme } from "../theme";
import { DEFAULT_FILTERS } from "../utils/songFilters";
import type { SortOption, FilterField, FilterState, FilterOptions } from "../utils/songFilters";

export type { SortOption, FilterField, FilterState, FilterOptions } from "../utils/songFilters";

const FILTER_FIELDS: { field: FilterField; icon: string; labelKey: string }[] = [
  { field: "chords", icon: "bi-music-note", labelKey: "songs.filterFields.chords" },
  { field: "lyrics", icon: "bi-file-text", labelKey: "songs.filterFields.lyrics" },
  { field: "key", icon: "bi-music-note-beamed", labelKey: "songs.filterFields.key" },
  { field: "tempo", icon: "bi-speedometer2", labelKey: "songs.filterFields.tempo" },
  { field: "duration", icon: "bi-clock", labelKey: "songs.filterFields.duration" },
  { field: "tags", icon: "bi-tags", labelKey: "songs.filterFields.tags" },
];

const FILTER_STATES: { state: FilterState; labelKey: string }[] = [
  { state: "any", labelKey: "songs.filterState.any" },
  { state: "has", labelKey: "songs.filterState.has" },
  { state: "none", labelKey: "songs.filterState.none" },
];

interface Props {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  filters: FilterOptions;
  onFilterChange: (filters: FilterOptions) => void;
  resultsCount: number;
  totalCount: number;
}

export const SongSearchFilter = ({
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  filters,
  onFilterChange,
  resultsCount,
  totalCount,
}: Props) => {
  const { t } = useTranslation();
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);

  const activeFilterCount = Object.values(filters).filter((state) => state !== "any").length;
  const hasActiveFilters = activeFilterCount > 0;

  return (
    <SearchFilterContainer>
      <SearchRow>
        <SearchInputWrapper>
          <SearchIcon>
            <i className="bi bi-search"></i>
          </SearchIcon>
          <SearchInput
            type="text"
            placeholder={t('songs.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery && (
            <ClearButton
              onClick={() => onSearchChange("")}
              title={t('songs.clearSearch')}
              type="button"
            >
              <i className="bi bi-x"></i>
            </ClearButton>
          )}
        </SearchInputWrapper>

        <ControlsGroup>
          <SortSelect value={sortBy} onChange={(e) => onSortChange(e.target.value as SortOption)}>
            <option value="artist_title_asc">{t('songs.sortOptions.artistTitle')}</option>
            <option value="title_asc">{t('songs.sortOptions.titleAsc')}</option>
            <option value="title_desc">{t('songs.sortOptions.titleDesc')}</option>
            <option value="artist_asc">{t('songs.sortOptions.artistAsc')}</option>
            <option value="artist_desc">{t('songs.sortOptions.artistDesc')}</option>
            <option value="date_desc">{t('songs.sortOptions.newestFirst')}</option>
            <option value="date_asc">{t('songs.sortOptions.oldestFirst')}</option>
            <option value="tempo_asc">{t('songs.sortOptions.tempoAsc')}</option>
            <option value="tempo_desc">{t('songs.sortOptions.tempoDesc')}</option>
            <option value="duration_asc">{t('songs.sortOptions.durationAsc')}</option>
            <option value="duration_desc">{t('songs.sortOptions.durationDesc')}</option>
          </SortSelect>

          <FilterToggleButton
            onClick={() => setIsFilterExpanded(!isFilterExpanded)}
            $active={hasActiveFilters}
            title={t('songs.toggleFilters')}
            type="button"
          >
            <i className="bi bi-funnel"></i>
            {t('songs.filters')}
            {hasActiveFilters && <FilterBadge>{activeFilterCount}</FilterBadge>}
          </FilterToggleButton>
        </ControlsGroup>
      </SearchRow>

      {isFilterExpanded && (
        <FilterPanel>
          <FilterTitle>{t('songs.filterByContent')}</FilterTitle>
          <FilterRows>
            {FILTER_FIELDS.map(({ field, icon, labelKey }) => (
              <FilterRow key={field}>
                <FilterFieldLabel>
                  <i className={`bi ${icon}`}></i>
                  {t(labelKey)}
                </FilterFieldLabel>
                <SegmentedControl role="group">
                  {FILTER_STATES.map(({ state, labelKey: stateLabelKey }) => (
                    <SegmentButton
                      key={state}
                      type="button"
                      $active={filters[field] === state}
                      $variant={state}
                      onClick={() => onFilterChange({ ...filters, [field]: state })}
                    >
                      {t(stateLabelKey)}
                    </SegmentButton>
                  ))}
                </SegmentedControl>
              </FilterRow>
            ))}
          </FilterRows>

          {hasActiveFilters && (
            <ClearFiltersButton
              onClick={() => onFilterChange({ ...DEFAULT_FILTERS })}
              type="button"
            >
              {t('songs.clearAllFilters')}
            </ClearFiltersButton>
          )}
        </FilterPanel>
      )}

      {(searchQuery || hasActiveFilters) && (
        <ResultsInfo>
          {t('songs.showingResults', { resultsCount, totalCount })}
          {searchQuery && ` matching "${searchQuery}"`}
        </ResultsInfo>
      )}
    </SearchFilterContainer>
  );
};

// Styled Components

const SearchFilterContainer = styled.div`
  margin-bottom: ${theme.space[6]};
`;

const SearchRow = styled.div`
  display: flex;
  gap: ${theme.space[3]};
  margin-bottom: ${theme.space[3]};

  @media (max-width: ${theme.breakpoints.md}) {
    flex-direction: column;
  }
`;

const SearchInputWrapper = styled.div`
  position: relative;
  flex: 1;
`;

const SearchIcon = styled.div`
  position: absolute;
  left: ${theme.space[4]};
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-tertiary);
  font-size: ${theme.fontSizes.body};
  pointer-events: none;
`;

const SearchInput = styled.input`
  width: 100%;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  padding: ${theme.space[3]} 48px ${theme.space[3]} 44px;
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
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

  &:hover:not(:focus) {
    border-color: var(--color-border-strong);
  }
`;

const ClearButton = styled.button`
  position: absolute;
  right: ${theme.space[2]};
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  color: var(--color-text-tertiary);
  width: 32px;
  height: 32px;
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  font-size: ${theme.fontSizes.h4};

  &:hover {
    background: var(--color-bg-elevated);
    color: var(--color-text-primary);
  }
`;

const ControlsGroup = styled.div`
  display: flex;
  gap: ${theme.space[3]};

  @media (max-width: ${theme.breakpoints.md}) {
    width: 100%;
  }
`;

const SortSelect = styled.select`
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  padding: ${theme.space[3]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  font-family: ${theme.fonts.sans};
  min-width: 160px;

  &:focus {
    outline: none;
    border-color: ${theme.colors.brand.primary};
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  }

  &:hover {
    border-color: var(--color-border-strong);
  }

  @media (max-width: ${theme.breakpoints.md}) {
    flex: 1;
  }
`;

const FilterToggleButton = styled.button<{ $active: boolean }>`
  background: ${(props) => (props.$active ? theme.colors.brand.primary : 'var(--color-bg-secondary)')};
  border: 1px solid ${(props) => (props.$active ? theme.colors.brand.primary : 'var(--color-border)')};
  color: ${(props) => (props.$active ? "white" : 'var(--color-text-primary)')};
  padding: ${theme.space[3]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  white-space: nowrap;

  i {
    font-size: ${theme.fontSizes.body};
  }

  &:hover {
    background: ${(props) => (props.$active ? theme.colors.brand.primaryHover : 'var(--color-bg-elevated)')};
    border-color: ${theme.colors.brand.primary};
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }

  @media (max-width: ${theme.breakpoints.md}) {
    flex: 1;
    justify-content: center;
  }
`;

const FilterBadge = styled.span`
  background: rgba(255, 255, 255, 0.2);
  padding: ${theme.space[1]} ${theme.space[2]};
  border-radius: ${theme.radius.sm};
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.bold};
  line-height: 1;
`;

const FilterPanel = styled.div`
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.base};
  padding: ${theme.space[5]};
  margin-bottom: ${theme.space[3]};
  animation: slideDown 0.2s ease-out;

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const FilterTitle = styled.h4`
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  text-transform: uppercase;
  letter-spacing: ${theme.letterSpacing.wide};
  margin: 0 0 ${theme.space[3]} 0;
`;

const FilterRows = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[3]};
  margin-bottom: ${theme.space[4]};
`;

const FilterRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${theme.space[3]};

  @media (max-width: ${theme.breakpoints.sm}) {
    flex-direction: column;
    align-items: stretch;
    gap: ${theme.space[2]};
  }
`;

const FilterFieldLabel = styled.span`
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  user-select: none;

  i {
    color: ${theme.colors.brand.primary};
    font-size: ${theme.fontSizes.body};
  }
`;

const SegmentedControl = styled.div`
  display: inline-flex;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.base};
  padding: 2px;
  gap: 2px;

  @media (max-width: ${theme.breakpoints.sm}) {
    display: flex;
  }
`;

const segmentActiveColor = (variant: FilterState) => {
  if (variant === "has") return theme.colors.brand.primary;
  if (variant === "none") return theme.colors.semantic.error;
  return "var(--color-bg-elevated)";
};

const SegmentButton = styled.button<{ $active: boolean; $variant: FilterState }>`
  flex: 1;
  background: ${(props) => (props.$active ? segmentActiveColor(props.$variant) : "transparent")};
  border: none;
  color: ${(props) =>
    props.$active
      ? props.$variant === "any"
        ? "var(--color-text-primary)"
        : "white"
      : "var(--color-text-secondary)"};
  padding: ${theme.space[1]} ${theme.space[3]};
  border-radius: ${theme.radius.sm};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  white-space: nowrap;
  min-width: 64px;

  &:hover {
    color: ${(props) => (props.$active ? undefined : "var(--color-text-primary)")};
  }
`;

const ClearFiltersButton = styled.button`
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  padding: ${theme.space[2]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  &:hover {
    background: var(--color-bg-elevated);
    border-color: var(--color-border-strong);
    color: var(--color-text-primary);
  }
`;

const ResultsInfo = styled.div`
  padding: ${theme.space[3]} ${theme.space[4]};
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.base};
  color: var(--color-text-secondary);
  font-size: ${theme.fontSizes.bodySm};
  text-align: center;
`;
