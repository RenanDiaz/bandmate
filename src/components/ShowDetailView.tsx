import type { FC } from "react";
import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Container, Spinner, Button } from "reactstrap";
import styled from "styled-components";
import { theme } from "../theme";
import { getShow, deleteShow, markShowCompleted, markShowCancelled, updateShow } from "../services/showsService";
import type { Show } from "../services/showsService";
import { getSetlist, getBandSetlists } from "../services/setlistsService";
import type { Setlist } from "../services/setlistsService";
import { getBandSongs } from "../services/songsService";
import type { Song } from "../services/songsService";

const formatDate = (dateString: string): string => {
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const formatTime = (timeString: string): string => {
  const [hours, minutes] = timeString.split(":");
  const date = new Date();
  date.setHours(parseInt(hours), parseInt(minutes));
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const getDaysUntil = (eventDate: string): { text: string; isPast: boolean } => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const event = new Date(eventDate + "T00:00:00");
  const diffTime = event.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return { text: "Today!", isPast: false };
  if (diffDays === 1) return { text: "Tomorrow", isPast: false };
  if (diffDays < 0) return { text: `${Math.abs(diffDays)} days ago`, isPast: true };
  if (diffDays <= 7) return { text: `In ${diffDays} days`, isPast: false };
  if (diffDays <= 30) return { text: `In ${Math.ceil(diffDays / 7)} weeks`, isPast: false };
  return { text: `In ${Math.ceil(diffDays / 30)} months`, isPast: false };
};

const ShowDetailView: FC = () => {
  const { showId } = useParams<{ showId: string }>();
  const navigate = useNavigate();

  const [show, setShow] = useState<Show | null>(null);
  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [availableSetlists, setAvailableSetlists] = useState<Setlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linkingSetlist, setLinkingSetlist] = useState(false);

  useEffect(() => {
    const loadShow = async () => {
      if (!showId) {
        setError("Show ID not provided");
        setLoading(false);
        return;
      }

      try {
        const showData = await getShow(showId);
        setShow(showData);

        // Load available setlists for the band
        if (showData.band_id) {
          const setlistsData = await getBandSetlists(showData.band_id);
          setAvailableSetlists(setlistsData);

          const songsData = await getBandSongs(showData.band_id);
          setSongs(songsData);
        }

        // Load linked setlist if exists
        if (showData.setlist_id) {
          const setlistData = await getSetlist(showData.setlist_id);
          setSetlist(setlistData);
        }
      } catch (err) {
        console.error("Failed to load show:", err);
        setError("Failed to load show details");
      }
      setLoading(false);
    };

    loadShow();
  }, [showId]);

  const handleDelete = async () => {
    if (!show) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${show.name}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await deleteShow(show.id);
      navigate("/shows");
    } catch (err) {
      console.error("Failed to delete show:", err);
      alert("Failed to delete show. Please try again.");
    }
  };

  const handleMarkCompleted = async () => {
    if (!show) return;
    try {
      const updated = await markShowCompleted(show.id);
      setShow(updated);
    } catch (err) {
      console.error("Failed to update show:", err);
      alert("Failed to update show status.");
    }
  };

  const handleMarkCancelled = async () => {
    if (!show) return;
    const confirmed = window.confirm(`Are you sure you want to cancel "${show.name}"?`);
    if (!confirmed) return;

    try {
      const updated = await markShowCancelled(show.id);
      setShow(updated);
    } catch (err) {
      console.error("Failed to cancel show:", err);
      alert("Failed to cancel show.");
    }
  };

  const handlePerformSetlist = () => {
    if (setlist) {
      navigate(`/setlists/${setlist.id}/perform`);
    }
  };

  const handleLinkSetlist = async (setlistId: string) => {
    if (!show) return;

    setLinkingSetlist(true);
    try {
      const updated = await updateShow(show.id, { setlist_id: setlistId });
      setShow(updated);

      // Load the newly linked setlist
      const setlistData = await getSetlist(setlistId);
      setSetlist(setlistData);
    } catch (err) {
      console.error("Failed to link setlist:", err);
      alert("Failed to link setlist. Please try again.");
    }
    setLinkingSetlist(false);
  };

  if (loading) {
    return (
      <PageWrapper>
        <Container>
          <LoadingContainer>
            <Spinner color="primary" style={{ width: "3rem", height: "3rem" }} />
            <LoadingText>Loading show details...</LoadingText>
          </LoadingContainer>
        </Container>
      </PageWrapper>
    );
  }

  if (error || !show) {
    return (
      <PageWrapper>
        <Container>
          <ErrorCard>
            <ErrorIcon>
              <i className="bi bi-exclamation-triangle"></i>
            </ErrorIcon>
            <ErrorTitle>Show Not Found</ErrorTitle>
            <ErrorText>{error || "The requested show could not be found."}</ErrorText>
            <BackButton onClick={() => navigate("/shows")}>
              <i className="bi bi-arrow-left me-2"></i>
              Back to Shows
            </BackButton>
          </ErrorCard>
        </Container>
      </PageWrapper>
    );
  }

  const countdown = getDaysUntil(show.event_date);
  const isUpcoming = show.status === "upcoming" && !countdown.isPast;
  const isCancelled = show.status === "cancelled";

  // Get song details for setlist
  const setlistSongs = setlist?.songs?.map((s) => {
    const song = songs.find((song) => song.id === s.song_id);
    return { ...s, song };
  }) || [];

  return (
    <PageWrapper>
      <Container>
        <BackLink to="/shows">
          <i className="bi bi-arrow-left"></i>
          Back to Shows
        </BackLink>

        <ShowHeader $isCancelled={isCancelled}>
          <DateCard $isCancelled={isCancelled}>
            <DateDay>{new Date(show.event_date + "T00:00:00").getDate()}</DateDay>
            <DateMonth>
              {new Date(show.event_date + "T00:00:00").toLocaleDateString("en-US", { month: "short" })}
            </DateMonth>
            <DateYear>
              {new Date(show.event_date + "T00:00:00").getFullYear()}
            </DateYear>
          </DateCard>

          <HeaderContent>
            <ShowName $isCancelled={isCancelled}>{show.name}</ShowName>

            <MetaRow>
              <StatusBadge $status={show.status} $isPast={countdown.isPast}>
                {isCancelled ? "Cancelled" : show.status === "completed" ? "Completed" : countdown.isPast ? "Past" : "Upcoming"}
              </StatusBadge>
              {isUpcoming && (
                <CountdownBadge>
                  <i className="bi bi-clock"></i>
                  {countdown.text}
                </CountdownBadge>
              )}
            </MetaRow>

            {show.venue && (
              <VenueInfo>
                <i className="bi bi-geo-alt-fill"></i>
                <span>{show.venue}</span>
              </VenueInfo>
            )}

            <DateTimeInfo>
              <i className="bi bi-calendar-event"></i>
              <span>{formatDate(show.event_date)}</span>
              {show.event_time && (
                <>
                  <Separator>|</Separator>
                  <i className="bi bi-clock"></i>
                  <span>{formatTime(show.event_time)}</span>
                </>
              )}
              {show.doors_time && (
                <>
                  <Separator>|</Separator>
                  <i className="bi bi-door-open"></i>
                  <span>Doors: {formatTime(show.doors_time)}</span>
                </>
              )}
            </DateTimeInfo>
          </HeaderContent>

          <ActionButtonsHeader>
            {isUpcoming && (
              <>
                <HeaderButton onClick={handleMarkCompleted} $variant="success">
                  <i className="bi bi-check-circle"></i>
                  Mark Completed
                </HeaderButton>
                <HeaderButton onClick={handleMarkCancelled} $variant="warning">
                  <i className="bi bi-x-circle"></i>
                  Cancel
                </HeaderButton>
              </>
            )}
            <HeaderButton onClick={handleDelete} $variant="danger">
              <i className="bi bi-trash"></i>
              Delete
            </HeaderButton>
          </ActionButtonsHeader>
        </ShowHeader>

        <ContentGrid>
          <MainContent>
            {show.venue_address && (
              <InfoCard>
                <InfoCardHeader>
                  <i className="bi bi-pin-map"></i>
                  Venue Address
                </InfoCardHeader>
                <InfoCardBody>
                  <AddressText>{show.venue_address}</AddressText>
                  <MapLink
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(show.venue_address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <i className="bi bi-map"></i>
                    Open in Google Maps
                  </MapLink>
                </InfoCardBody>
              </InfoCard>
            )}

            {show.notes && (
              <InfoCard>
                <InfoCardHeader>
                  <i className="bi bi-sticky"></i>
                  Notes
                </InfoCardHeader>
                <InfoCardBody>
                  <NotesText>{show.notes}</NotesText>
                </InfoCardBody>
              </InfoCard>
            )}

            {setlist && (
              <SetlistCard>
                <SetlistHeader>
                  <SetlistTitle>
                    <i className="bi bi-music-note-list"></i>
                    Linked Setlist: {setlist.name}
                  </SetlistTitle>
                  {setlistSongs.length > 0 && (
                    <PerformButton onClick={handlePerformSetlist}>
                      <i className="bi bi-play-circle"></i>
                      Start Performance
                    </PerformButton>
                  )}
                </SetlistHeader>
                <SetlistBody>
                  {setlistSongs.length === 0 ? (
                    <EmptySetlist>No songs in this setlist</EmptySetlist>
                  ) : (
                    <SongsList>
                      {setlistSongs.map((item, index) => (
                        <SongItem key={item.song_id}>
                          <SongNumber>{index + 1}</SongNumber>
                          <SongInfo>
                            <SongTitle>{item.song?.title || "Unknown Song"}</SongTitle>
                            {item.song?.artist && (
                              <SongArtist>{item.song.artist}</SongArtist>
                            )}
                          </SongInfo>
                          {item.notes && <SongNotes>{item.notes}</SongNotes>}
                        </SongItem>
                      ))}
                    </SongsList>
                  )}
                </SetlistBody>
              </SetlistCard>
            )}

            {!setlist && (
              <NoSetlistCard>
                <NoSetlistIcon>
                  <i className="bi bi-music-note-list"></i>
                </NoSetlistIcon>
                <NoSetlistText>No setlist linked to this show</NoSetlistText>
                {availableSetlists.length > 0 ? (
                  <>
                    <NoSetlistHint>
                      Select an existing setlist to link to this show:
                    </NoSetlistHint>
                    <SetlistSelector
                      disabled={linkingSetlist}
                      onChange={(e) => handleLinkSetlist(e.target.value)}
                      defaultValue=""
                    >
                      <option value="" disabled>Choose a setlist...</option>
                      {availableSetlists.map((sl) => (
                        <option key={sl.id} value={sl.id}>
                          {sl.name} ({sl.songs?.length || 0} songs)
                        </option>
                      ))}
                    </SetlistSelector>
                    <SetlistLinkDivider>or</SetlistLinkDivider>
                    <CreateSetlistButton onClick={() => navigate("/setlists")}>
                      <i className="bi bi-plus-circle"></i>
                      Create New Setlist
                    </CreateSetlistButton>
                  </>
                ) : (
                  <>
                    <NoSetlistHint>
                      Create a setlist first to link it to this show
                    </NoSetlistHint>
                    <CreateSetlistButton onClick={() => navigate("/setlists")}>
                      <i className="bi bi-plus-circle"></i>
                      Create Your First Setlist
                    </CreateSetlistButton>
                  </>
                )}
              </NoSetlistCard>
            )}
          </MainContent>

          <Sidebar>
            <QuickInfoCard>
              <QuickInfoTitle>Quick Info</QuickInfoTitle>
              <QuickInfoList>
                <QuickInfoItem>
                  <QuickInfoLabel>Status</QuickInfoLabel>
                  <QuickInfoValue>
                    {isCancelled ? "Cancelled" : show.status === "completed" ? "Completed" : "Upcoming"}
                  </QuickInfoValue>
                </QuickInfoItem>
                <QuickInfoItem>
                  <QuickInfoLabel>Date</QuickInfoLabel>
                  <QuickInfoValue>{formatDate(show.event_date)}</QuickInfoValue>
                </QuickInfoItem>
                {show.event_time && (
                  <QuickInfoItem>
                    <QuickInfoLabel>Time</QuickInfoLabel>
                    <QuickInfoValue>{formatTime(show.event_time)}</QuickInfoValue>
                  </QuickInfoItem>
                )}
                {show.venue && (
                  <QuickInfoItem>
                    <QuickInfoLabel>Venue</QuickInfoLabel>
                    <QuickInfoValue>{show.venue}</QuickInfoValue>
                  </QuickInfoItem>
                )}
                {setlist && (
                  <QuickInfoItem>
                    <QuickInfoLabel>Setlist</QuickInfoLabel>
                    <QuickInfoValue>{setlist.songs?.length || 0} songs</QuickInfoValue>
                  </QuickInfoItem>
                )}
              </QuickInfoList>
            </QuickInfoCard>
          </Sidebar>
        </ContentGrid>
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
    padding: ${theme.space[4]} 0;
  }
`;

const BackLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[2]};
  color: ${theme.colors.dark.text.secondary};
  text-decoration: none;
  font-size: ${theme.fontSizes.bodySm};
  margin-bottom: ${theme.space[4]};
  transition: color ${theme.transitions.fast} ease;

  &:hover {
    color: ${theme.colors.brand.primary};
  }
`;

const ShowHeader = styled.div<{ $isCancelled: boolean }>`
  display: flex;
  gap: ${theme.space[6]};
  padding: ${theme.space[6]};
  background: ${theme.colors.dark.bg.secondary};
  border: 1px solid ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.lg};
  margin-bottom: ${theme.space[6]};
  opacity: ${(props) => (props.$isCancelled ? 0.8 : 1)};

  @media (max-width: ${theme.breakpoints.md}) {
    flex-direction: column;
    padding: ${theme.space[4]};
  }
`;

const DateCard = styled.div<{ $isCancelled: boolean }>`
  width: 100px;
  height: 100px;
  background: ${(props) =>
    props.$isCancelled ? theme.colors.semantic.errorBgDark : theme.gradients.brandPrimary};
  border-radius: ${theme.radius.lg};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  @media (max-width: ${theme.breakpoints.md}) {
    width: 80px;
    height: 80px;
  }
`;

const DateDay = styled.div`
  font-size: ${theme.fontSizes.displayMd};
  font-weight: ${theme.fontWeights.bold};
  color: white;
  line-height: 1;
`;

const DateMonth = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  color: rgba(255, 255, 255, 0.9);
  text-transform: uppercase;
`;

const DateYear = styled.div`
  font-size: ${theme.fontSizes.bodyXs};
  color: rgba(255, 255, 255, 0.7);
`;

const HeaderContent = styled.div`
  flex: 1;
`;

const ShowName = styled.h1<{ $isCancelled: boolean }>`
  font-size: ${theme.fontSizes.h1};
  font-weight: ${theme.fontWeights.bold};
  color: ${theme.colors.dark.text.primary};
  margin: 0 0 ${theme.space[3]} 0;
  text-decoration: ${(props) => (props.$isCancelled ? "line-through" : "none")};
`;

const MetaRow = styled.div`
  display: flex;
  gap: ${theme.space[2]};
  margin-bottom: ${theme.space[3]};
  flex-wrap: wrap;
`;

const StatusBadge = styled.span<{ $status: string; $isPast: boolean }>`
  display: inline-flex;
  padding: ${theme.space[1]} ${theme.space[3]};
  border-radius: ${theme.radius.full};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  text-transform: uppercase;
  letter-spacing: ${theme.letterSpacing.wide};
  background: ${(props) =>
    props.$status === "cancelled"
      ? theme.colors.semantic.errorBgDark
      : props.$status === "completed" || props.$isPast
      ? theme.colors.dark.bg.tertiary
      : theme.colors.semantic.successBgDark};
  color: ${(props) =>
    props.$status === "cancelled"
      ? theme.colors.semantic.error
      : props.$status === "completed" || props.$isPast
      ? theme.colors.dark.text.tertiary
      : theme.colors.semantic.success};
`;

const CountdownBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[1]};
  padding: ${theme.space[1]} ${theme.space[3]};
  border-radius: ${theme.radius.full};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  background: ${theme.colors.accent.amber}20;
  color: ${theme.colors.accent.amber};

  i {
    font-size: ${theme.fontSizes.bodyXs};
  }
`;

const VenueInfo = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  font-size: ${theme.fontSizes.bodyLg};
  color: ${theme.colors.dark.text.primary};
  margin-bottom: ${theme.space[2]};

  i {
    color: ${theme.colors.brand.primary};
  }
`;

const DateTimeInfo = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  font-size: ${theme.fontSizes.body};
  color: ${theme.colors.dark.text.secondary};
  flex-wrap: wrap;

  i {
    color: ${theme.colors.brand.primary};
  }
`;

const Separator = styled.span`
  color: ${theme.colors.dark.border.default};
`;

const ActionButtonsHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[2]};

  @media (max-width: ${theme.breakpoints.md}) {
    flex-direction: row;
    flex-wrap: wrap;
  }
