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
  onStartHosting: () => Promise<void>;
  onJoinSession: () => Promise<boolean>;
  onLeaveSession: () => Promise<void>;
}

export const SyncControls: FC<SyncControlsProps> = ({
  role,
  isConnected,
  isLoading,
  error,
  hasActiveSession,
  activeSessionSetlistId,
  currentSetlistId,
  onStartHosting,
  onJoinSession,
  onLeaveSession,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const handleStartHosting = async () => {
    await onStartHosting();
    setIsOpen(false);
  };

  const handleJoinSession = async () => {
    await onJoinSession();
    setIsOpen(false);
  };

  // Check if active session is for a different setlist
  const isSessionOnDifferentSetlist =
    hasActiveSession && activeSessionSetlistId !== currentSetlistId;

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
  padding: ${theme.space[2]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};

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

const ActionButton = styled.button<{ $variant?: "primary" | "success" }>`
  width: 100%;
  background: ${(props) =>
    props.$variant === "success"
      ? theme.colors.semantic.success
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
      props.$variant === "success" ? "#059669" : theme.colors.brand.primaryHover};
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

  &:hover {
    background: ${theme.colors.semantic.errorBgDark};
    border-color: ${theme.colors.semantic.error};
    color: ${theme.colors.semantic.error};
  }
`;

export default SyncControls;
