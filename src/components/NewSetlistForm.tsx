import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  createSetlist,
  duplicateSetlist,
  isSongItem,
  type CreateSetlistInput,
  type Setlist,
} from "../services/setlistsService";
import { isPermissionDenied } from "../services/permissionError";
import { SETLIST_TEMPLATES, templateItems, type SetlistTemplateId } from "../utils/setlistTemplates";
import styled from "styled-components";
import { theme } from "../theme";
import { useToast } from "../context/useToast";

interface Props {
  bandId: number;
  /** The band's setlists, for "Copy of…" (setlist builder spec §4.3). */
  setlists?: Setlist[];
  onSetlistCreated: () => void;
}

type StartFrom = "blank" | "template" | "copy";
const START_FROM: readonly StartFrom[] = ["blank", "template", "copy"];

export const NewSetlistForm = ({ bandId, setlists = [], onSetlistCreated }: Props) => {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Start from (spec §4.2–4.3): blank, a structure template or a copy.
  const [startFrom, setStartFrom] = useState<StartFrom>("blank");
  const [templateId, setTemplateId] = useState<SetlistTemplateId>("two-sets-break");
  const [sourceId, setSourceId] = useState("");
  const copySources = setlists.filter((setlist) => !setlist.is_draft);

  const reset = () => {
    setFormData({ name: "", description: "" });
    setStartFrom("blank");
    setSourceId("");
    setIsExpanded(false);
  };

  // Choosing a source pre-fills "{name} (copy)" and its description.
  const chooseSource = (id: string) => {
    setSourceId(id);
    const source = copySources.find((setlist) => setlist.id === id);
    if (!source) return;
    setFormData({
      name: t("setlists.copyName", { name: source.name }),
      description: source.description ?? "",
    });
  };

  const canSubmit =
    formData.name.trim() !== "" && !isSubmitting && (startFrom !== "copy" || sourceId !== "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      const name = formData.name.trim();
      const description = formData.description.trim() || undefined;
      let created: Setlist;
      if (startFrom === "copy") {
        created = await duplicateSetlist(sourceId, name, { description });
      } else {
        const setlistInput: CreateSetlistInput = {
          name,
          band_id: bandId,
          description,
          songs: startFrom === "template" ? templateItems(templateId, t) : [],
        };
        created = await createSetlist(setlistInput);
      }

      reset();
      onSetlistCreated();
      // Building is the next step, so open the editor (spec §4.4).
      navigate(`/setlists/${created.id}/edit`);
    } catch (error) {
      console.error("Failed to create setlist:", error);
      toast.error(isPermissionDenied(error) ? t('common.noPermission') : t('setlists.createError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isExpanded) {
    return (
      <ExpandButton onClick={() => setIsExpanded(true)}>
        <i className="bi bi-plus-circle"></i>
        {t('setlists.createNewSetlist')}
      </ExpandButton>
    );
  }

  return (
    <FormCard>
      <FormHeader>
        <FormTitle>
          <i className="bi bi-plus-circle"></i>
          {t('setlists.createNewSetlist')}
        </FormTitle>
        <CloseButton
          onClick={reset}
          type="button"
          aria-label={t('common.closeForm')}
        >
          <i className="bi bi-x"></i>
        </CloseButton>
      </FormHeader>

      <Form onSubmit={handleSubmit}>
        <FormGroup role="radiogroup" aria-labelledby="setlistStartFromLabel">
          <Label as="span" id="setlistStartFromLabel">
            <i className="bi bi-layout-text-sidebar"></i>
            {t('setlists.templates.startFrom')}
          </Label>
          <Segmented>
            {START_FROM.map((option) => (
              <SegmentButton
                key={option}
                type="button"
                role="radio"
                aria-checked={startFrom === option}
                $active={startFrom === option}
                onClick={() => setStartFrom(option)}
                disabled={isSubmitting || (option === "copy" && copySources.length === 0)}
                title={option === "copy" && copySources.length === 0 ? t('setlists.templates.noSetlistsToCopy') : undefined}
              >
                {t(`setlists.templates.${option === "copy" ? "copyOf" : option}`)}
              </SegmentButton>
            ))}
          </Segmented>
          {startFrom === "template" && (
            <Select
              aria-label={t('setlists.templates.chooseTemplate')}
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value as SetlistTemplateId)}
              disabled={isSubmitting}
            >
              {SETLIST_TEMPLATES.map((id) => (
                <option key={id} value={id}>
                  {t(`setlists.templates.names.${id}`)}
                </option>
              ))}
            </Select>
          )}
          {startFrom === "copy" && (
            <Select
              aria-label={t('setlists.templates.chooseSetlist')}
              value={sourceId}
              onChange={(e) => chooseSource(e.target.value)}
              disabled={isSubmitting}
            >
              <option value="" disabled>
                {t('setlists.templates.chooseSetlist')}
              </option>
              {copySources.map((setlist) => (
                <option key={setlist.id} value={setlist.id}>
                  {setlist.name} · {t('setlists.songCount', { count: setlist.songs.filter(isSongItem).length })}
                </option>
              ))}
            </Select>
          )}
        </FormGroup>

        <FormGroup>
          <Label htmlFor="setlistName">
            {t('setlists.setlistName')} <Required>*</Required>
          </Label>
          <Input
            id="setlistName"
            placeholder={t('setlists.placeholders.name')}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            autoFocus
            disabled={isSubmitting}
          />
        </FormGroup>

        <FormGroup>
          <Label htmlFor="setlistDescription">
            <i className="bi bi-card-text"></i>
            {t('setlists.descriptionNotes')}
          </Label>
          <TextArea
            id="setlistDescription"
            rows={3}
            placeholder={t('setlists.placeholders.description')}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            disabled={isSubmitting}
          />
        </FormGroup>

        <FormActions>
          <CancelButton type="button" onClick={reset} disabled={isSubmitting}>
            {t('common.cancel')}
          </CancelButton>
          <SubmitButton type="submit" disabled={!canSubmit}>
            {isSubmitting ? (
              <>
                <Spinner />
                {t('common.creating')}
              </>
            ) : (
              <>
                <i className="bi bi-check-circle"></i>
                {t('setlists.addSetlist')}
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
  background: var(--color-bg-secondary);
  border: 2px dashed var(--color-border);
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

  i {
    font-size: ${theme.fontSizes.h3};
  }

  &:hover {
    background: var(--color-bg-tertiary);
    border-color: ${theme.colors.brand.primary};
    border-style: solid;
    transform: translateY(-2px);
  }

  &:active {
    transform: translateY(0);
  }
`;

const FormCard = styled.div`
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.lg};
  padding: ${theme.space[6]};
  margin-bottom: ${theme.space[6]};
  box-shadow: var(--shadow-md);
`;

const FormHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${theme.space[5]};
  padding-bottom: ${theme.space[4]};
  border-bottom: 1px solid var(--color-border);
`;

const FormTitle = styled.h3`
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
    background: var(--color-bg-elevated);
    color: var(--color-text-primary);
  }
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[4]};
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

const Segmented = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${theme.space[1]};
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.base};
  padding: ${theme.space[1]};
`;

const SegmentButton = styled.button<{ $active: boolean }>`
  flex: 1 1 auto;
  min-height: 36px;
  border: none;
  border-radius: ${theme.radius.sm};
  padding: ${theme.space[1]} ${theme.space[3]};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;
  background: ${(p) => (p.$active ? theme.colors.brand.primary : "transparent")};
  color: ${(p) => (p.$active ? "white" : "var(--color-text-secondary)")};
  transition: all ${theme.transitions.fast} ease;

  &:hover:not(:disabled) {
    color: ${(p) => (p.$active ? "white" : "var(--color-text-primary)")};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const Select = styled.select`
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  padding: ${theme.space[2]} ${theme.space[3]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  font-family: ${theme.fonts.sans};

  &:focus {
    outline: none;
    border-color: ${theme.colors.brand.primary};
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
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

const TextArea = styled.textarea`
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  padding: ${theme.space[3]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  transition: all ${theme.transitions.fast} ease;
  font-family: ${theme.fonts.sans};
  resize: vertical;
  min-height: 80px;
  line-height: ${theme.lineHeights.relaxed};

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
