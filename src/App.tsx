import type { FC } from "react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Footer from "./components/Footer";
import { AppMain } from "./AppMain";
import { AppNavbar } from "./components/AppNavbar";
import styled from "styled-components";
import { BandProvider } from "./context/BandContext";
import { useBandContext } from "./context/useBandContext";
import { ToastProvider } from "./context/ToastContext";
import { PwaReloadPrompt } from "./components/PwaReloadPrompt";
import { useOfflineDownloadNotifier, useOfflineStartup } from "./hooks/useOfflineStartup";

const AppContent: FC = () => {
  const [mode, setMode] = useState<"light" | "dark">("dark");
  const location = useLocation();
  const { user, isCheckingAuth } = useBandContext();
  const navigate = useNavigate();
  // Resume interrupted offline downloads, then GC (§4.4, §4.6).
  useOfflineStartup();
  useOfflineDownloadNotifier();

  useEffect(() => {
    document.documentElement.setAttribute("data-bs-theme", mode);
  }, [mode]);

  // Resume a pending invitation after the user logs in. OAuth/email logins
  // redirect back to the origin ("/"), so a token stashed by AcceptInvitation
  // would otherwise be lost — bounce the user back to finish accepting.
  useEffect(() => {
    if (isCheckingAuth || !user) return;
    const pendingToken = sessionStorage.getItem("pendingInviteToken");
    if (pendingToken && location.pathname !== "/invite/accept") {
      navigate(`/invite/accept?token=${pendingToken}`);
    }
  }, [user, isCheckingAuth, location.pathname, navigate]);

  const toggleMode = () => {
    setMode((prevMode) => (prevMode === "light" ? "dark" : "light"));
  };

  return (
    <AppWrapper>
      <AppNavbar mode={mode} onToggleMode={toggleMode} />

      <MainContent>
        <AppMain />
      </MainContent>
      {/* Show footer only on About page, Privacy, Terms, or Home when not logged in */}
      {(location.pathname === "/about" ||
        location.pathname === "/privacy" ||
        location.pathname === "/terms" ||
        (location.pathname === "/" && !user)) && <Footer />}
    </AppWrapper>
  );
};

const App: FC = () => (
  <BandProvider>
    <ToastProvider>
      <AppContent />
      <PwaReloadPrompt />
    </ToastProvider>
  </BandProvider>
);

// Styled Components

const AppWrapper = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
`;

const MainContent = styled.main`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

export default App;
