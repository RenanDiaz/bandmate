import type { FC, FormEvent, ChangeEvent } from "react";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Form, FormGroup, Label, Input, Button, Collapse, Row, Col } from "reactstrap";
import styled from "styled-components";
import { theme } from "../theme";
import { useToast } from "../context/useToast";
import { createShow } from "../services/showsService";
import { getBandSetlists } from "../services/setlistsService";
import { getLocalToday } from "../lib/dateUtils";
import type { Setlist } from "../services/setlistsService";

interface Props {
  bandId: number;
  onShowCreated: () => void;
}

export const NewShowForm: FC<Props> = ({ bandId, onShowCreated }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [setlists, setSetlists] = useState<Setlist[]>([]);

  // Get today's date for default and min validation
  const today = getLocalToday();

  // Form state
  const [name, setName] = useState("");
  const [venue, setVenue] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [eventDate, setEventDate] = useState(today);
  const [eventTime, setEventTime] = useState("");
  const [doorsTime, setDoorsTime] = useState("");
  const [soundcheckTime, setSoundcheckTime] = useState("");
  const [setlistId, setSetlistId] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (isOpen && bandId) {
      getBandSetlists(bandId).then(setSetlists).catch(console.error);
    }
  }, [isOpen, bandId]);

  const resetForm = () => {
    setName("");
    setVenue("");
    setVenueAddress("");
    setEventDate(getLocalToday());
    setEventTime("");
    setDoorsTime("");
    setSoundcheckTime("");
    setSetlistId("");
    setNotes("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !eventDate) return;

    setLoading(true);
    try {
      await createShow({
        band_id: bandId,
        name: name.trim(),
        venue: venue.trim() || undefined,
        venue_address: venueAddress.trim() || undefined,
        event_date: eventDate,
        event_time: eventTime || undefined,
        doors_time: doorsTime || undefined,
        soundcheck_time: soundcheckTime || undefined,
        setlist_id: setlistId || undefined,
        notes: notes.trim() || undefined,
      });
      resetForm();
      setIsOpen(false);
      onShowCreated();
    } catch (error) {
      console.error("Failed to create show:", error);
      toast.error(t('shows.createError'));
    }
    setLoading(false);
  };

  const handleCancel = () => {
    resetForm();
    setIsOpen(false);
  };

  return (
    <FormContainer>
      {!isOpen ? (
        <AddButton onClick={() => setIsOpen(true)}>
          <i className="bi bi-plus-circle"></i>
          {t('shows.scheduleNewShow')}
        </AddButton>
      ) : (
        <FormCard>
          <FormHeader>
            <FormTitle>
              <i className="bi bi-calendar-plus"></i>
              {t('shows.scheduleNewShow')}
            </FormTitle>
            <CloseButton onClick={handleCancel} aria-label={t('common.closeForm')}>
              <i className="bi bi-x-lg"></i>
            </CloseButton>
          </FormHeader>

          <Collapse isOpen={isOpen}>
            <Form onSubmit={handleSubmit}>
              <FormBody>
                <FormGroup>
                  <StyledLabel for="showName">
                    {t('shows.showName')} <Required>*</Required>
                  </StyledLabel>
                  <StyledInput
                    type="text"
                    id="showName"
                    value={name}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                    placeholder={t('shows.placeholders.nameParty')}
                    required
                  />
                </FormGroup>

                <Row>
                  <Col md={6}>
                    <FormGroup>
                      <StyledLabel for="eventDate">
                        {t('shows.date')} <Required>*</Required>
                      </StyledLabel>
                      <StyledInput
                        type="date"
                        id="eventDate"
                        value={eventDate}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setEventDate(e.target.value)}
                        min={today}
                        required
                      />
                    </FormGroup>
                  </Col>
                  <Col md={6}>
                    <FormGroup>
                      <StyledLabel for="eventTime">{t('shows.showTime')}</StyledLabel>
                      <StyledInput
                        type="time"
                        id="eventTime"
                        value={eventTime}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setEventTime(e.target.value)}
                      />
                    </FormGroup>
                  </Col>
                </Row>

                <Row>
                  <Col md={4}>
                    <FormGroup>
                      <StyledLabel for="soundcheckTime">{t('shows.soundcheck')}</StyledLabel>
                      <StyledInput
                        type="time"
                        id="soundcheckTime"
                        value={soundcheckTime}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setSoundcheckTime(e.target.value)}
                      />
                    </FormGroup>
                  </Col>
                  <Col md={4}>
                    <FormGroup>
                      <StyledLabel for="doorsTime">{t('shows.doorsOpen')}</StyledLabel>
                      <StyledInput
                        type="time"
                        id="doorsTime"
                        value={doorsTime}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setDoorsTime(e.target.value)}
                      />
                    </FormGroup>
                  </Col>
                  <Col md={4}>
                    <FormGroup>
                      <FormHint style={{ marginTop: '24px' }}>
                        {t('shows.soundcheck')} → {t('shows.doorsOpen')} → {t('shows.showTime')}
                      </FormHint>
                    </FormGroup>
                  </Col>
                </Row>

                <Row>
                  <Col md={6}>
                    <FormGroup>
                      <StyledLabel for="venue">{t('shows.venueName')}</StyledLabel>
                      <StyledInput
                        type="text"
                        id="venue"
                        value={venue}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setVenue(e.target.value)}
                        placeholder={t('shows.placeholders.venueFull')}
                      />
                    </FormGroup>
                  </Col>
                  <Col md={6}>
                    <FormGroup>
                      <StyledLabel for="venueAddress">{t('shows.venueAddress')}</StyledLabel>
                      <StyledInput
                        type="text"
                        id="venueAddress"
                        value={venueAddress}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setVenueAddress(e.target.value)}
                        placeholder={t('shows.placeholders.venueAddress')}
                      />
                    </FormGroup>
                  </Col>
                </Row>

                <FormGroup>
                  <StyledLabel for="setlistId">{t('shows.linkSetlist')}</StyledLabel>
                  <StyledSelect
                    type="select"
                    id="setlistId"
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
                  <FormHint>
                    {t('shows.linkSetlistHint')}
                  </FormHint>
                </FormGroup>

                <FormGroup>
                  <StyledLabel for="notes">{t('shows.notes')}</StyledLabel>
                  <StyledTextarea
                    type="textarea"
                    id="notes"
                    value={notes}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setNotes(e.target.value)}
                    placeholder={t('shows.placeholders.notesDetailed')}
                    rows={3}
                  />
                </FormGroup>
              </FormBody>

              <FormFooter>
                <CancelButton type="button" onClick={handleCancel}>
                  {t('common.cancel')}
                </CancelButton>
                <SubmitButton type="submit" disabled={loading || !name.trim() || !eventDate}>
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      {t('common.creating')}
                    </>
                  ) : (
                    <>
                      <i className="bi bi-calendar-plus me-2"></i>
                      {t('shows.addShow')}
                    </>
                  )}
                </SubmitButton>
              </FormFooter>
            </Form>
          </Collapse>
        </FormCard>
      )}
    </FormContainer>
  );
};