`;

const HeaderButton = styled(Button)<{ $variant: "success" | "warning" | "danger" }>`
  background: ${(props) =>
    props.$variant === "success"
      ? theme.colors.semantic.successBgDark
      : props.$variant === "warning"
      ? theme.colors.semantic.warningBgDark
      : theme.colors.semantic.errorBgDark} !important;
  border: 1px solid ${(props) =>
    props.$variant === "success"
      ? theme.colors.semantic.success
      : props.$variant === "warning"
      ? theme.colors.accent.amber
      : theme.colors.semantic.error}40 !important;
  color: ${(props) =>
    props.$variant === "success"
      ? theme.colors.semantic.success
      : props.$variant === "warning"
      ? theme.colors.accent.amber
      : theme.colors.semantic.error} !important;
  padding: ${theme.space[2]} ${theme.space[3]} !important;
  font-size: ${theme.fontSizes.bodySm} !important;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  white-space: nowrap;

  &:hover {
    opacity: 0.9;
  }
`;

const ContentGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: ${theme.space[6]};

  @media (max-width: ${theme.breakpoints.lg}) {
    grid-template-columns: 1fr;
  }
`;

const MainContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[4]};
`;

const Sidebar = styled.div`
  @media (max-width: ${theme.breakpoints.lg}) {
    order: -1;
  }
