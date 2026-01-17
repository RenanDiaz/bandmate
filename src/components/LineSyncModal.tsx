import { useState, useRef, useCallback, useEffect } from "react";
import styled from "styled-components";
import { theme } from "../theme";
import type { LineTiming } from "../services/songsService";
import { useTranslation } from "react-i18next";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  lineTimings: LineTiming[];
  onLineTimingsChange: (lineTimings: LineTiming[]) => void;
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

export const LineSyncModal = ({
  isOpen,
  onClose,
  content,
  lineTimings,
  onLineTimingsChange,
  songTitle,
}: Props) => {
  const { t } = useTranslation();
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const linesContainerRef = useRef<HTMLDivElement>(null);

  const [trackUrl, setTrackUrl] = useState<string | null>(null);
  const [trackFileName, setTrackFileName] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");

  const lines = content.split("\n");

  // Get timing for a line
  const getLineTiming = (lineIndex: number): number => {
    const timing = lineTimings.find((lt) => lt.lineIndex === lineIndex);
    return timing?.startTime ?? 0;
  };

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
      // M to mark current line
      if (e.code === "KeyM" && selectedLineIndex !== null) {
        e.preventDefault();
        handleMarkTime(selectedLineIndex);
      }
      // Arrow keys to navigate lines
      if (e.code === "ArrowDown" && selectedLineIndex !== null && selectedLineIndex < lines.length - 1) {
        e.preventDefault();
        setSelectedLineIndex(selectedLineIndex + 1);
        scrollToLine(selectedLineIndex + 1);
      }
      if (e.code === "ArrowUp" && selectedLineIndex !== null && selectedLineIndex > 0) {
        e.preventDefault();
        setSelectedLineIndex(selectedLineIndex - 1);
        scrollToLine(selectedLineIndex - 1);
      }
      // Enter to mark and advance
      if (e.code === "Enter" && selectedLineIndex !== null) {
        e.preventDefault();
        handleMarkTime(selectedLineIndex);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, trackUrl, selectedLineIndex, lines.length]);

  const scrollToLine = (index: number) => {
    const container = linesContainerRef.current;
    if (!container) return;

    const lineElement = container.querySelector(`[data-line-index="${index}"]`);
    if (lineElement) {
      lineElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

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

  const handleMarkTime = useCallback((lineIndex: number) => {
    // Read current time directly from audio element to avoid stale closure issues
    const audio = audioRef.current;
    const time = audio ? audio.currentTime : currentTime;
    const existingIndex = lineTimings.findIndex((lt) => lt.lineIndex === lineIndex);
    let updatedTimings: LineTiming[];

    if (existingIndex >= 0) {
      // Update existing timing
      updatedTimings = lineTimings.map((lt, i) =>
        i === existingIndex ? { ...lt, startTime: time } : lt
      );
    } else {
      // Add new timing
      updatedTimings = [...lineTimings, { lineIndex, startTime: time }];
      updatedTimings.sort((a, b) => a.lineIndex - b.lineIndex);
    }

    onLineTimingsChange(updatedTimings);

    // Auto-advance to next non-empty line
    let nextLine = lineIndex + 1;
    while (nextLine < lines.length && lines[nextLine].trim() === "") {
      nextLine++;
    }
    if (nextLine < lines.length) {
      setSelectedLineIndex(nextLine);
      scrollToLine(nextLine);
    }
  }, [lineTimings, currentTime, onLineTimingsChange, lines]);

  const handleJumpToLine = useCallback((lineIndex: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    const timing = getLineTiming(lineIndex);
    if (timing > 0) {
      audio.currentTime = timing;
      setCurrentTime(timing);
    }
    setSelectedLineIndex(lineIndex);
  }, [lineTimings]);

  const handleEditTime = useCallback((lineIndex: number) => {
    setEditingIndex(lineIndex);
    setEditingValue(formatTime(getLineTiming(lineIndex)));
  }, [lineTimings]);

  const handleSaveEditedTime = useCallback(() => {
    if (editingIndex === null) return;

    const newTime = parseTime(editingValue);
    const existingIndex = lineTimings.findIndex((lt) => lt.lineIndex === editingIndex);
    let updatedTimings: LineTiming[];

    if (newTime > 0) {
      if (existingIndex >= 0) {
        updatedTimings = lineTimings.map((lt, i) =>
          i === existingIndex ? { ...lt, startTime: newTime } : lt
        );
      } else {
        updatedTimings = [...lineTimings, { lineIndex: editingIndex, startTime: newTime }];
        updatedTimings.sort((a, b) => a.lineIndex - b.lineIndex);
      }
    } else {
      // Remove timing if set to 0
      updatedTimings = lineTimings.filter((lt) => lt.lineIndex !== editingIndex);
    }

    onLineTimingsChange(updatedTimings);
    setEditingIndex(null);
    setEditingValue("");
  }, [editingIndex, editingValue, lineTimings, onLineTimingsChange]);

  const handleClearTime = useCallback((lineIndex: number) => {
    const updatedTimings = lineTimings.filter((lt) => lt.lineIndex !== lineIndex);
    onLineTimingsChange(updatedTimings);
  }, [lineTimings, onLineTimingsChange]);

  const handleClearAllTimes = useCallback(() => {
    onLineTimingsChange([]);
  }, [onLineTimingsChange]);

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const getSyncedCount = () => lineTimings.length;
  const getNonEmptyLineCount = () => lines.filter((l) => l.trim() !== "").length;

  if (!isOpen) return null;

  return (
    <>
      <Overlay onClick={onClose} />
      <ModalContainer>
        <ModalHeader>
          <ModalTitle>
            <i className="bi bi-text-left"></i>
            {t("lineSync.title")}
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
                    <kbd>M</kbd> / <kbd>Enter</kbd> {t("lineSync.markLine")}
                  </Hint>
                  <Hint>
                    <kbd>↑↓</kbd> {t("lineSync.navigateLines")}
                  </Hint>
                </KeyboardHints>
              </AudioPlayer>
            )}
          </AudioSection>

          {/* Lines List */}
          <LinesSection>
            <LinesHeader>
              <LinesTitle>
                <i className="bi bi-text-left"></i>
                {t("lineSync.lines")}
              </LinesTitle>
              <SyncProgress>
                {getSyncedCount()}/{getNonEmptyLineCount()} {t("timingSync.synced")}
              </SyncProgress>
              {getSyncedCount() > 0 && (
                <ClearAllButton onClick={handleClearAllTimes}>
                  <i className="bi bi-x-circle"></i>
                  {t("timingSync.clearAll")}
                </ClearAllButton>
              )}
            </LinesHeader>

            <LinesList ref={linesContainerRef}>
              {lines.map((line, lineIndex) => {
                const isSelected = selectedLineIndex === lineIndex;
                const timing = getLineTiming(lineIndex);
                const isSynced = timing > 0;
                const isEditing = editingIndex === lineIndex;
                const isEmpty = line.trim() === "";

                if (isEmpty) {
                  return (
                    <EmptyLineRow
                      key={lineIndex}
                      data-line-index={lineIndex}
                    >
                      <LineNumber>{lineIndex + 1}</LineNumber>
                      <EmptyLineIndicator>—</EmptyLineIndicator>
                    </EmptyLineRow>
                  );
                }

                return (
                  <LineRow
                    key={lineIndex}
                    data-line-index={lineIndex}
                    $isSelected={isSelected}
                    $isSynced={isSynced}
                    onClick={() => handleJumpToLine(lineIndex)}
                  >
                    <LineNumber>{lineIndex + 1}</LineNumber>

                    <LineContent $isSynced={isSynced}>
                      {line}
                    </LineContent>

                    <LineTime>
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
                            handleEditTime(lineIndex);
                          }}
                          title={t("timingSync.clickToEdit")}
                        >
                          {isSynced ? formatTime(timing) : "--:--.-"}
                        </TimeValue>
                      )}
                    </LineTime>

                    <LineActions>
                      <MarkButton
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkTime(lineIndex);
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
                            handleClearTime(lineIndex);
                          }}
                          title={t("timingSync.clearTime")}
                        >
                          <i className="bi bi-x"></i>
                        </ClearButton>
                      )}
                    </LineActions>
                  </LineRow>
                );
              })}
            </LinesList>
          </LinesSection>
        </ModalContent>

        <ModalFooter>
          <FooterHint>
            <i className="bi bi-info-circle"></i>
            {t("lineSync.hint")}
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
  max-width: 700px;
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

const LinesSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[3]};
`;

const LinesHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
`;

const LinesTitle = styled.h3`
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

const LinesList = styled.div`
  display: flex;
  flex-direction: column;
  max-height: 350px;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.base};
  background: var(--color-bg-primary);

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

const LineRow = styled.div<{
  $isSelected: boolean;
  $isSynced: boolean;
}>`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  padding: ${theme.space[2]} ${theme.space[3]};
  background: ${(props) => props.$isSelected ? theme.colors.brand.primary + "20" : "transparent"};
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  ${(props) => props.$isSynced && `
    border-left: 3px solid ${theme.colors.brand.primary};
  `}

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: var(--color-bg-elevated);
  }
`;

const EmptyLineRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  padding: ${theme.space[1]} ${theme.space[3]};
  border-bottom: 1px solid var(--color-border);
  opacity: 0.3;

  &:last-child {
    border-bottom: none;
  }
`;

const LineNumber = styled.div`
  width: 32px;
  font-size: ${theme.fontSizes.bodyXs};
  font-family: ${theme.fonts.mono};
  color: var(--color-text-tertiary);
  text-align: right;
  flex-shrink: 0;
`;

const LineContent = styled.div<{ $isSynced: boolean }>`
  flex: 1;
  font-size: ${theme.fontSizes.bodySm};
  color: ${(props) => props.$isSynced ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'};
  font-family: ${theme.fonts.mono};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const EmptyLineIndicator = styled.div`
  flex: 1;
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-tertiary);
`;

const LineTime = styled.div`
  min-width: 70px;
  text-align: center;
`;

const TimeValue = styled.button<{ $isSynced: boolean }>`
  background: transparent;
  border: 1px solid transparent;
  font-family: ${theme.fonts.mono};
  font-size: ${theme.fontSizes.bodyXs};
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
  font-size: ${theme.fontSizes.bodyXs};
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

const LineActions = styled.div`
  display: flex;
  gap: ${theme.space[1]};
`;

const MarkButton = styled.button`
  background: ${theme.colors.brand.primary};
  border: none;
  color: white;
  width: 28px;
  height: 28px;
  border-radius: ${theme.radius.sm};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  font-size: ${theme.fontSizes.bodySm};

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
  width: 28px;
  height: 28px;
  border-radius: ${theme.radius.sm};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  font-size: ${theme.fontSizes.bodySm};

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
