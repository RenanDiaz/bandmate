import { Container } from "reactstrap";
import styled from "styled-components";
import { theme } from "../theme";
import { SEO } from "./SEO";
import { useTranslation } from "react-i18next";

const TermsOfService = () => {
  const { t } = useTranslation();

  return (
    <PageWrapper>
      <SEO
        title={t('terms.title')}
        description={t('terms.description')}
      />
      <Container>
        <Header>
          <Title>{t('terms.title')}</Title>
          <LastUpdated>{t('terms.lastUpdated')}: January 2025</LastUpdated>
        </Header>

        <ContentSection>
          <Card>
            <CardTitle>{t('terms.acceptance.title')}</CardTitle>
            <CardText>{t('terms.acceptance.text')}</CardText>
          </Card>

          <Card>
            <CardTitle>{t('terms.serviceDescription.title')}</CardTitle>
            <CardText>{t('terms.serviceDescription.text')}</CardText>
          </Card>

          <Card>
            <CardTitle>{t('terms.userAccounts.title')}</CardTitle>
            <CardText>{t('terms.userAccounts.text')}</CardText>
            <List>
              <ListItem>{t('terms.userAccounts.items.accurate')}</ListItem>
              <ListItem>{t('terms.userAccounts.items.secure')}</ListItem>
              <ListItem>{t('terms.userAccounts.items.responsible')}</ListItem>
            </List>
          </Card>

          <Card>
            <CardTitle>{t('terms.userContent.title')}</CardTitle>
            <CardText>{t('terms.userContent.text')}</CardText>
          </Card>

          <Card>
            <CardTitle>{t('terms.acceptableUse.title')}</CardTitle>
            <CardText>{t('terms.acceptableUse.text')}</CardText>
            <List>
              <ListItem>{t('terms.acceptableUse.items.lawful')}</ListItem>
              <ListItem>{t('terms.acceptableUse.items.respectful')}</ListItem>
              <ListItem>{t('terms.acceptableUse.items.noHarm')}</ListItem>
              <ListItem>{t('terms.acceptableUse.items.noInfringe')}</ListItem>
            </List>
          </Card>

          <Card>
            <CardTitle>{t('terms.intellectualProperty.title')}</CardTitle>
            <CardText>{t('terms.intellectualProperty.text')}</CardText>
          </Card>

          <Card>
            <CardTitle>{t('terms.termination.title')}</CardTitle>
            <CardText>{t('terms.termination.text')}</CardText>
          </Card>

          <Card>
            <CardTitle>{t('terms.disclaimers.title')}</CardTitle>
            <CardText>{t('terms.disclaimers.text')}</CardText>
          </Card>

          <Card>
            <CardTitle>{t('terms.liability.title')}</CardTitle>
            <CardText>{t('terms.liability.text')}</CardText>
          </Card>

          <Card>
            <CardTitle>{t('terms.changes.title')}</CardTitle>
            <CardText>{t('terms.changes.text')}</CardText>
          </Card>

          <Card>
            <CardTitle>{t('terms.contact.title')}</CardTitle>
            <CardText>{t('terms.contact.text')}</CardText>
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

export default TermsOfService;
