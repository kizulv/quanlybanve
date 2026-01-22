import React, { useState, useEffect } from "react";
import { getLunarDate, isSameDay, daysOfWeek } from "../../utils/dateUtils";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const CalenderHoliday: React.FC = () => {
  const [now, setNow] = useState(new Date());
  const [viewDate, setViewDate] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const startDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

  const handlePrevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setViewDate(new Date(year, month + 1, 1));
  const handleToday = () => setViewDate(new Date());

  const renderDays = () => {
    const totalDays = daysInMonth(year, month);
    const startDay = startDayOfMonth(year, month);
    const days = [];

    // Empty cells for previous month
    for (let i = 0; i < startDay; i++) {
      const prevMonthDate = new Date(year, month, 0 - (startDay - 1 - i));
      const { day: lunarDay, month: lunarMonth } = getLunarDate(prevMonthDate);
      days.push(
        <div
          key={`prev-${i}`}
          className="h-full bg-red-950/20 p-1 flex flex-col items-end opacity-40 border border-transparent min-h-0"
        >
          <span className="text-lg text-amber-100/50 font-serif">
            {prevMonthDate.getDate()}
          </span>
          <span className="text-[10px] text-amber-100/40">
            {lunarDay}/{lunarMonth}
          </span>
        </div>,
      );
    }

    // Days of current month
    for (let day = 1; day <= totalDays; day++) {
      const currentDate = new Date(year, month, day);
      const isToday = isSameDay(currentDate, now);
      const { day: lunarDay, month: lunarMonth } = getLunarDate(currentDate);

      const isLunarHoliday = lunarDay === 1 || lunarDay === 15;
      const isTet = lunarMonth === 1 && lunarDay >= 1 && lunarDay <= 3;

      let bgClass = "bg-red-800/80 border-red-700/50";
      let textClass = "text-amber-100";
      let lunarClass = "text-amber-200/60";

      if (isToday) {
        bgClass =
          "bg-amber-100 shadow-lg shadow-amber-900/50 transform scale-105 z-10 border-amber-200";
        textClass = "text-red-900";
        lunarClass = "text-red-800/70";
      } else if (isTet) {
        bgClass = "bg-red-700 border-amber-500/50";
        textClass = "text-amber-300";
        lunarClass = "text-amber-200";
      } else if (currentDate.getDay() === 0) {
        bgClass = "bg-red-900/40 border-red-800/30";
      }

      days.push(
        <div
          key={day}
          className={`h-full p-2 border rounded-lg flex flex-col justify-between transition-all duration-300 backdrop-blur-sm min-h-0 ${bgClass}`}
        >
          <div className="flex justify-between items-start">
            <span
              className={`text-xl lg:text-2xl font-black font-serif ${textClass}`}
            >
              {day}
            </span>
          </div>

          <div className="flex flex-col items-end">
            <span className={`text-xs font-medium font-serif ${lunarClass}`}>
              {lunarDay}/{lunarMonth}
            </span>
            {isTet && (
              <span className="text-[9px] uppercase font-bold text-amber-400 tracking-wider mt-1">
                Tết
              </span>
            )}
          </div>

          {isToday && (
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping" />
          )}
        </div>,
      );
    }

    // Fill remaining cells
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const nextMonthDate = new Date(year, month + 1, i);
      const { day: lunarDay, month: lunarMonth } = getLunarDate(nextMonthDate);
      days.push(
        <div
          key={`next-${i}`}
          className="h-full bg-red-950/20 p-1 flex flex-col items-end opacity-40 border border-transparent min-h-0"
        >
          <span className="text-lg text-amber-100/50 font-serif">{i}</span>
          <span className="text-[10px] text-amber-100/40">
            {lunarDay}/{lunarMonth}
          </span>
        </div>,
      );
    }

    return days;
  };

  const currentLunar = getLunarDate(now);

  return (
    <div className="flex flex-col lg:flex-row h-screen w-full bg-[#1a0505] text-amber-100 overflow-hidden relative">
      {/* Background Decorative Elements */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none overflow-hidden">
        {/* Radial gradient center */}
        <div className="absolute top-1/4 left-1/2 lg:top-1/2 lg:left-1/4 w-200 h-200 bg-red-600 rounded-full blur-[150px] -translate-y-1/2 -translate-x-1/2"></div>
        {/* Subtle pattern overlay could go here via CSS url() if we had an asset, using radial gradients instead */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(#d97706 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            opacity: 0.1,
          }}
        ></div>
      </div>

      {/* LEFT COLUMN: Large Today Card (TEAR-OFF STYLE) - 30% Width */}
      <div className="z-10 w-full lg:w-[35%] h-[35%] lg:h-full p-4 lg:p-8 flex flex-col justify-center items-center border-b lg:border-b-0 lg:border-r border-red-900/50 bg-linear-to-br from-red-950 to-[#2a0a0a] relative shadow-2xl">
        {/* Hanger decoration */}
        <div className="absolute top-0 w-full h-4 bg-[#1a0505]"></div>
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-32 h-8 bg-amber-600 rounded-full shadow-lg z-20 flex items-center justify-center border-2 border-amber-400">
          <div className="w-20 h-1 bg-amber-900 rounded-full opacity-50"></div>
        </div>

        {/* Calendar Block */}
        <div className="w-full max-w-xs lg:max-w-sm bg-white rounded-b-3xl rounded-t-lg overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] transform lg:hover:rotate-1 transition-transform duration-500 scale-90 lg:scale-100">
          {/* Header Section */}
          <div className="bg-red-600 p-4 text-center border-b-4 border-red-800 relative overflow-hidden">
            <div className="absolute inset-0 flex justify-center items-center opacity-10">
              <span className="text-6xl font-serif">❀</span>
            </div>
            <h2 className="text-2xl font-black uppercase tracking-widest text-amber-100 font-serif relative z-10">
              Tháng {now.getMonth() + 1}
            </h2>
            <p className="text-amber-200 text-sm font-medium uppercase tracking-wider relative z-10">
              {now.getFullYear()}
            </p>
          </div>

          {/* Content Section */}
          <div className="p-4 lg:p-8 flex flex-col items-center bg-white text-slate-900 relative">
            <h3 className="text-2xl lg:text-3xl font-medium text-slate-400 uppercase tracking-widest mb-2 font-serif">
              {daysOfWeek[now.getDay()]}
            </h3>

            <div className="text-8xl lg:text-[10rem] leading-none font-black text-red-600 font-serif tracking-tighter my-2 lg:my-4 drop-shadow-xl">
              {now.getDate()}
            </div>

            <div className="w-full h-px bg-slate-100 my-4 lg:my-6 flex items-center justify-center">
              <div className="bg-white px-4 text-slate-300 text-xs uppercase tracking-widest">
                Âm lịch
              </div>
            </div>

            <div className="flex flex-col items-center gap-1">
              <div className="text-4xl font-bold text-slate-700 font-serif flex items-baseline gap-2">
                {currentLunar.day}
                <span className="text-lg text-slate-400 font-normal">
                  / {currentLunar.month}
                </span>
              </div>
              <div className="text-sm text-slate-400 font-serif italic">
                Năm {currentLunar.year}
              </div>
            </div>
          </div>

          {/* Tear-off shadow effect at bottom */}
          <div className="h-6 bg-linear-to-b from-slate-50 to-slate-200"></div>
        </div>

        {/* Quotes/Greeting Section */}
        <div className="hidden lg:block mt-12 text-center space-y-2 opacity-80">
          <p className="text-amber-200/80 font-serif italic text-lg">
            "Cung Chúc Tân Xuân"
          </p>
          <p className="text-amber-500 font-black uppercase tracking-[0.3em] text-xs">
            Nhà xe Trung Dũng
          </p>
        </div>

        {/* Clock Widget */}
        <div className="absolute top-4 right-4 lg:top-auto lg:bottom-8 lg:left-0 lg:right-auto lg:w-full flex justify-end lg:justify-center pointer-events-none">
          <div className="flex items-center gap-3 bg-black/20 backdrop-blur-md px-6 py-3 rounded-full border border-white/5 text-amber-100/90 font-mono text-xl shadow-inner">
            <span>{now.getHours().toString().padStart(2, "0")}</span>
            <span className="animate-pulse">:</span>
            <span>{now.getMinutes().toString().padStart(2, "0")}</span>
            <span className="px-px opacity-50">|</span>
            <span className="text-sm opacity-80">
              {now.getSeconds().toString().padStart(2, "0")}
            </span>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Monthly Grid - 65% Width */}
      <div className="flex-1 w-full h-full flex flex-col z-10 p-4 lg:p-8 lg:pl-0 overflow-hidden">
        <div className="h-full bg-red-900/40 backdrop-blur-sm rounded-3xl border border-red-500/20 p-4 lg:p-8 flex flex-col shadow-2xl relative overflow-hidden">
          {/* Header */}
          <div className="flex justify-between items-center mb-4 lg:mb-8 border-b border-red-500/30 pb-2 lg:pb-6 shrink-0">
            <div className="flex flex-col">
              <h2 className="text-3xl font-black text-amber-100 uppercase tracking-tight font-serif">
                Lịch Tháng
              </h2>
              <p className="text-red-300 font-serif italic">
                Danh sách ngày trong tháng
              </p>
            </div>

            <div className="flex items-center gap-4 bg-black/20 p-2 rounded-xl border border-red-500/20">
              <button
                onClick={handlePrevMonth}
                title="Tháng trước"
                className="p-3 hover:bg-amber-500/20 rounded-lg text-amber-200 transition-colors"
              >
                <ChevronLeft size={24} />
              </button>
              <span className="w-40 text-center text-xl font-bold text-amber-100 font-serif uppercase">
                T.{month + 1} - {year}
              </span>
              <button
                onClick={handleNextMonth}
                title="Tháng sau"
                className="p-3 hover:bg-amber-500/20 rounded-lg text-amber-200 transition-colors"
              >
                <ChevronRight size={24} />
              </button>
              <button
                onClick={handleToday}
                className="ml-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-red-950 font-bold rounded-lg transition-colors text-sm uppercase tracking-wider"
              >
                Hôm nay
              </button>
            </div>
          </div>

          {/* Grid Header */}
          <div className="grid grid-cols-7 mb-4 shrink-0">
            {daysOfWeek.map((d, i) => (
              <div
                key={d}
                className={`text-center font-bold uppercase tracking-widest text-xs py-2 ${i === 0 ? "text-red-400" : "text-amber-200/60"}`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Cells */}
          <div className="grid grid-cols-7 grid-rows-6 flex-1 gap-3 overflow-hidden">
            {renderDays()}
          </div>
        </div>
      </div>
    </div>
  );
};
