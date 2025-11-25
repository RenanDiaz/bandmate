import type { FC } from "react";
import type { User } from "@supabase/supabase-js";
import type { Song } from "../services/songsService";
import type { Band } from "../services/bandsService";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Spinner, Container } from "reactstrap";
import styled from "styled-components";
import { theme } from "../theme";
import { getBandSongs, updateSong, deleteSong } from "../services/songsService";
import type { UpdateSongInput } from "../services/songsService";
import { NewSongForm } from "./NewSongForm";
import { SongList } from "./SongList";
import { EditSongModal } from "./EditSongModal";
import { SongSearchFilter, type SortOption, type FilterOptions } from "./SongSearchFilter";
import { processSongs } from "../utils/songFilters";

interface Props {
  user: User | null;
  selectedBand: Band | null;
}

const SongsView: FC<Props> = ({ user, selectedBand }) => {
  const navigate = useNavigate();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("artist_title_asc");
  const [filters, setFilters] = useState<FilterOptions>({
    hasChords: false,
    hasLyrics: false,
    hasKey: false,
    hasTempo: false,
    hasDuration: false,
    hasTags: false,
  });

  // Process songs with filters and search
  const filteredSongs = processSongs(songs, searchQuery, filters, sortBy);

  const loadSongs = async () => {
    if (!selectedBand) {
      setSongs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const songs = await getBandSongs(selectedBand.id);
      setSongs(songs);
    } catch (error) {
      console.error("Failed to load songs:", error);
      setSongs([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user && selectedBand) {
      loadSongs();
    } else {
      setSongs([]);
      setLoading(false);
    }
  }, [user, selectedBand]);

  const handleEditSong = (song: Song) => {
    setEditingSong(song);
    setIsEditModalOpen(true);
  };

  const handleSaveSong = async (songId: string, updates: UpdateSongInput) => {
    await updateSong(songId, updates);
    await loadSongs();
  };

  const handleDeleteSong = async (song: Song) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${song.title}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await deleteSong(song.id);
      await loadSongs();
    } catch (error) {
      console.error("Failed to delete song:", error);
      alert("Failed to delete song. Please try again.");
    }
  };

  if (!user) {
    return (
      <PageWrapper>
        <Container>
          <MessageCard>
            <MessageIcon>
              <i className="bi bi-lock"></i>
            </MessageIcon>
            <MessageTitle>Authentication Required</MessageTitle>
            <MessageText>Please sign in to view and manage your songs</MessageText>
          </MessageCard>
        </Container>
      </PageWrapper>
    );
  }

  if (!selectedBand) {
    return (
      <PageWrapper>
        <Container>
          <MessageCard>
            <MessageIcon>
              <i className="bi bi-music-note-beamed"></i>
            </MessageIcon>
            <MessageTitle>No Band Selected</MessageTitle>
            <MessageText>Please select a band to view and manage songs</MessageText>
          </MessageCard>
        </Container>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <Container>
        <PageHeader>
          <HeaderContent>
            <BandBadge>
              <i className="bi bi-music-note-beamed"></i>
              {selectedBand.name}
            </BandBadge>
            <PageTitle>Song Library</PageTitle>
            <PageSubtitle>
              Manage all your songs with lyrics, chords, and metadata
            </PageSubtitle>
          </HeaderContent>
          <HeaderActions>
            <StatsCard>
              <StatItem>
                <StatValue>{songs.length}</StatValue>
                <StatLabel>Songs</StatLabel>
              </StatItem>
            </StatsCard>
            {songs.length > 0 && (
              <PrintButton onClick={() => navigate("/songs/print")}>
                <i className="bi bi-printer"></i>
                Print Songbook
              </PrintButton>
            )}
          </HeaderActions>
        </PageHeader>

        <ContentSection>
          <NewSongForm bandId={selectedBand.id} onSongCreated={loadSongs} />

          {loading ? (
            <LoadingContainer>
              <Spinner color="primary" style={{ width: '3rem', height: '3rem' }} />
              <LoadingText>Loading songs...</LoadingText>
            </LoadingContainer>
          ) : songs.length === 0 ? (
            <EmptyState>
              <EmptyIcon>
                <i className="bi bi-music-note-list"></i>
              </EmptyIcon>
              <EmptyTitle>No songs yet</EmptyTitle>
              <EmptyText>
                Add your first song above to start building your repertoire
              </EmptyText>
            </EmptyState>
          ) : (
            <>
              <SongSearchFilter
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                sortBy={sortBy}
                onSortChange={setSortBy}
                filters={filters}
                onFilterChange={setFilters}
                resultsCount={filteredSongs.length}
                totalCount={songs.length}
              />

              {filteredSongs.length === 0 ? (
                <EmptyState>
                  <EmptyIcon>
                    <i className="bi bi-search"></i>
                  </EmptyIcon>
                  <EmptyTitle>No songs found</EmptyTitle>
                  <EmptyText>
                    Try adjusting your search or filters to find what you're looking for
                  </EmptyText>
                </EmptyState>
              ) : (
                <SongList songs={filteredSongs} onEdit={handleEditSong} onDelete={handleDeleteSong} />
              )}
            </>
          )}
        </ContentSection>

        <EditSongModal
          song={editingSong}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSave={handleSaveSong}
        />
      </Container>
    </PageWrapper>
  );
};

