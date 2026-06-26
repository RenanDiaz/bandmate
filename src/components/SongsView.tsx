import type { FC } from "react";
import type { User } from "@supabase/supabase-js";
import type { Song } from "../services/songsService";
import type { Band } from "../services/bandsService";
import type { RequestType } from "../services/requestsService";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Spinner, Container } from "reactstrap";
import styled from "styled-components";
import { theme } from "../theme";
import { getBandSongs, updateSong, deleteSong, transposeSong, resetSongTransposition } from "../services/songsService";
import type { UpdateSongInput } from "../services/songsService";
import { NewSongForm } from "./NewSongForm";
import { SongList } from "./SongList";
import { EditSongModal } from "./EditSongModal";
import { ImportSongsModal } from "./ImportSongsModal";
import { NewRequestModal } from "./NewRequestModal";
import { SongSearchFilter } from "./SongSearchFilter";
import { processSongs, DEFAULT_FILTERS, type SortOption, type FilterOptions } from "../utils/songFilters";
import { SEO } from "./SEO";

interface Props {
  user: User | null;
  selectedBand: Band | null;
}

const SongsView: FC<Props> = ({ user, selectedBand }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestSong, setRequestSong] = useState<Song | null>(null);
  const [requestType, setRequestType] = useState<RequestType | null>(null);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("artist_title_asc");
  const [filters, setFilters] = useState<FilterOptions>({ ...DEFAULT_FILTERS });

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
      t("songs.confirmDelete", { title: song.title })
    );
    if (!confirmed) return;

    try {
      await deleteSong(song.id);
      await loadSongs();
    } catch (error) {
      console.error("Failed to delete song:", error);
      alert(t("songs.deleteError"));
    }
  };

  const handleTransposeSong = async (songId: string, semitones: number) => {
    try {
      const updatedSong = await transposeSong(songId, semitones);
      // Update only the transposed song in state, preserving expansion state
      setSongs(prevSongs =>
        prevSongs.map(song => song.id === songId ? updatedSong : song)
      );
    } catch (error) {
      console.error("Failed to transpose song:", error);
      alert(t("songs.transposeError"));
    }
  };

  const handleResetTransposition = async (songId: string) => {
    try {
      const updatedSong = await resetSongTransposition(songId);
      // Update only the reset song in state, preserving expansion state
      setSongs(prevSongs =>
        prevSongs.map(song => song.id === songId ? updatedSong : song)
      );
    } catch (error) {
      console.error("Failed to reset transposition:", error);
      alert(t("songs.transposeError"));
    }
  };

  const handleRequestAction = (song: Song, actionType: RequestType) => {
    setRequestSong(song);
    setRequestType(actionType);
    setIsRequestModalOpen(true);
  };

  const handleRequestModalClose = () => {
    setIsRequestModalOpen(false);
    setRequestSong(null);
    setRequestType(null);
  };

  if (!user) {
    return (
      <PageWrapper>
        <Container>
          <MessageCard>
            <MessageIcon>
              <i className="bi bi-lock"></i>
            </MessageIcon>
            <MessageTitle>{t("common.authRequired")}</MessageTitle>
            <MessageText>{t("songs.pleaseSignIn")}</MessageText>
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
            <MessageTitle>{t("bands.noBandSelected")}</MessageTitle>
            <MessageText>{t("songs.selectBand")}</MessageText>
          </MessageCard>
        </Container>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <SEO
        title={t("songs.title")}
        description={t("songs.subtitle")}
      />
      <Container>
        <PageHeader>
          <HeaderContent>
            <BandBadge>
              <i className="bi bi-music-note-beamed"></i>
              {selectedBand.name}
            </BandBadge>
            <PageTitle>{t("songs.songLibrary")}</PageTitle>
            <PageSubtitle>
              {t("songs.subtitle")}
            </PageSubtitle>
          </HeaderContent>
          <HeaderActions>
            <StatsCard>
              <StatItem>
                <StatValue>{songs.length}</StatValue>
                <StatLabel>{t("songs.title")}</StatLabel>
              </StatItem>
            </StatsCard>
            <ActionButtons>
              <ActionButton onClick={() => setIsImportModalOpen(true)}>
                <i className="bi bi-file-earmark-arrow-up"></i>
                {t("songs.importCsv")}
              </ActionButton>
              {songs.length > 0 && (
                <ActionButton onClick={() => navigate("/songs/print")}>
                  <i className="bi bi-printer"></i>
                  {t("songs.printSongbook")}
                </ActionButton>
              )}
            </ActionButtons>
          </HeaderActions>
        </PageHeader>

        <ContentSection>
          <NewSongForm bandId={selectedBand.id} onSongCreated={loadSongs} />

          {loading ? (
            <LoadingContainer>
              <Spinner color="primary" style={{ width: '3rem', height: '3rem' }} />
              <LoadingText>{t("common.loading")}</LoadingText>
            </LoadingContainer>
          ) : songs.length === 0 ? (
            <EmptyState>
              <EmptyIcon>
                <i className="bi bi-music-note-list"></i>
              </EmptyIcon>
              <EmptyTitle>{t("songs.noSongs")}</EmptyTitle>
              <EmptyText>
                {t("songs.addFirstSong")}
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
                  <EmptyTitle>{t("songs.noSongsFound")}</EmptyTitle>
                  <EmptyText>
                    {t("songs.noSongsFoundDesc")}
                  </EmptyText>
                </EmptyState>
              ) : (
                <SongList
                  songs={filteredSongs}
                  onEdit={handleEditSong}
                  onDelete={handleDeleteSong}
                  onTranspose={handleTransposeSong}
                  onResetTransposition={handleResetTransposition}
                  onRequestAction={handleRequestAction}
                />
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

        <ImportSongsModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onImportComplete={loadSongs}
          bandId={selectedBand.id}
        />

        {requestSong && requestType && (
          <NewRequestModal
            isOpen={isRequestModalOpen}
            onClose={handleRequestModalClose}
            bandId={selectedBand.id}
            onCreated={handleRequestModalClose}
            prefillSongId={requestSong.id}
            prefillType={requestType}
          />
        )}
      </Container>
    </PageWrapper>
  );
};

// Styled Components

const PageWrapper = styled.div`
  min-height: calc(100vh - 80px);
  background: var(--color-bg-primary);
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
  border-bottom: 1px solid var(--color-border);

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

const ActionButtons = styled.div`
  display: flex;
  gap: ${theme.space[2]};

  @media (max-width: ${theme.breakpoints.md}) {
    flex-wrap: wrap;
  }
`;

const ActionButton = styled.button`
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  padding: ${theme.space[2]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  transition: all ${theme.transitions.fast} ease;
  white-space: nowrap;

  i {
    font-size: ${theme.fontSizes.body};
  }

  &:hover {
    background: var(--color-bg-tertiary);
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
  color: var(--color-text-primary);
  margin-bottom: ${theme.space[2]};
  line-height: ${theme.lineHeights.tight};

  @media (max-width: ${theme.breakpoints.md}) {
    font-size: ${theme.fontSizes.h1};
  }
`;

const PageSubtitle = styled.p`
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-secondary);
  margin: 0;
  line-height: ${theme.lineHeights.relaxed};
`;

const StatsCard = styled.div`
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
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
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: ${theme.letterSpacing.wide};
  font-weight: ${theme.fontWeights.medium};
`;

const ContentSection = styled.div`
  max-width: 1200px;
  margin: 0 auto;
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

const EmptyState = styled.div`
  text-align: center;
  padding: ${theme.space[12]} ${theme.space[6]};
  background: var(--color-bg-secondary);
  border: 1px dashed var(--color-border);
  border-radius: ${theme.radius.lg};
  margin-top: ${theme.space[6]};
`;

const EmptyIcon = styled.div`
  font-size: ${theme.fontSizes.displayLg};
  color: var(--color-text-tertiary);
  margin-bottom: ${theme.space[4]};
  opacity: 0.5;
`;

const EmptyTitle = styled.h3`
  font-size: ${theme.fontSizes.h2};
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

export default SongsView;
