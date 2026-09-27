import type { FC } from "react";
import { useTranslation } from "react-i18next";
import { Input, Label, Spinner } from "reactstrap";
import styled from "styled-components";
import { theme } from "../../theme";
import type { PushStatus } from "../../lib/pushSupport";

/**
 * The notification settings, presentational (spec §2.2): no service calls and
 * no portals, so it renders with renderToStaticMarkup in tests.
 * `NotificationSettingsModal` owns the state.
 */

export interface NotificationBandRow {
  id: number;
  name: string;
  muted: boolean;
}

export type DeviceNotice = "dismissed" | "subscribeFailed" | "unsubscribeFailed" | null;

export interface NotificationSettingsBodyProps {
  /** null while it is being read */
  status: PushStatus | null;
  deviceBusy: "on" | "off" | null;
  deviceNotice: DeviceNotice;
  onTurnOn: () => void;
  onTurnOff: () => void;
  /** null while loading */
  bands: NotificationBandRow[] | null;
  bandsFailed: boolean;
  /** ids whose switch is saving */
  savingBandIds: ReadonlySet<number>;
  onToggleBand: (bandId: number, notify: boolean) => void;
  onRetryBands: () => void;
}

export const NotificationSettingsBody: FC<NotificationSettingsBodyProps> = ({
  status,
  deviceBusy,
  deviceNotice,
  onTurnOn,
  onTurnOff,
  bands,
  bandsFailed,
  savingBandIds,
  onToggleBand,
  onRetryBands,
}) => {
  const { t } = useTranslation();

  return (
    <Content>
      <Section data-testid="notifications-device">
        <SectionLabel>{t("notifications.device.label")}</SectionLabel>
        {status === null ? (
          <Spinner size="sm" color="primary" />
        ) : (
          <>
            <Description>
              {status === "unsupported" && t("notifications.device.unsupported")}
              {status === "needs-install" && (
                <>
                  <i className="bi bi-box-arrow-up me-1" aria-hidden="true"></i>
                  {t("notifications.device.needsInstall")}
                </>
              )}
              {status === "denied" && t("notifications.device.denied")}
              {status === "off" && t("notifications.device.off")}
              {status === "on" && (
                <>
                  <i className="bi bi-bell-fill me-1" aria-hidden="true"></i>
                  {t("notifications.device.on")}
                </>
              )}
            </Description>
            {deviceNotice && (
              <Notice role="alert">
                {deviceNotice === "dismissed"
                  ? t("notifications.device.dismissed")
                  : t(`notifications.errors.${deviceNotice}`)}
              </Notice>
            )}
            {status === "off" && (
              <PrimaryButton type="button" onClick={onTurnOn} disabled={deviceBusy !== null}>
                {deviceBusy === "on" ? (
                  <>
                    <Spinner size="sm" /> {t("notifications.device.turningOn")}
                  </>
                ) : (
                  <>
                    <i className="bi bi-bell" aria-hidden="true"></i> {t("notifications.device.turnOn")}
                  </>
                )}
              </PrimaryButton>
            )}
            {status === "on" && (
              <SecondaryButton type="button" onClick={onTurnOff} disabled={deviceBusy !== null}>
                {deviceBusy === "off" ? (
                  <>
                    <Spinner size="sm" /> {t("notifications.device.turningOff")}
                  </>
                ) : (
                  <>
                    <i className="bi bi-bell-slash" aria-hidden="true"></i> {t("notifications.device.turnOff")}
                  </>
                )}
              </SecondaryButton>
            )}
          </>
        )}
      </Section>

      <Section data-testid="notifications-bands">
        <SectionLabel>{t("notifications.bands.label")}</SectionLabel>
        <Hint>{t("notifications.bands.hint")}</Hint>
        {bandsFailed ? (
          <Notice role="alert">
            {t("notifications.errors.bandsLoadFailed")}{" "}
            <LinkButton type="button" onClick={onRetryBands}>
              {t("common.retry")}
            </LinkButton>
          </Notice>
        ) : bands === null ? (
          <Spinner size="sm" color="primary" />
        ) : (
          <Toggles>
            {bands.map((band) => (
              <Toggle key={band.id}>
                <Input
                  type="switch"
                  id={`notify-band-${band.id}`}
                  checked={!band.muted}
                  disabled={savingBandIds.has(band.id)}
                  onChange={(event) => onToggleBand(band.id, event.target.checked)}
                />
                <Label for={`notify-band-${band.id}`} check>
                  {t("notifications.bands.toggle", { band: band.name })}
                </Label>
              </Toggle>
            ))}
          </Toggles>
        )}
      </Section>

      <Footer>
        <i className="bi bi-info-circle me-1" aria-hidden="true"></i>
        {t("notifications.footer")}
      </Footer>
    </Content>
  );
};

const Content = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[5]};
`;

const Section = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${theme.space[2]};
`;

const SectionLabel = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: ${theme.letterSpacing.wide};
`;

const Description = styled.p`
  margin: 0;
  color: var(--color-text-primary);
  font-size: ${theme.fontSizes.body};
`;

const Hint = styled.div`
  font-size: ${theme.fontSizes.bodyXs};
  color: var(--color-text-tertiary);
`;

const Notice = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.semantic.warning};
`;

const Toggles = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[2]};
`;

const Toggle = styled.div.attrs({ className: "form-check form-switch" })`
  margin: 0;
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-primary);
`;

const Footer = styled.div`
  font-size: ${theme.fontSizes.bodyXs};
  color: var(--color-text-tertiary);
`;

const PrimaryButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[2]};
  padding: ${theme.space[2]} ${theme.space[4]};
  background: ${theme.colors.brand.primary};
  border: none;
  border-radius: ${theme.radius.base};
  color: white;
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  cursor: pointer;

  &:hover:not(:disabled) {
    background: ${theme.colors.brand.primaryHover};
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

const SecondaryButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[2]};
  padding: ${theme.space[2]} ${theme.space[3]};
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.base};
  color: var(--color-text-secondary);
  font-size: ${theme.fontSizes.bodySm};
  cursor: pointer;

  &:hover:not(:disabled) {
    border-color: ${theme.colors.brand.primary};
    color: ${theme.colors.brand.primary};
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

const LinkButton = styled.button`
  background: none;
  border: none;
  padding: 0;
  color: ${theme.colors.brand.primary};
  font-size: inherit;
  text-decoration: underline;
  cursor: pointer;
`;
