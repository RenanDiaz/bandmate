import type { FC } from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Spinner } from "reactstrap";
import styled from "styled-components";
import { theme } from "../theme";
import { getBandMembers } from "../services/bandMembersService";
import type { BandMember } from "../services/bandMembersService";
import { transferBandOwnership } from "../services/bandsService";

interface Props {
  bandId: number;
  bandName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const memberLabel = (m: BandMember): string =>
  m.user_metadata?.full_name || m.email || "Band member";

export const TransferOwnershipModal: FC<Props> = ({ bandId, bandName, isOpen, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const [members, setMembers] = useState<BandMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedId("");
    setError(null);
    setLoading(true);
    getBandMembers(bandId)
      .then((data) => {
        // Only existing non-owner, non-guest members can become the new owner.
        setMembers(data.filter((m) => m.role !== "owner" && m.role !== "guest"));
      })
      .catch((e) => {
        console.error("Failed to load members:", e);
        setError(t("bands.loadMembersError"));
      })
      .finally(() => setLoading(false));
  }, [isOpen, bandId, t]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (!selectedId) {
      setError(t("bands.selectNewOwner"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await transferBandOwnership(bandId, selectedId);
      onSuccess();
      onClose();
    } catch (e) {
      console.error("Failed to transfer ownership:", e);
      setError(e instanceof Error ? e.message : t("bands.transferOwnershipError"));
      setSubmitting(false);
    }
  };

  return (
    <>
      <Overlay onClick={submitting ? undefined : onClose} />
      <ModalContainer role="dialog" aria-modal="true">
        <ModalHeader>
          <Title>
            <i className="bi bi-arrow-left-right"></i>
            {t("bands.transferOwnership")}
          </Title>
          <CloseButton onClick={onClose} disabled={submitting}>
            <i className="bi bi-x"></i>
          </CloseButton>
        </ModalHeader>

        <Body>
          <Description>{t("bands.transferOwnershipDescription", { bandName })}</Description>

          {error && (
            <FeedbackBanner role="alert">
              <i className="bi bi-x-circle-fill"></i>
              <span>{error}</span>
            </FeedbackBanner>
          )}

          {loading ? (
            <LoadingRow>
              <Spinner size="sm" />
              {t("bands.loadingMembers")}
            </LoadingRow>
          ) : members.length === 0 ? (
            <EmptyNote>{t("bands.noEligibleMembers")}</EmptyNote>
          ) : (
            <FormGroup>
              <Label htmlFor="newOwner">{t("bands.newOwner")}</Label>
              <Select
                id="newOwner"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                disabled={submitting}
              >
                <option value="">{t("bands.selectMemberPlaceholder")}</option>
                {members.map((m) => (
                  <option key={m.id} value={m.user_id}>
                    {memberLabel(m)} · {t(`bands.${m.role}`)}
                  </option>
                ))}
              </Select>
              <WarningText>
                <i className="bi bi-exclamation-triangle-fill"></i>
                {t("bands.transferOwnershipWarning")}
              </WarningText>
            </FormGroup>
          )}

          <Actions>
            <CancelButton type="button" onClick={onClose} disabled={submitting}>
              {t("common.cancel")}
            </CancelButton>
            <ConfirmButton
              type="button"
              onClick={handleConfirm}
              disabled={submitting || loading || members.length === 0 || !selectedId}
            >
              {submitting ? <Spinner size="sm" /> : <i className="bi bi-arrow-left-right"></i>}
              {t("bands.transferOwnership")}
            </ConfirmButton>
          </Actions>
        </Body>
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
  max-width: 480px;
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

  &:hover:not(:disabled) {
    background: var(--color-bg-elevated);
    color: var(--color-text-primary);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const Body = styled.div`
  padding: ${theme.space[5]};
  display: flex;
  flex-direction: column;
  gap: ${theme.space[5]};
`;

const Description = styled.p`
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-secondary);
  line-height: ${theme.lineHeights.relaxed};
  margin: 0;
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

const WarningText = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${theme.space[2]};
  font-size: ${theme.fontSizes.bodyXs};
  color: ${theme.colors.semantic.warning};
  line-height: 1.4;

  i {
    margin-top: 1px;
    flex-shrink: 0;
  }
`;

const FeedbackBanner = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${theme.space[2]};
  padding: ${theme.space[3]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodySm};
  line-height: 1.4;
  border: 1px solid rgba(239, 68, 68, 0.4);
  background: rgba(239, 68, 68, 0.1);
  color: #f87171;

  i {
    flex-shrink: 0;
    font-size: ${theme.fontSizes.bodyLg};
    margin-top: 1px;
  }
`;

const LoadingRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  color: var(--color-text-secondary);
  font-size: ${theme.fontSizes.bodySm};
`;

const EmptyNote = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
  line-height: ${theme.lineHeights.relaxed};
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

const ConfirmButton = styled.button`
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

  &:hover:not(:disabled) {
    background: ${theme.colors.brand.primaryHover};
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  &:disabled {
    background: var(--color-bg-elevated);
    color: var(--color-text-disabled);
    cursor: not-allowed;
  }
`;
