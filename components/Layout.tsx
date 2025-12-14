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
  LayoutGrid,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Button } from "./ui/Button";
import { Popover } from "./ui/Popover";
import { Calendar } from "./ui/Calendar";
import { formatLunarDate, daysOfWeek } from "../utils/dateUtils";
import { BusTrip, BusType, Route } from "../types";

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
  // Default sidebar state set to false (Hidden by default)
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  // Schedule settings state
  const [scheduleSettings, setScheduleSettings] = useState<ScheduleSettings>({
    shutdownStartDate: "",
    shutdownEndDate: "",
    peakDays: [],
  });

  // Load schedule settings
  useEffect(() => {
    const loadSettings = () => {
      const savedSettings = localStorage.getItem("vinabus_schedule_settings");
      if (savedSettings) {
        try {
          setScheduleSettings(JSON.parse(savedSettings));
        } catch (e) {
          console.error("Failed to parse schedule settings", e);
        }
      }
    };
    loadSettings();
  }, [activeTab]);

  const navItems = [
    { id: "sales", icon: <Bus size={20} />, label: "Bán vé" },
    { id: "tickets", icon: <Ticket size={20} />, label: "Danh sách vé" },
    { id: "schedule", icon: <CalendarIcon size={20} />, label: "Lịch trình" },
  ];

  const pageInfo: Record<string, { title: string; description: string }> = {
    sales: {
      title: "Bán vé",
      description: "Quản lý bán vé và sơ đồ ghế trực quan",
    },
    tickets: {
      title: "Danh sách vé",
      description: "Tra cứu và quản lý lịch sử đặt vé",
    },
    schedule: {
      title: "Lịch trình",
      description: "Xem tổng quan lịch chạy xe",
    },
    settings: {
      title: "Cài đặt hệ thống",
      description: "Quản lý tài nguyên và cấu hình vận hành",
    },
  };

  const currentInfo = pageInfo[activeTab] || {
    title: "VinaBus",
    description: "",
  };

  const formatSolarHeader = (date: Date) => {
    const dayName = daysOfWeek[date.getDay()];
    const d = String(date.getDate()).padStart(2, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const y = date.getFullYear();
    return `${dayName}, ${d}/${m}/${y}`;
  };

  // Logic to process Enhanced Routes labels
  const tripOptions = useMemo(() => {
    // 1. Determine Route Sorting Order (Matches ScheduleView: Regular first, then Enhanced)
    // We sort routes first, then use that order to sort the trips.
    const sortedRouteIds = [...routes]
      .sort((a, b) => {
        // Sort by Enhanced status: Regular (false) < Enhanced (true)
        if (!!a.isEnhanced !== !!b.isEnhanced) return a.isEnhanced ? 1 : -1;
        return 0; // Maintain original ID order within same group
      })
      .map((r) => String(r.id));

    // 2. Map trips with metadata
    const tripsWithMeta = availableTrips.map((trip) => {
      let isEnhanced = false;

      // Check by ID (Most reliable)
      const routeById = routes.find(
        (r) => String(r.id) === String(trip.routeId)
      );
      if (routeById?.isEnhanced) {
        isEnhanced = true;
      }

      // Check by Name (Fallback)
      if (!isEnhanced && trip.route) {
        const routeByName = routes.find((r) => r.name === trip.route);
        if (routeByName?.isEnhanced) {
          isEnhanced = true;
        }
      }

      // Legacy Fallback
      if (!isEnhanced) {
        if (
          (trip as any).isEnhanced ||
          trip.name?.toLowerCase().includes("tăng cường") ||
          trip.route?.toLowerCase().includes("tăng cường")
        ) {
          isEnhanced = true;
        }
      }

      return {
        ...trip,
        isEnhanced,
        displayTime: trip.departureTime.split(" ")[1],
        _rank: 0, // Placeholder for sorting rank
      };
    });

    // 3. Compute Ranks and Sort
    // We assign a rank to each trip based on its Route's position in `sortedRouteIds`.
    tripsWithMeta.forEach((t) => {
      let rank = sortedRouteIds.indexOf(String(t.routeId));

      // Fallback: Try to find by name if ID lookup failed
      if (rank === -1 && t.route) {
        const matchingRoute = routes.find((r) => r.name === t.route);
        if (matchingRoute) {
          rank = sortedRouteIds.indexOf(String(matchingRoute.id));
        }
      }

      // If still not found (e.g. unknown route), push to bottom.
      // Respect enhanced flag for these orphans.
      if (rank === -1) {
        rank = t.isEnhanced ? 9999 : 5000;
      }

      t._rank = rank;
    });

    // Sort: Primary by Route Rank, Secondary by Time
    tripsWithMeta.sort((a, b) => {
      if (a._rank !== b._rank) return a._rank - b._rank;
      return a.departureTime.localeCompare(b.departureTime);
    });

    // 4. Calculate indices for enhanced trips
    const enhancedCounters: Record<string, number> = {};

    return tripsWithMeta.map((trip) => {
      let enhancedIndex = 0;
      if (trip.isEnhanced) {
        const key = trip.route;
        enhancedCounters[key] = (enhancedCounters[key] || 0) + 1;
        enhancedIndex = enhancedCounters[key];
      }

      return {
        ...trip,
        enhancedIndex,
      };
    });
  }, [availableTrips, routes]);

  const selectedTripDisplay = tripOptions.find((t) => t.id === selectedTripId);

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-10 md:hidden animate-in fade-in duration-200"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`bg-white border-r border-slate-200 flex-col fixed h-full z-20 transition-all duration-300 ${
          isSidebarOpen
            ? "w-64 translate-x-0"
            : "w-64 -translate-x-full md:translate-x-0 md:w-0 md:opacity-0 md:overflow-hidden"
        }`}
      >
        <div className="p-6 flex items-center gap-3 border-b border-slate-100 h-16">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold shrink-0">
            V
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-900 truncate">
            VinaBus
          </span>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onTabChange(item.id);
                if (window.innerWidth < 768) setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === item.id
                  ? "bg-primary/10 text-primary"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button
            onClick={() => {
              onTabChange("settings");
              if (window.innerWidth < 768) setSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === "settings"
                ? "bg-primary/10 text-primary"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Settings size={20} />
            <span>Cài đặt</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          isSidebarOpen ? "md:ml-64" : "ml-0"
        }`}
      >
        {/* Header */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-4 min-w-0 mr-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!isSidebarOpen)}
              className="text-slate-500 hover:text-slate-900 shrink-0"
            >
              <Menu size={20} />
            </Button>

            {/* Title and Description - Hidden on small screens when sales tab active to save space */}
            <div className={`flex flex-col justify-center min-w-0 ${activeTab === 'sales' ? 'hidden lg:flex' : ''}`}>
              <h1 className="text-sm md:text-base font-bold text-slate-900 truncate">
                {currentInfo.title}
              </h1>
              {currentInfo.description && (
                <p className="text-xs text-slate-500 truncate hidden md:block">
                  {currentInfo.description}
                </p>
              )}
            </div>
          </div>

          {/* Right Actions Wrapper */}
          <div className="flex items-center gap-2 md:gap-3 shrink-0 ml-auto">
            {/* Header Filters for Sales */}
            {activeTab === "sales" && (
              <div className="flex items-center gap-2 md:gap-3 animate-in fade-in slide-in-from-right-4 duration-300">
                {/* 1. Date Picker (Still needed to change date, but visual is less prominent) */}
                <Popover
                  align="right"
                  trigger={
                    <button className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
                      <CalendarIcon size={20} />
                    </button>
                  }
                  content={(close) => (
                    <Calendar
                      selected={selectedDate}
                      onSelect={(date) => {
                        onDateChange(date);
                        close();
                      }}
                      shutdownRange={{
                        start: scheduleSettings.shutdownStartDate,
                        end: scheduleSettings.shutdownEndDate,
                      }}
                      peakDays={scheduleSettings.peakDays}
                    />
                  )}
                />

                {/* 2. Direction Toggle (Compact) */}
                {onDirectionChange && (
                  <button 
                     onClick={() => onDirectionChange(selectedDirection === 'outbound' ? 'inbound' : 'outbound')}
                     className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-slate-100 text-slate-500 transition-colors sm:hidden"
                     title="Đổi chiều"
                  >
                     <Clock size={20} />
                  </button>
                )}
                 {onDirectionChange && (
                  <label className="flex items-center gap-2 cursor-pointer select-none bg-white border border-slate-200 rounded-md px-2 md:px-3 h-9 hover:border-slate-300 transition-colors hidden sm:flex">
                    <div
                      className={`relative flex items-center justify-center w-4 h-4 border rounded bg-white transition-colors ${
                        selectedDirection === "outbound"
                          ? "border-primary"
                          : "border-slate-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="peer appearance-none absolute inset-0 w-full h-full cursor-pointer"
                        checked={selectedDirection === "outbound"}
                        onChange={(e) =>
                          onDirectionChange(
                            e.target.checked ? "outbound" : "inbound"
                          )
                        }
                      />
                      {selectedDirection === "outbound" && (
                        <Check
                          size={12}
                          className="text-primary pointer-events-none"
                          strokeWidth={3}
                        />
                      )}
                    </div>
                    <span
                      className={`text-sm font-medium whitespace-nowrap ${
                        selectedDirection === "outbound"
                          ? "text-primary"
                          : "text-slate-600"
                      }`}
                    >
                      {selectedDirection === "outbound"
                        ? "Chiều đi"
                        : "Chiều về"}
                    </span>
                  </label>
                )}

                {/* 3. New Trip Selector TRIGGER (Redesigned Card Style) */}
                <Popover
                  align="right"
                  trigger={
                    <div className="relative group cursor-pointer select-none">
                      {/* Card Container */}
                      <div className="flex flex-col items-start bg-white border border-slate-200 border-l-[4px] border-l-yellow-400 shadow-sm rounded-lg p-2.5 min-w-[220px] sm:min-w-[280px] hover:shadow-md transition-all">
                        {selectedTripDisplay ? (
                          <>
                            {/* Row 1: Dates (Badges) */}
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="inline-flex items-center justify-center bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-200/50">
                                {selectedDate.getDate()}/{selectedDate.getMonth() + 1}
                              </span>
                              <span className="inline-flex items-center justify-center bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-200/50">
                                {formatLunarDate(selectedDate).replace(" Âm Lịch", " ÂL")}
                              </span>
                            </div>

                            {/* Row 2: Route Name */}
                            <div className="font-bold text-slate-900 text-sm mb-2 line-clamp-1 pr-4">
                              {selectedTripDisplay.route}
                            </div>

                            {/* Row 3: Badges (Purple style as requested) */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="inline-flex items-center justify-center bg-indigo-100 text-indigo-700 text-[11px] font-bold px-1.5 py-0.5 rounded border border-indigo-200">
                                {selectedTripDisplay.displayTime}
                              </span>
                              <span className="inline-flex items-center justify-center bg-indigo-100 text-indigo-700 text-[11px] font-bold px-1.5 py-0.5 rounded border border-indigo-200">
                                {selectedTripDisplay.licensePlate}
                              </span>
                              {selectedTripDisplay.isEnhanced && (
                                <span className="inline-flex items-center justify-center bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-amber-200">
                                  <Zap size={8} className="mr-0.5 fill-amber-700" /> TC
                                </span>
                              )}
                            </div>
                          </>
                        ) : (
                          /* Empty State */
                          <div className="flex flex-col justify-center h-full w-full py-1">
                             <div className="flex items-center gap-2 mb-1">
                                <span className="inline-flex items-center justify-center bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                    {selectedDate.getDate()}/{selectedDate.getMonth() + 1}
                                </span>
                             </div>
                             <span className="text-slate-400 text-sm font-medium">Chọn chuyến xe...</span>
                          </div>
                        )}
                        
                        {/* Chevron (Absolute) */}
                        <div className="absolute top-3 right-2 text-slate-300 group-hover:text-slate-500 transition-colors">
                            <ChevronDown size={16} />
                        </div>
                      </div>
                    </div>
                  }
                  content={(close) => (
                    <div className="w-[380px] max-h-[450px] overflow-y-auto bg-white rounded-lg border border-slate-200 shadow-xl p-2">
                      {tripOptions.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">
                          <BusFront
                            size={24}
                            className="mx-auto mb-2 opacity-20"
                          />
                          <p className="text-sm">
                            Không có chuyến nào trong ngày này.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {tripOptions.map((trip) => {
                            const isSelected = trip.id === selectedTripId;
                            return (
                              <button
                                key={trip.id}
                                onClick={() => {
                                  onTripChange(trip.id);
                                  close();
                                }}
                                className={`
                                    relative w-full flex flex-col items-start p-3 rounded-lg border transition-all text-left group
                                    ${
                                      isSelected
                                        ? "bg-primary/5 border-primary ring-1 ring-primary shadow-sm z-10"
                                        : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                                    }
                                `}
                              >
                                {/* Top Row: Time & Plate */}
                                <div className="flex justify-between items-center w-full mb-1">
                                  <div className="flex items-center gap-2">
                                    <div
                                      className={`px-2 py-0.5 rounded text-xs font-bold border ${
                                        isSelected
                                          ? "bg-primary text-white border-primary"
                                          : "bg-slate-100 text-slate-600 border-slate-200"
                                      }`}
                                    >
                                      {trip.displayTime}
                                    </div>
                                    <span
                                      className={`font-bold text-sm ${
                                        isSelected
                                          ? "text-primary"
                                          : "text-slate-900"
                                      }`}
                                    >
                                      {trip.licensePlate}
                                    </span>
                                  </div>
                                  {/* Enhanced Badge */}
                                  {trip.isEnhanced && (
                                    <div className="flex items-center gap-1 bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200 text-[10px] font-bold">
                                      <Zap
                                        size={10}
                                        className="fill-amber-700"
                                      />
                                      <span>
                                        TC
                                        {trip.enhancedIndex > 0
                                          ? ` #${trip.enhancedIndex}`
                                          : ""}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {/* Middle: Route Name */}
                                <div
                                  className="text-sm font-medium text-slate-700 mb-2 line-clamp-1 w-full"
                                  title={trip.route}
                                >
                                  {trip.route}
                                </div>

                                {/* Bottom: Bus Type & Selection Check */}
                                <div className="flex items-center justify-between w-full pt-2 border-t border-slate-100 border-dashed">
                                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                    <LayoutGrid size={12} />
                                    <span>
                                      {trip.type === BusType.CABIN
                                        ? "Phòng VIP"
                                        : "Giường đơn"}
                                    </span>
                                    <span className="w-1 h-1 rounded-full bg-slate-300 mx-0.5" />
                                    <span>{trip.seats.length} chỗ</span>
                                  </div>
                                  {isSelected && (
                                    <CheckCircle2
                                      size={16}
                                      className="text-primary"
                                    />
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                />
              </div>
            )}

            {/* INJECTED HEADER RIGHT CONTENT */}
            {headerRight}
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto bg-slate-50/50">
          <div className="mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
};
