import type { FC } from "react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Navbar, Nav, NavItem, Button } from "reactstrap";
import styled from "styled-components";
import { AuthButton } from "../AuthButton";
import { BandSwitcher } from "./BandSwitcher";
import { Logo } from "./Logo";
import { CustomOffcanvas, OffcanvasHeader, OffcanvasBody } from "./CustomOffcanvas";
import { useBandContext } from "../context/useBandContext";
import { NAV_LINKS, isNavLinkActive } from "./navLinks";
import { theme } from "../theme";

const DESKTOP_NAV_LINKS = NAV_LINKS.filter((link) => !link.offcanvasOnly);

interface AppNavbarProps {
  mode: "light" | "dark";
  onToggleMode: () => void;
}

export const AppNavbar: FC<AppNavbarProps> = ({ mode, onToggleMode }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const location = useLocation();
  const { selectedBand, user, setShowBandSelector } = useBandContext();
  const navigate = useNavigate();

  const toggleNavbar = () => setIsOpen((open) => !open);

  return (
    <>
      <StyledNavbar expand="lg" $mode={mode}>
        <NavbarContainer>
          <NavBrandContainer>
            <DesktopLogo to="/" style={{ textDecoration: "none", display: "flex", alignItems: "center" }}>
              <Logo size={32} variant="full" theme={mode} />
            </DesktopLogo>
            <MobileLogo to="/" style={{ textDecoration: "none", display: "flex", alignItems: "center" }}>
              <Logo size={28} variant="icon" theme={mode} />
            </MobileLogo>
            {selectedBand && user && (
              <BandSwitcherTriggerWrapper>
                <BandDivider />
                <BandSwitcherTrigger
                  onClick={() => setIsSwitcherOpen((v) => !v)}
                  aria-label={t('nav.switchBand')}
                  aria-expanded={isSwitcherOpen}
                >
                  <BandTriggerName>{selectedBand.name}</BandTriggerName>
                  <i className={`bi bi-chevron-${isSwitcherOpen ? 'up' : 'down'}`}></i>
                </BandSwitcherTrigger>
                <BandSwitcher
                  isOpen={isSwitcherOpen}
                  onClose={() => setIsSwitcherOpen(false)}
                  onManageBands={() => setShowBandSelector(true)}
                />
              </BandSwitcherTriggerWrapper>
            )}
          </NavBrandContainer>

          <DesktopNav navbar>
            {DESKTOP_NAV_LINKS.map((link) => (
              <NavItem key={link.to}>
                <StyledNavLink
                  as={Link}
                  to={link.to}
                  $active={isNavLinkActive(link, location.pathname)}
                  $mode={mode}
                >
                  {t(link.labelKey)}
                </StyledNavLink>
              </NavItem>
            ))}
          </DesktopNav>

          <DesktopNavActions>
            <ThemeToggleButton
              onClick={onToggleMode}
              aria-label="Toggle color mode"
              title={mode === "dark" ? t('nav.switchToLightMode') : t('nav.switchToDarkMode')}
              $mode={mode}
            >
              {mode === "dark" ? (
                <i className="bi bi-sun-fill"></i>
              ) : (
                <i className="bi bi-moon-fill"></i>
              )}
            </ThemeToggleButton>
            <AuthButton compact />
          </DesktopNavActions>

          <StyledNavbarToggler onClick={toggleNavbar} aria-label="Toggle navigation">
            <i className={isOpen ? "bi bi-x-lg" : "bi bi-list"}></i>
          </StyledNavbarToggler>
        </NavbarContainer>
      </StyledNavbar>

      <CustomOffcanvas
        isOpen={isOpen}
        onClose={toggleNavbar}
        mode={mode}
      >
        <OffcanvasHeader onClose={toggleNavbar} mode={mode}>
          <Logo size={28} variant="full" theme={mode} />
        </OffcanvasHeader>
        <OffcanvasBody mode={mode}>
          {selectedBand && (
            <MobileBandInfo>
              <MobileBandName>
                <i className="bi bi-music-note-beamed"></i>
                {selectedBand.name}
              </MobileBandName>
              <MobileBandActions>
                <BandSettingsButton
                  size="sm"
                  onClick={() => {
                    navigate(`/bands/${selectedBand.id}/settings`);
                    setIsOpen(false);
                  }}
                  aria-label={t('nav.bandSettings')}
                  title={t('nav.bandSettings')}
                >
                  <i className="bi bi-gear"></i>
                </BandSettingsButton>
              </MobileBandActions>
            </MobileBandInfo>
          )}
          <StyledNav navbar>
            {NAV_LINKS.map((link) => (
              <NavItem key={link.to}>
                <StyledNavLink
                  as={Link}
                  to={link.to}
                  $active={isNavLinkActive(link, location.pathname)}
                  $mode={mode}
                  onClick={() => setIsOpen(false)}
                >
                  <i className={`bi ${link.icon}`}></i>
                  <span>{t(link.labelKey)}</span>
                </StyledNavLink>
              </NavItem>
            ))}
          </StyledNav>

          <NavActions>
            <ThemeToggleButton
              onClick={onToggleMode}
              aria-label="Toggle color mode"
              title={mode === "dark" ? t('nav.switchToLightMode') : t('nav.switchToDarkMode')}
              $mode={mode}
            >
              {mode === "dark" ? (
                <i className="bi bi-sun-fill"></i>
              ) : (
                <i className="bi bi-moon-fill"></i>
              )}
              <span style={{ marginLeft: '8px' }}>
                {mode === "dark" ? t('nav.lightMode') : t('nav.darkMode')}
              </span>
            </ThemeToggleButton>
            {/* Flat account rows, not a nested dropdown: a floating menu at the
                drawer's bottom opened below the viewport. */}
            <AuthButton variant="inline" onAction={() => setIsOpen(false)} />
          </NavActions>
        </OffcanvasBody>
      </CustomOffcanvas>
    </>
  );
};

