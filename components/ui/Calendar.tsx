import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Ban, Zap } from 'lucide-react';

interface CalendarProps {
  selected?: Date;
  onSelect?: (date: Date) => void;
  className?: string;
  shutdownRange?: { start: string; end: string };
  peakDays?: string[];
}

export const Calendar: React.FC<CalendarProps> = ({ 
  selected, 
  onSelect, 
  className = '',
  shutdownRange,
  peakDays = []
}) => {
  const [viewDate, setViewDate] = useState(selected || new Date());

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const startDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay(); // 0 = Sunday

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

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
    const check = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const start = new Date(shutdownRange.start).setHours(0, 0, 0, 0);
    const end = new Date(shutdownRange.end).setHours(0, 0, 0, 0);
    return check >= start && check <= end;
  };

  const isPeakDay = (date: Date) => {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return peakDays.includes(dateStr);
  };

  const handleDateClick = (e: React.MouseEvent, day: number) => {
    e.stopPropagation();
    const newDate = new Date(year, month, day);
    
    // Prevent selection if shutdown day
    if (isShutdownDay(newDate)) return;

    if (onSelect) {
      onSelect(newDate);
    }
  };

  // Mock lunar calculation
  const getLunarDay = (day: number) => {
    const lunar = day > 15 ? day - 15 : day + 15;
    return lunar; 
  };

  const renderDays = () => {
    const totalDays = daysInMonth(year, month);
    const startDay = startDayOfMonth(year, month); 
    
    const days = [];
    for (let i = 0; i < startDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-10 w-10" />);
    }

    for (let day = 1; day <= totalDays; day++) {
      const currentDate = new Date(year, month, day);
      const isSelected = selected && 
        currentDate.getDate() === selected.getDate() && 
        currentDate.getMonth() === selected.getMonth() && 
        currentDate.getFullYear() === selected.getFullYear();
      
      const isToday = new Date().toDateString() === currentDate.toDateString();
      const lunarDay = getLunarDay(day);
      
      const isShutdown = isShutdownDay(currentDate);
      const isPeak = isPeakDay(currentDate);

      // Styles
      let bgClass = "hover:bg-slate-100 text-slate-900";
      let borderClass = "border-transparent";
      let textClass = "";
      
      if (isShutdown) {
        bgClass = "bg-slate-100 text-slate-300 cursor-not-allowed decoration-slate-300";
        borderClass = "border-transparent";
      } else if (isSelected) {
        bgClass = "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm";
      } else if (isPeak) {
        bgClass = "bg-red-50 hover:bg-red-100 text-red-700 font-bold";
        borderClass = "border-red-200";
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
            relative h-10 w-10 p-1 rounded-md flex flex-col items-center justify-center transition-all border
            ${bgClass}
            ${borderClass}
            ${textClass}
          `}
        >
          <span className={`text-sm leading-none z-10 ${isSelected ? 'font-bold' : ''}`}>{day}</span>
          <span className={`text-[0.6rem] leading-none mt-0.5 z-10 ${isSelected ? 'text-primary-foreground/80' : isShutdown ? 'text-slate-300' : 'text-slate-400'}`}>
            {lunarDay}
          </span>
          
          {/* Indicators */}
          {isShutdown && (
             <div className="absolute inset-0 flex items-center justify-center opacity-20">
               <Ban size={24} className="text-slate-500" />
             </div>
          )}
          {isPeak && !isShutdown && !isSelected && (
             <div className="absolute top-0.5 right-0.5">
               <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
             </div>
          )}
        </button>
      );
    }
    return days;
  };

  return (
    <div className={`p-4 bg-white rounded-lg border border-slate-200 shadow-xl w-auto min-w-[320px] ${className}`} onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-4 px-1">
        <button onClick={handlePrevMonth} className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 hover:text-slate-900 transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-sm font-bold text-slate-900 capitalize">
          Tháng {month + 1}, {year}
        </div>
        <button onClick={handleNextMonth} className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 hover:text-slate-900 transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map(day => (
          <div key={day} className="text-[0.75rem] font-medium text-center text-slate-500 py-1">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center justify-items-center">
        {renderDays()}
      </div>
      
      {/* Legend */}
      <div className="mt-3 pt-3 border-t border-slate-100 flex justify-center gap-4 text-[10px] text-slate-500">
         <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-slate-200"></div> Nghỉ Tết
         </div>
         <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-red-100 border border-red-200"></div> Cao điểm
         </div>
         <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-primary"></div> Đang chọn
         </div>
      </div>
    </div>
  );
};