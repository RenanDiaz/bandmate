import type { FC } from "react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate } from "react-router-dom";
import { Spinner } from "reactstrap";
import styled from "styled-components";
import { theme } from "../../theme";
import { useBandContext } from "../../context/useBandContext";
import { useToast } from "../../context/useToast";
import { getOfflineDownloadController } from "../../context/offlineDownloadController";
import {
  useInterruptedDownloads,
  useOfflineBands,
  useOfflineDownloadState,
  useOfflineSnapshotList,
  useOfflineStorageUsage,
} from "../../hooks/useOfflineDownload";
import type { OfflineSnapshotMeta } from "../../services/offlineSetlistService";
import { checkForUpdates, requestPersistence, verifySnapshot } from "../../services/offlineSetlistService";
import { formatBytes, formatSavedDate } from "../../lib/offlineDownloadUi";
import { isIOS, isStandalone } from "../../lib/platform";
import { OfflineBadge, OfflineDownloadAction, RemoveOfflineCopy } from "./OfflineDownloadAction";
import { SchemaWipeNotice } from "./SchemaWipeNotice";
import { Banner, Card, Header, Muted, Page, SecondaryButton, SectionTitle, Subtitle, Title } from "./offlineStyles";

/**
 * `/offline`, "Offline setlists" (spec §6.6, PR 3.4): everything this device
 * keeps for the current user, across bands. Device-local, so every role sees
 * it and it works offline; only Check for updates and Update need a session
 * and a connection. Reached from the user menu, with or without a band.
 */
export const OfflineSetlistsManager: FC = () => {
  const { user, authMode } = useBandContext();
  if (!user || (authMode !== "session" && authMode !== "offline-cached")) return <Navigate to="/" replace />;
  return <Manager />;
};

const Manager: FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const { isOnline, authMode } = useBandContext();
  const metas = useOfflineSnapshotList();
  const bands = useOfflineBands();
  const { usage, reload } = useOfflineStorageUsage();
  const interrupted = useInterruptedDownloads();
  const [checking, setChecking] = useState(false);
  const canCheck = isOnline && authMode === "session";
  const inBrowserTabOnIOS = useMemo(() => isIOS() && !isStandalone(), []);

  const bandNames = useMemo(() => new Map((bands ?? []).map((b) => [b.id, b.name] as const)), [bands]);
  const sorted = useMemo(
    () =>
      [...(metas ?? [])].sort(
        (a, b) =>
          (bandNames.get(a.bandId) ?? "").localeCompare(bandNames.get(b.bandId) ?? "") ||
          a.setlistName.localeCompare(b.setlistName)
      ),
    [metas, bandNames]
  );

  const checkNow = async () => {
    setChecking(true);
    try {
      await checkForUpdates();
      toast.success(t("offline.manage.checked"));
    } catch (error) {
      console.warn("Offline update check did not run:", error);
      toast.error(t("offline.manage.checkFailed"));
    } finally {
      setChecking(false);
    }
  };

  if (metas === undefined) {
    return (
      <Loading>
        <Spinner color="light" />
      </Loading>
    );
  }

  return (
    <Page data-testid="offline-manager">
      <SchemaWipeNotice />
      <Header>
        <div>
          <Title>{t("offline.manage.title")}</Title>
          <Subtitle>{t("offline.manage.subtitle")}</Subtitle>
        </div>
      </Header>
      {inBrowserTabOnIOS && (
        <Banner role="note">
          <i className="bi bi-phone" aria-hidden="true" />
          <span>{t("offline.confirm.iosInstallHint")}</span>
        </Banner>
      )}

      <StorageCard usage={usage} onPersisted={reload} />

      <ListHeader>
        <SectionTitle>{t("offline.manage.listTitle", { count: sorted.length })}</SectionTitle>
        {sorted.length > 0 && (
          <SecondaryButton
            type="button"
            data-testid="offline-check-now"
            onClick={() => void checkNow()}
            disabled={!canCheck || checking}
            title={canCheck ? undefined : t("offline.action.needsConnection")}
          >
            {checking ? <Spinner size="sm" /> : <i className={`bi ${canCheck ? "bi-arrow-repeat" : "bi-wifi-off"}`} aria-hidden="true" />}{" "}
            {canCheck ? t("offline.manage.checkNow") : t("offline.action.needsConnection")}
          </SecondaryButton>
        )}
      </ListHeader>
      {sorted.length === 0 ? (
        <Card>
          <Muted>{t("offline.manage.empty")}</Muted>
        </Card>
      ) : (
        <List data-testid="offline-manager-list">
          {sorted.map((meta) => (
            <SnapshotRow key={meta.setlistId} meta={meta} bandName={bandNames.get(meta.bandId) ?? null} />
          ))}
        </List>
      )}

      {interrupted.length > 0 && <InterruptedSection jobs={interrupted} />}
    </Page>
  );
};

