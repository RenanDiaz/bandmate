import type { FC } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import { theme } from "../theme";
import type { SyncRole } from "../hooks/usePerformanceSync";

interface SyncControlsProps {
  role: SyncRole;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  hasActiveSession: boolean;
  activeSessionSetlistId: string | null;
  currentSetlistId: string;
  hostDisplayName: string | null;
  sessionCreatedAt: string | null;
  canManageOrphanedSession: boolean;
  onStartHosting: () => Promise<void>;
  onJoinSession: () => Promise<boolean>;
  onLeaveSession: () => Promise<void>;
  onForceEndSession: () => Promise<void>;
  onTakeOverSession: () => Promise<void>;
}

export const SyncControls: FC<SyncControlsProps> = ({
  role,
  isConnected,
  isLoading,
  error,
  hasActiveSession,
  activeSessionSetlistId,
  currentSetlistId,
  hostDisplayName,
  sessionCreatedAt,
  canManageOrphanedSession,
  onStartHosting,
  onJoinSession,
  onLeaveSession,
  onForceEndSession,
  onTakeOverSession,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  // Calculate how long the session has been active
  const getSessionDuration = () => {
    if (!sessionCreatedAt) return null;
    const created = new Date(sessionCreatedAt);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffHours > 0) {
      return t("performanceSync.hoursAgo", { count: diffHours });
    }
    if (diffMins > 0) {
      return t("performanceSync.minutesAgo", { count: diffMins });
    }
    return t("performanceSync.justNow");
  };

  const handleStartHosting = async () => {
    await onStartHosting();
    setIsOpen(false);
  };

  const handleJoinSession = async () => {
    await onJoinSession();
    setIsOpen(false);
  };

  const handleForceEndSession = async () => {
    await onForceEndSession();
    setIsOpen(false);
  };

  const handleTakeOverSession = async () => {
    await onTakeOverSession();
    setIsOpen(false);
  };

  // Check if active session is for a different setlist
  const isSessionOnDifferentSetlist =
    hasActiveSession && activeSessionSetlistId !== currentSetlistId;

  const sessionDuration = getSessionDuration();

  // Render active session indicator
  if (role && isConnected) {
    return (
      <ActiveSessionContainer>
        <SessionBadge $role={role}>
          <StatusDot $connected={isConnected} />
          <i className={role === "host" ? "bi bi-broadcast" : "bi bi-eye"} />
          <span>
            {role === "host"
              ? t("performanceSync.hosting")
              : t("performanceSync.following")}
          </span>
        </SessionBadge>

        <LeaveButton onClick={onLeaveSession}>
          <i className="bi bi-x-lg" />
          <span>
            {role === "host"
              ? t("performanceSync.endSession")
              : t("performanceSync.leaveSession")}
          </span>
        </LeaveButton>
      </ActiveSessionContainer>
    );
  }

  // Render sync button and dropdown
  return (
    <SyncContainer>
      <SyncButton
        onClick={() => setIsOpen(!isOpen)}
        $isOpen={isOpen}
        $hasSession={hasActiveSession}
      >
        <i className="bi bi-broadcast" />
        <span>
          {hasActiveSession
            ? t("performanceSync.sessionActive")
            : t("performanceSync.sync")}
        </span>
        {hasActiveSession && <PulseDot />}
        <i className={`bi bi-chevron-${isOpen ? "up" : "down"}`} />
      </SyncButton>

      {isOpen && (
        <SyncDropdown>
          <DropdownHeader>{t("performanceSync.syncSession")}</DropdownHeader>

          {error && <ErrorMessage>{error}</ErrorMessage>}

          {hasActiveSession ? (
            <DropdownSection>
              <SectionTitle>
                <i className="bi bi-broadcast" />
                {t("performanceSync.activeSessionFound")}
              </SectionTitle>

              {/* Host info */}
              {hostDisplayName && (
                <HostInfo>
                  <i className="bi bi-person-fill" />
                  <span>{hostDisplayName}</span>
                  {sessionDuration && (
                    <SessionTime>
                      <i className="bi bi-clock" />
                      {sessionDuration}
                    </SessionTime>
                  )}
                </HostInfo>
              )}

              <SectionDescription>
                {isSessionOnDifferentSetlist
                  ? t("performanceSync.sessionOnDifferentSetlist")
                  : t("performanceSync.joinToFollow")}
              </SectionDescription>
              <ActionButton
                onClick={handleJoinSession}
                disabled={isLoading}
                $variant="success"
              >
                {isLoading ? (
                  <i className="bi bi-arrow-repeat spinning" />
                ) : (
                  <i className="bi bi-person-plus" />
                )}
                {t("performanceSync.joinSession")}
              </ActionButton>

              {/* Owner controls for orphaned sessions */}
              {canManageOrphanedSession && (
                <OrphanedSessionControls>
                  <Divider />
                  <SectionTitle>
                    <i className="bi bi-gear" />
                    {t("performanceSync.sessionManagement")}
                  </SectionTitle>
                  <SectionDescription>
                    {t("performanceSync.orphanedSessionHint")}
                  </SectionDescription>
                  <ButtonRow>
                    <ActionButton
                      onClick={handleTakeOverSession}
                      disabled={isLoading}
                      $variant="primary"
                    >
                      {isLoading ? (
                        <i className="bi bi-arrow-repeat spinning" />
                      ) : (
                        <i className="bi bi-box-arrow-in-right" />
                      )}
                      {t("performanceSync.takeOver")}
                    </ActionButton>
                    <ActionButton
                      onClick={handleForceEndSession}
                      disabled={isLoading}
                      $variant="danger"
                    >
                      {isLoading ? (
                        <i className="bi bi-arrow-repeat spinning" />
                      ) : (
                        <i className="bi bi-x-circle" />
                      )}
                      {t("performanceSync.forceEnd")}
                    </ActionButton>
                  </ButtonRow>
                </OrphanedSessionControls>
              )}
            </DropdownSection>
          ) : (
            <DropdownSection>
              <SectionTitle>
                <i className="bi bi-broadcast" />
                {t("performanceSync.startHosting")}
              </SectionTitle>
              <SectionDescription>
                {t("performanceSync.startHostingDesc")}
              </SectionDescription>
              <ActionButton
                onClick={handleStartHosting}
                disabled={isLoading}
                $variant="primary"
              >
                {isLoading ? (
                  <i className="bi bi-arrow-repeat spinning" />
                ) : (
                  <i className="bi bi-play-fill" />
                )}
                {t("performanceSync.startHosting")}
              </ActionButton>
            </DropdownSection>
          )}
        </SyncDropdown>
      )}
    </SyncContainer>
  );
};

