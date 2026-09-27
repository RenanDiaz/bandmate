import type { FC } from "react";
import { useId, useMemo, useState } from "react";
import { Button, Collapse, FormGroup, Input, Label, Modal, ModalBody, ModalFooter, ModalHeader } from "reactstrap";
import styled from "styled-components";
import { useTranslation } from "react-i18next";
import { theme } from "../theme";
import { useSetlistTextExport, type SetlistTextFlag } from "../hooks/useSetlistTextExport";
import { setlistTextDurations, type SetlistTextInput, type SetlistTextLayout } from "../utils/setlistText";

interface SetlistTextExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  input: SetlistTextInput;
}

const LAYOUTS: readonly SetlistTextLayout[] = ["stage", "technical", "message"];

/** Text export of a setlist: layout, live preview, Customize, Copy / Download / Share (spec §4). */
export const SetlistTextExportModal: FC<SetlistTextExportModalProps> = ({ isOpen, onClose, input }) => {
  const { t } = useTranslation();
  return (
    <Modal isOpen={isOpen} toggle={onClose} size="lg">
      <ModalHeader toggle={onClose}>{t("setlists.export.title")}</ModalHeader>
      {/* Mounted only while open, so reopening reads the stored options again. */}
      {isOpen && <ExportContent input={input} onClose={onClose} />}
    </Modal>
  );
};

const ExportContent: FC<{ input: SetlistTextInput; onClose: () => void }> = ({ input, onClose }) => {
  const { t } = useTranslation();
  const idPrefix = useId();
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const { options, setLayout, toggle, resetToDefaults, text, copy, copied, canShare, share, download } =
    useSetlistTextExport(input);

  const hasDurations = useMemo(
    () => setlistTextDurations(input.items, input.songsById).musicSeconds > 0,
    [input.items, input.songsById],
  );

  const checkbox = (flag: SetlistTextFlag, label: string, note?: string, disabled = false) => (
    <FormGroup check key={flag}>
      <Input
        type="checkbox"
        id={`${idPrefix}-${flag}`}
        checked={options[flag]}
        onChange={() => toggle(flag)}
        disabled={disabled}
      />
      <Label check for={`${idPrefix}-${flag}`}>
        {label}
        {note && <DisabledNote>{note}</DisabledNote>}
      </Label>
    </FormGroup>
  );
  const noDurations = hasDurations ? undefined : t("setlists.export.noDurations");

  return (
    <>
      <ModalBody>
        <LayoutPicker role="radiogroup" aria-label={t("setlists.export.layoutLabel")}>
          {LAYOUTS.map((layout) => (
            <LayoutOption
              key={layout}
              type="button"
              role="radio"
              aria-checked={options.layout === layout}
              $active={options.layout === layout}
              onClick={() => setLayout(layout)}
            >
              <LayoutName>{t(`setlists.export.layouts.${layout}.label`)}</LayoutName>
              <LayoutHint>{t(`setlists.export.layouts.${layout}.hint`)}</LayoutHint>
            </LayoutOption>
          ))}
        </LayoutPicker>

        <Preview aria-label={t("setlists.export.preview")} tabIndex={0}>
          {text}
        </Preview>

        <CustomizeToggle
          type="button"
          aria-expanded={customizeOpen}
          onClick={() => setCustomizeOpen((open) => !open)}
        >
          <i className={`bi ${customizeOpen ? "bi-chevron-down" : "bi-chevron-right"}`}></i>
          {t("setlists.export.customize")}
        </CustomizeToggle>
        <Collapse isOpen={customizeOpen}>
          <ExportOptionsContainer>
            <OptionSection>
              <SectionTitle>{t("setlists.export.setlistInfo")}</SectionTitle>
              {checkbox(
                "description",
                t("setlists.export.includeDescription"),
                input.description?.trim() ? undefined : t("setlists.export.noDescription"),
                !input.description?.trim(),
              )}
              {input.show && checkbox("show", t("setlists.export.includeShow"))}
              {checkbox("songCount", t("setlists.export.includeSongCount"))}
              {checkbox("totalDuration", t("setlists.export.includeTotalDuration"), noDurations, !hasDurations)}
            </OptionSection>
            <OptionSection>
              <SectionTitle>{t("setlists.export.songDetails")}</SectionTitle>
              {checkbox("artist", t("setlists.export.includeArtist"))}
              {checkbox("key", t("setlists.export.includeKey"))}
              {checkbox("tempo", t("setlists.export.includeTempo"))}
              {checkbox("duration", t("setlists.export.includeDuration"), noDurations, !hasDurations)}
              {options.layout === "technical" &&
                checkbox("startTime", t("setlists.export.includeStartTime"), noDurations, !hasDurations)}
              {checkbox("notes", t("setlists.export.includeNotes"))}
              {checkbox("specialItems", t("setlists.export.includeSpecialItems"))}
            </OptionSection>
          </ExportOptionsContainer>
          <ResetLink type="button" onClick={resetToDefaults}>
            {t("setlists.export.resetDefaults")}
          </ResetLink>
        </Collapse>
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        {canShare && (
          <Button color="secondary" outline onClick={share}>
            <i className="bi bi-share"></i> {t("setlists.export.share")}
          </Button>
        )}
        <Button
          color="secondary"
          outline
          onClick={() => {
            download();
            onClose();
          }}
        >
          <i className="bi bi-download"></i> {t("setlists.export.download")}
        </Button>
        <Button color="primary" onClick={copy}>
          <i className={`bi ${copied ? "bi-check-lg" : "bi-clipboard"}`}></i>{" "}
          {copied ? t("setlists.export.copied") : t("setlists.export.copy")}
        </Button>
      </ModalFooter>
    </>
  );
};

