import type { FC } from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Spinner } from "reactstrap";
import styled from "styled-components";
import { theme } from "../theme";
import type { Band } from "../services/bandsService";
import {
  getBandMembers,
  removeBandMember,
  updateMemberRole,
  leaveBand,
  getBandInvitations,
  revokeInvitation,
} from "../services/bandMembersService";
import type { BandMember, BandRole, BandInvitation } from "../services/bandMembersService";

interface Props {
  band: Band;
  currentUserId: string;
  onMemberChange: () => void;
  onInviteClick: () => void;
}

export const BandMembers: FC<Props> = ({ band, currentUserId, onMemberChange, onInviteClick }) => {
  const { t } = useTranslation();
  const [members, setMembers] = useState<BandMember[]>([]);
  const [invitations, setInvitations] = useState<BandInvitation[]>([]);
  const [loading, setLoading] = useState(true);

  const isOwner = band.user_role === "owner";
  const currentMember = members.find((m) => m.user_id === currentUserId);

  useEffect(() => {
    loadMembers();
    if (isOwner) {
      loadInvitations();
    }
  }, [band.id, isOwner]);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const data = await getBandMembers(band.id);
      setMembers(data);
    } catch (error) {
      console.error("Failed to load members:", error);
    }
    setLoading(false);
  };

  const loadInvitations = async () => {
    try {
      const data = await getBandInvitations(band.id);
      setInvitations(data.filter((inv) => inv.status === "pending"));
    } catch (error) {
      console.error("Failed to load invitations:", error);
    }
  };

  const handleRemoveMember = async (member: BandMember) => {
    if (member.role === "owner") {
      alert(t("bands.cannotRemoveOwner"));
      return;
    }

    const confirmed = window.confirm(
      t("bands.confirmRemoveMember", { email: member.email || t("common.unknown") })
    );
    if (!confirmed) return;

    try {
      await removeBandMember(member.id);
      await loadMembers();
      onMemberChange();
    } catch (error) {
      console.error("Failed to remove member:", error);
      alert(t("bands.removeError"));
    }
  };

  const handleChangeRole = async (member: BandMember, newRole: BandRole) => {
    if (member.role === "owner" && newRole !== "owner") {
      alert(t("bands.cannotChangeOwnerRole"));
      return;
    }

    try {
      await updateMemberRole(member.id, { role: newRole });
      await loadMembers();
      onMemberChange();
    } catch (error) {
      console.error("Failed to update member role:", error);
      alert(t("bands.updateRoleError"));
    }
  };

  const handleLeaveBand = async () => {
    if (currentMember?.role === "owner") {
      alert(t("bands.ownerCannotLeave"));
      return;
    }

    const confirmed = window.confirm(
      t("bands.confirmLeaveBand", { name: band.name })
    );
    if (!confirmed) return;

    try {
      await leaveBand(band.id);
      onMemberChange();
      // The parent component should handle navigation after leaving
    } catch (error) {
      console.error("Failed to leave band:", error);
      alert(t("bands.leaveError"));
    }
  };

  const getRoleBadgeColor = (role: BandRole) => {
    switch (role) {
      case "owner":
        return {
          bg: theme.gradients.brandPrimary,
          text: "white",
          border: theme.colors.brand.primary,
        };
      case "admin":
        return {
          bg: theme.colors.semantic.successBgDark,
          text: theme.colors.semantic.success,
          border: theme.colors.semantic.success,
        };
      case "member":
        return {
          bg: 'var(--color-bg-tertiary)',
          text: 'var(--color-text-primary)',
          border: 'var(--color-border-strong)',
        };
      case "guest":
        return {
          bg: theme.colors.semantic.warningBgDark,
          text: theme.colors.semantic.warning,
          border: theme.colors.semantic.warning,
        };
    }
  };

  const getInitials = (email: string | undefined): string => {
    if (!email) return "?";
    return email.charAt(0).toUpperCase();
  };

  const handleRevokeInvitation = async (invitation: BandInvitation) => {
    const confirmed = window.confirm(
      t("bands.confirmRevokeInvitation", { email: invitation.email })
    );
    if (!confirmed) return;

    try {
      await revokeInvitation(invitation.id);
      await loadInvitations();
    } catch (error) {
      console.error("Failed to revoke invitation:", error);
      alert(t("bands.revokeError"));
    }
  };

  const copyInvitationLink = (invitation: BandInvitation) => {
    const link = `${window.location.origin}/invite/accept?token=${invitation.token}`;
    navigator.clipboard.writeText(link);
    alert(t("bands.invitationCopied"));
  };

  if (loading) {
    return (
      <LoadingContainer>
        <Spinner color="primary" />
        <p>{t("bands.loadingMembers")}</p>
      </LoadingContainer>
    );
  }

  return (
    <Container>
      <Header>
        <HeaderLeft>
          <Title>
            <i className="bi bi-people"></i>
            {t("bands.bandMembers")}
          </Title>
          <MemberCount>{t("bands.memberCount", { count: members.length })}</MemberCount>
        </HeaderLeft>
        <HeaderActions>
          {!isOwner && currentMember && (
            <LeaveButton onClick={handleLeaveBand}>
              <i className="bi bi-box-arrow-right"></i>
              {t("bands.leaveBand")}
            </LeaveButton>
          )}
          {isOwner && (
            <InviteButton onClick={onInviteClick}>
              <i className="bi bi-person-plus"></i>
              {t("bands.inviteMember")}
            </InviteButton>
          )}
        </HeaderActions>
      </Header>

      <MembersList>
        {members.map((member) => {
          const roleColors = getRoleBadgeColor(member.role);
          const isCurrentUser = member.user_id === currentUserId;

          return (
            <MemberCard key={member.id} $isCurrentUser={isCurrentUser}>
              <MemberInfo>
                <Avatar>{getInitials(member.email)}</Avatar>
                <MemberDetails>
                  <MemberEmail>
                    {member.email || t("common.unknown")}
                    {isCurrentUser && <YouBadge>{t("common.you")}</YouBadge>}
                  </MemberEmail>
                  <MemberMeta>
                    {t("common.joined")} {new Date(member.joined_at).toLocaleDateString()}
                    {member.expires_at && (
                      <ExpiryNotice>
                        <i className="bi bi-clock"></i>
                        {t("common.expires")} {new Date(member.expires_at).toLocaleDateString()}
                      </ExpiryNotice>
                    )}
                  </MemberMeta>
                </MemberDetails>
              </MemberInfo>

              <MemberActions>
                {isOwner && member.role !== "owner" ? (
                  <RoleSelect
                    value={member.role}
                    onChange={(e) => handleChangeRole(member, e.target.value as BandRole)}
                  >
                    <option value="admin">{t("bands.admin")}</option>
                    <option value="member">{t("bands.member")}</option>
                    <option value="guest">{t("bands.guest")}</option>
                  </RoleSelect>
                ) : (
                  <RoleBadge $bg={roleColors.bg} $text={roleColors.text} $border={roleColors.border}>
                    {t(`bands.${member.role}`)}
                  </RoleBadge>
                )}

                {isOwner && member.role !== "owner" && !isCurrentUser && (
                  <RemoveButton onClick={() => handleRemoveMember(member)} title={t("bands.removeMember")}>
                    <i className="bi bi-x-lg"></i>
                  </RemoveButton>
                )}
              </MemberActions>
            </MemberCard>
          );
        })}
      </MembersList>

      {isOwner && invitations.length > 0 && (
        <>
          <Divider />
          <InvitationsSection>
            <SectionTitle>
              <i className="bi bi-envelope"></i>
              {t("bands.pendingInvitations")} ({invitations.length})
            </SectionTitle>
            <InvitationsList>
              {invitations.map((invitation) => {
                const isExpired = new Date(invitation.expires_at) < new Date();
                const roleColors = getRoleBadgeColor(invitation.role as BandRole);

                return (
                  <InvitationCard key={invitation.id} $expired={isExpired}>
                    <InvitationInfo>
                      <InvitationIcon>
                        <i className="bi bi-envelope-paper"></i>
                      </InvitationIcon>
                      <InvitationDetails>
                        <InvitationEmail>{invitation.email}</InvitationEmail>
                        <InvitationMeta>
                          <span>
                            <i className="bi bi-person"></i>
                            {t("bands.invitedBy")} {invitation.inviter_name || t("common.unknown")}
                          </span>
                          <RoleBadge $bg={roleColors.bg} $text={roleColors.text} $border={roleColors.border}>
                            {t(`bands.${invitation.role}`)}
                          </RoleBadge>
                        </InvitationMeta>
                        <InvitationMeta>
                          <span>
                            <i className="bi bi-calendar"></i>
                            {t("common.expires")} {new Date(invitation.expires_at).toLocaleDateString()}
                          </span>
                          {isExpired && <ExpiredBadge>{t("bands.expired")}</ExpiredBadge>}
                        </InvitationMeta>
                      </InvitationDetails>
                    </InvitationInfo>
                    <InvitationActions>
                      <CopyLinkButton
                        onClick={() => copyInvitationLink(invitation)}
                        title={t("bands.copyInviteLink")}
                      >
                        <i className="bi bi-link-45deg"></i>
                      </CopyLinkButton>
                      <RevokeButton
                        onClick={() => handleRevokeInvitation(invitation)}
                        title={t("bands.revokeInvitation")}
                      >
                        <i className="bi bi-x-lg"></i>
                      </RevokeButton>
                    </InvitationActions>
                  </InvitationCard>
                );
              })}
            </InvitationsList>
          </InvitationsSection>
        </>
      )}
    </Container>
  );
};