// Styled Components

const StyledNavbar = styled(Navbar)<{ $mode: "light" | "dark" }>`
  background: var(--color-bg-secondary) !important;
  border-bottom: 1px solid var(--color-border);
  padding: ${theme.space[3]} 0;
  box-shadow: var(--shadow-sm);
  position: sticky;
  top: 0;
  z-index: ${theme.zIndex.sticky};
  backdrop-filter: blur(10px);
  transition: all ${theme.transitions.base} ease;

  @media print {
    display: none !important;
  }
`;

const NavbarContainer = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 ${theme.space[3]};
  gap: ${theme.space[4]};
`;

const NavBrandContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  flex-shrink: 1;
  min-width: 0;
  position: relative;

  @media (max-width: ${theme.breakpoints.lgDown}) {
    flex: 1;
  }
`;

const DesktopLogo = styled(Link)`
  @media (max-width: ${theme.breakpoints.lgDown}) {
    display: none !important;
  }
`;

const MobileLogo = styled(Link)`
  display: none !important;

  @media (max-width: ${theme.breakpoints.lgDown}) {
    display: flex !important;
  }
`;

const StyledNavbarToggler = styled.button`
  display: none;
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  width: 40px;
  height: 40px;
  border-radius: ${theme.radius.base};
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  font-size: ${theme.fontSizes.h4};
  padding: 0;
  margin-left: auto;

  &:hover {
    background: var(--color-bg-tertiary);
    border-color: ${theme.colors.brand.primary};
    color: ${theme.colors.brand.primary};
  }

  @media (max-width: ${theme.breakpoints.lgDown}) {
    display: flex;
  }
`;

const BandSwitcherTriggerWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  position: relative;
  min-width: 0;
`;

const BandDivider = styled.div`
  width: 1px;
  height: 24px;
  background: var(--color-border);
  opacity: 0.5;
  flex-shrink: 0;

  @media (max-width: ${theme.breakpoints.lgDown}) {
    height: 20px;
  }
`;

const BandSwitcherTrigger = styled.button`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  background: transparent;
  border: 1px solid transparent;
  border-radius: ${theme.radius.base};
  padding: ${theme.space[1]} ${theme.space[2]};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  min-width: 0;
  color: ${theme.colors.brand.primary};

  i {
    font-size: ${theme.fontSizes.bodyXs};
    flex-shrink: 0;
    transition: transform ${theme.transitions.fast} ease;
  }

  &:hover {
    background: var(--color-bg-tertiary);
    border-color: var(--color-border);
  }

  &[aria-expanded="true"] {
    background: var(--color-bg-tertiary);
    border-color: ${theme.colors.brand.primary};
  }
