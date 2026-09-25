import type { FC } from "react";
import { useTranslation } from "react-i18next";
import { Spinner } from "reactstrap";
import styled from "styled-components";
import { theme } from "../../theme";
import { useBandContext } from "../../context/useBandContext";
import { useInterruptedDownloads, useOfflineSnapshotList } from "../../hooks/useOfflineDownload";
import { formatSavedDate } from "../../lib/offlineDownloadUi";
import { BandAvatar } from "../BandAvatar";
import { OfflineEmptyState } from "./OfflineMessage";
import { OfflineSetlistList } from "./OfflineSetlistList";
import { SchemaWipeNotice } from "./SchemaWipeNotice";
import { Banner, Card, Header, Muted, Page, SectionTitle, Subtitle, Title } from "./offlineStyles";

/**
 * `/` offline with a user (§7.3): the selected band's snapshots plus
 * interrupted downloads. Reads only the device; no dashboard fetch is issued.
 */
export const OfflineHome: FC = () => <OfflineSetlistsScreen variant="home" />;

/** `/setlists` offline: the same list (§7.3). */
export const OfflineSetlistsPage: FC = () => <OfflineSetlistsScreen variant="list" />;

const OfflineSetlistsScreen: FC<{ variant: "home" | "list" }> = ({ variant }) => {
  const { t, i18n } = useTranslation();
  const { selectedBand } = useBandContext();
  const metas = useOfflineSnapshotList();
  const interrupted = useInterruptedDownloads();

  if (metas === undefined) {
    return (
      <Loading>
        <Spinner color="light" />
      </Loading>
    );
  }
  const showInterrupted = variant === "home" && interrupted.length > 0;
  if (metas.length === 0 && !showInterrupted) return <OfflineEmptyState />;

  const bandMetas = selectedBand ? metas.filter((m) => m.bandId === selectedBand.id) : metas;
  const otherBands = bandMetas.length < metas.length;

  return (
    <Page data-testid={variant === "home" ? "offline-home" : "offline-setlists"}>
      <SchemaWipeNotice />
      <Banner role="status">
        <i className="bi bi-wifi-off" aria-hidden="true" />
        <span>{t("offline.screen.banner")}</span>
      </Banner>
      <Header>
        {selectedBand && <BandAvatar name={selectedBand.name} avatarUrl={selectedBand.avatar_url} size={48} />}
        <div>
          <Title>{t("offline.home.title")}</Title>
          <Subtitle>{selectedBand ? `${selectedBand.name} · ${t("offline.home.subtitle")}` : t("offline.home.subtitle")}</Subtitle>
        </div>
      </Header>
      {bandMetas.length > 0 ? (
        <OfflineSetlistList metas={bandMetas} />
      ) : (
        selectedBand && (
          <Card>
            <Muted>{t("offline.home.noneForBand", { band: selectedBand.name })}</Muted>
          </Card>
        )
      )}
      {otherBands && <Muted>{t("offline.home.otherBands")}</Muted>}
      {showInterrupted && (
        <>
          <SectionTitle>{t("offline.home.interruptedTitle")}</SectionTitle>
          <Card>
            <InterruptedList data-testid="offline-interrupted">
            {interrupted.map((job) => (
              <InterruptedItem key={job.setlistId}>
                <span>{job.setlistName || t("offline.home.untitled")}</span>
                <Muted>
                  {t("offline.home.interruptedItem", { date: formatSavedDate(job.startedAt, i18n.language) })} ·{" "}
                  {t("offline.interrupted.needsConnection")}
                </Muted>
              </InterruptedItem>
            ))}
            </InterruptedList>
          </Card>
        </>
      )}
    </Page>
  );
};

const Loading = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const InterruptedList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
`;

const InterruptedItem = styled.li`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[1]};
  color: var(--color-text-primary);

  & + & {
    margin-top: ${theme.space[3]};
  }
`;
