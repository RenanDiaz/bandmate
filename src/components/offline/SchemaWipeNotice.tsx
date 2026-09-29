import type { FC } from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Spinner } from "reactstrap";
import styled from "styled-components";
import { theme } from "../../theme";
import { useBandContext } from "../../context/useBandContext";
import type { SchemaWipeEntry } from "../../hooks/useOfflineDownload";
import { useOfflineDownloadState, useSchemaWipeNotice } from "../../hooks/useOfflineDownload";
import { dismissSchemaWipeNotice } from "../../services/offlineSetlistService";
import { SecondaryButton } from "./offlineStyles";
import { useOfflineDownloadFlow } from "./useOfflineDownloadFlow";

/**
 * The one-time "download these again" notice after a schema wipe (A4, §7.3),
 * on the dashboard, the offline home and the offline list. The service only
 * returns the current user's entries, so another user never sees these names.
 */
export const SchemaWipeNotice: FC = () => {
  const { t } = useTranslation();
  const { selectedBand, bands } = useBandContext();
  const { entries, dismiss } = useSchemaWipeNotice();
  if (entries.length === 0) return null;

  const bandLabel = (entry: SchemaWipeEntry): string | null => {
    if (entry.bandId === null || entry.bandId === selectedBand?.id) return null;
    return bands.find((b) => b.id === entry.bandId)?.name ?? t("offline.schemaWipe.unknownBand");
  };

  return (
    <Notice role="status" data-testid="schema-wipe-notice">
      <NoticeHeader>
        <i className="bi bi-arrow-repeat" aria-hidden="true" />
        <strong>{t("offline.schemaWipe.title")}</strong>
      </NoticeHeader>
      <Entries>
        {entries.map((entry) => (
          <SchemaWipeRow key={entry.setlistId} entry={entry} bandLabel={bandLabel(entry)} />
        ))}
      </Entries>
      <NoticeFooter>
        <SecondaryButton type="button" onClick={() => void dismiss()}>
          {t("offline.schemaWipe.dismiss")}
        </SecondaryButton>
      </NoticeFooter>
    </Notice>
  );
};

const SchemaWipeRow: FC<{ entry: SchemaWipeEntry; bandLabel: string | null }> = ({ entry, bandLabel }) => {
  const { t } = useTranslation();
  const flow = useOfflineDownloadFlow(entry.setlistId, entry.setlistName, "setlist");
  const result = useOfflineDownloadState().results[entry.setlistId];
  const [done, setDone] = useState<"downloaded" | "gone" | null>(null);

  // Downloaded again, or gone from the server: drop it from the stored notice.
  // The row stays until the notice re-reads, so the result modal stays open.
  useEffect(() => {
    if (!result) return;
    const downloaded = result.state === "done" || result.state === "done-with-errors";
    const gone = result.state === "failed" && result.failureCode === "setlist-not-found";
    if (downloaded || gone) {
      setDone(downloaded ? "downloaded" : "gone");
      void dismissSchemaWipeNotice(entry.setlistId);
    }
  }, [result, entry.setlistId]);

  return (
    <Entry>
      <EntryName>
        {entry.setlistName}
        {bandLabel && <BandLabel> · {bandLabel}</BandLabel>}
      </EntryName>
      {done === "downloaded" ? (
        <Status>
          <i className="bi bi-check2" aria-hidden="true" /> {t("offline.result.doneTitle")}
        </Status>
      ) : done === "gone" ? (
        <Status>{t("offline.reason.not-found")}</Status>
      ) : flow.canDownload ? (
        <SecondaryButton type="button" onClick={() => void flow.begin()} disabled={flow.planning}>
          {flow.planning ? <Spinner size="sm" /> : <i className="bi bi-cloud-arrow-down" aria-hidden="true" />}
          {t("offline.schemaWipe.download")}
        </SecondaryButton>
      ) : (
        <Status>{t("offline.schemaWipe.needsConnection")}</Status>
      )}
      {flow.elements}
    </Entry>
  );
};

const Notice = styled.div`
  border: 1px solid ${theme.colors.brand.primary};
  border-radius: ${theme.radius.lg};
  background: var(--color-bg-secondary);
  padding: ${theme.space[4]};
  display: flex;
  flex-direction: column;
  gap: ${theme.space[3]};
  margin-bottom: ${theme.space[4]};
`;

const NoticeHeader = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${theme.space[2]};
  color: var(--color-text-primary);

  i {
    color: ${theme.colors.brand.primary};
  }
`;

const Entries = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${theme.space[2]};
`;

const Entry = styled.li`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${theme.space[3]};
`;

const EntryName = styled.span`
  color: var(--color-text-primary);
  min-width: 0;
  overflow-wrap: anywhere;
`;

const BandLabel = styled.span`
  color: var(--color-text-secondary);
  font-size: ${theme.fontSizes.bodySm};
`;

const Status = styled.span`
  color: var(--color-text-secondary);
  font-size: ${theme.fontSizes.bodySm};
  white-space: nowrap;
`;

const NoticeFooter = styled.div`
  display: flex;
  justify-content: flex-end;
`;
