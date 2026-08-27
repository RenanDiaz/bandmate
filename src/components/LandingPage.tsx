import type { FC } from "react";
import { Container } from "reactstrap";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import { theme } from "../theme";
import { AppPreview } from "./AppPreview";
import { FAQ_ITEMS, REFERENCE_BAND } from "../lib/siteConfig";

interface LandingPageProps {
  /** Signed-in visitors get sent into the app instead of to the sign-in page. */
  isAuthenticated?: boolean;
}

const PROBLEMS = ["chat", "key", "rehearsal"] as const;
const STEPS = ["band", "members", "repertoire"] as const;

const FEATURES = [
  { key: "songLibrary", icon: "bi-music-note-list" },
  { key: "setlists", icon: "bi-list-ul" },
  { key: "performanceMode", icon: "bi-play-circle" },
  { key: "bandManagement", icon: "bi-people" },
  { key: "musicIntelligence", icon: "bi-music-note-beamed" },
  { key: "mobileReady", icon: "bi-phone" },
] as const;

/**
 * Marketing landing for signed-out visitors.
 *
 * Deliberately free of context, data fetching and browser APIs: this is the
 * one route that gets prerendered at build time (see scripts/prerender.mjs),
 * so it has to render the same in Node as it does in the browser.
 */
export const LandingPage: FC<LandingPageProps> = ({ isAuthenticated = false }) => {
  const { t } = useTranslation();

  const primaryCta = isAuthenticated ? (
    <CTAButton as={Link} to="/songs">
      <i className="bi bi-music-note-list" />
      {t("home.goToYourSongs")}
    </CTAButton>
  ) : (
    <CTAButton as={Link} to="/login">
      <i className="bi bi-box-arrow-in-right" />
      {t("landing.ctaPrimary")}
    </CTAButton>
  );

  return (
    <LandingWrapper>
      <HeroSection>
        <Container>
          <HeroGrid>
            <HeroCopy>
              <Badge>
                <i className="bi bi-stars" /> {t("landing.badge")}
              </Badge>

              <HeroTitle>{t("landing.headline")}</HeroTitle>
              <HeroSubtitle>{t("landing.subhead")}</HeroSubtitle>

              <CTASection>
                {primaryCta}
                {!isAuthenticated && <CTANote>{t("landing.ctaNote")}</CTANote>}
              </CTASection>
            </HeroCopy>

            <HeroVisual>
              <AppPreview />
            </HeroVisual>
          </HeroGrid>
        </Container>
      </HeroSection>

      {/* Social proof sits immediately after the hero, before any feature talk. */}
      <ProofSection>
        <Container>
          <ProofCard>
            <ProofEyebrow>{t("landing.proof.eyebrow")}</ProofEyebrow>
            <ProofQuote>{t("landing.proof.title", { band: REFERENCE_BAND.name })}</ProofQuote>
            <ProofBody>{t("landing.proof.body")}</ProofBody>
            <ProofLink href={REFERENCE_BAND.url} target="_blank" rel="noopener noreferrer">
              {t("landing.proof.link", { band: REFERENCE_BAND.name })}
              <i className="bi bi-box-arrow-up-right" />
            </ProofLink>
          </ProofCard>
        </Container>
      </ProofSection>

      <ProblemsSection>
        <Container>
          <SectionTitle>{t("landing.problems.title")}</SectionTitle>
          <SectionSubtitle>{t("landing.problems.subtitle")}</SectionSubtitle>

          <ProblemsGrid>
            {PROBLEMS.map((key) => (
              <ProblemCard key={key}>
                <ProblemLabel>
                  <i className="bi bi-chat-left-dots" /> {t("landing.problems.label")}
                </ProblemLabel>
                <ProblemText>{t(`landing.problems.${key}.problem`)}</ProblemText>
                <SolutionArrow className="bi bi-arrow-down" />
                <SolutionLabel>
                  <i className="bi bi-check-circle-fill" /> {t("landing.problems.solutionLabel")}
                </SolutionLabel>
                <SolutionText>{t(`landing.problems.${key}.solution`)}</SolutionText>
              </ProblemCard>
            ))}
          </ProblemsGrid>
        </Container>
      </ProblemsSection>

      <FeaturesSection>
        <Container>
          <SectionTitle>{t("landing.features.title")}</SectionTitle>
          <SectionSubtitle>{t("landing.features.subtitle")}</SectionSubtitle>

          <FeaturesGrid>
            {FEATURES.map(({ key, icon }) => (
              <FeatureCard key={key}>
                <FeatureIcon>
                  <i className={`bi ${icon}`} />
                </FeatureIcon>
                <FeatureTitle>{t(`features.${key}`)}</FeatureTitle>
                <FeatureDescription>{t(`features.${key}Desc`)}</FeatureDescription>
              </FeatureCard>
            ))}
          </FeaturesGrid>
        </Container>
      </FeaturesSection>

      <StepsSection>
        <Container>
          <SectionTitle>{t("landing.steps.title")}</SectionTitle>
          <SectionSubtitle>{t("landing.steps.subtitle")}</SectionSubtitle>

          <StepsGrid>
            {STEPS.map((key, index) => (
              <StepCard key={key}>
                <StepNumber>{index + 1}</StepNumber>
                <StepTitle>{t(`landing.steps.${key}.title`)}</StepTitle>
                <StepBody>{t(`landing.steps.${key}.body`)}</StepBody>
              </StepCard>
            ))}
          </StepsGrid>
        </Container>
      </StepsSection>

      <PricingSection>
        <Container>
          <PricingCard>
            <PricingEyebrow>{t("landing.pricing.eyebrow")}</PricingEyebrow>
            <PricingPrice>{t("landing.pricing.price")}</PricingPrice>
            <PricingBody>{t("landing.pricing.body")}</PricingBody>
            <PricingList>
              <li>
                <i className="bi bi-check-lg" /> {t("landing.pricing.item1")}
              </li>
              <li>
                <i className="bi bi-check-lg" /> {t("landing.pricing.item2")}
              </li>
              <li>
                <i className="bi bi-check-lg" /> {t("landing.pricing.item3")}
              </li>
            </PricingList>
            <PricingNote>{t("landing.pricing.note")}</PricingNote>
          </PricingCard>
        </Container>
      </PricingSection>

      <FaqSection>
        <Container>
          <SectionTitle>{t("landing.faq.title")}</SectionTitle>
          <FaqList>
            {FAQ_ITEMS.map((key) => (
              <FaqItem key={key}>
                <FaqQuestion>{t(`landing.faq.${key}.q`)}</FaqQuestion>
                <FaqAnswer>{t(`landing.faq.${key}.a`)}</FaqAnswer>
              </FaqItem>
            ))}
          </FaqList>
        </Container>
      </FaqSection>

      <FinalCTASection>
        <Container>
          <FinalCTAContent>
            <FinalCTATitle>{t("landing.finalCta.title")}</FinalCTATitle>
            <FinalCTASubtitle>{t("landing.finalCta.subtitle")}</FinalCTASubtitle>
            <FinalCTAActions>{primaryCta}</FinalCTAActions>
            <Signature>{t("landing.signature")}</Signature>
          </FinalCTAContent>
        </Container>
      </FinalCTASection>
    </LandingWrapper>
  );
};

