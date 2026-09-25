import type { FC } from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import { theme } from "../../theme";
import type { Band } from "../../services/bandsService";
import { BandAvatar } from "../BandAvatar";
import { Page, Subtitle, Title } from "./offlineStyles";

/**
 * Offline with several local bands and none selected. The BandSelector is
 * never shown offline (it creates and lists bands on the server, §7.2); this
 * only picks one of the bands saved on the device.
 */
export const OfflineBandPicker: FC<{ bands: Band[]; onSelect: (band: Band) => void }> = ({ bands, onSelect }) => {
  const { t } = useTranslation();
  return (
    <Page data-testid="offline-band-picker">
      <div>
        <Title>{t("offline.bandPicker.title")}</Title>
        <Subtitle>{t("offline.bandPicker.text")}</Subtitle>
      </div>
      <List>
        {bands.map((band) => (
          <li key={band.id}>
            <BandButton type="button" onClick={() => onSelect(band)}>
              <BandAvatar name={band.name} avatarUrl={band.avatar_url} size={40} />
              <span>{band.name}</span>
            </BandButton>
          </li>
        ))}
      </List>
    </Page>
  );
};

const List = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${theme.space[2]};
`;

const BandButton = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.lg};
  padding: ${theme.space[3]} ${theme.space[4]};
  color: var(--color-text-primary);
  font-weight: ${theme.fontWeights.semibold};
  text-align: left;
  cursor: pointer;

  &:hover {
    border-color: ${theme.colors.brand.primary};
  }
`;
