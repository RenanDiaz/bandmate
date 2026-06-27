import type { FC } from "react";
import type { User } from "@supabase/supabase-js";
import type { Band } from "../services/bandsService";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Spinner, Container, ButtonGroup, Button } from "reactstrap";
import styled, { keyframes } from "styled-components";
import { theme } from "../theme";
import { getBandShows, deleteShow } from "../services/showsService";
import { getLocalToday, isToday } from "../lib/dateUtils";
import type { Show } from "../services/showsService";
import { NewShowForm } from "./NewShowForm";
import { ShowList } from "./ShowList";
import { ShowCalendar } from "./ShowCalendar";
import { EditShowModal } from "./EditShowModal";
import { CalendarSubscriptionModal } from "./CalendarSubscriptionModal";
import { SEO } from "./SEO";
import { ConfirmModal } from "./ConfirmModal";
import { useToast } from "../context/useToast";

type ConfirmState = { title: string; message: string; confirmLabel: string; action: () => Promise<void> };

interface Props {
  user: User | null;
  selectedBand: Band | null;
}

type FilterType = "all" | "upcoming" | "past";
type ViewMode = "list" | "calendar";

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

const ShowsView: FC<Props> = ({ user, selectedBand }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingShow, setEditingShow] = useState<Show | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [filter, setFilter] = useState<FilterType>("upcoming");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [isCalendarSubOpen, setIsCalendarSubOpen] = useState(false);
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

  const loadShows = async () => {
    if (!selectedBand) {
      setShows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await getBandShows(selectedBand.id);
      setShows(data);
    } catch (error) {
      console.error("Failed to load shows:", error);
      setShows([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user && selectedBand) {
      loadShows();
    } else {
      setShows([]);
      setLoading(false);
    }
  }, [user, selectedBand]);

  const handleEditShow = (show: Show) => {
    setEditingShow(show);
    setIsEditModalOpen(true);
  };

  const handleDeleteShow = async (show: Show) => {
    setConfirm({
      title: t("shows.deleteShow"),
      message: t("shows.confirmDelete", { name: show.name }),
      confirmLabel: t("common.delete"),
      action: async () => {
        try {
          await deleteShow(show.id);
          await loadShows();
        } catch (error) {
          console.error("Failed to delete show:", error);
          toast.error(t("shows.deleteError"));
        }
      },
    });
  };

  const todayShows = shows.filter(
    (s) => isToday(s.event_date) && s.status !== "completed" && s.status !== "cancelled"
  );

  const filteredShows = shows.filter((show) => {
    const today = getLocalToday();
    // Exclude shows already displayed in the "Happening Now" section
    if (isToday(show.event_date) && show.status !== "completed" && show.status !== "cancelled") {
      return false;
    }
    if (filter === "upcoming") {
      return show.event_date >= today && show.status !== "cancelled";
    }
    if (filter === "past") {
      return show.event_date < today || show.status === "completed";
    }
    return true;
  });

  const upcomingCount = shows.filter((s) => {
    const today = getLocalToday();
    return s.event_date >= today && s.status !== "cancelled";
  }).length;

  const pastCount = shows.filter((s) => {
    const today = getLocalToday();
    return s.event_date < today || s.status === "completed";
  }).length;

  if (!user) {
    return (
      <PageWrapper>
        <Container>
          <MessageCard>
            <MessageIcon>
              <i className="bi bi-lock"></i>
            </MessageIcon>
            <MessageTitle>{t("common.authRequired")}</MessageTitle>
            <MessageText>{t("shows.pleaseSignIn")}</MessageText>
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
              <i className="bi bi-calendar-event"></i>
            </MessageIcon>
            <MessageTitle>{t("bands.noBandSelected")}</MessageTitle>
            <MessageText>{t("shows.selectBand")}</MessageText>
          </MessageCard>
        </Container>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <SEO
        title={t("shows.title")}
        description={t("shows.subtitle")}
      />
      <Container>
        <PageHeader>
          <HeaderContent>
            <BandBadge>
              <i className="bi bi-music-note-beamed"></i>
              {selectedBand.name}
            </BandBadge>
            <PageTitle>{t("shows.title")}</PageTitle>
            <PageSubtitle>
              {t("shows.subtitle")}
            </PageSubtitle>
          </HeaderContent>
          <StatsCard>
            <StatItem>
              <StatValue>{upcomingCount}</StatValue>
              <StatLabel>{t("shows.upcoming")}</StatLabel>
            </StatItem>
            <StatDivider />
            {todayShows.length > 0 && (
              <>
                <StatItem>
                  <StatValue $highlight>{todayShows.length}</StatValue>
                  <StatLabel>{t("shows.todayCount")}</StatLabel>
                </StatItem>
                <StatDivider />
              </>
            )}
            <StatItem>
              <StatValue>{pastCount}</StatValue>
              <StatLabel>{t("shows.past")}</StatLabel>
            </StatItem>
          </StatsCard>
        </PageHeader>

        <ContentSection>
          <NewShowForm bandId={selectedBand.id} onShowCreated={loadShows} />

          {todayShows.length > 0 && (
            <HappeningNowSection>
              <HappeningNowHeader>
                <PulsingDot />
                <HappeningNowTitle>{t("shows.happeningNow")}</HappeningNowTitle>
              </HappeningNowHeader>
              {todayShows.map((show) => (
                <HappeningNowCard key={show.id} onClick={() => navigate(`/shows/${show.id}`)}>
                  <HappeningNowInfo>
                    <HappeningNowName>{show.name}</HappeningNowName>
                    <HappeningNowMeta>
                      {show.venue && (
                        <span><i className="bi bi-geo-alt" /> {show.venue}</span>
                      )}
                      {show.event_time && (
                        <span><i className="bi bi-clock" /> {formatTime(show.event_time)}</span>
                      )}
                    </HappeningNowMeta>
                  </HappeningNowInfo>
                  {show.setlist_id ? (
                    <PerformButton onClick={(e: React.MouseEvent) => { e.stopPropagation(); navigate(`/setlists/${show.setlist_id}/perform`); }}>
                      <i className="bi bi-play-circle-fill" /> {t("setlists.detail.startPerformance")}
                    </PerformButton>
                  ) : (
                    <ViewShowButton>
                      <i className="bi bi-arrow-right" /> {t("shows.viewShow")}
                    </ViewShowButton>
                  )}
                </HappeningNowCard>
              ))}
            </HappeningNowSection>
          )}

          <ControlsSection>
            <FilterSection>
              <FilterLabel>{t("common.filter")}:</FilterLabel>
              <ButtonGroup>
                <FilterButton
                  $active={filter === "upcoming"}
                  onClick={() => setFilter("upcoming")}
                >
                  {t("shows.upcoming")} ({upcomingCount})
                </FilterButton>
                <FilterButton
                  $active={filter === "past"}
                  onClick={() => setFilter("past")}
                >
                  {t("shows.past")} ({pastCount})
                </FilterButton>
                <FilterButton
                  $active={filter === "all"}
                  onClick={() => setFilter("all")}
                >
                  {t("common.all")} ({shows.length})
                </FilterButton>
              </ButtonGroup>
            </FilterSection>

            <RightControls>
              <SubscribeButton
                onClick={() => setIsCalendarSubOpen(true)}
                title={t("calendar.subscribeToCalendar")}
              >
                <i className="bi bi-calendar-plus"></i>
                <SubscribeButtonText>{t("calendar.subscribeToCalendar")}</SubscribeButtonText>
              </SubscribeButton>
              <ViewToggle>
                <ViewToggleButton
                  $active={viewMode === "list"}
                  onClick={() => setViewMode("list")}
                  title={t("shows.listView")}
                >
                  <i className="bi bi-list-ul"></i>
                </ViewToggleButton>
                <ViewToggleButton
                  $active={viewMode === "calendar"}
                  onClick={() => setViewMode("calendar")}
                  title={t("shows.calendarView")}
                >
                  <i className="bi bi-calendar3"></i>
                </ViewToggleButton>
              </ViewToggle>
            </RightControls>
          </ControlsSection>

          {loading ? (
            <LoadingContainer>
              <Spinner color="primary" style={{ width: "3rem", height: "3rem" }} />
              <LoadingText>{t("shows.loading")}</LoadingText>
            </LoadingContainer>
          ) : viewMode === "calendar" ? (
            <ShowCalendar shows={shows} onEdit={handleEditShow} />
          ) : filteredShows.length === 0 ? (
            <EmptyState>
              <EmptyIcon>
                <i className="bi bi-calendar-event"></i>
              </EmptyIcon>
              <EmptyTitle>
                {filter === "upcoming" ? t("shows.noUpcoming") : filter === "past" ? t("shows.noPast") : t("shows.noShows")}
              </EmptyTitle>
              <EmptyText>
                {filter === "upcoming"
                  ? t("shows.createFirst")
                  : filter === "past"
                  ? t("shows.completedShowsAppear")
                  : t("shows.createFirstAll")}
              </EmptyText>
            </EmptyState>
          ) : (
            <ShowList
              shows={filteredShows}
              onEdit={handleEditShow}
              onDelete={handleDeleteShow}
              onReload={loadShows}
            />
          )}
        </ContentSection>

        <EditShowModal
          show={editingShow}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onReload={loadShows}
          bandId={selectedBand.id}
        />

        <CalendarSubscriptionModal
          isOpen={isCalendarSubOpen}
          onClose={() => setIsCalendarSubOpen(false)}
          bandId={selectedBand.id}
          bandName={selectedBand.name}
        />

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
  display: flex;
  gap: ${theme.space[6]};

  @media (max-width: ${theme.breakpoints.md}) {
    width: 100%;
    justify-content: center;
  }
`;

const StatItem = styled.div`
  text-align: center;
`;

const StatValue = styled.div<{ $highlight?: boolean }>`
  font-size: ${theme.fontSizes.displayMd};
  font-weight: ${theme.fontWeights.bold};
  color: ${(props) => props.$highlight ? theme.colors.semantic.success : theme.colors.brand.primary};
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

const StatDivider = styled.div`
  width: 1px;
  background: var(--color-border);
`;

const ContentSection = styled.div`
  max-width: 1200px;
  margin: 0 auto;
`;

const ControlsSection = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${theme.space[4]};
  margin-top: ${theme.space[6]};
  margin-bottom: ${theme.space[4]};
  flex-wrap: wrap;

  @media (max-width: ${theme.breakpoints.sm}) {
    flex-direction: column;
    align-items: flex-start;
  }
`;

const FilterSection = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
`;

const RightControls = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
`;

const SubscribeButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  padding: ${theme.space[2]} ${theme.space[3]};
  background: ${theme.colors.brand.primary}20;
  border: 1px solid ${theme.colors.brand.primary}40;
  border-radius: ${theme.radius.base};
  color: ${theme.colors.brand.primary};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  white-space: nowrap;

  &:hover {
    background: ${theme.colors.brand.primary}30;
    border-color: ${theme.colors.brand.primary};
  }
`;

const SubscribeButtonText = styled.span`
  @media (max-width: ${theme.breakpoints.md}) {
    display: none;
  }
`;

const ViewToggle = styled.div`
  display: flex;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.base};
  overflow: hidden;
`;

const ViewToggleButton = styled.button<{ $active: boolean }>`
  background: ${(props) =>
    props.$active ? theme.colors.brand.primary : "transparent"};
  border: none;
  color: ${(props) =>
    props.$active ? "white" : 'var(--color-text-secondary)'};
  padding: ${theme.space[2]} ${theme.space[3]};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  display: flex;
  align-items: center;
  justify-content: center;

  i {
    font-size: ${theme.fontSizes.bodyLg};
  }

  &:hover {
    background: ${(props) =>
      props.$active ? theme.colors.brand.primaryHover : 'var(--color-bg-tertiary)'};
    color: ${(props) =>
      props.$active ? "white" : theme.colors.brand.primary};
  }
`;

const FilterLabel = styled.span`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
  font-weight: ${theme.fontWeights.medium};
`;

const FilterButton = styled(Button)<{ $active: boolean }>`
  background: ${(props) =>
    props.$active ? theme.colors.brand.primary : "transparent"} !important;
  border-color: ${(props) =>
    props.$active ? theme.colors.brand.primary : 'var(--color-border)'} !important;
  color: ${(props) =>
    props.$active ? "white" : 'var(--color-text-secondary)'} !important;
  font-size: ${theme.fontSizes.bodySm} !important;
  font-weight: ${theme.fontWeights.medium} !important;
  padding: ${theme.space[2]} ${theme.space[4]} !important;

  &:hover {
    background: ${(props) =>
      props.$active ? theme.colors.brand.primaryHover : 'var(--color-bg-tertiary)'} !important;
    border-color: ${theme.colors.brand.primary} !important;
    color: ${(props) =>
      props.$active ? "white" : theme.colors.brand.primary} !important;
  }
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

// Happening Now section

const pulse = keyframes`
  0% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.4); }
  100% { opacity: 1; transform: scale(1); }
`;

const HappeningNowSection = styled.div`
  margin-top: ${theme.space[6]};
  background: ${theme.colors.semantic.success}10;
  border: 1px solid ${theme.colors.semantic.success}40;
  border-radius: ${theme.radius.lg};
  padding: ${theme.space[5]};
`;

const HappeningNowHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  margin-bottom: ${theme.space[4]};
`;

const PulsingDot = styled.div`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${theme.colors.semantic.success};
  animation: ${pulse} 2s ease-in-out infinite;
`;

const HappeningNowTitle = styled.h3`
  font-size: ${theme.fontSizes.bodyLg};
  font-weight: ${theme.fontWeights.bold};
  color: ${theme.colors.semantic.success};
  margin: 0;
`;

const HappeningNowCard = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${theme.space[4]};
  background: var(--color-bg-secondary);
  border: 1px solid ${theme.colors.semantic.success}30;
  border-left: 3px solid ${theme.colors.semantic.success};
  border-radius: ${theme.radius.base};
  padding: ${theme.space[4]} ${theme.space[5]};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  &:hover {
    background: var(--color-bg-tertiary);
    border-color: ${theme.colors.semantic.success}60;
  }

  & + & {
    margin-top: ${theme.space[3]};
  }

  @media (max-width: ${theme.breakpoints.sm}) {
    flex-direction: column;
    align-items: flex-start;
  }
`;

const HappeningNowInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const HappeningNowName = styled.div`
  font-size: ${theme.fontSizes.bodyLg};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin-bottom: ${theme.space[1]};
`;

const HappeningNowMeta = styled.div`
  display: flex;
  gap: ${theme.space[4]};
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);

  i {
    margin-right: ${theme.space[1]};
  }
`;

const PerformButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[2]};
  background: ${theme.colors.semantic.success};
  color: white;
  border: none;
  border-radius: ${theme.radius.base};
  padding: ${theme.space[2]} ${theme.space[4]};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  white-space: nowrap;

  &:hover {
    opacity: 0.9;
    transform: scale(1.02);
  }
`;

const ViewShowButton = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[2]};
  color: var(--color-text-secondary);
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  white-space: nowrap;
`;

export default ShowsView;