/* ------------------------------------------------------------------ */
/* Styled components                                                   */
/* ------------------------------------------------------------------ */

const LandingWrapper = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const HeroSection = styled.section`
  background: ${theme.gradients.brandPrimary};
  padding: ${theme.space[16]} 0;
  position: relative;
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
  }

  @media (max-width: ${theme.breakpoints.md}) {
    padding: ${theme.space[12]} 0;
  }
`;

const HeroGrid = styled.div`
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: center;
  gap: ${theme.space[12]};

  @media (max-width: ${theme.breakpoints.lg}) {
    grid-template-columns: 1fr;
    gap: ${theme.space[10]};
    text-align: center;
  }
`;

const HeroCopy = styled.div`
  max-width: 560px;

  @media (max-width: ${theme.breakpoints.lg}) {
    max-width: none;
  }
`;

const HeroVisual = styled.div`
  display: flex;
  justify-content: center;
`;

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[2]};
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: #fff;
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.semibold};
  letter-spacing: ${theme.letterSpacing.wide};
  text-transform: uppercase;
  padding: ${theme.space[1]} ${theme.space[3]};
  border-radius: ${theme.radius.full};
  margin-bottom: ${theme.space[5]};
`;

const HeroTitle = styled.h1`
  font-size: ${theme.fontSizes.displayLg};
  font-weight: ${theme.fontWeights.extrabold};
  color: #fff;
  line-height: ${theme.lineHeights.tight};
  letter-spacing: ${theme.letterSpacing.tight};
  margin-bottom: ${theme.space[5]};
  text-wrap: balance;

  @media (max-width: ${theme.breakpoints.md}) {
    font-size: ${theme.fontSizes.displayMd};
  }