const LayoutPicker = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${theme.space[2]};
  margin-bottom: ${theme.space[4]};

  @media (max-width: ${theme.breakpoints.md}) {
    grid-template-columns: 1fr;
  }
`;

const LayoutOption = styled.button<{ $active: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${theme.space[1]};
  padding: ${theme.space[3]};
  text-align: left;
  background: ${({ $active }) => ($active ? "rgba(139, 92, 246, 0.15)" : "var(--color-bg-tertiary)")};
  border: 1px solid ${({ $active }) => ($active ? theme.colors.brand.primary : "var(--color-border)")};
  border-radius: ${theme.radius.base};
  color: var(--color-text-primary);
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;

  &:hover {
    border-color: ${theme.colors.brand.primaryLight};
  }

  &:focus-visible {
    outline: 2px solid ${theme.colors.brand.primary};
    outline-offset: 2px;
  }
`;

const LayoutName = styled.span`
  font-weight: ${theme.fontWeights.semibold};
`;

const LayoutHint = styled.span`
  font-size: ${theme.fontSizes.bodyXs};
  color: var(--color-text-secondary);
`;

const Preview = styled.pre`
  margin: 0 0 ${theme.space[4]} 0;
  padding: ${theme.space[3]};
  max-height: 50vh;
  overflow: auto;
  white-space: pre;
  font-family: ${theme.fonts.mono};
  font-size: ${theme.fontSizes.bodySm};
  line-height: 1.5;
  color: var(--color-text-primary);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.base};
`;

const CustomizeToggle = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[2]};
  padding: 0;
  margin-bottom: ${theme.space[3]};
  background: none;
  border: none;
  color: var(--color-text-secondary);
  font-weight: ${theme.fontWeights.semibold};
  cursor: pointer;

  &:hover {
    color: var(--color-text-primary);
  }
`;

const ExportOptionsContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${theme.space[6]};

  @media (max-width: ${theme.breakpoints.md}) {
    grid-template-columns: 1fr;
  }
`;

const OptionSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[3]};
`;

const SectionTitle = styled.h3`
  font-size: ${theme.fontSizes.bodyLg};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin: 0 0 ${theme.space[2]} 0;
  padding-bottom: ${theme.space[2]};
  border-bottom: 1px solid var(--color-border);
`;

const DisabledNote = styled.span`
  font-size: ${theme.fontSizes.bodyXs};
  color: var(--color-text-tertiary);
  font-style: italic;
  margin-left: ${theme.space[2]};
`;

const ResetLink = styled.button`
  margin-top: ${theme.space[4]};
  padding: 0;
  background: none;
  border: none;
  color: ${theme.colors.brand.primaryLight};
  font-size: ${theme.fontSizes.bodySm};
  text-decoration: underline;
  cursor: pointer;
`;
