import type { FC } from "react";
import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Container, Spinner, Button } from "reactstrap";
import styled from "styled-components";
import { theme } from "../theme";
import { useBandContext } from "../context/useBandContext";
import {
  getRequest,
  deleteRequest,
  approveRequest,
  rejectRequest,
  markRequestInProgress,
  markRequestCompleted,
  withdrawRequest,
  getRequestComments,
  addComment,
  deleteComment,
  toggleVote,
  getRequestTypeIcon,
  getRequestStatusColor,
  type Request,
  type RequestComment,
} from "../services/requestsService";
import { getUserBandRole, canManageBandSettings } from "../services/bandMembersService";
import { SEO } from "./SEO";

const RequestDetailView: FC = () => {
  const { t } = useTranslation();
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const { user } = useBandContext();

  const [request, setRequest] = useState<Request | null>(null);
  const [comments, setComments] = useState<RequestComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [isCreator, setIsCreator] = useState(false);

  const loadRequest = async () => {
    if (!requestId) return;

    setLoading(true);
    try {
      const data = await getRequest(requestId);
      setRequest(data);

      // Check permissions
      if (data.band_id) {
        const role = await getUserBandRole(data.band_id);
        setCanManage(canManageBandSettings(role));
        setIsCreator(data.created_by === user?.id);
      }

      // Load comments
      const commentsData = await getRequestComments(requestId);
      setComments(commentsData);
    } catch (error) {
      console.error("Failed to load request:", error);
      setRequest(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user && requestId) {
      loadRequest();
    }
  }, [user, requestId]);

  const handleApprove = async () => {
    if (!request) return;
    try {
      await approveRequest(request.id);
      await loadRequest();
    } catch (error) {
      console.error("Failed to approve:", error);
      alert(t("requests.approveError"));
    }
  };

  const handleReject = async () => {
    if (!request) return;
    const confirmed = window.confirm(t("requests.confirmReject", { title: request.title }));
    if (!confirmed) return;

    try {
      await rejectRequest(request.id);
      await loadRequest();
    } catch (error) {
      console.error("Failed to reject:", error);
      alert(t("requests.rejectError"));
    }
  };

  const handleMarkInProgress = async () => {
    if (!request) return;
    try {
      await markRequestInProgress(request.id);
      await loadRequest();
    } catch (error) {
      console.error("Failed to mark in progress:", error);
    }
  };

  const handleMarkCompleted = async () => {
    if (!request) return;
    try {
      await markRequestCompleted(request.id);
      await loadRequest();
    } catch (error) {
      console.error("Failed to mark completed:", error);
    }
  };

  const handleWithdraw = async () => {
    if (!request) return;
    const confirmed = window.confirm(t("requests.confirmWithdraw"));
    if (!confirmed) return;

    try {
      await withdrawRequest(request.id);
      await loadRequest();
    } catch (error) {
      console.error("Failed to withdraw:", error);
    }
  };

  const handleDelete = async () => {
    if (!request) return;
    const confirmed = window.confirm(t("requests.confirmDelete", { title: request.title }));
    if (!confirmed) return;

    try {
      await deleteRequest(request.id);
      navigate("/requests");
    } catch (error) {
      console.error("Failed to delete:", error);
      alert(t("requests.deleteError"));
    }
  };

  const handleVote = async (voteType: "up" | "down") => {
    if (!request) return;
    try {
      await toggleVote(request.id, voteType);
      await loadRequest();
    } catch (error) {
      console.error("Failed to vote:", error);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!request || !newComment.trim()) return;

    setSubmittingComment(true);
    try {
      await addComment(request.id, newComment.trim());
      setNewComment("");
      const commentsData = await getRequestComments(request.id);
      setComments(commentsData);
    } catch (error) {
      console.error("Failed to add comment:", error);
      alert(t("requests.commentError"));
    }
    setSubmittingComment(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    const confirmed = window.confirm(t("requests.confirmDeleteComment"));
    if (!confirmed) return;

    try {
      await deleteComment(commentId);
      const commentsData = await getRequestComments(request!.id);
      setComments(commentsData);
    } catch (error) {
      console.error("Failed to delete comment:", error);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderNewSongDetails = () => {
    if (!request || request.request_type !== "new_song" || !request.request_data) {
      return null;
    }
    const data = request.request_data as { artist?: string; song_name?: string; reference_url?: string };
    return (
      <DataSection>
        <SectionTitle>{t("requests.songDetails")}</SectionTitle>
        <DataGrid>
          {data.artist && (
            <DataItem>
              <DataLabel>{t("songs.artist")}</DataLabel>
              <DataValue>{data.artist}</DataValue>
            </DataItem>
          )}
          {data.song_name && (
            <DataItem>
              <DataLabel>{t("requests.songName")}</DataLabel>
              <DataValue>{data.song_name}</DataValue>
            </DataItem>
          )}
          {data.reference_url && (
            <DataItem>
              <DataLabel>{t("requests.referenceUrl")}</DataLabel>
              <DataLink href={data.reference_url} target="_blank" rel="noopener noreferrer">
                {data.reference_url}
              </DataLink>
            </DataItem>
          )}
        </DataGrid>
      </DataSection>
    );
  };

  const renderSongChangeDetails = () => {
    if (!request || request.request_type !== "song_change" || !request.request_data?.proposed_changes) {
      return null;
    }
    const changes = String(request.request_data.proposed_changes);
    return (
      <DataSection>
        <SectionTitle>{t("requests.proposedChanges")}</SectionTitle>
        <DescriptionText>{changes}</DescriptionText>
      </DataSection>
    );
  };

  if (loading) {
    return (
      <PageWrapper>
        <Container>
          <LoadingContainer>
            <Spinner color="primary" style={{ width: "3rem", height: "3rem" }} />
            <LoadingText>{t("requests.loadingDetail")}</LoadingText>
          </LoadingContainer>
        </Container>
      </PageWrapper>
    );
  }

  if (!request) {
    return (
      <PageWrapper>
        <Container>
          <NotFoundCard>
            <NotFoundIcon>
              <i className="bi bi-question-circle"></i>
            </NotFoundIcon>
            <NotFoundTitle>{t("requests.notFound")}</NotFoundTitle>
            <NotFoundText>{t("requests.notFoundText")}</NotFoundText>
            <BackButton as={Link} to="/requests">
              {t("requests.backToRequests")}
            </BackButton>
          </NotFoundCard>
        </Container>
      </PageWrapper>
    );
  }

  const statusColor = getRequestStatusColor(request.status);
  const typeIcon = getRequestTypeIcon(request.request_type);
  const isPending = request.status === "pending";
  const isApproved = request.status === "approved";
  const isInProgress = request.status === "in_progress";
  const canWithdraw = (isCreator || canManage) && ["pending", "approved"].includes(request.status);

  return (
    <PageWrapper>
      <SEO title={request.title} />
      <Container>
        <BackLink to="/requests">
          <i className="bi bi-arrow-left"></i>
          {t("requests.backToRequests")}
        </BackLink>

        <DetailCard>
          <DetailHeader>
            <HeaderLeft>
              <TypeIconLarge className={typeIcon} />
              <HeaderInfo>
                <TypeLabel>{t(`requests.types.${request.request_type}`)}</TypeLabel>
                <RequestTitle>{request.title}</RequestTitle>
                <MetaRow>
                  <MetaItem>
                    <i className="bi bi-person"></i>
                    {request.creator_name}
                  </MetaItem>
                  <MetaItem>
                    <i className="bi bi-calendar"></i>
                    {formatDate(request.created_at)}
                  </MetaItem>
                </MetaRow>
              </HeaderInfo>
            </HeaderLeft>

            <VoteSection>
              <VoteButton
                $active={request.user_vote === "up"}
                onClick={() => handleVote("up")}
              >
                <i className="bi bi-arrow-up"></i>
              </VoteButton>
              <VoteCount
                $positive={(request.vote_count ?? 0) > 0}
                $negative={(request.vote_count ?? 0) < 0}
              >
                {request.vote_count ?? 0}
              </VoteCount>
              <VoteButton
                $active={request.user_vote === "down"}
                onClick={() => handleVote("down")}
              >
                <i className="bi bi-arrow-down"></i>
              </VoteButton>
            </VoteSection>
          </DetailHeader>

          <StatusSection>
            <StatusBadge $color={statusColor}>
              {t(`requests.status.${request.status}`)}
            </StatusBadge>

            {/* Admin actions */}
            {canManage && isPending && (
              <ActionGroup>
                <ActionButton $variant="approve" onClick={handleApprove}>
                  <i className="bi bi-check-lg"></i>
                  {t("requests.approve")}
                </ActionButton>
                <ActionButton $variant="reject" onClick={handleReject}>
                  <i className="bi bi-x-lg"></i>
                  {t("requests.reject")}
                </ActionButton>
              </ActionGroup>
            )}

            {canManage && isApproved && (
              <ActionGroup>
                <ActionButton $variant="progress" onClick={handleMarkInProgress}>
                  <i className="bi bi-play"></i>
                  {t("requests.markInProgress")}
                </ActionButton>
              </ActionGroup>
            )}

            {canManage && isInProgress && (
              <ActionGroup>
                <ActionButton $variant="complete" onClick={handleMarkCompleted}>
                  <i className="bi bi-check-circle"></i>
                  {t("requests.markCompleted")}
                </ActionButton>
              </ActionGroup>
            )}

            {canWithdraw && (
              <ActionButton $variant="withdraw" onClick={handleWithdraw}>
                <i className="bi bi-arrow-counterclockwise"></i>
                {t("requests.withdraw")}
              </ActionButton>
            )}
          </StatusSection>

          {request.description && (
            <DescriptionSection>
              <SectionTitle>{t("requests.description")}</SectionTitle>
              <DescriptionText>{request.description}</DescriptionText>
            </DescriptionSection>
          )}

          {/* Type-specific data */}
          {renderNewSongDetails()}
          {renderSongChangeDetails()}

          {request.resolution_notes && (
            <ResolutionSection>
              <SectionTitle>{t("requests.resolutionNotes")}</SectionTitle>
              <DescriptionText>{request.resolution_notes}</DescriptionText>
              {request.resolved_by && (
                <ResolverInfo>
                  {t("requests.resolvedBy")} {request.resolver_name} -{" "}
                  {formatDate(request.resolved_at!)}
                </ResolverInfo>
              )}
            </ResolutionSection>
          )}

          <DeleteSection>
            <Button color="danger" outline onClick={handleDelete}>
              <i className="bi bi-trash me-2"></i>
              {t("requests.deleteRequest")}
            </Button>
          </DeleteSection>
        </DetailCard>

        {/* Comments Section */}
        <CommentsCard>
          <SectionTitle>
            <i className="bi bi-chat-dots me-2"></i>
            {t("requests.comments")} ({comments.length})
          </SectionTitle>

          <CommentForm onSubmit={handleAddComment}>
            <CommentInput
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={t("requests.addComment")}
              rows={2}
            />
            <CommentSubmit
              type="submit"
              disabled={submittingComment || !newComment.trim()}
            >
              {submittingComment ? t("common.sending") : t("requests.postComment")}
            </CommentSubmit>
          </CommentForm>

          {comments.length === 0 ? (
            <EmptyComments>{t("requests.noComments")}</EmptyComments>
          ) : (
            <CommentsList>
              {comments.map((comment) => (
                <CommentItem key={comment.id}>
                  <CommentHeader>
                    <CommentAuthor>{comment.user_name}</CommentAuthor>
                    <CommentDate>{formatDate(comment.created_at)}</CommentDate>
                    {(comment.user_id === user?.id || canManage) && (
                      <DeleteCommentButton
                        onClick={() => handleDeleteComment(comment.id)}
                        title={t("common.delete")}
                      >
                        <i className="bi bi-trash"></i>
                      </DeleteCommentButton>
                    )}
                  </CommentHeader>
                  <CommentContent>{comment.content}</CommentContent>
                </CommentItem>
              ))}
            </CommentsList>
          )}
        </CommentsCard>
      </Container>
    </PageWrapper>
  );
};

// Styled Components

const PageWrapper = styled.div`
  min-height: calc(100vh - 80px);
  background: var(--color-bg-primary);
  padding: ${theme.space[8]} 0;

  @media (max-width: ${theme.breakpoints.md}) {
    padding: ${theme.space[6]} 0;
  }
`;

const BackLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[2]};
  color: var(--color-text-secondary);
  text-decoration: none;
  font-size: ${theme.fontSizes.bodySm};
  margin-bottom: ${theme.space[4]};
  transition: color ${theme.transitions.fast} ease;

  &:hover {
    color: ${theme.colors.brand.primary};
  }
`;

const DetailCard = styled.div`
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.lg};
  padding: ${theme.space[6]};
  margin-bottom: ${theme.space[6]};
`;

const DetailHeader = styled.div`
  display: flex;
  justify-content: space-between;
  gap: ${theme.space[4]};
  margin-bottom: ${theme.space[6]};

  @media (max-width: ${theme.breakpoints.sm}) {
    flex-direction: column;
  }
`;

const HeaderLeft = styled.div`
  display: flex;
  gap: ${theme.space[4]};
`;

const TypeIconLarge = styled.i`
  font-size: ${theme.fontSizes.displayMd};
  color: ${theme.colors.brand.primary};
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${theme.colors.brand.primary}20;
  border-radius: ${theme.radius.lg};
  flex-shrink: 0;
`;

const HeaderInfo = styled.div`
  flex: 1;
`;

const TypeLabel = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.brand.primary};
  font-weight: ${theme.fontWeights.medium};
  margin-bottom: ${theme.space[1]};
`;

const RequestTitle = styled.h1`
  font-size: ${theme.fontSizes.h2};
  font-weight: ${theme.fontWeights.bold};
  color: var(--color-text-primary);
  margin: 0 0 ${theme.space[2]} 0;
`;

const MetaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${theme.space[4]};
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

const VoteSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${theme.space[1]};
`;

const VoteButton = styled.button<{ $active: boolean }>`
  background: ${(props) =>
    props.$active ? theme.colors.brand.primary : "transparent"};
  border: 1px solid
    ${(props) => (props.$active ? theme.colors.brand.primary : "var(--color-border)")};
  color: ${(props) => (props.$active ? "white" : "var(--color-text-secondary)")};
  width: 40px;
  height: 40px;
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  font-size: ${theme.fontSizes.bodyLg};

  &:hover {
    background: ${(props) =>
      props.$active ? theme.colors.brand.primaryHover : "var(--color-bg-tertiary)"};
    border-color: ${theme.colors.brand.primary};
    color: ${(props) => (props.$active ? "white" : theme.colors.brand.primary)};
  }
`;

const VoteCount = styled.span<{ $positive: boolean; $negative: boolean }>`
  font-size: ${theme.fontSizes.h3};
  font-weight: ${theme.fontWeights.bold};
  color: ${(props) =>
    props.$positive
      ? theme.colors.semantic.success
      : props.$negative
      ? theme.colors.semantic.error
      : "var(--color-text-secondary)"};
`;

const StatusSection = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[4]};
  flex-wrap: wrap;
  padding: ${theme.space[4]};
  background: var(--color-bg-tertiary);
  border-radius: ${theme.radius.base};
  margin-bottom: ${theme.space[6]};
`;

const StatusBadge = styled.span<{ $color: string }>`
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  text-transform: uppercase;
  letter-spacing: ${theme.letterSpacing.wide};
  padding: ${theme.space[2]} ${theme.space[3]};
  border-radius: ${theme.radius.base};
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
        return "var(--color-bg-secondary)";
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

const ActionGroup = styled.div`
  display: flex;
  gap: ${theme.space[2]};
`;

const ActionButton = styled.button<{
  $variant: "approve" | "reject" | "progress" | "complete" | "withdraw";
}>`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  padding: ${theme.space[2]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  border: 1px solid;
  background: ${(props) => {
    if (props.$variant === "approve") return theme.colors.semantic.successBgDark;
    if (props.$variant === "reject") return theme.colors.semantic.warningBgDark;
    if (props.$variant === "progress") return theme.colors.accent.cyan + "20";
    if (props.$variant === "complete") return theme.colors.semantic.successBgDark;
    return "var(--color-bg-secondary)";
  }};
  border-color: ${(props) => {
    if (props.$variant === "approve") return theme.colors.semantic.success;
    if (props.$variant === "reject") return theme.colors.accent.amber;
    if (props.$variant === "progress") return theme.colors.accent.cyan;
    if (props.$variant === "complete") return theme.colors.semantic.success;
    return "var(--color-border)";
  }};
  color: ${(props) => {
    if (props.$variant === "approve") return theme.colors.semantic.success;
    if (props.$variant === "reject") return theme.colors.accent.amber;
    if (props.$variant === "progress") return theme.colors.accent.cyan;
    if (props.$variant === "complete") return theme.colors.semantic.success;
    return "var(--color-text-secondary)";
  }};

  &:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }
`;

const SectionTitle = styled.h3`
  font-size: ${theme.fontSizes.bodyLg};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin: 0 0 ${theme.space[3]} 0;
  display: flex;
  align-items: center;
`;

const DescriptionSection = styled.div`
  margin-bottom: ${theme.space[6]};
`;

const DescriptionText = styled.p`
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-secondary);
  line-height: ${theme.lineHeights.relaxed};
  margin: 0;
  white-space: pre-wrap;
