import styled from "styled-components";
import { theme } from "../../theme";

/**
 * The app's dialog and form buttons: a filled one for the main action and an
 * outlined one for cancel / secondary actions (same look as `ConfirmModal`).
 * Use these instead of reactstrap's `<Button color="…">`, whose Bootstrap
 * defaults don't match the theme.
 */

const base = `
  padding: ${theme.space[2]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.medium};
  line-height: ${theme.lineHeights.normal};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${theme.space[2]};

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

/** Main action. `$tone="danger"` for destructive or red-branded actions. */
export const PrimaryButton = styled.button<{ $tone?: "primary" | "danger" }>`
  ${base}
  background: ${(p) => (p.$tone === "danger" ? theme.colors.semantic.error : theme.colors.brand.primary)};
  border: 1px solid transparent;
  color: white;
  font-weight: ${theme.fontWeights.semibold};

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
    filter: brightness(1.05);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }
`;

/** Cancel / close and secondary actions. */
export const SecondaryButton = styled.button`
  ${base}
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);

  &:hover:not(:disabled) {
    background: var(--color-bg-elevated);
    border-color: var(--color-border-strong);
  }
`;

/** Outlined destructive action outside a dialog footer (e.g. "Delete request"). */
export const DangerOutlineButton = styled.button`
  ${base}
  background: transparent;
  border: 1px solid ${theme.colors.semantic.error};
  color: ${theme.colors.semantic.error};
  font-weight: ${theme.fontWeights.semibold};

  &:hover:not(:disabled) {
    background: ${theme.colors.semantic.error};
    color: white;
  }
`;
