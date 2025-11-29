import { Container } from "reactstrap";
import styled from "styled-components";
import { theme } from "../theme";
import { Logo } from "./Logo";
import { SEO } from "./SEO";

const About = () => (
  <PageWrapper>
    <SEO
      title="About"
      description="Learn about Bandmate - a comprehensive platform for bands to manage songs, setlists, shows, and collaborate with members. Built for musicians by musicians."
    />
    <Container>
      <AboutHeader>
        <Logo size={64} variant="icon" theme="dark" />
        <Title>About Bandmate</Title>
      </AboutHeader>

      <ContentSection>
        <Card>
          <CardTitle>What is Bandmate?</CardTitle>
          <CardText>
            Bandmate is a comprehensive web application designed to help bands manage their
            songs, setlists, shows, and members in one centralized platform. Built with modern
            web technologies, it helps musicians stay organized and collaborate efficiently.
          </CardText>
        </Card>

        <Card>
          <CardTitle>Current Features</CardTitle>
          <FeatureList>
            <FeatureItem>
              <FeatureIcon>
                <i className="bi bi-check-circle-fill"></i>
              </FeatureIcon>
              <FeatureText>
                <strong>OAuth Authentication</strong> - Secure sign-in with GitHub or Google accounts
              </FeatureText>
            </FeatureItem>
            <FeatureItem>
              <FeatureIcon>
                <i className="bi bi-check-circle-fill"></i>
              </FeatureIcon>
              <FeatureText>
                <strong>Band Management</strong> - Create and manage multiple bands with different members
              </FeatureText>
            </FeatureItem>
            <FeatureItem>
              <FeatureIcon>
                <i className="bi bi-check-circle-fill"></i>
              </FeatureIcon>
              <FeatureText>
                <strong>Member Roles & Invitations</strong> - Invite members and guests with role-based permissions
              </FeatureText>
            </FeatureItem>
            <FeatureItem>
              <FeatureIcon>
                <i className="bi bi-check-circle-fill"></i>
              </FeatureIcon>
              <FeatureText>
                <strong>Song Library</strong> - Store songs with titles, artists, lyrics, and chords
              </FeatureText>
            </FeatureItem>
            <FeatureItem>
              <FeatureIcon>
                <i className="bi bi-check-circle-fill"></i>
              </FeatureIcon>
              <FeatureText>
                <strong>Setlist Management</strong> - Create, edit, and perform setlists with full-screen view
              </FeatureText>
            </FeatureItem>
            <FeatureItem>
              <FeatureIcon>
                <i className="bi bi-check-circle-fill"></i>
              </FeatureIcon>
              <FeatureText>
                <strong>Guest Access</strong> - Time-limited access for temporary members and substitutes
              </FeatureText>
            </FeatureItem>
            <FeatureItem>
              <FeatureIcon>
                <i className="bi bi-check-circle-fill"></i>
              </FeatureIcon>
              <FeatureText>
                <strong>Dark & Light Themes</strong> - Toggle between themes for comfortable viewing
              </FeatureText>
            </FeatureItem>
          </FeatureList>
        </Card>

        <Card>
          <CardTitle>Coming Soon</CardTitle>
          <FeatureList>
            <FeatureItem>
              <FeatureIcon $coming>
                <i className="bi bi-clock"></i>
              </FeatureIcon>
              <FeatureText>
                <strong>Show Scheduling</strong> - Track gigs, venues, and performance history
              </FeatureText>
            </FeatureItem>
            <FeatureItem>
              <FeatureIcon $coming>
                <i className="bi bi-clock"></i>
              </FeatureIcon>
              <FeatureText>
                <strong>Email Notifications</strong> - Automatic email alerts for invitations and updates
              </FeatureText>
            </FeatureItem>
            <FeatureItem>
              <FeatureIcon $coming>
                <i className="bi bi-clock"></i>
              </FeatureIcon>
              <FeatureText>
                <strong>File Attachments</strong> - Upload PDFs, images, and audio files to songs
              </FeatureText>
            </FeatureItem>
            <FeatureItem>
              <FeatureIcon $coming>
                <i className="bi bi-clock"></i>
              </FeatureIcon>
              <FeatureText>
                <strong>Advanced Search</strong> - Filter and search songs by key, tempo, and more
              </FeatureText>
            </FeatureItem>
          </FeatureList>
        </Card>

        <Card>
          <CardTitle>Technology Stack</CardTitle>
          <TechGrid>
            <TechItem>React 19</TechItem>
            <TechItem>TypeScript</TechItem>
            <TechItem>Vite 6</TechItem>
            <TechItem>Supabase</TechItem>
            <TechItem>Styled Components</TechItem>
            <TechItem>React Router v7</TechItem>
          </TechGrid>
        </Card>

        <FooterCard>
          <FooterText>
            Bandmate is in active development. We're constantly adding new features and
            improvements to help musicians collaborate better.
          </FooterText>
        </FooterCard>
      </ContentSection>
    </Container>
  </PageWrapper>
);

