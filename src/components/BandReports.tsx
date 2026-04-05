import type { FC } from "react";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Spinner } from "reactstrap";
import styled from "styled-components";
import { theme } from "../theme";
import type { Band } from "../services/bandsService";
import type {
  BandOverviewStats,
  SongUsageStats,
  KeyDistribution,
  TempoDistribution,
  MonthlyActivity,
  VenueStats,
  CountryDistribution,
} from "../services/reportsService";
import {
  getBandOverviewStats,
  getMostUsedSongs,
  getUnusedSongs,
  getKeyDistribution,
  getTempoDistribution,
  getMonthlyActivity,
  getTopVenues,
  getCountryDistribution,
} from "../services/reportsService";
import type { Song } from "../services/songsService";

interface Props {
  band: Band;
}

export const BandReports: FC<Props> = ({ band }) => {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [overviewStats, setOverviewStats] = useState<BandOverviewStats | null>(null);
  const [mostUsedSongs, setMostUsedSongs] = useState<SongUsageStats[]>([]);
  const [unusedSongs, setUnusedSongs] = useState<Song[]>([]);
  const [keyDistribution, setKeyDistribution] = useState<KeyDistribution[]>([]);
  const [tempoDistribution, setTempoDistribution] = useState<TempoDistribution[]>([]);
  const [monthlyActivity, setMonthlyActivity] = useState<MonthlyActivity[]>([]);
  const [topVenues, setTopVenues] = useState<VenueStats[]>([]);
  const [countryDistribution, setCountryDistribution] = useState<CountryDistribution[]>([]);

  useEffect(() => {
    loadReports();
  }, [band.id]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const [overview, mostUsed, unused, keys, tempos, monthly, venues, countries] = await Promise.all([
        getBandOverviewStats(band.id),
        getMostUsedSongs(band.id, 10),
        getUnusedSongs(band.id),
        getKeyDistribution(band.id),
        getTempoDistribution(band.id),
        getMonthlyActivity(band.id, 6),
        getTopVenues(band.id, 5),
        getCountryDistribution(band.id),
      ]);

      setOverviewStats(overview);
      setMostUsedSongs(mostUsed);
      setUnusedSongs(unused);
      setKeyDistribution(keys);
      setTempoDistribution(tempos);
      setMonthlyActivity(monthly);
      setTopVenues(venues);
      setCountryDistribution(countries);
    } catch (error) {
      console.error("Failed to load reports:", error);
    }
    setLoading(false);
  };

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
  };

  if (loading) {
    return (
      <LoadingContainer>
        <Spinner color="primary" style={{ width: "2rem", height: "2rem" }} />
        <LoadingText>{t("reports.loading")}</LoadingText>
      </LoadingContainer>
    );
  }

  return (
    <ReportsContainer>
      {/* Overview Stats */}
      <Section>
        <SectionTitle>
          <i className="bi bi-speedometer2"></i>
          {t("reports.overview")}
        </SectionTitle>
        <StatsGrid>
          <StatCard>
            <StatIcon $color="purple">
              <i className="bi bi-music-note-list"></i>
            </StatIcon>
            <StatInfo>
              <StatValue>{overviewStats?.totalSongs || 0}</StatValue>
              <StatLabel>{t("reports.totalSongs")}</StatLabel>
            </StatInfo>
          </StatCard>
          <StatCard>
            <StatIcon $color="cyan">
              <i className="bi bi-list-ol"></i>
            </StatIcon>
            <StatInfo>
              <StatValue>{overviewStats?.totalSetlists || 0}</StatValue>
              <StatLabel>{t("reports.totalSetlists")}</StatLabel>
            </StatInfo>
          </StatCard>
          <StatCard>
            <StatIcon $color="amber">
              <i className="bi bi-calendar-event"></i>
            </StatIcon>
            <StatInfo>
              <StatValue>{overviewStats?.completedShows || 0}</StatValue>
              <StatLabel>{t("reports.completedShows")}</StatLabel>
            </StatInfo>
          </StatCard>
          <StatCard>
            <StatIcon $color="rose">
              <i className="bi bi-clock-history"></i>
            </StatIcon>
            <StatInfo>
              <StatValue>{overviewStats?.completedRehearsals || 0}</StatValue>
              <StatLabel>{t("reports.completedRehearsals")}</StatLabel>
            </StatInfo>
          </StatCard>
        </StatsGrid>
      </Section>

      {/* Shows Status */}
      {overviewStats && overviewStats.totalShows > 0 && (
        <Section>
          <SectionTitle>
            <i className="bi bi-pie-chart"></i>
            {t("reports.showsStatus")}
          </SectionTitle>
          <StatusBars>
            <StatusBar>
              <StatusLabel>{t("reports.upcoming")}</StatusLabel>
              <StatusBarTrack>
                <StatusBarFill
                  $color="cyan"
                  $percentage={(overviewStats.upcomingShows / overviewStats.totalShows) * 100}
                />
              </StatusBarTrack>
              <StatusCount>{overviewStats.upcomingShows}</StatusCount>
            </StatusBar>
            <StatusBar>
              <StatusLabel>{t("reports.completed")}</StatusLabel>
              <StatusBarTrack>
                <StatusBarFill
                  $color="green"
                  $percentage={(overviewStats.completedShows / overviewStats.totalShows) * 100}
                />
              </StatusBarTrack>
              <StatusCount>{overviewStats.completedShows}</StatusCount>
            </StatusBar>
            <StatusBar>
              <StatusLabel>{t("reports.cancelled")}</StatusLabel>
              <StatusBarTrack>
                <StatusBarFill
                  $color="red"
                  $percentage={(overviewStats.cancelledShows / overviewStats.totalShows) * 100}
                />
              </StatusBarTrack>
              <StatusCount>{overviewStats.cancelledShows}</StatusCount>
            </StatusBar>
          </StatusBars>
        </Section>
      )}

      {/* Monthly Activity */}
      {monthlyActivity.length > 0 && (
        <Section>
          <SectionTitle>
            <i className="bi bi-graph-up"></i>
            {t("reports.monthlyActivity")}
          </SectionTitle>
          <ActivityChart>
            {monthlyActivity.map((month) => (
              <ActivityMonth key={month.month}>
                <ActivityBars>
                  <ActivityBar
                    $color="amber"
                    $height={Math.max(4, (month.shows / Math.max(...monthlyActivity.map((m) => m.shows || 1))) * 60)}
                    title={`${month.shows} ${t("reports.shows")}`}
                  />
                  <ActivityBar
                    $color="purple"
                    $height={Math.max(4, (month.rehearsals / Math.max(...monthlyActivity.map((m) => m.rehearsals || 1))) * 60)}
                    title={`${month.rehearsals} ${t("reports.rehearsals")}`}
                  />
                </ActivityBars>
                <ActivityLabel>{formatMonth(month.month)}</ActivityLabel>
              </ActivityMonth>
            ))}
          </ActivityChart>
          <ChartLegend>
            <LegendItem>
              <LegendDot $color="amber" />
              {t("reports.shows")}
            </LegendItem>
            <LegendItem>
              <LegendDot $color="purple" />
              {t("reports.rehearsals")}
            </LegendItem>
          </ChartLegend>
        </Section>
      )}

      {/* Most Used Songs */}
      {mostUsedSongs.length > 0 && (
        <Section>
          <SectionTitle>
            <i className="bi bi-star"></i>
            {t("reports.mostUsedSongs")}
          </SectionTitle>
          <SongList>
            {mostUsedSongs.map((song, index) => (
              <SongItem key={song.songId}>
                <SongRank>{index + 1}</SongRank>
                <SongInfo>
                  <SongTitle>{song.title}</SongTitle>
                  {song.artist && <SongArtist>{song.artist}</SongArtist>}
                </SongInfo>
                <UsageCount>
                  {song.usageCount} {song.usageCount === 1 ? t("reports.setlist") : t("reports.setlists")}
                </UsageCount>
              </SongItem>
            ))}
          </SongList>
        </Section>
      )}

      {/* Key Distribution */}
      {keyDistribution.length > 0 && (
        <Section>
          <SectionTitle>
            <i className="bi bi-music-note"></i>
            {t("reports.keyDistribution")}
          </SectionTitle>
          <KeyGrid>
            {keyDistribution.slice(0, 12).map((item) => (
              <KeyBadge key={item.key}>
                <KeyName>{item.key}</KeyName>
                <KeyCount>{item.count}</KeyCount>
              </KeyBadge>
            ))}
          </KeyGrid>
        </Section>
      )}

      {/* Country Distribution */}
      {countryDistribution.length > 0 && (
        <Section>
          <SectionTitle>
            <i className="bi bi-globe-americas"></i>
            {t("reports.countryDistribution")}
          </SectionTitle>
          <CountryList>
            {countryDistribution.map((item, index) => (
              <CountryItem key={item.country}>
                <CountryRank>{index + 1}</CountryRank>
                <CountryName>{item.country}</CountryName>
                <CountryBarTrack>
                  <CountryBarFill
                    $percentage={
                      (item.count / Math.max(...countryDistribution.map((c) => c.count))) * 100
                    }
                  />
                </CountryBarTrack>
                <CountryCount>
                  {item.count} {item.count === 1 ? t("reports.song") : t("reports.songs_count")}
                </CountryCount>
              </CountryItem>
            ))}
          </CountryList>
        </Section>
      )}

      {/* Tempo Distribution */}
      {tempoDistribution.length > 0 && (
        <Section>
          <SectionTitle>
            <i className="bi bi-speedometer"></i>
            {t("reports.tempoDistribution")}
          </SectionTitle>
          <TempoList>
            {tempoDistribution.map((item) => (
              <TempoItem key={item.range}>
                <TempoLabel>{t(`reports.tempo.${item.range.split(" ")[0].toLowerCase()}`) || item.range}</TempoLabel>
                <TempoBarTrack>
                  <TempoBarFill
                    $percentage={
                      (item.count / Math.max(...tempoDistribution.map((t) => t.count))) * 100
                    }
                  />
                </TempoBarTrack>
                <TempoCount>{item.count}</TempoCount>
              </TempoItem>
            ))}
          </TempoList>
        </Section>
      )}

      {/* Top Venues */}
      {topVenues.length > 0 && (
        <Section>
          <SectionTitle>
            <i className="bi bi-geo-alt"></i>
            {t("reports.topVenues")}
          </SectionTitle>
          <VenueList>
            {topVenues.map((venue, index) => (
              <VenueItem key={venue.venue}>
                <VenueRank>{index + 1}</VenueRank>
                <VenueName>{venue.venue}</VenueName>
                <VenueCount>
                  {venue.showCount} {venue.showCount === 1 ? t("reports.show") : t("reports.shows")}
                </VenueCount>
              </VenueItem>
            ))}
          </VenueList>
        </Section>
      )}

      {/* Unused Songs */}
      {unusedSongs.length > 0 && (
        <Section>
          <SectionTitle>
            <i className="bi bi-exclamation-circle"></i>
            {t("reports.unusedSongs")}
            <UnusedCount>{unusedSongs.length}</UnusedCount>
          </SectionTitle>
          <UnusedSongsList>
            {unusedSongs.slice(0, 10).map((song) => (
              <UnusedSongItem key={song.id}>
                <SongTitle>{song.title}</SongTitle>
                {song.artist && <SongArtist>{song.artist}</SongArtist>}
              </UnusedSongItem>
            ))}
            {unusedSongs.length > 10 && (
              <MoreText>
                {t("reports.andMore", { count: unusedSongs.length - 10 })}
              </MoreText>
            )}
          </UnusedSongsList>
        </Section>
      )}

      {/* Empty State */}
      {overviewStats?.totalSongs === 0 && overviewStats?.totalShows === 0 && (
        <EmptyState>
          <EmptyIcon>
            <i className="bi bi-bar-chart-line"></i>
          </EmptyIcon>
          <EmptyTitle>{t("reports.noData")}</EmptyTitle>
          <EmptyText>{t("reports.noDataDesc")}</EmptyText>
        </EmptyState>
      )}
    </ReportsContainer>
  );
};

