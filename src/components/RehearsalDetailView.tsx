import type { FC } from "react";
import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Container, Spinner, Button } from "reactstrap";
import styled from "styled-components";
import { theme } from "../theme";
import { getRehearsal, deleteRehearsal, markRehearsalCompleted, markRehearsalCancelled } from "../services/rehearsalsService";
import type { Rehearsal } from "../services/rehearsalsService";
import { getSetlist, isSongItem } from "../services/setlistsService";
import type { Setlist } from "../services/setlistsService";
import { getShow } from "../services/showsService";
import type { Show } from "../services/showsService";
import { getBandSongs } from "../services/songsService";
import type { Song } from "../services/songsService";
import { SEO } from "./SEO";
import { ConfirmModal } from "./ConfirmModal";
import { useToast } from "../context/useToast";
import { buildIcsLabels, downloadRehearsalICS } from "../lib/calendarExport";

type ConfirmState = {
  title: string;
  message: string;
  confirmLabel: string;
  action: () => Promise<void>;
};

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

const RehearsalDetailView: FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const { rehearsalId } = useParams<{ rehearsalId: string }>();
  const navigate = useNavigate();

  const [rehearsal, setRehearsal] = useState<Rehearsal | null>(null);
  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [show, setShow] = useState<Show | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const runConfirm = async () => {
    if (!confirm) return;
    setConfirmBusy(true);
    try {
      await confirm.action();
    } finally {
      setConfirmBusy(false);
      setConfirm(null);
    }
  };

  useEffect(() => {
    const loadRehearsal = async () => {
      if (!rehearsalId) {
        setError("Rehearsal ID not provided");
        setLoading(false);
        return;
      }

      try {
        const rehearsalData = await getRehearsal(rehearsalId);
        setRehearsal(rehearsalData);

        // Load songs for the band
        if (rehearsalData.band_id) {
          const songsData = await getBandSongs(rehearsalData.band_id);
          setSongs(songsData);
        }

        // Load linked show if exists
        if (rehearsalData.show_id) {
          const showData = await getShow(rehearsalData.show_id);
          setShow(showData);
        }

        // Load linked setlist if exists
        if (rehearsalData.setlist_id) {
          const setlistData = await getSetlist(rehearsalData.setlist_id);
          setSetlist(setlistData);
        }
      } catch (err) {
        console.error("Failed to load rehearsal:", err);
        setError("Failed to load rehearsal details");
      }
      setLoading(false);
    };

    loadRehearsal();
  }, [rehearsalId]);

  const handleDelete = async () => {
    if (!rehearsal) return;

    setConfirm({
      title: t('rehearsals.deleteRehearsal'),
      message: t('rehearsals.confirmDelete', { name: rehearsal.name || t('rehearsals.rehearsal') }),
      confirmLabel: t('common.delete'),
      action: async () => {
        try {
          await deleteRehearsal(rehearsal.id);
          navigate("/rehearsals");
        } catch (err) {
          console.error("Failed to delete rehearsal:", err);
          toast.error(t('rehearsals.deleteError'));
        }
      },
    });
  };

  const handleMarkCompleted = async () => {
    if (!rehearsal) return;
    try {
      const updated = await markRehearsalCompleted(rehearsal.id);
      setRehearsal(updated);
    } catch (err) {
      console.error("Failed to update rehearsal:", err);
      toast.error(t('rehearsals.updateStatusError'));
    }
  };

  const handleMarkCancelled = async () => {
    if (!rehearsal) return;
    setConfirm({
      title: t('rehearsals.cancelRehearsal'),
      message: t('rehearsals.cancelConfirm', { name: rehearsal.name || t('rehearsals.rehearsal') }),
      confirmLabel: t('rehearsals.cancelRehearsal'),
      action: async () => {
        try {
          const updated = await markRehearsalCancelled(rehearsal.id);
          setRehearsal(updated);
        } catch (err) {
          console.error("Failed to cancel rehearsal:", err);
          toast.error(t('rehearsals.cancelError'));
        }
      },
    });
  };

  const handlePerformSetlist = () => {
    if (setlist) {
      navigate(`/setlists/${setlist.id}/perform`);
    }
  };

  if (loading) {
    return (
      <PageWrapper>
        <Container>
          <LoadingContainer>
            <Spinner color="primary" style={{ width: "3rem", height: "3rem" }} />
            <LoadingText>{t('rehearsals.loadingDetail')}</LoadingText>
          </LoadingContainer>
        </Container>
      </PageWrapper>
    );
  }

  if (error || !rehearsal) {
    return (
      <PageWrapper>
        <Container>
          <ErrorCard>
            <ErrorIcon>
              <i className="bi bi-exclamation-triangle"></i>
            </ErrorIcon>
            <ErrorTitle>{t('rehearsals.notFound')}</ErrorTitle>
            <ErrorText>{error || t('rehearsals.notFoundText')}</ErrorText>
            <BackButton onClick={() => navigate("/rehearsals")}>
              <i className="bi bi-arrow-left me-2"></i>
              {t('rehearsals.backToRehearsals')}
            </BackButton>
          </ErrorCard>
        </Container>
      </PageWrapper>
    );
  }

  const countdown = getDaysUntil(rehearsal.rehearsal_date);
  const isUpcoming = rehearsal.status === "scheduled" && !countdown.isPast;
  const isCancelled = rehearsal.status === "cancelled";

  // Get song details for setlist
  const setlistSongs = setlist?.songs?.filter(isSongItem).map((s) => {
    const song = songs.find((song) => song.id === s.song_id);
    return { ...s, song };
  }) || [];

  return (
    <PageWrapper>
      <SEO
        title={rehearsal.name || t('rehearsals.rehearsal')}
        description={`${rehearsal.name || t('rehearsals.rehearsal')} - ${formatDate(rehearsal.rehearsal_date)}${rehearsal.location ? ` at ${rehearsal.location}` : ""}`}
      />
      <Container>
        <BackLink to="/rehearsals">
          <i className="bi bi-arrow-left"></i>
          {t('rehearsals.backToRehearsals')}
        </BackLink>

        <RehearsalHeader $isCancelled={isCancelled}>
          <DateCard $isCancelled={isCancelled}>
            <DateDay>{new Date(rehearsal.rehearsal_date + "T00:00:00").getDate()}</DateDay>
            <DateMonth>
              {new Date(rehearsal.rehearsal_date + "T00:00:00").toLocaleDateString("en-US", { month: "short" })}
            </DateMonth>
            <DateYear>
              {new Date(rehearsal.rehearsal_date + "T00:00:00").getFullYear()}
            </DateYear>
          </DateCard>

          <HeaderContent>
            <RehearsalName $isCancelled={isCancelled}>
              {rehearsal.name || t('rehearsals.rehearsal')}
            </RehearsalName>

            <MetaRow>
              <StatusBadge $status={rehearsal.status} $isPast={countdown.isPast}>
                {isCancelled
                  ? t('rehearsals.statusCancelled')
                  : rehearsal.status === "completed"
                  ? t('rehearsals.statusCompleted')
                  : countdown.isPast
                  ? t('rehearsals.past')
                  : t('rehearsals.statusScheduled')}
              </StatusBadge>
              {isUpcoming && (
                <CountdownBadge>
                  <i className="bi bi-clock"></i>
                  {countdown.text}
                </CountdownBadge>
              )}
            </MetaRow>

            {rehearsal.location && (
              <LocationInfo>
                <i className="bi bi-geo-alt-fill"></i>
                <span>{rehearsal.location}</span>
              </LocationInfo>
            )}

            <DateTimeInfo>
              <i className="bi bi-calendar-event"></i>
              <span>{formatDate(rehearsal.rehearsal_date)}</span>
              {rehearsal.start_time && (
                <>
                  <Separator>|</Separator>
                  <i className="bi bi-clock"></i>
                  <span>
                    {formatTime(rehearsal.start_time)}
                    {rehearsal.end_time && ` - ${formatTime(rehearsal.end_time)}`}
                  </span>
                </>
              )}
            </DateTimeInfo>
          </HeaderContent>

          <ActionButtonsHeader>
            {isUpcoming && (
              <>
                <HeaderButton onClick={handleMarkCompleted} $variant="success">
                  <i className="bi bi-check-circle"></i>
                  {t('rehearsals.markCompleted')}
                </HeaderButton>
                <HeaderButton onClick={handleMarkCancelled} $variant="warning">
                  <i className="bi bi-x-circle"></i>
                  {t('common.cancel')}
                </HeaderButton>
              </>
            )}
            <HeaderButton
              onClick={() => downloadRehearsalICS(rehearsal, buildIcsLabels(t))}
              $variant="neutral"
            >
              <i className="bi bi-calendar-plus"></i>
              {t('rehearsals.addToCalendar')}
            </HeaderButton>
            <HeaderButton onClick={handleDelete} $variant="danger">
              <i className="bi bi-trash"></i>
              {t('common.delete')}
            </HeaderButton>
          </ActionButtonsHeader>
        </RehearsalHeader>

        <ContentGrid>
          <MainContent>
            {show && (
              <InfoCard>
                <InfoCardHeader>
                  <i className="bi bi-calendar-event"></i>
                  {t('rehearsals.linkedShow')}
                </InfoCardHeader>
                <InfoCardBody>
                  <LinkedShowInfo onClick={() => navigate(`/shows/${show.id}`)}>
                    <ShowName>{show.name}</ShowName>
                    <ShowDate>
                      {formatDate(show.event_date)}
                      {show.venue && ` • ${show.venue}`}
                    </ShowDate>
                  </LinkedShowInfo>
                </InfoCardBody>
              </InfoCard>
            )}

            {rehearsal.notes && (
              <InfoCard>
                <InfoCardHeader>
                  <i className="bi bi-sticky"></i>
                  {t('rehearsals.notes')}
                </InfoCardHeader>
                <InfoCardBody>
                  <NotesText>{rehearsal.notes}</NotesText>
                </InfoCardBody>
              </InfoCard>
            )}

            {setlist && (
              <SetlistCard>
                <SetlistHeader>
                  <SetlistTitle>
                    <i className="bi bi-music-note-list"></i>
                    {t('rehearsals.linkedSetlist')}: {setlist.name}
                  </SetlistTitle>
                  {setlistSongs.length > 0 && (
                    <PerformButton onClick={handlePerformSetlist}>
                      <i className="bi bi-play-circle"></i>
                      {t('setlists.performanceMode')}
                    </PerformButton>
                  )}
                </SetlistHeader>
                <SetlistBody>
                  {setlistSongs.length === 0 ? (
                    <EmptySetlist>{t('setlists.editor.noSongsInSetlist')}</EmptySetlist>
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
                <NoSetlistText>{t('rehearsals.noSetlistLinked')}</NoSetlistText>
                <NoSetlistHint>{t('rehearsals.noSetlistHint')}</NoSetlistHint>
              </NoSetlistCard>
            )}
          </MainContent>

          <Sidebar>
            <QuickInfoCard>
              <QuickInfoTitle>{t('rehearsals.quickInfo')}</QuickInfoTitle>
              <QuickInfoList>
                <QuickInfoItem>
                  <QuickInfoLabel>{t('rehearsals.status')}</QuickInfoLabel>
                  <QuickInfoValue>
                    {isCancelled
                      ? t('rehearsals.statusCancelled')
                      : rehearsal.status === "completed"
                      ? t('rehearsals.statusCompleted')
                      : t('rehearsals.statusScheduled')}
                  </QuickInfoValue>
                </QuickInfoItem>
                <QuickInfoItem>
                  <QuickInfoLabel>{t('rehearsals.date')}</QuickInfoLabel>
                  <QuickInfoValue>{formatDate(rehearsal.rehearsal_date)}</QuickInfoValue>
                </QuickInfoItem>
                {rehearsal.start_time && (
                  <QuickInfoItem>
                    <QuickInfoLabel>{t('rehearsals.time')}</QuickInfoLabel>
                    <QuickInfoValue>
                      {formatTime(rehearsal.start_time)}
                      {rehearsal.end_time && ` - ${formatTime(rehearsal.end_time)}`}
                    </QuickInfoValue>
                  </QuickInfoItem>
                )}
                {rehearsal.location && (
                  <QuickInfoItem>
                    <QuickInfoLabel>{t('rehearsals.location')}</QuickInfoLabel>
                    <QuickInfoValue>{rehearsal.location}</QuickInfoValue>
                  </QuickInfoItem>
                )}
                {setlist && (
                  <QuickInfoItem>
                    <QuickInfoLabel>{t('rehearsals.setlist')}</QuickInfoLabel>
                    <QuickInfoValue>{setlistSongs.length} {t('setlists.songs').toLowerCase()}</QuickInfoValue>
                  </QuickInfoItem>
                )}
              </QuickInfoList>
            </QuickInfoCard>
          </Sidebar>
        </ContentGrid>
      </Container>

      <ConfirmModal
        isOpen={confirm !== null}
        title={confirm?.title ?? ""}
        message={confirm?.message ?? ""}
        confirmLabel={confirm?.confirmLabel}
        tone="danger"
        busy={confirmBusy}
        onConfirm={runConfirm}
        onClose={() => setConfirm(null)}
      />
    </PageWrapper>
  );
};

// Styled Components

const PageWrapper = styled.div`
  min-height: calc(100vh - 80px);
  background: var(--color-bg-primary);
  padding: ${theme.space[8]} 0;

  @media (max-width: ${theme.breakpoints.md}) {
    padding: ${theme.space[4]} 0;
  }
`;

const BackLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[2]};
  color: var(--color-text-secondary);
  text-decoration: none;
  font-size: ${theme.fontSizes.bodySm};
  margin-bottom: ${theme.space[4]};
  transition: color ${theme.transitions.fast} ease;

  &:hover {
    color: ${theme.colors.brand.primary};
  }
