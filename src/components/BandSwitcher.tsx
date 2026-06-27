import type { FC } from "react";
import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Spinner } from "reactstrap";
import styled, { keyframes } from "styled-components";
import { theme } from "../theme";
import { useBandContext } from "../context/useBandContext";
import { useToast } from "../context/useToast";
import { BandAvatar } from "./BandAvatar";
import { ConfirmModal } from "./ConfirmModal";
import type { Band } from "../services/bandsService";
import {
  getMyInvitations,
  acceptInvitation,
  declineInvitation,
  type BandInvitation,
} from "../services/bandMembersService";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onManageBands: () => void;
}

type ConfirmState = {
  title: string;
  message: string;
  confirmLabel: string;
  tone?: "danger" | "primary";
  action: () => Promise<void>;
};

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
};

export const BandSwitcher: FC<Props> = ({ isOpen, onClose, onManageBands }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const { selectedBand, setSelectedBand, bands, refreshBands } = useBandContext();
  const isMobile = useIsMobile();
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [invitations, setInvitations] = useState<BandInvitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const [processingInvitationId, setProcessingInvitationId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadInvitations = useCallback(async () => {
    setLoadingInvitations(true);
    try {
      const data = await getMyInvitations();
      setInvitations(data.filter((inv) => new Date(inv.expires_at) >= new Date()));
    } catch {
      // Silently fail for invitations
    }
    setLoadingInvitations(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadInvitations();
      refreshBands();
    }
  }, [isOpen, loadInvitations, refreshBands]);

  // Close on click outside (desktop dropdown)
  useEffect(() => {
    if (!isOpen || isMobile) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to avoid closing immediately from the trigger click
    const timer = setTimeout(() => document.addEventListener("mousedown", handleClick), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [isOpen, isMobile, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  // Lock body scroll when bottom sheet is open
  useEffect(() => {
    if (isOpen && isMobile) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [isOpen, isMobile]);

  const runConfirm = async () => {
    if (!confirm) return;
    setConfirmBusy(true);
    try {
      await confirm.action();
    } finally {
      setConfirmBusy(false);
      setConfirm(null);
    }
  };

  const handleSelectBand = (band: Band) => {
    setSelectedBand(band);
    onClose();
  };

  const handleAcceptInvitation = async (invitation: BandInvitation) => {
    setProcessingInvitationId(invitation.id);
    try {
      await acceptInvitation(invitation.id);
      await loadInvitations();
      refreshBands();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t("bands.acceptInvitationError");
      toast.error(msg);
    }
    setProcessingInvitationId(null);
  };

  const handleDeclineInvitation = async (invitation: BandInvitation) => {
    setConfirm({
      title: t("bands.declineInvitation"),
      message: t("bands.declineInvitationConfirm"),
      confirmLabel: t("bands.declineInvitation"),
      tone: "danger",
      action: async () => {
        setProcessingInvitationId(invitation.id);
        try {
          await declineInvitation(invitation.id);
          await loadInvitations();
        } catch {
          toast.error(t("bands.declineInvitationError"));
        }
        setProcessingInvitationId(null);
      },
    });
  };

  const handleGoToSettings = (bandId: number) => {
    onClose();
    navigate(`/bands/${bandId}/settings`);
  };

  if (!isOpen) return null;

  const content = (
    <>
      {/* Band List */}
      <SwitcherSection>
        <SwitcherSectionTitle>{t("bandSwitcher.myBands")}</SwitcherSectionTitle>
        {bands.length === 0 ? (
          <EmptyMessage>{t("bandSwitcher.noBands")}</EmptyMessage>
        ) : (
          <BandItemList>
            {bands.map((band) => {
              const isSelected = selectedBand?.id === band.id;
              return (
                <BandItem
                  key={band.id}
                  $isSelected={isSelected}
                  onClick={() => handleSelectBand(band)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelectBand(band);
                    }
                  }}
                >
                  <BandAvatar
                    name={band.name}
                    avatarUrl={band.avatar_url}
                    size={40}
                    active={isSelected}
                  />
                  <BandItemInfo>
                    <BandItemName>{band.name}</BandItemName>
                    <BandItemMeta>
                      {band.user_role && (
                        <BandItemRole>{t(`bands.${band.user_role}`)}</BandItemRole>
                      )}
                      {band.genre && <span>{band.genre}</span>}
                    </BandItemMeta>
                  </BandItemInfo>
                  <BandItemActions>
                    {isSelected && (
                      <CheckIcon>
                        <i className="bi bi-check-circle-fill"></i>
                      </CheckIcon>
                    )}
                    <SettingsIconButton
                      onClick={(e) => {
                        e.stopPropagation();
                        handleGoToSettings(band.id);
                      }}
                      aria-label={t("nav.bandSettings")}
                      title={t("nav.bandSettings")}
                    >
                      <i className="bi bi-gear"></i>
                    </SettingsIconButton>
                  </BandItemActions>
                </BandItem>
              );
            })}
          </BandItemList>
        )}
      </SwitcherSection>

      {/* Invitations */}
      {!loadingInvitations && invitations.length > 0 && (
        <SwitcherSection>
          <SwitcherSectionTitle>
            {t("bandSwitcher.invitations")}
            <InvitationBadge>{invitations.length}</InvitationBadge>
          </SwitcherSectionTitle>
          <BandItemList>
            {invitations.map((invitation) => {
              const isProcessing = processingInvitationId === invitation.id;
              return (
                <InvitationItem key={invitation.id}>
                  <BandItemIcon $isSelected={false}>
                    <i className="bi bi-envelope-heart"></i>
                  </BandItemIcon>
                  <BandItemInfo>
                    <BandItemName>
                      {invitation.band?.name || t("bands.bandInvitation")}
                    </BandItemName>
                    <BandItemMeta>
                      <span>
                        {t("bands.invitedBy")} {invitation.inviter_name || t("bands.aBandMember")}
                      </span>
                    </BandItemMeta>
                  </BandItemInfo>
                  <InvitationButtons>
                    <AcceptBtn
                      onClick={() => handleAcceptInvitation(invitation)}
                      disabled={isProcessing}
                      aria-label={t("bands.accept")}
                    >
                      {isProcessing ? (
                        <Spinner size="sm" color="light" />
                      ) : (
                        <i className="bi bi-check-lg"></i>
                      )}
                    </AcceptBtn>
                    <DeclineBtn
                      onClick={() => handleDeclineInvitation(invitation)}
                      disabled={isProcessing}
                      aria-label={t("bands.decline")}
                    >
                      <i className="bi bi-x-lg"></i>
                    </DeclineBtn>
                  </InvitationButtons>
                </InvitationItem>
              );
            })}
          </BandItemList>
        </SwitcherSection>
      )}

      {/* Footer Actions */}
      <SwitcherFooter>
        <FooterButton onClick={() => { onClose(); onManageBands(); }}>
          <i className="bi bi-plus-lg"></i>
          {t("bandSwitcher.createOrManage")}
        </FooterButton>
      </SwitcherFooter>
    </>
  );

  // Desktop: Dropdown
  const confirmModal = (
    <ConfirmModal
      isOpen={confirm !== null}
      title={confirm?.title ?? ""}
      message={confirm?.message ?? ""}
      confirmLabel={confirm?.confirmLabel}
      tone={confirm?.tone ?? "danger"}
      busy={confirmBusy}
      onConfirm={runConfirm}
      onClose={() => setConfirm(null)}
    />
  );

  if (!isMobile) {
    return (
      <>
        <DropdownContainer ref={dropdownRef}>
          {content}
        </DropdownContainer>
        {confirmModal}
      </>
    );
  }

  // Mobile: Bottom Sheet via portal
  return createPortal(
    <>
      <BottomSheetBackdrop onClick={onClose} />
      <BottomSheetContainer>
        <DragHandle />
        <BottomSheetHeader>
          <BottomSheetTitle>{t("bandSwitcher.switchBand")}</BottomSheetTitle>
          <CloseButton onClick={onClose} aria-label={t("common.close")}>
            <i className="bi bi-x-lg"></i>
          </CloseButton>
        </BottomSheetHeader>
        <BottomSheetContent>
          {content}
        </BottomSheetContent>
      </BottomSheetContainer>
      {confirmModal}
    </>,
    document.body
  );
};

// --- Animations ---

const slideUp = keyframes`
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
`;

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const dropdownIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

// --- Desktop Dropdown Styles ---

const DropdownContainer = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: ${theme.space[2]};
  width: 320px;
  max-height: 480px;
  overflow-y: auto;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.lg};
  box-shadow: ${theme.shadows.xl};
  z-index: ${theme.zIndex.dropdown};
  animation: ${dropdownIn} ${theme.transitions.fast} ease;

  /* Scrollbar styling */
  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: ${theme.radius.full};
  }
`;

// --- Mobile Bottom Sheet Styles ---

const BottomSheetBackdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: ${theme.zIndex.modalBackdrop};
  animation: ${fadeIn} ${theme.transitions.fast} ease;
  backdrop-filter: blur(4px);
`;

const BottomSheetContainer = styled.div`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  max-height: 85vh;
  background: var(--color-bg-secondary);
  border-top-left-radius: ${theme.radius.xl};
  border-top-right-radius: ${theme.radius.xl};
  z-index: ${theme.zIndex.modal};
  animation: ${slideUp} ${theme.transitions.slow} cubic-bezier(0.32, 0.72, 0, 1);
  display: flex;
  flex-direction: column;
`;

const DragHandle = styled.div`
  width: 36px;
  height: 4px;
  background: var(--color-border);
  border-radius: ${theme.radius.full};
  margin: ${theme.space[3]} auto ${theme.space[1]};
  flex-shrink: 0;
`;

const BottomSheetHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${theme.space[3]} ${theme.space[4]};
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
`;

const BottomSheetTitle = styled.h2`
  font-size: ${theme.fontSizes.h4};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin: 0;
`;

const CloseButton = styled.button`
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  font-size: ${theme.fontSizes.h4};
  padding: ${theme.space[2]};
  border-radius: ${theme.radius.base};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all ${theme.transitions.fast} ease;

  &:hover {
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
  }
`;

const BottomSheetContent = styled.div`
  overflow-y: auto;
  flex: 1;
  -webkit-overflow-scrolling: touch;
`;

// --- Shared Content Styles ---

const SwitcherSection = styled.div`
  padding: ${theme.space[3]} ${theme.space[4]};
  border-bottom: 1px solid var(--color-border);

  &:last-of-type {
    border-bottom: none;
  }
`;

const SwitcherSectionTitle = styled.div`
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: ${theme.letterSpacing.wider};
  margin-bottom: ${theme.space[2]};
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
`;

const EmptyMessage = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-tertiary);
  padding: ${theme.space[3]} 0;
  text-align: center;
`;

const BandItemList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[1]};
`;

const BandItem = styled.div<{ $isSelected: boolean }>`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  padding: ${theme.space[3]};
  border-radius: ${theme.radius.base};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  background: ${(props) => (props.$isSelected ? "rgba(139, 92, 246, 0.1)" : "transparent")};
  border: 1px solid ${(props) => (props.$isSelected ? theme.colors.brand.primary : "transparent")};

  &:hover {
    background: ${(props) =>
      props.$isSelected ? "rgba(139, 92, 246, 0.15)" : "var(--color-bg-tertiary)"};
  }

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.3);
  }