`;

const InfoCard = styled.div`
  background: ${theme.colors.dark.bg.secondary};
  border: 1px solid ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.lg};
  overflow: hidden;
`;

const InfoCardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  padding: ${theme.space[3]} ${theme.space[4]};
  background: ${theme.colors.dark.bg.tertiary};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.dark.text.secondary};
  text-transform: uppercase;
  letter-spacing: ${theme.letterSpacing.wide};

  i {
    color: ${theme.colors.brand.primary};
  }
`;

const InfoCardBody = styled.div`
  padding: ${theme.space[4]};
`;

const AddressText = styled.p`
  margin: 0 0 ${theme.space[3]} 0;
  color: ${theme.colors.dark.text.primary};
  line-height: ${theme.lineHeights.relaxed};
`;

const MapLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[2]};
  color: ${theme.colors.brand.primary};
  text-decoration: none;
  font-size: ${theme.fontSizes.bodySm};

  &:hover {
    text-decoration: underline;
  }
`;

const NotesText = styled.p`
  margin: 0;
  color: ${theme.colors.dark.text.primary};
  line-height: ${theme.lineHeights.relaxed};
  white-space: pre-wrap;
`;

const SetlistCard = styled.div`
  background: ${theme.colors.dark.bg.secondary};
  border: 1px solid ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.lg};
  overflow: hidden;