// Styled Components
const SyncContainer = styled.div`
  position: relative;
`;

const SyncButton = styled.button<{ $isOpen: boolean; $hasSession?: boolean }>`
  background: ${(props) =>
    props.$isOpen
      ? theme.colors.brand.primary
      : props.$hasSession
        ? theme.colors.semantic.success + "20"
        : "transparent"};
  border: 1px solid
    ${(props) =>
      props.$isOpen
        ? theme.colors.brand.primary
        : props.$hasSession
          ? theme.colors.semantic.success
          : theme.colors.dark.border.default};
  color: ${(props) =>
    props.$isOpen
      ? "white"
      : props.$hasSession
        ? theme.colors.semantic.success
        : theme.colors.dark.text.secondary};
  padding: ${theme.space[2]} ${theme.space[3]};
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};

  /* Hide text on mobile, show only icons */
  > span {
    display: none;
  }

  @media (min-width: ${theme.breakpoints.md}) {
    padding: ${theme.space[2]} ${theme.space[4]};

    > span {
      display: inline;
    }
  }

  &:hover {
    background: ${(props) =>
      props.$isOpen
        ? theme.colors.brand.primaryHover
        : props.$hasSession
          ? theme.colors.semantic.success + "30"
          : theme.colors.dark.bg.elevated};
    border-color: ${(props) =>
      props.$hasSession
        ? theme.colors.semantic.success
        : theme.colors.brand.primary};
    color: ${(props) =>
      props.$isOpen
        ? "white"
        : props.$hasSession
          ? theme.colors.semantic.success
          : theme.colors.brand.primary};
  }
`;

const PulseDot = styled.div`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${theme.colors.semantic.success};
  animation: pulse 2s infinite;

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.5;
      transform: scale(1.2);
    }
  }
`;

const SyncDropdown = styled.div`
  position: absolute;
  top: calc(100% + ${theme.space[2]});
  right: 0;
  width: 320px;
  background: ${theme.colors.dark.bg.secondary};
  border: 1px solid ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.md};
  box-shadow: ${theme.shadows.lg};
  z-index: ${theme.zIndex.dropdown};
  overflow: hidden;
`;

