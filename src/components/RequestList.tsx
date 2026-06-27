import { useState, type FC } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Request } from "../services/requestsService";
import {
  approveRequest,
  rejectRequest,
  toggleVote,
  getRequestTypeIcon,
  getRequestStatusColor,
} from "../services/requestsService";
import styled from "styled-components";
import { theme } from "../theme";
import {
  Dropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
} from "reactstrap";
import { ConfirmModal } from "./ConfirmModal";
import { useToast } from "../context/useToast";

interface Props {
  requests: Request[];
  onDelete: (request: Request) => void;
  onReload: () => void;
  canManage?: boolean;
}

type ConfirmState = {
  title: string;
  message: string;
  confirmLabel: string;
  action: () => Promise<void>;
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const RequestCardItem: FC<{
  request: Request;
  onDelete: (request: Request) => void;
  onView: (requestId: string) => void;
  onApprove: (request: Request) => void;
  onReject: (request: Request) => void;
  onVote: (request: Request, voteType: "up" | "down") => void;
  canManage: boolean;
}> = ({ request, onDelete, onView, onApprove, onReject, onVote, canManage }) => {
  const { t } = useTranslation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const toggleDropdown = () => setDropdownOpen((prev) => !prev);

  const isPending = request.status === "pending";
  const statusColor = getRequestStatusColor(request.status);
  const typeIcon = getRequestTypeIcon(request.request_type);

  return (
    <RequestCard onClick={() => onView(request.id)}>
      <RequestHeader>
        <TypeIcon className={typeIcon} />

        <RequestInfo>
          <RequestTitle>{request.title}</RequestTitle>
          <RequestMeta>
            <MetaItem>
              <i className="bi bi-person"></i>
              {request.creator_name}
            </MetaItem>
            <MetaItem>
              <i className="bi bi-calendar"></i>
              {formatDate(request.created_at)}
            </MetaItem>
            <TypeBadge>
              {t(`requests.types.${request.request_type}`)}
            </TypeBadge>
          </RequestMeta>
          <StatusRow>
            <StatusBadge $color={statusColor}>
              {t(`requests.status.${request.status}`)}
            </StatusBadge>
            {(request.comment_count ?? 0) > 0 && (
              <CommentBadge>
                <i className="bi bi-chat"></i>
                {request.comment_count}
              </CommentBadge>
            )}
          </StatusRow>
        </RequestInfo>

        <VoteSection onClick={(e) => e.stopPropagation()}>
          <VoteButton
            $active={request.user_vote === "up"}
            onClick={() => onVote(request, "up")}
            title={t("requests.upvote")}
          >
            <i className="bi bi-arrow-up"></i>
          </VoteButton>
          <VoteCount $positive={(request.vote_count ?? 0) > 0} $negative={(request.vote_count ?? 0) < 0}>
            {request.vote_count ?? 0}
          </VoteCount>
          <VoteButton
            $active={request.user_vote === "down"}
            onClick={() => onVote(request, "down")}
            title={t("requests.downvote")}
          >
            <i className="bi bi-arrow-down"></i>
          </VoteButton>
        </VoteSection>

        {/* Desktop action buttons */}
        <ActionButtons>
          {canManage && isPending && (
            <>
              <ActionButton
                onClick={(e) => {
                  e.stopPropagation();
                  onApprove(request);
                }}
                title={t("requests.approve")}
                $variant="approve"
              >
                <i className="bi bi-check-lg"></i>
              </ActionButton>
              <ActionButton
                onClick={(e) => {
                  e.stopPropagation();
                  onReject(request);
                }}
                title={t("requests.reject")}
                $variant="reject"
              >
                <i className="bi bi-x-lg"></i>
              </ActionButton>
            </>
          )}
          <ActionButton
            onClick={(e) => {
              e.stopPropagation();
              onDelete(request);
            }}
            title={t("common.delete")}
            $variant="delete"
          >
            <i className="bi bi-trash"></i>
          </ActionButton>
        </ActionButtons>

        {/* Mobile dropdown */}
        <MobileDropdownWrapper onClick={(e) => e.stopPropagation()}>
          <Dropdown isOpen={dropdownOpen} toggle={toggleDropdown}>
            <DropdownToggle tag="button" className="mobile-actions-toggle">
              <i className="bi bi-three-dots-vertical"></i>
            </DropdownToggle>
            <DropdownMenu end dark container="body">
              {canManage && isPending && (
                <>
                  <DropdownItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onApprove(request);
                    }}
                  >
                    <i className="bi bi-check-lg me-2 text-success"></i>
                    {t("requests.approve")}
                  </DropdownItem>
                  <DropdownItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onReject(request);
                    }}
                  >
                    <i className="bi bi-x-lg me-2 text-warning"></i>
                    {t("requests.reject")}
                  </DropdownItem>
                  <DropdownItem divider />
                </>
              )}
              <DropdownItem
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(request);
                }}
                className="text-danger"
              >
                <i className="bi bi-trash me-2"></i>
                {t("common.delete")}
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </MobileDropdownWrapper>
      </RequestHeader>

      {request.description && (
        <RequestDescription>{request.description}</RequestDescription>
      )}
    </RequestCard>
  );
};

