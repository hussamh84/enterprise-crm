import { useMemo, useState } from "react";

const WEEK_DAYS = ["S", "M", "T", "W", "T", "F", "S"];

const atStartOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

const isSameDay = (left, right) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

export default function SidebarCalendar() {
  const today = useMemo(() => new Date(), []);
  const [currentMonth, setCurrentMonth] = useState(atStartOfMonth(today));
  const [selectedDate, setSelectedDate] = useState(today);

  const monthLabel = useMemo(
    () =>
      currentMonth.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      }),
    [currentMonth]
  );

  const days = useMemo(() => {
    const monthStart = atStartOfMonth(currentMonth);
    const monthStartWeekDay = monthStart.getDay();
    const gridStart = new Date(monthStart);
    gridStart.setDate(monthStart.getDate() - monthStartWeekDay);

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
      const isToday = isSameDay(date, today);
      const isSelected = isSameDay(date, selectedDate);
      const hasEvent = isCurrentMonth && date.getDate() % 6 === 0;

      return {
        key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
        date,
        label: date.getDate(),
        isMuted: !isCurrentMonth,
        isToday,
        isSelected,
        hasEvent,
      };
    });
  }, [currentMonth, selectedDate, today]);

  return (
    <div className="bg-white rounded-xl p-3 shadow-sm dark:bg-gray-800/80">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          className="h-7 w-7 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
          onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
          aria-label="Previous month"
        >
          {"<"}
        </button>
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{monthLabel}</span>
        <button
          type="button"
          className="h-7 w-7 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
          onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
          aria-label="Next month"
        >
          {">"}
        </button>
      </div>

      <div className="grid grid-cols-7 text-xs text-gray-400 mb-1 text-center">
        {WEEK_DAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 text-sm">
        {days.map((day) => (
          <button
            key={day.key}
            type="button"
            onClick={() => setSelectedDate(day.date)}
            className={`h-8 w-8 mx-auto flex items-center justify-center rounded-full relative transition
              ${day.isSelected ? "bg-gray-900 text-white" : ""}
              ${!day.isSelected && day.isMuted ? "text-gray-300" : ""}
              ${!day.isSelected && !day.isMuted ? "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700" : ""}
            `}
            aria-label={`Select ${day.date.toDateString()}`}
          >
            {day.label}
            {day.hasEvent && !day.isSelected ? (
              <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-gray-400" />
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
