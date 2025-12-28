import type { FC } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { useTranslation } from "react-i18next";
import { theme } from "../theme";

interface BackingTrackPlayerProps {
  songId: string;
  trackUrl: string | null;
  trackFileName: string | null;
  hadTrackPreviously: boolean;
  onLoadTrack: (songId: string, file: File) => void;
  onRemoveTrack: (songId: string) => void;
  isHost: boolean;
}

export const BackingTrackPlayer: FC<BackingTrackPlayerProps> = ({
  songId,
  trackUrl,
  trackFileName,
  hadTrackPreviously,
  onLoadTrack,
  onRemoveTrack,
  isHost,
}) => {
  const { t } = useTranslation();
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isExpanded, setIsExpanded] = useState(false);

  // Reset player state when song changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [songId]);

  // Handle audio events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
    };
  }, [trackUrl]);

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        onLoadTrack(songId, file);
        setIsExpanded(true);
      }
      // Reset input so the same file can be selected again
      event.target.value = "";
    },
    [songId, onLoadTrack]
  );

  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !trackUrl) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
  }, [isPlaying, trackUrl]);

  const handleSeek = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const time = parseFloat(event.target.value);
    audio.currentTime = time;
    setCurrentTime(time);
  }, []);

  const handleVolumeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    const newVolume = parseFloat(event.target.value);
    setVolume(newVolume);
    if (audio) {
      audio.volume = newVolume;
    }
  }, []);

  const handleStop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
    setCurrentTime(0);
    setIsPlaying(false);
  }, []);

  const handleRemove = useCallback(() => {
    handleStop();
    onRemoveTrack(songId);
    setIsExpanded(false);
  }, [songId, onRemoveTrack, handleStop]);

  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds) || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  // Only show for host
  if (!isHost) return null;

  return (
    <PlayerContainer $hasTrack={!!trackUrl} $isExpanded={isExpanded}>
      <HiddenFileInput
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.webm"
        onChange={handleFileSelect}
      />

      {trackUrl && (
        <audio ref={audioRef} src={trackUrl} preload="metadata" />
      )}

      <PlayerHeader onClick={() => trackUrl && setIsExpanded(!isExpanded)}>
        <HeaderLeft>
          <PlayerIcon $hasTrack={!!trackUrl}>
            <i className={`bi bi-${trackUrl ? "soundwave" : "music-note-beamed"}`}></i>
          </PlayerIcon>
          <HeaderInfo>
            <HeaderTitle>{t("backingTrack.title")}</HeaderTitle>
            {trackUrl && trackFileName ? (
              <HeaderFileName>{trackFileName}</HeaderFileName>
            ) : hadTrackPreviously ? (
              <HeaderHint>{t("backingTrack.reloadHint")}</HeaderHint>
            ) : (
              <HeaderHint>{t("backingTrack.noTrack")}</HeaderHint>
            )}
          </HeaderInfo>
        </HeaderLeft>

        <HeaderActions>
          {trackUrl ? (
            <>
              <ActionButton
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlayPause();
                }}
                $variant="play"
                title={isPlaying ? t("backingTrack.pause") : t("backingTrack.play")}
              >
                <i className={`bi bi-${isPlaying ? "pause-fill" : "play-fill"}`}></i>
              </ActionButton>
              <ActionButton
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                $variant="default"
                title={isExpanded ? t("backingTrack.collapse") : t("backingTrack.expand")}
              >
                <i className={`bi bi-chevron-${isExpanded ? "up" : "down"}`}></i>
              </ActionButton>
            </>
          ) : (
            <LoadButton onClick={triggerFileSelect}>
              <i className="bi bi-folder2-open"></i>
              {hadTrackPreviously ? t("backingTrack.reload") : t("backingTrack.load")}
            </LoadButton>
          )}
        </HeaderActions>
      </PlayerHeader>

      {trackUrl && isExpanded && (
        <PlayerControls>
          <ProgressSection>
            <TimeDisplay>{formatTime(currentTime)}</TimeDisplay>
            <ProgressSlider
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
            />
            <TimeDisplay>{formatTime(duration)}</TimeDisplay>
          </ProgressSection>

          <ControlsRow>
            <ControlGroup>
              <ControlButton onClick={handleStop} title={t("backingTrack.stop")}>
                <i className="bi bi-stop-fill"></i>
              </ControlButton>
              <ControlButton
                onClick={handlePlayPause}
                $primary
                title={isPlaying ? t("backingTrack.pause") : t("backingTrack.play")}
              >
                <i className={`bi bi-${isPlaying ? "pause-fill" : "play-fill"}`}></i>
              </ControlButton>
            </ControlGroup>

            <VolumeSection>
              <VolumeIcon $muted={volume === 0}>
                <i className={`bi bi-volume-${volume === 0 ? "mute" : volume < 0.5 ? "down" : "up"}-fill`}></i>
              </VolumeIcon>
              <VolumeSlider
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={handleVolumeChange}
              />
            </VolumeSection>

            <ControlGroup>
              <ControlButton onClick={triggerFileSelect} title={t("backingTrack.change")}>
                <i className="bi bi-arrow-repeat"></i>
              </ControlButton>
              <ControlButton onClick={handleRemove} $danger title={t("backingTrack.remove")}>
                <i className="bi bi-trash"></i>
              </ControlButton>
            </ControlGroup>
          </ControlsRow>
        </PlayerControls>
      )}
    </PlayerContainer>
  );
};

