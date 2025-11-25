import type { FC } from "react";
import { useEffect, useState } from "react";
import { Routes, Route, Link, Navigate, useLocation } from "react-router-dom";
import { AuthButton } from "./AuthButton";
import Home from "./components/Home";
import { Login } from "./components/Login";
import SongsView from "./components/SongsView";
import SetlistsView from "./components/SetlistsView";
import SetlistEditor from "./components/SetlistEditor";
import SetlistDetailView from "./components/SetlistDetailView";
import SetlistPerformanceView from "./components/SetlistPerformanceView";
import ShowsView from "./components/ShowsView";
import ShowDetailView from "./components/ShowDetailView";
import { BandSettings } from "./components/BandSettings";
import { AcceptInvitation } from "./components/AcceptInvitation";
import About from "./components/About";
import { BandSelector } from "./components/BandSelector";
import { Logo } from "./components/Logo";
import { Container, Navbar, Nav, NavItem, Button, NavbarToggler, Collapse } from "reactstrap";
import styled from "styled-components";
import { BandProvider } from "./context/BandContext";
import { useBandContext } from "./context/useBandContext";
import { theme } from "./theme";

const AppContent: FC = () => {
  const [mode, setMode] = useState<"light" | "dark">("dark");
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { selectedBand, setSelectedBand, user, setShowBandSelector, showBandSelector } =
    useBandContext();

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
        <Container className="px-3">
          <NavBrandContainer>
            <Link to="/" style={{ textDecoration: "none", display: "flex", alignItems: "center" }}>
              <Logo size={32} variant="full" theme={mode} />
            </Link>
            {selectedBand && (
              <BandInfoContainer>
                <BandDivider />
                <BandName>{selectedBand.name}</BandName>
                <SwitchBandButton
                  size="sm"
                  onClick={() => setShowBandSelector(true)}
                  aria-label="Switch Band"
                  title="Switch band"
                >
                  <i className="bi bi-arrow-left-right"></i>
                </SwitchBandButton>
              </BandInfoContainer>
            )}
          </NavBrandContainer>

          <NavbarToggler onClick={toggleNavbar} />

          <Collapse isOpen={isOpen} navbar>
            <StyledNav className="me-auto" navbar>
              <NavItem>
                <StyledNavLink as={Link} to="/" $active={location.pathname === "/"} $mode={mode}>
                  Home
                </StyledNavLink>
              </NavItem>
              <NavItem>
                <StyledNavLink
                  as={Link}
                  to="/songs"
                  $active={location.pathname === "/songs"}
                  $mode={mode}
                >
                  Songs
                </StyledNavLink>
              </NavItem>
              <NavItem>
                <StyledNavLink
                  as={Link}
                  to="/setlists"
                  $active={location.pathname.startsWith("/setlists")}
                  $mode={mode}
                >
                  Setlists
                </StyledNavLink>
              </NavItem>
              <NavItem>
                <StyledNavLink
                  as={Link}
                  to="/shows"
                  $active={location.pathname.startsWith("/shows")}
                  $mode={mode}
                >
                  Shows
                </StyledNavLink>
              </NavItem>
              <NavItem>
                <StyledNavLink
                  as={Link}
                  to="/about"
                  $active={location.pathname === "/about"}
                  $mode={mode}
                >
                  About
                </StyledNavLink>
              </NavItem>
            </StyledNav>

            <NavActions>
              <ThemeToggleButton
                onClick={toggleMode}
                aria-label="Toggle color mode"
                title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                $mode={mode}
              >
                {mode === "dark" ? (
                  <i className="bi bi-sun-fill"></i>
                ) : (
                  <i className="bi bi-moon-fill"></i>
                )}
              </ThemeToggleButton>
              <AuthButton />
            </NavActions>
          </Collapse>
        </Container>
      </StyledNavbar>

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
            <Route path="/setlists" element={<SetlistsView user={user} selectedBand={selectedBand} />} />
            <Route path="/setlists/:setlistId" element={<SetlistDetailView />} />
            <Route path="/setlists/:setlistId/edit" element={<SetlistEditor />} />
            <Route path="/setlists/:setlistId/perform" element={<SetlistPerformanceView />} />
            <Route path="/shows" element={<ShowsView user={user} selectedBand={selectedBand} />} />
            <Route path="/shows/:showId" element={<ShowDetailView />} />
            <Route path="/bands/:bandId/settings" element={<BandSettings user={user} />} />
            <Route path="/invite/accept" element={<AcceptInvitation />} />
            <Route path="/about" element={<About />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        )}
      </MainContent>
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
  background: ${(props) =>
    props.$mode === "dark"
      ? theme.colors.dark.bg.secondary
      : theme.colors.light.bg.primary} !important;
  border-bottom: 1px solid
    ${(props) =>
      props.$mode === "dark"
        ? theme.colors.dark.border.default
        : theme.colors.light.border.default};
  padding: ${theme.space[3]} 0;
  box-shadow: ${(props) => (props.$mode === "dark" ? theme.shadows.sm : theme.shadowsLight.sm)};
  position: sticky;
  top: 0;
  z-index: ${theme.zIndex.sticky};
  backdrop-filter: blur(10px);
  transition: all ${theme.transitions.base} ease;
