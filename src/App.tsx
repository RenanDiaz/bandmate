import type { FC } from "react";
import { useEffect, useState } from "react";
import { Routes, Route, Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AuthButton } from "./AuthButton";
import Home from "./components/Home";
import { Login } from "./components/Login";
import SongsView from "./components/SongsView";
import SetlistsView from "./components/SetlistsView";
import SetlistEditor from "./components/SetlistEditor";
import SetlistDetailView from "./components/SetlistDetailView";
import SetlistPerformanceView from "./components/SetlistPerformanceView";
import PrintableSetlist from "./components/PrintableSetlist";
import PrintableSongbook from "./components/PrintableSongbook";
import ShowsView from "./components/ShowsView";
import ShowDetailView from "./components/ShowDetailView";
import RehearsalsView from "./components/RehearsalsView";
import RehearsalDetailView from "./components/RehearsalDetailView";
import RequestsView from "./components/RequestsView";
import RequestDetailView from "./components/RequestDetailView";
import { BandSettings } from "./components/BandSettings";
import { AcceptInvitation } from "./components/AcceptInvitation";
import About from "./components/About";
import PrivacyPolicy from "./components/PrivacyPolicy";
import TermsOfService from "./components/TermsOfService";
import Footer from "./components/Footer";
import { BandSelector } from "./components/BandSelector";
import { Logo } from "./components/Logo";
import { Navbar, Nav, NavItem, Button } from "reactstrap";
import { CustomOffcanvas, OffcanvasHeader, OffcanvasBody } from "./components/CustomOffcanvas";
import styled from "styled-components";
import { BandProvider } from "./context/BandContext";
import { useBandContext } from "./context/useBandContext";
import { theme } from "./theme";