`;

const InvitationItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  padding: ${theme.space[3]};
  border-radius: ${theme.radius.base};
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
`;

const BandItemIcon = styled.div<{ $isSelected: boolean }>`
  width: 36px;
  height: 36px;
  border-radius: ${theme.radius.base};
  background: ${(props) =>
    props.$isSelected ? theme.gradients.brandPrimary : "var(--color-bg-elevated)"};
  color: ${(props) => (props.$isSelected ? "white" : "var(--color-text-secondary)")};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${theme.fontSizes.body};
  flex-shrink: 0;
  transition: all ${theme.transitions.fast} ease;
`;

const BandItemInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const BandItemName = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const BandItemMeta = styled.div`
  font-size: ${theme.fontSizes.bodyXs};
  color: var(--color-text-tertiary);
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
`;

const BandItemRole = styled.span`
  text-transform: capitalize;
`;

const BandItemActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  flex-shrink: 0;
`;

const CheckIcon = styled.span`
  color: ${theme.colors.brand.primary};
  font-size: ${theme.fontSizes.h5};
  display: flex;
  align-items: center;
`;

const SettingsIconButton = styled.button`
  background: transparent;
  border: none;
  color: var(--color-text-tertiary);
  font-size: ${theme.fontSizes.bodySm};
  padding: ${theme.space[1]};
  border-radius: ${theme.radius.sm};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all ${theme.transitions.fast} ease;
  opacity: 0.6;

  &:hover {
    opacity: 1;
    color: ${theme.colors.brand.primary};
    background: var(--color-bg-tertiary);
  }
