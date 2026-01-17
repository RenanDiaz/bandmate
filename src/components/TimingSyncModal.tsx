import { useState, useRef, useCallback, useEffect } from "react";
import styled from "styled-components";
import { theme } from "../theme";
import type { SectionTiming } from "../services/songsService";
import { useTranslation } from "react-i18next";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sections: SectionTiming[];
  onSectionsChange: (sections: SectionTiming[]) => void;
  songTitle: string;
}

const formatTime = (seconds: number): string => {
  if (!isFinite(seconds) || isNaN(seconds)) return "0:00.0";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${mins}:${secs.toString().padStart(2, "0")}.${ms}`;
};

const parseTime = (timeStr: string): number => {
  const parts = timeStr.split(":");
  if (parts.length !== 2) return 0;
  const mins = parseInt(parts[0], 10) || 0;
  const secParts = parts[1].split(".");
  const secs = parseInt(secParts[0], 10) || 0;
  const ms = secParts[1] ? parseInt(secParts[1], 10) / 10 : 0;
  return mins * 60 + secs + ms;
};

const SECTION_COLORS = [
  { bg: "rgba(139, 92, 246, 0.15)", border: "rgba(139, 92, 246, 0.5)", text: "#a78bfa" },
  { bg: "rgba(59, 130, 246, 0.15)", border: "rgba(59, 130, 246, 0.5)", text: "#60a5fa" },
  { bg: "rgba(34, 197, 94, 0.15)", border: "rgba(34, 197, 94, 0.5)", text: "#4ade80" },
  { bg: "rgba(249, 115, 22, 0.15)", border: "rgba(249, 115, 22, 0.5)", text: "#fb923c" },
  { bg: "rgba(236, 72, 153, 0.15)", border: "rgba(236, 72, 153, 0.5)", text: "#f472b6" },
  { bg: "rgba(14, 165, 233, 0.15)", border: "rgba(14, 165, 233, 0.5)", text: "#38bdf8" },
  { bg: "rgba(168, 85, 247, 0.15)", border: "rgba(168, 85, 247, 0.5)", text: "#c084fc" },
  { bg: "rgba(234, 179, 8, 0.15)", border: "rgba(234, 179, 8, 0.5)", text: "#facc15" },
];

export const TimingSyncModal = ({
  isOpen,
  onClose,
  sections,
  onSectionsChange,
  songTitle,
}: Props) => {
  const { t } = useTranslation();
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [trackUrl, setTrackUrl] = useState<string | null>(null);
  const [trackFileName, setTrackFileName] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [selectedSectionIndex, setSelectedSectionIndex] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");

  // Cleanup on unmount or close
  useEffect(() => {
    return () => {
      if (trackUrl) {
        URL.revokeObjectURL(trackUrl);
      }
    };
  }, [trackUrl]);

  // Handle audio events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
    };
  }, [trackUrl]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen || !trackUrl) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Space to play/pause
      if (e.code === "Space" && e.target === document.body) {
        e.preventDefault();
        handlePlayPause();
      }
      // M to mark current section
      if (e.code === "KeyM" && selectedSectionIndex !== null) {
        e.preventDefault();
        handleMarkTime(selectedSectionIndex);
      }
      // Arrow keys to navigate sections
      if (e.code === "ArrowDown" && selectedSectionIndex !== null && selectedSectionIndex < sections.length - 1) {
        e.preventDefault();
        setSelectedSectionIndex(selectedSectionIndex + 1);
      }
      if (e.code === "ArrowUp" && selectedSectionIndex !== null && selectedSectionIndex > 0) {
        e.preventDefault();
        setSelectedSectionIndex(selectedSectionIndex - 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, trackUrl, selectedSectionIndex, sections.length]);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (trackUrl) {
        URL.revokeObjectURL(trackUrl);
      }
      const url = URL.createObjectURL(file);
      setTrackUrl(url);
      setTrackFileName(file.name);
      setCurrentTime(0);
      setDuration(0);
      setIsPlaying(false);
    }
    event.target.value = "";
  }, [trackUrl]);

  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !trackUrl) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
  }, [isPlaying, trackUrl]);

  const handleSeek = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const time = parseFloat(event.target.value);
    audio.currentTime = time;
    setCurrentTime(time);
  }, []);

  const handleMarkTime = useCallback((index: number) => {
    // Read current time directly from audio element to avoid stale closure issues
    const audio = audioRef.current;
    const time = audio ? audio.currentTime : currentTime;
    const updatedSections = sections.map((section, i) =>
      i === index ? { ...section, startTime: time } : section
    );
    onSectionsChange(updatedSections);
    // Auto-advance to next section
    if (index < sections.length - 1) {
      setSelectedSectionIndex(index + 1);
    }
  }, [sections, currentTime, onSectionsChange]);

  const handleJumpToSection = useCallback((index: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    const section = sections[index];
    if (section.startTime > 0) {
      audio.currentTime = section.startTime;
      setCurrentTime(section.startTime);
    }
    setSelectedSectionIndex(index);
  }, [sections]);

  const handleEditTime = useCallback((index: number) => {
    setEditingIndex(index);
    setEditingValue(formatTime(sections[index].startTime));
  }, [sections]);

  const handleSaveEditedTime = useCallback(() => {
    if (editingIndex === null) return;

    const newTime = parseTime(editingValue);
    const updatedSections = sections.map((section, i) =>
      i === editingIndex ? { ...section, startTime: newTime } : section
    );
    onSectionsChange(updatedSections);
    setEditingIndex(null);
    setEditingValue("");
  }, [editingIndex, editingValue, sections, onSectionsChange]);

  const handleClearTime = useCallback((index: number) => {
    const updatedSections = sections.map((section, i) =>
      i === index ? { ...section, startTime: 0 } : section
    );
    onSectionsChange(updatedSections);
  }, [sections, onSectionsChange]);

  const handleClearAllTimes = useCallback(() => {
    const updatedSections = sections.map((section) => ({ ...section, startTime: 0 }));
    onSectionsChange(updatedSections);
  }, [sections, onSectionsChange]);

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const getSyncedCount = () => sections.filter((s) => s.startTime > 0).length;

  if (!isOpen) return null;

  return (
    <>
      <Overlay onClick={onClose} />
      <ModalContainer>
        <ModalHeader>
          <ModalTitle>
            <i className="bi bi-stopwatch"></i>
            {t("timingSync.title")}
          </ModalTitle>
          <SongName>{songTitle}</SongName>
          <CloseButton onClick={onClose} type="button" aria-label="Close">
            <i className="bi bi-x"></i>
          </CloseButton>
        </ModalHeader>

        <ModalContent>
          {/* Audio File Section */}
          <AudioSection>
            <HiddenFileInput
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.webm"
              onChange={handleFileSelect}
            />

            {trackUrl && <audio ref={audioRef} src={trackUrl} preload="metadata" />}

            {!trackUrl ? (
              <LoadAudioPrompt>
                <LoadAudioIcon>
                  <i className="bi bi-music-note-beamed"></i>
                </LoadAudioIcon>
                <LoadAudioText>{t("timingSync.loadAudioPrompt")}</LoadAudioText>
                <LoadButton onClick={triggerFileSelect}>
                  <i className="bi bi-folder2-open"></i>
                  {t("timingSync.loadAudio")}
                </LoadButton>
              </LoadAudioPrompt>
            ) : (
              <AudioPlayer>
                <AudioInfo>
                  <AudioIcon>
                    <i className="bi bi-soundwave"></i>
                  </AudioIcon>
                  <AudioFileName>{trackFileName}</AudioFileName>
                  <ChangeFileButton onClick={triggerFileSelect}>
                    <i className="bi bi-arrow-repeat"></i>
                  </ChangeFileButton>
                </AudioInfo>

                <PlayerControls>
                  <PlayButton onClick={handlePlayPause} $isPlaying={isPlaying}>
                    <i className={`bi bi-${isPlaying ? "pause-fill" : "play-fill"}`}></i>
                  </PlayButton>

                  <ProgressSection>
                    <TimeDisplay $current>{formatTime(currentTime)}</TimeDisplay>
                    <ProgressSlider
                      type="range"
                      min={0}
                      max={duration || 100}
                      step={0.1}
                      value={currentTime}
                      onChange={handleSeek}
                    />
                    <TimeDisplay>{formatTime(duration)}</TimeDisplay>
                  </ProgressSection>
                </PlayerControls>

                <KeyboardHints>
                  <Hint>
                    <kbd>Space</kbd> {t("timingSync.playPause")}
                  </Hint>
                  <Hint>
                    <kbd>M</kbd> {t("timingSync.markTime")}
                  </Hint>
                  <Hint>
                    <kbd>↑↓</kbd> {t("timingSync.navigateSections")}
                  </Hint>
                </KeyboardHints>
              </AudioPlayer>
            )}
          </AudioSection>

          {/* Sections List */}
          <SectionsSection>
            <SectionsHeader>
              <SectionsTitle>
                <i className="bi bi-list-ol"></i>
                {t("timingSync.sections")}
              </SectionsTitle>
              <SyncProgress>
                {getSyncedCount()}/{sections.length} {t("timingSync.synced")}
              </SyncProgress>
              {getSyncedCount() > 0 && (
                <ClearAllButton onClick={handleClearAllTimes}>
                  <i className="bi bi-x-circle"></i>
                  {t("timingSync.clearAll")}
                </ClearAllButton>
              )}
            </SectionsHeader>

            <SectionsList>
              {sections.length === 0 ? (
                <EmptyState>
                  <i className="bi bi-info-circle"></i>
                  {t("timingSync.noSections")}
                </EmptyState>
              ) : (
                sections.map((section, index) => {
                  const color = SECTION_COLORS[index % SECTION_COLORS.length];
                  const isSelected = selectedSectionIndex === index;
                  const isSynced = section.startTime > 0;
                  const isEditing = editingIndex === index;

                  return (
                    <SectionRow
                      key={index}
                      $color={color}
                      $isSelected={isSelected}
                      $isSynced={isSynced}
                      onClick={() => handleJumpToSection(index)}
                    >
                      <SectionColorDot $color={color} $isSynced={isSynced} />

                      <SectionInfo>
                        <SectionName>{section.name}</SectionName>
                        <SectionLines>
                          {t("sectionEditor.lines")} {section.lineStart + 1}-{section.lineEnd + 1}
                        </SectionLines>
                      </SectionInfo>

                      <SectionTime>
                        {isEditing ? (
                          <TimeInput
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onBlur={handleSaveEditedTime}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveEditedTime();
                              if (e.key === "Escape") {
                                setEditingIndex(null);
                                setEditingValue("");
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                            placeholder="0:00.0"
                          />
                        ) : (
                          <TimeValue
                            $isSynced={isSynced}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditTime(index);
                            }}
                            title={t("timingSync.clickToEdit")}
                          >
                            {isSynced ? formatTime(section.startTime) : "--:--.-"}
                          </TimeValue>
                        )}
                      </SectionTime>

                      <SectionActions>
                        <MarkButton
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkTime(index);
                          }}
                          disabled={!trackUrl}
                          title={t("timingSync.markCurrentTime")}
                        >
                          <i className="bi bi-pin-angle-fill"></i>
                        </MarkButton>
                        {isSynced && (
                          <ClearButton
                            onClick={(e) => {
                              e.stopPropagation();
                              handleClearTime(index);
                            }}
                            title={t("timingSync.clearTime")}
                          >
                            <i className="bi bi-x"></i>
                          </ClearButton>
                        )}
                      </SectionActions>
                    </SectionRow>
                  );
                })
              )}
            </SectionsList>
          </SectionsSection>
        </ModalContent>

        <ModalFooter>
          <FooterHint>
            <i className="bi bi-info-circle"></i>
            {t("timingSync.hint")}
          </FooterHint>
          <DoneButton onClick={onClose}>
            <i className="bi bi-check-lg"></i>
            {t("common.close")}
          </DoneButton>
        </ModalFooter>
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
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(4px);
  z-index: ${theme.zIndex.modal};
  animation: fadeIn 0.2s ease;

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
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
  width: 95%;
  max-width: 600px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  z-index: ${theme.zIndex.modal + 10};
  box-shadow: var(--shadow-xl);
  animation: slideUp 0.3s ease;

  @keyframes slideUp {
    from { opacity: 0; transform: translate(-50%, -45%); }
    to { opacity: 1; transform: translate(-50%, -50%); }
  }
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  padding: ${theme.space[5]};
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
`;

const ModalTitle = styled.h2`
  font-size: ${theme.fontSizes.h4};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};

  i {
    color: ${theme.colors.brand.primary};
  }
`;

const SongName = styled.span`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-tertiary);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const CloseButton = styled.button`
  background: transparent;
  border: none;
  color: var(--color-text-tertiary);
  width: 36px;
  height: 36px;
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  font-size: ${theme.fontSizes.h3};

  &:hover {
    background: var(--color-bg-elevated);
    color: var(--color-text-primary);
  }
`;

const ModalContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${theme.space[5]};
  display: flex;
  flex-direction: column;
  gap: ${theme.space[5]};
`;

const AudioSection = styled.div`
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.base};
  overflow: hidden;
`;

const HiddenFileInput = styled.input`
  display: none;
`;

const LoadAudioPrompt = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${theme.space[3]};
  padding: ${theme.space[6]};
`;

const LoadAudioIcon = styled.div`
  width: 64px;
  height: 64px;
  border-radius: ${theme.radius.full};
  background: var(--color-bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${theme.fontSizes.h2};
  color: var(--color-text-tertiary);
`;

const LoadAudioText = styled.p`
  color: var(--color-text-secondary);
  font-size: ${theme.fontSizes.body};
  text-align: center;
  margin: 0;
`;

const LoadButton = styled.button`
  background: ${theme.colors.brand.primary};
  border: none;
  color: white;
  padding: ${theme.space[3]} ${theme.space[5]};
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.medium};

  &:hover {
    background: ${theme.colors.brand.primaryHover};
    transform: translateY(-1px);
  }
`;

const AudioPlayer = styled.div`
  padding: ${theme.space[4]};
  display: flex;
  flex-direction: column;
  gap: ${theme.space[3]};
`;

const AudioInfo = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
`;

const AudioIcon = styled.div`
  width: 40px;
  height: 40px;
  border-radius: ${theme.radius.base};
  background: ${theme.colors.brand.primary};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${theme.fontSizes.bodyLg};
  color: white;
`;

const AudioFileName = styled.div`
  flex: 1;
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ChangeFileButton = styled.button`
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  width: 32px;
  height: 32px;
  border-radius: ${theme.radius.sm};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  &:hover {
    border-color: ${theme.colors.brand.primary};
    color: ${theme.colors.brand.primary};
  }
`;

const PlayerControls = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
`;

const PlayButton = styled.button<{ $isPlaying: boolean }>`
  width: 48px;
  height: 48px;
  border-radius: ${theme.radius.full};
  border: none;
  background: ${(props) => props.$isPlaying ? theme.colors.brand.primaryHover : theme.colors.brand.primary};
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  font-size: ${theme.fontSizes.h4};
  flex-shrink: 0;

  &:hover {
    background: ${theme.colors.brand.primaryHover};
    transform: scale(1.05);
  }
`;

const ProgressSection = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
`;

const TimeDisplay = styled.span<{ $current?: boolean }>`
  font-size: ${theme.fontSizes.bodySm};
  font-family: ${theme.fonts.mono};
  color: ${(props) => props.$current ? theme.colors.brand.primary : 'var(--color-text-secondary)'};
  min-width: 55px;
  text-align: center;
`;

const ProgressSlider = styled.input`
  flex: 1;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--color-bg-tertiary);
  border-radius: ${theme.radius.full};
  cursor: pointer;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: ${theme.colors.brand.primary};
    cursor: pointer;
    transition: transform ${theme.transitions.fast} ease;

    &:hover {
      transform: scale(1.2);
    }
  }

  &::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: ${theme.colors.brand.primary};
    cursor: pointer;
    border: none;
  }
