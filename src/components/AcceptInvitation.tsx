import type { FC } from "react";
import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Container, Spinner } from "reactstrap";
import styled from "styled-components";
import { theme } from "../theme";
import {
  getInvitationByToken,
  acceptInvitation,
} from "../services/bandMembersService";
import type { BandInvitation } from "../services/bandMembersService";

export const AcceptInvitation: FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [invitation, setInvitation] = useState<BandInvitation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadInvitation();
  }, [token]);

  const loadInvitation = async () => {
    if (!token) {
      setError("Invalid invitation link - missing token");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const invite = await getInvitationByToken(token);
      if (!invite) {
        setError("Invitation not found or has already been used");
      } else if (new Date(invite.expires_at) < new Date()) {
        setError("This invitation has expired");
      } else {
        setInvitation(invite);
      }
    } catch (err) {
      console.error("Failed to load invitation:", err);
      setError("Failed to load invitation. Please try again.");
    }
    setLoading(false);
  };

  const handleAccept = async () => {
    if (!invitation) return;

    setAccepting(true);
    try {
      await acceptInvitation(invitation.id);
      setSuccess(true);
      setTimeout(() => {
        navigate("/");
      }, 2000);
    } catch (err: any) {
      console.error("Failed to accept invitation:", err);
      setError(err.message || "Failed to accept invitation. Please try again.");
    }
    setAccepting(false);
  };

  const handleDecline = () => {
    navigate("/");
  };

  if (loading) {
    return (
      <PageWrapper>
        <Container>
          <Card>
            <LoadingContainer>
              <Spinner color="primary" style={{ width: "3rem", height: "3rem" }} />
              <LoadingText>Loading invitation...</LoadingText>
            </LoadingContainer>
          </Card>
        </Container>
      </PageWrapper>
    );
  }

  if (error) {
    return (
      <PageWrapper>
        <Container>
          <Card>
            <Icon $type="error">
              <i className="bi bi-exclamation-triangle"></i>
            </Icon>
            <Title>Invitation Error</Title>
            <Message>{error}</Message>
            <Actions>
              <SecondaryButton onClick={() => navigate("/")}>
                Go to Home
              </SecondaryButton>
            </Actions>
          </Card>
        </Container>
      </PageWrapper>
    );
  }

  if (success) {
    return (
      <PageWrapper>
        <Container>
          <Card>
            <Icon $type="success">
              <i className="bi bi-check-circle"></i>
            </Icon>
            <Title>Invitation Accepted!</Title>
            <Message>You've successfully joined the band. Redirecting...</Message>
          </Card>
        </Container>
      </PageWrapper>
    );
  }

  if (!invitation) {
    return (
      <PageWrapper>
        <Container>
          <Card>
            <Icon $type="error">
              <i className="bi bi-exclamation-triangle"></i>
            </Icon>
            <Title>Invitation Not Found</Title>
            <Message>This invitation link is invalid or has been used.</Message>
            <Actions>
              <SecondaryButton onClick={() => navigate("/")}>
                Go to Home
              </SecondaryButton>
            </Actions>
          </Card>
        </Container>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <Container>
        <Card>
          <Icon $type="invite">
            <i className="bi bi-envelope-open"></i>
          </Icon>
          <Title>Band Invitation</Title>
          <Message>
            You've been invited to join a band as a{" "}
            <RoleBadge $role={invitation.role}>
              {invitation.role.charAt(0).toUpperCase() + invitation.role.slice(1)}
            </RoleBadge>
          </Message>

          <InvitationDetails>
            <DetailRow>
              <DetailLabel>
                <i className="bi bi-envelope"></i>
                Email
              </DetailLabel>
              <DetailValue>{invitation.email}</DetailValue>
            </DetailRow>
            <DetailRow>
              <DetailLabel>
                <i className="bi bi-person-badge"></i>
                Role
              </DetailLabel>
              <DetailValue>
                {invitation.role === "member"
                  ? "Member - Full access to songs and setlists"
                  : "Guest - Limited access (expires after 30 days)"}
              </DetailValue>
            </DetailRow>
            <DetailRow>
              <DetailLabel>
                <i className="bi bi-calendar"></i>
                Expires
              </DetailLabel>
              <DetailValue>
                {new Date(invitation.expires_at).toLocaleDateString()}
              </DetailValue>
            </DetailRow>
          </InvitationDetails>

          <Actions>
            <SecondaryButton onClick={handleDecline} disabled={accepting}>
              Decline
            </SecondaryButton>
            <PrimaryButton onClick={handleAccept} disabled={accepting}>
              {accepting ? (
                <>
                  <Spinner size="sm" />
                  Accepting...
                </>
              ) : (
                <>
                  <i className="bi bi-check-lg"></i>
                  Accept Invitation
                </>
              )}
            </PrimaryButton>
          </Actions>
        </Card>
      </Container>
    </PageWrapper>
  );
};

