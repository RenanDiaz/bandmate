import type { FC } from "react";
import styled from "styled-components";
import { useTranslation } from "react-i18next";
import { theme } from "../theme";

/**
 * Hero visual: the setlist view rendered with the app's own design tokens and
 * sample data. It is a faithful mock, not a screenshot — the caption says so.
 * Pure presentation: no data fetching, so it renders identically when the
 * landing is prerendered at build time.
 */
export const AppPreview: FC = () => {
  const { t } = useTranslation();

  const songs = [
    { title: t("landing.preview.song1"), key: "Am", length: "4:12" },
    { title: t("landing.preview.song2"), key: "E", length: "3:38" },
    { title: t("landing.preview.song3"), key: "C#m", length: "5:04" },
    { title: t("landing.preview.song4"), key: "G", length: "3:52" },
    { title: t("landing.preview.song5"), key: "D", length: "6:20" },
  ];

  return (
    <PreviewFigure>
      <Window aria-hidden="true">
        <TitleBar>
          <Dots>
            <Dot $color="#F43F5E" />
            <Dot $color="#F59E0B" />
            <Dot $color="#10B981" />
          </Dots>
          <AddressBar>bandmate.space/setlists</AddressBar>
        </TitleBar>

        <WindowBody>
          <SetlistHeader>
            <div>
              <SetlistName>{t("landing.preview.setlistName")}</SetlistName>
              <SetlistMeta>
                <i className="bi bi-calendar-event" /> {t("landing.preview.setlistDate")}
                <MetaDivider>·</MetaDivider>
                <i className="bi bi-clock" /> {t("landing.preview.setlistDuration")}
              </SetlistMeta>
            </div>
            <PerformChip>
              <i className="bi bi-play-fill" /> {t("landing.preview.perform")}
            </PerformChip>
          </SetlistHeader>

          <SongRows>
            {songs.map((song, index) => (
              <SongRow key={song.title}>
                <Position>{index + 1}</Position>
                <SongTitle>{song.title}</SongTitle>
                <KeyBadge>{song.key}</KeyBadge>
                <Length>{song.length}</Length>
                <Grip className="bi bi-grip-vertical" />
              </SongRow>
            ))}
          </SongRows>
        </WindowBody>
      </Window>
      <Caption>{t("landing.preview.caption")}</Caption>
    </PreviewFigure>
  );
};

const PreviewFigure = styled.figure`
  margin: 0;
  width: 100%;
  max-width: 640px;
`;

const Window = styled.div`
  background: #0a0a0b;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: ${theme.radius.lg};
  overflow: hidden;
  box-shadow: 0 24px 60px -20px rgba(0, 0, 0, 0.75);
`;

const TitleBar = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  padding: ${theme.space[3]} ${theme.space[4]};
  background: #18181b;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
`;

const Dots = styled.div`
  display: flex;
  gap: ${theme.space[2]};
`;

const Dot = styled.span<{ $color: string }>`
  width: 10px;
  height: 10px;
  border-radius: ${theme.radius.full};
  background: ${(props) => props.$color};
  opacity: 0.75;
`;

const AddressBar = styled.span`
  flex: 1;
  font-size: ${theme.fontSizes.bodyXs};
  color: #71717a;
  background: #27272a;
  border-radius: ${theme.radius.full};
  padding: ${theme.space[1]} ${theme.space[3]};
  text-align: center;
`;

const WindowBody = styled.div`
  padding: ${theme.space[5]};

  @media (max-width: ${theme.breakpoints.sm}) {
    padding: ${theme.space[4]};
  }
`;

const SetlistHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${theme.space[4]};
  margin-bottom: ${theme.space[5]};
`;

const SetlistName = styled.div`
  font-size: ${theme.fontSizes.h3};
  font-weight: ${theme.fontWeights.bold};
  color: #fafafa;
`;

const SetlistMeta = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  margin-top: ${theme.space[1]};
  font-size: ${theme.fontSizes.bodyXs};
  color: #a1a1aa;
`;

const MetaDivider = styled.span`
  color: #52525b;
`;

const PerformChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[1]};
  background: ${theme.colors.brand.primary};
  color: #fff;
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.semibold};
  padding: ${theme.space[2]} ${theme.space[3]};
  border-radius: ${theme.radius.full};
  white-space: nowrap;
`;

const SongRows = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[2]};
`;

const SongRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  background: #18181b;
  border: 1px solid #27272a;
  border-radius: ${theme.radius.base};
  padding: ${theme.space[3]};
`;

const Position = styled.span`
  width: 22px;
  flex-shrink: 0;
  text-align: center;
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.bold};
  color: ${theme.colors.brand.primaryLight};
`;

const SongTitle = styled.span`
  flex: 1;
  min-width: 0;
  font-size: ${theme.fontSizes.bodySm};
  color: #fafafa;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const KeyBadge = styled.span`
  flex-shrink: 0;
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.semibold};
  color: #06b6d4;
  background: rgba(6, 182, 212, 0.12);
  border-radius: ${theme.radius.sm};
  padding: 2px ${theme.space[2]};
`;

const Length = styled.span`
  flex-shrink: 0;
  font-size: ${theme.fontSizes.bodyXs};
  color: #71717a;

  @media (max-width: ${theme.breakpoints.sm}) {
    display: none;
  }
`;

const Grip = styled.i`
  flex-shrink: 0;
  color: #52525b;
  font-size: ${theme.fontSizes.bodySm};
`;

const Caption = styled.figcaption`
  margin-top: ${theme.space[3]};
  text-align: center;
  font-size: ${theme.fontSizes.bodyXs};
  color: rgba(255, 255, 255, 0.65);
`;

export default AppPreview;
