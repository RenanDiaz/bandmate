import type { FC } from "react";
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Container, Spinner } from "reactstrap";
import styled from "styled-components";
import { theme } from "../theme";
import type { Band } from "../services/bandsService";
import { getMyBands } from "../services/bandsService";
import { BandMembers } from "./BandMembers";
import { InviteMemberModal } from "./InviteMemberModal";

interface Props {
  user: { id: string; email?: string } | null;
}

export const BandSettings: FC<Props> = ({ user }) => {
  const { bandId } = useParams<{ bandId: string }>();
  const navigate = useNavigate();

  const [band, setBand] = useState<Band | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"members" | "details">("members");

  useEffect(() => {
    loadBand();
  }, [bandId]);

  const loadBand = async () => {
    if (!bandId) {
      navigate("/");
      return;
    }

    setLoading(true);
    try {
      const bands = await getMyBands();
      const foundBand = bands.find((b) => b.id === parseInt(bandId));

      if (!foundBand) {
        alert("Band not found or you don't have access");
        navigate("/");
        return;
      }

      setBand(foundBand);
    } catch (error) {
      console.error("Failed to load band:", error);
      alert("Failed to load band");
      navigate("/");
    }
    setLoading(false);
  };

  const handleMemberChange = () => {
    loadBand();
  };

  if (loading) {
    return (
      <PageWrapper>
        <Container>
          <LoadingContainer>
            <Spinner color="primary" style={{ width: "3rem", height: "3rem" }} />
            <LoadingText>Loading band settings...</LoadingText>
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
            <MessageTitle>Access Denied</MessageTitle>
            <MessageText>You don't have permission to view this band's settings.</MessageText>
          </MessageCard>
        </Container>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <Container>
        <Header>
          <HeaderLeft>
            <BackButton onClick={() => navigate("/")}>
              <i className="bi bi-arrow-left"></i>
            </BackButton>
            <HeaderInfo>
              <BandName>{band.name}</BandName>
              <BreadcrumbText>Band Settings</BreadcrumbText>
            </HeaderInfo>
          </HeaderLeft>
        </Header>

        <TabsContainer>
          <Tab $active={activeTab === "members"} onClick={() => setActiveTab("members")}>
            <i className="bi bi-people"></i>
            Members
          </Tab>
          <Tab $active={activeTab === "details"} onClick={() => setActiveTab("details")}>
            <i className="bi bi-gear"></i>
            Details
          </Tab>
        </TabsContainer>

        <ContentArea>
          {activeTab === "members" && (
            <BandMembers
              band={band}
              currentUserId={user.id}
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
  background: ${theme.colors.dark.bg.primary};
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
  background: ${theme.colors.dark.bg.secondary};
  border: 1px solid ${theme.colors.dark.border.default};
  color: ${theme.colors.dark.text.primary};
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
    background: ${theme.colors.dark.bg.elevated};
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
  color: ${theme.colors.dark.text.primary};
  margin: 0;
  line-height: ${theme.lineHeights.tight};
`;

const BreadcrumbText = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.dark.text.secondary};
`;

const TabsContainer = styled.div`
  display: flex;
  gap: ${theme.space[2]};
  margin-bottom: ${theme.space[6]};
  border-bottom: 1px solid ${theme.colors.dark.border.default};
`;

const Tab = styled.button<{ $active: boolean }>`
  background: transparent;
  border: none;
  border-bottom: 2px solid ${(props) =>
    props.$active ? theme.colors.brand.primary : "transparent"};
  color: ${(props) =>
    props.$active ? theme.colors.brand.primary : theme.colors.dark.text.secondary};
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
  background: ${theme.colors.dark.bg.secondary};
  border: 1px solid ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.lg};
  padding: ${theme.space[12]};
  text-align: center;
`;

const PlaceholderIcon = styled.div`
  font-size: ${theme.fontSizes.displayLg};
  color: ${theme.colors.dark.text.tertiary};
  margin-bottom: ${theme.space[4]};
  opacity: 0.5;

  i {
    font-size: inherit;
  }
`;

const PlaceholderTitle = styled.h3`
  font-size: ${theme.fontSizes.h3};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.dark.text.primary};
  margin-bottom: ${theme.space[2]};
`;

const PlaceholderText = styled.p`
  font-size: ${theme.fontSizes.body};
  color: ${theme.colors.dark.text.secondary};
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
  color: ${theme.colors.dark.text.secondary};
  margin: 0;
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
