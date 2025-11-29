import type { FC } from "react";
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Spinner } from "reactstrap";
import styled from "styled-components";
import { theme } from "../theme";
import { useBandContext } from "../context/useBandContext";
import { getBandSongs } from "../services/songsService";
import type { Song } from "../services/songsService";
import { SEO } from "./SEO";

type SortOption = "title" | "artist" | "key" | "tempo";

const PrintableSongbook: FC = () => {
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);
  const { selectedBand } = useBandContext();

  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>("title");
  const [showAlbum, setShowAlbum] = useState(true);
  const [showTempo, setShowTempo] = useState(true);
  const [showKey, setShowKey] = useState(true);
  const [showDuration, setShowDuration] = useState(true);

  useEffect(() => {
    if (!selectedBand) {
      navigate("/songs");
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        const songsData = await getBandSongs(selectedBand.id);
        setSongs(songsData);
      } catch (error) {
        console.error("Failed to load songs:", error);
        navigate("/songs");
      }
      setLoading(false);
    };

    loadData();
  }, [selectedBand, navigate]);

  const handlePrint = () => {
    window.print();
  };

  const handleBack = () => {
    navigate("/songs");
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const sortedSongs = [...songs].sort((a, b) => {
    switch (sortBy) {
      case "title":
        return a.title.localeCompare(b.title);
      case "artist":
        return (a.artist || "").localeCompare(b.artist || "");
      case "key":
        return (a.key || "").localeCompare(b.key || "");
      case "tempo":
        return (a.tempo || 0) - (b.tempo || 0);
      default:
        return 0;
    }
  });

  // Group songs by first letter for alphabetical display
  const groupedSongs = sortBy === "title" || sortBy === "artist"
    ? sortedSongs.reduce((acc, song) => {
        const key = sortBy === "title" ? song.title : (song.artist || "Unknown");
        const letter = key.charAt(0).toUpperCase();
        if (!acc[letter]) {
          acc[letter] = [];
        }
        acc[letter].push(song);
        return acc;
      }, {} as Record<string, Song[]>)
    : null;

  if (loading) {
    return (
      <LoadingContainer>
        <Spinner color="primary" style={{ width: "3rem", height: "3rem" }} />
        <LoadingText>Loading songs...</LoadingText>
      </LoadingContainer>
    );
  }

  if (!selectedBand) {
    return null;
  }

  return (
    <PageWrapper>
      <SEO
        title={`${selectedBand.name} Songbook - Print`}
        description={`Printable songbook for ${selectedBand.name}. Complete catalog of ${songs.length} songs sorted by ${sortBy}.`}
      />
      {/* Screen-only controls */}
      <ControlBar className="no-print">
        <BackButton onClick={handleBack}>
          <i className="bi bi-arrow-left"></i>
          Back to Songs
        </BackButton>

        <ControlsGroup>
          <ControlLabel>Sort by:</ControlLabel>
          <Select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)}>
            <option value="title">Title (A-Z)</option>
            <option value="artist">Artist (A-Z)</option>
            <option value="key">Key</option>
            <option value="tempo">Tempo</option>
          </Select>
        </ControlsGroup>

        <ControlsGroup>
          <ControlLabel>Show columns:</ControlLabel>
          <CheckboxLabel>
            <input type="checkbox" checked={showKey} onChange={(e) => setShowKey(e.target.checked)} />
            Key
          </CheckboxLabel>
          <CheckboxLabel>
            <input type="checkbox" checked={showTempo} onChange={(e) => setShowTempo(e.target.checked)} />
            BPM
          </CheckboxLabel>
          <CheckboxLabel>
            <input type="checkbox" checked={showAlbum} onChange={(e) => setShowAlbum(e.target.checked)} />
            Album
          </CheckboxLabel>
          <CheckboxLabel>
            <input type="checkbox" checked={showDuration} onChange={(e) => setShowDuration(e.target.checked)} />
            Duration
          </CheckboxLabel>
        </ControlsGroup>

        <PrintButton onClick={handlePrint}>
          <i className="bi bi-printer"></i>
          Print Songbook
        </PrintButton>
      </ControlBar>

      {/* Printable content */}
      <PrintContainer ref={printRef}>
        <PrintHeader>
          <BandName>{selectedBand.name}</BandName>
          <Subtitle>Song Catalog</Subtitle>
          <MetaRow>
            <MetaItem>
              <MetaLabel>Total Songs:</MetaLabel> {songs.length}
            </MetaItem>
            <MetaItem>
              <MetaLabel>Sorted by:</MetaLabel> {sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}
            </MetaItem>
          </MetaRow>
        </PrintHeader>

        {groupedSongs ? (
          // Alphabetical grouping
          Object.keys(groupedSongs).sort().map((letter) => (
            <SongGroup key={letter}>
              <GroupHeader>{letter}</GroupHeader>
              <SongsTable>
                <thead>
                  <tr>
                    <TableHeader className="num">#</TableHeader>
                    <TableHeader className="title">Title</TableHeader>
                    <TableHeader className="artist">Artist</TableHeader>
                    {showKey && <TableHeader className="key">Key</TableHeader>}
                    {showTempo && <TableHeader className="tempo">BPM</TableHeader>}
                    {showAlbum && <TableHeader className="album">Album</TableHeader>}
                    {showDuration && <TableHeader className="duration">Time</TableHeader>}
                  </tr>
                </thead>
                <tbody>
                  {groupedSongs[letter].map((song, index) => (
                    <TableRow key={song.id}>
                      <TableCell className="num">{index + 1}</TableCell>
                      <TableCell className="title">{song.title}</TableCell>
                      <TableCell className="artist">{song.artist || "-"}</TableCell>
                      {showKey && <TableCell className="key">{song.key || "-"}</TableCell>}
                      {showTempo && <TableCell className="tempo">{song.tempo || "-"}</TableCell>}
                      {showAlbum && <TableCell className="album">{song.album || "-"}</TableCell>}
                      {showDuration && (
                        <TableCell className="duration">
                          {song.duration ? formatDuration(song.duration) : "-"}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </tbody>
              </SongsTable>
            </SongGroup>
          ))
        ) : (
          // Regular table for non-alphabetical sorting
          <SongsTable>
            <thead>
              <tr>
                <TableHeader className="num">#</TableHeader>
                <TableHeader className="title">Title</TableHeader>
                <TableHeader className="artist">Artist</TableHeader>
                {showKey && <TableHeader className="key">Key</TableHeader>}
                {showTempo && <TableHeader className="tempo">BPM</TableHeader>}
                {showAlbum && <TableHeader className="album">Album</TableHeader>}
                {showDuration && <TableHeader className="duration">Time</TableHeader>}
              </tr>
            </thead>
            <tbody>
              {sortedSongs.map((song, index) => (
                <TableRow key={song.id}>
                  <TableCell className="num">{index + 1}</TableCell>
                  <TableCell className="title">{song.title}</TableCell>
                  <TableCell className="artist">{song.artist || "-"}</TableCell>
                  {showKey && <TableCell className="key">{song.key || "-"}</TableCell>}
                  {showTempo && <TableCell className="tempo">{song.tempo || "-"}</TableCell>}
                  {showAlbum && <TableCell className="album">{song.album || "-"}</TableCell>}
                  {showDuration && (
                    <TableCell className="duration">
                      {song.duration ? formatDuration(song.duration) : "-"}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </tbody>
          </SongsTable>
        )}

        <PrintFooter>
          <FooterText>{selectedBand.name} - Song Catalog</FooterText>
          <FooterText>Generated by Bandmate - {new Date().toLocaleDateString()}</FooterText>
        </PrintFooter>
      </PrintContainer>
    </PageWrapper>
  );
};

// Styled Components

const PageWrapper = styled.div`
  min-height: 100vh;
  background: ${theme.colors.dark.bg.primary};

  @media print {
    background: white;
    min-height: auto;
  }
`;

const ControlBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: ${theme.space[4]};
  padding: ${theme.space[4]} ${theme.space[6]};
  background: ${theme.colors.dark.bg.secondary};
  border-bottom: 1px solid ${theme.colors.dark.border.default};
  position: sticky;
  top: 0;
  z-index: 100;

  @media print {
    display: none !important;
  }

  @media (max-width: ${theme.breakpoints.md}) {
    flex-direction: column;
    align-items: flex-start;
  }
`;

const ControlsGroup = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  flex-wrap: wrap;
`;

const ControlLabel = styled.span`
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.dark.text.secondary};
  font-weight: ${theme.fontWeights.medium};
`;

const Select = styled.select`
  background: ${theme.colors.dark.bg.tertiary};
  border: 1px solid ${theme.colors.dark.border.default};
  color: ${theme.colors.dark.text.primary};
  padding: ${theme.space[2]} ${theme.space[3]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodySm};
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: ${theme.colors.brand.primary};
  }
`;

const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  gap: ${theme.space[1]};
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.dark.text.secondary};
  cursor: pointer;

  input {
    accent-color: ${theme.colors.brand.primary};
  }
`;

const BackButton = styled.button`
  background: transparent;
  border: 1px solid ${theme.colors.dark.border.default};
  color: ${theme.colors.dark.text.secondary};
  padding: ${theme.space[2]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  transition: all ${theme.transitions.fast} ease;

  &:hover {
    border-color: ${theme.colors.brand.primary};
    color: ${theme.colors.brand.primary};
  }
`;

const PrintButton = styled.button`
  background: ${theme.colors.brand.primary};
  border: none;
  color: white;
  padding: ${theme.space[2]} ${theme.space[5]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  transition: all ${theme.transitions.fast} ease;

  &:hover {
    background: ${theme.colors.brand.primaryHover};
    transform: translateY(-1px);
  }
`;

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: ${theme.space[4]};
`;

const LoadingText = styled.p`
  font-size: ${theme.fontSizes.body};
  color: ${theme.colors.dark.text.secondary};
  margin: 0;
`;

const PrintContainer = styled.div`
  max-width: 900px;
  margin: 0 auto;
  padding: ${theme.space[8]};
  background: white;
  color: black;
  min-height: calc(100vh - 100px);

  @media print {
    max-width: 100%;
    padding: 20pt;
    margin: 0;
    min-height: auto;
  }
`;

const PrintHeader = styled.div`
  text-align: center;
  border-bottom: 3px solid #333;
  padding-bottom: ${theme.space[6]};
  margin-bottom: ${theme.space[8]};

  @media print {
    padding-bottom: 18pt;
    margin-bottom: 24pt;
  }
`;

const BandName = styled.h1`
  font-size: 36px;
  font-weight: 700;
  color: black;
  margin: 0 0 ${theme.space[2]} 0;
  text-transform: uppercase;
  letter-spacing: 2px;

  @media print {
    font-size: 28pt;
    margin-bottom: 6pt;
  }
`;

const Subtitle = styled.h2`
  font-size: 20px;
  font-weight: 400;
  color: #555;
  margin: 0 0 ${theme.space[4]} 0;
  letter-spacing: 1px;

  @media print {
    font-size: 14pt;
    margin-bottom: 12pt;
  }
`;

const MetaRow = styled.div`
  display: flex;
  justify-content: center;
  gap: ${theme.space[6]};

  @media print {
    gap: 24pt;
  }
`;

const MetaItem = styled.span`
  font-size: 13px;
  color: #333;

  @media print {
    font-size: 10pt;
  }
`;

const MetaLabel = styled.span`
  font-weight: 600;
`;

const SongGroup = styled.div`
  margin-bottom: ${theme.space[6]};
  page-break-inside: avoid;

  @media print {
    margin-bottom: 18pt;
  }
`;

const GroupHeader = styled.h3`
  font-size: 24px;
  font-weight: 700;
  color: #333;
  margin: 0 0 ${theme.space[3]} 0;
  padding-bottom: ${theme.space[2]};
  border-bottom: 2px solid ${theme.colors.brand.primary};

  @media print {
    font-size: 16pt;
    margin-bottom: 8pt;
    padding-bottom: 4pt;
    border-bottom-color: #333;
  }
`;

const SongsTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-bottom: ${theme.space[4]};

  @media print {
    margin-bottom: 12pt;
  }
`;

const TableHeader = styled.th`
  text-align: left;
  padding: ${theme.space[2]} ${theme.space[2]};
  border-bottom: 2px solid #333;
  font-size: 11px;
  font-weight: 700;
  color: #333;
  text-transform: uppercase;
  letter-spacing: 0.5px;

  &.num {
    width: 35px;
    text-align: center;
  }

  &.title {
    width: auto;
  }

  &.artist {
    width: 140px;
  }

  &.key {
    width: 50px;
    text-align: center;
  }

  &.tempo {
    width: 50px;
    text-align: center;
  }

  &.album {
    width: 120px;
  }

  &.duration {
    width: 60px;
    text-align: right;
  }

  @media print {
    font-size: 8pt;
    padding: 6pt 4pt;
  }

  @media (max-width: ${theme.breakpoints.md}) {
    &.album {
      display: none;
    }
  }
`;

const TableRow = styled.tr`
  border-bottom: 1px solid #ddd;

  &:nth-child(even) {
    background: #f9f9f9;
  }

  @media print {
    &:nth-child(even) {
      background: #f5f5f5;
    }
  }
`;

const TableCell = styled.td`
  padding: ${theme.space[2]} ${theme.space[2]};
  font-size: 13px;
  color: #333;
  vertical-align: middle;

  &.num {
    text-align: center;
    font-weight: 500;
    color: #666;
  }

  &.title {
    font-weight: 600;
  }

  &.key,
  &.tempo {
    text-align: center;
  }

  &.duration {
    text-align: right;
    font-family: "JetBrains Mono", monospace;
    font-size: 12px;
  }

  @media print {
    font-size: 9pt;
    padding: 4pt 4pt;

    &.duration {
      font-size: 8pt;
    }
  }

  @media (max-width: ${theme.breakpoints.md}) {
    &.album {
      display: none;
    }
  }
`;

const PrintFooter = styled.div`
  display: flex;
  justify-content: space-between;
  padding-top: ${theme.space[4]};
  border-top: 1px solid #ddd;
  margin-top: ${theme.space[8]};

  @media print {
    padding-top: 12pt;
    margin-top: 24pt;
  }
`;

const FooterText = styled.span`
  font-size: 11px;
  color: #888;

  @media print {
    font-size: 8pt;
  }
`;

export default PrintableSongbook;