`;

const HeroSubtitle = styled.p`
  font-size: ${theme.fontSizes.bodyLg};
  color: rgba(255, 255, 255, 0.92);
  line-height: ${theme.lineHeights.relaxed};
  margin-bottom: ${theme.space[8]};

  @media (max-width: ${theme.breakpoints.md}) {
    font-size: ${theme.fontSizes.body};
  }
`;

const CTASection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${theme.space[3]};

  @media (max-width: ${theme.breakpoints.lg}) {
    align-items: center;
  }
`;

const CTAButton = styled.button`
  background: #fff;
  color: ${theme.colors.brand.primary};
  border: none;
  padding: ${theme.space[4]} ${theme.space[8]};
  border-radius: ${theme.radius.lg};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.base} ease;
  display: inline-flex;
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
    color: ${theme.colors.brand.primaryActive};
  }

  &:active {
    transform: translateY(0);
  }
`;

const CTANote = styled.p`
  margin: 0;
  font-size: ${theme.fontSizes.bodySm};
  color: rgba(255, 255, 255, 0.8);
`;

const ProofSection = styled.section`
  background: var(--color-bg-primary);
  padding: ${theme.space[12]} 0 0;
`;

const ProofCard = styled.div`
  max-width: 760px;
  margin: -${theme.space[16]} auto 0;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-left: 4px solid ${theme.colors.brand.primary};
  border-radius: ${theme.radius.lg};
  padding: ${theme.space[8]};
  box-shadow: var(--shadow-lg);

  @media (max-width: ${theme.breakpoints.md}) {
    margin-top: -${theme.space[10]};
    padding: ${theme.space[6]};
  }
`;

const ProofEyebrow = styled.p`
  margin: 0 0 ${theme.space[2]};
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.semibold};
  letter-spacing: ${theme.letterSpacing.wider};
  text-transform: uppercase;
  color: ${theme.colors.brand.primaryLight};
`;

const ProofQuote = styled.p`
  margin: 0 0 ${theme.space[3]};
  font-size: ${theme.fontSizes.h2};
  font-weight: ${theme.fontWeights.bold};
  line-height: ${theme.lineHeights.snug};
  color: var(--color-text-primary);
`;

const ProofBody = styled.p`
  margin: 0 0 ${theme.space[4]};
  font-size: ${theme.fontSizes.body};
  line-height: ${theme.lineHeights.relaxed};
  color: var(--color-text-secondary);
`;

const ProofLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[2]};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.brand.primaryLight};
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

const SectionTitle = styled.h2`
  font-size: ${theme.fontSizes.displayMd};
  font-weight: ${theme.fontWeights.bold};
  color: var(--color-text-primary);
  text-align: center;
  letter-spacing: ${theme.letterSpacing.tight};
  margin-bottom: ${theme.space[3]};
  text-wrap: balance;

  @media (max-width: ${theme.breakpoints.md}) {
    font-size: ${theme.fontSizes.h1};
  }
`;