// Styled Components

const FormContainer = styled.div`
  margin-bottom: ${theme.space[4]};
`;

const AddButton = styled.button`
  width: 100%;
  padding: ${theme.space[4]};
  background: var(--color-bg-secondary);
  border: 2px dashed var(--color-border);
  border-radius: ${theme.radius.lg};
  color: var(--color-text-secondary);
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;
  transition: all ${theme.transitions.base} ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${theme.space[2]};

  i {
    font-size: ${theme.fontSizes.h3};
  }

  &:hover {
    background: var(--color-bg-tertiary);
    border-color: ${theme.colors.brand.primary};
    color: ${theme.colors.brand.primary};
  }
`;

const FormCard = styled.div`
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.lg};
  overflow: hidden;
`;

const FormHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${theme.space[4]};
  background: var(--color-bg-tertiary);
  border-bottom: 1px solid var(--color-border);
`;

const FormTitle = styled.h3`
  margin: 0;
  font-size: ${theme.fontSizes.h4};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};

  i {
    color: ${theme.colors.brand.primary};
  }
`;

const CloseButton = styled.button`
  background: transparent;
  border: none;
  color: var(--color-text-tertiary);
  font-size: ${theme.fontSizes.h4};
  cursor: pointer;
  padding: ${theme.space[1]};
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color ${theme.transitions.fast} ease;

  &:hover {
    color: var(--color-text-primary);
  }
`;

const FormBody = styled.div`
  padding: ${theme.space[4]};
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

const FormHint = styled.small`
  display: block;
  margin-top: ${theme.space[1]};
  font-size: ${theme.fontSizes.bodyXs};
  color: var(--color-text-tertiary);
`;

const FormFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${theme.space[3]};
  padding: ${theme.space[4]};
  background: var(--color-bg-tertiary);
  border-top: 1px solid var(--color-border);
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
