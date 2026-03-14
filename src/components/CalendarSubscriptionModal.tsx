import type { FC } from "react";
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Modal, ModalHeader, ModalBody, Spinner } from "reactstrap";
import styled from "styled-components";
import { theme } from "../theme";
import {
  getCalendarSubscription,
  createCalendarSubscription,
  regenerateSubscriptionToken,
  deleteCalendarSubscription,
  getCalendarFeedUrl,
} from "../services/calendarSubscriptionService";
import type { CalendarSubscription } from "../services/calendarSubscriptionService";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  bandId: number;
  bandName: string;
}

export const CalendarSubscriptionModal: FC<Props> = ({
  isOpen,
  onClose,
  bandId,
  bandName,
}) => {
  const { t } = useTranslation();
  const [subscription, setSubscription] =
    useState<CalendarSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadSubscription = useCallback(async () => {
    setLoading(true);
    try {
      const sub = await getCalendarSubscription(bandId);
      setSubscription(sub);
    } catch (err) {
      console.error("Failed to load subscription:", err);
    }
    setLoading(false);
  }, [bandId]);

  useEffect(() => {
    if (isOpen) {
      loadSubscription();
    }
  }, [isOpen, loadSubscription]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const sub = await createCalendarSubscription(bandId);
      setSubscription(sub);
    } catch (err) {
      console.error("Failed to create subscription:", err);
      alert(t("calendar.createError"));
    }
    setCreating(false);
  };

  const handleRegenerate = async () => {
    if (!subscription) return;
    const confirmed = window.confirm(t("calendar.regenerateConfirm"));
    if (!confirmed) return;

    try {
      const updated = await regenerateSubscriptionToken(subscription.id);
      setSubscription(updated);
    } catch (err) {
      console.error("Failed to regenerate token:", err);
    }
  };

  const handleDelete = async () => {
    if (!subscription) return;
    const confirmed = window.confirm(t("calendar.deleteConfirm"));
    if (!confirmed) return;

    try {
      await deleteCalendarSubscription(subscription.id);
      setSubscription(null);
    } catch (err) {
      console.error("Failed to delete subscription:", err);
    }
  };

  const handleCopy = async () => {
    if (!subscription) return;
    const url = getCalendarFeedUrl(subscription.token);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const feedUrl = subscription ? getCalendarFeedUrl(subscription.token) : "";

  return (
    <Modal isOpen={isOpen} toggle={onClose} centered>
      <StyledModalHeader toggle={onClose}>
        <i className="bi bi-calendar-plus me-2"></i>
        {t("calendar.title")}
      </StyledModalHeader>
      <ModalBody>
        {loading ? (
          <LoadingContainer>
            <Spinner color="primary" />
          </LoadingContainer>
        ) : subscription ? (
          <SubscriptionContent>
            <Description>{t("calendar.subscriptionActive")}</Description>

            <UrlSection>
              <UrlLabel>{t("calendar.feedUrl")}</UrlLabel>
              <UrlBox>
                <UrlText>{feedUrl}</UrlText>
                <CopyButton onClick={handleCopy}>
                  <i className={`bi ${copied ? "bi-check-lg" : "bi-clipboard"}`}></i>
                  {copied ? t("calendar.copied") : t("calendar.copy")}
                </CopyButton>
              </UrlBox>
            </UrlSection>

            <InstructionsSection>
              <InstructionsTitle>
                {t("calendar.howToSubscribe")}
              </InstructionsTitle>
              <InstructionsList>
                <li>
                  <strong>Google Calendar:</strong>{" "}
                  {t("calendar.instructionsGoogle")}
                </li>
                <li>
                  <strong>Apple Calendar:</strong>{" "}
                  {t("calendar.instructionsApple")}
                </li>
                <li>
                  <strong>Outlook:</strong>{" "}
                  {t("calendar.instructionsOutlook")}
                </li>
              </InstructionsList>
            </InstructionsSection>

            <InfoNote>
              <i className="bi bi-info-circle me-2"></i>
              {t("calendar.refreshNote")}
            </InfoNote>

            <ActionRow>
              <SecondaryButton onClick={handleRegenerate}>
                <i className="bi bi-arrow-clockwise me-1"></i>
                {t("calendar.regenerateToken")}
              </SecondaryButton>
              <DangerButton onClick={handleDelete}>
                <i className="bi bi-trash me-1"></i>
                {t("calendar.removeSubscription")}
              </DangerButton>
            </ActionRow>
          </SubscriptionContent>
        ) : (
          <CreateContent>
            <CreateIcon>
              <i className="bi bi-calendar2-heart"></i>
            </CreateIcon>
            <CreateTitle>{t("calendar.noSubscription")}</CreateTitle>
            <CreateDescription>
              {t("calendar.noSubscriptionDesc", { bandName })}
            </CreateDescription>
            <CreateButton onClick={handleCreate} disabled={creating}>
              {creating ? (
                <>
                  <Spinner size="sm" className="me-2" />
                  {t("common.creating")}
                </>
              ) : (
                <>
                  <i className="bi bi-link-45deg me-2"></i>
                  {t("calendar.generateLink")}
                </>
              )}
            </CreateButton>
          </CreateContent>
        )}
      </ModalBody>
    </Modal>
  );
};