// Styled Components

const PlayerContainer = styled.div<{ $hasTrack: boolean; $isExpanded: boolean }>`
  background: ${(props) =>
    props.$hasTrack
      ? `linear-gradient(135deg, ${theme.colors.dark.bg.secondary} 0%, ${theme.colors.dark.bg.tertiary} 100%)`
      : theme.colors.dark.bg.secondary};
  border: 1px solid ${(props) =>
    props.$hasTrack ? theme.colors.brand.primary + "40" : theme.colors.dark.border.default};
  border-radius: ${theme.radius.lg};
  overflow: hidden;
  transition: all ${theme.transitions.base} ease;

  ${(props) =>
    props.$hasTrack &&
    `
    box-shadow: 0 0 20px ${theme.colors.brand.primary}15;
  `}
`;

const PlayerHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${theme.space[4]} ${theme.space[5]};
  cursor: pointer;
  transition: background ${theme.transitions.fast} ease;

  &:hover {
    background: rgba(255, 255, 255, 0.03);
  }
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[4]};
`;

const PlayerIcon = styled.div<{ $hasTrack: boolean }>`
  width: 44px;
  height: 44px;
  border-radius: ${theme.radius.base};
  background: ${(props) =>
    props.$hasTrack ? theme.colors.brand.primary : theme.colors.dark.bg.tertiary};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${theme.fontSizes.h3};
  color: ${(props) =>
    props.$hasTrack ? "white" : theme.colors.dark.text.tertiary};
  transition: all ${theme.transitions.fast} ease;

  ${(props) =>
    props.$hasTrack &&
    `
    animation: pulse 2s ease-in-out infinite;
  `}

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.8; }
  }
`;

const HeaderInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[1]};
`;

const HeaderTitle = styled.div`
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.dark.text.primary};
`;

const HeaderFileName = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.brand.primary};
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  @media (max-width: ${theme.breakpoints.md}) {
    max-width: 120px;
  }
`;

const HeaderHint = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.dark.text.tertiary};
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
`;

const ActionButton = styled.button<{ $variant: "play" | "default" }>`
  width: 40px;
  height: 40px;
  border-radius: ${theme.radius.full};
  border: none;
  background: ${(props) =>
    props.$variant === "play" ? theme.colors.brand.primary : "transparent"};
  color: ${(props) =>
    props.$variant === "play" ? "white" : theme.colors.dark.text.secondary};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  font-size: ${theme.fontSizes.bodyLg};

  &:hover {
    background: ${(props) =>
      props.$variant === "play"
        ? theme.colors.brand.primaryHover
        : theme.colors.dark.bg.elevated};
    transform: scale(1.05);
  }
`;

