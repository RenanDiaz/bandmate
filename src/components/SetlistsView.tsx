import type { FC } from "react";
import type { User } from "@supabase/supabase-js";
import type { Band } from "../services/bandsService";
import { useEffect, useState } from "react";
import { Spinner, Container } from "reactstrap";
import styled from "styled-components";
import { theme } from "../theme";
import { getBandSetlists, deleteSetlist } from "../services/setlistsService";
import type { Setlist } from "../services/setlistsService";
import { NewSetlistForm } from "./NewSetlistForm";
import { SetlistList } from "./SetlistList";
import { SEO } from "./SEO";

interface Props {
  user: User | null;
  selectedBand: Band | null;
}

const SetlistsView: FC<Props> = ({ user, selectedBand }) => {
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSetlists = async () => {
    if (!selectedBand) {
      setSetlists([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await getBandSetlists(selectedBand.id);
      setSetlists(data);
    } catch (error) {
      console.error("Failed to load setlists:", error);
      setSetlists([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user && selectedBand) {
      loadSetlists();
    } else {
      setSetlists([]);
      setLoading(false);
    }
  }, [user, selectedBand]);

  const handleDeleteSetlist = async (setlist: Setlist) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${setlist.name}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await deleteSetlist(setlist.id);
      await loadSetlists();
    } catch (error) {
      console.error("Failed to delete setlist:", error);
      alert("Failed to delete setlist. Please try again.");
    }
  };

  if (!user) {
    return (
      <PageWrapper>
        <Container>
          <MessageCard>
            <MessageIcon>
              <i className="bi bi-lock"></i>
            </MessageIcon>
            <MessageTitle>Authentication Required</MessageTitle>
            <MessageText>Please sign in to view and manage your setlists</MessageText>
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
              <i className="bi bi-music-note-list"></i>
            </MessageIcon>
            <MessageTitle>No Band Selected</MessageTitle>
            <MessageText>Please select a band to view and manage setlists</MessageText>
          </MessageCard>
        </Container>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <SEO
        title="Setlists"
        description="Create and manage setlists for performances and rehearsals. Organize songs with drag-and-drop, add notes, and link setlists to shows."
      />
      <Container>
        <PageHeader>
          <HeaderContent>
            <BandBadge>
              <i className="bi bi-music-note-beamed"></i>
              {selectedBand.name}
            </BandBadge>
            <PageTitle>Setlists</PageTitle>
            <PageSubtitle>
              Organize your songs for performances and practice sessions
            </PageSubtitle>
          </HeaderContent>
          <StatsCard>
            <StatItem>
              <StatValue>{setlists.length}</StatValue>
              <StatLabel>Setlists</StatLabel>
            </StatItem>
          </StatsCard>
        </PageHeader>

        <ContentSection>
          <NewSetlistForm bandId={selectedBand.id} onSetlistCreated={loadSetlists} />

          {loading ? (
            <LoadingContainer>
              <Spinner color="primary" style={{ width: "3rem", height: "3rem" }} />
              <LoadingText>Loading setlists...</LoadingText>
            </LoadingContainer>
          ) : setlists.length === 0 ? (
            <EmptyState>
              <EmptyIcon>
                <i className="bi bi-music-note-list"></i>
              </EmptyIcon>
              <EmptyTitle>No setlists yet</EmptyTitle>
              <EmptyText>
                Create your first setlist above to organize songs for your next performance
              </EmptyText>
            </EmptyState>
          ) : (
            <SetlistList
              setlists={setlists}
              onDelete={handleDeleteSetlist}
            />
          )}
        </ContentSection>
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
  border-bottom: 1px solid ${theme.colors.dark.border.default};

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
  color: ${theme.colors.dark.text.primary};
  margin-bottom: ${theme.space[2]};
  line-height: ${theme.lineHeights.tight};

  @media (max-width: ${theme.breakpoints.md}) {
    font-size: ${theme.fontSizes.h1};
  }
`;

const PageSubtitle = styled.p`
  font-size: ${theme.fontSizes.body};
  color: ${theme.colors.dark.text.secondary};
  margin: 0;
  line-height: ${theme.lineHeights.relaxed};
`;

const StatsCard = styled.div`
  background: ${theme.colors.dark.bg.secondary};
  border: 1px solid ${theme.colors.dark.border.default};
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
  color: ${theme.colors.dark.text.secondary};
  text-transform: uppercase;
  letter-spacing: ${theme.letterSpacing.wide};
  font-weight: ${theme.fontWeights.medium};
`;

const ContentSection = styled.div`
  max-width: 1200px;
  margin: 0 auto;
`;

const MessageCard = styled.div`
  background: ${theme.colors.dark.bg.secondary};
  border: 1px solid ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.lg};
  padding: ${theme.space[12]};
  text-align: center;
  margin-top: ${theme.space[12]};
`;

const MessageIcon = styled.div`
  font-size: ${theme.fontSizes.displayLg};
  color: ${theme.colors.dark.text.tertiary};
  margin-bottom: ${theme.space[4]};
  opacity: 0.5;
`;

const MessageTitle = styled.h2`
  font-size: ${theme.fontSizes.h2};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.dark.text.primary};
  margin-bottom: ${theme.space[2]};
`;

const MessageText = styled.p`
  font-size: ${theme.fontSizes.body};
  color: ${theme.colors.dark.text.secondary};
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
  color: ${theme.colors.dark.text.secondary};
  margin: 0;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: ${theme.space[12]} ${theme.space[6]};
  background: ${theme.colors.dark.bg.secondary};
  border: 1px dashed ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.lg};
  margin-top: ${theme.space[6]};
`;

const EmptyIcon = styled.div`
  font-size: ${theme.fontSizes.displayLg};
  color: ${theme.colors.dark.text.tertiary};
  margin-bottom: ${theme.space[4]};
  opacity: 0.5;
`;

const EmptyTitle = styled.h3`
  font-size: ${theme.fontSizes.h2};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.dark.text.primary};
  margin-bottom: ${theme.space[2]};
`;

const EmptyText = styled.p`
  font-size: ${theme.fontSizes.body};
  color: ${theme.colors.dark.text.secondary};
  margin: 0;
  line-height: ${theme.lineHeights.relaxed};
`;

export default SetlistsView;
