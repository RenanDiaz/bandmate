import { Container } from "reactstrap";
import styled from "styled-components";
import { theme } from "../theme";
import { Logo } from "./Logo";
import { useBandContext } from "../context/useBandContext";
import { Link } from "react-router-dom";
import { PendingInvitations } from "./PendingInvitations";

const Home = () => {
  const { user, refreshBands } = useBandContext();

  return (
    <HomeWrapper>
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
              Welcome to <BrandName>Bandmate</BrandName>
            </HeroTitle>

            <HeroSubtitle>
              Your all-in-one platform to manage songs, setlists, shows, and collaborate with your
              band members
            </HeroSubtitle>

            {!user && (
              <CTASection>
                <CTAText>Get started by creating your free account</CTAText>
                <CTAButton as={Link} to="/login">
                  <i className="bi bi-box-arrow-in-right"></i>
                  Sign in to continue
                </CTAButton>
              </CTASection>
            )}

            {user && (
              <CTASection>
                <CTAButton as={Link} to="/songs">
                  <i className="bi bi-music-note-list"></i>
                  Go to your songs
                </CTAButton>
              </CTASection>
            )}
          </HeroContent>
        </Container>
      </HeroSection>

      <FeaturesSection>
        <Container>
          <SectionTitle>Everything your band needs</SectionTitle>

          <FeaturesGrid>
            <FeatureCard as={user ? Link : "div"} to={user ? "/songs" : undefined} $clickable={!!user}>
              <FeatureIcon>
                <i className="bi bi-music-note-list"></i>
              </FeatureIcon>
              <FeatureTitle>Song Library</FeatureTitle>
              <FeatureDescription>
                Store and organize all your songs with lyrics, chords, and automatic metadata from Spotify
              </FeatureDescription>
            </FeatureCard>

            <FeatureCard $clickable={false}>
              <FeatureIcon>
                <i className="bi bi-people"></i>
              </FeatureIcon>
              <FeatureTitle>Band Management</FeatureTitle>
              <FeatureDescription>
                Create multiple bands, invite members, and manage permissions with role-based access
              </FeatureDescription>
            </FeatureCard>

            <FeatureCard as={user ? Link : "div"} to={user ? "/setlists" : undefined} $clickable={!!user}>
              <FeatureIcon>
                <i className="bi bi-list-ul"></i>
              </FeatureIcon>
              <FeatureTitle>Setlists</FeatureTitle>
              <FeatureDescription>
                Build setlists with drag-and-drop, add notes, and launch performance mode for shows
              </FeatureDescription>
            </FeatureCard>

            <FeatureCard $clickable={false}>
              <FeatureIcon>
                <i className="bi bi-play-circle"></i>
              </FeatureIcon>
              <FeatureTitle>Performance Mode</FeatureTitle>
              <FeatureDescription>
                Full-screen performance view with lyrics/chords toggle, keyboard navigation, and song notes
              </FeatureDescription>
            </FeatureCard>

            <FeatureCard $clickable={false}>
              <FeatureIcon>
                <i className="bi bi-music-note-beamed"></i>
              </FeatureIcon>
              <FeatureTitle>Music Intelligence</FeatureTitle>
              <FeatureDescription>
                Automatic song metadata, key detection, tempo, and lyrics from multiple music databases
              </FeatureDescription>
            </FeatureCard>

            <FeatureCard $clickable={false}>
              <FeatureIcon>
                <i className="bi bi-phone"></i>
              </FeatureIcon>
              <FeatureTitle>Mobile Ready</FeatureTitle>
              <FeatureDescription>
                Responsive design works perfectly on phones, tablets, and desktop devices
              </FeatureDescription>
            </FeatureCard>
          </FeaturesGrid>
        </Container>
      </FeaturesSection>

      <CTASectionBottom>
        <Container>
          <CTAContent>
            <CTABottomTitle>Ready to get organized?</CTABottomTitle>
            <CTABottomSubtitle>
              Join musicians who are already using Bandmate to stay on top of their music
            </CTABottomSubtitle>
            {!user && (
              <CTAButton as={Link} to="/login">
                <i className="bi bi-box-arrow-in-right"></i>
                Get started for free
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

const ComingSoonBadge = styled.span`
  display: inline-block;
  background: ${theme.colors.brand.primary};
  color: white;
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.semibold};
  padding: ${theme.space[1]} ${theme.space[2]};
  border-radius: ${theme.radius.base};
  margin-top: ${theme.space[3]};
  text-transform: uppercase;
  letter-spacing: ${theme.letterSpacing.wide};
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

export default Home;
