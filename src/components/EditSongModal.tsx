import { useState, useEffect } from "react";
import styled from "styled-components";
import { theme } from "../theme";
import type { Song, UpdateSongInput, SectionTiming, LineTiming } from "../services/songsService";
import { metadataService } from "../services/metadataService";
import { SectionEditor } from "./SectionEditor";
import { TimingSyncModal } from "./TimingSyncModal";
import { LineSyncModal } from "./LineSyncModal";
import SheetMusicUpload from "./SheetMusicUpload";
import { useTranslation } from "react-i18next";
import { useToast } from "../context/useToast";

interface Props {
  song: Song | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (songId: string, updates: UpdateSongInput) => Promise<void>;
}

export const EditSongModal = ({ song, isOpen, onClose, onSave }: Props) => {
  const { t } = useTranslation();
  const toast = useToast();
  const [formData, setFormData] = useState({
    title: "",
    artist: "",
    lyrics: "",
    chords: "",
    key: "",
    tempo: "",
    duration: "",
    releaseDate: "",
    energy: "",
    danceability: "",
    tags: "",
    language: "",
    country: "",
    hasBackingTracks: false,
  });
  const [chordSections, setChordSections] = useState<SectionTiming[]>([]);
  const [lyricsSections, setLyricsSections] = useState<SectionTiming[]>([]);
  const [lineTimings, setLineTimings] = useState<LineTiming[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);
  const [metadataFetched, setMetadataFetched] = useState(false);
  const [isTimingSyncOpen, setIsTimingSyncOpen] = useState(false);
  const [isLineSyncOpen, setIsLineSyncOpen] = useState(false);

  useEffect(() => {
    if (song) {
      setFormData({
        title: song.title,
        artist: song.artist || "",
        lyrics: song.lyrics || "",
        chords: song.chords || "",
        key: song.key || "",
        tempo: song.tempo?.toString() || "",
        duration: song.duration?.toString() || "",
        releaseDate: song.release_date || "",
        energy: song.energy?.toString() || "",
        danceability: song.danceability?.toString() || "",
        tags: song.tags?.join(", ") || "",
        language: song.language || "",
        country: song.country || "",
        hasBackingTracks: song.has_backing_tracks || false,
      });
      // Load sections - support both new separate format and legacy format
      const timingData = song.timing_data;
      if (timingData?.chordSectionTimings || timingData?.lyricsSectionTimings) {
        // New format: separate sections for chords and lyrics
        setChordSections(timingData.chordSectionTimings || []);
        setLyricsSections(timingData.lyricsSectionTimings || []);
      } else if (timingData?.sectionTimings) {
        // Legacy format: single sections array - assign based on content
        if (song.chords?.trim()) {
          setChordSections(timingData.sectionTimings);
          setLyricsSections([]);
        } else {
          setChordSections([]);
          setLyricsSections(timingData.sectionTimings);
        }
      } else {
        setChordSections([]);
        setLyricsSections([]);
      }
      setLineTimings(timingData?.lineTimings || []);
      // Reset metadata button state when switching songs
      setMetadataFetched(false);
      setIsFetchingMetadata(false);
    }
  }, [song]);

  const handleFetchMetadata = async () => {
    if (!formData.title.trim()) {
      toast.warning(t("songs.enterTitleFirst"));
      return;
    }

    setIsFetchingMetadata(true);
    try {
      const metadata = await metadataService.getSongMetadata(
        formData.title.trim(),
        formData.artist.trim() || undefined
      );

      if (metadata) {
        setFormData((prev) => ({
          ...prev,
          artist: metadata.artist || prev.artist,
          releaseDate: metadata.releaseDate || prev.releaseDate,
          country: metadata.country || prev.country,
          lyrics: metadata.lyrics || prev.lyrics,
          key: metadata.key || prev.key,
          tempo: metadata.tempo ? metadata.tempo.toString() : prev.tempo,
          duration: metadata.duration ? metadata.duration.toString() : prev.duration,
          danceability: metadata.danceability
            ? metadata.danceability.toString()
            : prev.danceability,
        }));
        setMetadataFetched(true);

        // Show user which sources were used
        const sources = [];
        if (metadata.sources.basic === 'spotify') sources.push('Spotify');
        if (metadata.sources.basic === 'musicbrainz') sources.push('MusicBrainz');
        if (metadata.sources.audio === 'acousticbrainz') sources.push('AcousticBrainz');
        if (metadata.sources.lyrics === 'lyricsovh') sources.push('Lyrics.ovh');

        if (sources.length > 0) {
          console.log(`✅ Metadata loaded from: ${sources.join(' + ')}`);
        }

        // Show additional info about what was found
        if (metadata.country) console.log(`🌍 Country: ${metadata.country}`);
        if (metadata.lyrics) console.log(`📝 Lyrics: ${metadata.lyrics.length} characters`);
        if (metadata.genre) console.log(`🎸 Genre: ${metadata.genre}`);
      } else {
        toast.warning(t("songs.songNotFound"));
      }
    } catch (error) {
      console.error("Failed to fetch metadata:", error);
      toast.error(t("songs.fetchMetadataError"));
    } finally {
      setIsFetchingMetadata(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!song || !formData.title.trim()) return;

    setIsSaving(true);
    try {
      // Build timing_data from current state
      const hasChordSections = chordSections.length > 0;
      const hasLyricsSections = lyricsSections.length > 0;
      const hasLineTimings = lineTimings.length > 0;

      const timingData = hasChordSections || hasLyricsSections || hasLineTimings
        ? {
            chordSectionTimings: hasChordSections ? chordSections : undefined,
            lyricsSectionTimings: hasLyricsSections ? lyricsSections : undefined,
            lineTimings: hasLineTimings ? lineTimings : undefined,
          }
        : null;

      await onSave(song.id, {
        title: formData.title.trim(),
        artist: formData.artist.trim() || undefined,
        lyrics: formData.lyrics.trim() || undefined,
        chords: formData.chords.trim() || undefined,
        key: formData.key.trim() || undefined,
        tempo: formData.tempo ? parseInt(formData.tempo, 10) : undefined,
        duration: formData.duration ? parseInt(formData.duration, 10) : undefined,
        release_date: formData.releaseDate.trim() || undefined,
        energy: formData.energy ? parseFloat(formData.energy) : undefined,
        danceability: formData.danceability ? parseFloat(formData.danceability) : undefined,
        tags: formData.tags.trim() ? formData.tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
        language: formData.language.trim() || undefined,
        country: formData.country.trim() || undefined,
        has_backing_tracks: formData.hasBackingTracks,
        timing_data: timingData,
      });
      onClose();
    } catch (error) {
      console.error("Failed to update song:", error);
      toast.error(t("songs.updateError"));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !song) return null;

  return (
    <>
      <Overlay onClick={onClose} />
      <ModalContainer>
        <ModalHeader>
          <ModalTitle>
            <i className="bi bi-pencil-square"></i>
            Edit Song
          </ModalTitle>
          <CloseButton onClick={onClose} type="button" aria-label="Close">
            <i className="bi bi-x"></i>
          </CloseButton>
        </ModalHeader>

        <Form onSubmit={handleSubmit}>
          <FormRow>
            <FormGroup>
              <Label htmlFor="editSongTitle">
                Song Title <Required>*</Required>
              </Label>
              <Input
                id="editSongTitle"
                placeholder="Enter song title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                autoFocus
                disabled={isSaving}
              />
            </FormGroup>

            <FormGroup>
              <Label htmlFor="editSongArtist">Artist / Original Performer</Label>
              <Input
                id="editSongArtist"
                placeholder="e.g., The Beatles"
                value={formData.artist}
                onChange={(e) => setFormData({ ...formData, artist: e.target.value })}
                disabled={isSaving}
              />
            </FormGroup>
          </FormRow>

          {metadataService.isAvailable() && (
            <MetadataSection>
              <FetchButton
                type="button"
                onClick={handleFetchMetadata}
                disabled={!formData.title.trim() || isFetchingMetadata || isSaving}
              >
                {isFetchingMetadata ? (
                  <>
                    <Spinner />
                    Fetching metadata...
                  </>
                ) : metadataFetched ? (
                  <>
                    <i className="bi bi-check-circle-fill"></i>
                    Metadata Loaded
                  </>
                ) : (
                  <>
                    <i className="bi bi-music-note-list"></i>
                    Fetch Metadata (Spotify + MusicBrainz)
                  </>
                )}
              </FetchButton>
              {metadataFetched && (
                <SuccessMessage>
                  <i className="bi bi-info-circle"></i>
                  Metadata successfully loaded from multiple sources! You can edit any field before saving.
                </SuccessMessage>
              )}
            </MetadataSection>
          )}

          {formData.releaseDate && (
            <FormGroup>
              <Label htmlFor="editSongReleaseYear">
                <i className="bi bi-calendar"></i>
                Release Year
              </Label>
              <Input
                id="editSongReleaseYear"
                value={formData.releaseDate}
                onChange={(e) => setFormData({ ...formData, releaseDate: e.target.value })}
                disabled={isSaving}
              />
            </FormGroup>
          )}

          <SectionDivider>Musical Details</SectionDivider>

          <FormRow>
            <FormGroup>
              <Label htmlFor="editSongKey">
                <i className="bi bi-music-note-beamed"></i>
                Key
              </Label>
              <Select
                id="editSongKey"
                value={formData.key}
                onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                disabled={isSaving}
              >
                <option value="">Select key</option>
                <optgroup label="Major Keys">
                  <option value="C">C Major</option>
                  <option value="C#">C# Major</option>
                  <option value="Db">Db Major</option>
                  <option value="D">D Major</option>
                  <option value="D#">D# Major</option>
                  <option value="Eb">Eb Major</option>
                  <option value="E">E Major</option>
                  <option value="F">F Major</option>
                  <option value="F#">F# Major</option>
                  <option value="Gb">Gb Major</option>
                  <option value="G">G Major</option>
                  <option value="G#">G# Major</option>
                  <option value="Ab">Ab Major</option>
                  <option value="A">A Major</option>
                  <option value="A#">A# Major</option>
                  <option value="Bb">Bb Major</option>
                  <option value="B">B Major</option>
                </optgroup>
                <optgroup label="Minor Keys">
                  <option value="Cm">C Minor</option>
                  <option value="C#m">C# Minor</option>
                  <option value="Dm">D Minor</option>
                  <option value="D#m">D# Minor</option>
                  <option value="Ebm">Eb Minor</option>
                  <option value="Em">E Minor</option>
                  <option value="Fm">F Minor</option>
                  <option value="F#m">F# Minor</option>
                  <option value="Gm">G Minor</option>
                  <option value="G#m">G# Minor</option>
                  <option value="Am">A Minor</option>
                  <option value="A#m">A# Minor</option>
                  <option value="Bbm">Bb Minor</option>
                  <option value="Bm">B Minor</option>
                </optgroup>
              </Select>
            </FormGroup>

            <FormGroup>
              <Label htmlFor="editSongTempo">
                <i className="bi bi-speedometer2"></i>
                Tempo (BPM)
              </Label>
              <Input
                id="editSongTempo"
                type="number"
                placeholder="e.g., 120"
                value={formData.tempo}
                onChange={(e) => setFormData({ ...formData, tempo: e.target.value })}
                disabled={isSaving}
                min="1"
                max="300"
              />
            </FormGroup>

            <FormGroup>
              <Label htmlFor="editSongDuration">
                <i className="bi bi-clock"></i>
                Duration (seconds)
              </Label>
              <Input
                id="editSongDuration"
                type="number"
                placeholder="e.g., 180"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                disabled={isSaving}
                min="1"
              />
            </FormGroup>
          </FormRow>

          <FormRow>
            <FormGroup>
              <Label htmlFor="editSongEnergy">
                <i className="bi bi-lightning-charge"></i>
                Energy
              </Label>
              <Input
                id="editSongEnergy"
                type="number"
                step="0.01"
                placeholder="0.0 - 1.0"
                value={formData.energy}
                onChange={(e) => setFormData({ ...formData, energy: e.target.value })}
                disabled={isSaving}
                min="0"
                max="1"
              />
              <HelperText>Energy level from 0.0 (low) to 1.0 (high)</HelperText>
            </FormGroup>

            <FormGroup>
              <Label htmlFor="editSongDanceability">
                <i className="bi bi-soundwave"></i>
                Danceability
              </Label>
              <Input
                id="editSongDanceability"
                type="number"
                step="0.01"
                placeholder="0.0 - 1.0"
                value={formData.danceability}
                onChange={(e) => setFormData({ ...formData, danceability: e.target.value })}
                disabled={isSaving}
                min="0"
                max="1"
              />
              <HelperText>Danceability from 0.0 (not suitable) to 1.0 (very danceable)</HelperText>
            </FormGroup>
          </FormRow>

          <FormGroup>
            <Label htmlFor="editSongTags">
              <i className="bi bi-tags"></i>
              Tags / Categories
            </Label>
            <Input
              id="editSongTags"
              placeholder="e.g., Rock, Ballad, Encore"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              disabled={isSaving}
            />
          </FormGroup>

          <FormRow>
            <FormGroup>
              <Label htmlFor="editSongLanguage">
                <i className="bi bi-translate"></i>
                Language
              </Label>
              <Input
                id="editSongLanguage"
                placeholder="e.g., English, Spanish, French"
                value={formData.language}
                onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                disabled={isSaving}
              />
            </FormGroup>

            <FormGroup>
              <Label htmlFor="editSongCountry">
                <i className="bi bi-globe-americas"></i>
                Country
              </Label>
              <Input
                id="editSongCountry"
                placeholder="e.g., USA, UK, Mexico"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                disabled={isSaving}
              />
            </FormGroup>
          </FormRow>

          <CheckboxGroup>
            <CheckboxLabel htmlFor="editHasBackingTracks">
              <CheckboxInput
                type="checkbox"
                id="editHasBackingTracks"
                checked={formData.hasBackingTracks}
                onChange={(e) => setFormData({ ...formData, hasBackingTracks: e.target.checked })}
                disabled={isSaving}
              />
              <CheckboxText>
                <i className="bi bi-headphones"></i>
                This song has backing tracks or sequences
              </CheckboxText>
            </CheckboxLabel>
          </CheckboxGroup>

          <FormGroup>
            <Label htmlFor="editSongChords">
              <i className="bi bi-music-note"></i>
              Chords
            </Label>
            <TextArea
              id="editSongChords"
              rows={4}
              placeholder="Enter chord progression (e.g., C  G  Am  F)"
              value={formData.chords}
              onChange={(e) => setFormData({ ...formData, chords: e.target.value })}
              disabled={isSaving}
            />
          </FormGroup>

          <FormGroup>
            <Label htmlFor="editSongLyrics">
              <i className="bi bi-file-text"></i>
              Lyrics
            </Label>
            <TextArea
              id="editSongLyrics"
              rows={6}
              placeholder="Enter song lyrics..."
              value={formData.lyrics}
              onChange={(e) => setFormData({ ...formData, lyrics: e.target.value })}
              disabled={isSaving}
            />
          </FormGroup>

          {/* Section Editor - shown when there's lyrics or chords */}
          {(formData.lyrics.trim() || formData.chords.trim()) && (
            <>
              <SectionDivider>{t("sectionEditor.defineSections")}</SectionDivider>
              <SectionEditorHelp>
                <i className="bi bi-info-circle"></i>
                {t("sectionEditor.sectionsHelp")}
              </SectionEditorHelp>
              <SectionEditor
                chordsText={formData.chords}
                lyricsText={formData.lyrics}
                chordSections={chordSections}
                lyricsSections={lyricsSections}
                onChordSectionsChange={setChordSections}
                onLyricsSectionsChange={setLyricsSections}
                disabled={isSaving}
              />

              {/* Timing Sync Buttons */}
              <SyncButtonsRow>
                {/* Section Timing Sync - shown when there are sections */}
                {(chordSections.length > 0 || lyricsSections.length > 0) && (
                  <TimingSyncButton
                    type="button"
                    onClick={() => setIsTimingSyncOpen(true)}
                    disabled={isSaving}
                  >
                    <i className="bi bi-stopwatch"></i>
                    {t("timingSync.syncTiming")}
                    <TimingSyncHint>{t("timingSync.syncTimingHint")}</TimingSyncHint>
                  </TimingSyncButton>
                )}

                {/* Line-by-Line Sync - shown when there's lyrics or chords */}
                <TimingSyncButton
                  type="button"
                  onClick={() => setIsLineSyncOpen(true)}
                  disabled={isSaving}
                  $variant="secondary"
                >
                  <i className="bi bi-text-left"></i>
                  {t("lineSync.syncLines")}
                  <TimingSyncHint>
                    {lineTimings.length > 0
                      ? t("lineSync.linesSynced", { count: lineTimings.length })
                      : t("lineSync.syncLinesHint")}
                  </TimingSyncHint>
                </TimingSyncButton>
              </SyncButtonsRow>
            </>
          )}

          {/* Sheet Music Upload */}
          <SectionDivider>{t("sheetMusic.title")}</SectionDivider>
          <SheetMusicUpload
            songId={song.id}
            bandId={song.band_id}
          />

          <FormActions>
            <CancelButton type="button" onClick={onClose} disabled={isSaving}>
              Cancel
            </CancelButton>
            <SubmitButton type="submit" disabled={!formData.title.trim() || isSaving}>
              {isSaving ? (
                <>
                  <Spinner />
                  Saving...
                </>
              ) : (
                <>
                  <i className="bi bi-check-circle"></i>
                  Save Changes
                </>
              )}
            </SubmitButton>
          </FormActions>
        </Form>
      </ModalContainer>

      {/* Timing Sync Modal */}
      <TimingSyncModal
        isOpen={isTimingSyncOpen}
        onClose={() => setIsTimingSyncOpen(false)}
        chordSections={chordSections}
        lyricsSections={lyricsSections}
        onChordSectionsChange={setChordSections}
        onLyricsSectionsChange={setLyricsSections}
        songTitle={formData.title}
      />

      {/* Line Sync Modal */}
      <LineSyncModal
        isOpen={isLineSyncOpen}
        onClose={() => setIsLineSyncOpen(false)}
        content={formData.chords.trim() || formData.lyrics.trim()}
        lineTimings={lineTimings}
        onLineTimingsChange={setLineTimings}
        songTitle={formData.title}
      />
    </>
  );
};

// Styled Components

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  z-index: ${theme.zIndex.modal};
  animation: fadeIn 0.2s ease;

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
`;

const ModalContainer = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.lg};
  width: 90%;
  max-width: 700px;
  max-height: 90vh;
  overflow-y: auto;
  z-index: ${theme.zIndex.modal + 10};
  box-shadow: var(--shadow-xl);
  animation: slideUp 0.3s ease;

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translate(-50%, -45%);
    }
    to {
      opacity: 1;
      transform: translate(-50%, -50%);
    }
  }

  /* Custom scrollbar */
  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: var(--color-bg-tertiary);
  }

  &::-webkit-scrollbar-thumb {
    background: var(--color-border-strong);
    border-radius: ${theme.radius.sm};

    &:hover {
      background: ${theme.colors.brand.primary};
    }
  }
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${theme.space[6]};
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  background: var(--color-bg-secondary);
  z-index: 1;
`;

const ModalTitle = styled.h2`
  font-size: ${theme.fontSizes.h3};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};

  i {
    color: ${theme.colors.brand.primary};
    font-size: ${theme.fontSizes.h2};
  }
`;

const CloseButton = styled.button`
  background: transparent;
  border: none;
  color: var(--color-text-tertiary);
  width: 40px;
  height: 40px;
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  font-size: ${theme.fontSizes.h2};

  &:hover {
    background: var(--color-bg-elevated);
    color: var(--color-text-primary);
  }
`;

const Form = styled.form`
  padding: ${theme.space[6]};
  display: flex;
  flex-direction: column;
  gap: ${theme.space[4]};
`;

const FormRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: ${theme.space[4]};

  @media (max-width: ${theme.breakpoints.md}) {
    grid-template-columns: 1fr;
  }
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[2]};
`;

const Label = styled.label`
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};

  i {
    color: ${theme.colors.brand.primary};
  }
