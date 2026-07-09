import type { FC } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Spinner } from "reactstrap";
import styled from "styled-components";
import { theme } from "../theme";

interface Props {
  isOpen: boolean;
  title: string;
  message: string;
  /** Label for the confirm button. Defaults to a generic "Confirm". */
  confirmLabel?: string;
  /** Label for the cancel button. Defaults to common.cancel. */
  cancelLabel?: string;
  /** Visual tone of the confirm button. */
  tone?: "danger" | "primary";
  /** Disables buttons and shows a spinner on the confirm button. */
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmModal: FC<Props> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone = "danger",
  busy = false,
  onConfirm,
  onClose,
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  // Portal to body so a transformed/scrollable ancestor (e.g. a parent modal)
  // can't become the containing block for the fixed-position overlay.
  return createPortal(
    <>
      <Overlay onClick={busy ? undefined : onClose} />
      <ModalContainer role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
        <ModalHeader>
          <Title id="confirm-modal-title">
            <i className={`bi ${tone === "danger" ? "bi-exclamation-triangle" : "bi-question-circle"}`}></i>
            {title}
          </Title>
        </ModalHeader>

        <Body>
          <Message>{message}</Message>

          <Actions>
            <CancelButton type="button" onClick={onClose} disabled={busy}>
              {cancelLabel ?? t("common.cancel")}
            </CancelButton>
            <ConfirmButton type="button" $tone={tone} onClick={onConfirm} disabled={busy}>
              {busy ? <Spinner size="sm" /> : null}
              {confirmLabel ?? t("common.confirm")}
            </ConfirmButton>
          </Actions>
        </Body>
      </ModalContainer>
    </>,
    document.body
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
  max-width: 440px;
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
  padding: ${theme.space[5]} ${theme.space[5]} 0;
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
    color: ${theme.colors.semantic.warning};
  }
`;

const Body = styled.div`
  padding: ${theme.space[5]};
  display: flex;
  flex-direction: column;
  gap: ${theme.space[5]};
`;

const Message = styled.p`
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-secondary);
  line-height: ${theme.lineHeights.relaxed};
  margin: 0;
`;

const Actions = styled.div`
  display: flex;
  gap: ${theme.space[3]};
  justify-content: flex-end;
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

const ConfirmButton = styled.button<{ $tone: "danger" | "primary" }>`
  background: ${(props) =>
    props.$tone === "danger" ? theme.colors.semantic.error : theme.colors.brand.primary};
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
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
    filter: brightness(1.05);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;
