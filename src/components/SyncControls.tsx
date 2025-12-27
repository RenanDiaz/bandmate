import type { FC } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import { theme } from "../theme";
import type { SyncRole } from "../hooks/usePerformanceSync";

interface SyncControlsProps {
  role: SyncRole;
  sessionCode: string | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  onStartHosting: () => Promise<void>;
  onJoinSession: (code: string) => Promise<boolean>;
  onLeaveSession: () => Promise<void>;
}

export const SyncControls: FC<SyncControlsProps> = ({
  role,
  sessionCode,
  isConnected,
  isLoading,
  error,
  onStartHosting,
  onJoinSession,
  onLeaveSession,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [codeCopied, setCodeCopied] = useState(false);

  const handleCopyCode = async () => {
    if (sessionCode) {
      await navigator.clipboard.writeText(sessionCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  const handleJoin = async () => {
    if (joinCode.trim()) {
      const success = await onJoinSession(joinCode.trim().toUpperCase());
      if (success) {
        setJoinCode("");
        setIsOpen(false);
      }
    }
  };

  const handleStartHosting = async () => {
    await onStartHosting();
    setIsOpen(false);
  };

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

        {role === "host" && sessionCode && (
          <CodeDisplay onClick={handleCopyCode} title={t("performanceSync.copyCode")}>
            <code>{sessionCode}</code>
            <i className={codeCopied ? "bi bi-check" : "bi bi-clipboard"} />
          </CodeDisplay>
        )}

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
      <SyncButton onClick={() => setIsOpen(!isOpen)} $isOpen={isOpen}>
        <i className="bi bi-broadcast" />
        <span>{t("performanceSync.sync")}</span>
        <i className={`bi bi-chevron-${isOpen ? "up" : "down"}`} />
      </SyncButton>

      {isOpen && (
        <SyncDropdown>
          <DropdownHeader>{t("performanceSync.syncSession")}</DropdownHeader>

          {error && <ErrorMessage>{error}</ErrorMessage>}

          <DropdownSection>
            <SectionTitle>
              <i className="bi bi-broadcast" />
              {t("performanceSync.startHosting")}
            </SectionTitle>
            <SectionDescription>
              {t("performanceSync.startHostingDesc")}
            </SectionDescription>
            <ActionButton onClick={handleStartHosting} disabled={isLoading}>
              {isLoading ? (
                <i className="bi bi-arrow-repeat spinning" />
              ) : (
                <i className="bi bi-play-fill" />
              )}
              {t("performanceSync.startHosting")}
            </ActionButton>
          </DropdownSection>

          <Divider />

          <DropdownSection>
            <SectionTitle>
              <i className="bi bi-person-plus" />
              {t("performanceSync.joinSession")}
            </SectionTitle>
            <SectionDescription>
              {t("performanceSync.joinSessionDesc")}
            </SectionDescription>
            <JoinForm
              onSubmit={(e) => {
                e.preventDefault();
                handleJoin();
              }}
            >
              <CodeInput
                type="text"
                placeholder={t("performanceSync.enterCode")}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6}
                disabled={isLoading}
              />
              <JoinButton type="submit" disabled={!joinCode.trim() || isLoading}>
                {isLoading ? (
                  <i className="bi bi-arrow-repeat spinning" />
                ) : (
                  t("performanceSync.join")
                )}
              </JoinButton>
            </JoinForm>
          </DropdownSection>
        </SyncDropdown>
      )}
    </SyncContainer>
  );
};

// Styled Components
const SyncContainer = styled.div`
  position: relative;
`;

const SyncButton = styled.button<{ $isOpen: boolean }>`
  background: ${(props) =>
    props.$isOpen ? theme.colors.brand.primary : "transparent"};
  border: 1px solid
    ${(props) =>
      props.$isOpen ? theme.colors.brand.primary : theme.colors.dark.border.default};
  color: ${(props) =>
    props.$isOpen ? "white" : theme.colors.dark.text.secondary};
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
      props.$isOpen ? theme.colors.brand.primaryHover : theme.colors.dark.bg.elevated};
    border-color: ${theme.colors.brand.primary};
    color: ${(props) => (props.$isOpen ? "white" : theme.colors.brand.primary)};
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

const ActionButton = styled.button`
  width: 100%;
  background: ${theme.colors.brand.primary};
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
    background: ${theme.colors.brand.primaryHover};
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

const Divider = styled.div`
  height: 1px;
  background: ${theme.colors.dark.border.default};
  margin: 0 ${theme.space[4]};
`;

const JoinForm = styled.form`
  display: flex;
  gap: ${theme.space[2]};
`;

const CodeInput = styled.input`
  flex: 1;
  background: ${theme.colors.dark.bg.tertiary};
  border: 1px solid ${theme.colors.dark.border.default};
  color: ${theme.colors.dark.text.primary};
  padding: ${theme.space[3]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  font-family: ${theme.fonts.mono};
  text-transform: uppercase;
  letter-spacing: ${theme.letterSpacing.wider};
  text-align: center;

  &::placeholder {
    color: ${theme.colors.dark.text.disabled};
    text-transform: none;
    letter-spacing: normal;
  }

  &:focus {
    outline: none;
    border-color: ${theme.colors.brand.primary};
  }

  &:disabled {
    opacity: 0.6;
  }
`;

const JoinButton = styled.button`
  background: ${theme.colors.semantic.success};
  border: none;
  color: white;
  padding: ${theme.space[3]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  &:hover:not(:disabled) {
    background: #059669;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .spinning {
    animation: spin 1s linear infinite;
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

const CodeDisplay = styled.button`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  padding: ${theme.space[2]} ${theme.space[3]};
  background: ${theme.colors.dark.bg.tertiary};
  border: 1px solid ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.base};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  code {
    font-family: ${theme.fonts.mono};
    font-size: ${theme.fontSizes.body};
    color: ${theme.colors.dark.text.primary};
    letter-spacing: ${theme.letterSpacing.wider};
  }

  i {
    color: ${theme.colors.dark.text.tertiary};
    font-size: ${theme.fontSizes.bodySm};
  }

  &:hover {
    border-color: ${theme.colors.brand.primary};

    i {
      color: ${theme.colors.brand.primary};
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