// Styled Components

const PageWrapper = styled.div`
  min-height: 100vh;
  background: var(--color-bg-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${theme.space[6]};
`;

const Card = styled.div`
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.xl};
  padding: ${theme.space[8]};
  max-width: 600px;
  margin: 0 auto;
  text-align: center;
`;

const Icon = styled.div<{ $type: "invite" | "success" | "error" }>`
  font-size: ${theme.fontSizes.displayXl};
  margin-bottom: ${theme.space[4]};
  color: ${(props) => {
    switch (props.$type) {
      case "success":
        return theme.colors.semantic.success;
      case "error":
        return theme.colors.semantic.error;
      case "invite":
        return theme.colors.brand.primary;
    }
  }};

  i {
    font-size: inherit;
  }
`;

const Title = styled.h1`
  font-size: ${theme.fontSizes.h1};
  font-weight: ${theme.fontWeights.bold};
  color: var(--color-text-primary);
  margin-bottom: ${theme.space[3]};
`;

const Message = styled.p`
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-secondary);
  margin-bottom: ${theme.space[6]};
  line-height: ${theme.lineHeights.relaxed};
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
  padding: ${theme.space[1]} ${theme.space[3]};
  border-radius: ${theme.radius.base};
  font-weight: ${theme.fontWeights.semibold};
  font-size: ${theme.fontSizes.bodySm};
`;

const InvitationDetails = styled.div`
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.lg};
  padding: ${theme.space[5]};
  margin-bottom: ${theme.space[6]};
  text-align: left;
`;

const DetailRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: ${theme.space[3]} 0;
  border-bottom: 1px solid var(--color-border);

  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  &:first-child {
    padding-top: 0;
  }
`;

const DetailLabel = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
  font-weight: ${theme.fontWeights.medium};
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};

  i {
    color: ${theme.colors.brand.primary};
  }
`;

const DetailValue = styled.div`
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-primary);
  font-weight: ${theme.fontWeights.medium};
  text-align: right;
  max-width: 60%;
`;

const Actions = styled.div`
  display: flex;
  gap: ${theme.space[3]};
  justify-content: center;
`;

const PrimaryButton = styled.button`
  background: ${theme.colors.brand.primary};
  border: none;
  color: white;
  padding: ${theme.space[3]} ${theme.space[6]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};

  i {
    font-size: ${theme.fontSizes.bodyLg};
  }

  &:hover:not(:disabled) {
    background: ${theme.colors.brand.primaryHover};
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const SecondaryButton = styled.button`
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  padding: ${theme.space[3]} ${theme.space[6]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  &:hover:not(:disabled) {
    background: var(--color-bg-elevated);
    border-color: var(--color-border-strong);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${theme.space[4]};
  padding: ${theme.space[8]} 0;
`;

const LoadingText = styled.p`
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-secondary);
  margin: 0;
`;
