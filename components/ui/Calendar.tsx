
import React, { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Ban } from "lucide-react";
import { getLunarDate, isSameDay } from "../../utils/dateUtils";

interface DateRange {
  from: Date | undefined;
  to?: Date | undefined;
}

interface CalendarProps {
  selected?: Date | DateRange;
  onSelect?: (date: any) => void;
  mode?: "single" | "range";
  className?: string;
  shutdownRange?: { start: string; end: string };
  peakDays?: string[];
  highlightDays?: string[]; // Thêm prop này: mảng các chuỗi "YYYY-MM-DD"
}

export const Calendar: React.FC<CalendarProps> = ({
  selected,
  onSelect,
  mode = "single",
  className = "",
  shutdownRange,
  peakDays = [],
  highlightDays = [],
}) => {
  const initialViewDate = mode === "range" 
    ? (selected as DateRange)?.from || new Date() 
    : (selected as Date) || new Date();
    
  const [viewDate, setViewDate] = useState(initialViewDate);

  const daysInMonth = (year: number, month: number) =>
    new Date(year, month + 1, 0).getDate();
  const startDayOfMonth = (year: number, month: number) =>
    new Date(year, month, 1).getDay(); // 0 = Sunday

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const lunarRangeInfo = useMemo(() => {
    const start = new Date(year, month, 1);
    const end = new Date(year, month, daysInMonth(year, month));
    const startLunar = getLunarDate(start);
    const endLunar = getLunarDate(end);

    if (
      startLunar.month === endLunar.month &&
      startLunar.year === endLunar.year
    ) {
      return `Tháng ${startLunar.month} ÂL`;
    }

    let text = `Âm Lịch: ${startLunar.month}/${startLunar.year}`;
    if (startLunar.year !== endLunar.year) {
      text += ` - ${endLunar.month}/${endLunar.year}`;
    } else {
      text += ` - ${endLunar.month}`;
    }
    return text;
  }, [year, month]);

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate(new Date(year, month + 1, 1));
  };

  const isShutdownDay = (date: Date) => {
    if (!shutdownRange?.start || !shutdownRange?.end) return false;
    const check = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    ).getTime();
    const start = new Date(shutdownRange.start).setHours(0, 0, 0, 0);
    const end = new Date(shutdownRange.end).setHours(0, 0, 0, 0);
    return check >= start && check <= end;
  };

  const isPeakDay = (date: Date) => {
    const dateStr = `${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return peakDays.includes(dateStr);
  };

  const isHighlighted = (date: Date) => {
    const dateStr = `${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return highlightDays.includes(dateStr);
  };

  const handleDateClick = (e: React.MouseEvent, day: number) => {
    e.stopPropagation();
    const newDate = new Date(year, month, day);

    if (isShutdownDay(newDate)) return;

    if (onSelect) {
      if (mode === "range") {
        const range = (selected as DateRange) || { from: undefined, to: undefined };
        if (!range.from || (range.from && range.to)) {
          onSelect({ from: newDate, to: undefined });
        } else {
          if (newDate < range.from) {
            onSelect({ from: newDate, to: range.from });
          } else {
            onSelect({ from: range.from, to: newDate });
          }
        }
      } else {
        onSelect(newDate);
      }
    }
  };

  const renderDays = () => {
    const totalDays = daysInMonth(year, month);
    const startDay = startDayOfMonth(year, month);
    const days = [];

    for (let i = 0; i < startDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-11 w-11" />);
    }

    for (let day = 1; day <= totalDays; day++) {
      const currentDate = new Date(year, month, day);
      const isToday = new Date().toDateString() === currentDate.toDateString();

      let isSelected = false;
      let isStart = false;
      let isEnd = false;
      let isInRange = false;

      const range = mode === "range" ? (selected as DateRange) : undefined;

      if (mode === "range" && range) {
        if (range.from && isSameDay(currentDate, range.from)) {
          isSelected = true;
          isStart = true;
        }
        if (range.to && isSameDay(currentDate, range.to)) {
          isSelected = true;
          isEnd = true;
        }
        if (range.from && range.to) {
          isInRange = currentDate > range.from && currentDate < range.to;
        }
      } else {
        isSelected = selected instanceof Date && isSameDay(currentDate, selected);
      }

      const { day: lunarDay, month: lunarMonth } = getLunarDate(currentDate);
      const showMonth = lunarDay === 1 || lunarDay === 15 || isSelected;
      const lunarText = showMonth ? `${lunarDay}/${lunarMonth}` : lunarDay.toString();
      const isShutdown = isShutdownDay(currentDate);
      const isPeak = isPeakDay(currentDate);
      const hasData = isHighlighted(currentDate);

      let bgClass = "hover:bg-slate-100 text-slate-900";
      let borderClass = "border-transparent";
      let textClass = "";

      if (isShutdown) {
        bgClass = "bg-slate-50 text-slate-400 cursor-not-allowed";
      } else if (isSelected) {
        bgClass = "bg-primary text-primary-foreground shadow-sm z-10";
      } else if (isInRange) {
        bgClass = "bg-primary/10 text-primary hover:bg-primary/20 rounded-none";
      } else if (isPeak) {
        bgClass = "bg-orange-50 hover:bg-orange-100 text-orange-700 font-bold";
        borderClass = "border-orange-200";
      } else if (isToday) {
        textClass = "text-primary font-semibold";
        bgClass = "bg-primary/5";
        borderClass = "border-primary/20";
      }

      days.push(
        <button
          key={day}
          onClick={(e) => handleDateClick(e, day)}
          disabled={isShutdown}
          className={`
            relative h-11 w-11 p-1 flex flex-col items-center justify-center transition-all border
            ${bgClass}
            ${borderClass}
            ${textClass}
            ${mode === "range" && !isInRange ? "rounded-md" : (mode === "single" ? "rounded-md" : "")}
            ${isStart && range?.to ? "rounded-r-none rounded-l-md" : ""}
            ${isEnd ? "rounded-l-none rounded-r-md" : ""}
          `}
        >
          <span className={`text-sm leading-none z-10 ${isSelected ? "font-bold" : ""}`}>
            {day}
          </span>
          <span
            className={`text-[0.6rem] leading-tight mt-0.5 z-10 whitespace-nowrap 
            ${isSelected ? "text-primary-foreground/80" : isShutdown ? "text-red-500 font-bold" : showMonth ? "text-slate-500 font-medium" : "text-slate-400"}`}
          >
            {isShutdown ? "Nghỉ Tết" : lunarText}
          </span>
          
          {/* Chấm đỏ báo hiệu có dữ liệu */}
          {hasData && !isShutdown && (
            <div className={`absolute bottom-1 w-1 h-1 rounded-full ${isSelected ? "bg-white" : "bg-red-500 shadow-[0_0_2px_rgba(239,68,68,0.5)]"}`}></div>
          )}

          {isShutdown && (
            <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
              <Ban size={28} className="text-red-500" />
            </div>
          )}
          {isPeak && !isShutdown && !isSelected && !isInRange && (
            <div className="absolute top-1 right-1">
              <div className="w-1.5 h-1.5 bg-orange-500 rounded-full shadow-sm"></div>
            </div>
          )}
        </button>
      );
    }
    return days;
  };

  return (
    <div
      className={`p-4 bg-white rounded-lg border border-slate-200 shadow-xl w-auto min-w-[340px] ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-4 px-1">
        <button
          title="Tháng trước"
          onClick={handlePrevMonth}
          className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex flex-col items-center">
          <div className="text-sm font-bold text-slate-900 capitalize">
            Tháng {month + 1}, {year}
          </div>
          <div className="text-[10px] text-slate-500 font-medium bg-slate-50 px-2 py-0.5 rounded-full mt-0.5">
            {lunarRangeInfo}
          </div>
        </div>
        <button
          title="Tháng sau"
          onClick={handleNextMonth}
          className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {["CN", "T2", "T3", "T4", "T5", "T6", "T7"].map((day) => (
          <div key={day} className="text-[0.75rem] font-medium text-center text-slate-500 py-1">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center justify-items-center">
        {renderDays()}
      </div>
      <div className="mt-3 pt-3 border-t border-slate-100 flex justify-center gap-4 text-[10px] text-slate-500">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500"></div> Có giao dịch
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-primary"></div> Chọn
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-orange-100 border border-orange-200"></div> Cao điểm
        </div>
      </div>
    </div>
  );
};