`;

const KeyboardHints = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${theme.space[3]};
  justify-content: center;
  padding-top: ${theme.space[2]};
  border-top: 1px solid var(--color-border);
`;

const Hint = styled.span`
  font-size: ${theme.fontSizes.bodyXs};
  color: var(--color-text-tertiary);
  display: flex;
  align-items: center;
  gap: ${theme.space[1]};

  kbd {
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: ${theme.radius.sm};
    padding: 2px 6px;
    font-family: ${theme.fonts.mono};
    font-size: ${theme.fontSizes.bodyXs};
    color: var(--color-text-secondary);
  }
`;

const SectionsSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[3]};
`;

const SectionsHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
`;

const SectionsTitle = styled.h3`
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};

  i {
    color: ${theme.colors.brand.primary};
  }
`;

const SyncProgress = styled.span`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-tertiary);
  margin-left: auto;
`;

const ClearAllButton = styled.button`
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  padding: ${theme.space[1]} ${theme.space[2]};
  border-radius: ${theme.radius.sm};
  font-size: ${theme.fontSizes.bodyXs};
  display: flex;
  align-items: center;
  gap: ${theme.space[1]};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  &:hover {
    border-color: ${theme.colors.semantic.error};
    color: ${theme.colors.semantic.error};
  }
`;

const SectionsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[2]};
  max-height: 250px;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: var(--color-bg-tertiary);
    border-radius: ${theme.radius.sm};
  }

  &::-webkit-scrollbar-thumb {
    background: var(--color-border-strong);
    border-radius: ${theme.radius.sm};

    &:hover {
      background: ${theme.colors.brand.primary};
    }
  }
`;

const EmptyState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${theme.space[2]};
  padding: ${theme.space[4]};
  color: var(--color-text-tertiary);
  font-size: ${theme.fontSizes.bodySm};
`;

const SectionRow = styled.div<{
  $color: { bg: string; border: string; text: string };
  $isSelected: boolean;
  $isSynced: boolean;
}>`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  padding: ${theme.space[3]};
  background: ${(props) => props.$isSelected ? props.$color.bg : 'var(--color-bg-primary)'};
  border: 1px solid ${(props) => props.$isSelected ? props.$color.border : 'var(--color-border)'};
  border-radius: ${theme.radius.base};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  ${(props) => props.$isSynced && `
    border-left: 3px solid ${props.$color.text};
  `}

  &:hover {
    background: ${(props) => props.$color.bg};
    border-color: ${(props) => props.$color.border};
  }
`;

const SectionColorDot = styled.div<{
  $color: { bg: string; border: string; text: string };
  $isSynced: boolean;
}>`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${(props) => props.$isSynced ? props.$color.text : 'var(--color-text-tertiary)'};
  flex-shrink: 0;
`;

const SectionInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const SectionName = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  color: var(--color-text-primary);
`;

const SectionLines = styled.div`
  font-size: ${theme.fontSizes.bodyXs};
  color: var(--color-text-tertiary);
`;

const SectionTime = styled.div`
  min-width: 70px;
  text-align: center;
`;

const TimeValue = styled.button<{ $isSynced: boolean }>`
  background: transparent;
  border: 1px solid transparent;
  font-family: ${theme.fonts.mono};
  font-size: ${theme.fontSizes.bodySm};
  color: ${(props) => props.$isSynced ? theme.colors.brand.primary : 'var(--color-text-tertiary)'};
  padding: ${theme.space[1]} ${theme.space[2]};
  border-radius: ${theme.radius.sm};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  &:hover {
    border-color: var(--color-border);
    background: var(--color-bg-tertiary);
  }
`;

const TimeInput = styled.input`
  width: 70px;
  font-family: ${theme.fonts.mono};
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-primary);
  background: var(--color-bg-secondary);
  border: 1px solid ${theme.colors.brand.primary};
  border-radius: ${theme.radius.sm};
  padding: ${theme.space[1]} ${theme.space[2]};
  text-align: center;

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2);
  }
`;

const SectionActions = styled.div`
  display: flex;
  gap: ${theme.space[1]};
