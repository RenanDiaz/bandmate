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
import { updateRehearsal } from "../services/rehearsalsService";
import type { Rehearsal, RehearsalStatus } from "../services/rehearsalsService";
import { getBandSetlists } from "../services/setlistsService";
import { getBandShows } from "../services/showsService";
import type { Setlist } from "../services/setlistsService";
import type { Show } from "../services/showsService";

interface Props {
  rehearsal: Rehearsal | null;
  isOpen: boolean;
  onClose: () => void;
  onReload: () => void;
  bandId: number;
}

export const EditRehearsalModal: FC<Props> = ({ rehearsal, isOpen, onClose, onReload, bandId }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [shows, setShows] = useState<Show[]>([]);

  // Form state
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [rehearsalDate, setRehearsalDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [showId, setShowId] = useState("");
  const [setlistId, setSetlistId] = useState("");
  const [status, setStatus] = useState<RehearsalStatus>("scheduled");
  const [notes, setNotes] = useState("");

  // Load rehearsal data when modal opens
  useEffect(() => {
    if (rehearsal && isOpen) {
      setName(rehearsal.name || "");
      setLocation(rehearsal.location || "");
      setRehearsalDate(rehearsal.rehearsal_date || "");
      setStartTime(rehearsal.start_time || "");
      setEndTime(rehearsal.end_time || "");
      setShowId(rehearsal.show_id || "");
      setSetlistId(rehearsal.setlist_id || "");
      setStatus(rehearsal.status || "scheduled");
      setNotes(rehearsal.notes || "");

      // Load setlists and shows for dropdowns
      getBandSetlists(bandId).then(setSetlists).catch(console.error);
      getBandShows(bandId).then(setShows).catch(console.error);
    }
  }, [rehearsal, isOpen, bandId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!rehearsal || !rehearsalDate) return;

    setLoading(true);
    try {
      await updateRehearsal(rehearsal.id, {
        name: name.trim() || undefined,
        location: location.trim() || undefined,
        rehearsal_date: rehearsalDate,
        start_time: startTime || undefined,
        end_time: endTime || undefined,
        show_id: showId || null,
        setlist_id: setlistId || null,
        status,
        notes: notes.trim() || undefined,
      });
      onClose();
      onReload();
    } catch (error) {
      console.error("Failed to update rehearsal:", error);
      alert(t('rehearsals.updateError'));
    }
    setLoading(false);
  };

  if (!rehearsal) return null;

  return (
    <StyledModal isOpen={isOpen} toggle={onClose} size="lg" centered>
      <StyledModalHeader toggle={onClose}>
        <i className="bi bi-calendar-check me-2"></i>
        {t('rehearsals.editRehearsal')}
      </StyledModalHeader>

      <Form onSubmit={handleSubmit}>
        <StyledModalBody>
          <Row>
            <Col md={6}>
              <FormGroup>
                <StyledLabel for="editRehearsalName">
                  {t('rehearsals.rehearsalName')}
                </StyledLabel>
                <StyledInput
                  type="text"
                  id="editRehearsalName"
                  value={name}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                  placeholder={t('rehearsals.placeholders.name')}
                />
              </FormGroup>
            </Col>
            <Col md={6}>
              <FormGroup>
                <StyledLabel for="editLocation">{t('rehearsals.location')}</StyledLabel>
                <StyledInput
                  type="text"
                  id="editLocation"
                  value={location}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setLocation(e.target.value)}
                  placeholder={t('rehearsals.placeholders.location')}
                />
              </FormGroup>
            </Col>
          </Row>

          <Row>
            <Col md={4}>
              <FormGroup>
                <StyledLabel for="editRehearsalDate">
                  {t('rehearsals.date')} <Required>*</Required>
                </StyledLabel>
                <StyledInput
                  type="date"
                  id="editRehearsalDate"
                  value={rehearsalDate}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setRehearsalDate(e.target.value)}
                  required
                />
              </FormGroup>
            </Col>
            <Col md={4}>
              <FormGroup>
                <StyledLabel for="editStartTime">{t('rehearsals.startTime')}</StyledLabel>
                <StyledInput
                  type="time"
                  id="editStartTime"
                  value={startTime}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setStartTime(e.target.value)}
                />
              </FormGroup>
            </Col>
            <Col md={4}>
              <FormGroup>
                <StyledLabel for="editEndTime">{t('rehearsals.endTime')}</StyledLabel>
                <StyledInput
                  type="time"
                  id="editEndTime"
                  value={endTime}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setEndTime(e.target.value)}
                />
              </FormGroup>
            </Col>
          </Row>

          <Row>
            <Col md={6}>
              <FormGroup>
                <StyledLabel for="editShowId">{t('rehearsals.linkShow')}</StyledLabel>
                <StyledSelect
                  type="select"
                  id="editShowId"
                  value={showId}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setShowId(e.target.value)}
                >
                  <option value="">{t('rehearsals.noShow')}</option>
                  {shows.map((show) => (
                    <option key={show.id} value={show.id}>
                      {show.name} ({show.event_date})
                    </option>
                  ))}
                </StyledSelect>
              </FormGroup>
            </Col>
            <Col md={6}>
              <FormGroup>
                <StyledLabel for="editSetlistId">{t('rehearsals.linkSetlist')}</StyledLabel>
                <StyledSelect
                  type="select"
                  id="editSetlistId"
                  value={setlistId}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setSetlistId(e.target.value)}
                >
                  <option value="">{t('rehearsals.noSetlist')}</option>
                  {setlists.map((setlist) => (
                    <option key={setlist.id} value={setlist.id}>
                      {setlist.name} ({setlist.songs?.length || 0} {t('setlists.songs').toLowerCase()})
                    </option>
                  ))}
                </StyledSelect>
              </FormGroup>
            </Col>
          </Row>

          <FormGroup>
            <StyledLabel for="editStatus">{t('rehearsals.status')}</StyledLabel>
            <StyledSelect
              type="select"
              id="editStatus"
              value={status}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setStatus(e.target.value as RehearsalStatus)}
            >
              <option value="scheduled">{t('rehearsals.statusScheduled')}</option>
              <option value="completed">{t('rehearsals.statusCompleted')}</option>
              <option value="cancelled">{t('rehearsals.statusCancelled')}</option>
            </StyledSelect>
          </FormGroup>

          <FormGroup>
            <StyledLabel for="editNotes">{t('rehearsals.notes')}</StyledLabel>
            <StyledTextarea
              type="textarea"
              id="editNotes"
              value={notes}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setNotes(e.target.value)}
              placeholder={t('rehearsals.placeholders.notes')}
              rows={3}
            />
          </FormGroup>
        </StyledModalBody>

        <StyledModalFooter>
          <CancelButton type="button" onClick={onClose}>
            {t('common.cancel')}
          </CancelButton>
          <SubmitButton type="submit" disabled={loading || !rehearsalDate}>
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
