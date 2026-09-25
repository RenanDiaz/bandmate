import { useState, useEffect, useRef, useCallback } from "react";
import { Document, Page } from "react-pdf";
import styled from "styled-components";
import { useTranslation } from "react-i18next";
import { theme } from "../theme";
import type { PageTiming } from "../services/songsService";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import "../lib/pdfWorker";

interface PageTimingSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string;
  audioUrl?: string;
  initialTimings?: PageTiming[];
  onSave: (timings: PageTiming[]) => void;
  sheetMusicName: string;
}

export default function PageTimingSyncModal({
  isOpen,
  onClose,
  pdfUrl,
  audioUrl,
  initialTimings = [],
  onSave,
  sheetMusicName,
}: PageTimingSyncModalProps) {
  const { t } = useTranslation();
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageTimings, setPageTimings] = useState<PageTiming[]>(initialTimings);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize timings from props
  useEffect(() => {
    if (initialTimings.length > 0) {
      setPageTimings(initialTimings);
    }
  }, [initialTimings]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentPage(1);
      setCurrentTime(0);
      setIsPlaying(false);
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
      }
    }
  }, [isOpen]);

  const handleDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);

    // Initialize timings for all pages if not already set
    if (pageTimings.length === 0) {
      const initialTimings: PageTiming[] = Array.from({ length: numPages }, (_, i) => ({
        page: i + 1,
        startTime: 0,
      }));
      setPageTimings(initialTimings);
    }
  };

  const handleAudioTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleAudioLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const seekTo = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const markCurrentPageTiming = useCallback(() => {
    setPageTimings((prev) => {
      const updated = [...prev];
      const index = updated.findIndex((t) => t.page === currentPage);
      if (index >= 0) {
        updated[index] = { page: currentPage, startTime: currentTime };
      } else {
        updated.push({ page: currentPage, startTime: currentTime });
      }
      // Sort by page number
      return updated.sort((a, b) => a.page - b.page);
    });
  }, [currentPage, currentTime]);

  const clearPageTiming = useCallback((page: number) => {
    setPageTimings((prev) => prev.map((t) => (t.page === page ? { ...t, startTime: 0 } : t)));
  }, []);

  const goToPage = useCallback(
    (page: number) => {
      if (!numPages) return;
      const newPage = Math.max(1, Math.min(page, numPages));
      setCurrentPage(newPage);
    },
    [numPages]
  );

  const handleSave = () => {
    // Filter out pages with startTime 0 except for page 1
    const validTimings = pageTimings.filter((t) => t.page === 1 || t.startTime > 0);
    onSave(validTimings);
    onClose();
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins}:${secs.toString().padStart(2, "0")}.${ms}`;
  };

  const getTimingForPage = (page: number): number => {
    const timing = pageTimings.find((t) => t.page === page);
    return timing?.startTime || 0;
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === " ") {
        e.preventDefault();
        togglePlayPause();
      } else if (e.key === "ArrowLeft" && e.shiftKey) {
        e.preventDefault();
        goToPage(currentPage - 1);
      } else if (e.key === "ArrowRight" && e.shiftKey) {
        e.preventDefault();
        goToPage(currentPage + 1);
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        markCurrentPageTiming();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, togglePlayPause, goToPage, currentPage, markCurrentPageTiming, onClose]);

  if (!isOpen) return null;

  return (
    <ModalOverlay onClick={onClose}>
      <ModalContent onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>
            <i className="bi bi-clock-history" />
            {t("sheetMusic.syncTimings", "Sync Page Timings")}
          </ModalTitle>
          <ModalSubtitle>{sheetMusicName}</ModalSubtitle>
          <CloseButton onClick={onClose}>
            <i className="bi bi-x-lg" />
          </CloseButton>
        </ModalHeader>

        <ModalBody>
          <LeftPanel>
            {/* PDF Viewer */}
            <PDFContainer ref={containerRef}>
              {loading && (
                <LoadingOverlay>
                  <Spinner />
                  <span>{t("sheetMusic.loading", "Loading...")}</span>
                </LoadingOverlay>
              )}
              <Document
                file={pdfUrl}
                onLoadSuccess={handleDocumentLoadSuccess}
                loading={null}
              >
                <Page
                  pageNumber={currentPage}
                  width={400}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
              </Document>
            </PDFContainer>

            {/* Page Navigation */}
            <PageNavigation>
              <NavButton onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}>
                <i className="bi bi-chevron-left" />
              </NavButton>
              <PageIndicator>
                {currentPage} / {numPages || "?"}
              </PageIndicator>
              <NavButton
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= (numPages || 1)}
              >
                <i className="bi bi-chevron-right" />
              </NavButton>
            </PageNavigation>
          </LeftPanel>

          <RightPanel>
            {/* Audio Player */}
            {audioUrl ? (
              <AudioSection>
                <SectionTitle>
                  <i className="bi bi-music-note-beamed" />
                  {t("sheetMusic.backingTrack", "Backing Track")}
                </SectionTitle>
                <audio
                  ref={audioRef}
                  src={audioUrl}
                  onTimeUpdate={handleAudioTimeUpdate}
                  onLoadedMetadata={handleAudioLoadedMetadata}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                />
                <AudioControls>
                  <PlayButton onClick={togglePlayPause}>
                    <i className={`bi bi-${isPlaying ? "pause-fill" : "play-fill"}`} />
                  </PlayButton>
                  <TimeDisplay>
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </TimeDisplay>
                </AudioControls>
                <ProgressBarContainer onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const percent = x / rect.width;
                  seekTo(percent * duration);
                }}>
                  <ProgressBarFill $percent={(currentTime / duration) * 100 || 0} />
                  {/* Show timing markers */}
                  {pageTimings.map((timing) => (
                    timing.startTime > 0 && (
                      <TimingMarker
                        key={timing.page}
                        $percent={(timing.startTime / duration) * 100}
                        title={`Page ${timing.page}: ${formatTime(timing.startTime)}`}
                      />
                    )
                  ))}
                </ProgressBarContainer>
              </AudioSection>
            ) : (
              <NoAudioMessage>
                <i className="bi bi-exclamation-triangle" />
                <p>{t("sheetMusic.noBackingTrack", "No backing track available for this song. Add a backing track to sync page timings.")}</p>
              </NoAudioMessage>
            )}

            {/* Mark Timing Button */}
            <MarkTimingSection>
              <MarkButton onClick={markCurrentPageTiming} disabled={!audioUrl}>
                <i className="bi bi-stopwatch" />
                {t("sheetMusic.markPage", "Mark Page")} {currentPage}
                <kbd>M</kbd>
              </MarkButton>
              <CurrentTiming>
                {t("sheetMusic.currentTiming", "Current timing for page")} {currentPage}:
                <TimingValue $hasValue={getTimingForPage(currentPage) > 0}>
                  {getTimingForPage(currentPage) > 0
                    ? formatTime(getTimingForPage(currentPage))
                    : t("sheetMusic.notSet", "Not set")}
                </TimingValue>
              </CurrentTiming>
            </MarkTimingSection>

            {/* Timings List */}
            <TimingsSection>
              <SectionTitle>
                <i className="bi bi-list-ol" />
                {t("sheetMusic.pageTimings", "Page Timings")}
              </SectionTitle>
              <TimingsList>
                {numPages &&
                  Array.from({ length: numPages }, (_, i) => i + 1).map((page) => {
                    const timing = getTimingForPage(page);
                    return (
                      <TimingItem key={page} $active={page === currentPage}>
                        <TimingPage onClick={() => goToPage(page)}>
                          {t("sheetMusic.page", "Page")} {page}
                        </TimingPage>
                        <TimingTime $hasValue={timing > 0}>
                          {timing > 0 ? formatTime(timing) : "--:--.-"}
                        </TimingTime>
                        {timing > 0 && (
                          <ClearButton
                            onClick={() => clearPageTiming(page)}
                            title={t("sheetMusic.clearTiming", "Clear timing")}
                          >
                            <i className="bi bi-x" />
                          </ClearButton>
                        )}
                      </TimingItem>
                    );
                  })}
              </TimingsList>
            </TimingsSection>

            {/* Keyboard Shortcuts */}
            <ShortcutsHint>
              <kbd>Space</kbd> {t("sheetMusic.playPause", "Play/Pause")} •
              <kbd>M</kbd> {t("sheetMusic.markTiming", "Mark timing")} •
              <kbd>Shift</kbd>+<kbd>Arrow</kbd> {t("sheetMusic.changePage", "Change page")}
            </ShortcutsHint>
          </RightPanel>
        </ModalBody>

        <ModalFooter>
          <FooterButton onClick={onClose}>
            {t("common.cancel", "Cancel")}
          </FooterButton>
          <FooterButton $variant="primary" onClick={handleSave}>
            <i className="bi bi-check-lg" />
            {t("common.save", "Save Timings")}
          </FooterButton>
        </ModalFooter>
      </ModalContent>
    </ModalOverlay>
  );
}

// Styled Components
const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  /* Portaled to body: must stack above a parent modal's container, which
     sits at modal + 10 (see EditSongModal's ModalContainer). */
  z-index: ${theme.zIndex.modal + 10};
  padding: ${theme.space[4]};
`;

