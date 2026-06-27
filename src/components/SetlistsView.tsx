import type { FC } from "react";
import type { User } from "@supabase/supabase-js";
import type { Band } from "../services/bandsService";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Spinner, Container } from "reactstrap";
import styled from "styled-components";
import { theme } from "../theme";
import { getBandSetlists, deleteSetlist } from "../services/setlistsService";
import type { Setlist } from "../services/setlistsService";
import { NewSetlistForm } from "./NewSetlistForm";
import { SetlistList } from "./SetlistList";
import { SEO } from "./SEO";
import { AISetlistGenerator } from "./AISetlistGenerator";
import { ConfirmModal } from "./ConfirmModal";
import { useToast } from "../context/useToast";

type ConfirmState = { title: string; message: string; confirmLabel: string; action: () => Promise<void> };

interface Props {
  user: User | null;
  selectedBand: Band | null;
}

const SetlistsView: FC<Props> = ({ user, selectedBand }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [loading, setLoading] = useState(true);
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

  const loadSetlists = async () => {
    if (!selectedBand) {
      setSetlists([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await getBandSetlists(selectedBand.id);
      setSetlists(data);
    } catch (error) {
      console.error("Failed to load setlists:", error);
      setSetlists([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user && selectedBand) {
      loadSetlists();
    } else {
      setSetlists([]);
      setLoading(false);
    }
  }, [user, selectedBand]);

  const handleDeleteSetlist = async (setlist: Setlist) => {
    setConfirm({
      title: t("setlists.deleteSetlist"),
      message: t("setlists.confirmDelete", { name: setlist.name }),
      confirmLabel: t("common.delete"),
      action: async () => {
        try {
          await deleteSetlist(setlist.id);
          await loadSetlists();
        } catch (error) {
          console.error("Failed to delete setlist:", error);
          toast.error(t("setlists.deleteError"));
        }
      },
    });
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
            <MessageText>{t("setlists.pleaseSignIn")}</MessageText>
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
              <i className="bi bi-music-note-list"></i>
            </MessageIcon>
            <MessageTitle>{t("bands.noBandSelected")}</MessageTitle>
            <MessageText>{t("setlists.selectBand")}</MessageText>
          </MessageCard>
        </Container>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <SEO
        title={t("setlists.title")}
        description={t("setlists.subtitle")}
      />
      <Container>
        <PageHeader>
          <HeaderContent>
            <BandBadge>
              <i className="bi bi-music-note-beamed"></i>
              {selectedBand.name}
            </BandBadge>
            <PageTitle>{t("setlists.title")}</PageTitle>
            <PageSubtitle>
              {t("setlists.subtitle")}
            </PageSubtitle>
          </HeaderContent>
          <StatsCard>
            <StatItem>
              <StatValue>{setlists.length}</StatValue>
              <StatLabel>{t("setlists.title")}</StatLabel>
            </StatItem>
          </StatsCard>
        </PageHeader>

        <ContentSection>
          <AISetlistGenerator bandId={selectedBand.id} onSetlistCreated={loadSetlists} />
          <NewSetlistForm bandId={selectedBand.id} onSetlistCreated={loadSetlists} />

          {loading ? (
            <LoadingContainer>
              <Spinner color="primary" style={{ width: "3rem", height: "3rem" }} />
              <LoadingText>{t("setlists.loading")}</LoadingText>
            </LoadingContainer>
          ) : setlists.length === 0 ? (
            <EmptyState>
              <EmptyIcon>
                <i className="bi bi-music-note-list"></i>
              </EmptyIcon>
              <EmptyTitle>{t("setlists.noSetlists")}</EmptyTitle>
              <EmptyText>
                {t("setlists.createFirst")}
              </EmptyText>
            </EmptyState>
          ) : (
            <SetlistList
              setlists={setlists}
              onDelete={handleDeleteSetlist}
            />
          )}
        </ContentSection>

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
  min-width: 140px;

  @media (max-width: ${theme.breakpoints.md}) {
    width: 100%;
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

const ContentSection = styled.div`
  max-width: 1200px;
  margin: 0 auto;
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

export default SetlistsView;