const SectionSubtitle = styled.p`
  max-width: 640px;
  margin: 0 auto ${theme.space[12]};
  text-align: center;
  font-size: ${theme.fontSizes.bodyLg};
  color: var(--color-text-secondary);
  line-height: ${theme.lineHeights.relaxed};

  @media (max-width: ${theme.breakpoints.md}) {
    font-size: ${theme.fontSizes.body};
    margin-bottom: ${theme.space[8]};
  }
`;

const ProblemsSection = styled.section`
  background: var(--color-bg-primary);
  padding: ${theme.space[20]} 0;

  @media (max-width: ${theme.breakpoints.md}) {
    padding: ${theme.space[12]} 0;
  }
`;

const ProblemsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: ${theme.space[6]};
  max-width: 1100px;
  margin: 0 auto;
`;

const ProblemCard = styled.div`
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.lg};
  padding: ${theme.space[6]};
`;

const ProblemLabel = styled.p`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  margin: 0 0 ${theme.space[2]};
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.semibold};
  letter-spacing: ${theme.letterSpacing.wide};
  text-transform: uppercase;
  color: var(--color-text-tertiary);
`;

const ProblemText = styled.p`
  margin: 0;
  font-size: ${theme.fontSizes.h4};
  font-weight: ${theme.fontWeights.semibold};
  line-height: ${theme.lineHeights.snug};
  color: var(--color-text-primary);
`;

const SolutionArrow = styled.i`
  display: block;
  margin: ${theme.space[4]} 0;
  color: ${theme.colors.brand.primary};
`;

const SolutionLabel = styled.p`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  margin: 0 0 ${theme.space[2]};
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.semibold};
  letter-spacing: ${theme.letterSpacing.wide};
  text-transform: uppercase;
  color: ${theme.colors.accent.secondary};
`;

const SolutionText = styled.p`
  margin: 0;
  font-size: ${theme.fontSizes.bodySm};
  line-height: ${theme.lineHeights.relaxed};
  color: var(--color-text-secondary);
`;

const FeaturesSection = styled.section`
  background: var(--color-bg-secondary);
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  padding: ${theme.space[20]} 0;

  @media (max-width: ${theme.breakpoints.md}) {
    padding: ${theme.space[12]} 0;
  }
`;

const FeaturesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: ${theme.space[6]};
  max-width: 1100px;
  margin: 0 auto;
`;

const FeatureCard = styled.div`
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.lg};
  padding: ${theme.space[6]};
  transition: all ${theme.transitions.base} ease;

  &:hover {
    transform: translateY(-4px);
    border-color: ${theme.colors.brand.primary};
    box-shadow: var(--shadow-lg);
  }
`;

const FeatureIcon = styled.div`
  width: 48px;
  height: 48px;
  background: ${theme.gradients.brandPrimary};
  border-radius: ${theme.radius.md};
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: ${theme.space[4]};
  font-size: ${theme.fontSizes.h3};
  color: #fff;
`;

const FeatureTitle = styled.h3`
  font-size: ${theme.fontSizes.h3};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin-bottom: ${theme.space[2]};
`;

const FeatureDescription = styled.p`
  margin: 0;
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
  line-height: ${theme.lineHeights.relaxed};
`;

const StepsSection = styled.section`
  background: var(--color-bg-primary);
  padding: ${theme.space[20]} 0;

  @media (max-width: ${theme.breakpoints.md}) {
    padding: ${theme.space[12]} 0;
  }
`;

const StepsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: ${theme.space[6]};
  max-width: 1000px;
  margin: 0 auto;
`;

const StepCard = styled.div`
  text-align: center;
  padding: ${theme.space[4]};
`;

const StepNumber = styled.div`
  width: 48px;
  height: 48px;
  margin: 0 auto ${theme.space[4]};
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${theme.radius.full};
  border: 2px solid ${theme.colors.brand.primary};
  color: ${theme.colors.brand.primaryLight};
  font-size: ${theme.fontSizes.h3};
  font-weight: ${theme.fontWeights.bold};
`;

const StepTitle = styled.h3`
  font-size: ${theme.fontSizes.h3};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin-bottom: ${theme.space[2]};
