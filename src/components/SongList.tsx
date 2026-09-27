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
import { iconButtonCss, outlinedCss } from "./setlist/actionButtons";

interface Props {
  songs: Song[];
  onEdit: (song: Song) => void;
  onDelete: (song: Song) => void;
  /** Opens the song in performance mode (every role). */
  onPerform: (song: Song) => void;
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
  /** Opens the song in performance mode (every role). */
  onPerform: (song: Song) => void;
  onTranspose?: (songId: string, semitones: number) => void;
  onResetTransposition?: (songId: string) => void;
  onRequestAction?: (song: Song, requestType: RequestType) => void;
  canEdit: boolean;
}> = ({ song, onEdit, onDelete, onPerform, onTranspose, onResetTransposition, onRequestAction, canEdit }) => {
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

  const hasMeta = Boolean(song.key || song.tempo || song.duration || (song.tags && song.tags.length > 0));
  const toggleExpanded = () => {
    if (hasDetails) setIsExpanded((prev) => !prev);
  };
  const moreLabel = t("common.moreActions");
  const detailsLabel = isExpanded ? t("songs.hideDetails") : t("songs.showDetails");

  return (
    <SongCard $isExpanded={isExpanded} $expandable={Boolean(hasDetails)} onClick={toggleExpanded}>
      <SongHeader>
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
        </SongInfo>

        {/* One actions block for every size and input: Perform (every role,
            guests included) always visible, the editing actions behind ⋯. */}
        <CardActions onClick={(e) => e.stopPropagation()}>
          <PerformButton
            type="button"
            title={t("songs.perform")}
            aria-label={t("songs.perform")}
            onClick={() => onPerform(song)}
          >
            <i className="bi bi-play-circle"></i>
            <span>{t("songs.perform")}</span>
          </PerformButton>

          {canEdit && (
            <MoreMenu isOpen={dropdownOpen} toggle={toggleDropdown}>
              <DropdownToggle
                tag="button"
                type="button"
                className="actions-toggle"
                title={moreLabel}
                aria-label={moreLabel}
              >
                <i className="bi bi-three-dots-vertical"></i>
              </DropdownToggle>
              <DropdownMenu end dark container="body">
                <DropdownItem onClick={() => onEdit(song)}>
                  <i className="bi bi-pencil me-2"></i> {t('common.edit')}
                </DropdownItem>
                {onRequestAction && (
                  <>
                    <DropdownItem onClick={() => onRequestAction(song, "backing_track")}>
                      <i className="bi bi-soundwave me-2 text-primary"></i> {t('songs.requestBackingTrack')}
                    </DropdownItem>
                    <DropdownItem onClick={() => onRequestAction(song, "song_change")}>
                      <i className="bi bi-pencil-square me-2 text-primary"></i> {t('songs.requestChange')}
                    </DropdownItem>
                  </>
                )}
                <DropdownItem divider />
                <DropdownItem onClick={() => onDelete(song)} className="text-danger">
                  <i className="bi bi-trash me-2"></i> {t('common.delete')}
                </DropdownItem>
              </DropdownMenu>
            </MoreMenu>
          )}
        </CardActions>
      </SongHeader>

      {(hasMeta || hasDetails) && (
        <MetaRow>
          <MetaBadges>
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
            {song.tags?.map((tag, index) => (
              <Tag key={index}>{tag}</Tag>
            ))}
          </MetaBadges>

          {hasDetails && (
            <ExpandButton
              type="button"
              aria-expanded={isExpanded}
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded();
              }}
            >
              <span>{detailsLabel}</span>
              <i className={`bi bi-chevron-${isExpanded ? "up" : "down"}`}></i>
            </ExpandButton>
          )}
        </MetaRow>
      )}

      {isExpanded && hasDetails && (
        <SongDetails onClick={(e) => e.stopPropagation()}>
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
  onPerform,
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
          onPerform={onPerform}
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
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: ${theme.space[4]};
  margin-top: ${theme.space[6]};

  @media (max-width: ${theme.breakpoints.md}) {
    grid-template-columns: 1fr;
    gap: ${theme.space[3]};
  }
`;

// The whole card toggles the details (lyrics / chords) when the song has
// any; the actions and the expanded content stop propagation.
const SongCard = styled.div<{ $isExpanded: boolean; $expandable: boolean }>`
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.lg};
  overflow: hidden;
  transition: border-color ${theme.transitions.base} ease, box-shadow ${theme.transitions.base} ease;
  cursor: ${(props) => (props.$expandable ? "pointer" : "default")};
  display: flex;
  flex-direction: column;

  &:hover {
    border-color: ${theme.colors.brand.primary};
    box-shadow: var(--shadow-md);
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
  align-items: flex-start;
  gap: ${theme.space[3]};
  padding: ${theme.space[4]};

  @media (max-width: ${theme.breakpoints.sm}) {
    padding: ${theme.space[3]};
  }
`;

const CardActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  flex-shrink: 0;
  align-self: flex-start;
`;

/** Perform: outlined in the success colour, always visible; icon-only below sm. */
const PerformButton = styled.button`
  ${outlinedCss}
  color: ${theme.colors.semantic.success};
  border-color: ${theme.colors.semantic.success}55;

  i {
    color: ${theme.colors.semantic.success};
  }

  &:hover:not(:disabled) {
    background: ${theme.colors.semantic.successBgDark};
    border-color: ${theme.colors.semantic.success};
    color: ${theme.colors.semantic.success};
  }

  @media (max-width: ${theme.breakpoints.sm}) {
    width: 40px;
    min-width: 40px;
    padding: 0;

    span {
      display: none;
    }
  }
`;

// reactstrap's toggle passes `innerRef`, which a styled tag would leak to the
// DOM, so the toggle is a plain button styled through its class.
const MoreMenu = styled(Dropdown)`
  .actions-toggle {
    ${iconButtonCss}

    &::after {
      display: none; /* Remove default caret */
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

  @media (max-width: ${theme.breakpoints.sm}) {
    width: 40px;
    height: 40px;
    font-size: ${theme.fontSizes.h4};
  }
`;

const BackingTracksBadge = styled.div`
  position: absolute;
  bottom: -4px;
  right: -4px;
  width: 22px;
  height: 22px;
  background: ${theme.colors.semantic.success};
  border: 2px solid var(--color-bg-secondary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 11px;
  box-shadow: var(--shadow-sm);
`;

const SongInfo = styled.div`
  flex: 1;
  min-width: 0;
  /* Centre the two text lines on the icon; taller titles grow downwards. */
  min-height: 48px;
  display: flex;
  flex-direction: column;
  justify-content: center;

  @media (max-width: ${theme.breakpoints.sm}) {
    min-height: 40px;
  }
`;

const SongTitle = styled.h3`
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin: 0;
  line-height: ${theme.lineHeights.snug};
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow-wrap: anywhere;
`;

const SongArtist = styled.div`
  margin-top: 2px;
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

// Key · tempo · duration · tags, on the card's full width, with the
// details toggle at the end of the row.
const MetaRow = styled.div`
  display: flex;
  align-items: flex-end;
  gap: ${theme.space[2]};
  padding: 0 ${theme.space[4]} ${theme.space[4]};

  @media (max-width: ${theme.breakpoints.sm}) {
    padding: 0 ${theme.space[3]} ${theme.space[3]};
  }
`;

// The badges wrap; the toggle stays on the last line, at the end.
const MetaBadges = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${theme.space[2]};
  flex: 1;
  min-width: 0;
`;

const MetadataBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[1]};
  height: 28px;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  padding: 0 ${theme.space[2]};
  border-radius: ${theme.radius.sm};
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.medium};
  white-space: nowrap;

  i {
    font-size: ${theme.fontSizes.bodySm};
    color: ${theme.colors.brand.primary};
  }
`;

const Tag = styled.span`
  display: inline-flex;
  align-items: center;
  height: 28px;
  background: rgba(139, 92, 246, 0.16);
  border: 1px solid rgba(139, 92, 246, 0.35);
  color: ${theme.colors.brand.primaryLight};
  padding: 0 ${theme.space[2]};
  border-radius: ${theme.radius.sm};
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.semibold};
  text-transform: uppercase;
  letter-spacing: ${theme.letterSpacing.wide};
  white-space: nowrap;
`;

const ExpandButton = styled.button`
  margin-left: auto;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[1]};
  height: 28px;
  padding: 0 ${theme.space[2]};
  background: transparent;
  border: 1px solid transparent;
  border-radius: ${theme.radius.sm};
  color: var(--color-text-secondary);
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  white-space: nowrap;

  i {
    font-size: ${theme.fontSizes.bodySm};
  }

  &:hover,
  &:focus-visible {
    border-color: var(--color-border);
    background: var(--color-bg-tertiary);
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