const ModalContent = styled.div`
  background: ${theme.colors.dark.bg.secondary};
  border: 1px solid ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.lg};
  width: 100%;
  max-width: 1000px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const ModalHeader = styled.div`
  padding: ${theme.space[4]} ${theme.space[5]};
  border-bottom: 1px solid ${theme.colors.dark.border.default};
  position: relative;
`;

const ModalTitle = styled.h2`
  margin: 0;
  font-size: ${theme.fontSizes.h3};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.dark.text.primary};
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};

  i {
    color: ${theme.colors.brand.primary};
  }
`;

const ModalSubtitle = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.dark.text.secondary};
  margin-top: ${theme.space[1]};
`;

const CloseButton = styled.button`
  position: absolute;
  top: ${theme.space[4]};
  right: ${theme.space[4]};
  background: transparent;
  border: none;
  color: ${theme.colors.dark.text.secondary};
  font-size: ${theme.fontSizes.h3};
  cursor: pointer;
  padding: ${theme.space[1]};

  &:hover {
    color: ${theme.colors.dark.text.primary};
  }
`;

const ModalBody = styled.div`
  flex: 1;
  display: flex;
  overflow: hidden;

  @media (max-width: ${theme.breakpoints.md}) {
    flex-direction: column;
  }
`;

const LeftPanel = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  border-right: 1px solid ${theme.colors.dark.border.default};
  padding: ${theme.space[4]};

  @media (max-width: ${theme.breakpoints.md}) {
    border-right: none;
    border-bottom: 1px solid ${theme.colors.dark.border.default};
  }
