import type { FC } from "react";
import { useState } from "react";
import type { Song } from "../services/songsService";
import styled from "styled-components";
import { theme } from "../theme";

interface Props {
  songs: Song[];
}

export const SongList: FC<Props> = ({ songs }) => {
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
            <SongHeader onClick={() => hasDetails && toggleExpanded(song.id)}>
              <SongIcon>
                <i className="bi bi-music-note-beamed"></i>
              </SongIcon>

              <SongInfo>
                <SongTitle>{song.title}</SongTitle>
                {song.artist && <SongArtist>by {song.artist}</SongArtist>}
              </SongInfo>

              {hasDetails && (
                <ExpandButton>
                  <i className={`bi bi-chevron-${isExpanded ? 'up' : 'down'}`}></i>
                </ExpandButton>
              )}
            </SongHeader>

            {isExpanded && hasDetails && (
              <SongDetails>
                {song.chords && (
                  <DetailsSection>
                    <DetailsLabel>
                      <i className="bi bi-music-note"></i>
                      Chords
                    </DetailsLabel>
                    <ChordsContent>{song.chords}</ChordsContent>
                  </DetailsSection>
                )}

                {song.lyrics && (
                  <DetailsSection>
                    <DetailsLabel>
                      <i className="bi bi-file-text"></i>
                      Lyrics
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
  background: ${theme.colors.dark.bg.secondary};
  border: 1px solid ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.lg};
  overflow: hidden;
  transition: all ${theme.transitions.base} ease;

  &:hover {
    border-color: ${theme.colors.brand.primary};
    box-shadow: ${theme.shadows.md};
  }

  ${props => props.$isExpanded && `
    box-shadow: ${theme.shadows.lg};
    border-color: ${theme.colors.brand.primary};
  `}
`;

const SongHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  padding: ${theme.space[4]};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  &:hover {
    background: ${theme.colors.dark.bg.tertiary};
  }
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

const SongInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const SongTitle = styled.h3`
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.dark.text.primary};
  margin: 0 0 ${theme.space[1]} 0;
  line-height: ${theme.lineHeights.snug};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const SongArtist = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.dark.text.secondary};
  font-style: italic;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ExpandButton = styled.button`
  background: transparent;
  border: 1px solid ${theme.colors.dark.border.default};
  color: ${theme.colors.dark.text.secondary};
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
    background: ${theme.colors.dark.bg.elevated};
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
  background: ${theme.colors.dark.bg.primary};
  border: 1px solid ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.base};
  padding: ${theme.space[3]};
  font-family: ${theme.fonts.mono};
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.dark.text.primary};
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: ${theme.lineHeights.relaxed};
  overflow-x: auto;
`;

const LyricsContent = styled.pre`
  background: ${theme.colors.dark.bg.primary};
  border: 1px solid ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.base};
  padding: ${theme.space[4]};
  font-family: ${theme.fonts.sans};
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.dark.text.primary};
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
    background: ${theme.colors.dark.bg.tertiary};
    border-radius: ${theme.radius.sm};
  }

  &::-webkit-scrollbar-thumb {
    background: ${theme.colors.dark.border.strong};
    border-radius: ${theme.radius.sm};

    &:hover {
      background: ${theme.colors.brand.primary};
    }
  }
`;
