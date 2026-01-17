import type { FC } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import { theme } from "../theme";
import type { Rehearsal } from "../services/rehearsalsService";

interface Props {
  rehearsals: Rehearsal[];
  filter: "upcoming" | "past" | "all";
  onEdit: (rehearsal: Rehearsal) => void;
  onDelete: (rehearsal: Rehearsal) => void;
  onMarkCompleted: (rehearsal: Rehearsal) => void;
  onMarkCancelled: (rehearsal: Rehearsal) => void;
}

const formatTime = (timeString: string): string => {
  const [hours, minutes] = timeString.split(":");
  const date = new Date();
  date.setHours(parseInt(hours), parseInt(minutes));
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const getDaysUntil = (eventDate: string): { text: string; isPast: boolean } => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const event = new Date(eventDate + "T00:00:00");
  const diffTime = event.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return { text: "Today!", isPast: false };
  if (diffDays === 1) return { text: "Tomorrow", isPast: false };
  if (diffDays < 0) return { text: `${Math.abs(diffDays)} days ago`, isPast: true };
  if (diffDays <= 7) return { text: `In ${diffDays} days`, isPast: false };
  return { text: `In ${Math.ceil(diffDays / 7)} weeks`, isPast: false };
};

export const RehearsalList: FC<Props> = ({
  rehearsals,
  filter,
  onEdit,
  onDelete,
  onMarkCompleted,
  onMarkCancelled,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (rehearsals.length === 0) {
    return (
      <EmptyState>
        <EmptyIcon>
          <i className="bi bi-calendar-check"></i>
        </EmptyIcon>
        <EmptyTitle>
          {filter === "upcoming"
            ? t('rehearsals.noUpcoming')
            : filter === "past"
            ? t('rehearsals.noPast')
            : t('rehearsals.noRehearsals')}
        </EmptyTitle>
        <EmptyDescription>
          {filter === "upcoming"
            ? t('rehearsals.createFirst')
            : filter === "past"
            ? t('rehearsals.completedAppear')
            : t('rehearsals.createFirstAll')}
        </EmptyDescription>
      </EmptyState>
    );
  }

  return (
    <ListGrid>
      {rehearsals.map((rehearsal) => {
        const countdown = getDaysUntil(rehearsal.rehearsal_date);
        const isUpcoming = rehearsal.status === "scheduled" && !countdown.isPast;
        const isCancelled = rehearsal.status === "cancelled";

        return (
          <RehearsalCard
            key={rehearsal.id}
            $isCancelled={isCancelled}
            onClick={() => navigate(`/rehearsals/${rehearsal.id}`)}
          >
            <CardHeader>
              <DateBadge $isCancelled={isCancelled}>
                <DateDay>
                  {new Date(rehearsal.rehearsal_date + "T00:00:00").getDate()}
                </DateDay>
                <DateMonth>
                  {new Date(rehearsal.rehearsal_date + "T00:00:00").toLocaleDateString(
                    "en-US",
                    { month: "short" }
                  )}
                </DateMonth>
              </DateBadge>
              <CardInfo>
                <RehearsalName $isCancelled={isCancelled}>
                  {rehearsal.name || t('rehearsals.rehearsal')}
                </RehearsalName>
                <RehearsalMeta>
                  {rehearsal.location && (
                    <MetaItem>
                      <i className="bi bi-geo-alt"></i>
                      {rehearsal.location}
                    </MetaItem>
                  )}
                  {rehearsal.start_time && (
                    <MetaItem>
                      <i className="bi bi-clock"></i>
                      {formatTime(rehearsal.start_time)}
                      {rehearsal.end_time && ` - ${formatTime(rehearsal.end_time)}`}
                    </MetaItem>
                  )}
                </RehearsalMeta>
              </CardInfo>
              {isUpcoming && (
                <CountdownBadge>
                  {countdown.text}
                </CountdownBadge>
              )}
            </CardHeader>

            <CardFooter>
              <StatusBadge $status={rehearsal.status} $isPast={countdown.isPast}>
                {isCancelled
                  ? t('rehearsals.statusCancelled')
                  : rehearsal.status === "completed"
                  ? t('rehearsals.statusCompleted')
                  : countdown.isPast
                  ? t('rehearsals.past')
                  : t('rehearsals.statusScheduled')}
              </StatusBadge>

              <CardActions onClick={(e) => e.stopPropagation()}>
                {isUpcoming && (
                  <>
                    <ActionButton
                      onClick={() => onMarkCompleted(rehearsal)}
                      title={t('rehearsals.markCompleted')}
                      $variant="success"
                    >
                      <i className="bi bi-check-circle"></i>
                    </ActionButton>
                    <ActionButton
                      onClick={() => onMarkCancelled(rehearsal)}
                      title={t('rehearsals.cancelRehearsal')}
                      $variant="warning"
                    >
                      <i className="bi bi-x-circle"></i>
                    </ActionButton>
                  </>
                )}
                <ActionButton
                  onClick={() => onEdit(rehearsal)}
                  title={t('rehearsals.editRehearsalTooltip')}
                  $variant="default"
                >
                  <i className="bi bi-pencil"></i>
                </ActionButton>
                <ActionButton
                  onClick={() => onDelete(rehearsal)}
                  title={t('rehearsals.deleteRehearsalTooltip')}
                  $variant="danger"
                >
                  <i className="bi bi-trash"></i>
                </ActionButton>
              </CardActions>
            </CardFooter>

            {(rehearsal.show_id || rehearsal.setlist_id) && (
              <LinkedInfo>
                {rehearsal.show_id && (
                  <LinkedItem>
                    <i className="bi bi-calendar-event"></i>
                    {t('rehearsals.linkedToShow')}
                  </LinkedItem>
                )}
                {rehearsal.setlist_id && (
                  <LinkedItem>
                    <i className="bi bi-music-note-list"></i>
                    {t('rehearsals.linkedToSetlist')}
                  </LinkedItem>
                )}
              </LinkedInfo>
            )}
          </RehearsalCard>
        );
      })}
    </ListGrid>
  );
};

// Styled Components

const ListGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: ${theme.space[4]};

  @media (max-width: ${theme.breakpoints.sm}) {
    grid-template-columns: 1fr;
  }
`;

const RehearsalCard = styled.div<{ $isCancelled: boolean }>`
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: ${theme.radius.lg};
  padding: ${theme.space[4]};
  cursor: pointer;
  transition: all ${theme.transitions.base} ease;
  opacity: ${(props) => (props.$isCancelled ? 0.7 : 1)};

  &:hover {
    border-color: ${theme.colors.brand.primary};
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
  }
`;

const CardHeader = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${theme.space[3]};
  margin-bottom: ${theme.space[3]};
`;

const DateBadge = styled.div<{ $isCancelled: boolean }>`
  width: 56px;
  height: 56px;
  background: ${(props) =>
    props.$isCancelled
      ? theme.colors.semantic.errorBgDark
      : theme.gradients.brandPrimary};
  border-radius: ${theme.radius.base};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

const DateDay = styled.div`
  font-size: ${theme.fontSizes.h3};
  font-weight: ${theme.fontWeights.bold};
  color: white;
  line-height: 1;
`;

const DateMonth = styled.div`
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.medium};
  color: rgba(255, 255, 255, 0.9);
  text-transform: uppercase;
