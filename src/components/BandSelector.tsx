import type { FC } from "react";
import { useEffect, useState } from "react";
import { Spinner, Container } from "reactstrap";
import styled from "styled-components";
import { theme } from "../theme";
import {
  createBand,
  getMyBands,
  updateBand,
  deleteBand,
  type Band,
  type CreateBandInput,
  type UpdateBandInput,
} from "../services/bandsService";
import { BandList } from "./BandList";
import { NewBandForm } from "./NewBandForm";
import { EditBandModal } from "./EditBandModal";

interface Props {
  selectedBand?: Band;
  onSelect: (band: Band) => void;
}

export const BandSelector: FC<Props> = ({ onSelect, selectedBand }) => {
  const [bands, setBands] = useState<Band[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingBand, setEditingBand] = useState<Band | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const loadBands = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMyBands();
      setBands(data);
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError("An unexpected error occurred.");
      }
    }
    setLoading(false);
  };

  const handleBandCreated = async (input: CreateBandInput) => {
    try {
      await createBand(input);
      await loadBands();
    } catch (e: unknown) {
      if (e instanceof Error) {
        alert(`Failed to create band: ${e.message}`);
      } else {
        alert("Failed to create band. Please try again.");
      }
    }
  };

  const handleEditBand = (band: Band) => {
    setEditingBand(band);
    setIsEditModalOpen(true);
  };

  const handleSaveBand = async (bandId: number, updates: UpdateBandInput) => {
    await updateBand(bandId, updates);
    await loadBands();
    if (selectedBand?.id === bandId) {
      const updatedBand = bands.find((b) => b.id === bandId);
      if (updatedBand) {
        onSelect({ ...updatedBand, ...updates });
      }
    }
  };

  const handleDeleteBand = async (band: Band) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${band.name}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await deleteBand(band.id);
      if (selectedBand?.id === band.id) {
        onSelect(null as unknown as Band);
      }
      await loadBands();
    } catch (e: unknown) {
      if (e instanceof Error) {
        alert(`Failed to delete band: ${e.message}`);
      } else {
        alert("Failed to delete band. Please try again.");
      }
    }
  };

  useEffect(() => {
    loadBands();
  }, []);

  return (
    <SelectorWrapper>
      <Container>
        <SelectorHeader>
          <HeaderIcon>
            <i className="bi bi-music-note-beamed"></i>
          </HeaderIcon>
          <HeaderContent>
            <HeaderTitle>Select Your Band</HeaderTitle>
            <HeaderSubtitle>
              Choose a band to manage songs and collaborate with your members
            </HeaderSubtitle>
          </HeaderContent>
        </SelectorHeader>

        <ContentSection>
          <NewBandForm onBandCreated={handleBandCreated} />

          {loading ? (
            <LoadingContainer>
              <Spinner color="primary" style={{ width: '3rem', height: '3rem' }} />
              <LoadingText>Loading your bands...</LoadingText>
            </LoadingContainer>
          ) : error ? (
            <ErrorContainer>
              <ErrorIcon>
                <i className="bi bi-exclamation-circle"></i>
              </ErrorIcon>
              <ErrorText>{error}</ErrorText>
              <RetryButton onClick={loadBands}>
                <i className="bi bi-arrow-clockwise"></i>
                Try again
              </RetryButton>
            </ErrorContainer>
          ) : bands.length === 0 ? (
            <EmptyState>
              <EmptyIcon>
                <i className="bi bi-music-note-list"></i>
              </EmptyIcon>
              <EmptyTitle>No bands yet</EmptyTitle>
              <EmptyText>
                Create your first band above to start managing your songs and setlists
              </EmptyText>
            </EmptyState>
          ) : (
            <BandList
              bands={bands}
              onSelect={onSelect}
              onEdit={handleEditBand}
              onDelete={handleDeleteBand}
              selectedBandId={selectedBand?.id}
            />
          )}
        </ContentSection>

        <EditBandModal
          band={editingBand}
          isOpen={isEditModalOpen}
          toggle={() => setIsEditModalOpen(false)}
          onSave={handleSaveBand}
        />
      </Container>
    </SelectorWrapper>
  );
};

