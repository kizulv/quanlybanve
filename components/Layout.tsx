
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
  ArrowRightLeft
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
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  availableTrips: BusTrip[];
  selectedTripId: string | null;
  onTripChange: (tripId: string) => void;
  selectedDirection?: "outbound" | "inbound";
  onDirectionChange?: (dir: "outbound" | "inbound") => void;
  routes: Route[];
  headerRight?: React.ReactNode;
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
}) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [scheduleSettings, setScheduleSettings] = useState({ shutdownStartDate: "", shutdownEndDate: "", peakDays: [] });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await api.settings.get('schedule_settings');
        if (data) setScheduleSettings(data);
      } catch (e) {}
    };
    loadSettings();
  }, [activeTab]);

  const navItems = [
    { id: "sales", icon: <Bus size={20} />, label: "Bán vé" },
    { id: "sorting", icon: <ArrowRightLeft size={20} />, label: "Sắp xếp ghế" },
    { id: "tickets", icon: <Ticket size={20} />, label: "Danh sách vé" },
    { id: "schedule", icon: <CalendarIcon size={20} />, label: "Lịch trình" },
    { id: "finance", icon: <BadgeDollarSign size={20} />, label: "Tài chính" },
  ];

  const pageInfo: Record<string, { title: string; description: string }> = {
    sales: { title: "Bán vé", description: "Quản lý bán vé và sơ đồ ghế trực quan" },
    sorting: { title: "Điều chuyển & Sắp xếp", description: "Di chuyển khách giữa các chuyến xe trong ngày" },
    tickets: { title: "Danh sách vé", description: "Tra cứu và quản lý lịch sử đặt vé" },
    schedule: { title: "Lịch trình", description: "Xem tổng quan lịch chạy xe" },
    finance: { title: "Tài chính", description: "Quản lý doanh thu và lịch sử thanh toán" },
    settings: { title: "Cài đặt hệ thống", description: "Quản lý tài nguyên và cấu hình vận hành" },
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
    const sortedRouteIds = [...routes].sort((a, b) => (!!a.isEnhanced !== !!b.isEnhanced) ? (a.isEnhanced ? 1 : -1) : 0).map((r) => String(r.id));
    const tripsWithMeta = availableTrips.map((trip) => {
      const routeById = routes.find((r) => String(r.id) === String(trip.routeId));
      return { ...trip, isEnhanced: !!routeById?.isEnhanced, displayTime: trip.departureTime.split(" ")[1], _rank: sortedRouteIds.indexOf(String(trip.routeId)) };
    }).sort((a, b) => a._rank - b._rank || a.departureTime.localeCompare(b.departureTime));

    const counters: Record<string, number> = {};
    return tripsWithMeta.map(trip => {
        if (trip.isEnhanced) counters[trip.route] = (counters[trip.route] || 0) + 1;
        return { ...trip, enhancedIndex: trip.isEnhanced ? counters[trip.route] : 0 };
    });
  }, [availableTrips, routes]);

  const selectedTripDisplay = tripOptions.find((t) => t.id === selectedTripId);

  const DirectionToggle = () => !onDirectionChange ? null : (
    <label className="flex items-center gap-2 cursor-pointer select-none bg-white border border-slate-200 rounded-md px-2 md:px-3 h-9 hover:border-slate-300 transition-colors">
      <div className={`relative flex items-center justify-center w-4 h-4 border rounded bg-white transition-colors ${selectedDirection === "outbound" ? "border-primary" : "border-slate-300"}`}>
        <input type="checkbox" className="peer appearance-none absolute inset-0 w-full h-full cursor-pointer" checked={selectedDirection === "outbound"} onChange={(e) => onDirectionChange(e.target.checked ? "outbound" : "inbound")} />
        {selectedDirection === "outbound" && <Check size={12} className="text-primary pointer-events-none" strokeWidth={3} />}
      </div>
      <span className={`text-xs md:text-sm font-medium whitespace-nowrap ${selectedDirection === "outbound" ? "text-primary" : "text-slate-600"}`}>{selectedDirection === "outbound" ? "Chiều đi" : "Chiều về"}</span>
    </label>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden">
      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-10 md:hidden animate-in fade-in duration-200" onClick={() => setSidebarOpen(false)} />}
      <aside className={`bg-white border-r border-slate-200 flex-col fixed h-full z-20 transition-all duration-300 ${isSidebarOpen ? "w-64 translate-x-0" : "w-64 -translate-x-full md:translate-x-0 md:w-0 md:opacity-0 md:overflow-hidden"}`}>
        <div className="p-6 flex items-center gap-3 border-b border-slate-100 h-16"><div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold shrink-0">V</div><span className="font-bold text-xl tracking-tight text-slate-900 truncate">VinaBus</span></div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">{navItems.map((item) => (<button key={item.id} onClick={() => { onTabChange(item.id); if (window.innerWidth < 768) setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeTab === item.id ? "bg-primary/10 text-primary" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}>{item.icon}{item.label}</button>))}</nav>
        <div className="p-4 border-t border-slate-100"><button onClick={() => { onTabChange("settings"); if (window.innerWidth < 768) setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeTab === "settings" ? "bg-primary/10 text-primary" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}><Settings size={20} /><span>Cài đặt</span></button></div>
      </aside>
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${isSidebarOpen ? "md:ml-64" : "ml-0"}`}>
        <header className="h-auto md:h-16 bg-white border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between sticky top-0 z-30 shadow-sm">
          <div className="flex items-center justify-between h-16 px-4 md:px-8 w-full md:w-auto md:flex-1 min-w-0">
            <div className="flex items-center gap-2 md:gap-4 min-w-0"><Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!isSidebarOpen)} className="text-slate-500 hover:text-slate-900 shrink-0"><Menu size={20} /></Button><div className="flex flex-col justify-center min-w-0"><h1 className="text-sm md:text-base font-bold text-slate-900 truncate">{currentInfo.title}</h1>{currentInfo.description && <p className="text-xs text-slate-500 truncate hidden md:block">{currentInfo.description}</p>}</div></div>
            <div className="md:hidden flex-1 flex justify-center px-1">{(activeTab === 'sales' || activeTab === 'sorting') && <DirectionToggle />}</div>
            <div className="md:hidden">{headerRight}</div>
          </div>
          <div className={`flex items-center gap-2 px-4 pb-3 md:pb-0 md:px-4 overflow-x-auto no-scrollbar justify-center md:justify-start ${(activeTab === 'sales' || activeTab === 'sorting') ? 'flex' : 'hidden md:flex'}`}>
            {(activeTab === "sales" || activeTab === "sorting") && (
              <div className="flex items-center gap-2 md:gap-3 animate-in fade-in slide-in-from-right-4 duration-300 shrink-0">
                <div className="hidden md:block"><DirectionToggle /></div>
                <Popover align="left" trigger={<div className="flex items-center gap-2 h-9 px-2 md:px-3 border border-slate-200 rounded-md bg-white hover:bg-slate-50 hover:border-slate-300 transition-colors select-none cursor-pointer"><CalendarIcon size={16} className="text-slate-500" /><div className="flex items-center gap-2"><span className="text-xs md:text-sm font-medium text-slate-700 capitalize whitespace-nowrap">{formatSolarHeader(selectedDate)}</span><span className="text-[10px] md:text-[11px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 whitespace-nowrap hidden sm:inline-block">{formatLunarDate(selectedDate)}</span></div></div>} content={(close) => <Calendar selected={selectedDate} onSelect={(date) => { onDateChange(date); close(); }} shutdownRange={{ start: scheduleSettings.shutdownStartDate, end: scheduleSettings.shutdownEndDate }} peakDays={scheduleSettings.peakDays} />} />
                {activeTab === 'sales' && (
                  <Popover align="right" trigger={<div className="flex items-center justify-between gap-3 h-9 px-2 md:px-3 border border-slate-200 rounded-md bg-white hover:bg-slate-50 hover:border-slate-300 transition-colors select-none cursor-pointer min-w-[140px] md:min-w-[200px] max-w-[240px] md:max-w-[340px]"><div className="flex items-center gap-2 overflow-hidden"><MapPin size={16} className="text-slate-500 shrink-0" />{selectedTripDisplay ? <div className="flex items-center gap-2 min-w-0"><span className="text-xs md:text-sm font-medium text-slate-900 truncate">{selectedTripDisplay.displayTime} - {selectedTripDisplay.route}</span></div> : <span className="text-xs md:text-sm font-medium text-slate-500 truncate">Chọn chuyến...</span>}</div><ChevronDown size={14} className="text-slate-400 shrink-0" /></div>} content={(close) => <div className="w-[300px] md:w-[360px] max-h-[400px] overflow-y-auto bg-white rounded-lg border border-slate-200 shadow-xl p-1.5">{tripOptions.length === 0 ? <div className="p-8 text-center text-slate-500"><BusFront size={24} className="mx-auto mb-2 opacity-20" /><p className="text-sm">Không có chuyến nào.</p></div> : <div className="space-y-1">{tripOptions.map((trip) => { const isSelected = trip.id === selectedTripId; return (<button key={trip.id} onClick={() => { onTripChange(trip.id); close(); }} className={`w-full text-left p-2.5 rounded-md transition-all flex items-center gap-3 group ${isSelected ? "bg-primary/5 border border-primary/20" : "hover:bg-slate-50 border border-transparent"}`}><div className={`flex flex-col items-center justify-center w-12 h-10 rounded border text-xs font-bold shrink-0 ${isSelected ? "bg-white border-primary/30 text-primary" : "bg-slate-50 border-slate-200 text-slate-600"}`}>{trip.displayTime}</div><div className="flex-1 min-w-0"><div className={`text-sm font-medium flex items-center gap-1.5 ${isSelected ? "text-primary" : "text-slate-900"}`}><span className="truncate">{trip.route}</span>{trip.isEnhanced && <span className="shrink-0 inline-flex items-center text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200 shadow-sm ml-auto md:ml-0"><Zap size={9} className="mr-0.5 fill-amber-700" />TC {trip.enhancedIndex > 0 ? `#${trip.enhancedIndex}` : ""}</span>}</div><div className="flex items-center gap-2 mt-0.5"><span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 rounded border border-slate-200/50">{trip.licensePlate}</span></div></div>{isSelected && <Check size={16} className="text-primary ml-auto" />}</button>); })}</div>}</div>} />
                )}
              </div>
            )}
          </div>
          <div className="hidden md:flex items-center gap-3 pr-8 shrink-0">{headerRight}</div>
        </header>
        <main className="flex-1 p-4 md:p-8 overflow-y-auto bg-slate-50/50"><div className="mx-auto">{children}</div></main>
      </div>
    </div>
  );
};
