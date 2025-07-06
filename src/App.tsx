import type { FC } from "react";
import { useEffect, useState } from "react";
import { Routes, Route, Link, Navigate, useLocation } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import type { Band } from "./services/bandsService";
import { supabase } from "./lib/supabaseClient";
import { AuthButton } from "./AuthButton";
import Home from "./components/Home";
import SongsView from "./components/SongsView";
import About from "./components/About";
import { BandSelector } from "./components/BandSelector";
import {
  Container,
  Navbar,
  NavbarBrand,
  Nav,
  NavItem,
  NavLink,
  Button,
  NavbarToggler,
  Collapse,
} from "reactstrap";
import styled from "styled-components";

const App: FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<"light" | "dark">("dark");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedBand, setSelectedBand] = useState<Band | null>(null);
  const [showBandSelector, setShowBandSelector] = useState(false);
  const location = useLocation();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-bs-theme", mode);
  }, [mode]);

  const toggleMode = () => {
    setMode((prevMode) => (prevMode === "light" ? "dark" : "light"));
  };

  const toggleNavbar = () => setIsOpen((open) => !open);

  return (
    <div>
      <Navbar expand="md">
        <Container className="px-3">
          <NavbarBrand tag={Link} to="/">
            🎶 Bandmate
            {selectedBand && (
              <>
                <BandNameContainer>{selectedBand.name}</BandNameContainer>
                <Button
                  size="sm"
                  color="secondary"
                  style={{ marginLeft: 8 }}
                  onClick={() => setShowBandSelector(true)}
                  aria-label="Switch Band"
                >
                  <i className="bi bi-arrow-left-right"></i>
                </Button>
              </>
            )}
          </NavbarBrand>
          <NavbarToggler onClick={toggleNavbar} />
          <Collapse isOpen={isOpen} navbar>
            <Nav className="me-auto" navbar>
              <NavItem>
                <NavLink tag={Link} to="/" active={location.pathname === "/"}>
                  Home
                </NavLink>
              </NavItem>
              <NavItem>
                <NavLink tag={Link} to="/songs" active={location.pathname === "/songs"}>
                  Songs
                </NavLink>
              </NavItem>
              <NavItem>
                <NavLink tag={Link} to="/about" active={location.pathname === "/about"}>
                  About
                </NavLink>
              </NavItem>
            </Nav>
            <Button
              outline
              color={mode === "dark" ? "light" : "dark"}
              onClick={toggleMode}
              className="me-2"
              aria-label="Toggle color mode"
            >
              {mode === "dark" ? (
                <i className="bi bi-sun-fill"></i>
              ) : (
                <i className="bi bi-moon-fill"></i>
              )}
            </Button>
            <AuthButton />
          </Collapse>
        </Container>
      </Navbar>
      {/* Show BandSelector after login, before showing main app content, or when switching bands */}
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
          <Route path="/songs" element={<SongsView user={user} />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      )}
    </div>
  );
};

const BandNameContainer = styled.span`
  margin-left: 8px;
  padding-left: 8px;
  border-left: 1px solid #ccc;
  font-weight: 500;
`;

export default App;
