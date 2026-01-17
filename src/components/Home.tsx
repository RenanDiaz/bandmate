import { useState, useEffect } from "react";
import { Container } from "reactstrap";
import styled from "styled-components";
import { theme } from "../theme";
import { Logo } from "./Logo";
import { useBandContext } from "../context/useBandContext";
import { Link, useNavigate } from "react-router-dom";
import { PendingInvitations } from "./PendingInvitations";
import { getBandSongs } from "../services/songsService";
import type { Song } from "../services/songsService";
import { getBandSetlists } from "../services/setlistsService";
import type { Setlist } from "../services/setlistsService";
import { getUpcomingShows } from "../services/showsService";
import type { Show } from "../services/showsService";
import { SEO } from "./SEO";
import { useTranslation } from "react-i18next";

const Home = () => {
  const { t, i18n } = useTranslation();
  const { user, selectedBand, refreshBands } = useBandContext();
  const navigate = useNavigate();
  const [songs, setSongs] = useState<Song[]>([]);
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [upcomingShows, setUpcomingShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);

  const currentLocale = i18n.language.startsWith('es') ? 'es-ES' : 'en-US';

  useEffect(() => {
    if (user && selectedBand) {
      setLoading(true);
      Promise.all([
        getBandSongs(selectedBand.id),
        getBandSetlists(selectedBand.id),
        getUpcomingShows(selectedBand.id),
      ])
        .then(([songsData, setlistsData, showsData]) => {
          setSongs(songsData);
          setSetlists(setlistsData);
          setUpcomingShows(showsData);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [user, selectedBand]);

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
                      <StatNumber>{upcomingShows.length}</StatNumber>
                      <StatLabel>{t('home.upcomingShows')}</StatLabel>
                    </StatInfo>
                  </StatCard>
                </StatsGrid>

                {/* Widgets Grid */}
                <WidgetsGrid>
                  {/* Upcoming Shows Widget */}
                  <Widget>
                    <WidgetHeader>
                      <WidgetTitle>
                        <i className="bi bi-calendar-event"></i>
                        {t('home.upcomingShows')}
                      </WidgetTitle>
                      <WidgetAction as={Link} to="/shows">
                        {t('common.viewAll')} <i className="bi bi-arrow-right"></i>
                      </WidgetAction>
                    </WidgetHeader>
                    <WidgetContent>
                      {upcomingShows.length === 0 ? (
                        <EmptyState>
                          <i className="bi bi-calendar-x"></i>
                          <p>{t('home.noUpcomingShows')}</p>
                          <EmptyStateAction as={Link} to="/shows">
                            {t('home.scheduleShow')}
                          </EmptyStateAction>
                        </EmptyState>
                      ) : (
                        <ShowsList>
                          {upcomingShows.slice(0, 4).map((show) => (
                            <ShowItem key={show.id} onClick={() => navigate(`/shows/${show.id}`)}>
                              <ShowDate>
                                <ShowDay>
                                  {new Date(show.event_date + "T00:00:00").getDate()}
                                </ShowDay>
                                <ShowMonth>
                                  {new Date(show.event_date + "T00:00:00").toLocaleDateString(currentLocale, {
                                    month: "short",
                                  })}
                                </ShowMonth>
                              </ShowDate>
                              <ShowDetails>
                                <ShowName>{show.name}</ShowName>
                                {show.venue && <ShowVenue>{show.venue}</ShowVenue>}
                                <ShowMeta>
                                  <span>{formatDate(show.event_date)}</span>
                                  {show.event_time && <span> {t('home.at')} {formatTime(show.event_time)}</span>}
                                  <CountdownBadge>{getDaysUntil(show.event_date)}</CountdownBadge>
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

  // Landing page for non-authenticated users
  return (
    <HomeWrapper>
      <SEO />
      {user && (
        <Container style={{ marginTop: theme.space[6] }}>
          <PendingInvitations onInvitationAccepted={refreshBands} />
        </Container>
      )}
      <HeroSection>
        <Container>
          <HeroContent>
            <LogoWrapper>
              <Logo size={80} variant="icon" />
            </LogoWrapper>

            <HeroTitle>
              {t('home.welcomeToBandmate').split('Bandmate')[0]}<BrandName>Bandmate</BrandName>
            </HeroTitle>

            <HeroSubtitle>
              {t('home.heroSubtitle')}
            </HeroSubtitle>

            {!user && (
              <CTASection>
                <CTAText>{t('home.getStarted')}</CTAText>
                <CTAButton as={Link} to="/login">
                  <i className="bi bi-box-arrow-in-right"></i>
                  {t('home.signInToContinue')}
                </CTAButton>
              </CTASection>
            )}

            {user && (
              <CTASection>
                <CTAButton as={Link} to="/songs">
                  <i className="bi bi-music-note-list"></i>
                  {t('home.goToYourSongs')}
                </CTAButton>
              </CTASection>
            )}
          </HeroContent>
        </Container>
      </HeroSection>

      <FeaturesSection>
        <Container>
          <SectionTitle>{t('home.everythingYourBandNeeds')}</SectionTitle>

          <FeaturesGrid>
            <FeatureCard as={user ? Link : "div"} to={user ? "/songs" : undefined} $clickable={!!user}>
              <FeatureIcon>
                <i className="bi bi-music-note-list"></i>
              </FeatureIcon>
              <FeatureTitle>{t('features.songLibrary')}</FeatureTitle>
              <FeatureDescription>
                {t('features.songLibraryDesc')}
              </FeatureDescription>
            </FeatureCard>

            <FeatureCard $clickable={false}>
              <FeatureIcon>
                <i className="bi bi-people"></i>
              </FeatureIcon>
              <FeatureTitle>{t('features.bandManagement')}</FeatureTitle>
              <FeatureDescription>
                {t('features.bandManagementDesc')}
              </FeatureDescription>
            </FeatureCard>

            <FeatureCard as={user ? Link : "div"} to={user ? "/setlists" : undefined} $clickable={!!user}>
              <FeatureIcon>
                <i className="bi bi-list-ul"></i>
              </FeatureIcon>
              <FeatureTitle>{t('features.setlists')}</FeatureTitle>
              <FeatureDescription>
                {t('features.setlistsDesc')}
              </FeatureDescription>
            </FeatureCard>

            <FeatureCard $clickable={false}>
              <FeatureIcon>
                <i className="bi bi-play-circle"></i>
              </FeatureIcon>
              <FeatureTitle>{t('features.performanceMode')}</FeatureTitle>
              <FeatureDescription>
                {t('features.performanceModeDesc')}
              </FeatureDescription>
            </FeatureCard>

            <FeatureCard $clickable={false}>
              <FeatureIcon>
                <i className="bi bi-music-note-beamed"></i>
              </FeatureIcon>
              <FeatureTitle>{t('features.musicIntelligence')}</FeatureTitle>
              <FeatureDescription>
                {t('features.musicIntelligenceDesc')}
              </FeatureDescription>
            </FeatureCard>

            <FeatureCard $clickable={false}>
              <FeatureIcon>
                <i className="bi bi-phone"></i>
              </FeatureIcon>
              <FeatureTitle>{t('features.mobileReady')}</FeatureTitle>
              <FeatureDescription>
                {t('features.mobileReadyDesc')}
              </FeatureDescription>
            </FeatureCard>
          </FeaturesGrid>
        </Container>
      </FeaturesSection>

      <CTASectionBottom>
        <Container>
          <CTAContent>
            <CTABottomTitle>{t('home.readyToGetOrganized')}</CTABottomTitle>
            <CTABottomSubtitle>
              {t('home.joinMusicians')}
            </CTABottomSubtitle>
            {!user && (
              <CTAButton as={Link} to="/login">
                <i className="bi bi-box-arrow-in-right"></i>
                {t('home.getStartedFree')}
              </CTAButton>
            )}
          </CTAContent>
        </Container>
      </CTASectionBottom>
    </HomeWrapper>
  );
};

// Styled Components

const HomeWrapper = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const HeroSection = styled.section`
  background: ${theme.gradients.brandPrimary};
  padding: ${theme.space[16]} 0 ${theme.space[20]};
  position: relative;
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
  }

  @media (max-width: ${theme.breakpoints.md}) {
    padding: ${theme.space[12]} 0 ${theme.space[16]};
  }
`;

const HeroContent = styled.div`
  text-align: center;
  position: relative;
  z-index: 1;
  max-width: 800px;
  margin: 0 auto;
`;

const LogoWrapper = styled.div`
  margin-bottom: ${theme.space[6]};
  display: flex;
  justify-content: center;
  animation: fadeInDown 0.6s ease-out;

  @keyframes fadeInDown {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const HeroTitle = styled.h1`
  font-size: ${theme.fontSizes.displayLg};
  font-weight: ${theme.fontWeights.extrabold};
  color: white;
  margin-bottom: ${theme.space[4]};
  line-height: ${theme.lineHeights.tight};
  animation: fadeInUp 0.6s ease-out 0.1s both;

  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (max-width: ${theme.breakpoints.md}) {
    font-size: ${theme.fontSizes.displayMd};
  }
`;

const BrandName = styled.span`
  background: linear-gradient(135deg, #ffffff 0%, #e0e7ff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`;

const HeroSubtitle = styled.p`
  font-size: ${theme.fontSizes.bodyLg};
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: ${theme.space[8]};
  line-height: ${theme.lineHeights.relaxed};
  animation: fadeInUp 0.6s ease-out 0.2s both;

  @media (max-width: ${theme.breakpoints.md}) {
    font-size: ${theme.fontSizes.body};
  }
`;

const CTASection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${theme.space[4]};
  animation: fadeInUp 0.6s ease-out 0.3s both;
`;

const CTAText = styled.p`
  color: rgba(255, 255, 255, 0.8);
  font-size: ${theme.fontSizes.bodySm};
  margin: 0;
`;

const CTAButton = styled.button`
  background: white;
  color: ${theme.colors.brand.primary};
  border: none;
  padding: ${theme.space[4]} ${theme.space[8]};
  border-radius: ${theme.radius.lg};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.base} ease;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  text-decoration: none;
  box-shadow: ${theme.shadowsLight.lg};

  i {
    font-size: ${theme.fontSizes.bodyLg};
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: ${theme.shadowsLight.xl};
    background: rgba(255, 255, 255, 0.95);
  }

  &:active {
    transform: translateY(0);
  }
`;

const FeaturesSection = styled.section`
  padding: ${theme.space[20]} 0;
  background: ${theme.colors.dark.bg.primary};

  @media (max-width: ${theme.breakpoints.md}) {
    padding: ${theme.space[12]} 0;
  }
`;

const SectionTitle = styled.h2`
  font-size: ${theme.fontSizes.displayMd};
  font-weight: ${theme.fontWeights.bold};
  color: ${theme.colors.dark.text.primary};
  text-align: center;
  margin-bottom: ${theme.space[12]};

  @media (max-width: ${theme.breakpoints.md}) {
    font-size: ${theme.fontSizes.h1};
    margin-bottom: ${theme.space[8]};
  }
`;

const FeaturesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: ${theme.space[6]};
  max-width: 1200px;
  margin: 0 auto;

  @media (max-width: ${theme.breakpoints.md}) {
    grid-template-columns: 1fr;
    gap: ${theme.space[4]};
  }
`;

const FeatureCard = styled.div<{ $clickable?: boolean }>`
  background: ${theme.colors.dark.bg.secondary};
  border: 1px solid ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.lg};
  padding: ${theme.space[6]};
  transition: all ${theme.transitions.base} ease;
  position: relative;
  text-decoration: none;
  color: inherit;
  display: block;
  cursor: ${(props) => (props.$clickable ? "pointer" : "default")};

  &:hover {
    transform: translateY(-4px);
    box-shadow: ${theme.shadows.lg};
    border-color: ${theme.colors.brand.primary};

    ${(props) =>
      props.$clickable &&
      `
      background: ${theme.colors.dark.bg.elevated};
    `}
  }
`;

const FeatureIcon = styled.div`
  width: 56px;
  height: 56px;
  background: ${theme.gradients.brandPrimary};
  border-radius: ${theme.radius.md};
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: ${theme.space[4]};
  font-size: ${theme.fontSizes.h2};
  color: white;
`;

const FeatureTitle = styled.h3`
  font-size: ${theme.fontSizes.h3};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.dark.text.primary};
  margin-bottom: ${theme.space[2]};
`;

const FeatureDescription = styled.p`
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.dark.text.secondary};
  line-height: ${theme.lineHeights.relaxed};
  margin: 0;
`;


const CTASectionBottom = styled.section`
  background: ${theme.colors.dark.bg.secondary};
  border-top: 1px solid ${theme.colors.dark.border.default};
  padding: ${theme.space[16]} 0;

  @media (max-width: ${theme.breakpoints.md}) {
    padding: ${theme.space[12]} 0;
  }
`;

const CTAContent = styled.div`
  text-align: center;
  max-width: 600px;
  margin: 0 auto;
`;

const CTABottomTitle = styled.h2`
  font-size: ${theme.fontSizes.displayMd};
  font-weight: ${theme.fontWeights.bold};
  color: ${theme.colors.dark.text.primary};
  margin-bottom: ${theme.space[4]};

  @media (max-width: ${theme.breakpoints.md}) {
    font-size: ${theme.fontSizes.h1};
  }
`;

const CTABottomSubtitle = styled.p`
  font-size: ${theme.fontSizes.bodyLg};
  color: ${theme.colors.dark.text.secondary};
  margin-bottom: ${theme.space[8]};
  line-height: ${theme.lineHeights.relaxed};

  @media (max-width: ${theme.breakpoints.md}) {
    font-size: ${theme.fontSizes.body};
  }
`;

// Dashboard Styled Components

const DashboardSection = styled.section`
  flex: 1;
  padding: ${theme.space[6]} 0 ${theme.space[12]};
  background: ${theme.colors.dark.bg.primary};
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
  color: ${theme.colors.dark.text.primary};
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
  color: ${theme.colors.dark.text.secondary};
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
  background: ${theme.colors.dark.bg.secondary};
  border: 1px solid ${theme.colors.dark.border.default};
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
    box-shadow: ${theme.shadows.md};
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
  color: ${theme.colors.dark.text.primary};
  line-height: 1;
`;

const StatLabel = styled.span`
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.dark.text.secondary};
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
  background: ${theme.colors.dark.bg.secondary};
  border: 1px solid ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.lg};
  overflow: hidden;
`;

const WidgetHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${theme.space[4]};
  border-bottom: 1px solid ${theme.colors.dark.border.default};
  background: ${theme.colors.dark.bg.tertiary};
`;

const WidgetTitle = styled.h3`
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.dark.text.primary};
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
    color: ${theme.colors.dark.text.disabled};
    margin-bottom: ${theme.space[3]};
  }

  p {
    color: ${theme.colors.dark.text.tertiary};
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
  background: ${theme.colors.dark.bg.tertiary};
  border-radius: ${theme.radius.md};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  &:hover {
    background: ${theme.colors.dark.bg.elevated};
    transform: translateX(4px);
  }
`;

const ShowDate = styled.div`
  width: 48px;
  height: 48px;
  background: ${theme.gradients.brandPrimary};
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
  color: ${theme.colors.dark.text.primary};
  margin-bottom: ${theme.space[1]};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ShowVenue = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.dark.text.secondary};
  margin-bottom: ${theme.space[1]};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ShowMeta = styled.div`
  font-size: ${theme.fontSizes.bodyXs};
  color: ${theme.colors.dark.text.tertiary};
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
    background: ${theme.colors.dark.bg.tertiary};
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
  background: ${theme.colors.dark.bg.tertiary};
  border-radius: ${theme.radius.sm};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${theme.colors.dark.text.disabled};
`;

const SongInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const SongTitle = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  color: ${theme.colors.dark.text.primary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const SongArtist = styled.div`
  font-size: ${theme.fontSizes.bodyXs};
  color: ${theme.colors.dark.text.tertiary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const SongKey = styled.span`
  background: ${theme.colors.dark.bg.tertiary};
  color: ${theme.colors.dark.text.secondary};
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
  background: ${theme.colors.dark.bg.secondary};
  border: 1px solid ${theme.colors.dark.border.default};
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
    box-shadow: ${theme.shadows.md};
    background: ${theme.colors.dark.bg.elevated};
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
  color: ${theme.colors.dark.text.secondary};
`;

export default Home;
