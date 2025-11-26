import type { FC } from "react";
import { useEffect, useState } from "react";
import { Spinner } from "reactstrap";
import styled from "styled-components";
import { theme } from "../theme";
import {
  getMyInvitations,
  acceptInvitation,
  declineInvitation,
} from "../services/bandMembersService";
import type { BandInvitation } from "../services/bandMembersService";

interface Props {
  onInvitationAccepted?: () => void;
}

export const PendingInvitations: FC<Props> = ({ onInvitationAccepted }) => {
  const [invitations, setInvitations] = useState<BandInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    loadInvitations();
  }, []);

  const loadInvitations = async () => {
    setLoading(true);
    try {
      const data = await getMyInvitations();
      setInvitations(data);
    } catch (error) {
      console.error("Failed to load invitations:", error);
    }
    setLoading(false);
  };

  const handleAccept = async (invitation: BandInvitation) => {
    setProcessingId(invitation.id);
    try {
      await acceptInvitation(invitation.id);
      await loadInvitations();
      onInvitationAccepted?.();
    } catch (error: any) {
      console.error("Failed to accept invitation:", error);
      alert(error.message || "Failed to accept invitation");
    }
    setProcessingId(null);
  };

  const handleDecline = async (invitation: BandInvitation) => {
    const confirmed = window.confirm(
      "Are you sure you want to decline this invitation?"
    );
    if (!confirmed) return;

    setProcessingId(invitation.id);
    try {
      await declineInvitation(invitation.id);
      await loadInvitations();
    } catch (error) {
      console.error("Failed to decline invitation:", error);
      alert("Failed to decline invitation");
    }
    setProcessingId(null);
  };

  if (loading) {
    return (
      <Container>
        <LoadingContainer>
          <Spinner color="primary" />
          <p>Loading invitations...</p>
        </LoadingContainer>
      </Container>
    );
  }

  if (invitations.length === 0) {
    return null; // Don't show anything if there are no invitations
  }

  return (
    <Container>
      <Header>
        <Title>
          <i className="bi bi-envelope"></i>
          Pending Band Invitations
        </Title>
        <Badge>{invitations.length}</Badge>
      </Header>

      <InvitationsList>
        {invitations.map((invitation) => {
          const isProcessing = processingId === invitation.id;
          const isExpired = new Date(invitation.expires_at) < new Date();

          return (
            <InvitationCard key={invitation.id} $expired={isExpired}>
              <InvitationInfo>
                <InvitationIcon>
                  <i className="bi bi-music-note-beamed"></i>
                </InvitationIcon>
                <InvitationDetails>
                  <InvitationTitle>
                    {invitation.band?.name || "Band Invitation"}
                  </InvitationTitle>
                  <InvitationMeta>
                    <i className="bi bi-person"></i>
                    Invited by {invitation.inviter_name || "A band member"}
                  </InvitationMeta>
                  <InvitationMeta>
                    Role:{" "}
                    <RoleBadge $role={invitation.role}>
                      {invitation.role.charAt(0).toUpperCase() +
                        invitation.role.slice(1)}
                    </RoleBadge>
                  </InvitationMeta>
                  <InvitationMeta>
                    <i className="bi bi-calendar"></i>
                    Expires: {new Date(invitation.expires_at).toLocaleDateString()}
                    {isExpired && <ExpiredBadge>Expired</ExpiredBadge>}
                  </InvitationMeta>
                </InvitationDetails>
              </InvitationInfo>

              <InvitationActions>
                {!isExpired && (
                  <>
                    <AcceptButton
                      onClick={() => handleAccept(invitation)}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <Spinner size="sm" />
                      ) : (
                        <>
                          <i className="bi bi-check-lg"></i>
                          Accept
                        </>
                      )}
                    </AcceptButton>
                    <DeclineButton
                      onClick={() => handleDecline(invitation)}
                      disabled={isProcessing}
                    >
                      <i className="bi bi-x-lg"></i>
                      Decline
                    </DeclineButton>
                  </>
                )}
                {isExpired && <ExpiredText>This invitation has expired</ExpiredText>}
              </InvitationActions>
            </InvitationCard>
          );
        })}
      </InvitationsList>
    </Container>
  );
};

// Styled Components

const Container = styled.div`
  background: ${theme.colors.dark.bg.secondary};
  border: 1px solid ${theme.colors.brand.primary};
  border-radius: ${theme.radius.lg};
  overflow: hidden;
  margin-bottom: ${theme.space[6]};
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${theme.space[4]} ${theme.space[5]};
  background: ${theme.colors.dark.bg.elevated};
  border-bottom: 1px solid ${theme.colors.dark.border.default};
`;

const Title = styled.h3`
  font-size: ${theme.fontSizes.h4};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.dark.text.primary};
  margin: 0;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};

  i {
    color: ${theme.colors.brand.primary};
    font-size: ${theme.fontSizes.h3};
  }
`;

const Badge = styled.div`
  background: ${theme.colors.brand.primary};
  color: white;
  width: 28px;
  height: 28px;
  border-radius: ${theme.radius.full};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.bold};
`;

const InvitationsList = styled.div`
  padding: ${theme.space[4]};
  display: flex;
  flex-direction: column;
  gap: ${theme.space[3]};
`;

const InvitationCard = styled.div<{ $expired: boolean }>`
  background: ${theme.colors.dark.bg.primary};
  border: 1px solid
    ${(props) =>
      props.$expired
        ? theme.colors.dark.border.default
        : theme.colors.brand.primary};
  border-radius: ${theme.radius.base};
  padding: ${theme.space[4]};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${theme.space[4]};
  opacity: ${(props) => (props.$expired ? 0.6 : 1)};

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
  width: 48px;
  height: 48px;
  border-radius: ${theme.radius.full};
  background: ${theme.gradients.brandPrimary};
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${theme.fontSizes.h3};
  flex-shrink: 0;
`;

const InvitationDetails = styled.div`
  flex: 1;
`;

const InvitationTitle = styled.div`
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.dark.text.primary};
  margin-bottom: ${theme.space[1]};
`;

const InvitationMeta = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.dark.text.secondary};
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  margin-top: ${theme.space[1]};

  i {
    font-size: ${theme.fontSizes.bodyXs};
  }
`;

const RoleBadge = styled.span<{ $role: string }>`
  background: ${(props) =>
    props.$role === "member"
      ? theme.colors.dark.bg.tertiary
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

const ExpiredBadge = styled.span`
  background: ${theme.colors.semantic.errorBgDark};
  color: ${theme.colors.semantic.error};
  padding: ${theme.space[1]} ${theme.space[2]};
  border-radius: ${theme.radius.sm};
  font-weight: ${theme.fontWeights.semibold};
  font-size: ${theme.fontSizes.bodyXs};
  text-transform: uppercase;
  letter-spacing: ${theme.letterSpacing.wide};
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
  font-size: ${theme.fontSizes.bodySm};
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
  border: 1px solid ${theme.colors.dark.border.default};
  color: ${theme.colors.semantic.error};
  padding: ${theme.space[2]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};

  &:hover:not(:disabled) {
    background: ${theme.colors.semantic.errorBgDark};
    border-color: ${theme.colors.semantic.error};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const ExpiredText = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.dark.text.tertiary};
  font-style: italic;
`;

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${theme.space[4]};
  padding: ${theme.space[8]};

  p {
    font-size: ${theme.fontSizes.body};
    color: ${theme.colors.dark.text.secondary};
    margin: 0;
  }
`;
