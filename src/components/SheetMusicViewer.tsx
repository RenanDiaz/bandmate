import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import styled from "styled-components";
import { useTranslation } from "react-i18next";
import type { PageTiming } from "../services/songsService";
import { theme } from "../theme";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface SheetMusicViewerProps {
  pdfUrl: string;
  pageTimings?: PageTiming[];
  currentTime?: number;
  isPlaying?: boolean;
  onPageChange?: (page: number) => void;
  onNumPagesLoaded?: (numPages: number) => void;
  initialPage?: number;
}

export interface SheetMusicViewerHandle {
  goToNextPage: () => boolean;
  goToPrevPage: () => boolean;
}

const ViewerContainer = styled.div`
  position: relative;
  width: 100%;
  flex: 1;
  min-height: 0;
  background: ${theme.colors.dark.bg.primary};
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const PDFContainer = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  padding: ${theme.space[1]};

  .react-pdf__Document {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .react-pdf__Page {
    max-width: 100%;
    box-shadow: ${theme.shadows.lg};
    border-radius: ${theme.radius.base};
    overflow: hidden;

    canvas {
      max-width: 100%;
      height: auto !important;
    }
  }
`;

const NavigationOverlay = styled.div<{ $visible: boolean }>`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(
    to top,
    rgba(10, 10, 11, 0.95) 0%,
    rgba(10, 10, 11, 0.8) 70%,
    transparent 100%
  );
  padding: ${theme.space[4]};
  padding-top: ${theme.space[8]};
  transform: translateY(${({ $visible }) => ($visible ? "0" : "100%")});
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  transition: transform 0.3s ease, opacity 0.3s ease;
  z-index: 10;
`;

const MiniNavigation = styled.div<{ $visible: boolean }>`
  position: absolute;
  bottom: ${theme.space[2]};
  left: 50%;
  transform: translateX(-50%);
  background: rgba(10, 10, 11, 0.7);
  backdrop-filter: blur(8px);
  padding: ${theme.space[1]} ${theme.space[3]};
  border-radius: ${theme.radius.full};
  display: ${({ $visible }) => ($visible ? "flex" : "none")};
  align-items: center;
  gap: ${theme.space[2]};
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.dark.text.secondary};
  z-index: 5;
`;

const NavContent = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${theme.space[4]};
`;

const PageIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  color: ${theme.colors.dark.text.primary};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.medium};
`;

const NavButton = styled.button<{ $disabled?: boolean }>`
  background: ${({ $disabled }) =>
    $disabled ? theme.colors.dark.bg.tertiary : theme.colors.dark.bg.elevated};
  border: 1px solid ${theme.colors.dark.border.default};
  color: ${({ $disabled }) =>
    $disabled ? theme.colors.dark.text.disabled : theme.colors.dark.text.primary};
  border-radius: ${theme.radius.base};
  padding: ${theme.space[2]} ${theme.space[4]};
  font-size: ${theme.fontSizes.body};
  cursor: ${({ $disabled }) => ($disabled ? "not-allowed" : "pointer")};
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background: ${({ $disabled }) =>
      $disabled ? theme.colors.dark.bg.tertiary : theme.colors.dark.bg.hover};
  }

  &:active:not(:disabled) {
    transform: scale(0.98);
  }
`;

const ProgressBar = styled.div`
  width: 100%;
  max-width: 300px;
  height: 4px;
  background: ${theme.colors.dark.bg.tertiary};
  border-radius: ${theme.radius.full};
  overflow: hidden;
  margin-top: ${theme.space[3]};
`;

const ProgressFill = styled.div<{ $progress: number }>`
  height: 100%;
  width: ${({ $progress }) => $progress}%;
  background: ${theme.colors.brand.primary};
  transition: width 0.2s ease;
`;

const SyncIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  color: ${theme.colors.brand.primaryLight};
  font-size: ${theme.fontSizes.bodySm};

  i {
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
`;

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: ${theme.colors.dark.text.secondary};
  gap: ${theme.space[4]};
`;

const Spinner = styled.div`
  width: 40px;
  height: 40px;
  border: 3px solid ${theme.colors.dark.border.default};
  border-top-color: ${theme.colors.brand.primary};
  border-radius: 50%;
  animation: spin 1s linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const ErrorContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: ${theme.colors.semantic.error};
  gap: ${theme.space[4]};
  text-align: center;
  padding: ${theme.space[4]};

  i {
    font-size: 48px;
  }
`;

const KeyboardHint = styled.div`
  font-size: ${theme.fontSizes.bodyXs};
  color: ${theme.colors.dark.text.tertiary};
  margin-top: ${theme.space[2]};

  kbd {
    background: ${theme.colors.dark.bg.tertiary};
    padding: 2px 6px;
    border-radius: ${theme.radius.sm};
    margin: 0 2px;
  }
`;

const SheetMusicViewer = forwardRef<SheetMusicViewerHandle, SheetMusicViewerProps>(function SheetMusicViewer({
  pdfUrl,
  pageTimings,
  currentTime = 0,
  isPlaying = false,
  onPageChange,
  onNumPagesLoaded,
  initialPage = 1,
}: SheetMusicViewerProps, ref) {
  const { t } = useTranslation();
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [navVisible, setNavVisible] = useState(true);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const [containerHeight, setContainerHeight] = useState<number | null>(null);
  const [pageAspectRatio, setPageAspectRatio] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastInteractionRef = useRef<number>(Date.now());
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-hide navigation after inactivity
  const HIDE_DELAY = 3000;

  const showNavigation = useCallback(() => {
    lastInteractionRef.current = Date.now();
    setNavVisible(true);

    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }

    hideTimeoutRef.current = setTimeout(() => {
      setNavVisible(false);
    }, HIDE_DELAY);
  }, []);

  const handleInteraction = useCallback(() => {
    showNavigation();
  }, [showNavigation]);

  // Set up interaction listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const events = ["mousemove", "touchstart", "click"];
    events.forEach((event) => {
      container.addEventListener(event, handleInteraction);
    });

    // Initial show
    showNavigation();

    return () => {
      events.forEach((event) => {
        container.removeEventListener(event, handleInteraction);
      });
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [handleInteraction, showNavigation]);

  // Handle container resize - track both width and height for fit-to-page
  useEffect(() => {
    const container = pdfContainerRef.current;
    if (!container) return;

    const updateDimensions = () => {
      const rect = container.getBoundingClientRect();
      const padding = 16; // Account for padding (8px each side)
      let availableWidth = rect.width - padding;
      let availableHeight = rect.height - padding;

      // Fallback for cases where layout hasn't resolved yet (iPad/tablet)
      if (availableWidth <= 0 || availableHeight <= 0) {
        availableWidth = Math.max(availableWidth, window.innerWidth - 64);
        availableHeight = Math.max(availableHeight, window.innerHeight * 0.6);

        // Schedule a retry to get real dimensions once layout settles
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        retryTimerRef.current = setTimeout(() => {
          const retryRect = container.getBoundingClientRect();
          if (retryRect.width > 0 && retryRect.height > 0) {
            const w = Math.max(280, retryRect.width - padding);
            const h = retryRect.height - padding;
            setContainerWidth(w);
            setContainerHeight(h);
          }
        }, 100);
      }

      const width = Math.max(280, availableWidth);
      setContainerWidth(width);
      setContainerHeight(availableHeight);
    };

    // Capture initial dimensions immediately
    updateDimensions();

    const observer = new ResizeObserver(() => {
      updateDimensions();
    });

    observer.observe(container);
    return () => {
      observer.disconnect();
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

  // Sync page with audio timing
  useEffect(() => {
    if (!pageTimings || pageTimings.length === 0 || !isPlaying) return;

    // Find the correct page for current time
    let targetPage = 1;
    for (const timing of pageTimings) {
      if (currentTime >= timing.startTime) {
        targetPage = timing.page;
      } else {
        break;
      }
    }

    if (targetPage !== currentPage) {
      setCurrentPage(targetPage);
      onPageChange?.(targetPage);
    }
  }, [currentTime, pageTimings, isPlaying, currentPage, onPageChange]);

  const handleDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
    setError(null);
    onNumPagesLoaded?.(numPages);
  };

  const handleDocumentLoadError = (err: Error) => {
    console.error("PDF load error:", err);
    setError(err.message);
    setLoading(false);
  };

  const handlePageLoadSuccess = (page: { originalWidth: number; originalHeight: number }) => {
    if (page.originalWidth > 0 && page.originalHeight > 0) {
      setPageAspectRatio(page.originalWidth / page.originalHeight);
    }
  };

  // Calculate the optimal width to fit the page within the container (fit-to-page)
  const renderWidth = (() => {
    if (containerWidth === null || containerHeight === null) return null;
    if (!pageAspectRatio) return containerWidth; // Before page loads, use container width

    // Calculate what height the page would be at full container width
    const heightAtFullWidth = containerWidth / pageAspectRatio;

    if (heightAtFullWidth <= containerHeight) {
      // Page fits vertically at full width - use full width
      return containerWidth;
    }

    // Page would overflow vertically - constrain by height instead
    const widthFromHeight = containerHeight * pageAspectRatio;
    return Math.max(280, Math.min(widthFromHeight, containerWidth));
  })();

  const goToPage = useCallback(
    (page: number) => {
      if (!numPages) return;
      const newPage = Math.max(1, Math.min(page, numPages));
      setCurrentPage(newPage);
      onPageChange?.(newPage);
      showNavigation();
    },
    [numPages, onPageChange, showNavigation]
  );

  const goToPrevPage = useCallback(() => {
    goToPage(currentPage - 1);
  }, [currentPage, goToPage]);

  const goToNextPage = useCallback(() => {
    goToPage(currentPage + 1);
  }, [currentPage, goToPage]);

  // Expose navigation methods for parent component via ref
  useImperativeHandle(ref, () => ({
    goToNextPage: () => {
      if (!numPages || currentPage >= numPages) return false;
      goToPage(currentPage + 1);
      return true;
    },
    goToPrevPage: () => {
      if (currentPage <= 1) return false;
      goToPage(currentPage - 1);
      return true;
    },
  }), [numPages, currentPage, goToPage]);

  // Keyboard navigation for PageUp/PageDown
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "PageUp") {
        e.preventDefault();
        goToPrevPage();
      } else if (e.key === "PageDown") {
        e.preventDefault();
        goToNextPage();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToPrevPage, goToNextPage]);

  const progress = numPages ? (currentPage / numPages) * 100 : 0;
  const hasSyncTimings = pageTimings && pageTimings.length > 0;

  if (error) {
    return (
      <ViewerContainer ref={containerRef}>
        <ErrorContainer>
          <i className="bi bi-file-earmark-x" />
          <div>{t("sheetMusic.loadError", "Failed to load sheet music")}</div>
          <div style={{ fontSize: "0.875rem", opacity: 0.7 }}>{error}</div>
        </ErrorContainer>
      </ViewerContainer>
    );
  }

  return (
    <ViewerContainer ref={containerRef}>
      <PDFContainer ref={pdfContainerRef}>
        {(loading || renderWidth === null) && (
          <LoadingContainer>
            <Spinner />
            <div>{t("sheetMusic.loading", "Loading sheet music...")}</div>
          </LoadingContainer>
        )}
        {renderWidth !== null && (
          <Document
            file={pdfUrl}
            onLoadSuccess={handleDocumentLoadSuccess}
            onLoadError={handleDocumentLoadError}
            loading={null}
          >
            <Page
              pageNumber={currentPage}
              width={renderWidth}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              onLoadSuccess={handlePageLoadSuccess}
            />
          </Document>
        )}
      </PDFContainer>

      {/* Mini navigation when full nav is hidden */}
      <MiniNavigation $visible={!navVisible && !loading && numPages !== null}>
        {currentPage} / {numPages}
      </MiniNavigation>

      {/* Full navigation overlay */}
      <NavigationOverlay $visible={navVisible && !loading && numPages !== null}>
        <NavContent>
          <NavButton
            onClick={goToPrevPage}
            $disabled={currentPage <= 1}
            title={t("sheetMusic.prevPage", "Previous page")}
          >
            <i className="bi bi-chevron-left" />
            {t("sheetMusic.prev", "Prev")}
          </NavButton>

          <PageIndicator>
            {hasSyncTimings && isPlaying && (
              <SyncIndicator>
                <i className="bi bi-link-45deg" />
              </SyncIndicator>
            )}
            <span>
              {currentPage} / {numPages}
            </span>
          </PageIndicator>

          <NavButton
            onClick={goToNextPage}
            $disabled={currentPage >= (numPages || 1)}
            title={t("sheetMusic.nextPage", "Next page")}
          >
            {t("sheetMusic.next", "Next")}
            <i className="bi bi-chevron-right" />
          </NavButton>
        </NavContent>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <ProgressBar>
            <ProgressFill $progress={progress} />
          </ProgressBar>
          <KeyboardHint>
            <kbd>←</kbd>/<kbd>→</kbd> {t("sheetMusic.toNavigate", "to navigate pages")}
          </KeyboardHint>
        </div>
      </NavigationOverlay>
    </ViewerContainer>
  );
});

export default SheetMusicViewer;
