import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import styled from "styled-components";
import { useTranslation } from "react-i18next";
import { theme } from "../theme";
import { useToast } from "../context/useToast";
import { BackingTrackEngine } from "../lib/backingTrackEngine";

interface BackingTrackPlayerProps {
  songId: string;
  trackUrl: string | null;
  trackFileName: string | null;
  hadTrackPreviously: boolean;
  onLoadTrack: (songId: string, file: File) => void;
  onRemoveTrack: (songId: string) => void;
  isHost: boolean;
  onTimeUpdate?: (time: number) => void;
  onPlayingChange?: (isPlaying: boolean) => void;
}

export interface BackingTrackPlayerHandle {
  togglePlayPause: () => void;
  stop: () => void;
  expand: () => void;
}

const VOLUMES_STORAGE_KEY = "bandmate_backing_track_volumes";

interface ChannelVolumes {
  l: number;
  r: number;
}

function loadStoredVolumes(songId: string): ChannelVolumes {
  try {
    const raw = localStorage.getItem(VOLUMES_STORAGE_KEY);
    if (!raw) return { l: 1, r: 1 };
    const parsed = JSON.parse(raw) as Record<string, ChannelVolumes>;
    const stored = parsed[songId];
    if (!stored) return { l: 1, r: 1 };
    return {
      l: typeof stored.l === "number" ? stored.l : 1,
      r: typeof stored.r === "number" ? stored.r : 1,
    };
  } catch {
    return { l: 1, r: 1 };
  }
}

