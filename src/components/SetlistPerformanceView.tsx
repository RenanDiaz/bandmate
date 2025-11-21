import type { FC } from "react";
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Spinner } from "reactstrap";
import styled from "styled-components";
import { theme } from "../theme";
import { getSetlist } from "../services/setlistsService";
import type { Setlist } from "../services/setlistsService";
import { getBandSongs } from "../services/songsService";
import type { Song } from "../services/songsService";

const SetlistPerformanceView: FC = () => {
  const { setlistId } = useParams<{ setlistId: string }>();
  const navigate = useNavigate();

  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSongList, setShowSongList] = useState(false);
  const [contentView, setContentView] = useState<"chords" | "lyrics">("chords");

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

  useEffect(() => {
    // Keyboard navigation
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        handleNextSong();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        handlePrevSong();
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (isFullscreen) {
          exitFullscreen();
        } else {
          navigate("/setlists");
        }
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        setShowSongList((prev) => !prev);
      } else if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        toggleContentView();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, songs.length, isFullscreen, navigate]);

  // Scroll to top when song changes
  useEffect(() => {
    const songDisplay = document.querySelector('[data-song-display]');
    if (songDisplay) {
      songDisplay.scrollTop = 0;
    }
  }, [currentIndex]);

  const handlePrevSong = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNextSong = () => {
    if (currentIndex < songs.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleGoToSong = (index: number) => {
    setCurrentIndex(index);
    setShowSongList(false);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      exitFullscreen();
    }
  };

  const exitFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    setIsFullscreen(false);
  };

  const toggleContentView = () => {
    setContentView((prev) => (prev === "chords" ? "lyrics" : "chords"));
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
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
        <LoadingText>Loading performance view...</LoadingText>
      </LoadingContainer>
    );
  }

  if (!setlist || songs.length === 0) {
    return (
      <ErrorContainer>
        <ErrorIcon>
          <i className="bi bi-exclamation-triangle"></i>
        </ErrorIcon>
        <ErrorTitle>Unable to Load Setlist</ErrorTitle>
        <ErrorText>
          {!setlist ? "Setlist not found" : "No songs in this setlist"}
        </ErrorText>
        <BackButton onClick={() => navigate("/setlists")}>
          <i className="bi bi-arrow-left"></i>
          Back to Setlists
        </BackButton>
      </ErrorContainer>
    );
  }

  const currentSong = songs[currentIndex];
  const currentNotes = getSetlistSongNotes(currentSong.id);

  // Determine what content to display with smart fallback
  const getDisplayContent = (): { type: "chords" | "lyrics" | "none"; content: string } => {
    const hasChords = Boolean(currentSong.chords);
    const hasLyrics = Boolean(currentSong.lyrics);

    if (contentView === "chords") {
      if (hasChords) {
        return { type: "chords", content: currentSong.chords! };
      } else if (hasLyrics) {
        return { type: "lyrics", content: currentSong.lyrics! };
      }
    } else {
      // contentView === "lyrics"
      if (hasLyrics) {
        return { type: "lyrics", content: currentSong.lyrics! };
      } else if (hasChords) {
        return { type: "chords", content: currentSong.chords! };
      }
    }

    return { type: "none", content: "" };
  };

  const displayContent = getDisplayContent();

  return (
    <PerformanceContainer>
      {/* Top Bar */}
      <TopBar>
        <TopBarLeft>
          <ExitButton onClick={() => navigate("/setlists")} title="Exit (ESC)">
            <i className="bi bi-x-lg"></i>
          </ExitButton>
          <SetlistInfo>
            <SetlistName>{setlist.name}</SetlistName>
            {setlist.venue && <VenueName>{setlist.venue}</VenueName>}
          </SetlistInfo>
        </TopBarLeft>

        <TopBarRight>
          <SongCounter>
            {currentIndex + 1} / {songs.length}
          </SongCounter>
          <ViewToggleGroup>
            <ViewToggleButton
              onClick={() => setContentView("chords")}
              $active={contentView === "chords"}
              title="Show Chords"
            >
              <i className="bi bi-music-note"></i>
              <span>Chords</span>
            </ViewToggleButton>
            <ViewToggleButton
              onClick={() => setContentView("lyrics")}
              $active={contentView === "lyrics"}
              title="Show Lyrics"
            >
              <i className="bi bi-mic"></i>
              <span>Lyrics</span>
            </ViewToggleButton>
          </ViewToggleGroup>
          <IconButton
            onClick={() => setShowSongList(!showSongList)}
            title="Song List (L)"
            $active={showSongList}
          >
            <i className="bi bi-list-ul"></i>
          </IconButton>
          <IconButton onClick={toggleFullscreen} title="Fullscreen (F)">
            <i className={`bi bi-${isFullscreen ? "fullscreen-exit" : "arrows-fullscreen"}`}></i>
          </IconButton>
        </TopBarRight>
      </TopBar>

      {/* Main Content Area */}
      <MainContent>
        {/* Song List Sidebar */}
        {showSongList && (
          <SongListSidebar>
            <SidebarHeader>Setlist Songs</SidebarHeader>
            <SongListItems>
              {songs.map((song, index) => (
                <SongListItem
                  key={song.id}
                  $active={index === currentIndex}
                  onClick={() => handleGoToSong(index)}
                >
                  <SongListPosition>{index + 1}</SongListPosition>
                  <SongListInfo>
                    <SongListTitle>{song.title}</SongListTitle>
                    {song.artist && <SongListArtist>{song.artist}</SongListArtist>}
                  </SongListInfo>
                  {index === currentIndex && (
                    <SongListIndicator>
                      <i className="bi bi-play-fill"></i>
                    </SongListIndicator>
                  )}
                </SongListItem>
              ))}
            </SongListItems>
          </SongListSidebar>
        )}

        {/* Song Display */}
        <SongDisplay data-song-display>
          <SongHeader>
            <SongTitleLarge>{currentSong.title}</SongTitleLarge>
            {currentSong.artist && <SongArtistLarge>{currentSong.artist}</SongArtistLarge>}

            <SongMetadataBar>
              {currentSong.key && (
                <MetaBadgeLarge>
                  <i className="bi bi-music-note-beamed"></i>
                  Key: {currentSong.key}
                </MetaBadgeLarge>
              )}
              {currentSong.tempo && (
                <MetaBadgeLarge>
                  <i className="bi bi-speedometer2"></i>
                  {currentSong.tempo} BPM
                </MetaBadgeLarge>
              )}
              {currentSong.duration && (
                <MetaBadgeLarge>
                  <i className="bi bi-clock"></i>
                  {formatDuration(currentSong.duration)}
                </MetaBadgeLarge>
              )}
            </SongMetadataBar>

            {currentNotes && (
              <NotesBox>
                <NotesLabel>
                  <i className="bi bi-sticky"></i>
                  Notes:
                </NotesLabel>
                <NotesText>{currentNotes}</NotesText>
              </NotesBox>
            )}
          </SongHeader>

          <SongContent>
            {displayContent.type === "chords" && (
              <ContentSection>
                <SectionLabel>
                  <i className="bi bi-music-note"></i>
                  Chords
                </SectionLabel>
                <ContentText>{displayContent.content}</ContentText>
              </ContentSection>
            )}

            {displayContent.type === "lyrics" && (
              <ContentSection>
                <SectionLabel>
                  <i className="bi bi-mic"></i>
                  Lyrics
                </SectionLabel>
                <ContentText>{displayContent.content}</ContentText>
              </ContentSection>
            )}

            {displayContent.type === "none" && (
              <EmptyContent>
                <i className="bi bi-music-note-beamed"></i>
                <p>No chords or lyrics available for this song</p>
              </EmptyContent>
            )}
          </SongContent>
        </SongDisplay>
      </MainContent>

      {/* Bottom Navigation */}
      <BottomNav>
        <NavButton onClick={handlePrevSong} disabled={currentIndex === 0}>
          <i className="bi bi-chevron-left"></i>
          <span>Previous</span>
        </NavButton>

        <NavCenter>
          <ProgressBar>
            <ProgressFill $percent={((currentIndex + 1) / songs.length) * 100} />
          </ProgressBar>
          <KeyboardHint>
            Use arrow keys or click to navigate • ESC to exit • F for fullscreen • L for list • T to toggle view
          </KeyboardHint>
        </NavCenter>

        <NavButton onClick={handleNextSong} disabled={currentIndex === songs.length - 1}>
          <span>Next</span>
          <i className="bi bi-chevron-right"></i>
        </NavButton>
      </BottomNav>
    </PerformanceContainer>
  );
};

