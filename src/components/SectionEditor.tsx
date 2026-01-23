import { useState, useMemo } from "react";
import styled from "styled-components";
import { theme } from "../theme";
import type { SectionTiming } from "../services/songsService";
import { useTranslation } from "react-i18next";

interface Props {
  chordsText?: string;
  lyricsText?: string;
  chordSections: SectionTiming[];
  lyricsSections: SectionTiming[];
  onChordSectionsChange: (sections: SectionTiming[]) => void;
  onLyricsSectionsChange: (sections: SectionTiming[]) => void;
  disabled?: boolean;
}

const SECTION_COLORS = [
  { bg: "rgba(139, 92, 246, 0.15)", border: "rgba(139, 92, 246, 0.5)", text: "#a78bfa" }, // Purple
  { bg: "rgba(59, 130, 246, 0.15)", border: "rgba(59, 130, 246, 0.5)", text: "#60a5fa" }, // Blue
  { bg: "rgba(34, 197, 94, 0.15)", border: "rgba(34, 197, 94, 0.5)", text: "#4ade80" }, // Green
  { bg: "rgba(249, 115, 22, 0.15)", border: "rgba(249, 115, 22, 0.5)", text: "#fb923c" }, // Orange
  { bg: "rgba(236, 72, 153, 0.15)", border: "rgba(236, 72, 153, 0.5)", text: "#f472b6" }, // Pink
  { bg: "rgba(14, 165, 233, 0.15)", border: "rgba(14, 165, 233, 0.5)", text: "#38bdf8" }, // Cyan
  { bg: "rgba(168, 85, 247, 0.15)", border: "rgba(168, 85, 247, 0.5)", text: "#c084fc" }, // Violet
  { bg: "rgba(234, 179, 8, 0.15)", border: "rgba(234, 179, 8, 0.5)", text: "#facc15" }, // Yellow
];

const DEFAULT_SECTION_NAMES = [
  "Intro",
  "Verse 1",
  "Verse 2",
  "Verse 3",
  "Pre-Chorus",
  "Chorus",
  "Bridge",
  "Solo",
  "Outro",
  "Interlude",
];

type ContentType = "chords" | "lyrics";

