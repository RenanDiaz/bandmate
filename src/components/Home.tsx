import { useState, useEffect } from "react";
import { Container } from "reactstrap";
import styled from "styled-components";
import { theme } from "../theme";
import { useBandContext } from "../context/useBandContext";
import { Link, useNavigate } from "react-router-dom";
import { PendingInvitations } from "./PendingInvitations";
import { getBandSongs } from "../services/songsService";
import type { Song } from "../services/songsService";
import { getBandSetlists } from "../services/setlistsService";
import type { Setlist } from "../services/setlistsService";
import { getUpcomingShows } from "../services/showsService";
import type { Show } from "../services/showsService";
import { getUpcomingRehearsals } from "../services/rehearsalsService";
import type { Rehearsal } from "../services/rehearsalsService";
import { SEO } from "./SEO";
import { LandingPage } from "./LandingPage";
import { useTranslation } from "react-i18next";
import { isNetworkError } from "../lib/networkErrors";
import { isOfflineDownloadsEnabled } from "../lib/featureFlags";
import { OfflineLockedHome } from "./offline/OfflineMessage";
import { SchemaWipeNotice } from "./offline/SchemaWipeNotice";

// Unified event type for shows and rehearsals
type UpcomingEvent =
  | { type: 'show'; data: Show; date: string }
  | { type: 'rehearsal'; data: Rehearsal; date: string };

