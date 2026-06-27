import type { FC } from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Spinner } from "reactstrap";
import styled from "styled-components";
import { theme } from "../theme";
import type { Band, UpdateBandInput } from "../services/bandsService";
import { updateBand, deleteBand } from "../services/bandsService";
import { useBandContext } from "../context/useBandContext";
import { useNavigate } from "react-router-dom";
import { ConfirmModal } from "./ConfirmModal";

interface Props {
  band: Band;
  /** Called after a successful edit so the parent can refresh its band state. */
  onUpdated: (updates: UpdateBandInput) => void;
}

type Feedback = { type: "success" | "error"; message: string };

export const BandDetails: FC<Props> = ({ band, onUpdated }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { refreshBands, selectedBand, setSelectedBand } = useBandContext();

  const canEdit = band.user_role === "owner" || band.user_role === "admin";
  const canDelete = band.user_role === "owner";

  const [formData, setFormData] = useState<UpdateBandInput>({
    name: band.name,
    genre: band.genre || "",
    description: band.description || "",
  });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Keep the form in sync if the band prop changes (e.g. quiet refresh).
  useEffect(() => {
    setFormData({
      name: band.name,
      genre: band.genre || "",
      description: band.description || "",
    });
  }, [band.id, band.name, band.genre, band.description]);

  // Auto-dismiss success feedback; errors stay until the next action.
  useEffect(() => {
    if (feedback?.type === "success") {
      const timer = setTimeout(() => setFeedback(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const isDirty =
    (formData.name ?? "") !== band.name ||
    (formData.genre ?? "") !== (band.genre || "") ||
    (formData.description ?? "") !== (band.description || "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;

    const name = formData.name?.trim();
    if (!name) {
      setFeedback({ type: "error", message: t("bands.nameRequired") });
      return;
    }

    const updates: UpdateBandInput = {
      name,
      genre: formData.genre?.trim() || undefined,
      description: formData.description?.trim() || undefined,
    };

    setSaving(true);
    setFeedback(null);
    try {
      await updateBand(band.id, updates);
      // Keep global state in sync so the navbar/selector reflect the change.
      refreshBands();
      if (selectedBand?.id === band.id) {
        setSelectedBand({ ...selectedBand, ...updates });
      }
      onUpdated(updates);
      setFeedback({ type: "success", message: t("bands.bandUpdated") });
    } catch (error) {
      console.error("Failed to update band:", error);
      setFeedback({ type: "error", message: t("bands.updateError") });
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteBand(band.id);
      if (selectedBand?.id === band.id) {
        setSelectedBand(null);
      }
      refreshBands();
      navigate("/");
    } catch (error) {
      console.error("Failed to delete band:", error);
      setFeedback({ type: "error", message: t("bands.deleteError") });
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const createdLabel = band.created_at
    ? new Date(band.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

  const roleLabel = band.user_role ? t(`bands.${band.user_role}`) : "—";

  return (
    <Wrapper>
      {feedback && (
        <FeedbackBanner $type={feedback.type} role="status" aria-live="polite">
          <i
            className={`bi ${
              feedback.type === "success" ? "bi-check-circle-fill" : "bi-x-circle-fill"
            }`}
          ></i>
          <span>{feedback.message}</span>
        </FeedbackBanner>
      )}

      {/* General / identity */}
      <Card>
        <CardHeader>
          <CardTitle>
            <i className="bi bi-info-circle"></i>
            {t("bands.generalSection")}
          </CardTitle>
          {!canEdit && <ReadOnlyNote>{t("bands.editRestricted")}</ReadOnlyNote>}
        </CardHeader>

        <Form onSubmit={handleSubmit}>
          <FormGroup>
            <Label htmlFor="bandName">{t("bands.bandName")} *</Label>
            <Input
              id="bandName"
              type="text"
              value={formData.name ?? ""}
              placeholder={t("bands.placeholders.name")}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={!canEdit || saving}
              required
            />
          </FormGroup>

          <FormGroup>
            <Label htmlFor="bandGenre">{t("bands.genre")}</Label>
            <Input
              id="bandGenre"
              type="text"
              value={formData.genre ?? ""}
              placeholder={t("bands.placeholders.genre")}
              onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
              disabled={!canEdit || saving}
            />
          </FormGroup>

          <FormGroup>
            <Label htmlFor="bandDescription">{t("bands.description")}</Label>
            <TextArea
              id="bandDescription"
              rows={3}
              value={formData.description ?? ""}
              placeholder={t("bands.placeholders.description")}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              disabled={!canEdit || saving}
            />
            <HelperText>{t("bands.descriptionHint")}</HelperText>
          </FormGroup>

          {canEdit && (
            <Actions>
              <SaveButton type="submit" disabled={saving || !isDirty}>
                {saving ? (
                  <>
                    <Spinner size="sm" />
                    {t("common.saving")}
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-lg"></i>
                    {t("common.saveChanges")}
                  </>
                )}
              </SaveButton>
            </Actions>
          )}
        </Form>
      </Card>

      {/* About / read-only metadata */}
      <Card>
        <CardHeader>
          <CardTitle>
            <i className="bi bi-card-list"></i>
            {t("bands.aboutSection")}
          </CardTitle>
        </CardHeader>
        <InfoGrid>
          <InfoItem>
            <InfoLabel>{t("bands.createdOn")}</InfoLabel>
            <InfoValue>{createdLabel}</InfoValue>
          </InfoItem>
          <InfoItem>
            <InfoLabel>{t("bands.yourRole")}</InfoLabel>
            <InfoValue>{roleLabel}</InfoValue>
          </InfoItem>
        </InfoGrid>
      </Card>

      {/* Danger zone (owner only) */}
      {canDelete && (
        <DangerCard>
          <CardHeader>
            <CardTitle $danger>
              <i className="bi bi-exclamation-octagon"></i>
              {t("bands.dangerZone")}
            </CardTitle>
          </CardHeader>
          <DangerRow>
            <DangerInfo>
              <DangerTitle>{t("bands.deleteBand")}</DangerTitle>
              <DangerText>{t("bands.deleteBandWarning")}</DangerText>
            </DangerInfo>
            <DeleteButton type="button" onClick={() => setConfirmDelete(true)} disabled={deleting}>
              <i className="bi bi-trash"></i>
              {t("bands.deleteBand")}
            </DeleteButton>
          </DangerRow>
        </DangerCard>
      )}

      <ConfirmModal
        isOpen={confirmDelete}
        title={t("bands.deleteBand")}
        message={t("bands.confirmDeleteBand", { name: band.name })}
        confirmLabel={t("bands.deleteBand")}
        tone="danger"
        busy={deleting}
        onConfirm={handleDelete}
        onClose={() => setConfirmDelete(false)}
      />
    </Wrapper>
  );
};

// Styled Components

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[5]};
  max-width: 640px;
`;

const Card = styled.div`
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.lg};
  padding: ${theme.space[6]};
`;

const DangerCard = styled(Card)`
  border-color: rgba(239, 68, 68, 0.35);
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${theme.space[3]};
  margin-bottom: ${theme.space[5]};
  flex-wrap: wrap;
`;

const CardTitle = styled.h3<{ $danger?: boolean }>`
  font-size: ${theme.fontSizes.h4};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};

  i {
    color: ${(props) =>
      props.$danger ? theme.colors.semantic.error : theme.colors.brand.primary};
  }
`;

const ReadOnlyNote = styled.span`
  font-size: ${theme.fontSizes.bodyXs};
  color: var(--color-text-secondary);
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[5]};
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[2]};
`;

const Label = styled.label`
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
`;

const fieldStyles = `
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  padding: ${theme.space[3]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  transition: all ${theme.transitions.fast} ease;
  font-family: ${theme.fonts.sans};

  &:focus {
    outline: none;
    border-color: ${theme.colors.brand.primary};
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const Input = styled.input`
  ${fieldStyles}
`;

const TextArea = styled.textarea`
  ${fieldStyles}
  resize: vertical;
`;

const HelperText = styled.div`
  font-size: ${theme.fontSizes.bodyXs};
  color: var(--color-text-secondary);
`;

const FeedbackBanner = styled.div<{ $type: "success" | "error" }>`
  display: flex;
  align-items: flex-start;
  gap: ${theme.space[2]};
  padding: ${theme.space[3]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodySm};
  line-height: 1.4;
  border: 1px solid;

  ${({ $type }) =>
    $type === "success"
      ? `
        background: rgba(34, 197, 94, 0.1);
        border-color: rgba(34, 197, 94, 0.4);
        color: #4ade80;
      `
      : `
        background: rgba(239, 68, 68, 0.1);
        border-color: rgba(239, 68, 68, 0.4);
        color: #f87171;
      `}

  i {
    flex-shrink: 0;
    font-size: ${theme.fontSizes.bodyLg};
    margin-top: 1px;
  }
`;

const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
`;

const SaveButton = styled.button`
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

const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: ${theme.space[4]};
`;

const InfoItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[1]};
`;

const InfoLabel = styled.span`
  font-size: ${theme.fontSizes.bodyXs};
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const InfoValue = styled.span`
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-primary);
  font-weight: ${theme.fontWeights.medium};
`;

const DangerRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${theme.space[4]};
  flex-wrap: wrap;
`;

const DangerInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[1]};
  flex: 1;
  min-width: 220px;
`;

const DangerTitle = styled.div`
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
`;

const DangerText = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
  line-height: ${theme.lineHeights.relaxed};
`;

const DeleteButton = styled.button`
  background: transparent;
  border: 1px solid ${theme.colors.semantic.error};
  color: ${theme.colors.semantic.error};
  padding: ${theme.space[3]} ${theme.space[5]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  white-space: nowrap;

  &:hover:not(:disabled) {
    background: ${theme.colors.semantic.error};
    color: white;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;