`;

const SetlistHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${theme.space[4]};
  background: ${theme.colors.dark.bg.tertiary};
  border-bottom: 1px solid ${theme.colors.dark.border.default};
  gap: ${theme.space[3]};
  flex-wrap: wrap;
`;

const SetlistTitle = styled.h3`
  margin: 0;
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.dark.text.primary};
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};

  i {
    color: ${theme.colors.brand.primary};
  }
`;

const PerformButton = styled(Button)`
  background: ${theme.colors.semantic.success} !important;
  border: none !important;
  color: white !important;
  padding: ${theme.space[2]} ${theme.space[3]} !important;
  font-size: ${theme.fontSizes.bodySm} !important;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};

  &:hover {
    background: ${theme.colors.semantic.success}dd !important;
  }
`;

const SetlistBody = styled.div`
  padding: ${theme.space[4]};
`;

const EmptySetlist = styled.p`
  margin: 0;
  color: ${theme.colors.dark.text.tertiary};
  text-align: center;
  padding: ${theme.space[4]};
`;

const SongsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[2]};
`;

const SongItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  padding: ${theme.space[3]};
  background: ${theme.colors.dark.bg.tertiary};
  border-radius: ${theme.radius.base};
`;

const SongNumber = styled.span`
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${theme.colors.brand.primary}30;
  color: ${theme.colors.brand.primary};
  border-radius: ${theme.radius.full};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  flex-shrink: 0;
`;

const SongInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const SongTitle = styled.div`
  font-weight: ${theme.fontWeights.medium};
  color: ${theme.colors.dark.text.primary};
`;

const SongArtist = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.dark.text.secondary};
`;

const SongNotes = styled.div`
  font-size: ${theme.fontSizes.bodyXs};
  color: ${theme.colors.accent.amber};
  background: ${theme.colors.accent.amber}20;
  padding: ${theme.space[1]} ${theme.space[2]};
  border-radius: ${theme.radius.sm};
`;

const NoSetlistCard = styled.div`
  text-align: center;
  padding: ${theme.space[8]};
  background: ${theme.colors.dark.bg.secondary};
  border: 1px dashed ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.lg};
`;

const NoSetlistIcon = styled.div`
  font-size: ${theme.fontSizes.displayMd};
  color: ${theme.colors.dark.text.tertiary};
  margin-bottom: ${theme.space[3]};
  opacity: 0.5;
`;

const NoSetlistText = styled.p`
  margin: 0 0 ${theme.space[2]} 0;
  font-size: ${theme.fontSizes.body};
  color: ${theme.colors.dark.text.secondary};
`;

const NoSetlistHint = styled.p`
  margin: 0 0 ${theme.space[4]} 0;
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.dark.text.tertiary};
`;

const SetlistSelector = styled.select`
  width: 100%;
  max-width: 400px;
  padding: ${theme.space[3]} ${theme.space[4]};
  background: ${theme.colors.dark.bg.tertiary};
  border: 1px solid ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.base};
  color: ${theme.colors.dark.text.primary};
  font-size: ${theme.fontSizes.body};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  &:hover:not(:disabled) {
    border-color: ${theme.colors.brand.primary};
  }

  &:focus {
    outline: none;
    border-color: ${theme.colors.brand.primary};
    box-shadow: 0 0 0 3px ${theme.colors.brand.primary}20;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const SetlistLinkDivider = styled.div`
  margin: ${theme.space[4]} 0;
  color: ${theme.colors.dark.text.tertiary};
  font-size: ${theme.fontSizes.bodySm};
  text-transform: uppercase;
  letter-spacing: ${theme.letterSpacing.wide};
  position: relative;

  &::before,
  &::after {
    content: "";
    position: absolute;
    top: 50%;
    width: 40%;
    height: 1px;
    background: ${theme.colors.dark.border.default};
  }

  &::before {
    left: 0;
  }

  &::after {
    right: 0;
  }
`;

const CreateSetlistButton = styled(Button)`
  background: ${theme.colors.brand.primary} !important;
  border: none !important;
  color: white !important;
  padding: ${theme.space[3]} ${theme.space[4]} !important;
  font-size: ${theme.fontSizes.body} !important;
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[2]};
  margin-top: ${theme.space[2]};

  &:hover {
    background: ${theme.colors.brand.primary}dd !important;
  }
`;

const QuickInfoCard = styled.div`
  background: ${theme.colors.dark.bg.secondary};
  border: 1px solid ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.lg};
  padding: ${theme.space[4]};
`;

const QuickInfoTitle = styled.h3`
  margin: 0 0 ${theme.space[4]} 0;
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.dark.text.secondary};
  text-transform: uppercase;
  letter-spacing: ${theme.letterSpacing.wide};
`;

const QuickInfoList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[3]};
`;

const QuickInfoItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[1]};
`;