`;

const RehearsalHeader = styled.div<{ $isCancelled: boolean }>`
  display: flex;
  gap: ${theme.space[6]};
  padding: ${theme.space[6]};
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
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

const RehearsalName = styled.h1<{ $isCancelled: boolean }>`
  font-size: ${theme.fontSizes.h1};
  font-weight: ${theme.fontWeights.bold};
  color: var(--color-text-primary);
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
      ? "var(--color-bg-tertiary)"
      : theme.colors.semantic.successBgDark};
  color: ${(props) =>
    props.$status === "cancelled"
      ? theme.colors.semantic.error
      : props.$status === "completed" || props.$isPast
      ? "var(--color-text-tertiary)"
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

const LocationInfo = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  font-size: ${theme.fontSizes.bodyLg};
  color: var(--color-text-primary);
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
  color: var(--color-text-secondary);
  flex-wrap: wrap;

  i {
    color: ${theme.colors.brand.primary};
  }
`;

const Separator = styled.span`
  color: var(--color-border);
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

type HeaderButtonVariant = "success" | "warning" | "danger" | "neutral";

const headerButtonColors: Record<HeaderButtonVariant, { bg: string; fg: string }> = {
  success: { bg: theme.colors.semantic.successBgDark, fg: theme.colors.semantic.success },
  warning: { bg: theme.colors.semantic.warningBgDark, fg: theme.colors.accent.amber },
  danger: { bg: theme.colors.semantic.errorBgDark, fg: theme.colors.semantic.error },
  neutral: { bg: "var(--color-bg-tertiary)", fg: theme.colors.brand.primary },
};

const HeaderButton = styled(Button)<{ $variant: HeaderButtonVariant }>`
  background: ${(props) => headerButtonColors[props.$variant].bg} !important;
  border: 1px solid ${(props) => headerButtonColors[props.$variant].fg}40 !important;
  color: ${(props) => headerButtonColors[props.$variant].fg} !important;
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
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.lg};
  overflow: hidden;