`;

const NavBrandContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[4]};
`;

const BandInfoContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
`;

const BandDivider = styled.div`
  width: 1px;
  height: 24px;
  background: ${theme.colors.dark.border.default};
  opacity: 0.5;

  @media (max-width: ${theme.breakpoints.md}) {
    display: none;
  }
`;

const BandName = styled.span`
  font-weight: ${theme.fontWeights.semibold};
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.brand.primary};

  @media (max-width: ${theme.breakpoints.md}) {
    display: none;
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

const StyledNav = styled(Nav)`
  gap: ${theme.space[2]};
`;

const StyledNavLink = styled.a<{ $active: boolean; $mode: "light" | "dark" }>`
  color: ${(props) =>
    props.$active
      ? theme.colors.brand.primary
      : props.$mode === "dark"
      ? theme.colors.dark.text.secondary
      : theme.colors.light.text.secondary} !important;
  text-decoration: none !important;
  font-weight: ${(props) =>
    props.$active ? theme.fontWeights.semibold : theme.fontWeights.medium};
  font-size: ${theme.fontSizes.bodySm};
  padding: ${theme.space[2]} ${theme.space[3]} !important;
  border-radius: ${theme.radius.base};
  transition: all ${theme.transitions.fast} ease;
  position: relative;

  &:hover {
    color: ${theme.colors.brand.primary} !important;
    background: ${(props) =>
      props.$mode === "dark" ? theme.colors.dark.bg.tertiary : theme.colors.light.bg.tertiary};
  }

  ${(props) =>
    props.$active &&
    `
    background: ${
      props.$mode === "dark" ? theme.colors.dark.bg.tertiary : theme.colors.light.bg.tertiary
    };
  `}
`;

const NavActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};

  @media (max-width: ${theme.breakpoints.md}) {
    margin-top: ${theme.space[3]};
    justify-content: flex-start;
  }
`;

const ThemeToggleButton = styled.button<{ $mode: "light" | "dark" }>`
  background: transparent;
  border: 1px solid
    ${(props) =>
      props.$mode === "dark"
        ? theme.colors.dark.border.default
        : theme.colors.light.border.default};
  color: ${(props) =>
    props.$mode === "dark" ? theme.colors.dark.text.primary : theme.colors.light.text.primary};
  width: 40px;
  height: 40px;
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  font-size: ${theme.fontSizes.body};

  &:hover {
    background: ${(props) =>
      props.$mode === "dark" ? theme.colors.dark.bg.tertiary : theme.colors.light.bg.tertiary};
    border-color: ${theme.colors.brand.primary};
    color: ${theme.colors.brand.primary};
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;

const MainContent = styled.main`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

export default App;
