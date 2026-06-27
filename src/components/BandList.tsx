import type { FC } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Band } from "../services/bandsService";
import styled from "styled-components";
import { theme } from "../theme";
import { BandAvatar } from "./BandAvatar";

interface Props {
  bands: Band[];
  onSelect: (band: Band) => void;
  onEdit: (band: Band) => void;
  onDelete: (band: Band) => void;
  selectedBandId?: number;
}

export const BandList: FC<Props> = ({ bands, onSelect, onEdit, onDelete, selectedBandId }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const getRoleBadgeColor = (role?: string) => {
    switch (role) {
      case "owner":
        return { bg: theme.gradients.brandPrimary, text: "white" };
      case "member":
        return { bg: 'var(--color-bg-tertiary)', text: 'var(--color-text-primary)' };
      case "guest":
        return { bg: theme.colors.semantic.warningBgDark, text: theme.colors.semantic.warning };
      default:
        return { bg: 'var(--color-bg-tertiary)', text: 'var(--color-text-secondary)' };
    }
  };

  return (
  <BandGrid>
    {bands.map((band) => (
      <BandCard
        key={band.id}
        $isSelected={selectedBandId === band.id}
        onClick={() => onSelect(band)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(band);
          }
        }}
      >
        <BandCardContent>
          <BandAvatar
            name={band.name}
            avatarUrl={band.avatar_url}
            size={56}
            active={selectedBandId === band.id}
          />

          <BandInfo>
            <BandNameRow>
              <BandName>{band.name}</BandName>
              {band.user_role && (() => {
                const roleColors = getRoleBadgeColor(band.user_role);
                return (
                  <RoleBadge $bg={roleColors.bg} $text={roleColors.text}>
                    {t(`bands.${band.user_role}`)}
                  </RoleBadge>
                );
              })()}
            </BandNameRow>
            {band.genre && <BandGenre>{band.genre}</BandGenre>}
            {band.description && <BandDescription>{band.description}</BandDescription>}
          </BandInfo>

          {selectedBandId === band.id && (
            <SelectedBadge>
              <i className="bi bi-check-circle-fill"></i>
              {t('bands.selected')}
            </SelectedBadge>
          )}
        </BandCardContent>

        <BandActions onClick={(e) => e.stopPropagation()}>
          <ActionButton
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/bands/${band.id}/settings`);
            }}
            title={t('bands.settingsTooltip')}
            aria-label={t('bands.manageBandAriaLabel', { name: band.name })}
          >
            <i className="bi bi-people"></i>
          </ActionButton>
          <ActionButton
            onClick={(e) => {
              e.stopPropagation();
              onEdit(band);
            }}
            title={t('bands.editBandTooltip')}
            aria-label={t('bands.editBandAriaLabel', { name: band.name })}
          >
            <i className="bi bi-pencil"></i>
          </ActionButton>
          {band.user_role === "owner" && (
            <ActionButton
              onClick={(e) => {
                e.stopPropagation();
                onDelete(band);
              }}
              title={t('bands.deleteBandTooltip')}
              aria-label={t('bands.deleteBandAriaLabel', { name: band.name })}
              $danger
            >
              <i className="bi bi-trash"></i>
            </ActionButton>
          )}
        </BandActions>
      </BandCard>
    ))}
  </BandGrid>
  );
};

// Styled Components

const BandGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: ${theme.space[4]};
  margin-top: ${theme.space[6]};

  @media (max-width: ${theme.breakpoints.md}) {
    grid-template-columns: 1fr;
  }
`;

const BandCard = styled.div<{ $isSelected: boolean }>`
  background: var(--color-bg-secondary);
  border: 2px solid ${props => props.$isSelected
    ? theme.colors.brand.primary
    : 'var(--color-border)'};
  border-radius: ${theme.radius.lg};
  padding: ${theme.space[5]};
  cursor: pointer;
  transition: all ${theme.transitions.base} ease;
  position: relative;
  overflow: hidden;

  ${props => props.$isSelected && `
    background: var(--color-bg-tertiary);
    box-shadow: ${theme.shadows.glow};
  `}

  &:hover {
    transform: translateY(-4px);
    border-color: ${theme.colors.brand.primary};
    box-shadow: var(--shadow-lg);
  }

  &:focus {
    outline: none;
    border-color: ${theme.colors.brand.primary};
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.2);
  }

  &:active {
    transform: translateY(-2px);
  }
`;

const BandCardContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[4]};
  margin-bottom: ${theme.space[4]};
`;

const BandInfo = styled.div`
  flex: 1;
`;

const BandNameRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  flex-wrap: wrap;
`;

const BandName = styled.h3`
  font-size: ${theme.fontSizes.h3};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin: 0;
  line-height: ${theme.lineHeights.snug};
`;

const RoleBadge = styled.span<{ $bg: string; $text: string }>`
  background: ${(props) => props.$bg};
  color: ${(props) => props.$text};
  padding: ${theme.space[1]} ${theme.space[2]};
  border-radius: ${theme.radius.sm};
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.semibold};
  text-transform: uppercase;
  letter-spacing: ${theme.letterSpacing.wide};
  white-space: nowrap;
`;

const BandGenre = styled.div`
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[1]};
  font-size: ${theme.fontSizes.bodyXs};
  color: var(--color-text-tertiary);
  background: var(--color-bg-elevated);
  padding: ${theme.space[1]} ${theme.space[2]};
  border-radius: ${theme.radius.sm};
  margin-bottom: ${theme.space[2]};
  text-transform: uppercase;
  letter-spacing: ${theme.letterSpacing.wide};
  font-weight: ${theme.fontWeights.medium};

  &::before {
    content: '♪';
    font-size: ${theme.fontSizes.bodySm};
  }
`;

const BandDescription = styled.p`
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);
  line-height: ${theme.lineHeights.relaxed};
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const SelectedBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: ${theme.space[1]};
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.brand.primary};
  background: rgba(139, 92, 246, 0.1);
  padding: ${theme.space[1]} ${theme.space[3]};
  border-radius: ${theme.radius.base};
  text-transform: uppercase;
  letter-spacing: ${theme.letterSpacing.wide};
  align-self: flex-start;

  i {
    font-size: ${theme.fontSizes.bodySm};
  }
`;

const BandActions = styled.div`
  display: flex;
  gap: ${theme.space[2]};
  padding-top: ${theme.space[4]};
  border-top: 1px solid var(--color-border);
`;

const ActionButton = styled.button<{ $danger?: boolean }>`
  flex: 1;
  background: ${props => props.$danger
    ? 'transparent'
    : 'var(--color-bg-elevated)'};
  border: 1px solid ${props => props.$danger
    ? theme.colors.semantic.error
    : 'var(--color-border)'};
  color: ${props => props.$danger
    ? theme.colors.semantic.error
    : 'var(--color-text-primary)'};
  padding: ${theme.space[2]} ${theme.space[3]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${theme.space[2]};

  i {
    font-size: ${theme.fontSizes.body};
  }

  &:hover {
    background: ${props => props.$danger
      ? theme.colors.semantic.errorBgDark
      : 'var(--color-bg-hover)'};
    border-color: ${props => props.$danger
      ? theme.colors.semantic.error
      : theme.colors.brand.primary};
    color: ${props => props.$danger
      ? theme.colors.semantic.error
      : theme.colors.brand.primary};
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;
