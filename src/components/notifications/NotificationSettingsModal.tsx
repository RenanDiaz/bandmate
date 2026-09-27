import type { FC } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, ModalBody, ModalHeader } from "reactstrap";
import styled from "styled-components";
import { useBandContext } from "../../context/useBandContext";
import { useToast } from "../../context/useToast";
import {
  PushSupportError,
  getPushStatus,
  subscribeThisDevice,
  syncThisDevice,
  unsubscribeThisDevice,
} from "../../lib/pushSupport";
import type { PushStatus } from "../../lib/pushSupport";
import { getMutedBandIds, setBandMuted } from "../../services/pushSubscriptionService";
import { NotificationSettingsBody } from "./NotificationSettingsBody";
import type { DeviceNotice, NotificationBandRow } from "./NotificationSettingsBody";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Notification settings (docs/specs/band-push-notifications.md §2.2): this
 * device on/off, and one switch per band (muting is per user, every device).
 * Opened from the user menu, only with the push flag, in `session`, online.
 */
export const NotificationSettingsModal: FC<Props> = ({ isOpen, onClose }) => {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const { bands } = useBandContext();
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [deviceBusy, setDeviceBusy] = useState<"on" | "off" | null>(null);
  const [deviceNotice, setDeviceNotice] = useState<DeviceNotice>(null);
  const [muted, setMuted] = useState<Set<number> | null>(null);
  const [bandsFailed, setBandsFailed] = useState(false);
  const [savingBandIds, setSavingBandIds] = useState<ReadonlySet<number>>(new Set());

  const loadMutes = useCallback(async () => {
    setBandsFailed(false);
    setMuted(null);
    try {
      setMuted(new Set(await getMutedBandIds()));
    } catch (error) {
      console.error("Loading notification mutes failed:", error);
      setBandsFailed(true);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setStatus(null);
    setDeviceNotice(null);
    void (async () => {
      const current = await getPushStatus();
      if (cancelled) return;
      setStatus(current);
      // The row may have been dropped (404/410) or be in another language:
      // re-register it while the user is looking at the setting.
      if (current === "on") {
        syncThisDevice(i18n.language).catch((error) => console.warn("Push subscription sync failed:", error));
      }
    })();
    void loadMutes();
    return () => {
      cancelled = true;
    };
  }, [isOpen, loadMutes, i18n.language]);

  // The first await inside is the permission prompt (iOS needs the gesture).
  const turnOn = () => {
    setDeviceBusy("on");
    setDeviceNotice(null);
    subscribeThisDevice(i18n.language)
      .then(() => setStatus("on"))
      .catch(async (error) => {
        if (error instanceof PushSupportError && error.code === "denied") {
          setStatus("denied");
        } else if (error instanceof PushSupportError && error.code === "dismissed") {
          setDeviceNotice("dismissed");
        } else {
          console.error("Turning on notifications failed:", error);
          setDeviceNotice("subscribeFailed");
          setStatus(await getPushStatus());
        }
      })
      .finally(() => setDeviceBusy(null));
  };

  const turnOff = async () => {
    setDeviceBusy("off");
    setDeviceNotice(null);
    try {
      await unsubscribeThisDevice();
      setStatus("off");
    } catch (error) {
      console.error("Turning off notifications failed:", error);
      setDeviceNotice("unsubscribeFailed");
    } finally {
      setDeviceBusy(null);
    }
  };

  const toggleBand = async (bandId: number, notify: boolean) => {
    setSavingBandIds((ids) => new Set(ids).add(bandId));
    try {
      await setBandMuted(bandId, !notify);
      setMuted((current) => {
        const next = new Set(current ?? []);
        if (notify) next.delete(bandId);
        else next.add(bandId);
        return next;
      });
    } catch (error) {
      console.error("Saving notification mute failed:", error);
      toast.error(t("notifications.errors.muteFailed"));
    } finally {
      setSavingBandIds((ids) => {
        const next = new Set(ids);
        next.delete(bandId);
        return next;
      });
    }
  };

  const bandRows = useMemo<NotificationBandRow[] | null>(
    () =>
      muted === null
        ? null
        : [...bands]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((band) => ({ id: band.id, name: band.name, muted: muted.has(band.id) })),
    [bands, muted]
  );

  return (
    <Modal isOpen={isOpen} toggle={onClose} centered>
      <StyledModalHeader toggle={onClose}>
        <i className="bi bi-bell me-2" aria-hidden="true"></i>
        {t("notifications.title")}
      </StyledModalHeader>
      <ModalBody>
        <NotificationSettingsBody
          status={status}
          deviceBusy={deviceBusy}
          deviceNotice={deviceNotice}
          onTurnOn={turnOn}
          onTurnOff={turnOff}
          bands={bandRows}
          bandsFailed={bandsFailed}
          savingBandIds={savingBandIds}
          onToggleBand={toggleBand}
          onRetryBands={loadMutes}
        />
      </ModalBody>
    </Modal>
  );
};

const StyledModalHeader = styled(ModalHeader)`
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);

  .btn-close {
    filter: invert(1) grayscale(100%) brightness(200%);
  }
`;