// Styled Components

const PerformanceContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: ${theme.colors.dark.bg.primary};
  display: flex;
  flex-direction: column;
  z-index: ${theme.zIndex.modal};
`;

const TopBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${theme.space[4]} ${theme.space[6]};
  background: ${theme.colors.dark.bg.secondary};
  border-bottom: 1px solid ${theme.colors.dark.border.default};
  flex-shrink: 0;
`;

const TopBarLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[4]};
`;

const TopBarRight = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
`;

const ExitButton = styled.button`
  background: transparent;
  border: 1px solid ${theme.colors.dark.border.default};
  color: ${theme.colors.dark.text.secondary};
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
    background: ${theme.colors.semantic.errorBgDark};
    border-color: ${theme.colors.semantic.error};
    color: ${theme.colors.semantic.error};
  }
`;

const SetlistInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[1]};
`;

const SetlistName = styled.div`
  font-size: ${theme.fontSizes.bodyLg};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.dark.text.primary};
`;

const VenueName = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.dark.text.secondary};
`;

const SongCounter = styled.div`
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.medium};
  color: ${theme.colors.dark.text.primary};
  padding: ${theme.space[2]} ${theme.space[4]};
  background: ${theme.colors.dark.bg.tertiary};
  border-radius: ${theme.radius.base};
`;