const StyledModalHeader = styled(ModalHeader)`
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);

  .btn-close {
    filter: invert(1) grayscale(100%) brightness(200%);
  }
`;

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  padding: ${theme.space[8]};
`;

const SubscriptionContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[4]};
`;

const Description = styled.p`
  margin: 0;
  color: var(--color-text-secondary);
  font-size: ${theme.fontSizes.body};
`;

const UrlSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[2]};
`;

const UrlLabel = styled.label`
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: ${theme.letterSpacing.wide};
`;

const UrlBox = styled.div`
  display: flex;
  gap: ${theme.space[2]};
  align-items: stretch;

  @media (max-width: ${theme.breakpoints.sm}) {
    flex-direction: column;
  }
`;

const UrlText = styled.code`
  flex: 1;
  padding: ${theme.space[3]};
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodyXs};
  color: var(--color-text-primary);
  word-break: break-all;
  line-height: ${theme.lineHeights.relaxed};
`;

const CopyButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${theme.space[1]};
  padding: ${theme.space[2]} ${theme.space[3]};
  background: ${theme.colors.brand.primary};
  color: white;
  border: none;
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;
  white-space: nowrap;
  transition: background ${theme.transitions.fast} ease;

  &:hover {
    background: ${theme.colors.brand.primary}dd;
  }
`;

const InstructionsSection = styled.div`
  background: var(--color-bg-tertiary);
  border-radius: ${theme.radius.base};
  padding: ${theme.space[4]};
`;

const InstructionsTitle = styled.h4`
  margin: 0 0 ${theme.space[3]} 0;
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
`;

const InstructionsList = styled.ol`
  margin: 0;
  padding-left: ${theme.space[4]};
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
  line-height: ${theme.lineHeights.relaxed};
  display: flex;
  flex-direction: column;
  gap: ${theme.space[2]};
`;

const InfoNote = styled.div`
  font-size: ${theme.fontSizes.bodyXs};
  color: var(--color-text-tertiary);
  display: flex;
  align-items: flex-start;

  i {
    color: ${theme.colors.accent.amber};
    flex-shrink: 0;
    margin-top: 2px;
  }
`;

const ActionRow = styled.div`
  display: flex;
  gap: ${theme.space[2]};
  justify-content: flex-end;
  padding-top: ${theme.space[2]};
  border-top: 1px solid var(--color-border);

  @media (max-width: ${theme.breakpoints.sm}) {
    flex-direction: column;
  }
`;

const SecondaryButton = styled.button`
  padding: ${theme.space[2]} ${theme.space[3]};
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.base};
  color: var(--color-text-secondary);
  font-size: ${theme.fontSizes.bodySm};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  &:hover {
    border-color: ${theme.colors.brand.primary};
    color: ${theme.colors.brand.primary};
  }
`;

const DangerButton = styled.button`
  padding: ${theme.space[2]} ${theme.space[3]};
  background: ${theme.colors.semantic.errorBgDark};
  border: 1px solid ${theme.colors.semantic.error}40;
  border-radius: ${theme.radius.base};
  color: ${theme.colors.semantic.error};
  font-size: ${theme.fontSizes.bodySm};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  &:hover {
    background: ${theme.colors.semantic.error}30;
  }
`;

const CreateContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: ${theme.space[4]} 0;
  gap: ${theme.space[3]};
`;

const CreateIcon = styled.div`
  font-size: ${theme.fontSizes.displayLg};
  color: ${theme.colors.brand.primary};
`;

const CreateTitle = styled.h3`
  margin: 0;
  font-size: ${theme.fontSizes.h3};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
`;

const CreateDescription = styled.p`
  margin: 0;
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-secondary);
  max-width: 400px;
  line-height: ${theme.lineHeights.relaxed};
`;

const CreateButton = styled.button`
  display: flex;
  align-items: center;
  padding: ${theme.space[3]} ${theme.space[5]};
  background: ${theme.colors.brand.primary};
  color: white;
  border: none;
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  cursor: pointer;
  transition: background ${theme.transitions.fast} ease;
  margin-top: ${theme.space[2]};

  &:hover:not(:disabled) {
    background: ${theme.colors.brand.primary}dd;
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;
