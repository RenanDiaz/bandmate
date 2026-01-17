import type { FC } from "react";
import { useEffect, useState } from "react";
import { Spinner, Container } from "reactstrap";
import styled from "styled-components";
import { theme } from "../theme";
import { useTranslation } from "react-i18next";
import {
  createBand,
  getMyBands,
  updateBand,
  deleteBand,
  type Band,
  type CreateBandInput,
  type UpdateBandInput,
} from "../services/bandsService";
import {
  getMyInvitations,
  acceptInvitation,
  declineInvitation,
  type BandInvitation,
} from "../services/bandMembersService";
import { BandList } from "./BandList";
import { NewBandForm } from "./NewBandForm";
import { EditBandModal } from "./EditBandModal";

interface Props {
  selectedBand?: Band;
  onSelect: (band: Band) => void;
}

export const BandSelector: FC<Props> = ({ onSelect, selectedBand }) => {
  const { t } = useTranslation();
  const [bands, setBands] = useState<Band[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingBand, setEditingBand] = useState<Band | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [invitations, setInvitations] = useState<BandInvitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(true);
  const [processingInvitationId, setProcessingInvitationId] = useState<string | null>(null);

  const loadBands = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMyBands();
      setBands(data);
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError("An unexpected error occurred.");
      }
    }
    setLoading(false);
  };

  const loadInvitations = async () => {
    setLoadingInvitations(true);
    try {
      const data = await getMyInvitations();
      setInvitations(data);
    } catch (error) {
      console.error("Failed to load invitations:", error);
    }
    setLoadingInvitations(false);
  };

  const handleBandCreated = async (input: CreateBandInput) => {
    try {
      await createBand(input);
      await loadBands();
    } catch (e: unknown) {
      if (e instanceof Error) {
        alert(`Failed to create band: ${e.message}`);
      } else {
        alert("Failed to create band. Please try again.");
      }
    }
  };

  const handleEditBand = (band: Band) => {
    setEditingBand(band);
    setIsEditModalOpen(true);
  };

  const handleSaveBand = async (bandId: number, updates: UpdateBandInput) => {
    await updateBand(bandId, updates);
    await loadBands();
    if (selectedBand?.id === bandId) {
      const updatedBand = bands.find((b) => b.id === bandId);
      if (updatedBand) {
        onSelect({ ...updatedBand, ...updates });
      }
    }
  };

  const handleDeleteBand = async (band: Band) => {
    const confirmed = window.confirm(
      t('bands.confirmDeleteBand', { name: band.name })
    );
    if (!confirmed) return;

    try {
      await deleteBand(band.id);
      if (selectedBand?.id === band.id) {
        onSelect(null as unknown as Band);
      }
      await loadBands();
    } catch (e: unknown) {
      if (e instanceof Error) {
        alert(`Failed to delete band: ${e.message}`);
      } else {
        alert("Failed to delete band. Please try again.");
      }
    }
  };

  const handleAcceptInvitation = async (invitation: BandInvitation) => {
    setProcessingInvitationId(invitation.id);
    try {
      await acceptInvitation(invitation.id);
      await loadInvitations();
      await loadBands();
    } catch (error: any) {
      console.error("Failed to accept invitation:", error);
      alert(error.message || "Failed to accept invitation");
    }
    setProcessingInvitationId(null);
  };

  const handleDeclineInvitation = async (invitation: BandInvitation) => {
    const confirmed = window.confirm(
      t('bands.declineInvitationConfirm')
    );
    if (!confirmed) return;

    setProcessingInvitationId(invitation.id);
    try {
      await declineInvitation(invitation.id);
      await loadInvitations();
    } catch (error) {
      console.error("Failed to decline invitation:", error);
      alert("Failed to decline invitation");
    }
    setProcessingInvitationId(null);
  };

  useEffect(() => {
    loadBands();
    loadInvitations();
  }, []);

  return (
    <SelectorWrapper>
      <Container>
        <SelectorHeader>
          <HeaderIcon>
            <i className="bi bi-music-note-beamed"></i>
          </HeaderIcon>
          <HeaderContent>
            <HeaderTitle>{t('bands.selectYourBand')}</HeaderTitle>
            <HeaderSubtitle>
              {t('bands.selectBandSubtitle')}
            </HeaderSubtitle>
          </HeaderContent>
        </SelectorHeader>

        <ContentSection>
          {/* Pending Invitations Section */}
          {!loadingInvitations && invitations.length > 0 && (
            <InvitationsSection>
              <InvitationsHeader>
                <InvitationsTitle>
                  <i className="bi bi-envelope-heart"></i>
                  {t('bands.pendingInvitations')}
                </InvitationsTitle>
                <InvitationsBadge>{invitations.length}</InvitationsBadge>
              </InvitationsHeader>
              <InvitationsList>
                {invitations.map((invitation) => {
                  const isProcessing = processingInvitationId === invitation.id;
                  const isExpired = new Date(invitation.expires_at) < new Date();

                  return (
                    <InvitationCard key={invitation.id} $expired={isExpired}>
                      <InvitationInfo>
                        <InvitationIcon>
                          <i className="bi bi-music-note-beamed"></i>
                        </InvitationIcon>
                        <InvitationDetails>
                          <InvitationBandName>
                            {invitation.band?.name || "Band Invitation"}
                          </InvitationBandName>
                          <InvitationMeta>
                            <i className="bi bi-person"></i>
                            {t('bands.invitedBy')} {invitation.inviter_name || t('bands.aBandMember')}
                          </InvitationMeta>
                          <InvitationRole>
                            {t('bands.role')}: <RoleBadge $role={invitation.role}>
                              {t(`bands.${invitation.role}`)}
                            </RoleBadge>
                          </InvitationRole>
                          {isExpired && <ExpiredLabel>{t('bands.expired')}</ExpiredLabel>}
                        </InvitationDetails>
                      </InvitationInfo>
                      <InvitationActions>
                        {!isExpired && (
                          <>
                            <AcceptButton
                              onClick={() => handleAcceptInvitation(invitation)}
                              disabled={isProcessing}
                            >
                              {isProcessing ? (
                                <Spinner size="sm" color="light" />
                              ) : (
                                <>
                                  <i className="bi bi-check-lg"></i>
                                  {t('bands.accept')}
                                </>
                              )}
                            </AcceptButton>
                            <DeclineButton
                              onClick={() => handleDeclineInvitation(invitation)}
                              disabled={isProcessing}
                            >
                              <i className="bi bi-x-lg"></i>
                            </DeclineButton>
                          </>
                        )}
                      </InvitationActions>
                    </InvitationCard>
                  );
                })}
              </InvitationsList>
            </InvitationsSection>
          )}

          <NewBandForm onBandCreated={handleBandCreated} />

          {loading ? (
            <LoadingContainer>
              <Spinner color="primary" style={{ width: '3rem', height: '3rem' }} />
              <LoadingText>{t('bands.loadingBands')}</LoadingText>
            </LoadingContainer>
          ) : error ? (
            <ErrorContainer>
              <ErrorIcon>
                <i className="bi bi-exclamation-circle"></i>
              </ErrorIcon>
              <ErrorText>{error}</ErrorText>
              <RetryButton onClick={loadBands}>
                <i className="bi bi-arrow-clockwise"></i>
                {t('bands.tryAgain')}
              </RetryButton>
            </ErrorContainer>
          ) : bands.length === 0 ? (
            <EmptyState>
              <EmptyIcon>
                <i className="bi bi-music-note-list"></i>
              </EmptyIcon>
              <EmptyTitle>{t('bands.noBandsYet')}</EmptyTitle>
              <EmptyText>
                {t('bands.noBandsYetDesc')}
              </EmptyText>
            </EmptyState>
          ) : (
            <BandList
              bands={bands}
              onSelect={onSelect}
              onEdit={handleEditBand}
              onDelete={handleDeleteBand}
              selectedBandId={selectedBand?.id}
            />
          )}
        </ContentSection>

        <EditBandModal
          band={editingBand}
          isOpen={isEditModalOpen}
          toggle={() => setIsEditModalOpen(false)}
          onSave={handleSaveBand}
        />
      </Container>
    </SelectorWrapper>
  );
};