export const SectionEditor = ({
  chordsText,
  lyricsText,
  chordSections,
  lyricsSections,
  onChordSectionsChange,
  onLyricsSectionsChange,
  disabled,
}: Props) => {
  const { t } = useTranslation();
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
  const [newSectionName, setNewSectionName] = useState("");
  const [editingSection, setEditingSection] = useState<number | null>(null);

  const hasChords = Boolean(chordsText?.trim());
  const hasLyrics = Boolean(lyricsText?.trim());
  const hasBoth = hasChords && hasLyrics;

  // Default to chords if available, otherwise lyrics
  const [activeTab, setActiveTab] = useState<ContentType>(hasChords ? "chords" : "lyrics");

  // Get current text and sections based on active tab
  const text = activeTab === "chords" ? (chordsText || "") : (lyricsText || "");
  const sections = activeTab === "chords" ? chordSections : lyricsSections;
  const onSectionsChange = activeTab === "chords" ? onChordSectionsChange : onLyricsSectionsChange;

  const lines = useMemo(() => text.split("\n"), [text]);

  // Reset selection when switching tabs
  const handleTabChange = (tab: ContentType) => {
    setActiveTab(tab);
    setSelectionStart(null);
    setSelectionEnd(null);
    setNewSectionName("");
    setEditingSection(null);
  };

  const getSectionForLine = (lineIndex: number): { section: SectionTiming; colorIndex: number } | null => {
    const sectionIndex = sections.findIndex(
      (s) => lineIndex >= s.lineStart && lineIndex <= s.lineEnd
    );
    if (sectionIndex === -1) return null;
    return { section: sections[sectionIndex], colorIndex: sectionIndex % SECTION_COLORS.length };
  };

  const isLineSelected = (lineIndex: number): boolean => {
    if (selectionStart === null) return false;
    const end = selectionEnd ?? selectionStart;
    const min = Math.min(selectionStart, end);
    const max = Math.max(selectionStart, end);
    return lineIndex >= min && lineIndex <= max;
  };

  const handleLineClick = (lineIndex: number) => {
    if (disabled) return;

    // Check if clicking on an existing section
    const existingSection = getSectionForLine(lineIndex);
    if (existingSection && selectionStart === null) {
      const sectionIndex = sections.findIndex(
        (s) => s.lineStart === existingSection.section.lineStart
      );
      setEditingSection(sectionIndex);
      return;
    }

    if (selectionStart === null) {
      setSelectionStart(lineIndex);
      setSelectionEnd(lineIndex);
    } else if (selectionEnd === lineIndex && selectionStart === lineIndex) {
      // Clicking same line twice - deselect
      setSelectionStart(null);
      setSelectionEnd(null);
    } else {
      setSelectionEnd(lineIndex);
    }
  };

  const handleAddSection = () => {
    if (selectionStart === null || !newSectionName.trim()) return;

    const end = selectionEnd ?? selectionStart;
    const lineStart = Math.min(selectionStart, end);
    const lineEnd = Math.max(selectionStart, end);

    // Check for overlapping sections
    const hasOverlap = sections.some(
      (s) =>
        (lineStart >= s.lineStart && lineStart <= s.lineEnd) ||
        (lineEnd >= s.lineStart && lineEnd <= s.lineEnd) ||
        (lineStart <= s.lineStart && lineEnd >= s.lineEnd)
    );

    if (hasOverlap) {
      alert(t("sectionEditor.overlapError"));
      return;
    }

    const newSection: SectionTiming = {
      name: newSectionName.trim(),
      lineStart,
      lineEnd,
      startTime: 0, // Will be set in Part 3 (timing sync)
    };

    // Add and sort by lineStart
    const updatedSections = [...sections, newSection].sort((a, b) => a.lineStart - b.lineStart);
    onSectionsChange(updatedSections);

    // Reset selection
    setSelectionStart(null);
    setSelectionEnd(null);
    setNewSectionName("");
  };

  const handleDeleteSection = (index: number) => {
    const updatedSections = sections.filter((_, i) => i !== index);
    onSectionsChange(updatedSections);
    setEditingSection(null);
  };

  const handleUpdateSectionName = (index: number, name: string) => {
    const updatedSections = sections.map((s, i) =>
      i === index ? { ...s, name } : s
    );
    onSectionsChange(updatedSections);
  };

  const handleClearSelection = () => {
    setSelectionStart(null);
    setSelectionEnd(null);
    setNewSectionName("");
  };

  const hasSelection = selectionStart !== null;

  return (
    <Container>
      <Header>
        <HeaderTitle>
          <i className="bi bi-list-ol"></i>
          {t("sectionEditor.title")}
        </HeaderTitle>
        <HeaderHint>{t("sectionEditor.hint")}</HeaderHint>
      </Header>

      {/* Tabs - shown when song has both chords and lyrics */}
      {hasBoth && (
        <TabsContainer>
          <Tab
            $active={activeTab === "chords"}
            onClick={() => handleTabChange("chords")}
            disabled={disabled}
            type="button"
          >
            <i className="bi bi-music-note"></i>
            {t("sectionEditor.chords")}
            {chordSections.length > 0 && (
              <TabBadge>{chordSections.length}</TabBadge>
            )}
          </Tab>
          <Tab
            $active={activeTab === "lyrics"}
            onClick={() => handleTabChange("lyrics")}
            disabled={disabled}
            type="button"
          >
            <i className="bi bi-file-text"></i>
            {t("sectionEditor.lyrics")}
            {lyricsSections.length > 0 && (
              <TabBadge>{lyricsSections.length}</TabBadge>
            )}
          </Tab>
        </TabsContainer>
      )}

      {/* Section List */}
      {sections.length > 0 && (
        <SectionList>
          {sections.map((section, index) => {
            const color = SECTION_COLORS[index % SECTION_COLORS.length];
            const isEditing = editingSection === index;
            return (
              <SectionItem key={index} $color={color} $isEditing={isEditing}>
                <SectionColorIndicator $color={color} />
                {isEditing ? (
                  <SectionEditInput
                    value={section.name}
                    onChange={(e) => handleUpdateSectionName(index, e.target.value)}
                    onBlur={() => setEditingSection(null)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") setEditingSection(null);
                      if (e.key === "Escape") setEditingSection(null);
                    }}
                    autoFocus
                  />
                ) : (
                  <SectionName onClick={() => !disabled && setEditingSection(index)}>
                    {section.name}
                  </SectionName>
                )}
                <SectionLines>
                  {t("sectionEditor.lines")} {section.lineStart + 1}-{section.lineEnd + 1}
                </SectionLines>
                {!disabled && (
                  <SectionDeleteButton
                    onClick={() => handleDeleteSection(index)}
                    title={t("common.delete")}
                  >
                    <i className="bi bi-x"></i>
                  </SectionDeleteButton>
                )}
              </SectionItem>
            );
          })}
        </SectionList>
      )}

      {/* Add Section Form */}
      {hasSelection && (
        <AddSectionForm>
          <SelectionInfo>
            <i className="bi bi-check2-square"></i>
            {t("sectionEditor.selectedLines", {
              start: Math.min(selectionStart!, selectionEnd ?? selectionStart!) + 1,
              end: Math.max(selectionStart!, selectionEnd ?? selectionStart!) + 1,
            })}
          </SelectionInfo>
          <FormRow>
            <SectionNameInput
              type="text"
              placeholder={t("sectionEditor.sectionNamePlaceholder")}
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              list="section-names"
              disabled={disabled}
            />
            <datalist id="section-names">
              {DEFAULT_SECTION_NAMES.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <AddButton
              onClick={handleAddSection}
              disabled={!newSectionName.trim() || disabled}
            >
              <i className="bi bi-plus"></i>
              {t("sectionEditor.addSection")}
            </AddButton>
            <ClearButton onClick={handleClearSelection} disabled={disabled}>
              <i className="bi bi-x-lg"></i>
            </ClearButton>
          </FormRow>
        </AddSectionForm>
      )}

      {/* Lines Display */}
      <LinesContainer>
        {lines.map((line, index) => {
          const sectionInfo = getSectionForLine(index);
          const isSelected = isLineSelected(index);
          const isEmpty = line.trim() === "";

          return (
            <LineRow
              key={index}
              onClick={() => handleLineClick(index)}
              $isSelected={isSelected}
              $sectionColor={sectionInfo ? SECTION_COLORS[sectionInfo.colorIndex] : null}
              $disabled={disabled}
              $isEmpty={isEmpty}
            >
              <LineNumber>{index + 1}</LineNumber>
              <LineContent $isEmpty={isEmpty}>
                {isEmpty ? <EmptyLineIndicator>―</EmptyLineIndicator> : line}
              </LineContent>
              {sectionInfo && (
                <LineSectionBadge $color={SECTION_COLORS[sectionInfo.colorIndex]}>
                  {sectionInfo.section.name}
                </LineSectionBadge>
              )}
            </LineRow>
          );
        })}
      </LinesContainer>

      {!text && (
        <EmptyState>
          <i className="bi bi-file-text"></i>
          <span>{t("sectionEditor.noContent")}</span>
        </EmptyState>
      )}
    </Container>
  );
};

