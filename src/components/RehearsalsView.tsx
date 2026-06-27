import type { FC } from "react";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Container, Spinner, ButtonGroup, Button } from "reactstrap";
import styled from "styled-components";
import type { User } from "@supabase/supabase-js";
import { theme } from "../theme";
import { getBandRehearsals, getUpcomingRehearsals, getPastRehearsals, deleteRehearsal, markRehearsalCompleted, markRehearsalCancelled } from "../services/rehearsalsService";
import type { Rehearsal } from "../services/rehearsalsService";
import type { Band } from "../services/bandsService";
import { RehearsalList } from "./RehearsalList";
import { NewRehearsalForm } from "./NewRehearsalForm";
import { EditRehearsalModal } from "./EditRehearsalModal";
import { ConfirmModal } from "./ConfirmModal";
import { SEO } from "./SEO";
import { useToast } from "../context/useToast";

interface Props {
  user: User | null;
  selectedBand: Band | null;
}

type FilterType = "upcoming" | "past" | "all";

type ConfirmState = {
  title: string;
  message: string;
  confirmLabel: string;
  action: () => Promise<void>;
};

const RehearsalsView: FC<Props> = ({ user, selectedBand }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("upcoming");
  const [editingRehearsal, setEditingRehearsal] = useState<Rehearsal | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
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

  const loadRehearsals = async () => {
    if (!selectedBand) return;

    setLoading(true);
    try {
      let data: Rehearsal[];
      switch (filter) {
        case "upcoming":
          data = await getUpcomingRehearsals(selectedBand.id);
          break;
        case "past":
          data = await getPastRehearsals(selectedBand.id);
          break;
        default:
          data = await getBandRehearsals(selectedBand.id);
      }
      setRehearsals(data);
    } catch (error) {
      console.error("Failed to load rehearsals:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadRehearsals();
  }, [selectedBand, filter]);

  const handleDelete = async (rehearsal: Rehearsal) => {
    setConfirm({
      title: t('rehearsals.deleteRehearsal'),
      message: t('rehearsals.confirmDelete', { name: rehearsal.name || t('rehearsals.rehearsal') }),
      confirmLabel: t('common.delete'),
      action: async () => {
        try {
          await deleteRehearsal(rehearsal.id);
          loadRehearsals();
        } catch (error) {
          console.error("Failed to delete rehearsal:", error);
          toast.error(t('rehearsals.deleteError'));
        }
      },
    });
  };

  const handleMarkCompleted = async (rehearsal: Rehearsal) => {
    try {
      await markRehearsalCompleted(rehearsal.id);
      loadRehearsals();
    } catch (error) {
      console.error("Failed to mark rehearsal as completed:", error);
      toast.error(t('rehearsals.updateStatusError'));
    }
  };

  const handleMarkCancelled = async (rehearsal: Rehearsal) => {
    setConfirm({
      title: t('rehearsals.cancelRehearsal'),
      message: t('rehearsals.cancelConfirm', { name: rehearsal.name || t('rehearsals.rehearsal') }),
      confirmLabel: t('rehearsals.cancelRehearsal'),
      action: async () => {
        try {
          await markRehearsalCancelled(rehearsal.id);
          loadRehearsals();
        } catch (error) {
          console.error("Failed to cancel rehearsal:", error);
          toast.error(t('rehearsals.cancelError'));
        }
      },
    });
  };

  const handleEdit = (rehearsal: Rehearsal) => {
    setEditingRehearsal(rehearsal);
    setIsEditModalOpen(true);
  };

  const handleEditClose = () => {
    setIsEditModalOpen(false);
    setEditingRehearsal(null);
  };

  if (!user) {
    return (
      <PageWrapper>
        <Container>
          <AuthMessage>
            <i className="bi bi-lock"></i>
            <p>{t('rehearsals.pleaseSignIn')}</p>
          </AuthMessage>
        </Container>
      </PageWrapper>
    );
  }

  if (!selectedBand) {
    return (
      <PageWrapper>
        <Container>
          <AuthMessage>
            <i className="bi bi-music-note-beamed"></i>
            <p>{t('rehearsals.selectBand')}</p>
          </AuthMessage>
        </Container>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <SEO
        title={t('rehearsals.title')}
        description={t('rehearsals.subtitle')}
      />
      <Container>
        <PageHeader>
          <HeaderContent>
            <PageTitle>
              <i className="bi bi-calendar-check"></i>
              {t('rehearsals.title')}
            </PageTitle>
            <PageSubtitle>{t('rehearsals.subtitle')}</PageSubtitle>
          </HeaderContent>
        </PageHeader>

        <NewRehearsalForm bandId={selectedBand.id} onRehearsalCreated={loadRehearsals} />

        <FilterContainer>
          <StyledButtonGroup>
            <FilterButton
              $active={filter === "upcoming"}
              onClick={() => setFilter("upcoming")}
            >
              {t('rehearsals.upcoming')}
            </FilterButton>
            <FilterButton
              $active={filter === "past"}
              onClick={() => setFilter("past")}
            >
              {t('rehearsals.past')}
            </FilterButton>
            <FilterButton
              $active={filter === "all"}
              onClick={() => setFilter("all")}
            >
              {t('common.all')}
            </FilterButton>
          </StyledButtonGroup>
        </FilterContainer>

        {loading ? (
          <LoadingContainer>
            <Spinner color="primary" />
            <span>{t('rehearsals.loading')}</span>
          </LoadingContainer>
        ) : (
          <RehearsalList
            rehearsals={rehearsals}
            filter={filter}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onMarkCompleted={handleMarkCompleted}
            onMarkCancelled={handleMarkCancelled}
          />
        )}

        <EditRehearsalModal
          rehearsal={editingRehearsal}
          isOpen={isEditModalOpen}
          onClose={handleEditClose}
          onReload={loadRehearsals}
          bandId={selectedBand.id}
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
  padding: ${theme.space[6]} 0;

  @media (max-width: ${theme.breakpoints.md}) {
    padding: ${theme.space[4]} 0;
  }
`;

const PageHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: ${theme.space[6]};
  gap: ${theme.space[4]};

  @media (max-width: ${theme.breakpoints.md}) {
    flex-direction: column;
  }
`;

const HeaderContent = styled.div``;

const PageTitle = styled.h1`
  font-size: ${theme.fontSizes.h2};
  font-weight: ${theme.fontWeights.bold};
  color: var(--color-text-primary);
  margin: 0 0 ${theme.space[2]} 0;
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};

  i {
    color: ${theme.colors.brand.primary};
  }
`;

const PageSubtitle = styled.p`
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-secondary);
  margin: 0;
`;

const FilterContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${theme.space[4]};
  flex-wrap: wrap;
  gap: ${theme.space[3]};
`;

const StyledButtonGroup = styled(ButtonGroup)`
  background: var(--color-bg-secondary);
  border-radius: ${theme.radius.base};
  padding: ${theme.space[1]};
  border: 1px solid var(--color-border);
`;

const FilterButton = styled(Button)<{ $active: boolean }>`
  background: ${(props) =>
    props.$active ? theme.colors.brand.primary : "transparent"} !important;
  border: none !important;
  color: ${(props) =>
    props.$active ? "white" : "var(--color-text-secondary)"} !important;
  padding: ${theme.space[2]} ${theme.space[4]} !important;
  font-size: ${theme.fontSizes.bodySm} !important;
  font-weight: ${theme.fontWeights.medium} !important;
  border-radius: ${theme.radius.base} !important;
  transition: all ${theme.transitions.fast} ease !important;

  &:hover {
    background: ${(props) =>
      props.$active
        ? theme.colors.brand.primaryHover
        : "var(--color-bg-tertiary)"} !important;
    color: ${(props) =>
      props.$active ? "white" : "var(--color-text-primary)"} !important;
  }
`;

const LoadingContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${theme.space[3]};
  padding: ${theme.space[8]};
  color: var(--color-text-secondary);
`;

const AuthMessage = styled.div`
  text-align: center;
  padding: ${theme.space[12]};
  color: var(--color-text-secondary);

  i {
    font-size: ${theme.fontSizes.displayMd};
    margin-bottom: ${theme.space[4]};
    display: block;
  }

  p {
    font-size: ${theme.fontSizes.body};
    margin: 0;
  }
`;

export default RehearsalsView;