// Styled Components

const ReportsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[6]};
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

const Section = styled.div`
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.lg};
  padding: ${theme.space[5]};
`;

const SectionTitle = styled.h3`
  font-size: ${theme.fontSizes.bodyLg};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin: 0 0 ${theme.space[4]} 0;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};

  i {
    color: ${theme.colors.brand.primary};
  }
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: ${theme.space[3]};

  @media (min-width: ${theme.breakpoints.md}) {
    grid-template-columns: repeat(4, 1fr);
  }
`;

const StatCard = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  padding: ${theme.space[3]};
  background: var(--color-bg-primary);
  border-radius: ${theme.radius.base};
`;

const StatIcon = styled.div<{ $color: "purple" | "cyan" | "amber" | "rose" }>`
  width: 40px;
  height: 40px;
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${theme.fontSizes.bodyLg};
  background: ${(props) => {
    switch (props.$color) {
      case "purple": return `${theme.colors.brand.primary}20`;
      case "cyan": return `${theme.colors.accent.cyan}20`;
      case "amber": return `${theme.colors.accent.amber}20`;
      case "rose": return `${theme.colors.accent.rose}20`;
    }
  }};
  color: ${(props) => {
    switch (props.$color) {
      case "purple": return theme.colors.brand.primary;
      case "cyan": return theme.colors.accent.cyan;
      case "amber": return theme.colors.accent.amber;
      case "rose": return theme.colors.accent.rose;
    }
  }};
