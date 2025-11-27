import type { FC } from "react";
import { useState } from "react";
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Spinner, Alert } from "reactstrap";
import styled from "styled-components";
import Papa from "papaparse";
import { theme } from "../theme";
import { createSong, getBandSongs, type CreateSongInput, type Song } from "../services/songsService";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
  bandId: number;
}

interface ParsedSong {
  title: string;
  artist?: string;
  language?: string;
  country?: string;
  releaseYear?: string;
  duration?: string;
  tempo?: string;
  key?: string;
  mode?: string;
  electric?: string;
  acoustic?: string;
  sequence?: string;
}

interface ImportError {
  row: number;
  message: string;
}

export const ImportSongsModal: FC<Props> = ({ isOpen, onClose, onImportComplete, bandId }) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedSongs, setParsedSongs] = useState<ParsedSong[]>([]);
  const [importing, setImporting] = useState(false);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [successCount, setSuccessCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setErrors([]);
    setParsedSongs([]);
    setSuccessCount(0);
    setSkippedCount(0);

    // Parse CSV
    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const songs = results.data as ParsedSong[];
        setParsedSongs(songs);
      },
      error: (error) => {
        setErrors([{ row: 0, message: `Parse error: ${error.message}` }]);
      },
    });
  };

  const parseDuration = (duration: string): number | undefined => {
    if (!duration) return undefined;

    // Parse "3:35" format to seconds
    const match = duration.match(/(\d+):(\d+)/);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      return minutes * 60 + seconds;
    }

    // If it's just a number, assume it's already in seconds
    const num = parseInt(duration, 10);
    return isNaN(num) ? undefined : num;
  };

  const parseTempo = (tempo: string): number | undefined => {
    if (!tempo) return undefined;

    // Parse "120 BPM" format or just "120"
    const match = tempo.match(/(\d+)/);
    if (match) {
      const bpm = parseInt(match[1], 10);
      return isNaN(bpm) ? undefined : bpm;
    }

    return undefined;
  };

  const parseKey = (key: string, mode: string): string | undefined => {
    if (!key) return undefined;

    // Combine key and mode: "C" + "Major" = "C Major"
    // or "A" + "Minor" = "Am"
    if (!mode) return key;

    const modeLower = mode.toLowerCase();
    if (modeLower === "minor") {
      return `${key}m`;
    } else if (modeLower === "major") {
      return key; // Just "C" for C Major
    } else {
      // For other modes like Phrygian, Lydian, etc.
      return `${key} ${mode}`;
    }
  };

  const parseTags = (electric: string, acoustic: string, sequence: string): string[] => {
    const tags: string[] = [];

    // Handle checkboxes - could be "TRUE", "FALSE", "1", "0", "yes", "no", etc.
    const isTrue = (value: string) => {
      if (!value) return false;
      const v = value.toLowerCase().trim();
      return v === "true" || v === "1" || v === "yes" || v === "x";
    };

    if (isTrue(electric)) tags.push("electric");
    if (isTrue(acoustic)) tags.push("acoustic");
    if (isTrue(sequence)) tags.push("backing-track");

    return tags;
  };

  const handleImport = async () => {
    if (parsedSongs.length === 0) return;

    setImporting(true);
    setErrors([]);
    setSuccessCount(0);
    setSkippedCount(0);

    // Fetch existing songs to check for duplicates
    let existingSongs: Song[] = [];
    try {
      existingSongs = await getBandSongs(bandId);
    } catch (error) {
      console.error("Failed to fetch existing songs:", error);
    }

    // Create a Set of normalized song identifiers (title + artist) for fast lookup
    const existingSongKeys = new Set(
      existingSongs.map(s =>
        `${s.title.toLowerCase().trim()}|${(s.artist || "").toLowerCase().trim()}`
      )
    );

    const importErrors: ImportError[] = [];
    let successfulImports = 0;
    let skippedDuplicates = 0;

    for (let i = 0; i < parsedSongs.length; i++) {
      const song = parsedSongs[i];

      // Validate required fields
      if (!song.title || song.title.trim() === "") {
        importErrors.push({ row: i + 1, message: "Missing title" });
        continue;
      }

      // Check for duplicates (title + artist match)
      const songKey = `${song.title.toLowerCase().trim()}|${(song.artist || "").toLowerCase().trim()}`;
      if (existingSongKeys.has(songKey)) {
        skippedDuplicates++;
        continue;
      }

      try {
        const tags = parseTags(song.electric || "", song.acoustic || "", song.sequence || "");
        const hasBackingTracks = (song.sequence || "").toLowerCase() === "true" ||
                                  (song.sequence || "").toLowerCase() === "1" ||
                                  (song.sequence || "").toLowerCase() === "yes" ||
                                  (song.sequence || "").toLowerCase() === "x";

        const songInput: CreateSongInput = {
          band_id: bandId,
          title: song.title.trim(),
          artist: song.artist?.trim(),
          language: song.language?.trim(),
          country: song.country?.trim(),
          release_date: song.releaseYear?.trim(),
          duration: parseDuration(song.duration || ""),
          tempo: parseTempo(song.tempo || ""),
          key: parseKey(song.key || "", song.mode || ""),
          tags: tags.length > 0 ? tags : undefined,
          has_backing_tracks: hasBackingTracks,
        };

        await createSong(songInput);
        successfulImports++;
      } catch (error) {
        importErrors.push({
          row: i + 1,
          message: error instanceof Error ? error.message : "Failed to import"
        });
      }
    }

    setSuccessCount(successfulImports);
    setSkippedCount(skippedDuplicates);
    setErrors(importErrors);
    setImporting(false);

    if (importErrors.length === 0 && successfulImports > 0) {
      // All succeeded - close modal and refresh
      setTimeout(() => {
        handleClose();
        onImportComplete();
      }, 1500);
    }
  };

  const handleClose = () => {
    setFile(null);
    setParsedSongs([]);
    setErrors([]);
    setSuccessCount(0);
    setSkippedCount(0);
    onClose();
  };

  const validSongsCount = parsedSongs.filter(s => s.title && s.title.trim() !== "").length;

  return (
    <Modal isOpen={isOpen} toggle={handleClose} size="lg">
      <ModalHeader toggle={handleClose}>Import Songs from CSV</ModalHeader>
      <ModalBody>
        <Instructions>
          <InstructionTitle>
            <i className="bi bi-info-circle"></i>
            CSV Format Instructions
          </InstructionTitle>
          <InstructionText>
            Your CSV file should have these columns (column names must match exactly):
          </InstructionText>
          <ColumnList>
            <li><code>Title</code> (required)</li>
            <li><code>Artist</code></li>
            <li><code>Language</code></li>
            <li><code>Country</code></li>
            <li><code>Release year</code></li>
            <li><code>Duration</code> (format: MM:SS, e.g., "3:35")</li>
            <li><code>Tempo</code> (format: "120 BPM" or just "120")</li>
            <li><code>Key</code> (note, e.g., "C", "Am")</li>
            <li><code>Mode</code> (Major, Minor, Phrygian, Lydian, etc.)</li>
            <li><code>Electric</code> (checkbox: TRUE/FALSE)</li>
            <li><code>Acoustic</code> (checkbox: TRUE/FALSE)</li>
            <li><code>Sequence</code> (checkbox: TRUE/FALSE for backing track)</li>
          </ColumnList>
          <InstructionText>
            Export your Google Sheet as CSV: <strong>File → Download → Comma Separated Values (.csv)</strong>
          </InstructionText>
        </Instructions>

        <FileInputWrapper>
          <FileLabel htmlFor="csv-file">
            <i className="bi bi-file-earmark-arrow-up"></i>
            {file ? file.name : "Choose CSV file"}
          </FileLabel>
          <FileInput
            id="csv-file"
            type="file"
            accept=".csv,.tsv,text/csv,text/tab-separated-values"
            onChange={handleFileChange}
          />
        </FileInputWrapper>

        {parsedSongs.length > 0 && (
          <PreviewSection>
            <PreviewHeader>
              <PreviewTitle>Preview ({validSongsCount} valid songs)</PreviewTitle>
              <PreviewSubtitle>
                Review the songs below before importing
              </PreviewSubtitle>
            </PreviewHeader>
            <PreviewTable>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Title</th>
                  <th>Artist</th>
                  <th>Key</th>
                  <th>Tempo</th>
                  <th>Duration</th>
                  <th>Tags</th>
                </tr>
              </thead>
              <tbody>
                {parsedSongs.slice(0, 10).map((song, idx) => {
                  const tags = parseTags(song.electric || "", song.acoustic || "", song.sequence || "");
                  const isValid = song.title && song.title.trim() !== "";

                  return (
                    <tr key={idx} className={!isValid ? "invalid" : ""}>
                      <td>{idx + 1}</td>
                      <td>{song.title || <em>Missing title</em>}</td>
                      <td>{song.artist || "-"}</td>
                      <td>{parseKey(song.key || "", song.mode || "") || "-"}</td>
                      <td>{parseTempo(song.tempo || "") || "-"}</td>
                      <td>{parseDuration(song.duration || "") || "-"}</td>
                      <td>{tags.join(", ") || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </PreviewTable>
            {parsedSongs.length > 10 && (
              <PreviewFooter>
                Showing first 10 of {parsedSongs.length} songs
              </PreviewFooter>
            )}
          </PreviewSection>
        )}

        {successCount > 0 && (
          <Alert color="success">
            Successfully imported {successCount} song{successCount !== 1 ? "s" : ""}!
            {skippedCount > 0 && (
              <> ({skippedCount} duplicate{skippedCount !== 1 ? "s" : ""} skipped)</>
            )}
          </Alert>
        )}

        {skippedCount > 0 && successCount === 0 && errors.length === 0 && (
          <Alert color="warning">
            <i className="bi bi-info-circle"></i> All {skippedCount} song{skippedCount !== 1 ? "s" : ""} already exist in your library (duplicates skipped)
          </Alert>
        )}

        {errors.length > 0 && (
          <ErrorSection>
            <ErrorTitle>
              <i className="bi bi-exclamation-triangle"></i>
              Import Errors ({errors.length})
            </ErrorTitle>
            <ErrorList>
              {errors.slice(0, 5).map((error, idx) => (
                <ErrorItem key={idx}>
                  Row {error.row}: {error.message}
                </ErrorItem>
              ))}
              {errors.length > 5 && (
                <ErrorItem>... and {errors.length - 5} more errors</ErrorItem>
              )}
            </ErrorList>
          </ErrorSection>
        )}
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={handleClose} disabled={importing}>
          Cancel
        </Button>
        <Button
          color="primary"
          onClick={handleImport}
          disabled={importing || parsedSongs.length === 0 || validSongsCount === 0}
        >
          {importing ? (
            <>
              <Spinner size="sm" /> Importing...
            </>
          ) : (
            <>Import {validSongsCount} Song{validSongsCount !== 1 ? "s" : ""}</>
          )}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

// Styled Components

const Instructions = styled.div`
  background: ${theme.colors.dark.bg.secondary};
  border: 1px solid ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.base};
  padding: ${theme.space[4]};
  margin-bottom: ${theme.space[6]};
`;

const InstructionTitle = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.dark.text.primary};
  margin-bottom: ${theme.space[3]};

  i {
    color: ${theme.colors.brand.primary};
  }
`;

const InstructionText = styled.p`
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.dark.text.secondary};
  margin: ${theme.space[2]} 0;
  line-height: ${theme.lineHeights.relaxed};

  strong {
    color: ${theme.colors.dark.text.primary};
  }
`;

const ColumnList = styled.ul`
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.dark.text.secondary};
  margin: ${theme.space[2]} 0;
  padding-left: ${theme.space[6]};
  line-height: ${theme.lineHeights.relaxed};

  code {
    background: ${theme.colors.dark.bg.tertiary};
    padding: ${theme.space[1]} ${theme.space[2]};
    border-radius: ${theme.radius.sm};
    font-family: monospace;
    color: ${theme.colors.brand.primary};
  }
`;

const FileInputWrapper = styled.div`
  margin-bottom: ${theme.space[6]};
`;

const FileInput = styled.input`
  display: none;
`;

const FileLabel = styled.label`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${theme.space[3]};
  background: ${theme.colors.dark.bg.secondary};
  border: 2px dashed ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.base};
  padding: ${theme.space[8]} ${theme.space[4]};
  color: ${theme.colors.dark.text.secondary};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  i {
    font-size: ${theme.fontSizes.h2};
    color: ${theme.colors.brand.primary};
  }

  &:hover {
    border-color: ${theme.colors.brand.primary};
    background: ${theme.colors.dark.bg.tertiary};
    color: ${theme.colors.dark.text.primary};
  }
`;

const PreviewSection = styled.div`
  margin-top: ${theme.space[6]};
  margin-bottom: ${theme.space[6]};
`;

const PreviewHeader = styled.div`
  margin-bottom: ${theme.space[4]};
`;

const PreviewTitle = styled.div`
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.dark.text.primary};
  margin-bottom: ${theme.space[1]};
`;

const PreviewSubtitle = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.dark.text.secondary};
`;

const PreviewTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: ${theme.fontSizes.bodySm};
  background: ${theme.colors.dark.bg.secondary};
  border: 1px solid ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.base};
  overflow: hidden;

  th, td {
    padding: ${theme.space[2]} ${theme.space[3]};
    text-align: left;
    border-bottom: 1px solid ${theme.colors.dark.border.default};
  }

  th {
    background: ${theme.colors.dark.bg.tertiary};
    color: ${theme.colors.dark.text.secondary};
    font-weight: ${theme.fontWeights.semibold};
    text-transform: uppercase;
    letter-spacing: ${theme.letterSpacing.wide};
    font-size: ${theme.fontSizes.bodyXs};
  }

  td {
    color: ${theme.colors.dark.text.primary};
  }

  tbody tr:last-child td {
    border-bottom: none;
  }

  tbody tr.invalid {
    opacity: 0.5;
    background: ${theme.colors.dark.bg.tertiary};

    td em {
      color: ${theme.colors.semantic.error};
      font-style: italic;
    }
  }

  tbody tr:hover:not(.invalid) {
    background: ${theme.colors.dark.bg.tertiary};
  }
`;

const PreviewFooter = styled.div`
  margin-top: ${theme.space[2]};
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.dark.text.secondary};
  text-align: center;
  font-style: italic;
`;

const ErrorSection = styled.div`
  background: rgba(220, 38, 38, 0.1);
  border: 1px solid ${theme.colors.semantic.error};
  border-radius: ${theme.radius.base};
  padding: ${theme.space[4]};
  margin-top: ${theme.space[4]};
`;

const ErrorTitle = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.semantic.error};
  margin-bottom: ${theme.space[3]};
`;

const ErrorList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;

const ErrorItem = styled.li`
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.dark.text.secondary};
  padding: ${theme.space[1]} 0;
  font-family: monospace;
`;