const LoadButton = styled.button`
  background: ${theme.colors.brand.primary};
  border: none;
  color: white;
  padding: ${theme.space[2]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};

  &:hover {
    background: ${theme.colors.brand.primaryHover};
    transform: translateY(-1px);
  }
`;

const HiddenFileInput = styled.input`
  display: none;
`;

const PlayerControls = styled.div`
  padding: ${theme.space[4]} ${theme.space[5]};
  border-top: 1px solid ${theme.colors.dark.border.default};
  display: flex;
  flex-direction: column;
  gap: ${theme.space[4]};
`;

const ProgressSection = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
`;

const TimeDisplay = styled.span`
  font-size: ${theme.fontSizes.bodySm};
  font-family: ${theme.fonts.mono};
  color: ${theme.colors.dark.text.secondary};
  min-width: 45px;
  text-align: center;
`;

const ProgressSlider = styled.input`
  flex: 1;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: ${theme.colors.dark.bg.tertiary};
  border-radius: ${theme.radius.full};
  cursor: pointer;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: ${theme.colors.brand.primary};
    cursor: pointer;
    transition: transform ${theme.transitions.fast} ease;

    &:hover {
      transform: scale(1.2);
    }
  }

  &::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: ${theme.colors.brand.primary};
    cursor: pointer;
    border: none;
  }
`;

const ControlsRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${theme.space[4]};

  @media (max-width: ${theme.breakpoints.md}) {
    flex-wrap: wrap;
    justify-content: center;
  }
`;

const ControlGroup = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
`;

const ControlButton = styled.button<{ $primary?: boolean; $danger?: boolean }>`
  width: 40px;
  height: 40px;
  border-radius: ${theme.radius.base};
  border: 1px solid ${(props) =>
    props.$primary
      ? theme.colors.brand.primary
      : props.$danger
      ? theme.colors.semantic.error
      : theme.colors.dark.border.default};
  background: ${(props) =>
    props.$primary ? theme.colors.brand.primary : "transparent"};
  color: ${(props) =>
    props.$primary
      ? "white"
      : props.$danger
      ? theme.colors.semantic.error
      : theme.colors.dark.text.secondary};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  font-size: ${theme.fontSizes.bodyLg};

  &:hover {
    background: ${(props) =>
      props.$primary
        ? theme.colors.brand.primaryHover
        : props.$danger
        ? theme.colors.semantic.errorBgDark
        : theme.colors.dark.bg.elevated};
    border-color: ${(props) =>
      props.$primary
        ? theme.colors.brand.primaryHover
        : props.$danger
        ? theme.colors.semantic.error
        : theme.colors.brand.primary};
    color: ${(props) =>
      props.$primary ? "white" : props.$danger ? theme.colors.semantic.error : theme.colors.brand.primary};
  }
`;

const VolumeSection = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  flex: 1;
  max-width: 150px;

  @media (max-width: ${theme.breakpoints.md}) {
    order: 3;
    width: 100%;
    max-width: none;
    justify-content: center;
  }
`;

const VolumeIcon = styled.div<{ $muted: boolean }>`
  color: ${(props) =>
    props.$muted ? theme.colors.dark.text.tertiary : theme.colors.dark.text.secondary};
  font-size: ${theme.fontSizes.bodyLg};
  width: 24px;
  text-align: center;
`;

const VolumeSlider = styled.input`
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: ${theme.colors.dark.bg.tertiary};
  border-radius: ${theme.radius.full};
  cursor: pointer;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: ${theme.colors.dark.text.secondary};
    cursor: pointer;

    &:hover {
      background: ${theme.colors.brand.primary};
    }
  }

  &::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: ${theme.colors.dark.text.secondary};
    cursor: pointer;
    border: none;
  }
`;

export default BackingTrackPlayer;