`;

const InfoCardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  padding: ${theme.space[3]} ${theme.space[4]};
  background: var(--color-bg-tertiary);
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: ${theme.letterSpacing.wide};

  i {
    color: ${theme.colors.brand.primary};
  }
`;

const InfoCardBody = styled.div`
  padding: ${theme.space[4]};
`;

const LinkedShowInfo = styled.div`
  cursor: pointer;
  padding: ${theme.space[3]};
  background: var(--color-bg-tertiary);
  border-radius: ${theme.radius.base};
  transition: all ${theme.transitions.fast} ease;

  &:hover {
    background: var(--color-bg-elevated);
  }
`;

const ShowName = styled.div`
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin-bottom: ${theme.space[1]};
`;

const ShowDate = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
`;

const NotesText = styled.p`
  margin: 0;
  color: var(--color-text-primary);
  line-height: ${theme.lineHeights.relaxed};
  white-space: pre-wrap;
`;

const SetlistCard = styled.div`
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.lg};
  overflow: hidden;
`;

const SetlistHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${theme.space[4]};
  background: var(--color-bg-tertiary);
  border-bottom: 1px solid var(--color-border);
  gap: ${theme.space[3]};
  flex-wrap: wrap;
`;

const SetlistTitle = styled.h3`
  margin: 0;
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
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
  color: var(--color-text-tertiary);
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
  background: var(--color-bg-tertiary);
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
  color: var(--color-text-primary);
`;