`;

const CardInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const RehearsalName = styled.h3<{ $isCancelled: boolean }>`
  font-size: ${theme.fontSizes.body};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin: 0 0 ${theme.space[1]} 0;
  text-decoration: ${(props) => (props.$isCancelled ? "line-through" : "none")};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const RehearsalMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[1]};
`;

const MetaItem = styled.span`
  display: flex;
  align-items: center;
  gap: ${theme.space[1]};
  font-size: ${theme.fontSizes.bodySm};
  color: var(--color-text-secondary);

  i {
    font-size: ${theme.fontSizes.bodyXs};
    color: ${theme.colors.brand.primary};
  }
`;

const CountdownBadge = styled.span`
  padding: ${theme.space[1]} ${theme.space[2]};
  background: ${theme.colors.accent.amber}20;
  color: ${theme.colors.accent.amber};
  border-radius: ${theme.radius.sm};
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.medium};
  white-space: nowrap;
`;

const CardFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: ${theme.space[3]};
  border-top: 1px solid var(--color-border);
`;

const StatusBadge = styled.span<{ $status: string; $isPast: boolean }>`
  display: inline-flex;
  padding: ${theme.space[1]} ${theme.space[2]};
  border-radius: ${theme.radius.sm};
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.semibold};
  text-transform: uppercase;
  letter-spacing: ${theme.letterSpacing.wide};
  background: ${(props) =>
    props.$status === "cancelled"
      ? theme.colors.semantic.errorBgDark
      : props.$status === "completed" || props.$isPast
      ? "var(--color-bg-tertiary)"
      : theme.colors.semantic.successBgDark};
  color: ${(props) =>
    props.$status === "cancelled"
      ? theme.colors.semantic.error
      : props.$status === "completed" || props.$isPast
      ? "var(--color-text-tertiary)"
      : theme.colors.semantic.success};
`;