// Styled Components

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[3]};
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.base};
  padding: ${theme.space[4]};
`;

const Header = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[1]};
`;

const HeaderTitle = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.brand.primary};
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  text-transform: uppercase;
  letter-spacing: ${theme.letterSpacing.wide};

  i {
    font-size: ${theme.fontSizes.body};
  }
`;

const HeaderHint = styled.div`
  font-size: ${theme.fontSizes.bodyXs};
  color: var(--color-text-tertiary);
`;

const TabsContainer = styled.div`
  display: flex;
  gap: ${theme.space[2]};
  background: var(--color-bg-secondary);
  padding: ${theme.space[1]};
  border-radius: ${theme.radius.base};
  border: 1px solid var(--color-border);
`;

const Tab = styled.button<{ $active: boolean }>`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${theme.space[2]};
  padding: ${theme.space[2]} ${theme.space[3]};
  border: none;
  border-radius: ${theme.radius.sm};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  background: ${(props) =>
    props.$active ? theme.colors.brand.primary : 'transparent'};
  color: ${(props) =>
    props.$active ? 'white' : 'var(--color-text-secondary)'};

  i {
    font-size: ${theme.fontSizes.body};
  }

  &:hover:not(:disabled) {
    background: ${(props) =>
      props.$active ? theme.colors.brand.primaryHover : 'var(--color-bg-tertiary)'};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const TabBadge = styled.span`
  background: rgba(255, 255, 255, 0.2);
  padding: 0 ${theme.space[2]};
  border-radius: ${theme.radius.full};
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.semibold};
`;

const SectionList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${theme.space[2]};
`;

const SectionItem = styled.div<{
  $color: { bg: string; border: string; text: string };
  $isEditing: boolean;
}>`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  background: ${(props) => props.$color.bg};
  border: 1px solid ${(props) => props.$color.border};
  border-radius: ${theme.radius.sm};
  padding: ${theme.space[1]} ${theme.space[2]};
  font-size: ${theme.fontSizes.bodySm};

  ${(props) =>
    props.$isEditing &&
    `
    box-shadow: 0 0 0 2px ${props.$color.border};
  `}
`;

const SectionColorIndicator = styled.div<{
  $color: { bg: string; border: string; text: string };
}>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${(props) => props.$color.text};
`;

const SectionName = styled.span`
  color: var(--color-text-primary);
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
`;

const SectionEditInput = styled.input`
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-strong);
  border-radius: ${theme.radius.sm};
  color: var(--color-text-primary);
  padding: ${theme.space[1]} ${theme.space[2]};
  font-size: ${theme.fontSizes.bodySm};
  width: 100px;

  &:focus {
    outline: none;
    border-color: ${theme.colors.brand.primary};
  }
`;

const SectionLines = styled.span`
  color: var(--color-text-tertiary);
  font-size: ${theme.fontSizes.bodyXs};
`;

const SectionDeleteButton = styled.button`
  background: transparent;
  border: none;
  color: var(--color-text-tertiary);
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: ${theme.radius.sm};
  transition: all ${theme.transitions.fast} ease;

  &:hover {
    color: ${theme.colors.semantic.error};
    background: ${theme.colors.semantic.errorBgDark};
  }
`;

const AddSectionForm = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[2]};
  background: var(--color-bg-secondary);
  border: 1px solid ${theme.colors.brand.primary};
  border-radius: ${theme.radius.base};
  padding: ${theme.space[3]};