const SongArtist = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
`;

const NoSetlistCard = styled.div`
  text-align: center;
  padding: ${theme.space[8]};
  background: var(--color-bg-secondary);
  border: 1px dashed var(--color-border);
  border-radius: ${theme.radius.lg};
`;

const NoSetlistIcon = styled.div`
  font-size: ${theme.fontSizes.displayMd};
  color: var(--color-text-tertiary);
  margin-bottom: ${theme.space[3]};
  opacity: 0.5;
`;

const NoSetlistText = styled.p`
  margin: 0 0 ${theme.space[2]} 0;
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-secondary);
`;

const NoSetlistHint = styled.p`
  margin: 0;
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-tertiary);
`;

const QuickInfoCard = styled.div`
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.lg};
  padding: ${theme.space[4]};
`;

const QuickInfoTitle = styled.h3`
  margin: 0 0 ${theme.space[4]} 0;
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-secondary);
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
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: ${theme.letterSpacing.wide};
`;

const QuickInfoValue = styled.span`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-primary);
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
  color: var(--color-text-secondary);
`;

const ErrorCard = styled.div`
  text-align: center;
  padding: ${theme.space[12]};
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
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
  color: var(--color-text-primary);
`;

const ErrorText = styled.p`
  margin: 0 0 ${theme.space[4]} 0;
  color: var(--color-text-secondary);
`;

const BackButton = styled(Button)`
  background: ${theme.colors.brand.primary} !important;
  border: none !important;
`;

export default RehearsalDetailView;
