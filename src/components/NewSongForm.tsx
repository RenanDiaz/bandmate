import { useState } from "react";
import { createSong, type CreateSongInput } from "../services/songsService";
import { spotifyService } from "../services/spotifyService";
import styled from "styled-components";
import { theme } from "../theme";

interface Props {
  bandId: number;
  onSongCreated: () => void;
}

export const NewSongForm = ({ bandId, onSongCreated }: Props) => {
  const [formData, setFormData] = useState({
    title: "",
    artist: "",
    album: "",
    albumArt: "",
    releaseDate: "",
    spotifyUrl: "",
    lyrics: "",
    chords: "",
    key: "",
    tempo: "",
    duration: "",
    timeSignature: "",
    energy: "",
    danceability: "",
    tags: "",
  });
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);
  const [metadataFetched, setMetadataFetched] = useState(false);

  const handleFetchMetadata = async () => {
    if (!formData.title.trim()) {
      alert("Please enter a song title first");
      return;
    }

    setIsFetchingMetadata(true);
    try {
      const metadata = await spotifyService.getSongMetadata(
        formData.title.trim(),
        formData.artist.trim() || undefined
      );

      if (metadata) {
        setFormData((prev) => ({
          ...prev,
          artist: metadata.artist || prev.artist,
          album: metadata.album || prev.album,
          albumArt: metadata.albumArt || prev.albumArt,
          releaseDate: metadata.releaseDate || prev.releaseDate,
          spotifyUrl: metadata.spotifyUrl || prev.spotifyUrl,
          key: metadata.key || prev.key,
          tempo: metadata.tempo ? metadata.tempo.toString() : prev.tempo,
          duration: metadata.duration ? metadata.duration.toString() : prev.duration,
          timeSignature: metadata.timeSignature
            ? metadata.timeSignature.toString()
            : prev.timeSignature,
          energy: metadata.energy ? metadata.energy.toString() : prev.energy,
          danceability: metadata.danceability
            ? metadata.danceability.toString()
            : prev.danceability,
        }));
        setMetadataFetched(true);
      } else {
        alert("Song not found on Spotify. Try entering the artist name or check spelling.");
      }
    } catch (error) {
      console.error("Failed to fetch metadata:", error);
      alert("Failed to fetch song metadata. Please try again or enter details manually.");
    } finally {
      setIsFetchingMetadata(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    setIsSubmitting(true);
    try {
      const songInput: CreateSongInput = {
        title: formData.title.trim(),
        band_id: bandId,
        artist: formData.artist.trim() || undefined,
        album: formData.album.trim() || undefined,
        album_art: formData.albumArt.trim() || undefined,
        release_date: formData.releaseDate.trim() || undefined,
        spotify_url: formData.spotifyUrl.trim() || undefined,
        lyrics: formData.lyrics.trim() || undefined,
        chords: formData.chords.trim() || undefined,
        key: formData.key.trim() || undefined,
        tempo: formData.tempo ? parseInt(formData.tempo, 10) : undefined,
        duration: formData.duration ? parseInt(formData.duration, 10) : undefined,
        time_signature: formData.timeSignature ? parseInt(formData.timeSignature, 10) : undefined,
        energy: formData.energy ? parseFloat(formData.energy) : undefined,
        danceability: formData.danceability ? parseFloat(formData.danceability) : undefined,
        tags: formData.tags.trim() ? formData.tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
      };

      await createSong(songInput);
      setFormData({
        title: "", artist: "", album: "", albumArt: "", releaseDate: "", spotifyUrl: "",
        lyrics: "", chords: "", key: "", tempo: "", duration: "", timeSignature: "",
        energy: "", danceability: "", tags: ""
      });
      setIsExpanded(false);
      setMetadataFetched(false);
      onSongCreated();
    } catch (error) {
      console.error("Failed to create song:", error);
      alert("Failed to create song. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isExpanded) {
    return (
      <ExpandButton onClick={() => setIsExpanded(true)}>
        <i className="bi bi-plus-circle"></i>
        Add New Song
      </ExpandButton>
    );
  }

  return (
    <FormCard>
      <FormHeader>
        <FormTitle>
          <i className="bi bi-plus-circle"></i>
          Add New Song
        </FormTitle>
        <CloseButton onClick={() => setIsExpanded(false)} type="button" aria-label="Close form">
          <i className="bi bi-x"></i>
        </CloseButton>
      </FormHeader>

      <Form onSubmit={handleSubmit}>
        <FormRow>
          <FormGroup>
            <Label htmlFor="songTitle">
              Song Title <Required>*</Required>
            </Label>
            <Input
              id="songTitle"
              placeholder="Enter song title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              autoFocus
              disabled={isSubmitting}
            />
          </FormGroup>

          <FormGroup>
            <Label htmlFor="songArtist">Artist / Original Performer</Label>
            <Input
              id="songArtist"
              placeholder="e.g., The Beatles"
              value={formData.artist}
              onChange={(e) => {
                setFormData({ ...formData, artist: e.target.value });
                setMetadataFetched(false);
              }}
              disabled={isSubmitting}
            />
          </FormGroup>
        </FormRow>

        {spotifyService.isConfigured() && (
          <MetadataSection>
            <FetchButton
              type="button"
              onClick={handleFetchMetadata}
              disabled={!formData.title.trim() || isFetchingMetadata || isSubmitting}
            >
              {isFetchingMetadata ? (
                <>
                  <Spinner />
                  Fetching from Spotify...
                </>
              ) : metadataFetched ? (
                <>
                  <i className="bi bi-check-circle-fill"></i>
                  Metadata Loaded
                </>
              ) : (
                <>
                  <i className="bi bi-spotify"></i>
                  Fetch Metadata from Spotify
                </>
              )}
            </FetchButton>
            {metadataFetched && (
              <SuccessMessage>
                <i className="bi bi-info-circle"></i>
                Metadata successfully loaded! You can edit any field before saving.
              </SuccessMessage>
            )}
          </MetadataSection>
        )}

        {formData.album && (
          <FormGroup>
            <Label htmlFor="songAlbum">
              <i className="bi bi-disc"></i>
              Album
            </Label>
            <Input
              id="songAlbum"
              value={formData.album}
              onChange={(e) => setFormData({ ...formData, album: e.target.value })}
              disabled={isSubmitting}
              readOnly
            />
          </FormGroup>
        )}

        <FormRow>
          <FormGroup>
            <Label htmlFor="songKey">
              <i className="bi bi-music-note-beamed"></i>
              Key
            </Label>
            <Select
              id="songKey"
              value={formData.key}
              onChange={(e) => setFormData({ ...formData, key: e.target.value })}
              disabled={isSubmitting}
            >
              <option value="">Select key (optional)</option>
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
            </Select>
          </FormGroup>

          <FormGroup>
            <Label htmlFor="songTempo">
              <i className="bi bi-speedometer2"></i>
              Tempo (BPM)
            </Label>
            <Input
              id="songTempo"
              type="number"
              placeholder="e.g., 120"
              value={formData.tempo}
              onChange={(e) => setFormData({ ...formData, tempo: e.target.value })}
              disabled={isSubmitting}
              min="1"
              max="300"
            />
          </FormGroup>

          <FormGroup>
            <Label htmlFor="songDuration">
              <i className="bi bi-clock"></i>
              Duration (seconds)
            </Label>
            <Input
              id="songDuration"
              type="number"
              placeholder="e.g., 180"
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
              disabled={isSubmitting}
              min="1"
            />
            <HelperText>Total song length in seconds</HelperText>
          </FormGroup>
        </FormRow>

        <FormGroup>
          <Label htmlFor="songTags">
            <i className="bi bi-tags"></i>
            Tags / Categories
          </Label>
          <Input
            id="songTags"
            placeholder="e.g., Rock, Ballad, Encore"
            value={formData.tags}
            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            disabled={isSubmitting}
          />
          <HelperText>Separate multiple tags with commas</HelperText>
        </FormGroup>

        <FormGroup>
          <Label htmlFor="songChords">
            <i className="bi bi-music-note"></i>
            Chords
          </Label>
          <TextArea
            id="songChords"
            rows={4}
            placeholder="Enter chord progression (e.g., C  G  Am  F)"
            value={formData.chords}
            onChange={(e) => setFormData({ ...formData, chords: e.target.value })}
            disabled={isSubmitting}
          />
          <HelperText>Tip: Use spaces or line breaks to organize chord changes</HelperText>
        </FormGroup>

        <FormGroup>
          <Label htmlFor="songLyrics">
            <i className="bi bi-file-text"></i>
            Lyrics
          </Label>
          <TextArea
            id="songLyrics"
            rows={6}
            placeholder="Enter song lyrics..."
            value={formData.lyrics}
            onChange={(e) => setFormData({ ...formData, lyrics: e.target.value })}
            disabled={isSubmitting}
          />
        </FormGroup>

        <FormActions>
          <CancelButton type="button" onClick={() => setIsExpanded(false)} disabled={isSubmitting}>
            Cancel
          </CancelButton>
          <SubmitButton type="submit" disabled={!formData.title.trim() || isSubmitting}>
            {isSubmitting ? (
              <>
                <Spinner />
                Saving...
              </>
            ) : (
              <>
                <i className="bi bi-check-circle"></i>
                Save Song
              </>
            )}
          </SubmitButton>
        </FormActions>
      </Form>
    </FormCard>
  );
};

// Styled Components

const ExpandButton = styled.button`
  width: 100%;
  background: ${theme.colors.dark.bg.secondary};
  border: 2px dashed ${theme.colors.dark.border.default};
  color: ${theme.colors.brand.primary};
  padding: ${theme.space[5]} ${theme.space[6]};
  border-radius: ${theme.radius.lg};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.base} ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${theme.space[2]};
  margin-bottom: ${theme.space[6]};

  i {
    font-size: ${theme.fontSizes.h3};
  }

  &:hover {
    background: ${theme.colors.dark.bg.tertiary};
    border-color: ${theme.colors.brand.primary};
    border-style: solid;
    transform: translateY(-2px);
  }

  &:active {
    transform: translateY(0);
  }
`;

const FormCard = styled.div`
  background: ${theme.colors.dark.bg.secondary};
  border: 1px solid ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.lg};
  padding: ${theme.space[6]};
  margin-bottom: ${theme.space[6]};
  box-shadow: ${theme.shadows.md};
`;

const FormHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${theme.space[5]};
  padding-bottom: ${theme.space[4]};
  border-bottom: 1px solid ${theme.colors.dark.border.default};
`;

const FormTitle = styled.h3`
  font-size: ${theme.fontSizes.h3};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.dark.text.primary};
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
  color: ${theme.colors.dark.text.tertiary};
  width: 32px;
  height: 32px;
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  font-size: ${theme.fontSizes.h2};

  &:hover {
    background: ${theme.colors.dark.bg.elevated};
    color: ${theme.colors.dark.text.primary};
  }
`;

const Form = styled.form`
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
  color: ${theme.colors.dark.text.primary};
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
  background: ${theme.colors.dark.bg.primary};
  border: 1px solid ${theme.colors.dark.border.default};
  color: ${theme.colors.dark.text.primary};
  padding: ${theme.space[3]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  transition: all ${theme.transitions.fast} ease;
  font-family: ${theme.fonts.sans};

  &::placeholder {
    color: ${theme.colors.dark.text.tertiary};
  }

  &:focus {
    outline: none;
    border-color: ${theme.colors.brand.primary};
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  }

  &:hover:not(:focus):not(:disabled) {
    border-color: ${theme.colors.dark.border.strong};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const Select = styled.select`
  background: ${theme.colors.dark.bg.primary};
  border: 1px solid ${theme.colors.dark.border.default};
  color: ${theme.colors.dark.text.primary};
  padding: ${theme.space[3]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  transition: all ${theme.transitions.fast} ease;
  font-family: ${theme.fonts.sans};
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: ${theme.colors.brand.primary};
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  }

  &:hover:not(:focus):not(:disabled) {
    border-color: ${theme.colors.dark.border.strong};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const TextArea = styled.textarea`
  background: ${theme.colors.dark.bg.primary};
  border: 1px solid ${theme.colors.dark.border.default};
  color: ${theme.colors.dark.text.primary};
  padding: ${theme.space[3]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  transition: all ${theme.transitions.fast} ease;
  font-family: ${theme.fonts.mono};
  resize: vertical;
  min-height: 80px;
  line-height: ${theme.lineHeights.relaxed};

  &::placeholder {
    color: ${theme.colors.dark.text.tertiary};
    font-family: ${theme.fonts.sans};
  }

  &:focus {
    outline: none;
    border-color: ${theme.colors.brand.primary};
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  }

  &:hover:not(:focus):not(:disabled) {
    border-color: ${theme.colors.dark.border.strong};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const HelperText = styled.span`
  font-size: ${theme.fontSizes.bodyXs};
  color: ${theme.colors.dark.text.tertiary};
  font-style: italic;
`;

const FormActions = styled.div`
  display: flex;
  gap: ${theme.space[3]};
  margin-top: ${theme.space[2]};

  @media (max-width: ${theme.breakpoints.sm}) {
    flex-direction: column-reverse;
  }
`;

const CancelButton = styled.button`
  flex: 1;
  background: transparent;
  border: 1px solid ${theme.colors.dark.border.default};
  color: ${theme.colors.dark.text.primary};
  padding: ${theme.space[3]} ${theme.space[6]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  &:hover:not(:disabled) {
    background: ${theme.colors.dark.bg.elevated};
    border-color: ${theme.colors.dark.border.strong};
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
    box-shadow: ${theme.shadows.md};
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    background: ${theme.colors.dark.bg.elevated};
    color: ${theme.colors.dark.text.disabled};
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

const MetadataSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[2]};
  padding: ${theme.space[4]};
  background: ${theme.colors.dark.bg.primary};
  border: 1px solid ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.base};
`;

const FetchButton = styled.button`
  background: #1db954; /* Spotify green */
  border: none;
  color: white;
  padding: ${theme.space[3]} ${theme.space[4]};
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
    background: #1ed760;
    transform: translateY(-1px);
    box-shadow: ${theme.shadows.sm};
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    background: ${theme.colors.dark.bg.elevated};
    color: ${theme.colors.dark.text.disabled};
    cursor: not-allowed;
    opacity: 0.6;
  }
`;

const SuccessMessage = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  color: ${theme.colors.semantic.success};
  font-size: ${theme.fontSizes.bodySm};
  padding: ${theme.space[2]} 0;

  i {
    font-size: ${theme.fontSizes.body};
  }
`;
