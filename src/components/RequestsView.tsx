import type { FC } from "react";
import type { AppUser } from "../context/offlineAuthController";
import type { Band } from "../services/bandsService";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Spinner, Container, ButtonGroup, Button } from "reactstrap";
import styled from "styled-components";
import { theme } from "../theme";
import {
  getBandRequests,
  deleteRequest,
  type Request,
} from "../services/requestsService";
import { getUserBandRole, canManageBandSettings } from "../services/bandMembersService";
import { RequestList } from "./RequestList";
import { NewRequestModal } from "./NewRequestModal";
import { ConfirmModal } from "./ConfirmModal";
import { SEO } from "./SEO";
import { useToast } from "../context/useToast";

interface Props {
  user: AppUser | null;
  selectedBand: Band | null;
}

type FilterType = "all" | "pending" | "approved" | "completed" | "rejected";

type ConfirmState = {
  title: string;
  message: string;
  confirmLabel: string;
  action: () => Promise<void>;
};

const RequestsView: FC<Props> = ({ user, selectedBand }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("pending");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [canManage, setCanManage] = useState(false);
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

  const loadRequests = async () => {
    if (!selectedBand) {
      setRequests([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await getBandRequests(selectedBand.id);
      setRequests(data);

      // Check permissions
      const role = await getUserBandRole(selectedBand.id);
      setCanManage(canManageBandSettings(role));
    } catch (error) {
      console.error("Failed to load requests:", error);
      setRequests([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user && selectedBand) {
      loadRequests();
    } else {
      setRequests([]);
      setLoading(false);
    }
  }, [user, selectedBand]);

  const handleDeleteRequest = async (request: Request) => {
    setConfirm({
      title: t("requests.deleteRequest"),
      message: t("requests.confirmDelete", { title: request.title }),
      confirmLabel: t("common.delete"),
      action: async () => {
        try {
          await deleteRequest(request.id);
          await loadRequests();
        } catch (error) {
          console.error("Failed to delete request:", error);
          toast.error(t("requests.deleteError"));
        }
      },
    });
  };

  const getFilteredRequests = () => {
    if (filter === "all") return requests;
    if (filter === "completed") {
      return requests.filter((r) => ["completed", "withdrawn"].includes(r.status));
    }
    return requests.filter((r) => r.status === filter);
  };

  const filteredRequests = getFilteredRequests();

  const counts = {
    pending: requests.filter((r) => r.status === "pending").length,
    approved: requests.filter((r) => ["approved", "in_progress"].includes(r.status)).length,
    completed: requests.filter((r) => ["completed", "withdrawn"].includes(r.status)).length,
    rejected: requests.filter((r) => r.status === "rejected").length,
  };

  if (!user) {
    return (
      <PageWrapper>
        <Container>
          <MessageCard>
            <MessageIcon>
              <i className="bi bi-lock"></i>
            </MessageIcon>
            <MessageTitle>{t("common.authRequired")}</MessageTitle>
            <MessageText>{t("requests.pleaseSignIn")}</MessageText>
          </MessageCard>
        </Container>
      </PageWrapper>
    );
  }

  if (!selectedBand) {
    return (
      <PageWrapper>
        <Container>
          <MessageCard>
            <MessageIcon>
              <i className="bi bi-lightbulb"></i>
            </MessageIcon>
            <MessageTitle>{t("bands.noBandSelected")}</MessageTitle>
            <MessageText>{t("requests.selectBand")}</MessageText>
          </MessageCard>
        </Container>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <SEO title={t("requests.title")} description={t("requests.subtitle")} />
      <Container>
        <PageHeader>
          <HeaderContent>
            <BandBadge>
              <i className="bi bi-music-note-beamed"></i>
              {selectedBand.name}
            </BandBadge>
            <PageTitle>{t("requests.title")}</PageTitle>
            <PageSubtitle>{t("requests.subtitle")}</PageSubtitle>
          </HeaderContent>
          <StatsCard>
            <StatItem>
              <StatValue>{counts.pending}</StatValue>
              <StatLabel>{t("requests.status.pending")}</StatLabel>
            </StatItem>
            <StatDivider />
            <StatItem>
              <StatValue>{counts.approved}</StatValue>
              <StatLabel>{t("requests.status.approved")}</StatLabel>
            </StatItem>
            <StatDivider />
            <StatItem>
              <StatValue>{counts.completed}</StatValue>
              <StatLabel>{t("requests.status.completed")}</StatLabel>
            </StatItem>
          </StatsCard>
        </PageHeader>

        <ContentSection>
          <ActionsRow>
            <CreateButton onClick={() => setIsModalOpen(true)}>
              <i className="bi bi-plus-lg"></i>
              {t("requests.createRequest")}
            </CreateButton>
          </ActionsRow>

          <FilterSection>
            <FilterLabel>{t("common.filter")}:</FilterLabel>
            <ButtonGroup>
              <FilterButton
                $active={filter === "pending"}
                onClick={() => setFilter("pending")}
              >
                {t("requests.status.pending")} ({counts.pending})
              </FilterButton>
              <FilterButton
                $active={filter === "approved"}
                onClick={() => setFilter("approved")}
              >
                {t("requests.status.approved")} ({counts.approved})
              </FilterButton>
              <FilterButton
                $active={filter === "completed"}
                onClick={() => setFilter("completed")}
              >
                {t("requests.status.completed")} ({counts.completed})
              </FilterButton>
              <FilterButton
                $active={filter === "rejected"}
                onClick={() => setFilter("rejected")}
              >
                {t("requests.status.rejected")} ({counts.rejected})
              </FilterButton>
              <FilterButton
                $active={filter === "all"}
                onClick={() => setFilter("all")}
              >
                {t("common.all")} ({requests.length})
              </FilterButton>
            </ButtonGroup>
          </FilterSection>

          {loading ? (
            <LoadingContainer>
              <Spinner color="primary" style={{ width: "3rem", height: "3rem" }} />
              <LoadingText>{t("requests.loading")}</LoadingText>
            </LoadingContainer>
          ) : filteredRequests.length === 0 ? (
            <EmptyState>
              <EmptyIcon>
                <i className="bi bi-lightbulb"></i>
              </EmptyIcon>
              <EmptyTitle>
                {filter === "pending"
                  ? t("requests.noPending")
                  : filter === "approved"
                  ? t("requests.noApproved")
                  : filter === "completed"
                  ? t("requests.noCompleted")
                  : filter === "rejected"
                  ? t("requests.noRejected")
                  : t("requests.noRequests")}
              </EmptyTitle>
              <EmptyText>
                {filter === "pending"
                  ? t("requests.createFirst")
                  : t("requests.noRequestsInFilter")}
              </EmptyText>
            </EmptyState>
          ) : (
            <RequestList
              requests={filteredRequests}
              onDelete={handleDeleteRequest}
              onReload={loadRequests}
              canManage={canManage}
            />
          )}
        </ContentSection>

        <NewRequestModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          bandId={selectedBand.id}
          onCreated={loadRequests}
        />
      </Container>

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

const PageHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${theme.space[6]};
  margin-bottom: ${theme.space[8]};
  padding-bottom: ${theme.space[6]};
  border-bottom: 1px solid var(--color-border);

  @media (max-width: ${theme.breakpoints.md}) {
    flex-direction: column;
  }
`;

const HeaderContent = styled.div`
  flex: 1;
`;

const BandBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[2]};
  background: ${theme.gradients.brandPrimary};
  color: white;
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  padding: ${theme.space[2]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  margin-bottom: ${theme.space[4]};

  i {
    font-size: ${theme.fontSizes.body};
  }
`;

const PageTitle = styled.h1`
  font-size: ${theme.fontSizes.displayMd};
  font-weight: ${theme.fontWeights.bold};
  color: var(--color-text-primary);
  margin-bottom: ${theme.space[2]};
  line-height: ${theme.lineHeights.tight};

  @media (max-width: ${theme.breakpoints.md}) {
    font-size: ${theme.fontSizes.h1};
  }
`;

const PageSubtitle = styled.p`
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-secondary);
  margin: 0;
  line-height: ${theme.lineHeights.relaxed};
`;

const StatsCard = styled.div`
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.lg};
  padding: ${theme.space[5]};
  display: flex;
  gap: ${theme.space[6]};

  @media (max-width: ${theme.breakpoints.md}) {
    width: 100%;
    justify-content: center;
  }
`;

const StatItem = styled.div`
  text-align: center;
`;

const StatValue = styled.div`
  font-size: ${theme.fontSizes.displayMd};
  font-weight: ${theme.fontWeights.bold};
  color: ${theme.colors.brand.primary};
  line-height: 1;
  margin-bottom: ${theme.space[2]};
`;

const StatLabel = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: ${theme.letterSpacing.wide};
  font-weight: ${theme.fontWeights.medium};
`;

const StatDivider = styled.div`
  width: 1px;
  background: var(--color-border);
`;

const ContentSection = styled.div`
  max-width: 1200px;
  margin: 0 auto;
`;

const ActionsRow = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-bottom: ${theme.space[4]};
`;

const CreateButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  background: ${theme.gradients.brandPrimary};
  color: white;
  border: none;
  padding: ${theme.space[3]} ${theme.space[5]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  &:active {
    transform: translateY(0);
  }
`;

const FilterSection = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  margin-bottom: ${theme.space[6]};
  flex-wrap: wrap;
`;

const FilterLabel = styled.span`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
  font-weight: ${theme.fontWeights.medium};
`;

const FilterButton = styled(Button)<{ $active: boolean }>`
  background: ${(props) =>
    props.$active ? theme.colors.brand.primary : "transparent"} !important;
  border-color: ${(props) =>
    props.$active ? theme.colors.brand.primary : "var(--color-border)"} !important;
  color: ${(props) =>
    props.$active ? "white" : "var(--color-text-secondary)"} !important;
  font-size: ${theme.fontSizes.bodySm} !important;
  font-weight: ${theme.fontWeights.medium} !important;
  padding: ${theme.space[2]} ${theme.space[4]} !important;

  &:hover {
    background: ${(props) =>
      props.$active
        ? theme.colors.brand.primaryHover
        : "var(--color-bg-tertiary)"} !important;
    border-color: ${theme.colors.brand.primary} !important;
    color: ${(props) =>
      props.$active ? "white" : theme.colors.brand.primary} !important;
  }
`;

const MessageCard = styled.div`
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.lg};
  padding: ${theme.space[12]};
  text-align: center;
  margin-top: ${theme.space[12]};
`;

const MessageIcon = styled.div`
  font-size: ${theme.fontSizes.displayLg};
  color: var(--color-text-tertiary);
  margin-bottom: ${theme.space[4]};
  opacity: 0.5;
`;

const MessageTitle = styled.h2`
  font-size: ${theme.fontSizes.h2};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin-bottom: ${theme.space[2]};
`;

const MessageText = styled.p`
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-secondary);
  margin: 0;
  line-height: ${theme.lineHeights.relaxed};
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

const EmptyState = styled.div`
  text-align: center;
  padding: ${theme.space[12]} ${theme.space[6]};
  background: var(--color-bg-secondary);
  border: 1px dashed var(--color-border);
  border-radius: ${theme.radius.lg};
  margin-top: ${theme.space[6]};
`;

const EmptyIcon = styled.div`
  font-size: ${theme.fontSizes.displayLg};
  color: var(--color-text-tertiary);
  margin-bottom: ${theme.space[4]};
  opacity: 0.5;
`;

const EmptyTitle = styled.h3`
  font-size: ${theme.fontSizes.h2};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin-bottom: ${theme.space[2]};
`;

const EmptyText = styled.p`
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-secondary);
  margin: 0;
  line-height: ${theme.lineHeights.relaxed};
`;

export default RequestsView;