// Styled Components

const SelectorWrapper = styled.div`
  min-height: calc(100vh - 80px);
  background: var(--color-bg-primary);
  padding: ${theme.space[8]} 0;

  @media (max-width: ${theme.breakpoints.md}) {
    padding: ${theme.space[6]} 0;
  }
`;

const SelectorHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[4]};
  margin-bottom: ${theme.space[8]};
  padding-bottom: ${theme.space[6]};
  border-bottom: 1px solid var(--color-border);

  @media (max-width: ${theme.breakpoints.md}) {
    flex-direction: column;
    text-align: center;
    gap: ${theme.space[3]};
  }
`;

const HeaderIcon = styled.div`
  width: 64px;
  height: 64px;
  background: ${theme.gradients.brandPrimary};
  border-radius: ${theme.radius.lg};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${theme.fontSizes.displayMd};
  color: white;
  flex-shrink: 0;
`;

const HeaderContent = styled.div`
  flex: 1;
`;

const HeaderTitle = styled.h1`
  font-size: ${theme.fontSizes.displayMd};
  font-weight: ${theme.fontWeights.bold};
  color: var(--color-text-primary);
  margin-bottom: ${theme.space[2]};
  line-height: ${theme.lineHeights.tight};

  @media (max-width: ${theme.breakpoints.md}) {
    font-size: ${theme.fontSizes.h1};
  }