const StorageCard: FC<{
  usage: ReturnType<typeof useOfflineStorageUsage>["usage"];
  onPersisted: () => void;
}> = ({ usage, onPersisted }) => {
  const { t, i18n } = useTranslation();
  const [asking, setAsking] = useState(false);
  const canAsk = typeof navigator !== "undefined" && !!navigator.storage?.persist;
  if (!usage) return null;
  const persisted = usage.persisted;

  const ask = async () => {
    setAsking(true);
    try {
      await requestPersistence();
    } finally {
      setAsking(false);
      onPersisted();
    }
  };

  return (
    <Card data-testid="offline-storage">
      <StorageLine>
        <i className="bi bi-hdd" aria-hidden="true" />
        <span>
          {t("offline.manage.copiesUse", { size: formatBytes(usage.distinctFileBytes, i18n.language) })}
          {usage.usage !== null && usage.quota !== null && (
            <Muted>
              {" · "}
              {t("offline.manage.deviceUsage", {
                used: formatBytes(usage.usage, i18n.language),
                quota: formatBytes(usage.quota, i18n.language),
              })}
            </Muted>
          )}
        </span>
      </StorageLine>
      <StorageLine data-testid="offline-persisted" data-state={String(persisted)}>
        <i
          className={`bi ${persisted ? "bi-shield-check" : "bi-shield-exclamation"}`}
          aria-hidden="true"
          style={{ color: persisted ? theme.colors.semantic.success : theme.colors.semantic.warning }}
        />
        <span>
          {persisted === true
            ? t("offline.manage.persisted")
            : persisted === false
              ? t("offline.manage.notPersisted")
              : t("offline.manage.persistedUnknown")}
        </span>
        {persisted !== true && canAsk && (
          <LinkButton type="button" onClick={() => void ask()} disabled={asking}>
            {asking ? <Spinner size="sm" /> : null} {t("offline.manage.askPersist")}
          </LinkButton>
        )}
      </StorageLine>
    </Card>
  );
};