`;

const RightPanel = styled.div`
  width: 360px;
  display: flex;
  flex-direction: column;
  padding: ${theme.space[4]};
  overflow-y: auto;

  @media (max-width: ${theme.breakpoints.md}) {
    width: 100%;
  }
`;

const PDFContainer = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${theme.colors.dark.bg.primary};
  border-radius: ${theme.radius.base};
  overflow: hidden;
  position: relative;
  min-height: 300px;

  .react-pdf__Page {
    box-shadow: ${theme.shadows.md};
  }
`;

const LoadingOverlay = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${theme.space[3]};
  background: ${theme.colors.dark.bg.primary};
  color: ${theme.colors.dark.text.secondary};
`;

const Spinner = styled.div`
  width: 32px;
  height: 32px;
  border: 3px solid ${theme.colors.dark.border.default};
  border-top-color: ${theme.colors.brand.primary};
  border-radius: 50%;
  animation: spin 0.8s linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const PageNavigation = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${theme.space[3]};
  padding-top: ${theme.space[3]};
`;

const NavButton = styled.button`
  background: ${theme.colors.dark.bg.tertiary};
  border: 1px solid ${theme.colors.dark.border.default};
  color: ${theme.colors.dark.text.primary};
  width: 40px;
  height: 40px;
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  &:hover:not(:disabled) {
    background: ${theme.colors.dark.bg.elevated};
    border-color: ${theme.colors.brand.primary};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const PageIndicator = styled.div`
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.medium};
  color: ${theme.colors.dark.text.primary};
  min-width: 80px;
  text-align: center;
`;

const AudioSection = styled.div`
  margin-bottom: ${theme.space[4]};
`;

const SectionTitle = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.dark.text.secondary};
  text-transform: uppercase;
  letter-spacing: ${theme.letterSpacing.wide};
  margin-bottom: ${theme.space[3]};

  i {
    color: ${theme.colors.brand.primary};
  }
`;

const AudioControls = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  margin-bottom: ${theme.space[2]};
`;

const PlayButton = styled.button`
  background: ${theme.colors.brand.primary};
  border: none;
  color: white;
  width: 48px;
  height: 48px;
  border-radius: ${theme.radius.full};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  font-size: ${theme.fontSizes.h3};

  &:hover {
    background: ${theme.colors.brand.primaryHover};
    transform: scale(1.05);
  }
`;

const TimeDisplay = styled.div`
  font-family: ${theme.fonts.mono};
  font-size: ${theme.fontSizes.body};
  color: ${theme.colors.dark.text.primary};
`;

const ProgressBarContainer = styled.div`
  height: 8px;
  background: ${theme.colors.dark.bg.tertiary};
  border-radius: ${theme.radius.full};
  cursor: pointer;
  position: relative;
  overflow: visible;
`;

const ProgressBarFill = styled.div<{ $percent: number }>`
  height: 100%;
  width: ${(props) => props.$percent}%;
  background: ${theme.colors.brand.primary};
  border-radius: ${theme.radius.full};
  transition: width 0.1s linear;
`;