`;

const InvitationBadge = styled.span`
  background: ${theme.colors.brand.primary};
  color: white;
  min-width: 20px;
  height: 20px;
  border-radius: ${theme.radius.full};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.bold};
  padding: 0 ${theme.space[1]};
`;

const InvitationButtons = styled.div`
  display: flex;
  gap: ${theme.space[1]};
  flex-shrink: 0;
`;

const AcceptBtn = styled.button`
  background: ${theme.colors.semantic.success};
  border: none;
  color: white;
  width: 32px;
  height: 32px;
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  &:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const DeclineBtn = styled.button`
  background: transparent;
  border: 1px solid var(--color-border);
  color: ${theme.colors.semantic.error};
  width: 32px;
  height: 32px;
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  &:hover:not(:disabled) {
    background: ${theme.colors.semantic.errorBgDark};
    border-color: ${theme.colors.semantic.error};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const SwitcherFooter = styled.div`
  padding: ${theme.space[3]} ${theme.space[4]};
  border-top: 1px solid var(--color-border);
`;

const FooterButton = styled.button`
  width: 100%;
  background: transparent;
  border: 1px dashed var(--color-border);
  color: var(--color-text-secondary);
  padding: ${theme.space[3]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${theme.space[2]};
  transition: all ${theme.transitions.fast} ease;

  &:hover {
    border-color: ${theme.colors.brand.primary};
    color: ${theme.colors.brand.primary};
    background: rgba(139, 92, 246, 0.05);
  }
`;