export const RequestList: FC<Props> = ({
  requests,
  onDelete,
  onReload,
  canManage = false,
}) => {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

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

  const handleViewRequest = (requestId: string) => {
    navigate(`/requests/${requestId}`);
  };

  const handleApprove = async (request: Request) => {
    try {
      await approveRequest(request.id);
      onReload();
    } catch (error) {
      console.error("Failed to approve request:", error);
      toast.error(t("requests.approveError"));
    }
  };

  const handleReject = async (request: Request) => {
    setConfirm({
      title: t("requests.reject"),
      message: t("requests.confirmReject", { title: request.title }),
      confirmLabel: t("requests.reject"),
      action: async () => {
        try {
          await rejectRequest(request.id);
          onReload();
        } catch (error) {
          console.error("Failed to reject request:", error);
          toast.error(t("requests.rejectError"));
        }
      },
    });
  };

  const handleVote = async (request: Request, voteType: "up" | "down") => {
    try {
      await toggleVote(request.id, voteType);
      onReload();
    } catch (error) {
      console.error("Failed to vote:", error);
    }
  };

  return (
    <RequestsGrid>
      {requests.map((request) => (
        <RequestCardItem
          key={request.id}
          request={request}
          onDelete={onDelete}
          onView={handleViewRequest}
          onApprove={handleApprove}
          onReject={handleReject}
          onVote={handleVote}
          canManage={canManage}
        />
      ))}
      <ConfirmModal
        isOpen={confirm !== null}
        title={confirm?.title ?? ""}
        message={confirm?.message ?? ""}
        confirmLabel={confirm?.confirmLabel}
        tone="danger"
        busy={confirmBusy}
        onConfirm={runConfirm}
        onClose={() => setConfirm(null)}
      />
    </RequestsGrid>
  );
};

// Styled Components

const RequestsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: ${theme.space[4]};
  margin-top: ${theme.space[4]};

  @media (max-width: ${theme.breakpoints.md}) {
    grid-template-columns: 1fr;
  }
`;

const RequestCard = styled.div`
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.lg};
  overflow: hidden;
  transition: all ${theme.transitions.base} ease;
  cursor: pointer;

  &:hover {
    border-color: ${theme.colors.brand.primary};
    box-shadow: var(--shadow-md);
  }
`;

const RequestHeader = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${theme.space[3]};
  padding: ${theme.space[4]};
`;

const TypeIcon = styled.i`
  font-size: ${theme.fontSizes.h3};
  color: ${theme.colors.brand.primary};
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${theme.colors.brand.primary}20;
  border-radius: ${theme.radius.base};
`;

const RequestInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const RequestTitle = styled.h3`
  font-size: ${theme.fontSizes.bodyLg};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin: 0 0 ${theme.space[2]} 0;
  line-height: ${theme.lineHeights.snug};
`;

const RequestMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${theme.space[3]};
  margin-bottom: ${theme.space[2]};
`;

const MetaItem = styled.span`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  gap: ${theme.space[1]};

  i {
    font-size: ${theme.fontSizes.bodyXs};
  }
`;

const TypeBadge = styled.span`
  font-size: ${theme.fontSizes.bodyXs};
  color: ${theme.colors.brand.primary};
  background: ${theme.colors.brand.primary}15;
  padding: ${theme.space[1]} ${theme.space[2]};
  border-radius: ${theme.radius.sm};
  font-weight: ${theme.fontWeights.medium};
`;

const StatusRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
`;