`;

const DataSection = styled.div`
  margin-bottom: ${theme.space[6]};
`;

const DataGrid = styled.div`
  display: grid;
  gap: ${theme.space[3]};
`;

const DataItem = styled.div``;

const DataLabel = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-tertiary);
  margin-bottom: ${theme.space[1]};
`;

const DataValue = styled.div`
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-primary);
`;

const DataLink = styled.a`
  font-size: ${theme.fontSizes.body};
  color: ${theme.colors.brand.primary};
  text-decoration: none;
  word-break: break-all;

  &:hover {
    text-decoration: underline;
  }
`;

const ResolutionSection = styled.div`
  margin-bottom: ${theme.space[6]};
  padding: ${theme.space[4]};
  background: var(--color-bg-tertiary);
  border-radius: ${theme.radius.base};
  border-left: 3px solid ${theme.colors.brand.primary};
`;

const ResolverInfo = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-tertiary);
  margin-top: ${theme.space[2]};
`;

const DeleteSection = styled.div`
  padding-top: ${theme.space[4]};
  border-top: 1px solid var(--color-border);
`;

const CommentsCard = styled.div`
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.lg};
  padding: ${theme.space[6]};
`;

const CommentForm = styled.form`
  margin-bottom: ${theme.space[6]};
`;

const CommentInput = styled.textarea`
  width: 100%;
  padding: ${theme.space[3]};
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.base};
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  font-size: ${theme.fontSizes.body};
  resize: vertical;
  margin-bottom: ${theme.space[2]};

  &:focus {
    outline: none;
    border-color: ${theme.colors.brand.primary};
  }
