import type { FC } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { theme } from "../theme";
import type { Show } from "../services/showsService";

interface Props {
  shows: Show[];
  onEdit?: (show: Show) => void;
}

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export const ShowCalendar: FC<Props> = ({ shows }) => {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // Get first day of month and number of days
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay();

  // Get previous month's days to fill in the start
  const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();

  // Navigate months
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Get shows for a specific date
  const getShowsForDate = (year: number, month: number, day: number): Show[] => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return shows.filter((show) => show.event_date === dateStr);
  };

  // Check if a date is today
  const isToday = (year: number, month: number, day: number): boolean => {
    const today = new Date();
    return (
      today.getFullYear() === year &&
      today.getMonth() === month &&
      today.getDate() === day
    );
  };

  // Check if a date is in the past
  const isPastDate = (year: number, month: number, day: number): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(year, month, day);
    return checkDate < today;
  };

  // Build calendar grid
  const calendarDays: Array<{
    day: number;
    month: number;
    year: number;
    isCurrentMonth: boolean;
  }> = [];

  // Previous month days
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    calendarDays.push({
      day: prevMonthLastDay - i,
      month: currentMonth - 1,
      year: currentMonth === 0 ? currentYear - 1 : currentYear,
      isCurrentMonth: false,
    });
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push({
      day,
      month: currentMonth,
      year: currentYear,
      isCurrentMonth: true,
    });
  }

  // Next month days to fill remaining grid
  const remainingDays = 42 - calendarDays.length; // 6 rows × 7 days
  for (let day = 1; day <= remainingDays; day++) {
    calendarDays.push({
      day,
      month: currentMonth + 1,
      year: currentMonth === 11 ? currentYear + 1 : currentYear,
      isCurrentMonth: false,
    });
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

  const getStatusColor = (show: Show) => {
    if (show.status === "cancelled") return theme.colors.semantic.error;
    if (show.status === "completed") return theme.colors.dark.text.tertiary;
    return theme.colors.brand.primary;
  };

  return (
    <CalendarContainer>
      <CalendarHeader>
        <MonthNavigation>
          <NavButton onClick={goToPreviousMonth} title="Previous month">
            <i className="bi bi-chevron-left"></i>
          </NavButton>
          <MonthTitle>
            {MONTHS[currentMonth]} {currentYear}
          </MonthTitle>
          <NavButton onClick={goToNextMonth} title="Next month">
            <i className="bi bi-chevron-right"></i>
          </NavButton>
        </MonthNavigation>
        <TodayButton onClick={goToToday}>
          <i className="bi bi-calendar-check"></i>
          Today
        </TodayButton>
      </CalendarHeader>

      <CalendarGrid>
        {/* Day headers */}
        {DAYS_OF_WEEK.map((day) => (
          <DayHeader key={day}>{day}</DayHeader>
        ))}

        {/* Calendar days */}
        {calendarDays.map((dateInfo, index) => {
          const dayShows = getShowsForDate(dateInfo.year, dateInfo.month, dateInfo.day);
          const today = isToday(dateInfo.year, dateInfo.month, dateInfo.day);
          const past = isPastDate(dateInfo.year, dateInfo.month, dateInfo.day);

          return (
            <DayCell
              key={index}
              $isCurrentMonth={dateInfo.isCurrentMonth}
              $isToday={today}
              $isPast={past && dateInfo.isCurrentMonth}
              $hasShows={dayShows.length > 0}
            >
              <DayNumber $isToday={today}>{dateInfo.day}</DayNumber>
              <ShowsContainer>
                {dayShows.slice(0, 3).map((show) => (
                  <ShowPill
                    key={show.id}
                    $statusColor={getStatusColor(show)}
                    $isCancelled={show.status === "cancelled"}
                    onClick={() => navigate(`/shows/${show.id}`)}
                    title={`${show.name}${show.venue ? ` at ${show.venue}` : ""}`}
                  >
                    {show.event_time && (
                      <ShowTime>{formatTime(show.event_time)}</ShowTime>
                    )}
                    <ShowName>{show.name}</ShowName>
                  </ShowPill>
                ))}
                {dayShows.length > 3 && (
                  <MoreShows>+{dayShows.length - 3} more</MoreShows>
                )}
              </ShowsContainer>
            </DayCell>
          );
        })}
      </CalendarGrid>

      {/* Legend */}
      <Legend>
        <LegendItem>
          <LegendDot $color={theme.colors.brand.primary} />
          <span>Upcoming</span>
        </LegendItem>
        <LegendItem>
          <LegendDot $color={theme.colors.dark.text.tertiary} />
          <span>Completed</span>
        </LegendItem>
        <LegendItem>
          <LegendDot $color={theme.colors.semantic.error} />
          <span>Cancelled</span>
        </LegendItem>
      </Legend>
    </CalendarContainer>
  );
};

// Styled Components

const CalendarContainer = styled.div`
  background: ${theme.colors.dark.bg.secondary};
  border: 1px solid ${theme.colors.dark.border.default};
  border-radius: ${theme.radius.lg};
  overflow: hidden;
  margin-top: ${theme.space[4]};
`;

const CalendarHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${theme.space[4]} ${theme.space[5]};
  background: ${theme.colors.dark.bg.tertiary};
  border-bottom: 1px solid ${theme.colors.dark.border.default};
