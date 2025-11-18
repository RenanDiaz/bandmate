import { useState, useEffect } from "react";
import styled from "styled-components";
import { theme } from "../theme";
import type { Song, UpdateSongInput } from "../services/songsService";

interface Props {
  song: Song | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (songId: string, updates: UpdateSongInput) => Promise<void>;
}

export const EditSongModal = ({ song, isOpen, onClose, onSave }: Props) => {
  const [formData, setFormData] = useState({
    title: "",
    artist: "",
    lyrics: "",
    chords: "",
    key: "",
    tempo: "",
    duration: "",
    tags: "",
  });
  const [isSaving, setIsSaving] = useState(false);

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
        tags: song.tags?.join(", ") || "",
      });
    }
  }, [song]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!song || !formData.title.trim()) return;

    setIsSaving(true);
    try {
      await onSave(song.id, {
        title: formData.title.trim(),
        artist: formData.artist.trim() || undefined,
        lyrics: formData.lyrics.trim() || undefined,
        chords: formData.chords.trim() || undefined,
        key: formData.key.trim() || undefined,
        tempo: formData.tempo ? parseInt(formData.tempo, 10) : undefined,
        duration: formData.duration ? parseInt(formData.duration, 10) : undefined,
        tags: formData.tags.trim() ? formData.tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
      });
      onClose();
    } catch (error) {
      console.error("Failed to update song:", error);
      alert("Failed to update song. Please try again.");
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
  background: ${theme.colors.dark.bg.secondary};
  border: 1px solid ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.lg};
  width: 90%;
  max-width: 700px;
  max-height: 90vh;
  overflow-y: auto;
  z-index: ${theme.zIndex.modal + 10};
  box-shadow: ${theme.shadows.xl};
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
    background: ${theme.colors.dark.bg.tertiary};
  }

  &::-webkit-scrollbar-thumb {
    background: ${theme.colors.dark.border.strong};
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
  border-bottom: 1px solid ${theme.colors.dark.border.default};
  position: sticky;
  top: 0;
  background: ${theme.colors.dark.bg.secondary};
  z-index: 1;
`;

const ModalTitle = styled.h2`
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
    background: ${theme.colors.dark.bg.elevated};
    color: ${theme.colors.dark.text.primary};
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

const FormActions = styled.div`
  display: flex;
  gap: ${theme.space[3]};
  margin-top: ${theme.space[2]};
  padding-top: ${theme.space[4]};
  border-top: 1px solid ${theme.colors.dark.border.default};

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
