import type { FC } from "react";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import { Container, Spinner } from "reactstrap";
import styled from "styled-components";
import { theme } from "../theme";
import type { Band } from "../services/bandsService";
import { getMyBands } from "../services/bandsService";
import { BandMembers } from "./BandMembers";
import { BandReports } from "./BandReports";
import { InviteMemberModal } from "./InviteMemberModal";
import { SEO } from "./SEO";

interface Props {
  user: { id: string; email?: string } | null;
}

export const BandSettings: FC<Props> = ({ user }) => {
  const { t } = useTranslation();
  const { bandId } = useParams<{ bandId: string }>();
  const navigate = useNavigate();

  const [band, setBand] = useState<Band | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"members" | "details" | "reports">("members");
  // Bumped on member/invitation changes so child lists refresh without
  // remounting the page (which would tear down the open invite modal).
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    loadBand();
  }, [bandId]);

  const loadBand = async (showSpinner = true) => {
    if (!bandId) {
      navigate("/");
      return;
    }

    if (showSpinner) setLoading(true);
    try {
      const bands = await getMyBands();
      const foundBand = bands.find((b) => b.id === parseInt(bandId));

      if (!foundBand) {
        alert(t('bands.notFoundOrNoAccess'));
        navigate("/");
        return;
      }

      setBand(foundBand);
    } catch (error) {
      console.error("Failed to load band:", error);
      alert(t('bands.loadError'));
      navigate("/");
    }
    if (showSpinner) setLoading(false);
  };

  const handleMemberChange = () => {
    // Refresh quietly: keep the full-page spinner (and the invite modal) out
    // of it so the modal's success feedback survives.
    setRefreshKey((key) => key + 1);
    loadBand(false);
  };

  if (loading) {
    return (
      <PageWrapper>
        <Container>
          <LoadingContainer>
            <Spinner color="primary" style={{ width: "3rem", height: "3rem" }} />
            <LoadingText>{t('bands.loadingSettings')}</LoadingText>
          </LoadingContainer>
        </Container>
      </PageWrapper>
    );
  }

  if (!band || !user) {
    return (
      <PageWrapper>
        <Container>
          <MessageCard>
            <MessageIcon>
              <i className="bi bi-exclamation-triangle"></i>
            </MessageIcon>
            <MessageTitle>{t('bands.accessDenied')}</MessageTitle>
            <MessageText>{t('bands.noPermission')}</MessageText>
          </MessageCard>
        </Container>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <SEO
        title={`${band.name} Settings`}
        description={`Manage settings, members, and permissions for ${band.name}. Invite new members and configure band details.`}
      />
      <Container>
        <Header>
          <HeaderLeft>
            <BackButton onClick={() => navigate("/")}>
              <i className="bi bi-arrow-left"></i>
            </BackButton>
            <HeaderInfo>
              <BandName>{band.name}</BandName>
              <BreadcrumbText>{t('bands.settings')}</BreadcrumbText>
            </HeaderInfo>
          </HeaderLeft>
        </Header>

        <TabsContainer>
          <Tab $active={activeTab === "members"} onClick={() => setActiveTab("members")}>
            <i className="bi bi-people"></i>
            {t('bands.members')}
          </Tab>
          <Tab $active={activeTab === "details"} onClick={() => setActiveTab("details")}>
            <i className="bi bi-gear"></i>
            {t('settings.title')}
          </Tab>
          <Tab $active={activeTab === "reports"} onClick={() => setActiveTab("reports")}>
            <i className="bi bi-bar-chart-line"></i>
            {t('reports.title')}
          </Tab>
        </TabsContainer>

        <ContentArea>
          {activeTab === "members" && (
            <BandMembers
              band={band}
              currentUserId={user.id}
              refreshKey={refreshKey}
              onMemberChange={handleMemberChange}
              onInviteClick={() => setIsInviteModalOpen(true)}
            />
          )}

          {activeTab === "details" && (
            <DetailsPlaceholder>
              <PlaceholderIcon>
                <i className="bi bi-gear"></i>
              </PlaceholderIcon>
              <PlaceholderTitle>Band Details</PlaceholderTitle>
              <PlaceholderText>
                Band details management coming soon. Use the band selector to edit basic info.
              </PlaceholderText>
            </DetailsPlaceholder>
          )}

          {activeTab === "reports" && (
            <BandReports band={band} />
          )}
        </ContentArea>

        <InviteMemberModal
          bandId={band.id}
          bandName={band.name}
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          onSuccess={handleMemberChange}
        />
      </Container>
    </PageWrapper>
  );
};

// Styled Components

const PageWrapper = styled.div`
  min-height: calc(100vh - 80px);
  background: var(--color-bg-primary);
  padding: ${theme.space[6]} 0;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${theme.space[6]};
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[4]};
`;

const BackButton = styled.button`
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
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
    background: var(--color-bg-elevated);
    border-color: ${theme.colors.brand.primary};
    color: ${theme.colors.brand.primary};
    transform: translateY(-1px);
  }
`;

const HeaderInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[1]};
`;

const BandName = styled.h1`
  font-size: ${theme.fontSizes.h2};
  font-weight: ${theme.fontWeights.bold};
  color: var(--color-text-primary);
  margin: 0;
  line-height: ${theme.lineHeights.tight};
`;

const BreadcrumbText = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
`;

const TabsContainer = styled.div`
  display: flex;
  gap: ${theme.space[2]};
  margin-bottom: ${theme.space[6]};
  border-bottom: 1px solid var(--color-border);
`;

const Tab = styled.button<{ $active: boolean }>`
  background: transparent;
  border: none;
  border-bottom: 2px solid ${(props) =>
    props.$active ? theme.colors.brand.primary : "transparent"};
  color: ${(props) =>
    props.$active ? theme.colors.brand.primary : 'var(--color-text-secondary)'};
  padding: ${theme.space[3]} ${theme.space[5]};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  margin-bottom: -1px;

  i {
    font-size: ${theme.fontSizes.bodyLg};
  }

  &:hover {
    color: ${theme.colors.brand.primary};
  }
`;

const ContentArea = styled.div`
  margin-bottom: ${theme.space[8]};
`;

const DetailsPlaceholder = styled.div`
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.lg};
  padding: ${theme.space[12]};
  text-align: center;
`;

const PlaceholderIcon = styled.div`
  font-size: ${theme.fontSizes.displayLg};
  color: var(--color-text-tertiary);
  margin-bottom: ${theme.space[4]};
  opacity: 0.5;

  i {
    font-size: inherit;
  }
`;

const PlaceholderTitle = styled.h3`
  font-size: ${theme.fontSizes.h3};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin-bottom: ${theme.space[2]};
`;

const PlaceholderText = styled.p`
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-secondary);
  margin: 0;
  max-width: 500px;
  margin: 0 auto;
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