const ViewToggleGroup = styled.div`
  display: flex;
  gap: ${theme.space[2]};
  background: ${theme.colors.dark.bg.tertiary};
  padding: ${theme.space[1]};
  border-radius: ${theme.radius.base};
  border: 1px solid ${theme.colors.dark.border.default};

  @media (max-width: ${theme.breakpoints.md}) {
    background: transparent;
    border: none;
    padding: 0;
    gap: ${theme.space[2]};
  }
`;

const ViewToggleButton = styled.button<{ $active: boolean }>`
  background: ${(props) =>
    props.$active ? theme.colors.brand.primary : "transparent"};
  border: none;
  color: ${(props) =>
    props.$active ? "white" : theme.colors.dark.text.secondary};
  padding: ${theme.space[2]} ${theme.space[4]};
  border-radius: ${theme.radius.sm};
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};

  i {
    font-size: ${theme.fontSizes.body};
  }

  &:hover {
    background: ${(props) =>
      props.$active ? theme.colors.brand.primaryHover : theme.colors.dark.bg.elevated};
    color: ${(props) =>
      props.$active ? "white" : theme.colors.brand.primary};
  }

  @media (max-width: ${theme.breakpoints.md}) {
    width: 48px;
    height: 48px;
    padding: 0;
    border: 1px solid ${(props) =>
      props.$active ? theme.colors.brand.primary : theme.colors.dark.border.default};
    border-radius: ${theme.radius.base};

    span {
      display: none;
    }

    i {
      font-size: ${theme.fontSizes.bodyLg};
    }
  }
`;

const IconButton = styled.button<{ $active?: boolean }>`
  background: ${(props) =>
    props.$active ? theme.colors.brand.primary : "transparent"};
  border: 1px solid ${(props) =>
    props.$active ? theme.colors.brand.primary : theme.colors.dark.border.default};
  color: ${(props) =>
    props.$active ? "white" : theme.colors.dark.text.secondary};
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
    background: ${(props) =>
      props.$active ? theme.colors.brand.primaryHover : theme.colors.dark.bg.elevated};
    border-color: ${theme.colors.brand.primary};
    color: ${(props) =>
      props.$active ? "white" : theme.colors.brand.primary};
  }

  @media (max-width: ${theme.breakpoints.md}) {
    width: 48px;
    height: 48px;
    font-size: ${theme.fontSizes.h3};
  }
`;

