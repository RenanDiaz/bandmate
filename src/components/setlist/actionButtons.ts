import styled, { css } from "styled-components";
import { theme } from "../../theme";

/**
 * Buttons for the setlist detail header and the reorder toolbar
 * (docs/specs/setlist-actions-layout.md §1.9). One filled button per
 * context, outlined for the rest, 40 × 40 icon buttons; labels stay at every
 * size unless a component hides them below a breakpoint.
 */

const base = `
  min-height: 40px;
  padding: ${theme.space[2]} ${theme.space[3]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${theme.space[2]};
  white-space: nowrap;

  i {
    font-size: ${theme.fontSizes.body};
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const FilledButton = styled.button<{ $tone?: "success" | "brand" }>`
  ${base}
  background: ${(p) => (p.$tone === "brand" ? theme.colors.brand.primary : theme.colors.semantic.success)};
  border: 1px solid transparent;
  color: white;

  &:hover:not(:disabled) {
    background: ${(p) => (p.$tone === "brand" ? theme.colors.brand.primaryHover : "#059669")};
    transform: translateY(-1px);
  }
`;

export const outlinedCss = css`
  ${base}
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);

  &:hover:not(:disabled) {
    border-color: ${theme.colors.brand.primary};
    color: ${theme.colors.brand.primary};
    background: var(--color-bg-tertiary);
  }
`;

/** 40 × 40 icon-only button; also applied to reactstrap toggles through a class. */
export const iconButtonCss = css`
  ${outlinedCss}
  width: 40px;
  min-width: 40px;
  padding: 0;
`;

export const OutlinedButton = styled.button`
  ${outlinedCss}
`;

export const IconButton = styled.button`
  ${iconButtonCss}
`;