function persistVolumes(songId: string, volumes: ChannelVolumes) {
  try {
    const raw = localStorage.getItem(VOLUMES_STORAGE_KEY);
    const parsed = (raw ? JSON.parse(raw) : {}) as Record<string, ChannelVolumes>;
    parsed[songId] = volumes;
    localStorage.setItem(VOLUMES_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // ignore persistence errors
  }
}

export const BackingTrackPlayer = forwardRef<BackingTrackPlayerHandle, BackingTrackPlayerProps>(function BackingTrackPlayer({
  songId,
  trackUrl,
  trackFileName,
  hadTrackPreviously,
  onLoadTrack,
  onRemoveTrack,
  isHost,
  onTimeUpdate,
  onPlayingChange,
}, ref) {
  const { t } = useTranslation();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [stalled, setStalled] = useState(false);
  const initialVolumes = loadStoredVolumes(songId);
  const [volumeL, setVolumeL] = useState(initialVolumes.l);
  const [volumeR, setVolumeR] = useState(initialVolumes.r);
  const [isExpanded, setIsExpanded] = useState(false);

  // Latest callbacks, read by the engine's listener.
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onPlayingChangeRef = useRef(onPlayingChange);
  const stallMessageRef = useRef(() => {});
  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
    onPlayingChangeRef.current = onPlayingChange;
    stallMessageRef.current = () => toast.warning(t("backingTrack.stalled"));
  }, [onTimeUpdate, onPlayingChange, toast, t]);

  // Playback lives in the engine (fresh element after a stop/seek, stall
  // watchdog): see src/lib/backingTrackEngine.ts.
  const engineRef = useRef<BackingTrackEngine | null>(null);
  useEffect(() => {
    const engine = new BackingTrackEngine({
      onTimeUpdate: (time) => {
        setCurrentTime(time);
        onTimeUpdateRef.current?.(time);
      },
      onDurationChange: setDuration,
      onPlayingChange: (playing) => {
        setIsPlaying(playing);
        if (playing) setStalled(false);
        onPlayingChangeRef.current?.(playing);
      },
      onStalled: () => {
        setStalled(true);
        stallMessageRef.current();
      },
    });
    engineRef.current = engine;
    return () => {
      engine.dispose();
      if (engineRef.current === engine) engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setSource(trackUrl);
  }, [trackUrl]);

  // Reset player state and load stored volumes when song changes
  useEffect(() => {
    engineRef.current?.stop();
    setStalled(false);
    const stored = loadStoredVolumes(songId);
    setVolumeL(stored.l);
    setVolumeR(stored.r);
  }, [songId]);

  // Keep gain nodes in sync with state and persist to localStorage
  useEffect(() => {
    engineRef.current?.setVolumes({ l: volumeL, r: volumeR });
    persistVolumes(songId, { l: volumeL, r: volumeR });
  }, [songId, volumeL, volumeR]);

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
    const engine = engineRef.current;
    if (!engine || !trackUrl) return;
    // The element's real state, not React's: they can disagree.
    if (engine.isPlaying) engine.pause();
    else engine.play();
  }, [trackUrl]);

  const handleSeek = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    engineRef.current?.seek(parseFloat(event.target.value));
  }, []);

  const handleVolumeLChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setVolumeL(parseFloat(event.target.value));
  }, []);

  const handleVolumeRChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setVolumeR(parseFloat(event.target.value));
  }, []);

  const handleStop = useCallback(() => {
    engineRef.current?.stop();
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

  // Expose control methods for external use (e.g., mini player in sheet music view)
  useImperativeHandle(ref, () => ({
    togglePlayPause: handlePlayPause,
    stop: handleStop,
    expand: () => setIsExpanded(true),
  }), [handlePlayPause, handleStop]);

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

      <PlayerHeader onClick={() => trackUrl && setIsExpanded(!isExpanded)}>
        <HeaderLeft>
          <PlayerIcon $hasTrack={!!trackUrl}>
            <i className={`bi bi-${trackUrl ? "soundwave" : "music-note-beamed"}`}></i>
          </PlayerIcon>
          <HeaderInfo>
            <HeaderTitle>{t("backingTrack.title")}</HeaderTitle>
            {trackUrl && stalled ? (
              <HeaderWarning role="status">{t("backingTrack.stalled")}</HeaderWarning>
            ) : trackUrl && trackFileName ? (
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

            <ChannelMixer>
              <ChannelRow>
                <ChannelLabel>
                  <ChannelTag>L</ChannelTag>
                  {t("backingTrack.channelTrack")}
                </ChannelLabel>
                <VolumeIcon $muted={volumeL === 0}>
                  <i className={`bi bi-volume-${volumeL === 0 ? "mute" : volumeL < 0.5 ? "down" : "up"}-fill`}></i>
                </VolumeIcon>
                <VolumeSlider
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volumeL}
                  onChange={handleVolumeLChange}
                  aria-label={t("backingTrack.channelTrack")}
                />
              </ChannelRow>
              <ChannelRow>
                <ChannelLabel>
                  <ChannelTag>R</ChannelTag>
                  {t("backingTrack.channelClick")}
                </ChannelLabel>
                <VolumeIcon $muted={volumeR === 0}>
                  <i className={`bi bi-volume-${volumeR === 0 ? "mute" : volumeR < 0.5 ? "down" : "up"}-fill`}></i>
                </VolumeIcon>
                <VolumeSlider
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volumeR}
                  onChange={handleVolumeRChange}
                  aria-label={t("backingTrack.channelClick")}
                />
              </ChannelRow>
            </ChannelMixer>

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
});

// Styled Components

const PlayerContainer = styled.div<{ $hasTrack: boolean; $isExpanded: boolean }>`
  background: ${(props) =>
    props.$hasTrack
      ? `linear-gradient(135deg, var(--color-bg-secondary) 0%, var(--color-bg-tertiary) 100%)`
      : 'var(--color-bg-secondary)'};
  border: 1px solid ${(props) =>
    props.$hasTrack ? theme.colors.brand.primary + "40" : 'var(--color-border)'};
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
  gap: ${theme.space[3]};
  padding: ${theme.space[4]} ${theme.space[5]};
  cursor: pointer;

  @media (max-width: ${theme.breakpoints.md}) {
    padding: ${theme.space[2]} ${theme.space[3]};
  }
  transition: background ${theme.transitions.fast} ease;

  &:hover {
    background: rgba(255, 255, 255, 0.03);
  }
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[4]};
  flex: 1;
  min-width: 0;

  @media (max-width: ${theme.breakpoints.md}) {
    gap: ${theme.space[3]};
  }
`;