const TimingMarker = styled.div<{ $percent: number }>`
  position: absolute;
  left: ${(props) => props.$percent}%;
  top: -4px;
  width: 4px;
  height: 16px;
  background: ${theme.colors.semantic.warning};
  border-radius: ${theme.radius.sm};
  transform: translateX(-50%);
`;

const NoAudioMessage = styled.div`
  padding: ${theme.space[4]};
  background: ${theme.colors.semantic.warningBgDark};
  border: 1px solid ${theme.colors.semantic.warning};
  border-radius: ${theme.radius.base};
  margin-bottom: ${theme.space[4]};
  text-align: center;

  i {
    font-size: ${theme.fontSizes.h2};
    color: ${theme.colors.semantic.warning};
    display: block;
    margin-bottom: ${theme.space[2]};
  }

  p {
    margin: 0;
    font-size: ${theme.fontSizes.bodySm};
    color: ${theme.colors.dark.text.secondary};
  }
`;

const MarkTimingSection = styled.div`
  margin-bottom: ${theme.space[4]};
`;

const MarkButton = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${theme.space[2]};
  background: ${theme.colors.semantic.success};
  border: none;
  color: white;
  padding: ${theme.space[3]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  kbd {
    background: rgba(255, 255, 255, 0.2);
    padding: 2px 6px;
    border-radius: ${theme.radius.sm};
    font-size: ${theme.fontSizes.bodySm};
    margin-left: ${theme.space[2]};
  }

  &:hover:not(:disabled) {
    background: #059669;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const CurrentTiming = styled.div`
  margin-top: ${theme.space[2]};
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.dark.text.secondary};
  text-align: center;
`;

const TimingValue = styled.span<{ $hasValue: boolean }>`
  margin-left: ${theme.space[2]};
  font-weight: ${theme.fontWeights.semibold};
  color: ${(props) =>
    props.$hasValue ? theme.colors.brand.primary : theme.colors.dark.text.tertiary};
`;

const TimingsSection = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
`;

const TimingsList = styled.div`
  flex: 1;
  overflow-y: auto;
  background: ${theme.colors.dark.bg.tertiary};
  border: 1px solid ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.base};
  padding: ${theme.space[2]};
`;

const TimingItem = styled.div<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  padding: ${theme.space[2]} ${theme.space[3]};
  border-radius: ${theme.radius.sm};
  background: ${(props) =>
    props.$active ? `${theme.colors.brand.primary}20` : "transparent"};
  border-left: 3px solid
    ${(props) => (props.$active ? theme.colors.brand.primary : "transparent")};
  transition: all ${theme.transitions.fast} ease;

  &:hover {
    background: ${theme.colors.dark.bg.elevated};
  }
`;

const TimingPage = styled.button`
  background: none;
  border: none;
  color: ${theme.colors.dark.text.primary};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;
  padding: 0;
  flex: 1;
  text-align: left;

  &:hover {
    color: ${theme.colors.brand.primary};
  }
`;

const TimingTime = styled.div<{ $hasValue: boolean }>`
  font-family: ${theme.fonts.mono};
  font-size: ${theme.fontSizes.bodySm};
  color: ${(props) =>
    props.$hasValue ? theme.colors.dark.text.primary : theme.colors.dark.text.disabled};
`;

const ClearButton = styled.button`
  background: transparent;
  border: none;
  color: ${theme.colors.dark.text.tertiary};
  padding: ${theme.space[1]};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    color: ${theme.colors.semantic.error};
  }
`;

const ShortcutsHint = styled.div`
  margin-top: ${theme.space[3]};
  padding: ${theme.space[2]};
  background: ${theme.colors.dark.bg.tertiary};
  border-radius: ${theme.radius.sm};
  font-size: ${theme.fontSizes.bodyXs};
  color: ${theme.colors.dark.text.tertiary};
  text-align: center;

  kbd {
    background: ${theme.colors.dark.bg.elevated};
    padding: 2px 4px;
    border-radius: ${theme.radius.sm};
    margin: 0 2px;
  }
`;

const ModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${theme.space[3]};
  padding: ${theme.space[4]} ${theme.space[5]};
  border-top: 1px solid ${theme.colors.dark.border.default};
`;

const FooterButton = styled.button<{ $variant?: "primary" }>`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  padding: ${theme.space[2]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  ${(props) =>
    props.$variant === "primary"
      ? `
    background: ${theme.colors.brand.primary};
    border: none;
    color: white;
    &:hover {
      background: ${theme.colors.brand.primaryHover};
    }
  `
      : `
    background: transparent;
    border: 1px solid ${theme.colors.dark.border.default};
    color: ${theme.colors.dark.text.primary};
    &:hover {
      background: ${theme.colors.dark.bg.elevated};
    }
  `}
`;