`;

const HeaderSubtitle = styled.p`
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-secondary);
  margin: 0;
  line-height: ${theme.lineHeights.relaxed};
`;

const ContentSection = styled.div`
  max-width: 800px;
  margin: 0 auto;
`;

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${theme.space[12]} 0;
  gap: ${theme.space[4]};
`;

const LoadingText = styled.p`
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-secondary);
  margin: 0;
`;

const ErrorContainer = styled.div`
  background: ${theme.colors.semantic.errorBgDark};
  border: 1px solid ${theme.colors.semantic.error};
  border-radius: ${theme.radius.lg};
  padding: ${theme.space[8]};
  text-align: center;
  margin-top: ${theme.space[6]};
`;

const ErrorIcon = styled.div`
  font-size: ${theme.fontSizes.displayMd};
  color: ${theme.colors.semantic.error};
  margin-bottom: ${theme.space[3]};
`;

const ErrorText = styled.p`
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-primary);
  margin-bottom: ${theme.space[4]};
`;

const RetryButton = styled.button`
  background: ${theme.colors.brand.primary};
  color: white;
  border: none;
  padding: ${theme.space[3]} ${theme.space[6]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[2]};

  &:hover {
    background: ${theme.colors.brand.primaryHover};
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: ${theme.space[12]} ${theme.space[6]};
  background: var(--color-bg-secondary);
  border: 1px dashed var(--color-border);
  border-radius: ${theme.radius.lg};
  margin-top: ${theme.space[6]};
`;

const EmptyIcon = styled.div`
  font-size: ${theme.fontSizes.displayLg};
  color: var(--color-text-tertiary);
  margin-bottom: ${theme.space[4]};
  opacity: 0.5;
`;

const EmptyTitle = styled.h3`
  font-size: ${theme.fontSizes.h2};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin-bottom: ${theme.space[2]};
`;

const EmptyText = styled.p`
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-secondary);
  margin: 0;
  line-height: ${theme.lineHeights.relaxed};
`;

// Invitations Styled Components

const InvitationsSection = styled.div`
  background: var(--color-bg-secondary);
  border: 2px solid ${theme.colors.brand.primary};
  border-radius: ${theme.radius.lg};
  overflow: hidden;
  margin-bottom: ${theme.space[6]};
`;

const InvitationsHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${theme.space[4]} ${theme.space[5]};
  background: var(--color-bg-elevated);
  border-bottom: 1px solid var(--color-border);
`;

const InvitationsTitle = styled.h3`
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};

  i {
    color: ${theme.colors.brand.primary};
    font-size: ${theme.fontSizes.h4};
  }
`;

const InvitationsBadge = styled.div`
  background: ${theme.colors.brand.primary};
  color: white;
  min-width: 24px;
  height: 24px;
  border-radius: ${theme.radius.full};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.bold};
  padding: 0 ${theme.space[2]};
`;

const InvitationsList = styled.div`
  padding: ${theme.space[3]};
  display: flex;
  flex-direction: column;
  gap: ${theme.space[2]};
`;

const InvitationCard = styled.div<{ $expired: boolean }>`
  background: var(--color-bg-primary);
  border: 1px solid ${(props) =>
    props.$expired ? 'var(--color-border)' : theme.colors.brand.primary};
  border-radius: ${theme.radius.base};
  padding: ${theme.space[3]};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${theme.space[3]};
  opacity: ${(props) => (props.$expired ? 0.5 : 1)};

  @media (max-width: ${theme.breakpoints.sm}) {
    flex-direction: column;
    align-items: flex-start;
  }
`;

const InvitationInfo = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  flex: 1;
`;

const InvitationIcon = styled.div`
  width: 40px;
  height: 40px;
  border-radius: ${theme.radius.full};
  background: ${theme.gradients.brandPrimary};
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${theme.fontSizes.h4};
  flex-shrink: 0;
`;

const InvitationDetails = styled.div`
  flex: 1;
`;

const InvitationBandName = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin-bottom: ${theme.space[1]};
`;

const InvitationMeta = styled.div`
  font-size: ${theme.fontSizes.bodyXs};
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  gap: ${theme.space[1]};
  margin-bottom: ${theme.space[1]};

  i {
    font-size: ${theme.fontSizes.bodyXs};
  }
`;

const InvitationRole = styled.div`
  font-size: ${theme.fontSizes.bodyXs};
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
`;

const RoleBadge = styled.span<{ $role: string }>`
  background: ${(props) =>
    props.$role === "member"
      ? 'var(--color-bg-tertiary)'
      : theme.colors.semantic.warningBgDark};
  color: ${(props) =>
    props.$role === "member"
      ? theme.colors.brand.primary
      : theme.colors.semantic.warning};
  padding: ${theme.space[1]} ${theme.space[2]};
  border-radius: ${theme.radius.sm};
  font-weight: ${theme.fontWeights.semibold};
  font-size: ${theme.fontSizes.bodyXs};
`;

const ExpiredLabel = styled.span`
  display: inline-block;
  background: ${theme.colors.semantic.errorBgDark};
  color: ${theme.colors.semantic.error};
  padding: ${theme.space[1]} ${theme.space[2]};
  border-radius: ${theme.radius.sm};
  font-weight: ${theme.fontWeights.semibold};
  font-size: ${theme.fontSizes.bodyXs};
  margin-top: ${theme.space[1]};
`;

const InvitationActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};

  @media (max-width: ${theme.breakpoints.sm}) {
    width: 100%;
  }
`;

const AcceptButton = styled.button`
  background: ${theme.colors.brand.primary};
  border: none;
  color: white;
  padding: ${theme.space[2]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};

  &:hover:not(:disabled) {
    background: ${theme.colors.brand.primaryHover};
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const DeclineButton = styled.button`
  background: transparent;
  border: 1px solid var(--color-border);
  color: ${theme.colors.semantic.error};
  padding: ${theme.space[2]} ${theme.space[3]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  display: flex;
  align-items: center;
  gap: ${theme.space[1]};

  &:hover:not(:disabled) {
    background: ${theme.colors.semantic.errorBgDark};
    border-color: ${theme.colors.semantic.error};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;