// Styled Components

const SelectorWrapper = styled.div`
  min-height: calc(100vh - 80px);
  background: ${theme.colors.dark.bg.primary};
  padding: ${theme.space[8]} 0;

  @media (max-width: ${theme.breakpoints.md}) {
    padding: ${theme.space[6]} 0;
  }
`;

const SelectorHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[4]};
  margin-bottom: ${theme.space[8]};
  padding-bottom: ${theme.space[6]};
  border-bottom: 1px solid ${theme.colors.dark.border.default};

  @media (max-width: ${theme.breakpoints.md}) {
    flex-direction: column;
    text-align: center;
    gap: ${theme.space[3]};
  }
`;

const HeaderIcon = styled.div`
  width: 64px;
  height: 64px;
  background: ${theme.gradients.brandPrimary};
  border-radius: ${theme.radius.lg};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${theme.fontSizes.displayMd};
  color: white;
  flex-shrink: 0;
`;

const HeaderContent = styled.div`
  flex: 1;
`;

const HeaderTitle = styled.h1`
  font-size: ${theme.fontSizes.displayMd};
  font-weight: ${theme.fontWeights.bold};
  color: ${theme.colors.dark.text.primary};
  margin-bottom: ${theme.space[2]};
  line-height: ${theme.lineHeights.tight};

  @media (max-width: ${theme.breakpoints.md}) {
    font-size: ${theme.fontSizes.h1};
  }
`;

const HeaderSubtitle = styled.p`
  font-size: ${theme.fontSizes.body};
  color: ${theme.colors.dark.text.secondary};
  margin: 0;
  line-height: ${theme.lineHeights.relaxed};
`;

const ContentSection = styled.div`
  max-width: 800px;
  margin: 0 auto;
`;

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${theme.space[12]} 0;
  gap: ${theme.space[4]};
`;

const LoadingText = styled.p`
  font-size: ${theme.fontSizes.body};
  color: ${theme.colors.dark.text.secondary};
  margin: 0;
`;

const ErrorContainer = styled.div`
  background: ${theme.colors.semantic.errorBgDark};
  border: 1px solid ${theme.colors.semantic.error};
  border-radius: ${theme.radius.lg};
  padding: ${theme.space[8]};
  text-align: center;
  margin-top: ${theme.space[6]};
`;

const ErrorIcon = styled.div`
  font-size: ${theme.fontSizes.displayMd};
  color: ${theme.colors.semantic.error};
  margin-bottom: ${theme.space[3]};
`;

const ErrorText = styled.p`
  font-size: ${theme.fontSizes.body};
  color: ${theme.colors.dark.text.primary};
  margin-bottom: ${theme.space[4]};
`;

const RetryButton = styled.button`
  background: ${theme.colors.brand.primary};
  color: white;
  border: none;
  padding: ${theme.space[3]} ${theme.space[6]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[2]};

  &:hover {
    background: ${theme.colors.brand.primaryHover};
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: ${theme.space[12]} ${theme.space[6]};
  background: ${theme.colors.dark.bg.secondary};
  border: 1px dashed ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.lg};
  margin-top: ${theme.space[6]};
`;

const EmptyIcon = styled.div`
  font-size: ${theme.fontSizes.displayLg};
  color: ${theme.colors.dark.text.tertiary};
  margin-bottom: ${theme.space[4]};
  opacity: 0.5;
`;

const EmptyTitle = styled.h3`
  font-size: ${theme.fontSizes.h2};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.dark.text.primary};
  margin-bottom: ${theme.space[2]};
`;

const EmptyText = styled.p`
  font-size: ${theme.fontSizes.body};
  color: ${theme.colors.dark.text.secondary};
  margin: 0;
  line-height: ${theme.lineHeights.relaxed};
`;
