
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
  BadgeDollarSign
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
        if (data) {
          setScheduleSettings(data);
        }
      } catch (e) {
        console.error("Failed to load schedule settings", e);
      }
    };
    loadSettings();
  }, [activeTab]);

  const navItems = [
    { id: "sales", icon: <Bus size={20} />, label: "Bán vé" },
    { id: "tickets", icon: <Ticket size={20} />, label: "Danh sách vé" },
    { id: "schedule", icon: <CalendarIcon size={20} />, label: "Lịch trình" },
    { id: "finance", icon: <BadgeDollarSign size={20} />, label: "Tài chính" },
  ];

  const pageInfo: Record<string, { title: string; description: string }> = {
    sales: { title: "Bán vé", description: "Quản lý bán vé và sơ đồ ghế" },
    tickets: { title: "Danh sách vé", description: "Tra cứu lịch sử đặt vé" },
    schedule: { title: "Lịch trình", description: "Xem tổng quan lịch chạy xe" },
    finance: { title: "Tài chính", description: "Quản lý doanh thu" },
    settings: { title: "Cấu hình", description: "Quản lý hệ thống" },
  };

  const currentInfo = pageInfo[activeTab] || { title: "VinaBus", description: "" };

  const formatSolarHeader = (date: Date) => {
    const dayName = daysOfWeek[date.getDay()];
    const d = String(date.getDate()).padStart(2, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    return `${dayName}, ${d}/${m}`;
  };

  const tripOptions = useMemo(() => {
    const sortedRouteIds = [...routes]
      .sort((a, b) => {
        if (!!a.isEnhanced !== !!b.isEnhanced) return a.isEnhanced ? 1 : -1;
        return 0;
      })
      .map((r) => String(r.id));

    const tripsWithMeta = availableTrips.map((trip) => {
      let isEnhanced = false;
      const routeById = routes.find((r) => String(r.id) === String(trip.routeId));
      if (routeById?.isEnhanced) isEnhanced = true;
      return {
        ...trip,
        isEnhanced,
        displayTime: trip.departureTime.split(" ")[1],
      };
    });

    const enhancedCounters: Record<string, number> = {};
    return tripsWithMeta.map((trip) => {
      let enhancedIndex = 0;
      if (trip.isEnhanced) {
        const key = trip.route;
        enhancedCounters[key] = (enhancedCounters[key] || 0) + 1;
        enhancedIndex = enhancedCounters[key];
      }
      return { ...trip, enhancedIndex };
    });
  }, [availableTrips, routes]);

  const selectedTripDisplay = tripOptions.find((t) => t.id === selectedTripId);

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[45] md:hidden animate-in fade-in duration-200"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`bg-white border-r border-slate-200 flex-col fixed h-full z-50 transition-all duration-300 ${
          isSidebarOpen ? "w-64 translate-x-0" : "w-64 -translate-x-full md:translate-x-0 md:w-0 md:opacity-0 md:overflow-hidden"
        }`}
      >
        <div className="p-6 flex items-center gap-3 border-b border-slate-100 h-16">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold">V</div>
          <span className="font-bold text-xl text-slate-900 truncate">VinaBus</span>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onTabChange(item.id);
                if (window.innerWidth < 768) setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === item.id ? "bg-primary/10 text-primary" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${isSidebarOpen ? "md:ml-64" : "ml-0"}`}>
        <header className="bg-white border-b border-slate-200 flex flex-col sticky top-0 z-40 shadow-sm">
          {/* Row 1: Logo & Actions */}
          <div className="h-14 md:h-16 flex items-center justify-between px-3 md:px-8 border-b md:border-b-0 border-slate-100">
            <div className="flex items-center gap-2 md:gap-4 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!isSidebarOpen)}
                className="text-slate-500 hover:text-slate-900 shrink-0 h-9 w-9"
              >
                <Menu size={20} />
              </Button>
              <h1 className="text-sm md:text-base font-bold text-slate-900 truncate">
                {currentInfo.title}
              </h1>
            </div>

            <div className="flex items-center gap-2">
               {/* Display History icon prominently on row 1 mobile */}
               <div className="shrink-0">
                 {headerRight}
               </div>
            </div>
          </div>

          {/* Row 2: Filters (Visible on Mobile as second row, integrated on Desktop if possible) */}
          {activeTab === "sales" && (
            <div className="px-3 md:px-8 py-2 bg-slate-50 md:bg-white flex items-center gap-2 md:gap-3 overflow-x-auto scrollbar-none md:absolute md:right-24 md:top-3.5 md:p-0 md:bg-transparent">
              {/* Direction (Hidden on tiny screens) */}
              {onDirectionChange && (
                <label className="hidden xl:flex items-center gap-2 cursor-pointer select-none bg-white border border-slate-200 rounded-md px-2 h-9">
                   <input
                      type="checkbox"
                      className="w-4 h-4 rounded text-primary"
                      checked={selectedDirection === "outbound"}
                      onChange={(e) => onDirectionChange(e.target.checked ? "outbound" : "inbound")}
                    />
                    <span className="text-xs font-medium">{selectedDirection === "outbound" ? "Đi" : "Về"}</span>
                </label>
              )}

              {/* Date Picker */}
              <Popover
                align="right"
                trigger={
                  <div className="flex items-center gap-2 h-9 px-2 md:px-3 border border-slate-200 rounded-md bg-white hover:bg-slate-50 transition-colors cursor-pointer shrink-0">
                    <CalendarIcon size={14} className="text-slate-500" />
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-slate-700 whitespace-nowrap">
                        {formatSolarHeader(selectedDate)}
                      </span>
                      <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1 rounded border border-slate-200 whitespace-nowrap">
                        {formatLunarDate(selectedDate).replace(" Âm Lịch", " ÂL")}
                      </span>
                    </div>
                  </div>
                }
                content={(close) => (
                  <Calendar
                    selected={selectedDate}
                    onSelect={(date) => { onDateChange(date); close(); }}
                    shutdownRange={{ start: scheduleSettings.shutdownStartDate, end: scheduleSettings.shutdownEndDate }}
                    peakDays={scheduleSettings.peakDays}
                  />
                )}
              />

              {/* Trip Selector */}
              <Popover
                align="right"
                trigger={
                  <div className="flex items-center justify-between gap-2 h-9 px-2 md:px-3 border border-slate-200 rounded-md bg-white hover:bg-slate-50 transition-colors cursor-pointer min-w-0 flex-1 md:max-w-[280px]">
                    <div className="flex items-center gap-2 overflow-hidden min-w-0">
                      <MapPin size={14} className="text-slate-500 shrink-0" />
                      {selectedTripDisplay ? (
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {selectedTripDisplay.displayTime} - {selectedTripDisplay.route}
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-slate-400">Chọn chuyến...</span>
                      )}
                    </div>
                    <ChevronDown size={12} className="text-slate-400 shrink-0" />
                  </div>
                }
                content={(close) => (
                  <div className="w-[300px] md:w-[340px] max-h-[400px] overflow-y-auto bg-white rounded-lg border border-slate-200 shadow-xl p-1.5">
                    {tripOptions.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-xs italic">Không có chuyến nào.</div>
                    ) : (
                      <div className="space-y-1">
                        {tripOptions.map((trip) => (
                          <button
                            key={trip.id}
                            onClick={() => { onTripChange(trip.id); close(); }}
                            className={`w-full text-left p-2 rounded-md transition-all flex items-center gap-3 ${
                              trip.id === selectedTripId ? "bg-primary/5 border-primary/20" : "hover:bg-slate-50"
                            }`}
                          >
                            <div className={`w-10 h-9 rounded border flex items-center justify-center text-[10px] font-bold ${trip.id === selectedTripId ? "bg-primary text-white border-primary" : "bg-slate-50 text-slate-600"}`}>
                              {trip.displayTime}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-bold text-slate-900 truncate">{trip.route}</div>
                              <div className="text-[10px] text-slate-500 font-mono mt-0.5">{trip.licensePlate}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              />
            </div>
          )}
        </header>

        <main className="flex-1 p-3 md:p-8 overflow-y-auto bg-slate-50/50">
          <div className="mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
};