`;

const StatInfo = styled.div`
  display: flex;
  flex-direction: column;
`;

const StatValue = styled.div`
  font-size: ${theme.fontSizes.h3};
  font-weight: ${theme.fontWeights.bold};
  color: var(--color-text-primary);
  line-height: 1;
`;

const StatLabel = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
`;

const StatusBars = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[3]};
`;

const StatusBar = styled.div`
  display: grid;
  grid-template-columns: 100px 1fr 40px;
  align-items: center;
  gap: ${theme.space[3]};
`;

const StatusLabel = styled.span`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
`;

const StatusBarTrack = styled.div`
  height: 8px;
  background: var(--color-bg-primary);
  border-radius: ${theme.radius.full};
  overflow: hidden;
`;

const StatusBarFill = styled.div<{ $color: "cyan" | "green" | "red"; $percentage: number }>`
  height: 100%;
  width: ${(props) => props.$percentage}%;
  border-radius: ${theme.radius.full};
  background: ${(props) => {
    switch (props.$color) {
      case "cyan": return theme.colors.accent.cyan;
      case "green": return theme.colors.semantic.success;
      case "red": return theme.colors.semantic.error;
    }
  }};
  transition: width 0.3s ease;
`;

const StatusCount = styled.span`
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  text-align: right;
`;

const ActivityChart = styled.div`
  display: flex;
  justify-content: space-around;
  align-items: flex-end;
  height: 100px;
  padding: ${theme.space[2]} 0;