const CardActions = styled.div`
  display: flex;
  gap: ${theme.space[1]};
`;

const ActionButton = styled.button<{
  $variant: "default" | "success" | "warning" | "danger";
}>`
  background: transparent;
  border: 1px solid var(--color-border);
  color: ${(props) =>
    props.$variant === "success"
      ? theme.colors.semantic.success
      : props.$variant === "warning"
      ? theme.colors.accent.amber
      : props.$variant === "danger"
      ? theme.colors.semantic.error
      : "var(--color-text-secondary)"};
  width: 32px;
  height: 32px;
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  &:hover {
    background: ${(props) =>
      props.$variant === "success"
        ? theme.colors.semantic.successBgDark
        : props.$variant === "warning"
        ? theme.colors.semantic.warningBgDark
        : props.$variant === "danger"
        ? theme.colors.semantic.errorBgDark
        : "var(--color-bg-tertiary)"};
    border-color: ${(props) =>
      props.$variant === "success"
        ? theme.colors.semantic.success
        : props.$variant === "warning"
        ? theme.colors.accent.amber
        : props.$variant === "danger"
        ? theme.colors.semantic.error
        : theme.colors.brand.primary};
  }
`;

const LinkedInfo = styled.div`
  display: flex;
  gap: ${theme.space[3]};
  margin-top: ${theme.space[3]};
  padding-top: ${theme.space[3]};
  border-top: 1px dashed var(--color-border);
`;

const LinkedItem = styled.span`
  display: flex;
  align-items: center;
  gap: ${theme.space[1]};
  font-size: ${theme.fontSizes.bodyXs};
  color: var(--color-text-tertiary);

  i {
    color: ${theme.colors.brand.primary};
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: ${theme.space[12]};
  background: var(--color-bg-secondary);
  border: 1px dashed var(--color-border);
  border-radius: ${theme.radius.lg};
`;

const EmptyIcon = styled.div`
  font-size: ${theme.fontSizes.displayMd};
  color: var(--color-text-tertiary);
  margin-bottom: ${theme.space[3]};
  opacity: 0.5;
`;

const EmptyTitle = styled.h3`
  font-size: ${theme.fontSizes.h4};
  font-weight: ${theme.fontWeights.semibold};
  color: var(--color-text-primary);
  margin: 0 0 ${theme.space[2]} 0;
`;

const EmptyDescription = styled.p`
  font-size: ${theme.fontSizes.body};
  color: var(--color-text-secondary);
  margin: 0;
`;
