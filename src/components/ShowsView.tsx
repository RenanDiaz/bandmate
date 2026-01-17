import type { FC } from "react";
import type { User } from "@supabase/supabase-js";
import type { Band } from "../services/bandsService";
import { useEffect, useState } from "react";
import { Spinner, Container, ButtonGroup, Button } from "reactstrap";
import styled from "styled-components";
import { theme } from "../theme";
import { getBandShows, deleteShow } from "../services/showsService";
import type { Show } from "../services/showsService";
import { NewShowForm } from "./NewShowForm";
import { ShowList } from "./ShowList";
import { ShowCalendar } from "./ShowCalendar";
import { EditShowModal } from "./EditShowModal";
import { SEO } from "./SEO";

interface Props {
  user: User | null;
  selectedBand: Band | null;
}

type FilterType = "all" | "upcoming" | "past";
type ViewMode = "list" | "calendar";

const ShowsView: FC<Props> = ({ user, selectedBand }) => {
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingShow, setEditingShow] = useState<Show | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [filter, setFilter] = useState<FilterType>("upcoming");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

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
    const confirmed = window.confirm(
      `Are you sure you want to delete "${show.name}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await deleteShow(show.id);
      await loadShows();
    } catch (error) {
      console.error("Failed to delete show:", error);
      alert("Failed to delete show. Please try again.");
    }
  };

  const filteredShows = shows.filter((show) => {
    const today = new Date().toISOString().split("T")[0];
    if (filter === "upcoming") {
      return show.event_date >= today && show.status !== "cancelled";
    }
    if (filter === "past") {
      return show.event_date < today || show.status === "completed";
    }
    return true;
  });

  const upcomingCount = shows.filter((s) => {
    const today = new Date().toISOString().split("T")[0];
    return s.event_date >= today && s.status !== "cancelled";
  }).length;

  const pastCount = shows.filter((s) => {
    const today = new Date().toISOString().split("T")[0];
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
            <MessageTitle>Authentication Required</MessageTitle>
            <MessageText>Please sign in to view and manage your shows</MessageText>
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
            <MessageTitle>No Band Selected</MessageTitle>
            <MessageText>Please select a band to view and manage shows</MessageText>
          </MessageCard>
        </Container>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <SEO
        title="Shows"
        description="Schedule and manage your band's gigs and performances. Track upcoming shows, venue information, and link setlists to each performance."
      />
      <Container>
        <PageHeader>
          <HeaderContent>
            <BandBadge>
              <i className="bi bi-music-note-beamed"></i>
              {selectedBand.name}
            </BandBadge>
            <PageTitle>Shows</PageTitle>
            <PageSubtitle>
              Schedule and manage your upcoming gigs and performances
            </PageSubtitle>
          </HeaderContent>
          <StatsCard>
            <StatItem>
              <StatValue>{upcomingCount}</StatValue>
              <StatLabel>Upcoming</StatLabel>
            </StatItem>
            <StatDivider />
            <StatItem>
              <StatValue>{pastCount}</StatValue>
              <StatLabel>Past</StatLabel>
            </StatItem>
          </StatsCard>
        </PageHeader>

        <ContentSection>
          <NewShowForm bandId={selectedBand.id} onShowCreated={loadShows} />

          <ControlsSection>
            <FilterSection>
              <FilterLabel>Filter:</FilterLabel>
              <ButtonGroup>
                <FilterButton
                  $active={filter === "upcoming"}
                  onClick={() => setFilter("upcoming")}
                >
                  Upcoming ({upcomingCount})
                </FilterButton>
                <FilterButton
                  $active={filter === "past"}
                  onClick={() => setFilter("past")}
                >
                  Past ({pastCount})
                </FilterButton>
                <FilterButton
                  $active={filter === "all"}
                  onClick={() => setFilter("all")}
                >
                  All ({shows.length})
                </FilterButton>
              </ButtonGroup>
            </FilterSection>

            <ViewToggle>
              <ViewToggleButton
                $active={viewMode === "list"}
                onClick={() => setViewMode("list")}
                title="List view"
              >
                <i className="bi bi-list-ul"></i>
              </ViewToggleButton>
              <ViewToggleButton
                $active={viewMode === "calendar"}
                onClick={() => setViewMode("calendar")}
                title="Calendar view"
              >
                <i className="bi bi-calendar3"></i>
              </ViewToggleButton>
            </ViewToggle>
          </ControlsSection>

          {loading ? (
            <LoadingContainer>
              <Spinner color="primary" style={{ width: "3rem", height: "3rem" }} />
              <LoadingText>Loading shows...</LoadingText>
            </LoadingContainer>
          ) : viewMode === "calendar" ? (
            <ShowCalendar shows={shows} onEdit={handleEditShow} />
          ) : filteredShows.length === 0 ? (
            <EmptyState>
              <EmptyIcon>
                <i className="bi bi-calendar-event"></i>
              </EmptyIcon>
              <EmptyTitle>
                {filter === "upcoming" ? "No upcoming shows" : filter === "past" ? "No past shows" : "No shows yet"}
              </EmptyTitle>
              <EmptyText>
                {filter === "upcoming"
                  ? "Create your first show above to start scheduling performances"
                  : filter === "past"
                  ? "Your completed shows will appear here"
                  : "Create your first show above to get started"}
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

export default ShowsView;