const MainContent = styled.div`
  flex: 1;
  display: flex;
  overflow: hidden;
`;

const SongListSidebar = styled.div`
  width: 320px;
  background: ${theme.colors.dark.bg.secondary};
  border-right: 1px solid ${theme.colors.dark.border.default};
  display: flex;
  flex-direction: column;
  flex-shrink: 0;

  @media (max-width: ${theme.breakpoints.md}) {
    position: absolute;
    left: 0;
    top: 65px;
    bottom: 80px;
    z-index: 10;
    box-shadow: ${theme.shadows.lg};
  }
`;

const SidebarHeader = styled.div`
  padding: ${theme.space[4]} ${theme.space[5]};
  border-bottom: 1px solid ${theme.colors.dark.border.default};
  font-size: ${theme.fontSizes.h4};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.dark.text.primary};
`;

const SongListItems = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${theme.space[2]};
`;

const SongListItem = styled.button<{ $active: boolean }>`
  width: 100%;
  background: ${(props) =>
    props.$active ? theme.colors.brand.primary : "transparent"};
  border: 1px solid ${(props) =>
    props.$active ? theme.colors.brand.primary : theme.colors.dark.border.default};
  color: ${(props) =>
    props.$active ? "white" : theme.colors.dark.text.primary};
  padding: ${theme.space[3]};
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  margin-bottom: ${theme.space[2]};
  text-align: left;

  &:hover {
    background: ${(props) =>
      props.$active ? theme.colors.brand.primaryHover : theme.colors.dark.bg.elevated};
    border-color: ${theme.colors.brand.primary};
  }
`;

const SongListPosition = styled.div`
  width: 28px;
  height: 28px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: ${theme.radius.sm};
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: ${theme.fontWeights.semibold};
  font-size: ${theme.fontSizes.bodySm};
  flex-shrink: 0;
`;

const SongListInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const SongListTitle = styled.div`
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.medium};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const SongListArtist = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  opacity: 0.8;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: ${theme.space[1]};
`;

const SongListIndicator = styled.div`
  font-size: ${theme.fontSizes.bodyLg};
  flex-shrink: 0;
`;

const SongDisplay = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: ${theme.space[8]} ${theme.space[10]};

  @media (max-width: ${theme.breakpoints.lg}) {
    padding: ${theme.space[6]} ${theme.space[6]};
  }

  @media (max-width: ${theme.breakpoints.md}) {
    padding: ${theme.space[4]} ${theme.space[4]};
  }
`;

const SongHeader = styled.div`
  margin-bottom: ${theme.space[8]};
`;

const SongTitleLarge = styled.h1`
  font-size: ${theme.fontSizes.displayLg};
  font-weight: ${theme.fontWeights.bold};
  color: ${theme.colors.dark.text.primary};
  margin: 0 0 ${theme.space[3]} 0;
  line-height: ${theme.lineHeights.tight};

  @media (max-width: ${theme.breakpoints.md}) {
    font-size: ${theme.fontSizes.displayMd};
  }
`;

const SongArtistLarge = styled.div`
  font-size: ${theme.fontSizes.h2};
  color: ${theme.colors.dark.text.secondary};
  margin-bottom: ${theme.space[6]};

  @media (max-width: ${theme.breakpoints.md}) {
    font-size: ${theme.fontSizes.h3};
  }
`;

const SongMetadataBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${theme.space[3]};
  margin-bottom: ${theme.space[6]};
`;

const MetaBadgeLarge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[2]};
  background: ${theme.colors.dark.bg.secondary};
  border: 1px solid ${theme.colors.dark.border.default};
  color: ${theme.colors.dark.text.primary};
  padding: ${theme.space[3]} ${theme.space[5]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodyLg};
  font-weight: ${theme.fontWeights.medium};

  i {
    font-size: ${theme.fontSizes.h4};
    color: ${theme.colors.brand.primary};
  }
`;