// Styled Components

const Container = styled.div`
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.lg};
  overflow: hidden;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${theme.space[5]};
  border-bottom: 1px solid var(--color-border);

  @media (max-width: ${theme.breakpoints.md}) {
    flex-direction: column;
    align-items: flex-start;
    gap: ${theme.space[4]};
  }
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[4]};
`;

const Title = styled.h3`
  font-size: ${theme.fontSizes.h3};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};

  i {
    color: ${theme.colors.brand.primary};
    font-size: ${theme.fontSizes.h2};
  }
`;

const MemberCount = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
  background: var(--color-bg-tertiary);
  padding: ${theme.space[1]} ${theme.space[3]};
  border-radius: ${theme.radius.full};
  font-weight: ${theme.fontWeights.medium};
`;

const HeaderActions = styled.div`
  display: flex;
  gap: ${theme.space[3]};
`;

const InviteButton = styled.button`
  background: ${theme.colors.brand.primary};
  border: none;
  color: white;
  padding: ${theme.space[2]} ${theme.space[5]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};

  i {
    font-size: ${theme.fontSizes.body};
  }

  &:hover {
    background: ${theme.colors.brand.primaryHover};
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  &:active {
    transform: translateY(0);
  }
`;

const LeaveButton = styled.button`
  background: transparent;
  border: 1px solid ${theme.colors.semantic.error};
  color: ${theme.colors.semantic.error};
  padding: ${theme.space[2]} ${theme.space[5]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};

  i {
    font-size: ${theme.fontSizes.body};
  }

  &:hover {
    background: ${theme.colors.semantic.errorBgDark};
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;

const MembersList = styled.div`
  padding: ${theme.space[4]};
  display: flex;
  flex-direction: column;
  gap: ${theme.space[3]};
`;

const MemberCard = styled.div<{ $isCurrentUser: boolean }>`
  background: ${(props) =>
    props.$isCurrentUser ? 'var(--color-bg-elevated)' : 'var(--color-bg-primary)'};
  border: 1px solid ${(props) =>
    props.$isCurrentUser ? theme.colors.brand.primary : 'var(--color-border)'};
  border-radius: ${theme.radius.base};
  padding: ${theme.space[4]};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${theme.space[4]};
  transition: all ${theme.transitions.fast} ease;

  &:hover {
    border-color: ${theme.colors.brand.primary};
  }

  @media (max-width: ${theme.breakpoints.sm}) {
    flex-direction: column;
    align-items: flex-start;
  }
`;

const MemberInfo = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  flex: 1;
  min-width: 0;
`;

const Avatar = styled.div`
  width: 48px;
  height: 48px;
  border-radius: ${theme.radius.full};
  background: ${theme.gradients.brandPrimary};
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${theme.fontSizes.h3};
  font-weight: ${theme.fontWeights.bold};
  flex-shrink: 0;
`;

const MemberDetails = styled.div`
  flex: 1;
  min-width: 0;
`;

const MemberEmail = styled.div`
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.medium};
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
`;

const YouBadge = styled.span`
  background: ${theme.colors.brand.primary};
  color: white;
  padding: ${theme.space[1]} ${theme.space[2]};
  border-radius: ${theme.radius.sm};
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.semibold};
  text-transform: uppercase;
  letter-spacing: ${theme.letterSpacing.wide};
