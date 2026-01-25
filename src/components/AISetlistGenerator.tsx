import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import styled, { keyframes } from "styled-components";
import { theme } from "../theme";
import { groqService } from "../services/groqService";
import {
  generateSetlist,
  type SetlistGenerationOptions,
  type GeneratedSetlist,
} from "../services/aiSetlistService";
import { getBandSongs, type Song } from "../services/songsService";
import {
  getBandSetlists,
  createSetlist,
  type Setlist,
  type SetlistSongItem,
} from "../services/setlistsService";

interface Props {
  bandId: number;
  onSetlistCreated: () => void;
}

type MoodType = "energetic" | "chill" | "mixed" | "building";

export const AISetlistGenerator = ({ bandId, onSetlistCreated }: Props) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [isExpanded, setIsExpanded] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedSetlist, setGeneratedSetlist] = useState<GeneratedSetlist | null>(null);

  // Form state
  const [mood, setMood] = useState<MoodType>("mixed");
  const [songCount, setSongCount] = useState<number>(12);
  const [targetDuration, setTargetDuration] = useState<number>(60);
  const [useDuration, setUseDuration] = useState(false);
  const [includeSets, setIncludeSets] = useState(false);
  const [numberOfSets, setNumberOfSets] = useState(2);
  const [customInstructions, setCustomInstructions] = useState("");

  // Data
  const [songs, setSongs] = useState<Song[]>([]);
  const [previousSetlists, setPreviousSetlists] = useState<Setlist[]>([]);

  useEffect(() => {
    setIsConfigured(groqService.isConfigured());
  }, []);

  useEffect(() => {
    if (isExpanded && bandId) {
      loadData();
    }
  }, [isExpanded, bandId]);

  const loadData = async () => {
    try {
      const [songsData, setlistsData] = await Promise.all([
        getBandSongs(bandId),
        getBandSetlists(bandId),
      ]);
      setSongs(songsData);
      setPreviousSetlists(setlistsData);
    } catch (err) {
      console.error("Failed to load data:", err);
    }
  };

  const handleGenerate = async () => {
    if (songs.length < 3) {
      setError(t("ai.needMoreSongs"));
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedSetlist(null);

    try {
      const options: SetlistGenerationOptions = {
        mood,
        songCount: useDuration ? undefined : songCount,
        targetDuration: useDuration ? targetDuration : undefined,
        includeSets,
        numberOfSets: includeSets ? numberOfSets : undefined,
        customInstructions: customInstructions.trim() || undefined,
      };

      const result = await generateSetlist(songs, previousSetlists, options);
      setGeneratedSetlist(result);
    } catch (err) {
      console.error("Failed to generate setlist:", err);
      setError(err instanceof Error ? err.message : t("ai.generationError"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSetlist = async () => {
    if (!generatedSetlist) return;

    setIsLoading(true);
    try {
      // Convert generated songs to SetlistSongItem format
      const setlistSongs: SetlistSongItem[] = generatedSetlist.songs.map(
        (song, index) => ({
          type: "song" as const,
          song_id: song.songId,
          position: index,
          notes: song.notes,
        })
      );

      const newSetlist = await createSetlist({
        band_id: bandId,
        name: generatedSetlist.name,
        description: generatedSetlist.description,
        songs: setlistSongs,
      });

      setGeneratedSetlist(null);
      setIsExpanded(false);
      onSetlistCreated();

      // Navigate to the setlist editor
      navigate(`/setlists/${newSetlist.id}/edit`);
    } catch (err) {
      console.error("Failed to save setlist:", err);
      setError(t("setlists.createError"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDiscard = () => {
    setGeneratedSetlist(null);
  };

  const handleClose = () => {
    setIsExpanded(false);
    setGeneratedSetlist(null);
    setError(null);
  };

  if (!isConfigured) {
    return (
      <NotConfiguredBanner>
        <BannerIcon>
          <i className="bi bi-stars"></i>
        </BannerIcon>
        <BannerContent>
          <BannerTitle>{t("ai.title")}</BannerTitle>
          <BannerText>{t("ai.notConfigured")}</BannerText>
        </BannerContent>
      </NotConfiguredBanner>
    );
  }

  if (!isExpanded) {
    return (
      <ExpandButton onClick={() => setIsExpanded(true)}>
        <AIIcon>
          <i className="bi bi-stars"></i>
        </AIIcon>
        <span>{t("ai.generateWithAI")}</span>
      </ExpandButton>
    );
  }

  return (
    <GeneratorCard>
      <CardHeader>
        <HeaderTitle>
          <AIIcon $large>
            <i className="bi bi-stars"></i>
          </AIIcon>
          {t("ai.generateSetlist")}
        </HeaderTitle>
        <CloseButton onClick={handleClose} aria-label={t("common.close")}>
          <i className="bi bi-x-lg"></i>
        </CloseButton>
      </CardHeader>

      {!generatedSetlist ? (
        <FormContent>
          <InfoBanner>
            <i className="bi bi-info-circle"></i>
            <span>{t("ai.generateDescription", { count: songs.length })}</span>
          </InfoBanner>

          <OptionsGrid>
            <OptionGroup>
              <OptionLabel>{t("ai.mood")}</OptionLabel>
              <MoodSelector>
                {(["energetic", "chill", "mixed", "building"] as MoodType[]).map((m) => (
                  <MoodOption
                    key={m}
                    $active={mood === m}
                    onClick={() => setMood(m)}
                  >
                    <MoodIcon>
                      {m === "energetic" && <i className="bi bi-lightning-fill"></i>}
                      {m === "chill" && <i className="bi bi-moon-stars-fill"></i>}
                      {m === "mixed" && <i className="bi bi-shuffle"></i>}
                      {m === "building" && <i className="bi bi-graph-up"></i>}
                    </MoodIcon>
                    <MoodText>{t(`ai.moods.${m}`)}</MoodText>
                  </MoodOption>
                ))}
              </MoodSelector>
            </OptionGroup>

            <OptionGroup>
              <OptionLabel>{t("ai.setlistLength")}</OptionLabel>
              <LengthToggle>
                <ToggleOption
                  $active={!useDuration}
                  onClick={() => setUseDuration(false)}
                >
                  {t("ai.bySongs")}
                </ToggleOption>
                <ToggleOption
                  $active={useDuration}
                  onClick={() => setUseDuration(true)}
                >
                  {t("ai.byDuration")}
                </ToggleOption>
              </LengthToggle>

              {useDuration ? (
                <SliderGroup>
                  <SliderLabel>
                    <span>{t("ai.targetDuration")}</span>
                    <SliderValue>{targetDuration} min</SliderValue>
                  </SliderLabel>
                  <Slider
                    type="range"
                    min={30}
                    max={180}
                    step={15}
                    value={targetDuration}
                    onChange={(e) => setTargetDuration(Number(e.target.value))}
                  />
                </SliderGroup>
              ) : (
                <SliderGroup>
                  <SliderLabel>
                    <span>{t("ai.numberOfSongs")}</span>
                    <SliderValue>{songCount}</SliderValue>
                  </SliderLabel>
                  <Slider
                    type="range"
                    min={5}
                    max={Math.min(30, songs.length)}
                    step={1}
                    value={songCount}
                    onChange={(e) => setSongCount(Number(e.target.value))}
                  />
                </SliderGroup>
              )}
            </OptionGroup>

            <OptionGroup>
              <CheckboxLabel>
                <Checkbox
                  type="checkbox"
                  checked={includeSets}
                  onChange={(e) => setIncludeSets(e.target.checked)}
                />
                <span>{t("ai.divideSets")}</span>
              </CheckboxLabel>
              {includeSets && (
                <SetCountSelector>
                  {[2, 3, 4].map((num) => (
                    <SetCountOption
                      key={num}
                      $active={numberOfSets === num}
                      onClick={() => setNumberOfSets(num)}
                    >
                      {num} {t("ai.sets")}
                    </SetCountOption>
                  ))}
                </SetCountSelector>
              )}
            </OptionGroup>

            <OptionGroup>
              <OptionLabel>
                <i className="bi bi-chat-dots"></i>
                {t("ai.customInstructions")}
              </OptionLabel>
              <TextArea
                placeholder={t("ai.customInstructionsPlaceholder")}
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                rows={3}
              />
            </OptionGroup>
          </OptionsGrid>

          {error && (
            <ErrorMessage>
              <i className="bi bi-exclamation-triangle"></i>
              {error}
            </ErrorMessage>
          )}

          <GenerateButton onClick={handleGenerate} disabled={isLoading || songs.length < 3}>
            {isLoading ? (
              <>
                <LoadingSpinner />
                {t("ai.generating")}
              </>
            ) : (
              <>
                <i className="bi bi-magic"></i>
                {t("ai.generateButton")}
              </>
            )}
          </GenerateButton>
        </FormContent>
      ) : (
        <ResultContent>
          <ResultHeader>
            <ResultTitle>{generatedSetlist.name}</ResultTitle>
            <ResultDescription>{generatedSetlist.description}</ResultDescription>
            <ResultMeta>
              <MetaItem>
                <i className="bi bi-music-note-list"></i>
                {generatedSetlist.songs.length} {t("setlists.songs")}
              </MetaItem>
              <MetaItem>
                <i className="bi bi-clock"></i>
                ~{generatedSetlist.estimatedDuration} min
              </MetaItem>
            </ResultMeta>
          </ResultHeader>

          <SongList>
            {generatedSetlist.songs.map((song, index) => (
              <SongItem key={song.songId}>
                <SongNumber>{index + 1}</SongNumber>
                <SongInfo>
                  <SongTitle>{song.title}</SongTitle>
                  {song.artist && <SongArtist>{song.artist}</SongArtist>}
                  {song.notes && <SongNotes>{song.notes}</SongNotes>}
                </SongInfo>
                {song.setNumber && (
                  <SetBadge>Set {song.setNumber}</SetBadge>
                )}
              </SongItem>
            ))}
          </SongList>

          <ReasoningSection>
            <ReasoningTitle>
              <i className="bi bi-lightbulb"></i>
              {t("ai.reasoning")}
            </ReasoningTitle>
            <ReasoningText>{generatedSetlist.reasoning}</ReasoningText>
          </ReasoningSection>

          <ResultActions>
            <DiscardButton onClick={handleDiscard}>
              <i className="bi bi-arrow-counterclockwise"></i>
              {t("ai.regenerate")}
            </DiscardButton>
            <SaveButton onClick={handleSaveSetlist} disabled={isLoading}>
              {isLoading ? (
                <>
                  <LoadingSpinner />
                  {t("common.saving")}
                </>
              ) : (
                <>
                  <i className="bi bi-check-circle"></i>
                  {t("ai.saveAndEdit")}
                </>
              )}
            </SaveButton>
          </ResultActions>
        </ResultContent>
      )}
    </GeneratorCard>
  );
};

// Animations
const spin = keyframes`
  to {
    transform: rotate(360deg);
  }
`;

// Styled Components

const NotConfiguredBanner = styled.div`
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%);
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: ${theme.radius.lg};
  padding: ${theme.space[5]};
  display: flex;
  align-items: center;
  gap: ${theme.space[4]};
  margin-bottom: ${theme.space[4]};
`;

const BannerIcon = styled.div`
  font-size: ${theme.fontSizes.h1};
  color: ${theme.colors.brand.primary};
  opacity: 0.7;
`;

const BannerContent = styled.div`
  flex: 1;
`;

const BannerTitle = styled.h4`
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin: 0 0 ${theme.space[1]} 0;
`;

const BannerText = styled.p`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
  margin: 0;
`;

const ExpandButton = styled.button`
  width: 100%;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%);
  border: 1px solid rgba(139, 92, 246, 0.3);
  color: ${theme.colors.brand.primary};
  padding: ${theme.space[4]} ${theme.space[6]};
  border-radius: ${theme.radius.lg};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.base} ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${theme.space[3]};
  margin-bottom: ${theme.space[4]};

  &:hover {
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.25) 0%, rgba(59, 130, 246, 0.25) 100%);
    border-color: ${theme.colors.brand.primary};
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.2);
  }
`;

const AIIcon = styled.span<{ $large?: boolean }>`
  font-size: ${(props) => (props.$large ? theme.fontSizes.h2 : theme.fontSizes.h3)};
  display: flex;
  align-items: center;
`;

const GeneratorCard = styled.div`
  background: var(--color-bg-secondary);
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: ${theme.radius.lg};
  margin-bottom: ${theme.space[6]};
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(139, 92, 246, 0.1);
`;

const CardHeader = styled.div`
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%);
  padding: ${theme.space[5]} ${theme.space[6]};
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(139, 92, 246, 0.2);
`;

const HeaderTitle = styled.h3`
  font-size: ${theme.fontSizes.h3};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
`;

const CloseButton = styled.button`
  background: transparent;
  border: none;
  color: var(--color-text-tertiary);
  width: 36px;
  height: 36px;
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  font-size: ${theme.fontSizes.bodyLg};

  &:hover {
    background: var(--color-bg-elevated);
    color: var(--color-text-primary);
  }
`;

const FormContent = styled.div`
  padding: ${theme.space[6]};
`;

const InfoBanner = styled.div`
  background: var(--color-bg-tertiary);
  border-radius: ${theme.radius.base};
  padding: ${theme.space[4]};
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
  margin-bottom: ${theme.space[5]};

  i {
    color: ${theme.colors.brand.primary};
    font-size: ${theme.fontSizes.body};
  }
`;

const OptionsGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[5]};
`;

const OptionGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[3]};
`;

const OptionLabel = styled.label`
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};

  i {
    color: ${theme.colors.brand.primary};
  }
`;

const MoodSelector = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: ${theme.space[3]};

  @media (max-width: ${theme.breakpoints.sm}) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

const MoodOption = styled.button<{ $active: boolean }>`
  background: ${(props) =>
    props.$active
      ? "linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%)"
      : "var(--color-bg-tertiary)"};
  border: 1px solid ${(props) => (props.$active ? theme.colors.brand.primary : "var(--color-border)")};
  border-radius: ${theme.radius.base};
  padding: ${theme.space[3]};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${theme.space[2]};

  &:hover {
    border-color: ${theme.colors.brand.primary};
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%);
  }
`;

const MoodIcon = styled.span`
  font-size: ${theme.fontSizes.h3};
  color: ${theme.colors.brand.primary};
`;

const MoodText = styled.span`
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  color: var(--color-text-primary);
`;

const LengthToggle = styled.div`
  display: flex;
  background: var(--color-bg-tertiary);
  border-radius: ${theme.radius.base};
  padding: ${theme.space[1]};
`;

const ToggleOption = styled.button<{ $active: boolean }>`
  flex: 1;
  background: ${(props) => (props.$active ? theme.colors.brand.primary : "transparent")};
  color: ${(props) => (props.$active ? "white" : "var(--color-text-secondary)")};
  border: none;
  border-radius: ${theme.radius.sm};
  padding: ${theme.space[2]} ${theme.space[4]};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  &:hover:not(:disabled) {
    color: ${(props) => (props.$active ? "white" : "var(--color-text-primary)")};
  }
`;

const SliderGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[2]};
`;

const SliderLabel = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
`;

const SliderValue = styled.span`
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.brand.primary};
`;

const Slider = styled.input`
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: var(--color-bg-tertiary);
  outline: none;
  -webkit-appearance: none;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: ${theme.colors.brand.primary};
    cursor: pointer;
    transition: transform ${theme.transitions.fast} ease;
  }

  &::-webkit-slider-thumb:hover {
    transform: scale(1.1);
  }

  &::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: ${theme.colors.brand.primary};
    cursor: pointer;
    border: none;
  }
`;

const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-primary);
  cursor: pointer;
`;

const Checkbox = styled.input`
  width: 20px;
  height: 20px;
  accent-color: ${theme.colors.brand.primary};
  cursor: pointer;
`;

const SetCountSelector = styled.div`
  display: flex;
  gap: ${theme.space[2]};
`;

const SetCountOption = styled.button<{ $active: boolean }>`
  flex: 1;
  background: ${(props) => (props.$active ? theme.colors.brand.primary : "var(--color-bg-tertiary)")};
  color: ${(props) => (props.$active ? "white" : "var(--color-text-secondary)")};
  border: 1px solid ${(props) => (props.$active ? theme.colors.brand.primary : "var(--color-border)")};
  border-radius: ${theme.radius.base};
  padding: ${theme.space[2]} ${theme.space[4]};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  &:hover {
    border-color: ${theme.colors.brand.primary};
  }
`;

const TextArea = styled.textarea`
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  padding: ${theme.space[3]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  font-family: ${theme.fonts.sans};
  resize: vertical;
  min-height: 80px;
  line-height: ${theme.lineHeights.relaxed};

  &::placeholder {
    color: var(--color-text-tertiary);
  }

  &:focus {
    outline: none;
    border-color: ${theme.colors.brand.primary};
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  }
`;

const ErrorMessage = styled.div`
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: ${theme.radius.base};
  padding: ${theme.space[4]};
  color: ${theme.colors.semantic.error};
  font-size: ${theme.fontSizes.bodySm};
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  margin-top: ${theme.space[4]};

  i {
    font-size: ${theme.fontSizes.body};
  }
`;

const GenerateButton = styled.button`
  width: 100%;
  background: linear-gradient(135deg, ${theme.colors.brand.primary} 0%, #3b82f6 100%);
  border: none;
  color: white;
  padding: ${theme.space[4]} ${theme.space[6]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.base} ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${theme.space[3]};
  margin-top: ${theme.space[5]};

  i {
    font-size: ${theme.fontSizes.h3};
  }

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(139, 92, 246, 0.4);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;

const LoadingSpinner = styled.span`
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: ${spin} 0.6s linear infinite;
`;

const ResultContent = styled.div`
  padding: ${theme.space[6]};
`;

const ResultHeader = styled.div`
  text-align: center;
  margin-bottom: ${theme.space[6]};
  padding-bottom: ${theme.space[5]};
  border-bottom: 1px solid var(--color-border);
`;

const ResultTitle = styled.h3`
  font-size: ${theme.fontSizes.h2};
  font-weight: ${theme.fontWeights.bold};
  color: var(--color-text-primary);
  margin: 0 0 ${theme.space[2]} 0;
`;

const ResultDescription = styled.p`
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-secondary);
  margin: 0 0 ${theme.space[4]} 0;
`;

const ResultMeta = styled.div`
  display: flex;
  justify-content: center;
  gap: ${theme.space[6]};
`;

const MetaItem = styled.span`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);

  i {
    color: ${theme.colors.brand.primary};
  }
`;

const SongList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[2]};
  max-height: 400px;
  overflow-y: auto;
  padding: ${theme.space[2]};
  margin: 0 -${theme.space[2]};
`;

const SongItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[4]};
  padding: ${theme.space[3]} ${theme.space[4]};
  background: var(--color-bg-tertiary);
  border-radius: ${theme.radius.base};
`;

const SongNumber = styled.span`
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.brand.primary};
  width: 24px;
  text-align: center;
`;

const SongInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const SongTitle = styled.div`
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.medium};
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const SongArtist = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
`;

const SongNotes = styled.div`
  font-size: ${theme.fontSizes.bodyXs};
  color: ${theme.colors.brand.primary};
  font-style: italic;
  margin-top: ${theme.space[1]};
`;

const SetBadge = styled.span`
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%);
  color: ${theme.colors.brand.primary};
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.semibold};
  padding: ${theme.space[1]} ${theme.space[2]};
  border-radius: ${theme.radius.sm};
`;

const ReasoningSection = styled.div`
  margin-top: ${theme.space[5]};
  padding: ${theme.space[4]};
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, rgba(59, 130, 246, 0.05) 100%);
  border-radius: ${theme.radius.base};
  border: 1px solid rgba(139, 92, 246, 0.2);
`;

const ReasoningTitle = styled.h4`
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin: 0 0 ${theme.space[2]} 0;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};

  i {
    color: ${theme.colors.brand.primary};
  }
`;

const ReasoningText = styled.p`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
  margin: 0;
  line-height: ${theme.lineHeights.relaxed};
`;

const ResultActions = styled.div`
  display: flex;
  gap: ${theme.space[3]};
  margin-top: ${theme.space[6]};

  @media (max-width: ${theme.breakpoints.sm}) {
    flex-direction: column-reverse;
  }
`;

const DiscardButton = styled.button`
  flex: 1;
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  padding: ${theme.space[3]} ${theme.space[6]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${theme.space[2]};

  &:hover {
    background: var(--color-bg-elevated);
    border-color: var(--color-border-strong);
  }
`;

const SaveButton = styled.button`
  flex: 2;
  background: linear-gradient(135deg, ${theme.colors.brand.primary} 0%, #3b82f6 100%);
  border: none;
  color: white;
  padding: ${theme.space[3]} ${theme.space[6]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${theme.space[2]};

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;