// Styled Components

const PageWrapper = styled.div`
  min-height: calc(100vh - 80px);
  background: ${theme.colors.dark.bg.primary};
  padding: ${theme.space[8]} 0;

  @media (max-width: ${theme.breakpoints.md}) {
    padding: ${theme.space[6]} 0;
  }
`;

const AboutHeader = styled.div`
  text-align: center;
  margin-bottom: ${theme.space[8]};
  padding-bottom: ${theme.space[6]};
  border-bottom: 1px solid ${theme.colors.dark.border.default};
`;

const Title = styled.h1`
  font-size: ${theme.fontSizes.displayMd};
  font-weight: ${theme.fontWeights.bold};
  color: ${theme.colors.dark.text.primary};
  margin-top: ${theme.space[4]};
  margin-bottom: 0;

  @media (max-width: ${theme.breakpoints.md}) {
    font-size: ${theme.fontSizes.h1};
  }
`;

const ContentSection = styled.div`
  max-width: 800px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: ${theme.space[6]};
`;

const Card = styled.div`
  background: ${theme.colors.dark.bg.secondary};
  border: 1px solid ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.lg};
  padding: ${theme.space[6]};
`;

const CardTitle = styled.h2`
  font-size: ${theme.fontSizes.h2};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.dark.text.primary};
  margin-bottom: ${theme.space[4]};
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};

  &::before {
    content: '';
    width: 4px;
    height: 24px;
    background: ${theme.gradients.brandPrimary};
    border-radius: ${theme.radius.sm};
  }
`;

const CardText = styled.p`
  font-size: ${theme.fontSizes.body};
  color: ${theme.colors.dark.text.secondary};
  line-height: ${theme.lineHeights.relaxed};
  margin: 0;
`;

const FeatureList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: ${theme.space[3]};
`;

const FeatureItem = styled.li`
  display: flex;
  align-items: flex-start;
  gap: ${theme.space[3]};
`;

const FeatureIcon = styled.div<{ $coming?: boolean }>`
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${props => props.$coming
    ? theme.colors.accent.amber
    : theme.colors.accent.secondary};
  flex-shrink: 0;
  margin-top: 2px;
  font-size: ${theme.fontSizes.body};
`;

const FeatureText = styled.div`
  font-size: ${theme.fontSizes.body};
  color: ${theme.colors.dark.text.secondary};
  line-height: ${theme.lineHeights.relaxed};

  strong {
    color: ${theme.colors.dark.text.primary};
    font-weight: ${theme.fontWeights.semibold};
  }
`;

const TechGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: ${theme.space[3]};
`;

const TechItem = styled.div`
  background: ${theme.colors.dark.bg.tertiary};
  border: 1px solid ${theme.colors.dark.border.default};
  padding: ${theme.space[3]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  text-align: center;
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  color: ${theme.colors.dark.text.primary};
  transition: all ${theme.transitions.fast} ease;

  &:hover {
    border-color: ${theme.colors.brand.primary};
    transform: translateY(-2px);
  }
`;

const FooterCard = styled.div`
  background: ${theme.gradients.brandPrimary};
  border-radius: ${theme.radius.lg};
  padding: ${theme.space[6]};
  text-align: center;
`;

const FooterText = styled.p`
  font-size: ${theme.fontSizes.body};
  color: white;
  line-height: ${theme.lineHeights.relaxed};
  margin: 0;
`;

export default About;