`;

const SelectionInfo = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.brand.primary};
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
`;

const FormRow = styled.div`
  display: flex;
  gap: ${theme.space[2]};
`;

const SectionNameInput = styled.input`
  flex: 1;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  padding: ${theme.space[2]} ${theme.space[3]};
  border-radius: ${theme.radius.sm};
  font-size: ${theme.fontSizes.bodySm};

  &::placeholder {
    color: var(--color-text-tertiary);
  }

  &:focus {
    outline: none;
    border-color: ${theme.colors.brand.primary};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const AddButton = styled.button`
  background: ${theme.colors.brand.primary};
  border: none;
  color: white;
  padding: ${theme.space[2]} ${theme.space[3]};
  border-radius: ${theme.radius.sm};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: ${theme.space[1]};
  transition: all ${theme.transitions.fast} ease;

  &:hover:not(:disabled) {
    background: ${theme.colors.brand.primaryHover};
  }

  &:disabled {
    background: var(--color-bg-elevated);
    color: var(--color-text-disabled);
    cursor: not-allowed;
  }
`;

const ClearButton = styled.button`
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  padding: ${theme.space[2]};
  border-radius: ${theme.radius.sm};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all ${theme.transitions.fast} ease;

  &:hover:not(:disabled) {
    border-color: ${theme.colors.semantic.error};
    color: ${theme.colors.semantic.error};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const LinesContainer = styled.div`
  display: flex;
  flex-direction: column;
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.sm};

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

const LineRow = styled.div<{
  $isSelected: boolean;
  $sectionColor: { bg: string; border: string; text: string } | null;
  $disabled?: boolean;
  $isEmpty: boolean;
}>`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  padding: ${theme.space[1]} ${theme.space[2]};
  cursor: ${(props) => (props.$disabled ? "default" : "pointer")};
  transition: background ${theme.transitions.fast} ease;
  border-left: 3px solid transparent;

  ${(props) =>
    props.$sectionColor &&
    `
    background: ${props.$sectionColor.bg};
    border-left-color: ${props.$sectionColor.border};
  `}

  ${(props) =>
    props.$isSelected &&
    `
    background: rgba(139, 92, 246, 0.25) !important;
    border-left-color: ${theme.colors.brand.primary} !important;
  `}

  ${(props) =>
    !props.$disabled &&
    !props.$sectionColor &&
    !props.$isSelected &&
    `
    &:hover {
      background: var(--color-bg-tertiary);
    }
  `}
`;

const LineNumber = styled.span`
  min-width: 28px;
  font-size: ${theme.fontSizes.bodyXs};
  color: var(--color-text-tertiary);
  text-align: right;
  font-family: ${theme.fonts.mono};
  user-select: none;
`;

const LineContent = styled.span<{ $isEmpty: boolean }>`
  flex: 1;
  font-family: ${theme.fonts.mono};
  font-size: ${theme.fontSizes.bodySm};
  color: ${(props) =>
    props.$isEmpty ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)'};
  white-space: pre;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const EmptyLineIndicator = styled.span`
  opacity: 0.3;
`;

const LineSectionBadge = styled.span<{
  $color: { bg: string; border: string; text: string };
}>`
  font-size: ${theme.fontSizes.bodyXs};
  color: ${(props) => props.$color.text};
  background: ${(props) => props.$color.bg};
  border: 1px solid ${(props) => props.$color.border};
  padding: 0 ${theme.space[1]};
  border-radius: ${theme.radius.sm};
  white-space: nowrap;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${theme.space[6]};
  color: var(--color-text-tertiary);
  gap: ${theme.space[2]};

  i {
    font-size: ${theme.fontSizes.h2};
  }
`;