const AppContent: FC = () => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"light" | "dark">("dark");
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { selectedBand, setSelectedBand, user, setShowBandSelector, showBandSelector } =
    useBandContext();
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.setAttribute("data-bs-theme", mode);
  }, [mode]);

  const toggleMode = () => {
    setMode((prevMode) => (prevMode === "light" ? "dark" : "light"));
  };

  const toggleNavbar = () => setIsOpen((open) => !open);

  return (
    <AppWrapper>
      <StyledNavbar expand="md" $mode={mode}>
        <NavbarContainer>
          <NavBrandContainer>
            <Link to="/" style={{ textDecoration: "none", display: "flex", alignItems: "center" }}>
              <Logo size={32} variant="full" theme={mode} />
            </Link>
            {selectedBand && (
              <BandInfoContainer>
                <BandDivider />
                <BandName>{selectedBand.name}</BandName>
                <BandSettingsButton
                  size="sm"
                  onClick={() => navigate(`/bands/${selectedBand.id}/settings`)}
                  aria-label={t('nav.bandSettings')}
                  title={t('nav.bandSettings')}
                >
                  <i className="bi bi-gear"></i>
                </BandSettingsButton>
                <SwitchBandButton
                  size="sm"
                  onClick={() => setShowBandSelector(true)}
                  aria-label={t('nav.switchBand')}
                  title={t('nav.switchBand')}
                >
                  <i className="bi bi-arrow-left-right"></i>
                </SwitchBandButton>
              </BandInfoContainer>
            )}
          </NavBrandContainer>

          <DesktopNav navbar>
            <NavItem>
              <StyledNavLink as={Link} to="/" $active={location.pathname === "/"} $mode={mode}>
                {t('nav.home')}
              </StyledNavLink>
            </NavItem>
            <NavItem>
              <StyledNavLink
                as={Link}
                to="/songs"
                $active={location.pathname === "/songs"}
                $mode={mode}
              >
                {t('nav.songs')}
              </StyledNavLink>
            </NavItem>
            <NavItem>
              <StyledNavLink
                as={Link}
                to="/setlists"
                $active={location.pathname.startsWith("/setlists")}
                $mode={mode}
              >
                {t('nav.setlists')}
              </StyledNavLink>
            </NavItem>
            <NavItem>
              <StyledNavLink
                as={Link}
                to="/shows"
                $active={location.pathname.startsWith("/shows")}
                $mode={mode}
              >
                {t('nav.shows')}
              </StyledNavLink>
            </NavItem>
            <NavItem>
              <StyledNavLink
                as={Link}
                to="/rehearsals"
                $active={location.pathname.startsWith("/rehearsals")}
                $mode={mode}
              >
                {t('nav.rehearsals')}
              </StyledNavLink>
            </NavItem>
            <NavItem>
              <StyledNavLink
                as={Link}
                to="/requests"
                $active={location.pathname.startsWith("/requests")}
                $mode={mode}
              >
                {t('nav.requests')}
              </StyledNavLink>
            </NavItem>
            <NavItem>
              <StyledNavLink
                as={Link}
                to="/about"
                $active={location.pathname === "/about"}
                $mode={mode}
              >
                {t('nav.about')}
              </StyledNavLink>
            </NavItem>
          </DesktopNav>

          <DesktopNavActions>
            <ThemeToggleButton
              onClick={toggleMode}
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
            <AuthButton />
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
                <SwitchBandButton
                  size="sm"
                  onClick={() => {
                    setShowBandSelector(true);
                    setIsOpen(false);
                  }}
                  aria-label={t('nav.switchBand')}
                  title={t('nav.switchBand')}
                >
                  <i className="bi bi-arrow-left-right"></i>
                </SwitchBandButton>
              </MobileBandActions>
            </MobileBandInfo>
          )}
          <StyledNav navbar>
            <NavItem>
              <StyledNavLink as={Link} to="/" $active={location.pathname === "/"} $mode={mode} onClick={() => setIsOpen(false)}>
                <i className="bi bi-house-door"></i>
                <span>{t('nav.home')}</span>
              </StyledNavLink>
            </NavItem>
            <NavItem>
              <StyledNavLink
                as={Link}
                to="/songs"
                $active={location.pathname === "/songs"}
                $mode={mode}
                onClick={() => setIsOpen(false)}
              >
                <i className="bi bi-music-note-list"></i>
                <span>{t('nav.songs')}</span>
              </StyledNavLink>
            </NavItem>
            <NavItem>
              <StyledNavLink
                as={Link}
                to="/setlists"
                $active={location.pathname.startsWith("/setlists")}
                $mode={mode}
                onClick={() => setIsOpen(false)}
              >
                <i className="bi bi-collection"></i>
                <span>{t('nav.setlists')}</span>
              </StyledNavLink>
            </NavItem>
            <NavItem>
              <StyledNavLink
                as={Link}
                to="/shows"
                $active={location.pathname.startsWith("/shows")}
                $mode={mode}
                onClick={() => setIsOpen(false)}
              >
                <i className="bi bi-calendar-event"></i>
                <span>{t('nav.shows')}</span>
              </StyledNavLink>
            </NavItem>
            <NavItem>
              <StyledNavLink
                as={Link}
                to="/rehearsals"
                $active={location.pathname.startsWith("/rehearsals")}
                $mode={mode}
                onClick={() => setIsOpen(false)}
              >
                <i className="bi bi-calendar-check"></i>
                <span>{t('nav.rehearsals')}</span>
              </StyledNavLink>
            </NavItem>
            <NavItem>
              <StyledNavLink
                as={Link}
                to="/requests"
                $active={location.pathname.startsWith("/requests")}
                $mode={mode}
                onClick={() => setIsOpen(false)}
              >
                <i className="bi bi-lightbulb"></i>
                <span>{t('nav.requests')}</span>
              </StyledNavLink>
            </NavItem>
            <NavItem>
              <StyledNavLink
                as={Link}
                to="/about"
                $active={location.pathname === "/about"}
                $mode={mode}
                onClick={() => setIsOpen(false)}
              >
                <i className="bi bi-info-circle"></i>
                <span>{t('nav.about')}</span>
              </StyledNavLink>
            </NavItem>
          </StyledNav>

          <NavActions>
            <ThemeToggleButton
              onClick={toggleMode}
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
            <AuthButton />
          </NavActions>
        </OffcanvasBody>
      </CustomOffcanvas>

      <MainContent>
        {user && (!selectedBand || showBandSelector) ? (
          <BandSelector
            onSelect={(band) => {
              setSelectedBand(band);
              setShowBandSelector(false);
            }}
            selectedBand={selectedBand || undefined}
          />
        ) : (
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/songs" element={<SongsView user={user} selectedBand={selectedBand} />} />
            <Route path="/songs/print" element={<PrintableSongbook />} />
            <Route path="/setlists" element={<SetlistsView user={user} selectedBand={selectedBand} />} />
            <Route path="/setlists/:setlistId" element={<SetlistDetailView />} />
            <Route path="/setlists/:setlistId/edit" element={<SetlistEditor />} />
            <Route path="/setlists/:setlistId/perform" element={<SetlistPerformanceView />} />
            <Route path="/setlists/:setlistId/print" element={<PrintableSetlist />} />
            <Route path="/shows" element={<ShowsView user={user} selectedBand={selectedBand} />} />
            <Route path="/shows/:showId" element={<ShowDetailView />} />
            <Route path="/rehearsals" element={<RehearsalsView user={user} selectedBand={selectedBand} />} />
            <Route path="/rehearsals/:rehearsalId" element={<RehearsalDetailView />} />
            <Route path="/requests" element={<RequestsView user={user} selectedBand={selectedBand} />} />
            <Route path="/requests/:requestId" element={<RequestDetailView />} />
            <Route path="/bands/:bandId/settings" element={<BandSettings user={user} />} />
            <Route path="/invite/accept" element={<AcceptInvitation />} />
            <Route path="/about" element={<About />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        )}
      </MainContent>
      <Footer />
    </AppWrapper>
  );
};

const App: FC = () => (
  <BandProvider>
    <AppContent />
  </BandProvider>
);

// Styled Components

const AppWrapper = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
`;

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
  gap: ${theme.space[4]};
  flex-shrink: 0;
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

  @media (max-width: ${theme.breakpoints.md}) {
    display: flex;
  }
`;

const BandInfoContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};

  @media (max-width: ${theme.breakpoints.md}) {
    display: none;
  }
`;

const BandDivider = styled.div`
  width: 1px;
  height: 24px;
  background: var(--color-border);
  opacity: 0.5;
`;

const BandName = styled.span`
  font-weight: ${theme.fontWeights.semibold};
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.brand.primary};
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const MobileBandInfo = styled.div`
  display: none;
  padding: ${theme.space[3]} 0;
  margin-bottom: ${theme.space[2]};
  border-bottom: 1px solid var(--color-border);

  @media (max-width: ${theme.breakpoints.md}) {
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

const SwitchBandButton = styled(Button)`
  background: ${theme.colors.brand.primary} !important;
  border: none !important;
  border-radius: ${theme.radius.base} !important;
  padding: ${theme.space[1]} ${theme.space[2]} !important;
  transition: all ${theme.transitions.fast} ease !important;

  &:hover {
    background: ${theme.colors.brand.primaryHover} !important;
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
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

  @media (max-width: ${theme.breakpoints.md}) {
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
  @media (min-width: ${theme.breakpoints.md}) {
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
  @media (max-width: ${theme.breakpoints.md}) {
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
  gap: ${theme.space[2]};
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

  @media (max-width: ${theme.breakpoints.md}) {
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

const MainContent = styled.main`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

export default App;