const NotesBox = styled.div`
  background: ${theme.colors.semantic.warningBgDark};
  border: 1px solid ${theme.colors.semantic.warning};
  border-radius: ${theme.radius.base};
  padding: ${theme.space[4]} ${theme.space[5]};
  margin-top: ${theme.space[4]};
`;

const NotesLabel = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.semantic.warning};
  margin-bottom: ${theme.space[2]};

  i {
    font-size: ${theme.fontSizes.bodyLg};
  }
`;

const NotesText = styled.div`
  font-size: ${theme.fontSizes.body};
  color: ${theme.colors.dark.text.primary};
  line-height: ${theme.lineHeights.relaxed};
  white-space: pre-wrap;
`;

const SongContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[8]};
`;

const ContentSection = styled.div`
  background: ${theme.colors.dark.bg.secondary};
  border: 1px solid ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.lg};
  padding: ${theme.space[6]};
`;

const SectionLabel = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  font-size: ${theme.fontSizes.h3};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.brand.primary};
  margin-bottom: ${theme.space[5]};

  i {
    font-size: ${theme.fontSizes.h2};
  }
`;

const ContentText = styled.pre`
  font-family: ${theme.fonts.mono};
  font-size: ${theme.fontSizes.bodyLg};
  color: ${theme.colors.dark.text.primary};
  line-height: ${theme.lineHeights.loose};
  white-space: pre-wrap;
  margin: 0;

  @media (max-width: ${theme.breakpoints.md}) {
    font-size: ${theme.fontSizes.body};
  }
`;

const EmptyContent = styled.div`
  text-align: center;
  padding: ${theme.space[12]} ${theme.space[6]};
  color: ${theme.colors.dark.text.tertiary};

  i {
    font-size: ${theme.fontSizes.displayLg};
    margin-bottom: ${theme.space[4]};
    opacity: 0.5;
  }

  p {
    font-size: ${theme.fontSizes.bodyLg};
    margin: 0;
  }
`;

const BottomNav = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[6]};
  padding: ${theme.space[4]} ${theme.space[6]};
  background: ${theme.colors.dark.bg.secondary};
  border-top: 1px solid ${theme.colors.dark.border.default};
  flex-shrink: 0;

  @media (max-width: ${theme.breakpoints.md}) {
    gap: ${theme.space[3]};
    padding: ${theme.space[3]} ${theme.space[4]};
  }
`;

const NavButton = styled.button`
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
  min-width: 120px;
  justify-content: center;

  i {
    font-size: ${theme.fontSizes.bodyLg};
  }

  &:hover:not(:disabled) {
    background: ${theme.colors.brand.primaryHover};
    transform: translateY(-1px);
  }

  &:disabled {
    background: ${theme.colors.dark.bg.elevated};
    color: ${theme.colors.dark.text.disabled};
    cursor: not-allowed;
    opacity: 0.5;
  }

  @media (max-width: ${theme.breakpoints.md}) {
    min-width: 100px;
    padding: ${theme.space[2]} ${theme.space[4]};
    font-size: ${theme.fontSizes.bodySm};

    span {
      display: none;
    }
  }
`;

const NavCenter = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${theme.space[2]};
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 8px;
  background: ${theme.colors.dark.bg.tertiary};
  border-radius: ${theme.radius.full};
  overflow: hidden;
`;

const ProgressFill = styled.div<{ $percent: number }>`
  width: ${(props) => props.$percent}%;
  height: 100%;
  background: ${theme.gradients.brandPrimary};
  transition: width ${theme.transitions.base} ease;
`;

const KeyboardHint = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.dark.text.tertiary};
  text-align: center;

  @media (max-width: ${theme.breakpoints.md}) {
    display: none;
  }
`;

const LoadingContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: ${theme.colors.dark.bg.primary};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${theme.space[4]};
`;

const LoadingText = styled.p`
  font-size: ${theme.fontSizes.body};
  color: ${theme.colors.dark.text.secondary};
  margin: 0;
`;

const ErrorContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: ${theme.colors.dark.bg.primary};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
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

export default SetlistPerformanceView;
