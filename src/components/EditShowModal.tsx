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
  Row,
  Col,
} from "reactstrap";
import styled from "styled-components";
import { theme } from "../theme";
import { updateShow } from "../services/showsService";
import type { Show, ShowStatus } from "../services/showsService";
import { getBandSetlists } from "../services/setlistsService";
import type { Setlist } from "../services/setlistsService";

interface Props {
  show: Show | null;
  isOpen: boolean;
  onClose: () => void;
  onReload: () => void;
  bandId: number;
}

export const EditShowModal: FC<Props> = ({ show, isOpen, onClose, onReload, bandId }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [setlists, setSetlists] = useState<Setlist[]>([]);

  // Form state
  const [name, setName] = useState("");
  const [venue, setVenue] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [doorsTime, setDoorsTime] = useState("");
  const [soundcheckTime, setSoundcheckTime] = useState("");
  const [setlistId, setSetlistId] = useState("");
  const [status, setStatus] = useState<ShowStatus>("upcoming");
  const [notes, setNotes] = useState("");

  // Load show data when modal opens
  useEffect(() => {
    if (show && isOpen) {
      setName(show.name || "");
      setVenue(show.venue || "");
      setVenueAddress(show.venue_address || "");
      setEventDate(show.event_date || "");
      setEventTime(show.event_time || "");
      setDoorsTime(show.doors_time || "");
      setSoundcheckTime(show.soundcheck_time || "");
      setSetlistId(show.setlist_id || "");
      setStatus(show.status || "upcoming");
      setNotes(show.notes || "");

      // Load setlists for dropdown
      getBandSetlists(bandId).then(setSetlists).catch(console.error);
    }
  }, [show, isOpen, bandId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!show || !name.trim() || !eventDate) return;

    setLoading(true);
    try {
      await updateShow(show.id, {
        name: name.trim(),
        venue: venue.trim() || undefined,
        venue_address: venueAddress.trim() || undefined,
        event_date: eventDate,
        event_time: eventTime || undefined,
        doors_time: doorsTime || undefined,
        soundcheck_time: soundcheckTime || undefined,
        setlist_id: setlistId || null,
        status,
        notes: notes.trim() || undefined,
      });
      onClose();
      onReload();
    } catch (error) {
      console.error("Failed to update show:", error);
      alert(t('shows.updateError'));
    }
    setLoading(false);
  };

  if (!show) return null;

  return (
    <StyledModal isOpen={isOpen} toggle={onClose} size="lg" centered>
      <StyledModalHeader toggle={onClose}>
        <i className="bi bi-calendar-event me-2"></i>
        {t('shows.editShow')}
      </StyledModalHeader>

      <Form onSubmit={handleSubmit}>
        <StyledModalBody>
          <FormGroup>
            <StyledLabel for="editShowName">
              {t('shows.showName')} <Required>*</Required>
            </StyledLabel>
            <StyledInput
              type="text"
              id="editShowName"
              value={name}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              placeholder={t('shows.placeholders.name')}
              required
            />
          </FormGroup>

          <Row>
            <Col md={6}>
              <FormGroup>
                <StyledLabel for="editEventDate">
                  {t('shows.date')} <Required>*</Required>
                </StyledLabel>
                <StyledInput
                  type="date"
                  id="editEventDate"
                  value={eventDate}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setEventDate(e.target.value)}
                  required
                />
              </FormGroup>
            </Col>
            <Col md={6}>
              <FormGroup>
                <StyledLabel for="editEventTime">{t('shows.showTime')}</StyledLabel>
                <StyledInput
                  type="time"
                  id="editEventTime"
                  value={eventTime}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setEventTime(e.target.value)}
                />
              </FormGroup>
            </Col>
          </Row>

          <Row>
            <Col md={4}>
              <FormGroup>
                <StyledLabel for="editSoundcheckTime">{t('shows.soundcheck')}</StyledLabel>
                <StyledInput
                  type="time"
                  id="editSoundcheckTime"
                  value={soundcheckTime}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setSoundcheckTime(e.target.value)}
                />
              </FormGroup>
            </Col>
            <Col md={4}>
              <FormGroup>
                <StyledLabel for="editDoorsTime">{t('shows.doorsOpen')}</StyledLabel>
                <StyledInput
                  type="time"
                  id="editDoorsTime"
                  value={doorsTime}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setDoorsTime(e.target.value)}
                />
              </FormGroup>
            </Col>
          </Row>

          <Row>
            <Col md={6}>
              <FormGroup>
                <StyledLabel for="editVenue">{t('shows.venueName')}</StyledLabel>
                <StyledInput
                  type="text"
                  id="editVenue"
                  value={venue}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setVenue(e.target.value)}
                  placeholder={t('shows.placeholders.venue')}
                />
              </FormGroup>
            </Col>
            <Col md={6}>
              <FormGroup>
                <StyledLabel for="editVenueAddress">{t('shows.venueAddress')}</StyledLabel>
                <StyledInput
                  type="text"
                  id="editVenueAddress"
                  value={venueAddress}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setVenueAddress(e.target.value)}
                  placeholder={t('shows.placeholders.venueAddress')}
                />
              </FormGroup>
            </Col>
          </Row>

          <Row>
            <Col md={6}>
              <FormGroup>
                <StyledLabel for="editSetlistId">{t('shows.linkSetlist')}</StyledLabel>
                <StyledSelect
                  type="select"
                  id="editSetlistId"
                  value={setlistId}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setSetlistId(e.target.value)}
                >
                  <option value="">{t('shows.noSetlist')}</option>
                  {setlists.map((setlist) => (
                    <option key={setlist.id} value={setlist.id}>
                      {setlist.name} ({setlist.songs?.length || 0} {t('setlists.songs').toLowerCase()})
                    </option>
                  ))}
                </StyledSelect>
              </FormGroup>
            </Col>
            <Col md={6}>
              <FormGroup>
                <StyledLabel for="editStatus">{t('shows.status')}</StyledLabel>
                <StyledSelect
                  type="select"
                  id="editStatus"
                  value={status}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setStatus(e.target.value as ShowStatus)}
                >
                  <option value="upcoming">{t('shows.statusUpcoming')}</option>
                  <option value="completed">{t('shows.statusCompleted')}</option>
                  <option value="cancelled">{t('shows.statusCancelled')}</option>
                </StyledSelect>
              </FormGroup>
            </Col>
          </Row>

          <FormGroup>
            <StyledLabel for="editNotes">{t('shows.notes')}</StyledLabel>
            <StyledTextarea
              type="textarea"
              id="editNotes"
              value={notes}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setNotes(e.target.value)}
              placeholder={t('shows.placeholders.notesDetailed')}
              rows={3}
            />
          </FormGroup>
        </StyledModalBody>

        <StyledModalFooter>
          <CancelButton type="button" onClick={onClose}>
            {t('common.cancel')}
          </CancelButton>
          <SubmitButton type="submit" disabled={loading || !name.trim() || !eventDate}>
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

  &::-webkit-calendar-picker-indicator {
    filter: invert(1);
  }
`;

const StyledSelect = styled(Input)`
  background: var(--color-bg-tertiary) !important;
  border: 1px solid var(--color-border) !important;
  color: var(--color-text-primary) !important;
  border-radius: ${theme.radius.base} !important;
  padding: ${theme.space[3]} !important;
  font-size: ${theme.fontSizes.body} !important;

  &:focus {
    border-color: ${theme.colors.brand.primary} !important;
    box-shadow: 0 0 0 2px ${theme.colors.brand.primary}30 !important;
  }

  option {
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
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
