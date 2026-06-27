import type { FC } from "react";
import styled from "styled-components";
import { theme } from "../theme";
import type { Toast, ToastType } from "../context/ToastContext";

interface Props {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}

const ICONS: Record<ToastType, string> = {
  success: "bi-check-circle-fill",
  warning: "bi-exclamation-triangle-fill",
  error: "bi-x-circle-fill",
  info: "bi-info-circle-fill",
};

export const ToastContainer: FC<Props> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <Container role="region" aria-label="Notifications">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} $type={toast.type} role="status" aria-live="polite">
          <i className={`bi ${ICONS[toast.type]}`}></i>
          <Message>{toast.message}</Message>
          <CloseButton type="button" onClick={() => onDismiss(toast.id)} aria-label="Close">
            <i className="bi bi-x"></i>
          </CloseButton>
        </ToastItem>
      ))}
    </Container>
  );
};

const Container = styled.div`
  position: fixed;
  bottom: ${theme.space[4]};
  right: ${theme.space[4]};
  z-index: ${theme.zIndex.tooltip + 10};
  display: flex;
  flex-direction: column;
  gap: ${theme.space[3]};
  max-width: min(420px, calc(100vw - ${theme.space[6]}));
  pointer-events: none;

  @media (max-width: ${theme.breakpoints.md}) {
    left: ${theme.space[4]};
    right: ${theme.space[4]};
    max-width: none;
  }
`;

const ToastItem = styled.div<{ $type: ToastType }>`
  display: flex;
  align-items: flex-start;
  gap: ${theme.space[2]};
  padding: ${theme.space[3]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodySm};
  line-height: 1.4;
  border: 1px solid;
  background: var(--color-bg-secondary);
  box-shadow: var(--shadow-lg);
  pointer-events: auto;
  animation: toastIn ${theme.transitions.base} ease;

  @keyframes toastIn {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  ${({ $type }) => {
    switch ($type) {
      case "success":
        return `
          border-color: rgba(34, 197, 94, 0.4);
          color: #4ade80;
        `;
      case "warning":
        return `
          border-color: rgba(234, 179, 8, 0.4);
          color: #facc15;
        `;
      case "error":
        return `
          border-color: rgba(239, 68, 68, 0.4);
          color: #f87171;
        `;
      case "info":
        return `
          border-color: rgba(6, 182, 212, 0.4);
          color: #22d3ee;
        `;
    }
  }}

  i {
    flex-shrink: 0;
    font-size: ${theme.fontSizes.bodyLg};
    margin-top: 1px;
  }
`;

const Message = styled.span`
  flex: 1;
  color: var(--color-text-primary);
`;

const CloseButton = styled.button`
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: 0;
  margin: 0;
  line-height: 1;
  flex-shrink: 0;
  transition: color ${theme.transitions.fast} ease;

  i {
    font-size: ${theme.fontSizes.bodyLg};
    margin-top: 0;
  }

  &:hover {
    color: var(--color-text-primary);
  }
`;