`;

const ActivityMonth = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${theme.space[2]};
`;

const ActivityBars = styled.div`
  display: flex;
  gap: 4px;
  align-items: flex-end;
  height: 70px;
`;

const ActivityBar = styled.div<{ $color: "amber" | "purple"; $height: number }>`
  width: 12px;
  height: ${(props) => props.$height}px;
  border-radius: ${theme.radius.sm} ${theme.radius.sm} 0 0;
  background: ${(props) =>
    props.$color === "amber" ? theme.colors.accent.amber : theme.colors.brand.primary};
  transition: height 0.3s ease;
`;

const ActivityLabel = styled.span`
  font-size: ${theme.fontSizes.bodyXs};
  color: var(--color-text-tertiary);
`;

const ChartLegend = styled.div`
  display: flex;
  justify-content: center;
  gap: ${theme.space[4]};
  margin-top: ${theme.space[3]};
`;

const LegendItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
`;

const LegendDot = styled.div<{ $color: "amber" | "purple" }>`
  width: 8px;
  height: 8px;
  border-radius: ${theme.radius.full};
  background: ${(props) =>
    props.$color === "amber" ? theme.colors.accent.amber : theme.colors.brand.primary};
`;

const SongList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[2]};
`;

const SongItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  padding: ${theme.space[2]} ${theme.space[3]};
  background: var(--color-bg-primary);
  border-radius: ${theme.radius.base};
`;

const SongRank = styled.div`
  width: 24px;
  height: 24px;
  border-radius: ${theme.radius.full};
  background: ${theme.colors.brand.primary}20;
  color: ${theme.colors.brand.primary};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  display: flex;
  align-items: center;
  justify-content: center;
`;

const SongInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const SongTitle = styled.div`
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.medium};
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const SongArtist = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const UsageCount = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-tertiary);
  white-space: nowrap;
