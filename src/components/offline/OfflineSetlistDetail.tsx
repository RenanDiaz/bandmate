import type { FC } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Spinner } from "reactstrap";
import styled from "styled-components";
import { theme } from "../../theme";
import { useOfflineSnapshot, useOfflineSnapshotMeta } from "../../hooks/useOfflineDownload";
import type { OfflineSnapshot, OfflineSnapshotMeta } from "../../services/offlineSetlistService";
import type { SetlistItem } from "../../services/setlistsService";
import { getSetlistItemKey, isBreakItem, isSongItem } from "../../services/setlistsService";
import { BandAvatar } from "../BandAvatar";
import { OfflineBadge } from "./OfflineDownloadAction";
import { OfflineNotAvailable } from "./OfflineMessage";
import { Banner, Header, Muted, Page, PrimaryLink, SecondaryButton, Subtitle, Title } from "./offlineStyles";

/**
 * `/setlists/:setlistId` offline (§7.3): read-only, from the snapshot. The
 * online SetlistDetailView is not mounted offline at all.
 */
export const OfflineSetlistDetail: FC = () => {
  const { setlistId } = useParams<{ setlistId: string }>();
  const snapshot = useOfflineSnapshot(setlistId);
  // The meta holds completeness and missing files: wait for both, so the
  // per-song "not downloaded" counts never change after the first paint.
  const meta = useOfflineSnapshotMeta(setlistId);
  if (snapshot === undefined || meta === undefined) {
    return (
      <Loading>
        <Spinner color="light" />
      </Loading>
    );
  }
  if (!snapshot) return <OfflineNotAvailable />;
  return <SnapshotDetail snapshot={snapshot} meta={meta} />;
};

const SnapshotDetail: FC<{ snapshot: OfflineSnapshot; meta: OfflineSnapshotMeta | null }> = ({ snapshot, meta }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setlist, band } = snapshot;
  const items = useMemo(() => [...(setlist.songs ?? [])].sort((a, b) => a.position - b.position), [setlist.songs]);

  // A PDF is on the device when the snapshot references its file and it is
  // not recorded missing; PDFs added since (row refresh) are "not downloaded".
  const storedSheetIds = useMemo(() => {
    const missing = new Set((meta?.missingFiles ?? []).map((f) => f.sheetMusicId));
    return new Set(snapshot.files.map((f) => f.sheetMusicId).filter((id) => !missing.has(id)));
  }, [snapshot.files, meta?.missingFiles]);

  let songNumber = 0;
  return (
    <Page data-testid="offline-setlist-detail">
      <Banner role="status">
        <i className="bi bi-wifi-off" aria-hidden="true" />
        <span>{t("offline.screen.banner")}</span>
      </Banner>
      <div>
        <SecondaryButton type="button" onClick={() => navigate("/")}>
          <i className="bi bi-arrow-left" aria-hidden="true" /> {t("offline.detail.back")}
        </SecondaryButton>
      </div>
      <Header>
        <BandAvatar name={band.name} avatarUrl={band.avatar_url} size={48} />
        <div>
          <Title>{setlist.name}</Title>
          <Subtitle>{band.name}</Subtitle>
        </div>
      </Header>
      {setlist.description && <Description>{setlist.description}</Description>}
      <Actions>
        {meta && <OfflineBadge meta={meta} />}
        <PrimaryLink to={`/setlists/${snapshot.setlistId}/perform`}>
          <i className="bi bi-play-fill" aria-hidden="true" /> {t("offline.list.perform")}
        </PrimaryLink>
      </Actions>
      <Items>
        {items.map((item) => {
          if (isSongItem(item)) songNumber += 1;
          return (
            <ItemRow
              key={getSetlistItemKey(item)}
              item={item}
              number={songNumber}
              snapshot={snapshot}
              storedSheetIds={storedSheetIds}
            />
          );
        })}
      </Items>
    </Page>
  );
};

const ItemRow: FC<{
  item: SetlistItem;
  number: number;
  snapshot: OfflineSnapshot;
  storedSheetIds: Set<string>;
}> = ({ item, number, snapshot, storedSheetIds }) => {
  const { t } = useTranslation();
  if (isSongItem(item)) {
    const song = snapshot.songsById[item.song_id];
    const sheets = snapshot.sheetMusicBySongId[item.song_id] ?? [];
    const notDownloaded = sheets.filter((s) => !storedSheetIds.has(s.id)).length;
    return (
      <SongRow data-testid="offline-item-song">
        <Number>{number}</Number>
        <SongInfo>
          <SongTitle>{song?.title ?? t("offline.detail.unknownSong")}</SongTitle>
          {song?.artist && <Muted>{song.artist}</Muted>}
        </SongInfo>
        <Muted>
          {sheets.length > 0 ? t("offline.detail.pdfs", { count: sheets.length }) : t("offline.detail.noPdfs")}
          {notDownloaded > 0 && ` · ${t("offline.detail.notDownloaded", { count: notDownloaded })}`}
        </Muted>
        <PerformFromHereLink
          to={`/setlists/${snapshot.setlistId}/perform?song=${encodeURIComponent(item.song_id)}`}
          title={t("setlists.detail.performFromHere")}
          aria-label={t("setlists.detail.performFromHere")}
        >
          <i className="bi bi-play-fill" aria-hidden="true" />
        </PerformFromHereLink>
      </SongRow>
    );
  }
  const icon = item.type === "break" ? "bi-cup-hot" : item.type === "section" ? "bi-bookmark" : "bi-sticky";
  return (
    <SpecialRow $section={item.type === "section"} data-testid={`offline-item-${item.type}`}>
      <i className={`bi ${icon}`} aria-hidden="true" />
      <span>
        <TypeLabel>{t(`setlists.items.${item.type}`)}</TypeLabel>
        {item.label && ` · ${item.label}`}
        {isBreakItem(item) && item.duration ? ` · ${t("offline.detail.minutes", { count: item.duration })}` : ""}
      </span>
    </SpecialRow>
  );
};

const Loading = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Description = styled.p`
  color: var(--color-text-secondary);
  margin: 0;
  white-space: pre-wrap;
`;

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  flex-wrap: wrap;
`;

const Items = styled.ol`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${theme.space[2]};
`;

const SongRow = styled.li`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.base};
  padding: ${theme.space[3]};
`;

const PerformFromHereLink = styled(Link)`
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.base};
  color: var(--color-text-secondary);
  font-size: 1.1rem;

  &:hover {
    border-color: ${theme.colors.brand.primary};
    color: ${theme.colors.brand.primary};
  }
`;

const Number = styled.span`
  width: 28px;
  flex-shrink: 0;
  text-align: center;
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.brand.primary};
`;

const SongInfo = styled.span`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
`;

const SongTitle = styled.span`
  color: var(--color-text-primary);
  font-weight: ${theme.fontWeights.medium};
  overflow-wrap: anywhere;
`;

const SpecialRow = styled.li<{ $section: boolean }>`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  padding: ${theme.space[2]} ${theme.space[3]};
  border-radius: ${theme.radius.base};
  border: 1px dashed var(--color-border);
  color: var(--color-text-secondary);
  font-size: ${theme.fontSizes.bodySm};
  ${(p) => (p.$section ? `margin-top: ${theme.space[2]};` : "")}

  i {
    color: ${theme.colors.brand.primary};
  }
`;

const TypeLabel = styled.span`
  font-weight: ${theme.fontWeights.semibold};
`;
