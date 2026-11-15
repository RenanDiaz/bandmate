import type { FC, FormEvent } from "react";
import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, ModalBody, ModalHeader, Spinner } from "reactstrap";
import styled from "styled-components";
import { theme } from "../../theme";
import { PrimaryButton, SecondaryButton } from "./buttons";

interface Props {
  isOpen: boolean;
  title: string;
  label: string;
  hint?: string;
  initialValue: string;
  maxLength: number;
  placeholder?: string;
  /** Saves the trimmed value ("" = clear). Resolves to an error message to show, or null when saved. */
  onSave: (value: string) => Promise<string | null>;
  onClose: () => void;
}

/**
 * A dialog with one text field and Save / Cancel (a nickname, the account's
 * name). Enter saves; an empty value is allowed and means "clear".
 */
export const TextFieldModal: FC<Props> = ({
  isOpen,
  title,
  label,
  hint,
  initialValue,
  maxLength,
  placeholder,
  onSave,
  onClose,
}) => {
  const { t } = useTranslation();
  const inputId = useId();
  const [value, setValue] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Each opening starts from the stored value.
  useEffect(() => {
    if (isOpen) {
      setValue(initialValue);
      setError(null);
      setBusy(false);
    }
  }, [isOpen, initialValue]);

  const close = busy ? undefined : onClose;
  const length = [...value.trim()].length;
  const tooLong = length > maxLength;
  const unchanged = value.trim() === initialValue.trim();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || tooLong || unchanged) return;
    setBusy(true);
    setError(null);
    const message = await onSave(value.trim());
    setBusy(false);
    if (message) setError(message);
    else onClose();
  };

  return (
    <Modal isOpen={isOpen} toggle={close} centered>
      <ModalHeader toggle={close}>{title}</ModalHeader>
      <ModalBody>
        <form onSubmit={submit}>
          <Label htmlFor={inputId}>{label}</Label>
          <Field
            id={inputId}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={placeholder}
            autoFocus
            autoComplete="off"
            aria-invalid={tooLong || undefined}
            aria-describedby={`${inputId}-help`}
          />
          <Help id={`${inputId}-help`}>
            <span>{hint}</span>
            <Counter $over={tooLong}>
              {length}/{maxLength}
            </Counter>
          </Help>
          {error && <ErrorLine role="alert">{error}</ErrorLine>}
          <Footer>
            <SecondaryButton type="button" onClick={onClose} disabled={busy}>
              {t("common.cancel")}
            </SecondaryButton>
            <PrimaryButton type="submit" disabled={busy || tooLong || unchanged}>
              {busy && <Spinner size="sm" />}
              {t("common.save")}
            </PrimaryButton>
          </Footer>
        </form>
      </ModalBody>
    </Modal>
  );
};

const Label = styled.label`
  display: block;
  margin-bottom: ${theme.space[2]};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  color: var(--color-text-secondary);
`;

const Field = styled.input`
  width: 100%;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  border-radius: ${theme.radius.base};
  padding: ${theme.space[2]} ${theme.space[3]};
  font-size: ${theme.fontSizes.body};

  &:focus {
    outline: none;
    border-color: ${theme.colors.brand.primary};
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.15);
  }

  &[aria-invalid="true"] {
    border-color: ${theme.colors.semantic.error};
  }
`;

const Help = styled.div`
  display: flex;
  justify-content: space-between;
  gap: ${theme.space[3]};
  margin-top: ${theme.space[2]};
  font-size: ${theme.fontSizes.bodyXs};
  color: var(--color-text-tertiary);
`;

const Counter = styled.span<{ $over: boolean }>`
  flex-shrink: 0;
  color: ${(props) => (props.$over ? theme.colors.semantic.error : "inherit")};
`;

const ErrorLine = styled.div`
  margin-top: ${theme.space[3]};
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.semantic.error};
`;

const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${theme.space[2]};
  margin-top: ${theme.space[4]};
`;
