import type { FC } from "react";
import { useTranslation } from "react-i18next";
import { Spinner } from "reactstrap";
import styled from "styled-components";
import { theme } from "../../theme";
import { FilledButton, OutlinedButton } from "./actionButtons";

/**
 * Reorder-mode toolbar (docs/specs/setlist-actions-layout.md §2.4): the hint
 * plus Cancel · Optimize order · Save order, sticky under the navbar so Save
 * stays within reach while dragging the last song.
 */
export interface ReorderToolbarProps {
  /** AI optimize needs Groq configured and at least three songs. */
  canOptimize: boolean;
  saving: boolean;
  optimizing: boolean;
  onCancel: () => void;
  onOptimize: () => void;
  onSave: () => void;
}

export const ReorderToolbar: FC<ReorderToolbarProps> = ({
  canOptimize,
  saving,
  optimizing,
  onCancel,
  onOptimize,
  onSave,
}) => {
  const { t } = useTranslation();
  const busy = saving || optimizing;

  return (
    <Toolbar role="toolbar" aria-label={t("setlists.detail.reorder")}>
      <Hint>
        <i className="bi bi-info-circle" />
        <span>{t("setlists.detail.reorderHint")}</span>
      </Hint>
      <Buttons>
        <OutlinedButton type="button" onClick={onCancel} disabled={busy}>
          <i className="bi bi-x-lg" />
          <span>{t("common.cancel")}</span>
        </OutlinedButton>
        {canOptimize && (
          <OutlinedButton type="button" onClick={onOptimize} disabled={busy}>
            <i className="bi bi-magic" />
            <span>{t("ai.optimizeOrder")}</span>
          </OutlinedButton>
        )}
        <SaveButton type="button" onClick={onSave} disabled={busy}>
          {saving ? <Spinner size="sm" /> : <i className="bi bi-check-lg" />}
          <span>{saving ? t("common.saving") : t("setlists.detail.saveOrder")}</span>
        </SaveButton>
      </Buttons>
    </Toolbar>
  );
};

// Styled Components

// The navbar is sticky and ≈72px tall (see ViewContainer's min-height).
const NAVBAR_HEIGHT = "72px";

const Toolbar = styled.div`
  position: sticky;
  top: calc(${NAVBAR_HEIGHT} + ${theme.space[2]});
  z-index: ${theme.zIndex.dropdown};
  background: var(--color-bg-secondary);
  border: 1px solid ${theme.colors.brand.primary};
  border-radius: ${theme.radius.base};
  padding: ${theme.space[3]} ${theme.space[4]};
  margin-bottom: ${theme.space[4]};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${theme.space[3]};
  box-shadow: var(--shadow-md);

  @media (max-width: ${theme.breakpoints.md}) {
    flex-direction: column;
    align-items: stretch;
  }
`;

const Hint = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.brand.primary};
  font-weight: ${theme.fontWeights.medium};
  min-width: 0;

  i {
    font-size: ${theme.fontSizes.body};
    flex-shrink: 0;
  }
`;

const Buttons = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${theme.space[2]};
  flex-shrink: 0;

  @media (max-width: ${theme.breakpoints.md}) {
    > * {
      flex: 1;
    }
  }
`;

// On a phone Save takes its own full-width row under Cancel / Optimize.
const SaveButton = styled(FilledButton).attrs({ $tone: "brand" })`
  @media (max-width: ${theme.breakpoints.sm}) {
    flex-basis: 100%;
  }
`;