`;

const StepBody = styled.p`
  margin: 0;
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
  line-height: ${theme.lineHeights.relaxed};
`;

const PricingSection = styled.section`
  background: var(--color-bg-secondary);
  border-top: 1px solid var(--color-border);
  padding: ${theme.space[16]} 0;

  @media (max-width: ${theme.breakpoints.md}) {
    padding: ${theme.space[12]} 0;
  }
`;

const PricingCard = styled.div`
  max-width: 560px;
  margin: 0 auto;
  text-align: center;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.xl};
  padding: ${theme.space[10]} ${theme.space[8]};

  @media (max-width: ${theme.breakpoints.md}) {
    padding: ${theme.space[8]} ${theme.space[5]};
  }
`;

const PricingEyebrow = styled.p`
  margin: 0 0 ${theme.space[2]};
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.semibold};
  letter-spacing: ${theme.letterSpacing.wider};
  text-transform: uppercase;
  color: ${theme.colors.brand.primaryLight};
`;

const PricingPrice = styled.p`
  margin: 0 0 ${theme.space[3]};
  font-size: ${theme.fontSizes.displayMd};
  font-weight: ${theme.fontWeights.extrabold};
  color: var(--color-text-primary);
`;

const PricingBody = styled.p`
  margin: 0 0 ${theme.space[6]};
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-secondary);
  line-height: ${theme.lineHeights.relaxed};
`;

const PricingList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0 0 ${theme.space[6]};
  display: inline-flex;
  flex-direction: column;
  gap: ${theme.space[2]};
  text-align: left;

  li {
    display: flex;
    align-items: flex-start;
    gap: ${theme.space[2]};
    font-size: ${theme.fontSizes.bodySm};
    color: var(--color-text-secondary);
  }

  i {
    color: ${theme.colors.accent.secondary};
    flex-shrink: 0;
  }
`;

const PricingNote = styled.p`
  margin: 0;
  font-size: ${theme.fontSizes.bodyXs};
  color: var(--color-text-tertiary);
`;

const FaqSection = styled.section`
  background: var(--color-bg-primary);
  padding: ${theme.space[20]} 0;

  @media (max-width: ${theme.breakpoints.md}) {
    padding: ${theme.space[12]} 0;
  }
`;

const FaqList = styled.div`
  max-width: 760px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: ${theme.space[6]};
`;

const FaqItem = styled.div`
  border-bottom: 1px solid var(--color-border-subtle);
  padding-bottom: ${theme.space[6]};

  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
`;

const FaqQuestion = styled.h3`
  font-size: ${theme.fontSizes.h4};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin-bottom: ${theme.space[2]};
`;

const FaqAnswer = styled.p`
  margin: 0;
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
  line-height: ${theme.lineHeights.relaxed};
`;

const FinalCTASection = styled.section`
  background: var(--color-bg-secondary);
  border-top: 1px solid var(--color-border);
  padding: ${theme.space[16]} 0;
`;

const FinalCTAContent = styled.div`
  max-width: 640px;
  margin: 0 auto;
  text-align: center;
`;

const FinalCTATitle = styled.h2`
  font-size: ${theme.fontSizes.displayMd};
  font-weight: ${theme.fontWeights.bold};
  color: var(--color-text-primary);
  margin-bottom: ${theme.space[4]};
  text-wrap: balance;

  @media (max-width: ${theme.breakpoints.md}) {
    font-size: ${theme.fontSizes.h1};
  }
`;

const FinalCTASubtitle = styled.p`
  font-size: ${theme.fontSizes.bodyLg};
  color: var(--color-text-secondary);
  line-height: ${theme.lineHeights.relaxed};
  margin-bottom: ${theme.space[8]};

  @media (max-width: ${theme.breakpoints.md}) {
    font-size: ${theme.fontSizes.body};
  }
`;

const FinalCTAActions = styled.div`
  display: flex;
  justify-content: center;
`;

const Signature = styled.p`
  margin: ${theme.space[8]} 0 0;
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-tertiary);
`;

export default LandingPage;
