import type { FC } from "react";
import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Spinner } from "reactstrap";
import styled from "styled-components";
import { theme } from "../theme";
import { getSetlist } from "../services/setlistsService";
import type { Setlist } from "../services/setlistsService";
import { getBandSongs } from "../services/songsService";
import type { Song } from "../services/songsService";
import { SEO } from "./SEO";

const PrintableSetlist: FC = () => {
  const { setlistId } = useParams<{ setlistId: string }>();
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);

  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!setlistId) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const setlistData = await getSetlist(setlistId);
        setSetlist(setlistData);

        const allSongs = await getBandSongs(setlistData.band_id);

        const orderedSongs = setlistData.songs
          .sort((a, b) => a.position - b.position)
          .map((setlistSong) => allSongs.find((s) => s.id === setlistSong.song_id))
          .filter((song): song is Song => song !== undefined);

        setSongs(orderedSongs);
      } catch (error) {
        console.error("Failed to load setlist:", error);
        navigate("/setlists");
      }
      setLoading(false);
    };

    loadData();
  }, [setlistId, navigate]);

  const handlePrint = () => {
    window.print();
  };

  const handleBack = () => {
    navigate(`/setlists/${setlistId}`);
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    });
  };

  const calculateTotalDuration = (): number => {
    return songs.reduce((total, song) => total + (song.duration || 0), 0);
  };

  const getSetlistSongNotes = (songId: string): string | undefined => {
    if (!setlist) return undefined;
    const setlistSong = setlist.songs.find((s) => s.song_id === songId);
    return setlistSong?.notes;
  };

  if (loading) {
    return (
      <LoadingContainer>
        <Spinner color="primary" style={{ width: "3rem", height: "3rem" }} />
        <LoadingText>Loading setlist...</LoadingText>
      </LoadingContainer>
    );
  }

  if (!setlist) {
    return null;
  }

  const totalDuration = calculateTotalDuration();

  return (
    <PageWrapper>
      <SEO
        title={`${setlist.name} - Print`}
        description={`Printable setlist for ${setlist.name}. ${songs.length} songs with a total duration of ${Math.floor(totalDuration / 60)} minutes.`}
      />
      {/* Screen-only controls */}
      <ControlBar className="no-print">
        <BackButton onClick={handleBack}>
          <i className="bi bi-arrow-left"></i>
          Back to Setlist
        </BackButton>
        <PrintButton onClick={handlePrint}>
          <i className="bi bi-printer"></i>
          Print Setlist
        </PrintButton>
      </ControlBar>

      {/* Printable content */}
      <PrintContainer ref={printRef}>
        <PrintHeader>
          <SetlistName>{setlist.name}</SetlistName>
          {setlist.description && (
            <SetlistDescription>{setlist.description}</SetlistDescription>
          )}
          <MetaRow>
            {setlist.venue && (
              <MetaItem>
                <MetaLabel>Venue:</MetaLabel> {setlist.venue}
              </MetaItem>
            )}
            {setlist.event_date && (
              <MetaItem>
                <MetaLabel>Date:</MetaLabel> {formatDate(setlist.event_date)}
              </MetaItem>
            )}
            <MetaItem>
              <MetaLabel>Songs:</MetaLabel> {songs.length}
            </MetaItem>
            {totalDuration > 0 && (
              <MetaItem>
                <MetaLabel>Duration:</MetaLabel> {formatDuration(totalDuration)}
              </MetaItem>
            )}
          </MetaRow>
        </PrintHeader>

        <SongsTable>
          <thead>
            <tr>
              <TableHeader className="num">#</TableHeader>
              <TableHeader className="title">Song</TableHeader>
              <TableHeader className="artist">Artist</TableHeader>
              <TableHeader className="key">Key</TableHeader>
              <TableHeader className="tempo">BPM</TableHeader>
              <TableHeader className="duration">Time</TableHeader>
            </tr>
          </thead>
          <tbody>
            {songs.map((song, index) => {
              const notes = getSetlistSongNotes(song.id);
              return (
                <TableRow key={song.id} $hasNotes={!!notes}>
                  <TableCell className="num">{index + 1}</TableCell>
                  <TableCell className="title">
                    <SongTitle>{song.title}</SongTitle>
                    {notes && <SongNotes>{notes}</SongNotes>}
                  </TableCell>
                  <TableCell className="artist">{song.artist || "-"}</TableCell>
                  <TableCell className="key">{song.key || "-"}</TableCell>
                  <TableCell className="tempo">{song.tempo || "-"}</TableCell>
                  <TableCell className="duration">
                    {song.duration ? formatDuration(song.duration) : "-"}
                  </TableCell>
                </TableRow>
              );
            })}
          </tbody>
          <tfoot>
            <TableRow>
              <TableFooter colSpan={5} className="total-label">Total Duration:</TableFooter>
              <TableFooter className="total-value">
                {totalDuration > 0 ? formatDuration(totalDuration) : "-"}
              </TableFooter>
            </TableRow>
          </tfoot>
        </SongsTable>

        <PrintFooter>
          <FooterText>Generated by Bandmate</FooterText>
          <FooterText>{new Date().toLocaleDateString()}</FooterText>
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
  padding: ${theme.space[4]} ${theme.space[6]};
  background: ${theme.colors.dark.bg.secondary};
  border-bottom: 1px solid ${theme.colors.dark.border.default};
  position: sticky;
  top: 0;
  z-index: 100;

  @media print {
    display: none !important;
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
  max-width: 800px;
  margin: 0 auto;
  padding: ${theme.space[8]};
  background: white;
  color: black;
  min-height: calc(100vh - 80px);

  @media print {
    max-width: 100%;
    padding: 0;
    margin: 0;
    min-height: auto;
  }
`;

const PrintHeader = styled.div`
  border-bottom: 2px solid #333;
  padding-bottom: ${theme.space[4]};
  margin-bottom: ${theme.space[6]};

  @media print {
    padding-bottom: 12pt;
    margin-bottom: 18pt;
  }
`;

const SetlistName = styled.h1`
  font-size: 28px;
  font-weight: 700;
  color: black;
  margin: 0 0 ${theme.space[2]} 0;

  @media print {
    font-size: 24pt;
    margin-bottom: 6pt;
  }
`;

const SetlistDescription = styled.p`
  font-size: 14px;
  color: #555;
  margin: 0 0 ${theme.space[4]} 0;
  line-height: 1.5;

  @media print {
    font-size: 11pt;
    margin-bottom: 12pt;
  }
`;

const MetaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${theme.space[4]};

  @media print {
    gap: 16pt;
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

const SongsTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-bottom: ${theme.space[6]};

  @media print {
    margin-bottom: 18pt;
  }
`;

const TableHeader = styled.th`
  text-align: left;
  padding: ${theme.space[3]} ${theme.space[2]};
  border-bottom: 2px solid #333;
  font-size: 12px;
  font-weight: 700;
  color: #333;
  text-transform: uppercase;
  letter-spacing: 0.5px;

  &.num {
    width: 40px;
    text-align: center;
  }

  &.title {
    width: auto;
  }

  &.artist {
    width: 150px;
  }

  &.key {
    width: 60px;
    text-align: center;
  }

  &.tempo {
    width: 60px;
    text-align: center;
  }

  &.duration {
    width: 70px;
    text-align: right;
  }

  @media print {
    font-size: 9pt;
    padding: 8pt 4pt;

    &.artist {
      width: 120px;
    }
  }

  @media (max-width: ${theme.breakpoints.md}) {
    &.artist,
    &.tempo {
      display: none;
    }
  }
`;

const TableRow = styled.tr<{ $hasNotes?: boolean }>`
  border-bottom: 1px solid #ddd;

  &:nth-child(even) {
    background: #f9f9f9;
  }

  &:last-child {
    border-bottom: none;
  }

  @media print {
    page-break-inside: avoid;

    &:nth-child(even) {
      background: #f5f5f5;
    }
  }
`;

const TableCell = styled.td`
  padding: ${theme.space[3]} ${theme.space[2]};
  font-size: 14px;
  color: #333;
  vertical-align: top;

  &.num {
    text-align: center;
    font-weight: 600;
    color: #666;
  }

  &.key,
  &.tempo {
    text-align: center;
  }

  &.duration {
    text-align: right;
    font-family: "JetBrains Mono", monospace;
  }

  @media print {
    font-size: 10pt;
    padding: 6pt 4pt;
  }

  @media (max-width: ${theme.breakpoints.md}) {
    &.artist,
    &.tempo {
      display: none;
    }
  }
`;

const SongTitle = styled.div`
  font-weight: 600;
  color: black;
`;

const SongNotes = styled.div`
  font-size: 12px;
  color: #666;
  font-style: italic;
  margin-top: 4px;
  padding-left: 8px;
  border-left: 2px solid #ddd;

  @media print {
    font-size: 9pt;
  }
`;

const TableFooter = styled.td`
  padding: ${theme.space[3]} ${theme.space[2]};
  font-size: 14px;
  font-weight: 700;
  border-top: 2px solid #333;

  &.total-label {
    text-align: right;
  }

  &.total-value {
    text-align: right;
    font-family: "JetBrains Mono", monospace;
  }

  @media print {
    font-size: 10pt;
    padding: 8pt 4pt;
  }
`;

const PrintFooter = styled.div`
  display: flex;
  justify-content: space-between;
  padding-top: ${theme.space[4]};
  border-top: 1px solid #ddd;
  margin-top: auto;

  @media print {
    padding-top: 12pt;
    margin-top: 24pt;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    padding-left: 20pt;
    padding-right: 20pt;
    background: white;
  }
`;

const FooterText = styled.span`
  font-size: 11px;
  color: #888;

  @media print {
    font-size: 8pt;
  }
`;

export default PrintableSetlist;
