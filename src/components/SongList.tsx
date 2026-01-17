import type { FC } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Song } from "../services/songsService";
import styled from "styled-components";
import { theme } from "../theme";

interface Props {
  songs: Song[];
  onEdit: (song: Song) => void;
  onDelete: (song: Song) => void;
}

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const SongList: FC<Props> = ({ songs, onEdit, onDelete }) => {
  const { t } = useTranslation();
  const [expandedSongId, setExpandedSongId] = useState<string | null>(null);

  const toggleExpanded = (songId: string) => {
    setExpandedSongId(expandedSongId === songId ? null : songId);
  };

  return (
    <SongsGrid>
      {songs.map((song) => {
        const isExpanded = expandedSongId === song.id;
        const hasDetails = song.lyrics || song.chords;

        return (
          <SongCard key={song.id} $isExpanded={isExpanded}>
            <SongHeader>
              <SongClickArea onClick={() => hasDetails && toggleExpanded(song.id)}>
                <SongIconWrapper>
                  <SongIcon>
                    <i className="bi bi-music-note-beamed"></i>
                  </SongIcon>
                  {song.has_backing_tracks && (
                    <BackingTracksBadge title={t('songs.hasBackingTracksShort')}>
                      <i className="bi bi-headphones-fill"></i>
                    </BackingTracksBadge>
                  )}
                </SongIconWrapper>

                <SongInfo>
                  <SongTitle>{song.title}</SongTitle>
                  {song.artist && <SongArtist>{t('songs.by')} {song.artist}</SongArtist>}
                  <MetadataRow>
                    {song.key && (
                      <MetadataBadge>
                        <i className="bi bi-music-note-beamed"></i>
                        {song.key}
                      </MetadataBadge>
                    )}
                    {song.tempo && (
                      <MetadataBadge>
                        <i className="bi bi-speedometer2"></i>
                        {song.tempo} BPM
                      </MetadataBadge>
                    )}
                    {song.duration && (
                      <MetadataBadge>
                        <i className="bi bi-clock"></i>
                        {formatDuration(song.duration)}
                      </MetadataBadge>
                    )}
                  </MetadataRow>
                  {song.tags && song.tags.length > 0 && (
                    <TagsRow>
                      {song.tags.map((tag, index) => (
                        <Tag key={index}>{tag}</Tag>
                      ))}
                    </TagsRow>
                  )}
                </SongInfo>

                {hasDetails && (
                  <ExpandButton>
                    <i className={`bi bi-chevron-${isExpanded ? "up" : "down"}`}></i>
                  </ExpandButton>
                )}
              </SongClickArea>

              <ActionButtons>
                <ActionButton
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(song);
                  }}
                  title={t('songs.editSongTooltip')}
                  $variant="edit"
                >
                  <i className="bi bi-pencil"></i>
                </ActionButton>
                <ActionButton
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(song);
                  }}
                  title={t('songs.deleteSongTooltip')}
                  $variant="delete"
                >
                  <i className="bi bi-trash"></i>
                </ActionButton>
              </ActionButtons>
            </SongHeader>

            {isExpanded && hasDetails && (
              <SongDetails>
                {song.chords && (
                  <DetailsSection>
                    <DetailsLabel>
                      <i className="bi bi-music-note"></i>
                      {t('songs.chords')}
                    </DetailsLabel>
                    <ChordsContent>{song.chords}</ChordsContent>
                  </DetailsSection>
                )}

                {song.lyrics && (
                  <DetailsSection>
                    <DetailsLabel>
                      <i className="bi bi-file-text"></i>
                      {t('songs.lyrics')}
                    </DetailsLabel>
                    <LyricsContent>{song.lyrics}</LyricsContent>
                  </DetailsSection>
                )}
              </SongDetails>
            )}
          </SongCard>
        );
      })}
    </SongsGrid>
  );
};

// Styled Components

const SongsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: ${theme.space[4]};
  margin-top: ${theme.space[6]};

  @media (max-width: ${theme.breakpoints.md}) {
    grid-template-columns: 1fr;
  }
`;

const SongCard = styled.div<{ $isExpanded: boolean }>`
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.lg};
  overflow: hidden;
  transition: all ${theme.transitions.base} ease;
  cursor: pointer;

  &:hover {
    background: var(--color-bg-tertiary);
    border-color: ${theme.colors.brand.primary};
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
  }

  ${(props) =>
    props.$isExpanded &&
    `
    box-shadow: var(--shadow-lg);
    border-color: ${theme.colors.brand.primary};
  `}
`;

const SongHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${theme.space[3]};
  padding: ${theme.space[4]};
  transition: all ${theme.transitions.fast} ease;
`;

const SongClickArea = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  flex: 1;
  min-width: 0;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: ${theme.space[2]};
  opacity: 0;
  transition: opacity ${theme.transitions.fast} ease;

  ${SongHeader}:hover & {
    opacity: 1;
  }

  /* Always visible on touch devices */
  @media (max-width: ${theme.breakpoints.md}) {
    opacity: 1;
  }

  @media (hover: none) {
    opacity: 1;
  }
