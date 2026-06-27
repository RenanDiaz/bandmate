import type { FC } from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Spinner } from "reactstrap";
import styled from "styled-components";
import { theme } from "../theme";
import type { Band, UpdateBandInput } from "../services/bandsService";
import { updateBand, deleteBand } from "../services/bandsService";
import { uploadBandAvatar, deleteBandAvatar } from "../services/bandAvatarStorageService";
import { useBandContext } from "../context/useBandContext";
import { useNavigate } from "react-router-dom";
import { ConfirmModal } from "./ConfirmModal";
import { BandAvatar } from "./BandAvatar";
import { TransferOwnershipModal } from "./TransferOwnershipModal";

interface Props {
  band: Band;
  /** Called after a successful field edit so the parent can merge band state. */
  onUpdated: (updates: Partial<Pick<Band, "name" | "genre" | "description">>) => void;
  /** Called after changes that need a full re-fetch (avatar, ownership). */
  onRefresh: () => void;
}

type Feedback = { type: "success" | "error"; message: string };

export const BandDetails: FC<Props> = ({ band, onUpdated, onRefresh }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { refreshBands, selectedBand, setSelectedBand } = useBandContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canEdit = band.user_role === "owner" || band.user_role === "admin";
  const isOwner = band.user_role === "owner";

  const [formData, setFormData] = useState<UpdateBandInput>({
    name: band.name,
    genre: band.genre || "",
    description: band.description || "",
  });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  // Keep the global band list / selected band in sync after a change.
  const syncSelected = (patch: Partial<Band>) => {
    refreshBands();
    if (selectedBand?.id === band.id) {
      setSelectedBand({ ...selectedBand, ...patch });
    }
  };

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
      syncSelected(updates);
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

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input so selecting the same file again still fires onChange.
    e.target.value = "";
    if (!file || !canEdit) return;

    setAvatarBusy(true);
    setFeedback(null);
    try {
      const url = await uploadBandAvatar(file, band.id);
      await updateBand(band.id, { avatar_url: url });
      syncSelected({ avatar_url: url });
      onRefresh();
      setFeedback({ type: "success", message: t("bands.avatarUpdated") });
    } catch (error) {
      console.error("Failed to update avatar:", error);
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : t("bands.avatarError"),
      });
    }
    setAvatarBusy(false);
  };

  const handleRemoveAvatar = async () => {
    setAvatarBusy(true);
    setFeedback(null);
    try {
      await deleteBandAvatar(band.id);
      await updateBand(band.id, { avatar_url: null });
      syncSelected({ avatar_url: undefined });
      onRefresh();
      setFeedback({ type: "success", message: t("bands.avatarRemoved") });
    } catch (error) {
      console.error("Failed to remove avatar:", error);
      setFeedback({ type: "error", message: t("bands.avatarError") });
    }
    setAvatarBusy(false);
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

        <AvatarRow>
          <BandAvatar name={band.name} avatarUrl={band.avatar_url} size={80} />
          <AvatarControls>
            <AvatarLabel>{t("bands.avatar")}</AvatarLabel>
            {canEdit ? (
              <>
                <AvatarButtons>
                  <SecondaryButton
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={avatarBusy}
                  >
                    {avatarBusy ? (
                      <Spinner size="sm" />
                    ) : (
                      <i className="bi bi-upload"></i>
                    )}
                    {band.avatar_url ? t("bands.changeAvatar") : t("bands.uploadAvatar")}
                  </SecondaryButton>
                  {band.avatar_url && (
                    <LinkButton type="button" onClick={handleRemoveAvatar} disabled={avatarBusy}>
                      {t("common.remove")}
                    </LinkButton>
                  )}
                </AvatarButtons>
                <HelperText>{t("bands.avatarHint")}</HelperText>
                <HiddenFileInput
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={handleAvatarSelect}
                />
              </>
            ) : null}
          </AvatarControls>
        </AvatarRow>

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
      {isOwner && (
        <DangerCard>
          <CardHeader>
            <CardTitle $danger>
              <i className="bi bi-exclamation-octagon"></i>
              {t("bands.dangerZone")}
            </CardTitle>
          </CardHeader>

          <DangerRow>
            <DangerInfo>
              <DangerTitle>{t("bands.transferOwnership")}</DangerTitle>
              <DangerText>{t("bands.transferOwnershipShort")}</DangerText>
            </DangerInfo>
            <OutlineButton type="button" onClick={() => setTransferOpen(true)}>
              <i className="bi bi-arrow-left-right"></i>
              {t("bands.transferOwnership")}
            </OutlineButton>
          </DangerRow>

          <Divider />

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

      <TransferOwnershipModal
        bandId={band.id}
        bandName={band.name}
        isOpen={transferOpen}
        onClose={() => setTransferOpen(false)}
        onSuccess={() => {
          onRefresh();
          setFeedback({ type: "success", message: t("bands.ownershipTransferred") });
        }}
      />

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

const AvatarRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[4]};
  margin-bottom: ${theme.space[5]};
  padding-bottom: ${theme.space[5]};
  border-bottom: 1px solid var(--color-border);
`;

const AvatarControls = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[2]};
`;

const AvatarLabel = styled.span`
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
`;

const AvatarButtons = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
`;

const SecondaryButton = styled.button`
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  padding: ${theme.space[2]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};

  &:hover:not(:disabled) {
    border-color: ${theme.colors.brand.primary};
    color: ${theme.colors.brand.primary};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const LinkButton = styled.button`
  background: transparent;
  border: none;
  color: ${theme.colors.semantic.error};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;
  padding: ${theme.space[1]} ${theme.space[2]};

  &:hover:not(:disabled) {
    text-decoration: underline;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const HiddenFileInput = styled.input`
  display: none;
`;

const Divider = styled.hr`
  border: none;
  border-top: 1px solid var(--color-border);
  margin: ${theme.space[5]} 0;
`;

const OutlineButton = styled.button`
  background: transparent;
  border: 1px solid var(--color-border-strong);
  color: var(--color-text-primary);
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
    border-color: ${theme.colors.brand.primary};
    color: ${theme.colors.brand.primary};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
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
