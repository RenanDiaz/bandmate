import type { FC, ReactNode } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Spinner } from "reactstrap";
import styled from "styled-components";
import Home from "./components/Home";
import { Login } from "./components/Login";
import SongsView from "./components/SongsView";
import SetlistsView from "./components/SetlistsView";
import SetlistEditor from "./components/SetlistEditor";
import SetlistDetailView from "./components/SetlistDetailView";
import SetlistPerformanceView from "./components/SetlistPerformanceView";
import SongPerformanceView from "./components/SongPerformanceView";
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
import { BandSelector } from "./components/BandSelector";
import { OfflineAware } from "./components/offline/OfflineAware";
import { OfflineBandPicker } from "./components/offline/OfflineBandPicker";
import { OfflineHome, OfflineSetlistsPage } from "./components/offline/OfflineHome";
import { NeedsConnection, OfflineEmptyState } from "./components/offline/OfflineMessage";
import { OfflineSetlistDetail } from "./components/offline/OfflineSetlistDetail";
import { useOfflineUi } from "./components/offline/useOfflineUi";
import { useBandContext } from "./context/useBandContext";
import { useBandFromQuery } from "./hooks/useBandFromQuery";

/**
 * The page area under the navbar: auth/band gates, then the routes.
 *
 * Offline (`useOfflineUi()`, spec §7.3) `/`, `/setlists` and
 * `/setlists/:setlistId` render their offline screens, performance mode reads
 * its snapshot, static pages stay, and every other route renders "This page
 * needs a connection". The switch is a render, not a navigation, so coming back
 * online shows the online view of the same route.
 */
export const AppMain: FC = () => {
  const location = useLocation();
  const { selectedBand, setSelectedBand, user, bands, setShowBandSelector, showBandSelector, isResolvingBand, isCheckingAuth } =
    useBandContext();
  const offlineUi = useOfflineUi();
  // A tapped notification opens `/shows/:id?band=<id>`: select the band first.
  const bandFromQueryPending = useBandFromQuery();
  const needsConnection = (element: ReactNode) => <OfflineAware offline={<NeedsConnection />}>{element}</OfflineAware>;

  if (isCheckingAuth || (user && isResolvingBand) || bandFromQueryPending) {
    return (
      <LoadingContainer>
        <Spinner color="light" />
      </LoadingContainer>
    );
  }

  if (user && (!selectedBand || showBandSelector) && location.pathname !== "/invite/accept") {
    if (!offlineUi) {
      return (
        <BandSelector
          onSelect={(band) => {
            setSelectedBand(band);
            setShowBandSelector(false);
          }}
          selectedBand={selectedBand || undefined}
        />
      );
    }
    // The BandSelector lists and creates bands on the server: never offline
    // (§7.2). With a band already selected the routes stay.
    if (!selectedBand) {
      return bands.length === 0 ? <OfflineEmptyState /> : <OfflineBandPicker bands={bands} onSelect={setSelectedBand} />;
    }
  }

  return (
    <Routes>
      <Route path="/" element={<OfflineAware offline={<OfflineHome />}><Home /></OfflineAware>} />
      <Route path="/login" element={<Login />} />
      <Route path="/songs" element={needsConnection(<SongsView user={user} selectedBand={selectedBand} />)} />
      <Route path="/songs/print" element={needsConnection(<PrintableSongbook />)} />
      {/* Online only: no snapshot lookup for a single song (song spec decision 3). */}
      <Route path="/songs/:songId/perform" element={needsConnection(<SongPerformanceView />)} />
      <Route
        path="/setlists"
        element={
          <OfflineAware offline={<OfflineSetlistsPage />}>
            <SetlistsView user={user} selectedBand={selectedBand} />
          </OfflineAware>
        }
      />
      <Route
        path="/setlists/:setlistId"
        element={
          <OfflineAware offline={<OfflineSetlistDetail />}>
            <SetlistDetailView />
          </OfflineAware>
        }
      />
      <Route path="/setlists/:setlistId/edit" element={needsConnection(<SetlistEditor />)} />
      {/* Offline, performance mode renders from the snapshot (§8.2). */}
      <Route path="/setlists/:setlistId/perform" element={<SetlistPerformanceView />} />
      <Route path="/setlists/:setlistId/print" element={needsConnection(<PrintableSetlist />)} />
      <Route path="/shows" element={needsConnection(<ShowsView user={user} selectedBand={selectedBand} />)} />
      <Route path="/shows/:showId" element={needsConnection(<ShowDetailView />)} />
      <Route path="/rehearsals" element={needsConnection(<RehearsalsView user={user} selectedBand={selectedBand} />)} />
      <Route path="/rehearsals/:rehearsalId" element={needsConnection(<RehearsalDetailView />)} />
      <Route path="/requests" element={needsConnection(<RequestsView user={user} selectedBand={selectedBand} />)} />
      <Route path="/requests/:requestId" element={needsConnection(<RequestDetailView />)} />
      <Route path="/bands/:bandId/settings" element={needsConnection(<BandSettings user={user} />)} />
      <Route path="/invite/accept" element={needsConnection(<AcceptInvitation />)} />
      <Route path="/about" element={<About />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermsOfService />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

const LoadingContainer = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
`;