`;

const KeyGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${theme.space[2]};
`;

const KeyBadge = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  padding: ${theme.space[2]} ${theme.space[3]};
  background: var(--color-bg-primary);
  border-radius: ${theme.radius.base};
`;

const KeyName = styled.span`
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.brand.primary};
`;

const KeyCount = styled.span`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-tertiary);
`;

const CountryList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[2]};
`;

const CountryItem = styled.div`
  display: grid;
  grid-template-columns: 28px 120px 1fr 80px;
  align-items: center;
  gap: ${theme.space[3]};
  padding: ${theme.space[2]} ${theme.space[3]};
  background: var(--color-bg-primary);
  border-radius: ${theme.radius.base};

  @media (min-width: ${theme.breakpoints.md}) {
    grid-template-columns: 28px 160px 1fr 100px;
  }
`;

const CountryRank = styled.div`
  width: 24px;
  height: 24px;
  border-radius: ${theme.radius.full};
  background: ${theme.colors.accent.cyan}20;
  color: ${theme.colors.accent.cyan};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  display: flex;
  align-items: center;
  justify-content: center;
`;

const CountryName = styled.div`
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.medium};
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const CountryBarTrack = styled.div`
  height: 8px;
  background: var(--color-bg-secondary);
  border-radius: ${theme.radius.full};
  overflow: hidden;
`;

const CountryBarFill = styled.div<{ $percentage: number }>`
  height: 100%;
  width: ${(props) => props.$percentage}%;
  border-radius: ${theme.radius.full};
  background: ${theme.colors.accent.cyan};
  transition: width 0.3s ease;
`;

const CountryCount = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-tertiary);
  white-space: nowrap;
  text-align: right;
`;

const TempoList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[2]};
`;

const TempoItem = styled.div`
  display: grid;
  grid-template-columns: 120px 1fr 40px;
  align-items: center;
  gap: ${theme.space[3]};
`;

const TempoLabel = styled.span`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
`;

const TempoBarTrack = styled.div`
  height: 8px;
  background: var(--color-bg-primary);
  border-radius: ${theme.radius.full};
  overflow: hidden;
`;

const TempoBarFill = styled.div<{ $percentage: number }>`
  height: 100%;
  width: ${(props) => props.$percentage}%;
  border-radius: ${theme.radius.full};
  background: ${theme.colors.brand.primary};
  transition: width 0.3s ease;
`;

const TempoCount = styled.span`
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  text-align: right;
`;

const VenueList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[2]};
`;

const VenueItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  padding: ${theme.space[2]} ${theme.space[3]};
  background: var(--color-bg-primary);
  border-radius: ${theme.radius.base};
`;

const VenueRank = styled.div`
  width: 24px;
  height: 24px;
  border-radius: ${theme.radius.full};
  background: ${theme.colors.accent.amber}20;
  color: ${theme.colors.accent.amber};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  display: flex;
  align-items: center;
  justify-content: center;
`;

const VenueName = styled.div`
  flex: 1;
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const VenueCount = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-tertiary);
  white-space: nowrap;
`;

const UnusedCount = styled.span`
  margin-left: auto;
  padding: ${theme.space[1]} ${theme.space[2]};
  background: ${theme.colors.semantic.warning}20;
  color: ${theme.colors.semantic.warning};
  font-size: ${theme.fontSizes.bodySm};
  border-radius: ${theme.radius.full};
`;

const UnusedSongsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[2]};
`;

const UnusedSongItem = styled.div`
  padding: ${theme.space[2]} ${theme.space[3]};
  background: var(--color-bg-primary);
  border-radius: ${theme.radius.base};
`;

const MoreText = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-tertiary);
  text-align: center;
  padding: ${theme.space[2]};
`;

const EmptyState = styled.div`
  text-align: center;
  padding: ${theme.space[12]};
`;

const EmptyIcon = styled.div`
  font-size: ${theme.fontSizes.displayLg};
  color: var(--color-text-tertiary);
  margin-bottom: ${theme.space[4]};
  opacity: 0.5;
`;

const EmptyTitle = styled.h3`
  font-size: ${theme.fontSizes.h3};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin-bottom: ${theme.space[2]};
`;

const EmptyText = styled.p`
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-secondary);
  margin: 0;
`;