// Styled Components

const PageWrapper = styled.div`
  min-height: calc(100vh - 80px);
  background: ${theme.colors.dark.bg.primary};
  padding: ${theme.space[8]} 0;

  @media (max-width: ${theme.breakpoints.md}) {
    padding: ${theme.space[6]} 0;
  }
`;

const PageHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${theme.space[6]};
  margin-bottom: ${theme.space[8]};
  padding-bottom: ${theme.space[6]};
  border-bottom: 1px solid ${theme.colors.dark.border.default};

  @media (max-width: ${theme.breakpoints.md}) {
    flex-direction: column;
  }
`;

const HeaderContent = styled.div`
  flex: 1;
`;

const HeaderActions = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: ${theme.space[3]};

  @media (max-width: ${theme.breakpoints.md}) {
    width: 100%;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
`;

const PrintButton = styled.button`
  background: ${theme.colors.dark.bg.secondary};
  border: 1px solid ${theme.colors.dark.border.default};
  color: ${theme.colors.dark.text.secondary};
  padding: ${theme.space[2]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  transition: all ${theme.transitions.fast} ease;

  i {
    font-size: ${theme.fontSizes.body};
  }

  &:hover {
    background: ${theme.colors.dark.bg.tertiary};
    border-color: ${theme.colors.brand.primary};
    color: ${theme.colors.brand.primary};
  }
`;

const BandBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[2]};
  background: ${theme.gradients.brandPrimary};
  color: white;
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  padding: ${theme.space[2]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  margin-bottom: ${theme.space[4]};

  i {
    font-size: ${theme.fontSizes.body};
  }
`;

const PageTitle = styled.h1`
  font-size: ${theme.fontSizes.displayMd};
  font-weight: ${theme.fontWeights.bold};
  color: ${theme.colors.dark.text.primary};
  margin-bottom: ${theme.space[2]};
  line-height: ${theme.lineHeights.tight};

  @media (max-width: ${theme.breakpoints.md}) {
    font-size: ${theme.fontSizes.h1};
  }
`;

const PageSubtitle = styled.p`
  font-size: ${theme.fontSizes.body};
  color: ${theme.colors.dark.text.secondary};
  margin: 0;
  line-height: ${theme.lineHeights.relaxed};
`;

const StatsCard = styled.div`
  background: ${theme.colors.dark.bg.secondary};
  border: 1px solid ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.lg};
  padding: ${theme.space[5]};
  min-width: 140px;

  @media (max-width: ${theme.breakpoints.md}) {
    width: 100%;
  }
`;

const StatItem = styled.div`
  text-align: center;
`;

const StatValue = styled.div`
  font-size: ${theme.fontSizes.displayMd};
  font-weight: ${theme.fontWeights.bold};
  color: ${theme.colors.brand.primary};
  line-height: 1;
  margin-bottom: ${theme.space[2]};
`;

const StatLabel = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.dark.text.secondary};
  text-transform: uppercase;
  letter-spacing: ${theme.letterSpacing.wide};
  font-weight: ${theme.fontWeights.medium};
`;

const ContentSection = styled.div`
  max-width: 1200px;
  margin: 0 auto;
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

const EmptyState = styled.div`
  text-align: center;
  padding: ${theme.space[12]} ${theme.space[6]};
  background: ${theme.colors.dark.bg.secondary};
  border: 1px dashed ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.lg};
  margin-top: ${theme.space[6]};
`;

const EmptyIcon = styled.div`
  font-size: ${theme.fontSizes.displayLg};
  color: ${theme.colors.dark.text.tertiary};
  margin-bottom: ${theme.space[4]};
  opacity: 0.5;
`;

const EmptyTitle = styled.h3`
  font-size: ${theme.fontSizes.h2};
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

export default SongsView;