const Home = () => {
  const { t, i18n } = useTranslation();
  const { user, authMode, hiddenOfflineCount, selectedBand, refreshBands, reportNetworkFailure } = useBandContext();
  const navigate = useNavigate();
  const [songs, setSongs] = useState<Song[]>([]);
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const currentLocale = i18n.language.startsWith('es') ? 'es-ES' : 'en-US';

  useEffect(() => {
    if (user && selectedBand) {
      setLoading(true);
      Promise.all([
        getBandSongs(selectedBand.id),
        getBandSetlists(selectedBand.id),
        getUpcomingShows(selectedBand.id),
        getUpcomingRehearsals(selectedBand.id),
      ])
        .then(([songsData, setlistsData, showsData, rehearsalsData]) => {
          setSongs(songsData);
          setSetlists(setlistsData);

          // Combine and sort shows and rehearsals by date
          const events: UpcomingEvent[] = [
            ...showsData.map((show): UpcomingEvent => ({
              type: 'show',
              data: show,
              date: show.event_date,
            })),
            ...rehearsalsData.map((rehearsal): UpcomingEvent => ({
              type: 'rehearsal',
              data: rehearsal,
              date: rehearsal.rehearsal_date,
            })),
          ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          setUpcomingEvents(events);
        })
        .catch((error) => {
          console.error(error);
          // Weak signal: the route renders the offline home once isOnline
          // drops (§7.3). An HTTP error keeps the dashboard.
          if (isNetworkError(error)) reportNetworkFailure();
        })
        .finally(() => setLoading(false));
    }
  }, [user, selectedBand, reportNetworkFailure]);

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString + "T00:00:00");
    return date.toLocaleDateString(currentLocale, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (timeString: string): string => {
    const [hours, minutes] = timeString.split(":");
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return date.toLocaleTimeString(currentLocale, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getDaysUntil = (eventDate: string): string => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const event = new Date(eventDate + "T00:00:00");
    const diffTime = event.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return t('home.today');
    if (diffDays === 1) return t('home.tomorrow');
    if (diffDays <= 7) return t('home.inDays', { count: diffDays });

    const weeks = Math.floor(diffDays / 7);
    const remainingDays = diffDays % 7;

    if (remainingDays === 0) {
      return t('home.inWeeks', { count: weeks });
    }

    if (weeks === 1) {
      return t('home.inWeekAndDays', { days: remainingDays, count: remainingDays });
    }

    return t('home.inWeeksAndDays', { weeks, days: remainingDays, count: remainingDays });
  };

  // Show dashboard for authenticated users with a selected band
  if (user && selectedBand) {
    return (
      <HomeWrapper>
        <SEO
          title={`${selectedBand.name} Dashboard`}
          description={`Manage songs, setlists, and shows for ${selectedBand.name}. View upcoming gigs, organize your repertoire, and collaborate with your band.`}
        />
        <Container style={{ marginTop: theme.space[6] }}>
          <PendingInvitations onInvitationAccepted={refreshBands} />
          <SchemaWipeNotice />
        </Container>

        <DashboardSection>
          <Container>
            <DashboardHeader>
              <WelcomeText>
                <WelcomeTitle>{t('home.welcomeBack')}</WelcomeTitle>
                <BandNameText>
                  <i className="bi bi-people-fill"></i> {selectedBand.name}
                </BandNameText>
              </WelcomeText>
            </DashboardHeader>

            {loading ? (
              <LoadingState>
                <span className="spinner-border spinner-border-sm me-2"></span>
                {t('home.loadingDashboard')}
              </LoadingState>
            ) : (
              <>
                {/* Quick Stats */}
                <StatsGrid>
                  <StatCard as={Link} to="/songs">
                    <StatIcon $color={theme.colors.brand.primary}>
                      <i className="bi bi-music-note-list"></i>
                    </StatIcon>
                    <StatInfo>
                      <StatNumber>{songs.length}</StatNumber>
                      <StatLabel>{t('nav.songs')}</StatLabel>
                    </StatInfo>
                  </StatCard>

                  <StatCard as={Link} to="/setlists">
                    <StatIcon $color={theme.colors.accent.cyan}>
                      <i className="bi bi-list-ul"></i>
                    </StatIcon>
                    <StatInfo>
                      <StatNumber>{setlists.length}</StatNumber>
                      <StatLabel>{t('nav.setlists')}</StatLabel>
                    </StatInfo>
                  </StatCard>

                  <StatCard as={Link} to="/shows">
                    <StatIcon $color={theme.colors.accent.amber}>
                      <i className="bi bi-calendar-event"></i>
                    </StatIcon>
                    <StatInfo>
                      <StatNumber>{upcomingEvents.length}</StatNumber>
                      <StatLabel>{t('home.upcomingEvents')}</StatLabel>
                    </StatInfo>
                  </StatCard>
                </StatsGrid>

                {/* Widgets Grid */}
                <WidgetsGrid>
                  {/* Upcoming Events Widget */}
                  <Widget>
                    <WidgetHeader>
                      <WidgetTitle>
                        <i className="bi bi-calendar-event"></i>
                        {t('home.upcomingEvents')}
                      </WidgetTitle>
                      <WidgetAction as={Link} to="/shows">
                        {t('common.viewAll')} <i className="bi bi-arrow-right"></i>
                      </WidgetAction>
                    </WidgetHeader>
                    <WidgetContent>
                      {upcomingEvents.length === 0 ? (
                        <EmptyState>
                          <i className="bi bi-calendar-x"></i>
                          <p>{t('home.noUpcomingEvents')}</p>
                          <EmptyStateAction as={Link} to="/shows">
                            {t('home.scheduleShow')}
                          </EmptyStateAction>
                        </EmptyState>
                      ) : (
                        <ShowsList>
                          {upcomingEvents.slice(0, 4).map((event) => (
                            <ShowItem
                              key={`${event.type}-${event.data.id}`}
                              onClick={() => navigate(event.type === 'show' ? `/shows/${event.data.id}` : `/rehearsals/${event.data.id}`)}
                            >
                              <ShowDate $isRehearsal={event.type === 'rehearsal'}>
                                <ShowDay>
                                  {new Date(event.date + "T00:00:00").getDate()}
                                </ShowDay>
                                <ShowMonth>
                                  {new Date(event.date + "T00:00:00").toLocaleDateString(currentLocale, {
                                    month: "short",
                                  })}
                                </ShowMonth>
                              </ShowDate>
                              <ShowDetails>
                                <EventTypeRow>
                                  <EventTypeBadge $isRehearsal={event.type === 'rehearsal'}>
                                    <i className={event.type === 'show' ? 'bi bi-mic' : 'bi bi-music-note-beamed'}></i>
                                    {event.type === 'show' ? t('home.show') : t('home.rehearsal')}
                                  </EventTypeBadge>
                                </EventTypeRow>
                                <ShowName>{event.data.name}</ShowName>
                                {event.type === 'show' && (event.data as Show).venue && (
                                  <ShowVenue>{(event.data as Show).venue}</ShowVenue>
                                )}
                                {event.type === 'rehearsal' && (event.data as Rehearsal).location && (
                                  <ShowVenue>{(event.data as Rehearsal).location}</ShowVenue>
                                )}
                                <ShowMeta>
                                  <span>{formatDate(event.date)}</span>
                                  {event.type === 'show' && (event.data as Show).event_time && (
                                    <span> {t('home.at')} {formatTime((event.data as Show).event_time!)}</span>
                                  )}
                                  {event.type === 'rehearsal' && (event.data as Rehearsal).start_time && (
                                    <span> {t('home.at')} {formatTime((event.data as Rehearsal).start_time!)}</span>
                                  )}
                                  <CountdownBadge>{getDaysUntil(event.date)}</CountdownBadge>
                                </ShowMeta>
                              </ShowDetails>
                            </ShowItem>
                          ))}
                        </ShowsList>
                      )}
                    </WidgetContent>
                  </Widget>

                  {/* Recent Songs Widget */}
                  <Widget>
                    <WidgetHeader>
                      <WidgetTitle>
                        <i className="bi bi-music-note-list"></i>
                        {t('home.recentSongs')}
                      </WidgetTitle>
                      <WidgetAction as={Link} to="/songs">
                        {t('common.viewAll')} <i className="bi bi-arrow-right"></i>
                      </WidgetAction>
                    </WidgetHeader>
                    <WidgetContent>
                      {songs.length === 0 ? (
                        <EmptyState>
                          <i className="bi bi-music-note"></i>
                          <p>{t('home.noSongsYet')}</p>
                          <EmptyStateAction as={Link} to="/songs">
                            {t('home.addFirstSong')}
                          </EmptyStateAction>
                        </EmptyState>
                      ) : (
                        <SongsList>
                          {songs.slice(0, 5).map((song) => (
                            <SongItem key={song.id}>
                              {song.album_art ? (
                                <SongArt src={song.album_art} alt={song.title} />
                              ) : (
                                <SongArtPlaceholder>
                                  <i className="bi bi-music-note"></i>
                                </SongArtPlaceholder>
                              )}
                              <SongInfo>
                                <SongTitle>{song.title}</SongTitle>
                                {song.artist && <SongArtist>{song.artist}</SongArtist>}
                              </SongInfo>
                              {song.key && <SongKey>{song.key}</SongKey>}
                            </SongItem>
                          ))}
                        </SongsList>
                      )}
                    </WidgetContent>
                  </Widget>
                </WidgetsGrid>

                {/* Quick Actions */}
                <QuickActionsSection>
                  <SectionTitle>{t('home.quickActions')}</SectionTitle>
                  <QuickActionsGrid>
                    <QuickAction as={Link} to="/songs">
                      <QuickActionIcon $color={theme.colors.brand.primary}>
                        <i className="bi bi-plus-circle"></i>
                      </QuickActionIcon>
                      <QuickActionText>{t('home.addSong')}</QuickActionText>
                    </QuickAction>

                    <QuickAction as={Link} to="/setlists">
                      <QuickActionIcon $color={theme.colors.accent.cyan}>
                        <i className="bi bi-list-ul"></i>
                      </QuickActionIcon>
                      <QuickActionText>{t('home.createSetlist')}</QuickActionText>
                    </QuickAction>

                    <QuickAction as={Link} to="/shows">
                      <QuickActionIcon $color={theme.colors.accent.amber}>
                        <i className="bi bi-calendar-plus"></i>
                      </QuickActionIcon>
                      <QuickActionText>{t('home.scheduleShowAction')}</QuickActionText>
                    </QuickAction>

                    <QuickAction as={Link} to={`/bands/${selectedBand.id}/settings`}>
                      <QuickActionIcon $color={theme.colors.semantic.info}>
                        <i className="bi bi-gear"></i>
                      </QuickActionIcon>
                      <QuickActionText>{t('home.bandSettings')}</QuickActionText>
                    </QuickAction>
                  </QuickActionsGrid>
                </QuickActionsSection>
              </>
            )}
          </Container>
        </DashboardSection>
      </HomeWrapper>
    );
  }

  // Session lost with offline copies on the device: they are hidden, not
  // deleted, until the same user signs in again (§7.1).
  if (!user && authMode === "session-lost" && hiddenOfflineCount > 0 && isOfflineDownloadsEnabled()) {
    return (
      <HomeWrapper>
        <OfflineLockedHome count={hiddenOfflineCount} />
      </HomeWrapper>
    );
  }

  // Landing page for visitors without a selected band
  return (
    <HomeWrapper>
      <SEO />
      {user && (
        <Container style={{ marginTop: theme.space[6] }}>
          <PendingInvitations onInvitationAccepted={refreshBands} />
        </Container>
      )}
      <LandingPage isAuthenticated={!!user} />
    </HomeWrapper>
  );
};

// Styled Components

const HomeWrapper = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const SectionTitle = styled.h2`
  font-size: ${theme.fontSizes.displayMd};
  font-weight: ${theme.fontWeights.bold};
  color: var(--color-text-primary);
  text-align: center;
  margin-bottom: ${theme.space[12]};

  @media (max-width: ${theme.breakpoints.md}) {
    font-size: ${theme.fontSizes.h1};
    margin-bottom: ${theme.space[8]};
  }
`;

// Dashboard Styled Components

const DashboardSection = styled.section`
  flex: 1;
  padding: ${theme.space[6]} 0 ${theme.space[12]};
  background: var(--color-bg-primary);
`;

const DashboardHeader = styled.div`
  margin-bottom: ${theme.space[8]};
`;

const WelcomeText = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[1]};
`;

const WelcomeTitle = styled.h1`
  font-size: ${theme.fontSizes.displayMd};
  font-weight: ${theme.fontWeights.bold};
  color: var(--color-text-primary);
  margin: 0;

  @media (max-width: ${theme.breakpoints.md}) {
    font-size: ${theme.fontSizes.h1};
  }
`;

const BandNameText = styled.span`
  font-size: ${theme.fontSizes.bodyLg};
  color: ${theme.colors.brand.primary};
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};

  i {
    font-size: ${theme.fontSizes.body};
  }