`;

const BandTriggerName = styled.span`
  font-weight: ${theme.fontWeights.semibold};
  font-size: ${theme.fontSizes.bodySm};
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  @media (max-width: ${theme.breakpoints.lgDown}) {
    max-width: none;
    font-size: ${theme.fontSizes.bodyXs};
  }
`;

const MobileBandInfo = styled.div`
  display: none;
  padding: ${theme.space[3]} 0;
  margin-bottom: ${theme.space[2]};
  border-bottom: 1px solid var(--color-border);

  @media (max-width: ${theme.breakpoints.lgDown}) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${theme.space[3]};
  }
`;

const MobileBandName = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  font-weight: ${theme.fontWeights.semibold};
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.brand.primary};

  i {
    font-size: ${theme.fontSizes.body};
  }
`;

const BandSettingsButton = styled(Button)`
  background: transparent !important;
  border: 1px solid var(--color-border) !important;
  border-radius: ${theme.radius.base} !important;
  padding: ${theme.space[1]} ${theme.space[2]} !important;
  color: var(--color-text-secondary) !important;
  transition: all ${theme.transitions.fast} ease !important;

  &:hover {
    background: var(--color-bg-tertiary) !important;
    border-color: ${theme.colors.brand.primary} !important;
    color: ${theme.colors.brand.primary} !important;
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;

const MobileBandActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
`;

const DesktopNav = styled(Nav)`
  gap: ${theme.space[2]};
  display: flex !important;
  flex: 1;
  justify-content: center;

  @media (max-width: ${theme.breakpoints.lgDown}) {
    display: none !important;
  }
`;

const StyledNav = styled(Nav)`
  gap: ${theme.space[2]};
  flex-direction: column;
  width: 100%;
`;

const StyledNavLink = styled.a<{ $active: boolean; $mode: "light" | "dark" }>`
  color: ${(props) =>
    props.$active
      ? theme.colors.brand.primary
      : 'var(--color-text-secondary)'} !important;
  text-decoration: none !important;
  font-weight: ${(props) =>
    props.$active ? theme.fontWeights.semibold : theme.fontWeights.medium};
  font-size: ${theme.fontSizes.bodySm};
  padding: ${theme.space[2]} ${theme.space[3]} !important;
  border-radius: ${theme.radius.base};
  transition: all ${theme.transitions.fast} ease;
  position: relative;
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};

  /* Desktop styles - no icons, smaller padding */
  @media (min-width: ${theme.breakpoints.lg}) {
    font-size: ${theme.fontSizes.bodySm};
    padding: ${theme.space[2]} ${theme.space[3]} !important;

    i {
      display: none;
    }

    &:hover {
      color: ${theme.colors.brand.primary} !important;
      background: var(--color-bg-tertiary);
      transform: none;
    }
  }

  /* Mobile offcanvas styles - with icons, larger padding */
  @media (max-width: ${theme.breakpoints.lgDown}) {
    font-size: ${theme.fontSizes.body};
    padding: ${theme.space[3]} ${theme.space[4]} !important;

    i {
      font-size: ${theme.fontSizes.h5};
      width: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    &:hover {
      color: ${theme.colors.brand.primary} !important;
      background: var(--color-bg-tertiary);
      transform: translateX(4px);
    }
  }

  ${(props) =>
    props.$active &&
    `
    background: var(--color-bg-tertiary);
  `}
`;

const NavActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[3]};
  width: 100%;
  margin-top: auto;
  padding-top: ${theme.space[4]};
  border-top: 1px solid var(--color-border);
`;

const ThemeToggleButton = styled.button<{ $mode: "light" | "dark" }>`
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  width: 100%;
  height: 48px;
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${theme.space[2]};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.medium};

  &:hover {
    background: var(--color-bg-tertiary);
    border-color: ${theme.colors.brand.primary};
    color: ${theme.colors.brand.primary};
    transform: translateX(4px);
  }

  &:active {
    transform: translateX(0);
  }
`;

const DesktopNavActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};

  @media (max-width: ${theme.breakpoints.lgDown}) {
    display: none !important;
  }

  ${ThemeToggleButton} {
    width: 40px;
    height: 40px;
    transform: none;

    span {
      display: none;
    }

    &:hover {
      transform: translateY(-1px);
    }

    &:active {
      transform: translateY(0);
    }
  }
`;
