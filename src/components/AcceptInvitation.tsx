import type { FC } from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Container, Spinner } from "reactstrap";
import styled from "styled-components";
import { theme } from "../theme";
import { useBandContext } from "../context/useBandContext";
import {
  getInvitationByToken,
  acceptInvitation,
} from "../services/bandMembersService";

const PENDING_TOKEN_KEY = "pendingInviteToken";

type Status = "working" | "needsAuth" | "success" | "error";

export const AcceptInvitation: FC = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isCheckingAuth, refreshBands } = useBandContext();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<Status>("working");
  const [error, setError] = useState<string | null>(null);
  // Ensures we only run the acceptance flow once even if auth state settles
  // through several renders.
  const attemptedRef = useRef(false);

  useEffect(() => {
    // Wait until we know whether the user is authenticated.
    if (isCheckingAuth) return;

    if (!token) {
      setStatus("error");
      setError(t("invitations.invalidLink"));
      return;
    }

    if (!user) {
      // Stash the token so we can resume once the user logs in (OAuth/email
      // logins redirect back to the origin and lose this route).
      sessionStorage.setItem(PENDING_TOKEN_KEY, token);
      setStatus("needsAuth");
      return;
    }

    if (attemptedRef.current) return;
    attemptedRef.current = true;
    sessionStorage.removeItem(PENDING_TOKEN_KEY);
    void acceptFlow(token);
  }, [isCheckingAuth, user, token, t]);

  const acceptFlow = async (tok: string) => {
    setStatus("working");
    try {
      const invite = await getInvitationByToken(tok);
      if (!invite) {
        setStatus("error");
        setError(t("invitations.notFound"));
        return;
      }
      if (new Date(invite.expires_at) < new Date()) {
        setStatus("error");
        setError(t("invitations.expired"));
        return;
      }

      await acceptInvitation(invite.id);
      refreshBands();
      setStatus("success");
      setTimeout(() => navigate("/"), 2000);
    } catch (err) {
      console.error("Failed to accept invitation:", err);
      setStatus("error");
      setError(err instanceof Error ? err.message : t("invitations.loadError"));
    }
  };

  if (isCheckingAuth || status === "working") {
    return (
      <PageWrapper>
        <Container>
          <Card>
            <LoadingContainer>
              <Spinner color="primary" style={{ width: "3rem", height: "3rem" }} />
              <LoadingText>{t("invitations.verifying")}</LoadingText>
            </LoadingContainer>
          </Card>
        </Container>
      </PageWrapper>
    );
  }

  if (status === "needsAuth") {
    return (
      <PageWrapper>
        <Container>
          <Card>
            <Icon $type="invite">
              <i className="bi bi-envelope-open"></i>
            </Icon>
            <Title>{t("invitations.needsAuthTitle")}</Title>
            <Message>{t("invitations.needsAuthMessage")}</Message>
            <Actions>
              <PrimaryButton onClick={() => navigate("/login")}>
                <i className="bi bi-box-arrow-in-right"></i>
                {t("invitations.logIn")}
              </PrimaryButton>
            </Actions>
          </Card>
        </Container>
      </PageWrapper>
    );
  }

  if (status === "success") {
    return (
      <PageWrapper>
        <Container>
          <Card>
            <Icon $type="success">
              <i className="bi bi-check-circle"></i>
            </Icon>
            <Title>{t("invitations.successTitle")}</Title>
            <Message>{t("invitations.successMessage")}</Message>
          </Card>
        </Container>
      </PageWrapper>
    );
  }

  // status === "error"
  return (
    <PageWrapper>
      <Container>
        <Card>
          <Icon $type="error">
            <i className="bi bi-exclamation-triangle"></i>
          </Icon>
          <Title>{t("invitations.errorTitle")}</Title>
          <Message>{error}</Message>
          <Actions>
            <SecondaryButton onClick={() => navigate("/")}>
              {t("invitations.goHome")}
            </SecondaryButton>
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
