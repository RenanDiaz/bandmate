import type { FC } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Song } from "../services/songsService";
import type { RequestType } from "../services/requestsService";
import styled from "styled-components";
import { theme } from "../theme";
import {
  Dropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
} from "reactstrap";

interface Props {
  songs: Song[];
  onEdit: (song: Song) => void;
  onDelete: (song: Song) => void;
  onTranspose?: (songId: string, semitones: number) => void;
  onResetTransposition?: (songId: string) => void;
  onRequestAction?: (song: Song, requestType: RequestType) => void;
  canEdit: boolean;
}

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

// Individual song card component to manage its own state
const SongCardItem: FC<{
  song: Song;
  onEdit: (song: Song) => void;
  onDelete: (song: Song) => void;
  onTranspose?: (songId: string, semitones: number) => void;
  onResetTransposition?: (songId: string) => void;
  onRequestAction?: (song: Song, requestType: RequestType) => void;
  canEdit: boolean;
}> = ({ song, onEdit, onDelete, onTranspose, onResetTransposition, onRequestAction, canEdit }) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [transposing, setTransposing] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const toggleDropdown = () => setDropdownOpen((prev) => !prev);
  const hasDetails = song.lyrics || song.chords;

  const handleTranspose = async (semitones: number) => {
    if (!onTranspose) return;
    setTransposing(true);
    try {
      await onTranspose(song.id, semitones);
    } finally {
      setTransposing(false);
    }
  };

  const handleResetTransposition = async () => {
    if (!onResetTransposition) return;
    setTransposing(true);
    try {
      await onResetTransposition(song.id);
    } finally {
      setTransposing(false);
    }
  };

  return (
    <SongCard $isExpanded={isExpanded}>
      <SongHeader>
        <SongClickArea onClick={() => hasDetails && setIsExpanded(!isExpanded)}>
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

        {/* Dropdown menu for actions */}
        {canEdit && (
          <DropdownWrapper onClick={(e) => e.stopPropagation()}>
            <Dropdown isOpen={dropdownOpen} toggle={toggleDropdown}>
              <DropdownToggle tag="button" className="actions-toggle">
                <i className="bi bi-three-dots-vertical"></i>
              </DropdownToggle>
              <DropdownMenu end dark container="body">
                <DropdownItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(song);
                  }}
                >
                  <i className="bi bi-pencil me-2"></i> {t('common.edit')}
                </DropdownItem>
                {onRequestAction && (
                  <>
                    <DropdownItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onRequestAction(song, "backing_track");
                      }}
                    >
                      <i className="bi bi-soundwave me-2 text-primary"></i> {t('songs.requestBackingTrack')}
                    </DropdownItem>
                    <DropdownItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onRequestAction(song, "song_change");
                      }}
                    >
                      <i className="bi bi-pencil-square me-2 text-primary"></i> {t('songs.requestChange')}
                    </DropdownItem>
                  </>
                )}
                <DropdownItem divider />
                <DropdownItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(song);
                  }}
                  className="text-danger"
                >
                  <i className="bi bi-trash me-2"></i> {t('common.delete')}
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </DropdownWrapper>
        )}
      </SongHeader>

      {isExpanded && hasDetails && (
        <SongDetails>
          {song.chords && (
            <DetailsSection>
              <ChordsHeader>
                <DetailsLabel>
                  <i className="bi bi-music-note"></i>
                  {t('songs.chords')}
                </DetailsLabel>
                {canEdit && onTranspose && (
                  <TranspositionControls>
                    {song.original_key && song.original_key !== song.key && (
                      <OriginalKeyBadge title={t('songs.originalKey')}>
                        {t('songs.originalKeyShort')}: {song.original_key}
                      </OriginalKeyBadge>
                    )}
                    <TransposeButton
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleTranspose(-1);
                      }}
                      disabled={transposing}
                      title={t('songs.transposeDown')}
                    >
                      <i className="bi bi-dash"></i>
                    </TransposeButton>
                    <TransposeLabel>{t('songs.transpose')}</TransposeLabel>
                    <TransposeButton
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleTranspose(1);
                      }}
                      disabled={transposing}
                      title={t('songs.transposeUp')}
                    >
                      <i className="bi bi-plus"></i>
                    </TransposeButton>
                    {song.original_key && song.original_key !== song.key && (
                      <ResetButton
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleResetTransposition();
                        }}
                        disabled={transposing}
                        title={t('songs.resetTransposition')}
                      >
                        <i className="bi bi-arrow-counterclockwise"></i>
                      </ResetButton>
                    )}
                  </TranspositionControls>
                )}
              </ChordsHeader>
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
};

export const SongList: FC<Props> = ({
  songs,
  onEdit,
  onDelete,
  onTranspose,
  onResetTransposition,
  onRequestAction,
  canEdit
}) => {
  return (
    <SongsGrid>
      {songs.map((song) => (
        <SongCardItem
          key={song.id}
          song={song}
          onEdit={onEdit}
          onDelete={onDelete}
          onTranspose={onTranspose}
          onResetTransposition={onResetTransposition}
          onRequestAction={onRequestAction}
          canEdit={canEdit}
        />
      ))}
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

const DropdownWrapper = styled.div`
  flex-shrink: 0;

  .actions-toggle {
    background: transparent;
    border: 1px solid var(--color-border);
    color: var(--color-text-secondary);
    width: 36px;
    height: 36px;
    border-radius: ${theme.radius.base};
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all ${theme.transitions.fast} ease;
    font-size: ${theme.fontSizes.body};

    &:hover,
    &:focus {
      background: var(--color-bg-elevated);
      border-color: ${theme.colors.brand.primary};
      color: ${theme.colors.brand.primary};
    }

    &::after {
      display: none; /* Remove default caret */
    }
  }

  /* Larger touch targets on mobile */
  @media (max-width: ${theme.breakpoints.md}) {
    .actions-toggle {
      width: 40px;
      height: 40px;
      font-size: ${theme.fontSizes.bodyLg};
    }
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

const ChordsHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: ${theme.space[2]};
`;

const TranspositionControls = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
`;

const TransposeButton = styled.button`
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  width: 28px;
  height: 28px;
  border-radius: ${theme.radius.sm};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  font-size: ${theme.fontSizes.body};

  &:hover:not(:disabled) {
    background: ${theme.colors.brand.primary};
    border-color: ${theme.colors.brand.primary};
    color: white;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const TransposeLabel = styled.span`
  font-size: ${theme.fontSizes.bodyXs};
  color: var(--color-text-secondary);
  font-weight: ${theme.fontWeights.medium};
  text-transform: uppercase;
  letter-spacing: ${theme.letterSpacing.wide};
`;

const ResetButton = styled.button`
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  width: 28px;
  height: 28px;
  border-radius: ${theme.radius.sm};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  margin-left: ${theme.space[1]};

  &:hover:not(:disabled) {
    background: var(--color-bg-tertiary);
    border-color: ${theme.colors.semantic.warning};
    color: ${theme.colors.semantic.warning};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const OriginalKeyBadge = styled.span`
  display: inline-flex;
  align-items: center;
  background: var(--color-bg-tertiary);
  border: 1px solid ${theme.colors.semantic.warning};
  color: ${theme.colors.semantic.warning};
  padding: ${theme.space[1]} ${theme.space[2]};
  border-radius: ${theme.radius.sm};
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.medium};
  margin-right: ${theme.space[2]};
`;