`;

const ActionButton = styled.button<{ $variant: "edit" | "delete" }>`
  background: transparent;
  border: 1px solid var(--color-border);
  color: ${(props) =>
    props.$variant === "delete" ? theme.colors.semantic.error : 'var(--color-text-secondary)'};
  width: 36px;
  height: 36px;
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  flex-shrink: 0;

  &:hover {
    background: ${(props) =>
      props.$variant === "delete"
        ? theme.colors.semantic.errorBgDark
        : 'var(--color-bg-elevated)'};
    border-color: ${(props) =>
      props.$variant === "delete" ? theme.colors.semantic.error : theme.colors.brand.primary};
    color: ${(props) =>
      props.$variant === "delete" ? theme.colors.semantic.error : theme.colors.brand.primary};
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
    background: ${(props) =>
      props.$variant === "delete"
        ? theme.colors.semantic.errorBgDark
        : 'var(--color-bg-elevated)'};
  }

  /* Larger touch targets on mobile */
  @media (max-width: ${theme.breakpoints.md}) {
    width: 44px;
    height: 44px;
    font-size: ${theme.fontSizes.bodyLg};
  }
`;

const SongIconWrapper = styled.div`
  position: relative;
  flex-shrink: 0;
`;

const SongIcon = styled.div`
  width: 48px;
  height: 48px;
  background: ${theme.gradients.brandPrimary};
  border-radius: ${theme.radius.md};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${theme.fontSizes.h3};
  color: white;
  flex-shrink: 0;
`;

const BackingTracksBadge = styled.div`
  position: absolute;
  bottom: -4px;
  right: -4px;
  width: 24px;
  height: 24px;
  background: ${theme.colors.semantic.success};
  border: 2px solid var(--color-bg-secondary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 12px;
  box-shadow: var(--shadow-sm);
  transition: all ${theme.transitions.fast} ease;

  ${SongCard}:hover & {
    transform: scale(1.1);
  }
`;

const SongInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const SongTitle = styled.h3`
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin: 0 0 ${theme.space[1]} 0;
  line-height: ${theme.lineHeights.snug};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const SongArtist = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
  font-style: italic;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const MetadataRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${theme.space[2]};
  margin-top: ${theme.space[2]};
`;

const MetadataBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[1]};
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  padding: ${theme.space[1]} ${theme.space[2]};
  border-radius: ${theme.radius.sm};
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.medium};
  white-space: nowrap;

  i {
    font-size: ${theme.fontSizes.bodySm};
    color: ${theme.colors.brand.primary};
  }
`;

const TagsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${theme.space[1]};
  margin-top: ${theme.space[2]};
`;

const Tag = styled.span`
  display: inline-block;
  background: ${theme.colors.brand.primary};
  color: white;
  padding: ${theme.space[1]} ${theme.space[2]};
  border-radius: ${theme.radius.sm};
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.semibold};
  text-transform: uppercase;
  letter-spacing: ${theme.letterSpacing.wide};
`;

const ExpandButton = styled.button`
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  width: 32px;
  height: 32px;
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  flex-shrink: 0;

  &:hover {
    background: var(--color-bg-elevated);
    border-color: ${theme.colors.brand.primary};
    color: ${theme.colors.brand.primary};
  }
`;

const SongDetails = styled.div`
  padding: ${theme.space[4]};
  padding-top: 0;
  display: flex;
  flex-direction: column;
  gap: ${theme.space[5]};
  animation: slideDown 0.3s ease-out;

  @keyframes slideDown {
    from {
      opacity: 0;
      max-height: 0;
    }
    to {
      opacity: 1;
      max-height: 1000px;
    }
  }
`;

const DetailsSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[2]};
`;

const DetailsLabel = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.brand.primary};
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  text-transform: uppercase;
  letter-spacing: ${theme.letterSpacing.wide};

  i {
    font-size: ${theme.fontSizes.body};
  }
`;

const ChordsContent = styled.pre`
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.base};
  padding: ${theme.space[3]};
  font-family: ${theme.fonts.mono};
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-primary);
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: ${theme.lineHeights.relaxed};
  overflow-x: auto;
`;

const LyricsContent = styled.pre`
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.base};
  padding: ${theme.space[4]};
  font-family: ${theme.fonts.sans};
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-primary);
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: ${theme.lineHeights.relaxed};
  max-height: 400px;
  overflow-y: auto;

  /* Custom scrollbar */
  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: var(--color-bg-tertiary);
    border-radius: ${theme.radius.sm};
  }

  &::-webkit-scrollbar-thumb {
    background: var(--color-border-strong);
    border-radius: ${theme.radius.sm};

    &:hover {
      background: ${theme.colors.brand.primary};
    }
  }
`;
