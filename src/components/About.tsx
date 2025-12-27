import { Container } from "reactstrap";
import styled from "styled-components";
import { theme } from "../theme";
import { Logo } from "./Logo";
import { SEO } from "./SEO";
import { useTranslation } from "react-i18next";

const About = () => {
  const { t } = useTranslation();

  return (
  <PageWrapper>
    <SEO
      title="About"
      description="Learn about Bandmate - a comprehensive platform for bands to manage songs, setlists, shows, and collaborate with members. Built for musicians by musicians."
    />
    <Container>
      <AboutHeader>
        <Logo size={64} variant="icon" theme="dark" />
        <Title>{t('about.title')}</Title>
      </AboutHeader>

      <ContentSection>
        <Card>
          <CardTitle>{t('about.whatIsBandmate')}</CardTitle>
          <CardText>
            {t('about.whatIsBandmateDesc')}
          </CardText>
        </Card>

        <Card>
          <CardTitle>{t('about.currentFeatures')}</CardTitle>
          <FeatureList>
            <FeatureItem>
              <FeatureIcon>
                <i className="bi bi-check-circle-fill"></i>
              </FeatureIcon>
              <FeatureText>
                <strong>{t('about.oauthAuth')}</strong> - {t('about.oauthAuthDesc')}
              </FeatureText>
            </FeatureItem>
            <FeatureItem>
              <FeatureIcon>
                <i className="bi bi-check-circle-fill"></i>
              </FeatureIcon>
              <FeatureText>
                <strong>{t('about.bandManagementFeature')}</strong> - {t('about.bandManagementFeatureDesc')}
              </FeatureText>
            </FeatureItem>
            <FeatureItem>
              <FeatureIcon>
                <i className="bi bi-check-circle-fill"></i>
              </FeatureIcon>
              <FeatureText>
                <strong>{t('about.memberRoles')}</strong> - {t('about.memberRolesDesc')}
              </FeatureText>
            </FeatureItem>
            <FeatureItem>
              <FeatureIcon>
                <i className="bi bi-check-circle-fill"></i>
              </FeatureIcon>
              <FeatureText>
                <strong>{t('about.songLibraryFeature')}</strong> - {t('about.songLibraryFeatureDesc')}
              </FeatureText>
            </FeatureItem>
            <FeatureItem>
              <FeatureIcon>
                <i className="bi bi-check-circle-fill"></i>
              </FeatureIcon>
              <FeatureText>
                <strong>{t('about.setlistManagement')}</strong> - {t('about.setlistManagementDesc')}
              </FeatureText>
            </FeatureItem>
            <FeatureItem>
              <FeatureIcon>
                <i className="bi bi-check-circle-fill"></i>
              </FeatureIcon>
              <FeatureText>
                <strong>{t('about.guestAccess')}</strong> - {t('about.guestAccessDesc')}
              </FeatureText>
            </FeatureItem>
            <FeatureItem>
              <FeatureIcon>
                <i className="bi bi-check-circle-fill"></i>
              </FeatureIcon>
              <FeatureText>
                <strong>{t('about.themes')}</strong> - {t('about.themesDesc')}
              </FeatureText>
            </FeatureItem>
          </FeatureList>
        </Card>

        <Card>
          <CardTitle>{t('about.comingSoon')}</CardTitle>
          <FeatureList>
            <FeatureItem>
              <FeatureIcon $coming>
                <i className="bi bi-clock"></i>
              </FeatureIcon>
              <FeatureText>
                <strong>{t('about.showScheduling')}</strong> - {t('about.showSchedulingDesc')}
              </FeatureText>
            </FeatureItem>
            <FeatureItem>
              <FeatureIcon $coming>
                <i className="bi bi-clock"></i>
              </FeatureIcon>
              <FeatureText>
                <strong>{t('about.emailNotifications')}</strong> - {t('about.emailNotificationsDesc')}
              </FeatureText>
            </FeatureItem>
            <FeatureItem>
              <FeatureIcon $coming>
                <i className="bi bi-clock"></i>
              </FeatureIcon>
              <FeatureText>
                <strong>{t('about.fileAttachments')}</strong> - {t('about.fileAttachmentsDesc')}
              </FeatureText>
            </FeatureItem>
            <FeatureItem>
              <FeatureIcon $coming>
                <i className="bi bi-clock"></i>
              </FeatureIcon>
              <FeatureText>
                <strong>{t('about.advancedSearch')}</strong> - {t('about.advancedSearchDesc')}
              </FeatureText>
            </FeatureItem>
          </FeatureList>
        </Card>

        <Card>
          <CardTitle>{t('about.techStack')}</CardTitle>
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
            {t('about.footerText')}
          </FooterText>
        </FooterCard>
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
