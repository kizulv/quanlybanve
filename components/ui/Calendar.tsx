import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarProps {
  selected?: Date;
  onSelect?: (date: Date) => void;
  className?: string;
}

export const Calendar: React.FC<CalendarProps> = ({ selected, onSelect, className = '' }) => {
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

  const handleDateClick = (e: React.MouseEvent, day: number) => {
    e.stopPropagation();
    if (onSelect) {
      const newDate = new Date(year, month, day);
      onSelect(newDate);
    }
  };

  // Mock lunar calculation (Simple approximation: solar day +/- 15)
  // In a real app, integrate a proper 'lunar-date-vi' library here.
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

      days.push(
        <button
          key={day}
          onClick={(e) => handleDateClick(e, day)}
          className={`
            h-10 w-10 p-1 rounded-md flex flex-col items-center justify-center transition-all border border-transparent
            ${isSelected 
              ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm' 
              : 'hover:bg-slate-100 text-slate-900'
            }
            ${isToday && !isSelected ? 'text-primary border-primary/20 bg-primary/5 font-semibold' : ''}
          `}
        >
          <span className={`text-sm leading-none ${isSelected ? 'font-bold' : 'font-medium'}`}>{day}</span>
          <span className={`text-[0.6rem] leading-none mt-0.5 ${isSelected ? 'text-primary-foreground/80' : 'text-slate-400'}`}>
            {lunarDay}
          </span>
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
    </div>
  );
};