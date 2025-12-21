
import React, { useState, useEffect, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  Settings,
  Ticket,
  Menu,
  MapPin,
  Check,
  ChevronDown,
  BusFront,
  Zap,
  Bus,
  BadgeDollarSign,
  ArrowLeftRight
} from "lucide-react";
import { Button } from "./ui/Button";
import { Popover } from "./ui/Popover";
import { Calendar } from "./ui/Calendar";
import { formatLunarDate, daysOfWeek } from "../utils/dateUtils";
import { BusTrip, BusType, Route } from "../types";
import { api } from "../lib/api";

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  // Header Props
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  // New Trip Selector Props
  availableTrips: BusTrip[];
  selectedTripId: string | null;
  onTripChange: (tripId: string) => void;
  // Direction Props
  selectedDirection?: "outbound" | "inbound";
  onDirectionChange?: (dir: "outbound" | "inbound") => void;
  // Data Props
  routes: Route[];
  // Slot for right-aligned header content
  headerRight?: React.ReactNode;
  // NEW: Slot for extra filters in the center
  subHeaderContent?: React.ReactNode;
}

interface ScheduleSettings {
  shutdownStartDate: string;
  shutdownEndDate: string;
  peakDays: string[];
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  activeTab,
  onTabChange,
  selectedDate,
  onDateChange,
  availableTrips,
  selectedTripId,
  onTripChange,
  selectedDirection = "outbound",
  onDirectionChange,
  routes = [],
  headerRight,
  subHeaderContent,
}) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [scheduleSettings, setScheduleSettings] = useState<ScheduleSettings>({
    shutdownStartDate: "",
    shutdownEndDate: "",
    peakDays: [],
  });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await api.settings.get('schedule_settings');
        if (data) setScheduleSettings(data);
      } catch (e) {
        console.error("Failed to load schedule settings", e);
      }
    };
    loadSettings();
  }, [activeTab]);

  const navItems = [
    { id: "sales", icon: <Bus size={20} />, label: "Bán vé" },
    { id: "tickets", icon: <Ticket size={20} />, label: "Danh sách vé" },
    { id: "transfer", icon: <ArrowLeftRight size={20} />, label: "Đổi chuyến" },
    { id: "schedule", icon: <CalendarIcon size={20} />, label: "Lịch trình" },
    { id: "finance", icon: <BadgeDollarSign size={20} />, label: "Tài chính" },
  ];

  const pageInfo: Record<string, { title: string; description: string }> = {
    sales: { title: "Bán vé", description: "Quản lý bán vé trực quan" },
    tickets: { title: "Danh sách vé", description: "Tra cứu lịch sử đặt vé" },
    transfer: { title: "Đổi chuyến / Xe thường", description: "Chuyển khách giữa các xe" },
    schedule: { title: "Lịch trình", description: "Tổng quan lịch chạy xe" },
    finance: { title: "Tài chính", description: "Quản lý doanh thu" },
    settings: { title: "Cài đặt", description: "Cấu hình hệ thống" },
  };

  const currentInfo = pageInfo[activeTab] || { title: "VinaBus", description: "" };

  const formatSolarHeader = (date: Date) => {
    const dayName = daysOfWeek[date.getDay()];
    const d = String(date.getDate()).padStart(2, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const y = date.getFullYear();
    return `${dayName}, ${d}/${m}/${y}`;
  };

  const tripOptions = useMemo(() => {
    const tripsWithMeta = availableTrips.map((trip) => {
      let isEnhanced = trip.name?.toLowerCase().includes("tăng cường") || trip.route?.toLowerCase().includes("tăng cường");
      return { ...trip, isEnhanced, displayTime: trip.departureTime.split(" ")[1] };
    });
    return tripsWithMeta.sort((a, b) => a.departureTime.localeCompare(b.departureTime));
  }, [availableTrips]);

  const selectedTripDisplay = tripOptions.find((t) => t.id === selectedTripId);

  const DirectionToggle = () => {
    if (!onDirectionChange) return null;
    return (
      <label className="flex items-center gap-2 cursor-pointer select-none bg-white border border-slate-200 rounded-md px-2 md:px-3 h-9 hover:border-slate-300 transition-colors">
        <div className={`relative flex items-center justify-center w-4 h-4 border rounded bg-white transition-colors ${selectedDirection === "outbound" ? "border-primary" : "border-slate-300"}`}>
          <input type="checkbox" className="peer appearance-none absolute inset-0 w-full h-full cursor-pointer" checked={selectedDirection === "outbound"} onChange={(e) => onDirectionChange(e.target.checked ? "outbound" : "inbound")} />
          {selectedDirection === "outbound" && <Check size={12} className="text-primary pointer-events-none" strokeWidth={3} />}
        </div>
        <span className={`text-xs md:text-sm font-medium whitespace-nowrap ${selectedDirection === "outbound" ? "text-primary" : "text-slate-600"}`}>
          {selectedDirection === "outbound" ? "Chiều đi" : "Chiều về"}
        </span>
      </label>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden">
      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-10 md:hidden animate-in fade-in duration-200" onClick={() => setSidebarOpen(false)} />}
      <aside className={`bg-white border-r border-slate-200 flex-col fixed h-full z-20 transition-all duration-300 ${isSidebarOpen ? "w-64 translate-x-0" : "w-64 -translate-x-full md:translate-x-0 md:w-0 md:opacity-0 md:overflow-hidden"}`}>
        <div className="p-6 flex items-center gap-3 border-b border-slate-100 h-16">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold shrink-0">V</div>
          <span className="font-bold text-xl tracking-tight text-slate-900 truncate">VinaBus</span>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button key={item.id} onClick={() => { onTabChange(item.id); if (window.innerWidth < 768) setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeTab === item.id ? "bg-primary/10 text-primary" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}>{item.icon}{item.label}</button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-100">
          <button onClick={() => { onTabChange("settings"); if (window.innerWidth < 768) setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeTab === "settings" ? "bg-primary/10 text-primary" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}><Settings size={20} /><span>Cài đặt</span></button>
        </div>
      </aside>

      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${isSidebarOpen ? "md:ml-64" : "ml-0"}`}>
        <header className="h-auto md:h-16 bg-white border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between sticky top-0 z-30 shadow-sm">
          <div className="flex items-center justify-between h-16 px-4 md:px-8 w-full md:w-auto md:flex-1 min-w-0">
            <div className="flex items-center gap-4 min-w-0">
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!isSidebarOpen)} className="text-slate-500 hover:text-slate-900 shrink-0"><Menu size={20} /></Button>
              <h1 className="text-sm md:text-base font-bold text-slate-900 truncate">{currentInfo.title}</h1>
            </div>
            <div className="md:hidden flex-1 flex justify-center px-1">{(activeTab === 'sales' || activeTab === 'transfer') && <DirectionToggle />}</div>
            <div className="md:hidden">{headerRight}</div>
          </div>

          <div className={`flex items-center gap-2 px-4 pb-3 md:pb-0 md:px-4 overflow-x-auto no-scrollbar justify-center md:justify-start ${(activeTab === 'sales' || activeTab === 'transfer') ? 'flex' : 'hidden md:flex'}`}>
            <div className="flex items-center gap-2 md:gap-3 shrink-0">
              <div className="hidden md:block"><DirectionToggle /></div>
              <Popover align="left" trigger={
                <div className="flex items-center gap-2 h-9 px-3 border border-slate-200 rounded-md bg-white hover:bg-slate-50 transition-colors select-none cursor-pointer">
                  <CalendarIcon size={16} className="text-slate-500" />
                  <span className="text-xs md:text-sm font-medium text-slate-700 whitespace-nowrap">{formatSolarHeader(selectedDate)}</span>
                </div>
              } content={(close) => <Calendar selected={selectedDate} onSelect={(date) => { onDateChange(date); close(); }} shutdownRange={{ start: scheduleSettings.shutdownStartDate, end: scheduleSettings.shutdownEndDate }} peakDays={scheduleSettings.peakDays} />} />

              {/* Dynamic Sub-header content for different tabs */}
              {subHeaderContent}

              {activeTab === 'sales' && (
                <Popover align="right" trigger={
                  <div className="flex items-center justify-between gap-3 h-9 px-3 border border-slate-200 rounded-md bg-white hover:bg-slate-50 transition-colors cursor-pointer min-w-[140px] md:min-w-[200px]">
                    <div className="flex items-center gap-2 truncate">
                      <MapPin size={16} className="text-slate-500 shrink-0" />
                      <span className="text-xs md:text-sm font-medium text-slate-900 truncate">{selectedTripDisplay ? `${selectedTripDisplay.displayTime} - ${selectedTripDisplay.route}` : "Chọn chuyến..."}</span>
                    </div>
                    <ChevronDown size={14} className="text-slate-400 shrink-0" />
                  </div>
                } content={(close) => (
                  <div className="w-[300px] md:w-[360px] max-h-[400px] overflow-y-auto bg-white rounded-lg border border-slate-200 shadow-xl p-1.5">
                    {tripOptions.map((trip) => (
                      <button key={trip.id} onClick={() => { onTripChange(trip.id); close(); }} className={`w-full text-left p-2.5 rounded-md flex items-center gap-3 ${trip.id === selectedTripId ? "bg-primary/5 border border-primary/20" : "hover:bg-slate-50"}`}>
                        <div className="w-12 h-10 rounded border bg-slate-50 flex items-center justify-center text-xs font-bold shrink-0">{trip.displayTime}</div>
                        <div className="flex-1 truncate"><div className="text-sm font-medium text-slate-900 truncate">{trip.route}</div><div className="text-[10px] text-slate-500">{trip.licensePlate}</div></div>
                        {trip.id === selectedTripId && <Check size={16} className="text-primary ml-auto" />}
                      </button>
                    ))}
                  </div>
                )} />
              )}
            </div>
          </div>
          <div className="hidden md:flex items-center gap-3 pr-8 shrink-0">{headerRight}</div>
        </header>
        <main className="flex-1 p-4 md:p-8 overflow-y-auto bg-slate-50/50">
          <div className="mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
};