`;

const LoadingState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${theme.space[12]};
  color: var(--color-text-secondary);
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${theme.space[4]};
  margin-bottom: ${theme.space[8]};

  @media (max-width: ${theme.breakpoints.md}) {
    grid-template-columns: 1fr;
  }
`;

const StatCard = styled.div`
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.lg};
  padding: ${theme.space[5]};
  display: flex;
  align-items: center;
  gap: ${theme.space[4]};
  text-decoration: none;
  color: inherit;
  transition: all ${theme.transitions.base} ease;

  &:hover {
    border-color: ${theme.colors.brand.primary};
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }
`;

const StatIcon = styled.div<{ $color: string }>`
  width: 48px;
  height: 48px;
  background: ${(props) => props.$color}20;
  border-radius: ${theme.radius.md};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${theme.fontSizes.h3};
  color: ${(props) => props.$color};
`;

const StatInfo = styled.div`
  display: flex;
  flex-direction: column;
`;

const StatNumber = styled.span`
  font-size: ${theme.fontSizes.h1};
  font-weight: ${theme.fontWeights.bold};
  color: var(--color-text-primary);
  line-height: 1;
`;

const StatLabel = styled.span`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
`;

const WidgetsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: ${theme.space[6]};
  margin-bottom: ${theme.space[8]};

  @media (max-width: ${theme.breakpoints.lg}) {
    grid-template-columns: 1fr;
  }
