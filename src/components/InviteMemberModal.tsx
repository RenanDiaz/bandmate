import type { FC } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Spinner } from "reactstrap";
import styled from "styled-components";
import { theme } from "../theme";
import { createBandInvitation } from "../services/bandMembersService";
import type { BandRole } from "../services/bandMembersService";

interface Props {
  bandId: number;
  bandName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Feedback = { type: "success" | "warning" | "error"; message: string };

export const InviteMemberModal: FC<Props> = ({ bandId, bandName, isOpen, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Exclude<BandRole, "owner">>("member");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setFeedback({ type: "error", message: t("bands.enterEmail") });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      const result = await createBandInvitation({
        band_id: bandId,
        email: trimmedEmail.toLowerCase(),
        role,
        expires_in_days: role === "guest" ? 30 : undefined,
      });

      // Refresh the parent's invitation list regardless of email outcome.
      onSuccess();

      if (result.emailSent) {
        setFeedback({
          type: "success",
          message: t("bands.invitationSent", { email: trimmedEmail }),
        });
      } else {
        // Invitation was created but the email could not be delivered.
        // Keep the modal open so the owner can copy/share the link manually.
        setFeedback({
          type: "warning",
          message: t("bands.invitationCreatedEmailFailed", { email: trimmedEmail }),
        });
      }
      setEmail("");
      setRole("member");
    } catch (error) {
      console.error("Failed to send invitation:", error);
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : t("bands.sendInvitationError"),
      });
    }
    setSubmitting(false);
  };

  const handleClose = () => {
    setFeedback(null);
    onClose();
  };

  return (
    <>
      <Overlay onClick={handleClose} />
      <ModalContainer>
        <ModalHeader>
          <Title>
            <i className="bi bi-person-plus"></i>
            {t('bands.inviteMemberTo', { bandName })}
          </Title>
          <CloseButton onClick={handleClose}>
            <i className="bi bi-x"></i>
          </CloseButton>
        </ModalHeader>

        <Form onSubmit={handleSubmit}>
          {feedback && (
            <FeedbackBanner $type={feedback.type} role="status" aria-live="polite">
              <i className={`bi ${
                feedback.type === "success"
                  ? "bi-check-circle-fill"
                  : feedback.type === "warning"
                  ? "bi-exclamation-triangle-fill"
                  : "bi-x-circle-fill"
              }`}></i>
              <span>{feedback.message}</span>
            </FeedbackBanner>
          )}

          <FormGroup>
            <Label>{t('bands.emailAddress')}</Label>
            <Input
              type="email"
              placeholder={t('bands.emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              required
            />
            <HelperText>{t('bands.emailHint')}</HelperText>
          </FormGroup>

          <FormGroup>
            <Label>{t('bands.role')}</Label>
            <Select value={role} onChange={(e) => setRole(e.target.value as Exclude<BandRole, "owner">)} disabled={submitting}>
              <option value="member">{t('bands.roleMemberDesc')}</option>
              <option value="guest">{t('bands.roleGuestDesc')}</option>
            </Select>
          </FormGroup>

          <Actions>
            <CancelButton type="button" onClick={handleClose} disabled={submitting}>
              {t('common.cancel')}
            </CancelButton>
            <SubmitButton type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Spinner size="sm" />
                  {t('common.sending')}
                </>
              ) : (
                <>
                  <i className="bi bi-send"></i>
                  {t('bands.sendInvitation')}
                </>
              )}
            </SubmitButton>
          </Actions>
        </Form>
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
  background: rgba(0, 0, 0, 0.7);
  z-index: ${theme.zIndex.modal};
  animation: fadeIn ${theme.transitions.base} ease;

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
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  z-index: ${theme.zIndex.modal + 10};
  box-shadow: var(--shadow-xl);
  animation: slideIn ${theme.transitions.base} ease;

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translate(-50%, -48%);
    }
    to {
      opacity: 1;
      transform: translate(-50%, -50%);
    }
  }
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${theme.space[5]};
  border-bottom: 1px solid var(--color-border);
`;

const Title = styled.h2`
  font-size: ${theme.fontSizes.h3};
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

const CloseButton = styled.button`
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  width: 32px;
  height: 32px;
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

const Form = styled.form`
  padding: ${theme.space[5]};
  display: flex;
  flex-direction: column;
  gap: ${theme.space[5]};
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[2]};
`;

const FeedbackBanner = styled.div<{ $type: "success" | "warning" | "error" }>`
  display: flex;
  align-items: flex-start;
  gap: ${theme.space[2]};
  padding: ${theme.space[3]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodySm};
  line-height: 1.4;
  border: 1px solid;

  ${({ $type }) => {
    switch ($type) {
      case "success":
        return `
          background: rgba(34, 197, 94, 0.1);
          border-color: rgba(34, 197, 94, 0.4);
          color: #4ade80;
        `;
      case "warning":
        return `
          background: rgba(234, 179, 8, 0.1);
          border-color: rgba(234, 179, 8, 0.4);
          color: #facc15;
        `;
      case "error":
        return `
          background: rgba(239, 68, 68, 0.1);
          border-color: rgba(239, 68, 68, 0.4);
          color: #f87171;
        `;
    }
  }}

  i {
    flex-shrink: 0;
    font-size: ${theme.fontSizes.bodyLg};
    margin-top: 1px;
  }
`;

const Label = styled.label`
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
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

const Select = styled.select`
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  padding: ${theme.space[3]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  cursor: pointer;
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

const HelperText = styled.div`
  font-size: ${theme.fontSizes.bodyXs};
  color: var(--color-text-secondary);
`;

const Actions = styled.div`
  display: flex;
  gap: ${theme.space[3]};
  justify-content: flex-end;
  margin-top: ${theme.space[2]};
`;

const CancelButton = styled.button`
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  padding: ${theme.space[3]} ${theme.space[5]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  &:hover:not(:disabled) {
    background: var(--color-bg-elevated);
    border-color: var(--color-border-strong);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const SubmitButton = styled.button`
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