const StatusBadge = styled.span<{ $color: string }>`
  display: inline-flex;
  align-items: center;
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.semibold};
  text-transform: uppercase;
  letter-spacing: ${theme.letterSpacing.wide};
  padding: ${theme.space[1]} ${theme.space[2]};
  border-radius: ${theme.radius.sm};
  background: ${(props) => {
    switch (props.$color) {
      case "warning":
        return theme.colors.semantic.warningBgDark;
      case "success":
        return theme.colors.semantic.successBgDark;
      case "danger":
        return theme.colors.semantic.errorBgDark;
      case "info":
        return theme.colors.accent.cyan + "20";
      default:
        return "var(--color-bg-tertiary)";
    }
  }};
  color: ${(props) => {
    switch (props.$color) {
      case "warning":
        return theme.colors.accent.amber;
      case "success":
        return theme.colors.semantic.success;
      case "danger":
        return theme.colors.semantic.error;
      case "info":
        return theme.colors.accent.cyan;
      default:
        return "var(--color-text-secondary)";
    }
  }};
`;

const CommentBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[1]};
  font-size: ${theme.fontSizes.bodyXs};
  color: var(--color-text-tertiary);
  background: var(--color-bg-tertiary);
  padding: ${theme.space[1]} ${theme.space[2]};
  border-radius: ${theme.radius.sm};
`;

const VoteSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${theme.space[1]};
  flex-shrink: 0;
`;

const VoteButton = styled.button<{ $active: boolean }>`
  background: ${(props) =>
    props.$active ? theme.colors.brand.primary : "transparent"};
  border: 1px solid
    ${(props) => (props.$active ? theme.colors.brand.primary : "var(--color-border)")};
  color: ${(props) => (props.$active ? "white" : "var(--color-text-secondary)")};
  width: 28px;
  height: 28px;
  border-radius: ${theme.radius.sm};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  font-size: ${theme.fontSizes.bodySm};

  &:hover {
    background: ${(props) =>
      props.$active ? theme.colors.brand.primaryHover : "var(--color-bg-tertiary)"};
    border-color: ${theme.colors.brand.primary};
    color: ${(props) => (props.$active ? "white" : theme.colors.brand.primary)};
  }
`;

const VoteCount = styled.span<{ $positive: boolean; $negative: boolean }>`
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  color: ${(props) =>
    props.$positive
      ? theme.colors.semantic.success
      : props.$negative
      ? theme.colors.semantic.error
      : "var(--color-text-secondary)"};
`;

const ActionButtons = styled.div`
  display: flex;
  gap: ${theme.space[1]};
  opacity: 0;
  transition: opacity ${theme.transitions.fast} ease;

  ${RequestHeader}:hover & {
    opacity: 1;
  }

  @media (max-width: ${theme.breakpoints.md}) {
    display: none;
  }

  @media (hover: none) and (min-width: ${theme.breakpoints.md}) {
    opacity: 1;
  }
`;

const MobileDropdownWrapper = styled.div`
  display: none;

  @media (max-width: ${theme.breakpoints.md}) {
    display: block;
    flex-shrink: 0;
  }

  .mobile-actions-toggle {
    background: transparent;
    border: 1px solid var(--color-border);
    color: var(--color-text-secondary);
    width: 40px;
    height: 40px;
    border-radius: ${theme.radius.base};
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all ${theme.transitions.fast} ease;
    font-size: ${theme.fontSizes.bodyLg};

    &:hover,
    &:focus {
      background: var(--color-bg-elevated);
      border-color: ${theme.colors.brand.primary};
      color: ${theme.colors.brand.primary};
    }

    &::after {
      display: none;
    }
  }
`;

const ActionButton = styled.button<{
  $variant: "approve" | "reject" | "delete";
}>`
  background: transparent;
  border: 1px solid var(--color-border);
  color: ${(props) => {
    if (props.$variant === "approve") return theme.colors.semantic.success;
    if (props.$variant === "reject") return theme.colors.accent.amber;
    if (props.$variant === "delete") return theme.colors.semantic.error;
    return "var(--color-text-secondary)";
  }};
  width: 32px;
  height: 32px;
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  flex-shrink: 0;
  font-size: ${theme.fontSizes.bodySm};

  &:hover {
    background: ${(props) => {
      if (props.$variant === "approve") return theme.colors.semantic.successBgDark;
      if (props.$variant === "reject") return theme.colors.semantic.warningBgDark;
      if (props.$variant === "delete") return theme.colors.semantic.errorBgDark;
      return "var(--color-bg-elevated)";
    }};
    border-color: ${(props) => {
      if (props.$variant === "approve") return theme.colors.semantic.success;
      if (props.$variant === "reject") return theme.colors.accent.amber;
      if (props.$variant === "delete") return theme.colors.semantic.error;
      return theme.colors.brand.primary;
    }};
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;

const RequestDescription = styled.div`
  padding: ${theme.space[3]} ${theme.space[4]};
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
  line-height: ${theme.lineHeights.relaxed};
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;
