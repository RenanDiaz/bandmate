import type { FC, FormEvent, ChangeEvent } from "react";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Form,
  FormGroup,
  Label,
  Input,
  Button,
} from "reactstrap";
import styled from "styled-components";
import { theme } from "../theme";
import { useToast } from "../context/useToast";
import { updateSetlist } from "../services/setlistsService";
import type { Setlist } from "../services/setlistsService";

interface Props {
  setlist: Setlist | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (updatedSetlist: Setlist) => void;
}

export const EditSetlistModal: FC<Props> = ({ setlist, isOpen, onClose, onUpdated }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Load setlist data when modal opens
  useEffect(() => {
    if (setlist && isOpen) {
      setName(setlist.name || "");
      setDescription(setlist.description || "");
    }
  }, [setlist, isOpen]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!setlist || !name.trim()) return;

    setLoading(true);
    try {
      const updatedSetlist = await updateSetlist(setlist.id, {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      onUpdated(updatedSetlist);
      onClose();
    } catch (error) {
      console.error("Failed to update setlist:", error);
      toast.error(t('setlists.updateError'));
    }
    setLoading(false);
  };

  if (!setlist) return null;

  return (
    <StyledModal isOpen={isOpen} toggle={onClose} centered>
      <StyledModalHeader toggle={onClose}>
        <i className="bi bi-pencil me-2"></i>
        {t('setlists.renameSetlist')}
      </StyledModalHeader>

      <Form onSubmit={handleSubmit}>
        <StyledModalBody>
          <FormGroup>
            <StyledLabel for="editSetlistName">
              {t('setlists.setlistName')} <Required>*</Required>
            </StyledLabel>
            <StyledInput
              type="text"
              id="editSetlistName"
              value={name}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              placeholder={t('setlists.placeholders.name')}
              required
            />
          </FormGroup>

          <FormGroup>
            <StyledLabel for="editSetlistDescription">
              {t('setlists.description')}
            </StyledLabel>
            <StyledTextarea
              type="textarea"
              id="editSetlistDescription"
              value={description}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
              placeholder={t('setlists.placeholders.description')}
              rows={3}
            />
          </FormGroup>
        </StyledModalBody>

        <StyledModalFooter>
          <CancelButton type="button" onClick={onClose}>
            {t('common.cancel')}
          </CancelButton>
          <SubmitButton type="submit" disabled={loading || !name.trim()}>
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2"></span>
                {t('common.saving')}
              </>
            ) : (
              <>
                <i className="bi bi-check-lg me-2"></i>
                {t('common.saveChanges')}
              </>
            )}
          </SubmitButton>
        </StyledModalFooter>
      </Form>
    </StyledModal>
  );
};

// Styled Components

const StyledModal = styled(Modal)`
  .modal-content {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: ${theme.radius.lg};
  }
`;

const StyledModalHeader = styled(ModalHeader)`
  background: var(--color-bg-tertiary);
  border-bottom: 1px solid var(--color-border);
  padding: ${theme.space[4]};

  .modal-title {
    font-size: ${theme.fontSizes.h4};
    font-weight: ${theme.fontWeights.semibold};
    color: var(--color-text-primary);
    display: flex;
    align-items: center;

    i {
      color: ${theme.colors.brand.primary};
    }
  }

  .btn-close {
    filter: invert(1);
  }
`;

const StyledModalBody = styled(ModalBody)`
  padding: ${theme.space[4]};
`;

const StyledModalFooter = styled(ModalFooter)`
  background: var(--color-bg-tertiary);
  border-top: 1px solid var(--color-border);
  padding: ${theme.space[4]};
  display: flex;
  justify-content: flex-end;
  gap: ${theme.space[3]};
`;

const StyledLabel = styled(Label)`
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  color: var(--color-text-secondary);
  margin-bottom: ${theme.space[2]};
`;

const Required = styled.span`
  color: ${theme.colors.semantic.error};
`;

const StyledInput = styled(Input)`
  background: var(--color-bg-tertiary) !important;
  border: 1px solid var(--color-border) !important;
  color: var(--color-text-primary) !important;
  border-radius: ${theme.radius.base} !important;
  padding: ${theme.space[3]} !important;
  font-size: ${theme.fontSizes.body} !important;

  &::placeholder {
    color: var(--color-text-disabled) !important;
  }

  &:focus {
    border-color: ${theme.colors.brand.primary} !important;
    box-shadow: 0 0 0 2px ${theme.colors.brand.primary}30 !important;
  }
`;

const StyledTextarea = styled(Input)`
  background: var(--color-bg-tertiary) !important;
  border: 1px solid var(--color-border) !important;
  color: var(--color-text-primary) !important;
  border-radius: ${theme.radius.base} !important;
  padding: ${theme.space[3]} !important;
  font-size: ${theme.fontSizes.body} !important;
  resize: vertical;
  min-height: 80px;

  &::placeholder {
    color: var(--color-text-disabled) !important;
  }

  &:focus {
    border-color: ${theme.colors.brand.primary} !important;
    box-shadow: 0 0 0 2px ${theme.colors.brand.primary}30 !important;
  }
`;

const CancelButton = styled(Button)`
  background: transparent !important;
  border: 1px solid var(--color-border) !important;
  color: var(--color-text-secondary) !important;
  padding: ${theme.space[2]} ${theme.space[4]} !important;
  font-weight: ${theme.fontWeights.medium} !important;
  border-radius: ${theme.radius.base} !important;

  &:hover {
    background: var(--color-bg-elevated) !important;
    border-color: var(--color-border-strong) !important;
    color: var(--color-text-primary) !important;
  }
`;

const SubmitButton = styled(Button)`
  background: ${theme.colors.brand.primary} !important;
  border: none !important;
  color: white !important;
  padding: ${theme.space[2]} ${theme.space[4]} !important;
  font-weight: ${theme.fontWeights.medium} !important;
  border-radius: ${theme.radius.base} !important;
  display: flex;
  align-items: center;

  &:hover:not(:disabled) {
    background: ${theme.colors.brand.primaryHover} !important;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;