`;

const MarkButton = styled.button`
  background: ${theme.colors.brand.primary};
  border: none;
  color: white;
  width: 32px;
  height: 32px;
  border-radius: ${theme.radius.sm};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  &:hover:not(:disabled) {
    background: ${theme.colors.brand.primaryHover};
  }

  &:disabled {
    background: var(--color-bg-tertiary);
    color: var(--color-text-disabled);
    cursor: not-allowed;
  }
`;

const ClearButton = styled.button`
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-tertiary);
  width: 32px;
  height: 32px;
  border-radius: ${theme.radius.sm};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  &:hover {
    border-color: ${theme.colors.semantic.error};
    color: ${theme.colors.semantic.error};
    background: ${theme.colors.semantic.errorBgDark};
  }
`;

const ModalFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${theme.space[3]};
  padding: ${theme.space[4]} ${theme.space[5]};
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
`;

const FooterHint = styled.div`
  font-size: ${theme.fontSizes.bodyXs};
  color: var(--color-text-tertiary);
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  flex: 1;

  i {
    color: ${theme.colors.brand.primary};
  }
`;

const DoneButton = styled.button`
  background: ${theme.colors.brand.primary};
  border: none;
  color: white;
  padding: ${theme.space[2]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.medium};

  &:hover {
    background: ${theme.colors.brand.primaryHover};
  }
`;
