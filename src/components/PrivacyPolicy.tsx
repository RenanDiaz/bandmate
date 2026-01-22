import { Container } from "reactstrap";
import styled from "styled-components";
import { theme } from "../theme";
import { SEO } from "./SEO";
import { useTranslation } from "react-i18next";

const PrivacyPolicy = () => {
  const { t } = useTranslation();

  return (
    <PageWrapper>
      <SEO
        title={t('privacy.title')}
        description={t('privacy.description')}
      />
      <Container>
        <Header>
          <Title>{t('privacy.title')}</Title>
          <LastUpdated>{t('privacy.lastUpdated')}: January 2025</LastUpdated>
        </Header>

        <ContentSection>
          <Card>
            <CardTitle>{t('privacy.introduction.title')}</CardTitle>
            <CardText>{t('privacy.introduction.text')}</CardText>
          </Card>

          <Card>
            <CardTitle>{t('privacy.dataCollection.title')}</CardTitle>
            <CardText>{t('privacy.dataCollection.text')}</CardText>
            <List>
              <ListItem>{t('privacy.dataCollection.items.account')}</ListItem>
              <ListItem>{t('privacy.dataCollection.items.content')}</ListItem>
              <ListItem>{t('privacy.dataCollection.items.usage')}</ListItem>
            </List>
          </Card>

          <Card>
            <CardTitle>{t('privacy.dataUse.title')}</CardTitle>
            <CardText>{t('privacy.dataUse.text')}</CardText>
            <List>
              <ListItem>{t('privacy.dataUse.items.service')}</ListItem>
              <ListItem>{t('privacy.dataUse.items.communication')}</ListItem>
              <ListItem>{t('privacy.dataUse.items.improvement')}</ListItem>
            </List>
          </Card>

          <Card>
            <CardTitle>{t('privacy.dataSharing.title')}</CardTitle>
            <CardText>{t('privacy.dataSharing.text')}</CardText>
          </Card>

          <Card>
            <CardTitle>{t('privacy.security.title')}</CardTitle>
            <CardText>{t('privacy.security.text')}</CardText>
          </Card>

          <Card>
            <CardTitle>{t('privacy.cookies.title')}</CardTitle>
            <CardText>{t('privacy.cookies.text')}</CardText>
          </Card>

          <Card>
            <CardTitle>{t('privacy.rights.title')}</CardTitle>
            <CardText>{t('privacy.rights.text')}</CardText>
            <List>
              <ListItem>{t('privacy.rights.items.access')}</ListItem>
              <ListItem>{t('privacy.rights.items.correction')}</ListItem>
              <ListItem>{t('privacy.rights.items.deletion')}</ListItem>
              <ListItem>{t('privacy.rights.items.export')}</ListItem>
            </List>
          </Card>

          <Card>
            <CardTitle>{t('privacy.contact.title')}</CardTitle>
            <CardText>{t('privacy.contact.text')}</CardText>
          </Card>
        </ContentSection>
      </Container>
    </PageWrapper>
  );
};

const PageWrapper = styled.div`
  min-height: calc(100vh - 80px);
  background: var(--color-bg-primary);
  padding: ${theme.space[8]} 0;

  @media (max-width: ${theme.breakpoints.md}) {
    padding: ${theme.space[6]} 0;
  }
`;

const Header = styled.div`
  text-align: center;
  margin-bottom: ${theme.space[8]};
  padding-bottom: ${theme.space[6]};
  border-bottom: 1px solid var(--color-border);
`;

const Title = styled.h1`
  font-size: ${theme.fontSizes.displayMd};
  font-weight: ${theme.fontWeights.bold};
  color: var(--color-text-primary);
  margin-bottom: ${theme.space[2]};

  @media (max-width: ${theme.breakpoints.md}) {
    font-size: ${theme.fontSizes.h1};
  }
`;

const LastUpdated = styled.p`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-tertiary);
  margin: 0;
`;

const ContentSection = styled.div`
  max-width: 800px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: ${theme.space[6]};
`;

const Card = styled.div`
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.lg};
  padding: ${theme.space[6]};
`;

const CardTitle = styled.h2`
  font-size: ${theme.fontSizes.h3};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin-bottom: ${theme.space[3]};
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};

  &::before {
    content: '';
    width: 4px;
    height: 20px;
    background: ${theme.gradients.brandPrimary};
    border-radius: ${theme.radius.sm};
  }
`;

const CardText = styled.p`
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-secondary);
  line-height: ${theme.lineHeights.relaxed};
  margin: 0;
`;

const List = styled.ul`
  margin: ${theme.space[3]} 0 0 0;
  padding-left: ${theme.space[6]};
`;

const ListItem = styled.li`
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-secondary);
  line-height: ${theme.lineHeights.relaxed};
  margin-bottom: ${theme.space[2]};

  &:last-child {
    margin-bottom: 0;
  }
`;

export default PrivacyPolicy;