`;

const CommentSubmit = styled.button`
  background: ${theme.gradients.brandPrimary};
  color: white;
  border: none;
  padding: ${theme.space[2]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const EmptyComments = styled.div`
  text-align: center;
  padding: ${theme.space[6]};
  color: var(--color-text-tertiary);
  font-size: ${theme.fontSizes.body};
`;

const CommentsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[4]};
`;

const CommentItem = styled.div`
  padding: ${theme.space[4]};
  background: var(--color-bg-tertiary);
  border-radius: ${theme.radius.base};
`;

const CommentHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  margin-bottom: ${theme.space[2]};
`;

const CommentAuthor = styled.span`
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
`;

const CommentDate = styled.span`
  font-size: ${theme.fontSizes.bodyXs};
  color: var(--color-text-tertiary);
`;

const DeleteCommentButton = styled.button`
  background: transparent;
  border: none;
  color: var(--color-text-tertiary);
  cursor: pointer;
  padding: ${theme.space[1]};
  margin-left: auto;
  transition: color ${theme.transitions.fast} ease;

  &:hover {
    color: ${theme.colors.semantic.error};
  }
`;

const CommentContent = styled.p`
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-secondary);
  line-height: ${theme.lineHeights.relaxed};
  margin: 0;
  white-space: pre-wrap;
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

const NotFoundCard = styled.div`
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.lg};
  padding: ${theme.space[12]};
  text-align: center;
  margin-top: ${theme.space[12]};
`;

const NotFoundIcon = styled.div`
  font-size: ${theme.fontSizes.displayLg};
  color: var(--color-text-tertiary);
  margin-bottom: ${theme.space[4]};
  opacity: 0.5;
`;

const NotFoundTitle = styled.h2`
  font-size: ${theme.fontSizes.h2};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin-bottom: ${theme.space[2]};
`;

const NotFoundText = styled.p`
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-secondary);
  margin-bottom: ${theme.space[6]};
`;

const BackButton = styled(Button)`
  background: ${theme.gradients.brandPrimary} !important;
  border: none !important;
`;

export default RequestDetailView;
