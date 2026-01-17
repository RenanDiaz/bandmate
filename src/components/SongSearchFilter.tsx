import { useState } from "react";
import styled from "styled-components";
import { theme } from "../theme";

export type SortOption =
  | "artist_title_asc"
  | "date_desc"
  | "date_asc"
  | "title_asc"
  | "title_desc"
  | "artist_asc"
  | "artist_desc"
  | "tempo_asc"
  | "tempo_desc"
  | "duration_asc"
  | "duration_desc";

export interface FilterOptions {
  hasChords: boolean;
  hasLyrics: boolean;
  hasKey: boolean;
  hasTempo: boolean;
  hasDuration: boolean;
  hasTags: boolean;
}

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
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);

  const hasActiveFilters =
    filters.hasChords || filters.hasLyrics || filters.hasKey || filters.hasTempo || filters.hasDuration || filters.hasTags;

  return (
    <SearchFilterContainer>
      <SearchRow>
        <SearchInputWrapper>
          <SearchIcon>
            <i className="bi bi-search"></i>
          </SearchIcon>
          <SearchInput
            type="text"
            placeholder="Search songs by title or artist..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery && (
            <ClearButton
              onClick={() => onSearchChange("")}
              title="Clear search"
              type="button"
            >
              <i className="bi bi-x"></i>
            </ClearButton>
          )}
        </SearchInputWrapper>

        <ControlsGroup>
          <SortSelect value={sortBy} onChange={(e) => onSortChange(e.target.value as SortOption)}>
            <option value="artist_title_asc">Artist & Title (A-Z)</option>
            <option value="title_asc">Title (A-Z)</option>
            <option value="title_desc">Title (Z-A)</option>
            <option value="artist_asc">Artist (A-Z)</option>
            <option value="artist_desc">Artist (Z-A)</option>
            <option value="date_desc">Newest First</option>
            <option value="date_asc">Oldest First</option>
            <option value="tempo_asc">Tempo (Slow to Fast)</option>
            <option value="tempo_desc">Tempo (Fast to Slow)</option>
            <option value="duration_asc">Duration (Short to Long)</option>
            <option value="duration_desc">Duration (Long to Short)</option>
          </SortSelect>

          <FilterToggleButton
            onClick={() => setIsFilterExpanded(!isFilterExpanded)}
            $active={hasActiveFilters}
            title="Toggle filters"
            type="button"
          >
            <i className="bi bi-funnel"></i>
            Filters
            {hasActiveFilters && <FilterBadge>{Object.values(filters).filter(Boolean).length}</FilterBadge>}
          </FilterToggleButton>
        </ControlsGroup>
      </SearchRow>

      {isFilterExpanded && (
        <FilterPanel>
          <FilterTitle>Filter by content</FilterTitle>
          <FilterOptions>
            <FilterCheckbox>
              <Checkbox
                type="checkbox"
                id="hasChords"
                checked={filters.hasChords}
                onChange={(e) => onFilterChange({ ...filters, hasChords: e.target.checked })}
              />
              <CheckboxLabel htmlFor="hasChords">
                <i className="bi bi-music-note"></i>
                Has Chords
              </CheckboxLabel>
            </FilterCheckbox>

            <FilterCheckbox>
              <Checkbox
                type="checkbox"
                id="hasLyrics"
                checked={filters.hasLyrics}
                onChange={(e) => onFilterChange({ ...filters, hasLyrics: e.target.checked })}
              />
              <CheckboxLabel htmlFor="hasLyrics">
                <i className="bi bi-file-text"></i>
                Has Lyrics
              </CheckboxLabel>
            </FilterCheckbox>

            <FilterCheckbox>
              <Checkbox
                type="checkbox"
                id="hasKey"
                checked={filters.hasKey}
                onChange={(e) => onFilterChange({ ...filters, hasKey: e.target.checked })}
              />
              <CheckboxLabel htmlFor="hasKey">
                <i className="bi bi-music-note-beamed"></i>
                Has Key
              </CheckboxLabel>
            </FilterCheckbox>

            <FilterCheckbox>
              <Checkbox
                type="checkbox"
                id="hasTempo"
                checked={filters.hasTempo}
                onChange={(e) => onFilterChange({ ...filters, hasTempo: e.target.checked })}
              />
              <CheckboxLabel htmlFor="hasTempo">
                <i className="bi bi-speedometer2"></i>
                Has Tempo
              </CheckboxLabel>
            </FilterCheckbox>

            <FilterCheckbox>
              <Checkbox
                type="checkbox"
                id="hasDuration"
                checked={filters.hasDuration}
                onChange={(e) => onFilterChange({ ...filters, hasDuration: e.target.checked })}
              />
              <CheckboxLabel htmlFor="hasDuration">
                <i className="bi bi-clock"></i>
                Has Duration
              </CheckboxLabel>
            </FilterCheckbox>

            <FilterCheckbox>
              <Checkbox
                type="checkbox"
                id="hasTags"
                checked={filters.hasTags}
                onChange={(e) => onFilterChange({ ...filters, hasTags: e.target.checked })}
              />
              <CheckboxLabel htmlFor="hasTags">
                <i className="bi bi-tags"></i>
                Has Tags
              </CheckboxLabel>
            </FilterCheckbox>
          </FilterOptions>

          {hasActiveFilters && (
            <ClearFiltersButton
              onClick={() =>
                onFilterChange({
                  hasChords: false,
                  hasLyrics: false,
                  hasKey: false,
                  hasTempo: false,
                  hasDuration: false,
                  hasTags: false,
                })
              }
              type="button"
            >
              Clear all filters
            </ClearFiltersButton>
          )}
        </FilterPanel>
      )}

      {(searchQuery || hasActiveFilters) && (
        <ResultsInfo>
          Showing {resultsCount} of {totalCount} songs
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

const FilterOptions = styled.div`
  display: flex;
  gap: ${theme.space[4]};
  margin-bottom: ${theme.space[4]};

  @media (max-width: ${theme.breakpoints.sm}) {
    flex-direction: column;
    gap: ${theme.space[3]};
  }
`;

const FilterCheckbox = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
`;

const Checkbox = styled.input`
  width: 20px;
  height: 20px;
  cursor: pointer;
  accent-color: ${theme.colors.brand.primary};
`;

const CheckboxLabel = styled.label`
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  user-select: none;

  i {
    color: ${theme.colors.brand.primary};
    font-size: ${theme.fontSizes.body};
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
