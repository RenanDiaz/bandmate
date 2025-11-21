import type { FC } from "react";
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Container, Spinner } from "reactstrap";
import styled from "styled-components";
import { theme } from "../theme";
import { getSetlist } from "../services/setlistsService";
import type { Setlist } from "../services/setlistsService";
import { getBandSongs } from "../services/songsService";
import type { Song } from "../services/songsService";

const SetlistDetailView: FC = () => {
  const { setlistId } = useParams<{ setlistId: string }>();
  const navigate = useNavigate();

  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!setlistId) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const setlistData = await getSetlist(setlistId);
        setSetlist(setlistData);

        // Load all songs for the band
        const allSongs = await getBandSongs(setlistData.band_id);

        // Map setlist songs to full song objects in order
        const orderedSongs = setlistData.songs
          .sort((a, b) => a.position - b.position)
          .map((setlistSong) => allSongs.find((s) => s.id === setlistSong.song_id))
          .filter((song): song is Song => song !== undefined);

        setSongs(orderedSongs);
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

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    });
  };

  const calculateTotalDuration = (): number => {
    return songs.reduce((total, song) => total + (song.duration || 0), 0);
  };

  const getSetlistSongNotes = (songId: string): string | undefined => {
    if (!setlist) return undefined;
    const setlistSong = setlist.songs.find((s) => s.song_id === songId);
    return setlistSong?.notes;
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
      <StyledContainer>
        <Header>
          <HeaderTop>
            <BackLink onClick={() => navigate("/setlists")}>
              <i className="bi bi-arrow-left"></i>
              Back to Setlists
            </BackLink>
            <ActionButtons>
              <ActionButton
                onClick={() => navigate(`/setlists/${setlistId}/edit`)}
                $variant="edit"
              >
                <i className="bi bi-pencil"></i>
                Edit Setlist
              </ActionButton>
              <ActionButton
                onClick={() => navigate(`/setlists/${setlistId}/perform`)}
                $variant="perform"
                disabled={songs.length === 0}
              >
                <i className="bi bi-play-circle"></i>
                Start Performance
              </ActionButton>
            </ActionButtons>
          </HeaderTop>

          <SetlistTitle>{setlist.name}</SetlistTitle>

          {setlist.description && (
            <SetlistDescription>{setlist.description}</SetlistDescription>
          )}

          <MetadataBar>
            {setlist.venue && (
              <MetadataItem>
                <i className="bi bi-geo-alt"></i>
                {setlist.venue}
              </MetadataItem>
            )}
            {setlist.event_date && (
              <MetadataItem>
                <i className="bi bi-calendar-event"></i>
                {formatDate(setlist.event_date)}
              </MetadataItem>
            )}
            <MetadataItem>
              <i className="bi bi-music-note-beamed"></i>
              {songs.length} {songs.length === 1 ? "song" : "songs"}
            </MetadataItem>
            {totalDuration > 0 && (
              <MetadataItem>
                <i className="bi bi-clock"></i>
                Total: {formatDuration(totalDuration)}
              </MetadataItem>
            )}
          </MetadataBar>
        </Header>

        {songs.length === 0 ? (
          <EmptyState>
            <EmptyIcon>
              <i className="bi bi-music-note-list"></i>
            </EmptyIcon>
            <EmptyTitle>No Songs Yet</EmptyTitle>
            <EmptyText>This setlist doesn't have any songs. Click "Edit Setlist" to add songs.</EmptyText>
          </EmptyState>
        ) : (
          <SongsList>
            {songs.map((song, index) => {
              const notes = getSetlistSongNotes(song.id);
              return (
                <SongCard key={song.id}>
                  <SongPosition>{index + 1}</SongPosition>
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
            })}
          </SongsList>
        )}
      </StyledContainer>
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

const SongsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[3]};
`;

const SongCard = styled.div`
  background: ${theme.colors.dark.bg.secondary};
  border: 1px solid ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.lg};
  padding: ${theme.space[4]};
  display: flex;
  align-items: flex-start;
  gap: ${theme.space[4]};
  transition: all ${theme.transitions.fast} ease;

  &:hover {
    border-color: ${theme.colors.brand.primary};
    box-shadow: ${theme.shadows.sm};
  }

  @media (max-width: ${theme.breakpoints.md}) {
    flex-direction: column;
    gap: ${theme.space[3]};
  }
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

export default SetlistDetailView;
