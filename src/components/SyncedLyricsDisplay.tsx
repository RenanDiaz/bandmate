import React, { useEffect, useRef, useMemo } from "react";
import styled from "styled-components";
import { theme } from "../theme";
import type { SectionTiming } from "../services/songsService";
import { useTranslation } from "react-i18next";

interface Props {
  content: string;
  contentType: "chords" | "lyrics";
  sections: SectionTiming[];
  currentTime: number;
  isPlaying: boolean;
  onSectionClick?: (startTime: number) => void;
}

const SECTION_COLORS = [
  { bg: "rgba(139, 92, 246, 0.12)", border: "#8b5cf6", text: "#a78bfa" },
  { bg: "rgba(59, 130, 246, 0.12)", border: "#3b82f6", text: "#60a5fa" },
  { bg: "rgba(34, 197, 94, 0.12)", border: "#22c55e", text: "#4ade80" },
  { bg: "rgba(249, 115, 22, 0.12)", border: "#f97316", text: "#fb923c" },
  { bg: "rgba(236, 72, 153, 0.12)", border: "#ec4899", text: "#f472b6" },
  { bg: "rgba(14, 165, 233, 0.12)", border: "#0ea5e9", text: "#38bdf8" },
  { bg: "rgba(168, 85, 247, 0.12)", border: "#a855f7", text: "#c084fc" },
  { bg: "rgba(234, 179, 8, 0.12)", border: "#eab308", text: "#facc15" },
];