`;

const Widget = styled.div`
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.lg};
  overflow: hidden;
`;

const WidgetHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${theme.space[4]};
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-tertiary);
`;

const WidgetTitle = styled.h3`
  font-size: ${theme.fontSizes.body};
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

const WidgetAction = styled.button`
  background: transparent;
  border: none;
  color: ${theme.colors.brand.primary};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: ${theme.space[1]};
  text-decoration: none;
  transition: color ${theme.transitions.fast} ease;

  &:hover {
    color: ${theme.colors.brand.primaryHover};
  }
`;

const WidgetContent = styled.div`
  padding: ${theme.space[4]};
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${theme.space[8]} ${theme.space[4]};
  text-align: center;

  i {
    font-size: ${theme.fontSizes.displayMd};
    color: var(--color-text-disabled);
    margin-bottom: ${theme.space[3]};
  }

  p {
    color: var(--color-text-tertiary);
    margin: 0 0 ${theme.space[3]} 0;
    font-size: ${theme.fontSizes.bodySm};
  }
`;

const EmptyStateAction = styled.button`
  background: transparent;
  border: 1px solid ${theme.colors.brand.primary};
  color: ${theme.colors.brand.primary};
  padding: ${theme.space[2]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;
  text-decoration: none;
  transition: all ${theme.transitions.fast} ease;

  &:hover {
    background: ${theme.colors.brand.primary};
    color: white;
  }
`;

const ShowsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[3]};
`;

const ShowItem = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${theme.space[3]};
  padding: ${theme.space[3]};
  background: var(--color-bg-tertiary);
  border-radius: ${theme.radius.md};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  &:hover {
    background: var(--color-bg-elevated);
    transform: translateX(4px);
  }
`;

const ShowDate = styled.div<{ $isRehearsal?: boolean }>`
  width: 48px;
  height: 48px;
  background: ${(props) => props.$isRehearsal ? theme.colors.accent.cyan : theme.gradients.brandPrimary};
  border-radius: ${theme.radius.md};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

const ShowDay = styled.span`
  font-size: ${theme.fontSizes.bodyLg};
  font-weight: ${theme.fontWeights.bold};
  color: white;
  line-height: 1;
`;

const ShowMonth = styled.span`
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.medium};
  color: rgba(255, 255, 255, 0.8);
  text-transform: uppercase;
`;

const ShowDetails = styled.div`
  flex: 1;
  min-width: 0;
`;

const ShowName = styled.div`
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin-bottom: ${theme.space[1]};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ShowVenue = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
  margin-bottom: ${theme.space[1]};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const EventTypeRow = styled.div`
  margin-bottom: ${theme.space[1]};
`;

const EventTypeBadge = styled.span<{ $isRehearsal?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[1]};
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.medium};
  color: ${(props) => props.$isRehearsal ? theme.colors.accent.cyan : theme.colors.brand.primary};
  text-transform: uppercase;
  letter-spacing: 0.5px;

  i {
    font-size: ${theme.fontSizes.bodyXs};
  }
`;

const ShowMeta = styled.div`
  font-size: ${theme.fontSizes.bodyXs};
  color: var(--color-text-tertiary);
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  flex-wrap: wrap;
`;

const CountdownBadge = styled.span`
  display: inline-flex;
  align-items: center;
  background: ${theme.colors.accent.amber}20;
  color: ${theme.colors.accent.amber};
  padding: ${theme.space[1]} ${theme.space[2]};
  border-radius: ${theme.radius.sm};
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.medium};
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
  padding: ${theme.space[2]};
  border-radius: ${theme.radius.md};
  transition: background ${theme.transitions.fast} ease;

  &:hover {
    background: var(--color-bg-tertiary);
  }
`;

const SongArt = styled.img`
  width: 40px;
  height: 40px;
  border-radius: ${theme.radius.sm};
  object-fit: cover;
`;

const SongArtPlaceholder = styled.div`
  width: 40px;
  height: 40px;
  background: var(--color-bg-tertiary);
  border-radius: ${theme.radius.sm};
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-disabled);
`;

const SongInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const SongTitle = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const SongArtist = styled.div`
  font-size: ${theme.fontSizes.bodyXs};
  color: var(--color-text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const SongKey = styled.span`
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
  padding: ${theme.space[1]} ${theme.space[2]};
  border-radius: ${theme.radius.sm};
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.medium};
`;

const QuickActionsSection = styled.div`
  margin-top: ${theme.space[4]};
`;

const QuickActionsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: ${theme.space[4]};

  @media (max-width: ${theme.breakpoints.lg}) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: ${theme.breakpoints.sm}) {
    grid-template-columns: 1fr;
  }
`;

const QuickAction = styled.button`
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.lg};
  padding: ${theme.space[5]};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${theme.space[3]};
  cursor: pointer;
  text-decoration: none;
  color: inherit;
  transition: all ${theme.transitions.base} ease;

  &:hover {
    border-color: ${theme.colors.brand.primary};
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
    background: var(--color-bg-elevated);
  }
`;

const QuickActionIcon = styled.div<{ $color: string }>`
  width: 48px;
  height: 48px;
  background: ${(props) => props.$color}20;
  border-radius: ${theme.radius.md};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${theme.fontSizes.h3};
  color: ${(props) => props.$color};
  transition: all ${theme.transitions.fast} ease;

  ${QuickAction}:hover & {
    background: ${(props) => props.$color};
    color: white;
  }
`;

const QuickActionText = styled.span`
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  color: var(--color-text-secondary);
`;

export default Home;