`;

const MemberMeta = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  margin-top: ${theme.space[1]};
`;

const ExpiryNotice = styled.span`
  display: flex;
  align-items: center;
  gap: ${theme.space[1]};
  color: ${theme.colors.semantic.warning};

  i {
    font-size: ${theme.fontSizes.bodyXs};
  }
`;

const MemberActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};

  @media (max-width: ${theme.breakpoints.sm}) {
    width: 100%;
    justify-content: space-between;
  }
`;

const RoleBadge = styled.div<{ $bg: string; $text: string; $border: string }>`
  background: ${(props) => props.$bg};
  color: ${(props) => props.$text};
  border: 1px solid ${(props) => props.$border};
  padding: ${theme.space[2]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  text-transform: uppercase;
  letter-spacing: ${theme.letterSpacing.wide};
  white-space: nowrap;
`;

const RoleSelect = styled.select`
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  padding: ${theme.space[2]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  &:hover {
    border-color: ${theme.colors.brand.primary};
  }

  &:focus {
    outline: none;
    border-color: ${theme.colors.brand.primary};
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  }
`;

const RemoveButton = styled.button`
  background: transparent;
  border: 1px solid var(--color-border);
  color: ${theme.colors.semantic.error};
  width: 36px;
  height: 36px;
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  flex-shrink: 0;

  &:hover {
    background: ${theme.colors.semantic.errorBgDark};
    border-color: ${theme.colors.semantic.error};
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${theme.space[12]};
  gap: ${theme.space[4]};

  p {
    font-size: ${theme.fontSizes.body};
    color: var(--color-text-secondary);
    margin: 0;
  }
`;

const Divider = styled.div`
  height: 1px;
  background: var(--color-border);
  margin: ${theme.space[6]} ${theme.space[5]};
`;

const InvitationsSection = styled.div`
  padding: ${theme.space[5]};
`;

const SectionTitle = styled.h4`
  font-size: ${theme.fontSizes.h4};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin: 0 0 ${theme.space[4]} 0;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};

  i {
    color: ${theme.colors.brand.primary};
    font-size: ${theme.fontSizes.h3};
  }
`;

const InvitationsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[3]};
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
  min-width: 0;
`;

const InvitationIcon = styled.div`
  width: 40px;
  height: 40px;
  border-radius: ${theme.radius.base};
  background: ${theme.colors.brand.primary};
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${theme.fontSizes.bodyLg};
  flex-shrink: 0;
`;

const InvitationDetails = styled.div`
  flex: 1;
  min-width: 0;
`;

const InvitationEmail = styled.div`
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.medium};
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const InvitationMeta = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  margin-top: ${theme.space[1]};
  flex-wrap: wrap;

  i {
    font-size: ${theme.fontSizes.bodyXs};
  }
`;

const ExpiredBadge = styled.span`
  background: ${theme.colors.semantic.errorBgDark};
  color: ${theme.colors.semantic.error};
  padding: ${theme.space[1]} ${theme.space[2]};
  border-radius: ${theme.radius.sm};
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.semibold};
  text-transform: uppercase;
  letter-spacing: ${theme.letterSpacing.wide};
`;

const InvitationActions = styled.div`
  display: flex;
  gap: ${theme.space[2]};
  flex-shrink: 0;
`;

const CopyLinkButton = styled.button`
  background: ${theme.colors.brand.primary};
  border: none;
  color: white;
  width: 36px;
  height: 36px;
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  font-size: ${theme.fontSizes.bodyLg};

  &:hover {
    background: ${theme.colors.brand.primaryHover};
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;

const RevokeButton = styled.button`
  background: transparent;
  border: 1px solid var(--color-border);
  color: ${theme.colors.semantic.error};
  width: 36px;
  height: 36px;
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  &:hover {
    background: ${theme.colors.semantic.errorBgDark};
    border-color: ${theme.colors.semantic.error};
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;
