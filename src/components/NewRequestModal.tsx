import type { FC } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Form,
  FormGroup,
  Label,
  Input,
} from "reactstrap";
import styled from "styled-components";
import { theme } from "../theme";
import {
  createRequest,
  type RequestType,
  getRequestTypeIcon,
} from "../services/requestsService";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  bandId: number;
  onCreated: () => void;
  // Pre-fill options for integrations
  prefillType?: RequestType;
  prefillSongId?: string;
  prefillSetlistId?: string;
  prefillShowId?: string;
}

const REQUEST_TYPES: RequestType[] = [
  "new_song",
  "backing_track",
  "setlist_proposal",
  "song_change",
  "general",
];

export const NewRequestModal: FC<Props> = ({
  isOpen,
  onClose,
  bandId,
  onCreated,
  prefillType,
  prefillSongId,
  prefillSetlistId,
  prefillShowId,
}) => {
  const { t } = useTranslation();
  const [requestType, setRequestType] = useState<RequestType>(prefillType || "new_song");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Type-specific fields
  const [songArtist, setSongArtist] = useState("");
  const [songName, setSongName] = useState("");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [proposedChanges, setProposedChanges] = useState("");

  const resetForm = () => {
    setRequestType(prefillType || "new_song");
    setTitle("");
    setDescription("");
    setSongArtist("");
    setSongName("");
    setReferenceUrl("");
    setProposedChanges("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      alert(t("requests.titleRequired"));
      return;
    }

    setIsSubmitting(true);
    try {
      // Build request_data based on type
      const requestData: Record<string, unknown> = {};

      if (requestType === "new_song") {
        requestData.artist = songArtist;
        requestData.song_name = songName;
        if (referenceUrl) requestData.reference_url = referenceUrl;
      } else if (requestType === "backing_track" && prefillSongId) {
        requestData.song_id = prefillSongId;
      } else if (requestType === "setlist_proposal") {
        if (prefillSetlistId) requestData.setlist_id = prefillSetlistId;
        if (prefillShowId) requestData.show_id = prefillShowId;
      } else if (requestType === "song_change") {
        if (prefillSongId) requestData.song_id = prefillSongId;
        requestData.proposed_changes = proposedChanges;
      }

      await createRequest({
        band_id: bandId,
        request_type: requestType,
        title: title.trim(),
        description: description.trim() || undefined,
        request_data: requestData,
        related_song_id: prefillSongId,
        related_setlist_id: prefillSetlistId,
        related_show_id: prefillShowId,
      });

      handleClose();
      onCreated();
    } catch (error) {
      console.error("Failed to create request:", error);
      alert(t("requests.createError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <StyledModal isOpen={isOpen} toggle={handleClose} size="lg">
      <ModalHeader toggle={handleClose}>
        {t("requests.createRequest")}
      </ModalHeader>
      <Form onSubmit={handleSubmit}>
        <ModalBody>
          {/* Request Type Selection */}
          <FormGroup>
            <Label>{t("requests.type")}</Label>
            <TypeGrid>
              {REQUEST_TYPES.map((type) => (
                <TypeCard
                  key={type}
                  $selected={requestType === type}
                  onClick={() => setRequestType(type)}
                  type="button"
                >
                  <TypeIcon className={getRequestTypeIcon(type)} />
                  <TypeLabel>{t(`requests.types.${type}`)}</TypeLabel>
                </TypeCard>
              ))}
            </TypeGrid>
          </FormGroup>

          {/* Title */}
          <FormGroup>
            <Label for="title">{t("requests.requestTitle")} *</Label>
            <Input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t(`requests.placeholders.title.${requestType}`)}
              required
            />
          </FormGroup>

          {/* Type-specific fields */}
          {requestType === "new_song" && (
            <>
              <FormGroup>
                <Label for="songArtist">{t("songs.artist")}</Label>
                <Input
                  id="songArtist"
                  type="text"
                  value={songArtist}
                  onChange={(e) => setSongArtist(e.target.value)}
                  placeholder={t("songs.placeholders.artist")}
                />
              </FormGroup>
              <FormGroup>
                <Label for="songName">{t("requests.songName")}</Label>
                <Input
                  id="songName"
                  type="text"
                  value={songName}
                  onChange={(e) => setSongName(e.target.value)}
                  placeholder={t("songs.placeholders.title")}
                />
              </FormGroup>
              <FormGroup>
                <Label for="referenceUrl">{t("requests.referenceUrl")}</Label>
                <Input
                  id="referenceUrl"
                  type="url"
                  value={referenceUrl}
                  onChange={(e) => setReferenceUrl(e.target.value)}
                  placeholder={t("requests.placeholders.referenceUrl")}
                />
                <HintText>{t("requests.referenceUrlHint")}</HintText>
              </FormGroup>
            </>
          )}

          {requestType === "song_change" && (
            <FormGroup>
              <Label for="proposedChanges">{t("requests.proposedChanges")}</Label>
              <Input
                id="proposedChanges"
                type="textarea"
                value={proposedChanges}
                onChange={(e) => setProposedChanges(e.target.value)}
                placeholder={t("requests.placeholders.proposedChanges")}
                rows={3}
              />
            </FormGroup>
          )}

          {/* Description */}
          <FormGroup>
            <Label for="description">{t("requests.description")}</Label>
            <Input
              id="description"
              type="textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("requests.placeholders.description")}
              rows={3}
            />
            <HintText>{t("requests.descriptionHint")}</HintText>
          </FormGroup>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={handleClose} disabled={isSubmitting}>
            {t("common.cancel")}
          </Button>
          <SubmitButton type="submit" disabled={isSubmitting || !title.trim()}>
            {isSubmitting ? t("common.creating") : t("requests.submitRequest")}
          </SubmitButton>
        </ModalFooter>
      </Form>
    </StyledModal>
  );
};

// Styled Components

const StyledModal = styled(Modal)`
  .modal-content {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
  }

  .modal-header {
    border-bottom: 1px solid var(--color-border);
  }

  .modal-footer {
    border-top: 1px solid var(--color-border);
  }
`;

const TypeGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: ${theme.space[3]};
  margin-top: ${theme.space[2]};
`;

const TypeCard = styled.button<{ $selected: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${theme.space[2]};
  padding: ${theme.space[4]};
  background: ${(props) =>
    props.$selected ? theme.colors.brand.primary + "20" : "var(--color-bg-tertiary)"};
  border: 2px solid
    ${(props) =>
      props.$selected ? theme.colors.brand.primary : "var(--color-border)"};
  border-radius: ${theme.radius.lg};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  &:hover {
    border-color: ${theme.colors.brand.primary};
    background: ${(props) =>
      props.$selected
        ? theme.colors.brand.primary + "20"
        : "var(--color-bg-elevated)"};
  }
`;

const TypeIcon = styled.i`
  font-size: ${theme.fontSizes.h2};
  color: ${theme.colors.brand.primary};
`;

const TypeLabel = styled.span`
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  color: var(--color-text-primary);
  text-align: center;
`;

const HintText = styled.small`
  display: block;
  margin-top: ${theme.space[1]};
  color: var(--color-text-tertiary);
  font-size: ${theme.fontSizes.bodyXs};
`;

const SubmitButton = styled(Button)`
  background: ${theme.gradients.brandPrimary} !important;
  border: none !important;
  font-weight: ${theme.fontWeights.semibold} !important;

  &:hover:not(:disabled) {
    box-shadow: var(--shadow-md);
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;
