import type { FC } from "react";
import { useEffect } from "react";
import { useBandContext } from "../../context/useBandContext";
import { NotificationSettingsModal } from "./NotificationSettingsModal";
import { closeNotificationSettings, useNotificationSettingsOpen } from "./notificationSettingsStore";

/**
 * Renders the notification settings modal once for the app. Closed when the
 * session or the connection goes (the settings read and write the server).
 */
export const NotificationSettingsHost: FC = () => {
  const open = useNotificationSettingsOpen();
  const { authMode, isOnline } = useBandContext();
  const available = authMode === "session" && isOnline;

  useEffect(() => {
    if (!available) closeNotificationSettings();
  }, [available]);

  if (!available) return null;
  return <NotificationSettingsModal isOpen={open} onClose={closeNotificationSettings} />;
};