`;

const Required = styled.span`
  color: ${theme.colors.semantic.error};
`;

const Input = styled.input`
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  padding: ${theme.space[3]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  transition: all ${theme.transitions.fast} ease;
  font-family: ${theme.fonts.sans};

  &::placeholder {
    color: var(--color-text-tertiary);
  }

  &:focus {
    outline: none;
    border-color: ${theme.colors.brand.primary};
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  }

  &:hover:not(:focus):not(:disabled) {
    border-color: var(--color-border-strong);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const Select = styled.select`
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  padding: ${theme.space[3]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  transition: all ${theme.transitions.fast} ease;
  font-family: ${theme.fonts.sans};
  cursor: pointer;
  height: 48px;
  line-height: 1.5;

  &:focus {
    outline: none;
    border-color: ${theme.colors.brand.primary};
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  }

  &:hover:not(:focus):not(:disabled) {
    border-color: var(--color-border-strong);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const TextArea = styled.textarea`
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  padding: ${theme.space[3]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  transition: all ${theme.transitions.fast} ease;
  font-family: ${theme.fonts.mono};
  resize: vertical;
  min-height: 80px;
  line-height: ${theme.lineHeights.relaxed};

  &::placeholder {
    color: var(--color-text-tertiary);
    font-family: ${theme.fonts.sans};
  }

  &:focus {
    outline: none;
    border-color: ${theme.colors.brand.primary};
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  }

  &:hover:not(:focus):not(:disabled) {
    border-color: var(--color-border-strong);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const FormActions = styled.div`
  display: flex;
  gap: ${theme.space[3]};
  margin-top: ${theme.space[2]};
  padding-top: ${theme.space[4]};
  border-top: 1px solid var(--color-border);

  @media (max-width: ${theme.breakpoints.sm}) {
    flex-direction: column-reverse;
  }
`;

const CancelButton = styled.button`
  flex: 1;
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  padding: ${theme.space[3]} ${theme.space[6]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  &:hover:not(:disabled) {
    background: var(--color-bg-elevated);
    border-color: var(--color-border-strong);
  }

  &:active:not(:disabled) {
    transform: scale(0.98);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const SubmitButton = styled.button`
  flex: 2;
  background: ${theme.colors.brand.primary};
  border: none;
  color: white;
  padding: ${theme.space[3]} ${theme.space[6]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${theme.space[2]};

  i {
    font-size: ${theme.fontSizes.bodyLg};
  }

  &:hover:not(:disabled) {
    background: ${theme.colors.brand.primaryHover};
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    background: var(--color-bg-elevated);
    color: var(--color-text-disabled);
    cursor: not-allowed;
  }
`;

const Spinner = styled.span`
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const CheckboxGroup = styled.div`
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.base};
  padding: ${theme.space[4]};
`;

const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  cursor: pointer;
  user-select: none;
`;

const CheckboxInput = styled.input`
  width: 20px;
  height: 20px;
  cursor: pointer;
  accent-color: ${theme.colors.brand.primary};
  flex-shrink: 0;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const CheckboxText = styled.span`
  color: var(--color-text-primary);
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.medium};
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};

  i {
    color: ${theme.colors.brand.primary};
    font-size: ${theme.fontSizes.bodyLg};
  }
`;

const HelperText = styled.span`
  font-size: ${theme.fontSizes.bodyXs};
  color: var(--color-text-tertiary);
  font-style: italic;
`;

const SectionDivider = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: ${theme.letterSpacing.wide};
  padding: ${theme.space[3]} 0 ${theme.space[2]} 0;
  border-bottom: 1px solid var(--color-border);
  margin-top: ${theme.space[2]};
`;

const MetadataSection = styled.div`
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.base};
  padding: ${theme.space[4]};
  display: flex;
  flex-direction: column;
  gap: ${theme.space[3]};
`;

const FetchButton = styled.button`
  background: linear-gradient(135deg, ${theme.colors.brand.primary}, ${theme.colors.brand.primaryHover});
  border: none;
  color: white;
  padding: ${theme.space[3]} ${theme.space[5]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${theme.space[2]};
  box-shadow: 0 2px 8px rgba(139, 92, 246, 0.2);

  i {
    font-size: ${theme.fontSizes.bodyLg};
  }

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    background: var(--color-bg-elevated);
    color: var(--color-text-disabled);
    cursor: not-allowed;
    box-shadow: none;
  }
`;

const SuccessMessage = styled.div`
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.3);
  border-radius: ${theme.radius.sm};
  padding: ${theme.space[3]};
  color: ${theme.colors.semantic.success};
  font-size: ${theme.fontSizes.bodySm};
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};

  i {
    font-size: ${theme.fontSizes.body};
    flex-shrink: 0;
  }
`;

const SectionEditorHelp = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-tertiary);
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  margin-bottom: ${theme.space[2]};

  i {
    color: ${theme.colors.brand.primary};
  }
`;

const SyncButtonsRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[2]};
  margin-top: ${theme.space[3]};

  @media (min-width: ${theme.breakpoints.md}) {
    flex-direction: row;
    gap: ${theme.space[3]};
  }
`;

const TimingSyncButton = styled.button<{ $variant?: "primary" | "secondary" }>`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  background: ${(props) =>
    props.$variant === "secondary"
      ? 'var(--color-bg-primary)'
      : `linear-gradient(135deg, var(--color-bg-tertiary) 0%, var(--color-bg-secondary) 100%)`};
  border: 1px solid ${(props) =>
    props.$variant === "secondary"
      ? 'var(--color-border)'
      : `${theme.colors.brand.primary}40`};
  color: var(--color-text-primary);
  padding: ${theme.space[3]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  flex: 1;

  i {
    color: ${(props) =>
      props.$variant === "secondary"
        ? theme.colors.semantic.info
        : theme.colors.brand.primary};
    font-size: ${theme.fontSizes.bodyLg};
  }

  &:hover:not(:disabled) {
    border-color: ${(props) =>
      props.$variant === "secondary"
        ? theme.colors.semantic.info
        : theme.colors.brand.primary};
    background: ${(props) =>
      props.$variant === "secondary"
        ? `${theme.colors.semantic.info}10`
        : `linear-gradient(135deg, ${theme.colors.brand.primary}15 0%, var(--color-bg-tertiary) 100%)`};
    box-shadow: 0 0 12px ${(props) =>
      props.$variant === "secondary"
        ? `${theme.colors.semantic.info}20`
        : `${theme.colors.brand.primary}20`};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const TimingSyncHint = styled.span`
  font-size: ${theme.fontSizes.bodyXs};
  color: var(--color-text-tertiary);
  margin-left: auto;
`;
