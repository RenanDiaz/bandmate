import { Link } from "react-router-dom";
import styled, { css } from "styled-components";
import { theme } from "../../theme";

/** Shared styles of the offline screens (PR 2.5). Presentational only. */

export const Page = styled.div`
  width: 100%;
  max-width: 960px;
  margin: 0 auto;
  padding: ${theme.space[6]} ${theme.space[4]};
  display: flex;
  flex-direction: column;
  gap: ${theme.space[4]};
`;

export const Banner = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  padding: ${theme.space[2]} ${theme.space[3]};
  border-radius: ${theme.radius.base};
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  font-size: ${theme.fontSizes.bodySm};

  i {
    color: ${theme.colors.brand.primary};
  }
`;

export const Header = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  min-width: 0;
`;

export const Title = styled.h1`
  font-size: ${theme.fontSizes.h3};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin: 0;
  overflow-wrap: anywhere;
`;

export const Subtitle = styled.p`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
  margin: 0;
`;

export const SectionTitle = styled.h2`
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin: ${theme.space[2]} 0 0;
`;

export const Card = styled.div`
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.lg};
  padding: ${theme.space[4]};
`;

export const Muted = styled.span`
  color: var(--color-text-secondary);
  font-size: ${theme.fontSizes.bodySm};
`;

const primary = css`
  background: ${theme.colors.brand.primary};
  border: none;
  color: white;
  padding: ${theme.space[2]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${theme.space[2]};
  white-space: nowrap;
  text-decoration: none;

  &:hover:not(:disabled) {
    background: ${theme.colors.brand.primaryHover};
    color: white;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const PrimaryButton = styled.button`
  ${primary}
`;

export const PrimaryLink = styled(Link)`
  ${primary}
`;

export const SecondaryButton = styled.button`
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  padding: ${theme.space[2]} ${theme.space[3]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodySm};
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[2]};
  white-space: nowrap;

  &:hover:not(:disabled) {
    border-color: ${theme.colors.brand.primary};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
