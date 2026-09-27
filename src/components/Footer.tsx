import { Link } from "react-router-dom";
import styled from "styled-components";
import { theme } from "../theme";
import { useTranslation } from "react-i18next";

const Footer = () => {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  return (
    <FooterWrapper>
      <FooterContainer>
        <Copyright>
          © {currentYear} Bandmate
        </Copyright>
        <FooterLinks>
          <FooterLink as={Link} to="/about">
            {t('nav.about')}
          </FooterLink>
          <Separator>·</Separator>
          <FooterLink as={Link} to="/privacy">
            {t('footer.privacy')}
          </FooterLink>
          <Separator>·</Separator>
          <FooterLink as={Link} to="/terms">
            {t('footer.terms')}
          </FooterLink>
        </FooterLinks>
      </FooterContainer>
    </FooterWrapper>
  );
};

const FooterWrapper = styled.footer`
  background: var(--color-bg-secondary);
  border-top: 1px solid var(--color-border);
  padding: ${theme.space[4]} 0;
  margin-top: auto;

  @media print {
    display: none !important;
  }
`;

const FooterContainer = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 ${theme.space[3]};
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: ${theme.space[3]};

  @media (max-width: ${theme.breakpoints.sm}) {
    flex-direction: column;
    text-align: center;
  }
`;

const Copyright = styled.span`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-tertiary);
`;

const FooterLinks = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
`;

const FooterLink = styled.a`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
  text-decoration: none;
  transition: color ${theme.transitions.fast} ease;

  &:hover {
    color: ${theme.colors.brand.primary};
  }
`;

const Separator = styled.span`
  color: var(--color-text-tertiary);
  font-size: ${theme.fontSizes.bodySm};
`;

export default Footer;