const PlayerIcon = styled.div<{ $hasTrack: boolean }>`
  width: 44px;
  height: 44px;
  border-radius: ${theme.radius.base};
  background: ${(props) =>
    props.$hasTrack ? theme.colors.brand.primary : 'var(--color-bg-tertiary)'};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${theme.fontSizes.h3};
  color: ${(props) =>
    props.$hasTrack ? "white" : 'var(--color-text-tertiary)'};
  transition: all ${theme.transitions.fast} ease;
  flex-shrink: 0;

  @media (max-width: ${theme.breakpoints.md}) {
    width: 32px;
    height: 32px;
    font-size: ${theme.fontSizes.body};
  }

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
  min-width: 0;

  @media (max-width: ${theme.breakpoints.md}) {
    gap: 0;
  }
`;

const HeaderTitle = styled.div`
  font-size: ${theme.fontSizes.body};
  line-height: ${theme.lineHeights.tight};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);

  @media (max-width: ${theme.breakpoints.md}) {
    font-size: ${theme.fontSizes.bodySm};
  }
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

const HeaderWarning = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: ${theme.colors.semantic.warning};
`;

const HeaderHint = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-tertiary);

  @media (max-width: ${theme.breakpoints.md}) {
    font-size: ${theme.fontSizes.bodyXs};
  }
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  flex-shrink: 0;
`;

const ActionButton = styled.button<{ $variant: "play" | "default" }>`
  width: 40px;
  height: 40px;
  border-radius: ${theme.radius.full};
  border: none;
  background: ${(props) =>
    props.$variant === "play" ? theme.colors.brand.primary : "transparent"};
  color: ${(props) =>
    props.$variant === "play" ? "white" : 'var(--color-text-secondary)'};
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
        : 'var(--color-bg-elevated)'};
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
  white-space: nowrap;

  @media (max-width: ${theme.breakpoints.md}) {
    padding: ${theme.space[1]} ${theme.space[3]};
  }

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
  border-top: 1px solid var(--color-border);
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
  color: var(--color-text-secondary);
  min-width: 45px;
  text-align: center;
`;

const ProgressSlider = styled.input`
  flex: 1;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--color-bg-tertiary);
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
      : 'var(--color-border)'};
  background: ${(props) =>
    props.$primary ? theme.colors.brand.primary : "transparent"};
  color: ${(props) =>
    props.$primary
      ? "white"
      : props.$danger
      ? theme.colors.semantic.error
      : 'var(--color-text-secondary)'};
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
        : 'var(--color-bg-elevated)'};
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

const ChannelMixer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[2]};
  flex: 1;
  max-width: 280px;

  @media (max-width: ${theme.breakpoints.md}) {
    order: 3;
    width: 100%;
    max-width: none;
  }
`;

const ChannelRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
`;

const ChannelLabel = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
  min-width: 110px;

  @media (max-width: ${theme.breakpoints.md}) {
    min-width: 100px;
  }
`;

const ChannelTag = styled.span`
  font-size: ${theme.fontSizes.bodySm};
  font-family: ${theme.fonts.mono};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.brand.primary};
  background: ${theme.colors.brand.primary}20;
  border-radius: ${theme.radius.base};
  padding: 0 ${theme.space[2]};
  min-width: 22px;
  text-align: center;
`;

const VolumeIcon = styled.div<{ $muted: boolean }>`
  color: ${(props) =>
    props.$muted ? 'var(--color-text-tertiary)' : 'var(--color-text-secondary)'};
  font-size: ${theme.fontSizes.bodyLg};
  width: 24px;
  text-align: center;
`;

const VolumeSlider = styled.input`
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--color-bg-tertiary);
  border-radius: ${theme.radius.full};
  cursor: pointer;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--color-text-secondary);
    cursor: pointer;

    &:hover {
      background: ${theme.colors.brand.primary};
    }
  }

  &::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--color-text-secondary);
    cursor: pointer;
    border: none;
  }
`;

export default BackingTrackPlayer;