const QuickInfoLabel = styled.span`
  font-size: ${theme.fontSizes.bodyXs};
  color: ${theme.colors.dark.text.tertiary};
  text-transform: uppercase;
  letter-spacing: ${theme.letterSpacing.wide};
`;

const QuickInfoValue = styled.span`
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.dark.text.primary};
  font-weight: ${theme.fontWeights.medium};
`;

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${theme.space[16]} 0;
  gap: ${theme.space[4]};
`;

const LoadingText = styled.p`
  margin: 0;
  color: ${theme.colors.dark.text.secondary};
`;

const ErrorCard = styled.div`
  text-align: center;
  padding: ${theme.space[12]};
  background: ${theme.colors.dark.bg.secondary};
  border: 1px solid ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.lg};
  margin-top: ${theme.space[8]};
`;

const ErrorIcon = styled.div`
  font-size: ${theme.fontSizes.displayLg};
  color: ${theme.colors.semantic.error};
  margin-bottom: ${theme.space[4]};
`;

const ErrorTitle = styled.h2`
  margin: 0 0 ${theme.space[2]} 0;
  font-size: ${theme.fontSizes.h2};
  color: ${theme.colors.dark.text.primary};
`;

const ErrorText = styled.p`
  margin: 0 0 ${theme.space[4]} 0;
  color: ${theme.colors.dark.text.secondary};
`;

const BackButton = styled(Button)`
  background: ${theme.colors.brand.primary} !important;
  border: none !important;
`;

export default ShowDetailView;