const DropdownHeader = styled.div`
  padding: ${theme.space[4]};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.dark.text.primary};
  border-bottom: 1px solid ${theme.colors.dark.border.default};
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
`;

const DropdownSection = styled.div`
  padding: ${theme.space[4]};
`;

const SectionTitle = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.dark.text.primary};
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  margin-bottom: ${theme.space[1]};

  i {
    color: ${theme.colors.brand.primary};
  }
`;

const SectionDescription = styled.div`
  font-size: ${theme.fontSizes.bodyXs};
  color: ${theme.colors.dark.text.tertiary};
  margin-bottom: ${theme.space[3]};
`;

const ActionButton = styled.button<{
  $variant?: "primary" | "success" | "danger";
}>`
  width: 100%;
  background: ${(props) =>
    props.$variant === "success"
      ? theme.colors.semantic.success
      : props.$variant === "danger"
        ? theme.colors.semantic.error
        : theme.colors.brand.primary};
  border: none;
  color: white;
  padding: ${theme.space[3]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${theme.space[2]};

  &:hover:not(:disabled) {
    background: ${(props) =>
      props.$variant === "success"
        ? "#059669"
        : props.$variant === "danger"
          ? "#b91c1c"
          : theme.colors.brand.primaryHover};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .spinning {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;

const HostInfo = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  padding: ${theme.space[2]} ${theme.space[3]};
  background: ${theme.colors.dark.bg.elevated};
  border-radius: ${theme.radius.base};
  margin-bottom: ${theme.space[3]};
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.dark.text.secondary};

  i {
    color: ${theme.colors.brand.primary};
  }
`;

const SessionTime = styled.span`
  display: flex;
  align-items: center;
  gap: ${theme.space[1]};
  margin-left: auto;
  color: ${theme.colors.dark.text.tertiary};
  font-size: ${theme.fontSizes.bodyXs};

  i {
    color: ${theme.colors.dark.text.tertiary};
  }
`;

const OrphanedSessionControls = styled.div`
  margin-top: ${theme.space[3]};
`;

const Divider = styled.div`
  height: 1px;
  background: ${theme.colors.dark.border.default};
  margin-bottom: ${theme.space[3]};
`;

const ButtonRow = styled.div`
  display: flex;
  gap: ${theme.space[2]};

  > button {
    flex: 1;
  }
`;

const ErrorMessage = styled.div`
  margin: 0 ${theme.space[4]} ${theme.space[3]};
  padding: ${theme.space[3]};
  background: ${theme.colors.semantic.errorBgDark};
  border: 1px solid ${theme.colors.semantic.error};
  border-radius: ${theme.radius.base};
  color: ${theme.colors.semantic.error};
  font-size: ${theme.fontSizes.bodySm};
`;

// Active Session Components
const ActiveSessionContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
`;

const SessionBadge = styled.div<{ $role: SyncRole }>`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  padding: ${theme.space[2]} ${theme.space[3]};
  background: ${(props) =>
    props.$role === "host"
      ? theme.colors.brand.primary + "20"
      : theme.colors.semantic.success + "20"};
  border: 1px solid
    ${(props) =>
      props.$role === "host"
        ? theme.colors.brand.primary
        : theme.colors.semantic.success};
  border-radius: ${theme.radius.base};
  color: ${(props) =>
    props.$role === "host"
      ? theme.colors.brand.primary
      : theme.colors.semantic.success};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};

  /* Hide text on mobile */
  > span {
    display: none;
  }

  @media (min-width: ${theme.breakpoints.md}) {
    > span {
      display: inline;
    }
  }
`;

const StatusDot = styled.div<{ $connected: boolean }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${(props) =>
    props.$connected ? theme.colors.semantic.success : theme.colors.semantic.error};
  animation: ${(props) => (props.$connected ? "pulse 2s infinite" : "none")};

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
`;

const LeaveButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  padding: ${theme.space[2]} ${theme.space[3]};
  background: transparent;
  border: 1px solid ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.base};
  color: ${theme.colors.dark.text.secondary};
  font-size: ${theme.fontSizes.bodySm};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  /* Hide text on mobile */
  > span {
    display: none;
  }

  @media (min-width: ${theme.breakpoints.md}) {
    > span {
      display: inline;
    }
  }

  &:hover {
    background: ${theme.colors.semantic.errorBgDark};
    border-color: ${theme.colors.semantic.error};
    color: ${theme.colors.semantic.error};
  }
`;

export default SyncControls;
