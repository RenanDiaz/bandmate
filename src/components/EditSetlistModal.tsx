import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { theme } from "../theme";
import type { Setlist } from "../services/setlistsService";

interface Props {
  setlist: Setlist | null;
  isOpen: boolean;
  onClose: () => void;
  onReload: () => void;
  bandId: number;
}

export const EditSetlistModal = ({ setlist, isOpen, onClose }: Props) => {
  const navigate = useNavigate();

  if (!isOpen || !setlist) return null;

  const handleEditSongs = () => {
    onClose();
    navigate(`/setlists/${setlist.id}/edit`);
  };

  const handleStartPerformance = () => {
    onClose();
    navigate(`/setlists/${setlist.id}/perform`);
  };

  const songCount = setlist.songs?.length || 0;

  return (
    <>
      <Overlay onClick={onClose} />
      <ModalContainer>
        <ModalHeader>
          <ModalTitle>
            <i className="bi bi-music-note-list"></i>
            {setlist.name}
          </ModalTitle>
          <CloseButton onClick={onClose} type="button" aria-label="Close">
            <i className="bi bi-x"></i>
          </CloseButton>
        </ModalHeader>

        <ModalContent>
          <InfoSection>
            {setlist.venue && (
              <InfoRow>
                <InfoLabel><i className="bi bi-geo-alt"></i> Venue:</InfoLabel>
                <InfoValue>{setlist.venue}</InfoValue>
              </InfoRow>
            )}
            {setlist.event_date && (
              <InfoRow>
                <InfoLabel><i className="bi bi-calendar-event"></i> Date:</InfoLabel>
                <InfoValue>{new Date(setlist.event_date).toLocaleDateString()}</InfoValue>
              </InfoRow>
            )}
            {setlist.description && (
              <InfoRow>
                <InfoLabel><i className="bi bi-card-text"></i> Description:</InfoLabel>
                <InfoValue>{setlist.description}</InfoValue>
              </InfoRow>
            )}
            <InfoRow>
              <InfoLabel><i className="bi bi-music-note-beamed"></i> Songs:</InfoLabel>
              <InfoValue>{songCount} songs</InfoValue>
            </InfoRow>
          </InfoSection>

          <ActionButtonsRow>
            <ActionButton onClick={handleStartPerformance} disabled={songCount === 0} $primary>
              <i className="bi bi-play-circle"></i>
              Start Performance
            </ActionButton>
            <ActionButton onClick={handleEditSongs}>
              <i className="bi bi-pencil"></i>
              Edit Songs & Details
            </ActionButton>
          </ActionButtonsRow>
        </ModalContent>
      </ModalContainer>
    </>
  );
};

// Styled Components

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  z-index: ${theme.zIndex.modal};
  animation: fadeIn 0.2s ease;

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
`;

const ModalContainer = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: ${theme.colors.dark.bg.secondary};
  border: 1px solid ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.lg};
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  z-index: ${theme.zIndex.modal + 10};
  box-shadow: ${theme.shadows.xl};
  animation: slideUp 0.3s ease;

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translate(-50%, -45%);
    }
    to {
      opacity: 1;
      transform: translate(-50%, -50%);
    }
  }
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${theme.space[6]};
  border-bottom: 1px solid ${theme.colors.dark.border.default};
  position: sticky;
  top: 0;
  background: ${theme.colors.dark.bg.secondary};
  z-index: 1;
`;

const ModalTitle = styled.h2`
  font-size: ${theme.fontSizes.h3};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.dark.text.primary};
  margin: 0;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};

  i {
    color: ${theme.colors.brand.primary};
    font-size: ${theme.fontSizes.h2};
  }
`;

const CloseButton = styled.button`
  background: transparent;
  border: none;
  color: ${theme.colors.dark.text.tertiary};
  width: 40px;
  height: 40px;
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  font-size: ${theme.fontSizes.h2};

  &:hover {
    background: ${theme.colors.dark.bg.elevated};
    color: ${theme.colors.dark.text.primary};
  }
`;

const ModalContent = styled.div`
  padding: ${theme.space[6]};
`;

const InfoSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[3]};
  margin-bottom: ${theme.space[6]};
`;

const InfoRow = styled.div`
  display: flex;
  gap: ${theme.space[3]};
`;

const InfoLabel = styled.div`
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.dark.text.secondary};
  min-width: 120px;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};

  i {
    color: ${theme.colors.brand.primary};
  }
`;

const InfoValue = styled.div`
  font-size: ${theme.fontSizes.body};
  color: ${theme.colors.dark.text.primary};
  flex: 1;
`;

const ActionButtonsRow = styled.div`
  display: flex;
  gap: ${theme.space[3]};
  width: 100%;
`;

const ActionButton = styled.button<{ $primary?: boolean }>`
  flex: 1;
  background: ${(props) =>
    props.$primary ? theme.colors.brand.primary : "transparent"};
  border: ${(props) =>
    props.$primary ? "none" : `1px solid ${theme.colors.dark.border.default}`};
  color: ${(props) =>
    props.$primary ? "white" : theme.colors.dark.text.primary};
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

  i {
    font-size: ${theme.fontSizes.bodyLg};
  }

  &:hover:not(:disabled) {
    background: ${(props) =>
      props.$primary ? theme.colors.brand.primaryHover : theme.colors.dark.bg.elevated};
    border-color: ${(props) =>
      props.$primary ? "transparent" : theme.colors.brand.primary};
    color: ${(props) =>
      props.$primary ? "white" : theme.colors.brand.primary};
    transform: translateY(-1px);
    box-shadow: ${(props) =>
      props.$primary ? theme.shadows.md : "none"};
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