`;

const MonthNavigation = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]};
`;

const NavButton = styled.button`
  background: transparent;
  border: 1px solid ${theme.colors.dark.border.default};
  color: ${theme.colors.dark.text.primary};
  width: 36px;
  height: 36px;
  border-radius: ${theme.radius.base};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;

  &:hover {
    background: ${theme.colors.dark.bg.elevated};
    border-color: ${theme.colors.brand.primary};
    color: ${theme.colors.brand.primary};
  }
`;

const MonthTitle = styled.h2`
  font-size: ${theme.fontSizes.h3};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.dark.text.primary};
  margin: 0;
  min-width: 200px;
  text-align: center;
`;

const TodayButton = styled.button`
  background: transparent;
  border: 1px solid ${theme.colors.dark.border.default};
  color: ${theme.colors.dark.text.secondary};
  padding: ${theme.space[2]} ${theme.space[4]};
  border-radius: ${theme.radius.base};
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.medium};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};

  &:hover {
    background: ${theme.colors.dark.bg.elevated};
    border-color: ${theme.colors.brand.primary};
    color: ${theme.colors.brand.primary};
  }
`;

const CalendarGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
`;

const DayHeader = styled.div`
  padding: ${theme.space[3]};
  text-align: center;
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${theme.fontWeights.semibold};
  color: ${theme.colors.dark.text.secondary};
  background: ${theme.colors.dark.bg.tertiary};
  border-bottom: 1px solid ${theme.colors.dark.border.default};
  text-transform: uppercase;
  letter-spacing: ${theme.letterSpacing.wide};
`;

const DayCell = styled.div<{
  $isCurrentMonth: boolean;
  $isToday: boolean;
  $isPast: boolean;
  $hasShows: boolean;
}>`
  min-height: 100px;
  padding: ${theme.space[2]};
  background: ${(props) =>
    props.$isToday
      ? `${theme.colors.brand.primary}10`
      : props.$isCurrentMonth
      ? theme.colors.dark.bg.secondary
      : theme.colors.dark.bg.primary};
  border-bottom: 1px solid ${theme.colors.dark.border.default};
  border-right: 1px solid ${theme.colors.dark.border.default};
  opacity: ${(props) => (props.$isCurrentMonth ? 1 : 0.5)};
  transition: background ${theme.transitions.fast} ease;

  &:nth-child(7n) {
    border-right: none;
  }

  &:hover {
    background: ${(props) =>
      props.$isToday
        ? `${theme.colors.brand.primary}15`
        : theme.colors.dark.bg.elevated};
  }

  @media (max-width: ${theme.breakpoints.md}) {
    min-height: 80px;
    padding: ${theme.space[1]};
  }
`;

const DayNumber = styled.div<{ $isToday: boolean }>`
  font-size: ${theme.fontSizes.bodySm};
  font-weight: ${(props) =>
    props.$isToday ? theme.fontWeights.bold : theme.fontWeights.medium};
  color: ${(props) =>
    props.$isToday ? theme.colors.brand.primary : theme.colors.dark.text.primary};
  margin-bottom: ${theme.space[1]};
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${theme.radius.full};
  background: ${(props) =>
    props.$isToday ? theme.colors.brand.primary : "transparent"};
  color: ${(props) =>
    props.$isToday ? "white" : theme.colors.dark.text.primary};
`;

const ShowsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.space[1]};
`;

const ShowPill = styled.div<{ $statusColor: string; $isCancelled: boolean }>`
  background: ${(props) => props.$statusColor}20;
  border-left: 3px solid ${(props) => props.$statusColor};
  padding: ${theme.space[1]} ${theme.space[2]};
  border-radius: ${theme.radius.sm};
  cursor: pointer;
  transition: all ${theme.transitions.fast} ease;
  overflow: hidden;

  &:hover {
    background: ${(props) => props.$statusColor}30;
    transform: translateX(2px);
  }

  ${(props) =>
    props.$isCancelled &&
    `
    text-decoration: line-through;
    opacity: 0.7;
  `}

  @media (max-width: ${theme.breakpoints.md}) {
    padding: ${theme.space[1]};
  }
`;

const ShowTime = styled.span`
  font-size: ${theme.fontSizes.bodyXs};
  color: ${theme.colors.dark.text.tertiary};
  display: block;

  @media (max-width: ${theme.breakpoints.md}) {
    display: none;
  }
`;

const ShowName = styled.span`
  font-size: ${theme.fontSizes.bodyXs};
  font-weight: ${theme.fontWeights.medium};
  color: ${theme.colors.dark.text.primary};
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const MoreShows = styled.div`
  font-size: ${theme.fontSizes.bodyXs};
  color: ${theme.colors.dark.text.tertiary};
  padding: ${theme.space[1]} ${theme.space[2]};
  text-align: center;
`;

const Legend = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${theme.space[6]};
  padding: ${theme.space[4]};
  background: ${theme.colors.dark.bg.tertiary};
  border-top: 1px solid ${theme.colors.dark.border.default};
`;

const LegendItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]};
  font-size: ${theme.fontSizes.bodyXs};
  color: ${theme.colors.dark.text.secondary};
`;

const LegendDot = styled.div<{ $color: string }>`
  width: 10px;
  height: 10px;
  border-radius: ${theme.radius.full};
  background: ${(props) => props.$color};
`;
