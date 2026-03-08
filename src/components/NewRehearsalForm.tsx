import type { FC, FormEvent, ChangeEvent } from "react";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Form, FormGroup, Label, Input, Button, Collapse, Row, Col } from "reactstrap";
import styled from "styled-components";
import { theme } from "../theme";
import { createRehearsal } from "../services/rehearsalsService";
import { getBandSetlists } from "../services/setlistsService";
import { getUpcomingShows } from "../services/showsService";
import { getLocalToday } from "../lib/dateUtils";
import type { Setlist } from "../services/setlistsService";
import type { Show } from "../services/showsService";

interface Props {
  bandId: number;
  onRehearsalCreated: () => void;
}

export const NewRehearsalForm: FC<Props> = ({ bandId, onRehearsalCreated }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [shows, setShows] = useState<Show[]>([]);

  // Get today's date for default and min validation
  const today = getLocalToday();

  // Form state
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [rehearsalDate, setRehearsalDate] = useState(today);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [showId, setShowId] = useState("");
  const [setlistId, setSetlistId] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (isOpen && bandId) {
      getBandSetlists(bandId).then(setSetlists).catch(console.error);
      getUpcomingShows(bandId).then(setShows).catch(console.error);
    }
  }, [isOpen, bandId]);

  // When a show is selected, auto-select its setlist if available
  useEffect(() => {
    if (showId) {
      const selectedShow = shows.find((s) => s.id === showId);
      if (selectedShow?.setlist_id) {
        setSetlistId(selectedShow.setlist_id);
      }
    }
  }, [showId, shows]);

  const resetForm = () => {
    setName("");
    setLocation("");
    setRehearsalDate(getLocalToday());
    setStartTime("");
    setEndTime("");
    setShowId("");
    setSetlistId("");
    setNotes("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!rehearsalDate) return;

    setLoading(true);
    try {
      await createRehearsal({
        band_id: bandId,
        name: name.trim() || undefined,
        location: location.trim() || undefined,
        rehearsal_date: rehearsalDate,
        start_time: startTime || undefined,
        end_time: endTime || undefined,
        show_id: showId || undefined,
        setlist_id: setlistId || undefined,
        notes: notes.trim() || undefined,
      });
      resetForm();
      setIsOpen(false);
      onRehearsalCreated();
    } catch (error) {
      console.error("Failed to create rehearsal:", error);
      alert(t('rehearsals.createError'));
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
          {t('rehearsals.scheduleNewRehearsal')}
        </AddButton>
      ) : (
        <FormCard>
          <FormHeader>
            <FormTitle>
              <i className="bi bi-calendar-plus"></i>
              {t('rehearsals.scheduleNewRehearsal')}
            </FormTitle>
            <CloseButton onClick={handleCancel} aria-label={t('common.closeForm')}>
              <i className="bi bi-x-lg"></i>
            </CloseButton>
          </FormHeader>

          <Collapse isOpen={isOpen}>
            <Form onSubmit={handleSubmit}>
              <FormBody>
                <Row>
                  <Col md={6}>
                    <FormGroup>
                      <StyledLabel for="rehearsalName">
                        {t('rehearsals.rehearsalName')}
                      </StyledLabel>
                      <StyledInput
                        type="text"
                        id="rehearsalName"
                        value={name}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                        placeholder={t('rehearsals.placeholders.name')}
                      />
                    </FormGroup>
                  </Col>
                  <Col md={6}>
                    <FormGroup>
                      <StyledLabel for="location">{t('rehearsals.location')}</StyledLabel>
                      <StyledInput
                        type="text"
                        id="location"
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
                      <StyledLabel for="rehearsalDate">
                        {t('rehearsals.date')} <Required>*</Required>
                      </StyledLabel>
                      <StyledInput
                        type="date"
                        id="rehearsalDate"
                        value={rehearsalDate}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setRehearsalDate(e.target.value)}
                        min={today}
                        required
                      />
                    </FormGroup>
                  </Col>
                  <Col md={4}>
                    <FormGroup>
                      <StyledLabel for="startTime">{t('rehearsals.startTime')}</StyledLabel>
                      <StyledInput
                        type="time"
                        id="startTime"
                        value={startTime}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setStartTime(e.target.value)}
                      />
                    </FormGroup>
                  </Col>
                  <Col md={4}>
                    <FormGroup>
                      <StyledLabel for="endTime">{t('rehearsals.endTime')}</StyledLabel>
                      <StyledInput
                        type="time"
                        id="endTime"
                        value={endTime}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setEndTime(e.target.value)}
                      />
                    </FormGroup>
                  </Col>
                </Row>

                <Row>
                  <Col md={6}>
                    <FormGroup>
                      <StyledLabel for="showId">{t('rehearsals.linkShow')}</StyledLabel>
                      <StyledSelect
                        type="select"
                        id="showId"
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
                      <FormHint>{t('rehearsals.linkShowHint')}</FormHint>
                    </FormGroup>
                  </Col>
                  <Col md={6}>
                    <FormGroup>
                      <StyledLabel for="setlistId">{t('rehearsals.linkSetlist')}</StyledLabel>
                      <StyledSelect
                        type="select"
                        id="setlistId"
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
                      <FormHint>{t('rehearsals.linkSetlistHint')}</FormHint>
                    </FormGroup>
                  </Col>
                </Row>

                <FormGroup>
                  <StyledLabel for="notes">{t('rehearsals.notes')}</StyledLabel>
                  <StyledTextarea
                    type="textarea"
                    id="notes"
                    value={notes}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setNotes(e.target.value)}
                    placeholder={t('rehearsals.placeholders.notes')}
                    rows={3}
                  />
                </FormGroup>
              </FormBody>

              <FormFooter>
                <CancelButton type="button" onClick={handleCancel}>
                  {t('common.cancel')}
                </CancelButton>
                <SubmitButton type="submit" disabled={loading || !rehearsalDate}>
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      {t('common.creating')}
                    </>
                  ) : (
                    <>
                      <i className="bi bi-calendar-plus me-2"></i>
                      {t('rehearsals.addRehearsal')}
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