const SnapshotRow: FC<{ meta: OfflineSnapshotMeta; bandName: string | null }> = ({ meta, bandName }) => {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const { active } = useOfflineDownloadState();
  const [verifying, setVerifying] = useState(false);
  const date = (iso: string) => formatSavedDate(iso, i18n.language);
  const rowsUpdatedLater = meta.rowsUpdatedAt > meta.savedAt && date(meta.rowsUpdatedAt) !== date(meta.savedAt);
  const busy = active?.setlistId === meta.setlistId;

  const verify = async () => {
    setVerifying(true);
    try {
      const result = await verifySnapshot(meta.setlistId);
      if (result.ok) toast.success(t("offline.manage.verifyOk", { setlist: meta.setlistName }));
      else toast.warning(t("offline.manage.verifyMissing", { count: result.missing.length, setlist: meta.setlistName }));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Item data-testid="offline-manager-row">
      <ItemMain>
        <ItemTitle>
          <Link to={`/setlists/${meta.setlistId}`}>{meta.setlistName || t("offline.home.untitled")}</Link>
          <OfflineBadge meta={meta} />
        </ItemTitle>
        <Muted>
          {[
            bandName,
            t("offline.manage.saved", { date: date(meta.savedAt) }),
            formatBytes(meta.bytes, i18n.language),
            rowsUpdatedLater ? t("offline.manage.updated", { date: date(meta.rowsUpdatedAt) }) : null,
            meta.verifiedAt ? t("offline.manage.verified", { date: date(meta.verifiedAt) }) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </Muted>
      </ItemMain>
      <ItemActions>
        <OfflineDownloadAction setlistId={meta.setlistId} setlistName={meta.setlistName} variant="manage" />
        <LinkButton type="button" onClick={() => void verify()} disabled={verifying || busy}>
          {verifying ? <Spinner size="sm" /> : <i className="bi bi-patch-check" aria-hidden="true" />}{" "}
          {t("offline.manage.verify")}
        </LinkButton>
        {!busy && <RemoveOfflineCopy setlistId={meta.setlistId} setlistName={meta.setlistName} />}
      </ItemActions>
    </Item>
  );
};

const InterruptedSection: FC<{ jobs: Array<{ setlistId: string; setlistName: string; startedAt: string }> }> = ({ jobs }) => {
  const { t, i18n } = useTranslation();
  const { isOnline, authMode } = useBandContext();
  const { active } = useOfflineDownloadState();
  const controller = getOfflineDownloadController();
  const [resuming, setResuming] = useState(false);
  const canResume = isOnline && authMode === "session";

  const resume = async () => {
    setResuming(true);
    try {
      await controller.resume();
    } finally {
      setResuming(false);
    }
  };

  return (
    <>
      <SectionTitle>{t("offline.home.interruptedTitle")}</SectionTitle>
      <List data-testid="offline-manager-interrupted">
        {jobs.map((job) => (
          <Item key={job.setlistId}>
            <ItemMain>
              <span>{job.setlistName || t("offline.home.untitled")}</span>
              <Muted>{t("offline.home.interruptedItem", { date: formatSavedDate(job.startedAt, i18n.language) })}</Muted>
            </ItemMain>
            <ItemActions>
              <LinkButton type="button" onClick={() => void resume()} disabled={!canResume || resuming || !!active}>
                {resuming ? <Spinner size="sm" /> : <i className="bi bi-play-fill" aria-hidden="true" />}{" "}
                {canResume ? t("offline.interrupted.resume") : t("offline.interrupted.needsConnection")}
              </LinkButton>
              <LinkButton type="button" onClick={() => controller.discard(job.setlistId)} disabled={resuming}>
                {t("offline.interrupted.discard")}
              </LinkButton>
            </ItemActions>
          </Item>
        ))}
      </List>
    </>
  );
};

const Loading = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ListHeader = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${theme.space[2]};
`;

const StorageLine = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${theme.space[2]};
  color: var(--color-text-primary);
  font-size: ${theme.fontSizes.bodySm};

  & + & {
    margin-top: ${theme.space[2]};
  }

  > i {
    color: ${theme.colors.brand.primary};
  }
`;

const List = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${theme.space[3]};
`;

const Item = styled.li`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${theme.space[2]} ${theme.space[3]};
  padding: ${theme.space[3]};
  border-radius: ${theme.radius.base};
  border: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
`;

const ItemMain = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[1]};
  min-width: 0;
  flex: 1 1 16rem;
`;

const ItemTitle = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${theme.space[2]};
  font-weight: ${theme.fontWeights.semibold};

  a {
    color: var(--color-text-primary);
    text-decoration: none;
    overflow-wrap: anywhere;
  }

  a:hover {
    text-decoration: underline;
  }
`;

const ItemActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${theme.space[2]} ${theme.space[3]};
`;

const LinkButton = styled.button`
  background: none;
  border: none;
  padding: 0;
  min-height: 40px;
  color: var(--color-text-secondary);
  font-size: ${theme.fontSizes.bodySm};
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[1]};

  &:hover:not(:disabled) {
    color: var(--color-text-primary);
    text-decoration: underline;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;