export const SyncedLyricsDisplay = ({
  content,
  contentType,
  sections,
  currentTime,
  isPlaying,
  onSectionClick,
}: Props) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const activeSectionRef = useRef<HTMLDivElement>(null);
  const lastScrolledSectionRef = useRef<number | null>(null);

  const lines = useMemo(() => content.split("\n"), [content]);

  // Find current section based on time
  const currentSectionIndex = useMemo(() => {
    if (sections.length === 0 || currentTime === 0) return -1;

    // Find the last section whose startTime is <= currentTime
    let activeIndex = -1;
    for (let i = 0; i < sections.length; i++) {
      if (sections[i].startTime > 0 && sections[i].startTime <= currentTime) {
        activeIndex = i;
      } else if (sections[i].startTime > currentTime) {
        break;
      }
    }
    return activeIndex;
  }, [sections, currentTime]);

  // Get section info for a line
  const getSectionForLine = (lineIndex: number): { index: number; section: SectionTiming } | null => {
    const idx = sections.findIndex(
      (s) => lineIndex >= s.lineStart && lineIndex <= s.lineEnd
    );
    if (idx === -1) return null;
    return { index: idx, section: sections[idx] };
  };

  // Auto-scroll to active section when it changes
  useEffect(() => {
    if (
      currentSectionIndex >= 0 &&
      currentSectionIndex !== lastScrolledSectionRef.current &&
      activeSectionRef.current &&
      containerRef.current &&
      isPlaying
    ) {
      lastScrolledSectionRef.current = currentSectionIndex;

      // Smooth scroll to active section
      activeSectionRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [currentSectionIndex, isPlaying]);

  // Reset scroll tracking when song changes (content changes)
  useEffect(() => {
    lastScrolledSectionRef.current = null;
  }, [content]);

  // Check if we have any synced sections
  const hasSyncedSections = sections.some((s) => s.startTime > 0);

  // Group lines by section for rendering
  const renderContent = () => {
    if (sections.length === 0 || !hasSyncedSections) {
      // No sections defined or no synced sections - render plain text
      return <PlainContent $contentType={contentType}>{content}</PlainContent>;
    }

    // Render with section highlighting
    const elements: React.ReactNode[] = [];
    let currentSectionIdx = -1;
    let sectionLines: { line: string; lineIndex: number }[] = [];

    const flushSection = () => {
      if (sectionLines.length === 0) return;

      if (currentSectionIdx >= 0) {
        const section = sections[currentSectionIdx];
        const color = SECTION_COLORS[currentSectionIdx % SECTION_COLORS.length];
        const isActive = currentSectionIdx === currentSectionIndex;
        const isSynced = section.startTime > 0;

        elements.push(
          <SectionBlock
            key={`section-${currentSectionIdx}`}
            ref={isActive ? activeSectionRef : null}
            $color={color}
            $isActive={isActive}
            $isSynced={isSynced}
            onClick={() => isSynced && onSectionClick?.(section.startTime)}
            $clickable={isSynced && !!onSectionClick}
          >
            <SectionHeader $color={color} $isActive={isActive}>
              <SectionName>{section.name}</SectionName>
              {isSynced && (
                <SectionTime>
                  {formatTime(section.startTime)}
                </SectionTime>
              )}
              {isActive && isPlaying && (
                <PlayingIndicator>
                  <i className="bi bi-soundwave"></i>
                </PlayingIndicator>
              )}
            </SectionHeader>
            <SectionContent $contentType={contentType}>
              {sectionLines.map(({ line, lineIndex }) => (
                <Line key={lineIndex} $isEmpty={line.trim() === ""}>
                  {line || " "}
                </Line>
              ))}
            </SectionContent>
          </SectionBlock>
        );
      } else {
        // Lines not in any section (before first section or between sections)
        elements.push(
          <UnsectionedBlock key={`unsectioned-${elements.length}`}>
            {sectionLines.map(({ line, lineIndex }) => (
              <Line key={lineIndex} $isEmpty={line.trim() === ""}>
                {line || " "}
              </Line>
            ))}
          </UnsectionedBlock>
        );
      }

      sectionLines = [];
    };

    lines.forEach((line, lineIndex) => {
      const sectionInfo = getSectionForLine(lineIndex);
      const newSectionIdx = sectionInfo?.index ?? -1;

      if (newSectionIdx !== currentSectionIdx) {
        flushSection();
        currentSectionIdx = newSectionIdx;
      }

      sectionLines.push({ line, lineIndex });
    });

    flushSection();

    return elements;
  };

  return (
    <Container ref={containerRef}>
      <ContentWrapper>
        {hasSyncedSections && currentSectionIndex >= 0 && (
          <CurrentSectionIndicator>
            <i className="bi bi-play-circle-fill"></i>
            {t("syncedLyrics.nowPlaying")}: {sections[currentSectionIndex].name}
          </CurrentSectionIndicator>
        )}
        {renderContent()}
      </ContentWrapper>
    </Container>
  );
};

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

// Styled Components

const Container = styled.div`
  flex: 1;
  overflow-y: auto;
  scroll-behavior: smooth;

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

const ContentWrapper = styled.div`
  padding: ${theme.space[4]};
  display: flex;
  flex-direction: column;
  gap: ${theme.space[4]};
`;

const CurrentSectionIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  padding: ${theme.space[2]} ${theme.space[3]};
  background: ${theme.colors.brand.primary}20;
  border: 1px solid ${theme.colors.brand.primary}40;
  border-radius: ${theme.radius.base};
  color: ${theme.colors.brand.primary};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  position: sticky;
  top: 0;
  z-index: 10;
  backdrop-filter: blur(8px);

  i {
    font-size: ${theme.fontSizes.body};
  }
`;

const PlainContent = styled.pre<{ $contentType: "chords" | "lyrics" }>`
  font-family: ${(props) =>
    props.$contentType === "chords" ? theme.fonts.mono : theme.fonts.sans};
  font-size: ${theme.fontSizes.bodyLg};
  color: ${theme.colors.dark.text.primary};
  white-space: pre-wrap;
  word-break: break-word;
  line-height: ${theme.lineHeights.loose};
  margin: 0;
`;

const SectionBlock = styled.div<{
  $color: { bg: string; border: string; text: string };
  $isActive: boolean;
  $isSynced: boolean;
  $clickable: boolean;
}>`
  background: ${(props) => props.$isActive ? props.$color.bg : "transparent"};
  border-left: 4px solid ${(props) =>
    props.$isActive ? props.$color.border : "transparent"};
  border-radius: ${theme.radius.base};
  padding: ${theme.space[3]};
  transition: all 0.3s ease;
  cursor: ${(props) => (props.$clickable ? "pointer" : "default")};

  ${(props) =>
    props.$isActive &&
    `
    box-shadow: 0 0 20px ${props.$color.bg};
  `}

  ${(props) =>
    props.$clickable &&
    !props.$isActive &&
    `
    &:hover {
      background: ${props.$color.bg};
      border-left-color: ${props.$color.border}40;
    }
  `}
`;

const SectionHeader = styled.div<{
  $color: { bg: string; border: string; text: string };
  $isActive: boolean;
}>`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  margin-bottom: ${theme.space[2]};
  padding-bottom: ${theme.space[2]};
  border-bottom: 1px solid ${(props) =>
    props.$isActive ? props.$color.border + "40" : theme.colors.dark.border.default};
`;

const SectionName = styled.span`
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.dark.text.secondary};
  text-transform: uppercase;
  letter-spacing: ${theme.letterSpacing.wide};
`;

const SectionTime = styled.span`
  font-size: ${theme.fontSizes.bodyXs};
  font-family: ${theme.fonts.mono};
  color: ${theme.colors.dark.text.tertiary};
  background: ${theme.colors.dark.bg.tertiary};
  padding: 2px 6px;
  border-radius: ${theme.radius.sm};
`;

const PlayingIndicator = styled.span`
  margin-left: auto;
  color: ${theme.colors.brand.primary};
  font-size: ${theme.fontSizes.body};
  animation: pulse 1s ease-in-out infinite;

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
`;

const SectionContent = styled.div<{ $contentType: "chords" | "lyrics" }>`
  font-family: ${(props) =>
    props.$contentType === "chords" ? theme.fonts.mono : theme.fonts.sans};
  font-size: ${theme.fontSizes.bodyLg};
  color: ${theme.colors.dark.text.primary};
  line-height: ${theme.lineHeights.loose};
`;

const Line = styled.div<{ $isEmpty: boolean }>`
  min-height: 1.5em;
  color: ${(props) =>
    props.$isEmpty ? theme.colors.dark.text.tertiary : "inherit"};
`;

const UnsectionedBlock = styled.div`
  padding: ${theme.space[2]} ${theme.space[3]};
  opacity: 0.7;
  font-family: ${theme.fonts.mono};
  font-size: ${theme.fontSizes.bodyLg};
  color: ${theme.colors.dark.text.secondary};
  line-height: ${theme.lineHeights.loose};
`;
