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
  ArrowLeftRight,
  QrCode,
  Search,
  Users,
  LogOut,
  User as UserIcon,
  ChevronsUpDown,
  CircleHelp,
  LifeBuoy,
  Send,
  LogIn,
  FileText,
  Shield,
  X,
} from "lucide-react";
import { Button } from "./ui/Button";
import { Popover } from "./ui/Popover";
import { Calendar } from "./ui/Calendar";
import { formatLunarDate, daysOfWeek } from "../utils/dateUtils";
import { BusTrip, BusType, Route, User } from "../types";
import { api } from "../lib/api";
import { useAuth } from "./AuthContext";
import { PERMISSIONS } from "../lib/permissions";

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
  footer?: React.ReactNode;
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
  footer,
}) => {
  const { user, logout, hasPermission, isAuthenticated } = useAuth();
  // Default sidebar state set to false (Hidden by default)
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  // Schedule settings state
  const [scheduleSettings, setScheduleSettings] = useState<ScheduleSettings>({
    shutdownStartDate: "",
    shutdownEndDate: "",
    peakDays: [],
  });

  // Load schedule settings from API
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await api.settings.get("schedule_settings");
        if (data) {
          setScheduleSettings(data);
        }
      } catch (e) {
        console.error("Failed to load schedule settings", e);
      }
    };
    loadSettings();
  }, [activeTab]);

  const navGroups = [
    {
      title: "Chức năng",
      items: [
        {
          id: "sales",
          icon: <Bus size={18} />,
          label: "Bán vé",
          permission: PERMISSIONS.VIEW_SALES,
        },
        {
          id: "schedule",
          icon: <FileText size={18} />,
          label: "Lịch trình",
          permission: PERMISSIONS.VIEW_SCHEDULE,
        },
        {
          id: "finance",
          icon: <BadgeDollarSign size={18} />,
          label: "Tài chính",
          permission: PERMISSIONS.VIEW_FINANCE,
        },
        {
          id: "qr-payment",
          icon: <QrCode size={18} />,
          label: "Tạo mã QR",
          permission: PERMISSIONS.VIEW_SALES,
        },
      ],
    },
    {
      title: "Hệ thống",
      items: [
        {
          id: "users",
          icon: <Users size={18} />,
          label: "Người dùng",
          permission: PERMISSIONS.MANAGE_USERS,
        },
      ],
    },
  ];

  const footerNavItems = [
    {
      id: "settings",
      icon: <Settings size={18} />,
      label: "Cài đặt",
      permission: PERMISSIONS.MANAGE_SETTINGS,
    },
  ];

  const pageInfo: Record<string, { title: string; description: string }> = {
    sales: {
      title: "Bán vé",
      description: "Quản lý bán vé và sơ đồ ghế trực quan",
    },
    schedule: {
      title: "Lịch trình",
      description: "Xem tổng quan lịch chạy xe",
    },
    finance: {
      title: "Tài chính",
      description: "Quản lý doanh thu và lịch sử thanh toán",
    },
    "order-info": {
      title: "Tra cứu vé",
      description: "Xem chi tiết thông tin đặt vé qua mã hoặc QR",
    },
    settings: {
      title: "Cài đặt hệ thống",
      description: "Quản lý tài nguyên và cấu hình vận hành",
    },
    users: {
      title: "Quản lý người dùng",
      description: "Quản lý tài khoản và phân quyền truy cập",
    },
    account: {
      title: "Tài khoản",
      description: "Cập nhật thông tin cá nhân",
    },
  };

  const currentInfo = pageInfo[activeTab] || {
    title: "Quản lý bán vé",
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
    // 1. Determine Route Sorting Order
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
    tripsWithMeta.forEach((t) => {
      let rank = sortedRouteIds.indexOf(String(t.routeId));

      if (rank === -1 && t.route) {
        const matchingRoute = routes.find((r) => r.name === t.route);
        if (matchingRoute) {
          rank = sortedRouteIds.indexOf(String(matchingRoute.id));
        }
      }

      if (rank === -1) {
        rank = t.isEnhanced ? 9999 : 5000;
      }

      t._rank = rank;
    });

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

  // Helper component for Direction Toggle
  const DirectionToggle = () => {
    if (!onDirectionChange) return null;
    return (
      <label className="flex items-center gap-2 cursor-pointer select-none bg-white border border-slate-200 rounded-md px-15 md:px-8 h-9 hover:border-slate-300 transition-colors">
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
              onDirectionChange(e.target.checked ? "outbound" : "inbound")
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
          className={`text-xs md:text-sm font-medium whitespace-nowrap ${
            selectedDirection === "outbound" ? "text-primary" : "text-slate-600"
          }`}
        >
          {selectedDirection === "outbound" ? "Chiều đi" : "Chiều về"}
        </span>
      </label>
    );
  };

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
        className={`bg-white border-r border-slate-200 flex flex-col fixed h-full z-20 transition-all duration-300 ${
          isSidebarOpen
            ? "w-64 translate-x-0"
            : "w-64 -translate-x-full md:translate-x-0 md:w-0 md:opacity-0 md:overflow-hidden"
        }`}
      >
        <div className="p-6 flex items-center gap-3 border-b border-slate-100 h-16">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0">
            <img src="/images/logo.png" alt="Logo" className="w-full h-full" />
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-900 truncate">
            Quản lý bán vé
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
          {navGroups.map((group, idx) => {
            const visibleItems = group.items.filter((item) =>
              hasPermission(item.permission)
            );

            if (visibleItems.length === 0) return null;

            return (
              <div key={idx}>
                <h4 className="mb-2 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {group.title}
                </h4>
                <div className="space-y-0.5">
                  {visibleItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        onTabChange(item.id);
                        if (window.innerWidth < 768) setSidebarOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                        activeTab === item.id
                          ? "bg-slate-100 text-slate-900"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                    >
                      {item.icon}
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Footer Section */}
        <div className="p-3 mt-auto border-t border-slate-100">
          {/* Footer Nav Items */}
          <div className="space-y-0.5 mb-4">
            {footerNavItems.map((item) => {
              if (!hasPermission(item.permission)) return null;

              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.id === "help" || item.id === "feedback") {
                      // Placeholder for now
                      return;
                    }
                    onTabChange(item.id);
                    if (window.innerWidth < 768) setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === item.id
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              );
            })}
          </div>

          {user ? (
            <Popover
              align="left"
              side="top"
              trigger={
                <button className="flex items-center gap-3 px-3 py-2 w-full rounded-md hover:bg-slate-100 transition-colors group">
                  <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center text-slate-600 shrink-0 group-hover:bg-white group-hover:border group-hover:border-slate-200 transition-all">
                    <span className="font-bold text-xs">
                      {user.name?.charAt(0) || user.username.charAt(0)}
                    </span>
                  </div>
                  <div className="flex flex-col items-start text-sm">
                    <span className="font-medium text-slate-700 group-hover:text-slate-900 truncate w-32 text-left">
                      {user.name || user.username}
                    </span>
                    <span className="text-xs text-slate-500 group-hover:text-slate-600 truncate w-32 text-left">
                      {user.role}
                    </span>
                  </div>
                  <ChevronsUpDown
                    className="ml-auto text-slate-400 group-hover:text-slate-600"
                    size={14}
                  />
                </button>
              }
              content={(close) => (
                <div className="w-56 p-1 bg-white rounded-lg border border-slate-200 shadow-lg">
                  <div className="px-2 py-1.5 mb-1 border-b border-slate-100">
                    <p className="text-sm font-medium text-slate-900">
                      {user.name || user.username}
                    </p>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {user.username}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <button
                      onClick={() => {
                        onTabChange("account");
                        close();
                        if (window.innerWidth < 768) setSidebarOpen(false);
                      }}
                      className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                    >
                      <UserIcon size={16} />
                      Tài khoản
                    </button>
                    <button
                      onClick={() => {
                        logout();
                        close();
                      }}
                      className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    >
                      <LogOut size={16} />
                      Đăng xuất
                    </button>
                  </div>
                </div>
              )}
            />
          ) : (
            <button
              onClick={() => onTabChange("login")}
              className="flex items-center gap-3 px-3 py-2 w-full rounded-md hover:bg-blue-50 text-blue-600 transition-colors group border border-dashed border-blue-200"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <LogIn size={16} />
              </div>
              <span className="font-medium text-sm">Đăng nhập ngay</span>
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          isSidebarOpen ? "md:ml-64" : "ml-0"
        }`}
      >
        {/* Header - Updated for 2 rows on mobile */}
        <header className="h-auto md:h-16 bg-white border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between sticky top-0 z-30">
          {/* Row 1: Menu + Title + Direction (Mobile Center) + Right Actions */}
          <div className="flex items-center justify-between h-16 px-4 md:px-8 w-full md:w-auto md:flex-1 min-w-0">
            <div className="flex items-center gap-2 md:gap-4 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!isSidebarOpen)}
                className="text-slate-500 hover:text-slate-900 shrink-0"
              >
                <Menu size={20} />
              </Button>

              <div className="flex flex-col justify-center min-w-0">
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

            {/* Mobile-only center: Direction Toggle */}
            <div className="md:hidden flex-1 flex justify-center px-1">
              {activeTab === "sales" && <DirectionToggle />}
            </div>

            {/* Mobile-only right: headerRight */}
            <div className="md:hidden">{headerRight}</div>
          </div>

          {/* Row 2 (Mobile) / Middle (Desktop): Sales Filters */}
          <div
            className={`
            flex items-center gap-2 px-4 pb-3 md:pb-0 md:px-4 overflow-x-auto no-scrollbar justify-center md:justify-start
            ${activeTab === "sales" ? "flex" : "hidden md:flex"}
          `}
          >
            {activeTab === "sales" && (
              <div className="flex items-center gap-2 md:gap-3 animate-in fade-in slide-in-from-right-4 duration-300 shrink-0">
                {/* 1. Direction Toggle (Desktop Only here) */}
                <div className="hidden md:block">
                  <DirectionToggle />
                </div>

                {/* 2. Date Picker */}
                <Popover
                  align="left"
                  trigger={
                    <div className="flex items-center gap-2 h-9 px-2 md:px-3 border border-slate-200 rounded-md bg-white hover:bg-slate-50 hover:border-slate-300 transition-colors select-none cursor-pointer">
                      <CalendarIcon size={16} className="text-slate-500" />
                      <div className="flex items-center gap-2">
                        <span className="text-xs md:text-sm font-medium text-slate-700 capitalize whitespace-nowrap">
                          {formatSolarHeader(selectedDate)}
                        </span>
                        <span className="text-[10px] md:text-[11px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 whitespace-nowrap hidden sm:inline-block">
                          {formatLunarDate(selectedDate)}
                        </span>
                      </div>
                    </div>
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

                {/* 3. Smart Trip Selector */}
                {activeTab === "sales" && (
                  <Popover
                    align="right"
                    trigger={
                      <div className="flex items-center justify-between gap-3 h-9 px-2 md:px-3 border border-slate-200 rounded-md bg-white hover:bg-slate-50 hover:border-slate-300 transition-colors select-none cursor-pointer min-w-35 md:min-w-50 max-w-60 md:max-w-85">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <MapPin
                            size={16}
                            className="text-slate-500 shrink-0"
                          />
                          {selectedTripDisplay ? (
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs md:text-sm font-medium text-slate-900 truncate">
                                {selectedTripDisplay.displayTime} -{" "}
                                {selectedTripDisplay.route}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs md:text-sm font-medium text-slate-500 truncate">
                              Chọn chuyến...
                            </span>
                          )}
                        </div>
                        <ChevronDown
                          size={14}
                          className="text-slate-400 shrink-0"
                        />
                      </div>
                    }
                    content={(close) => (
                      <div className="w-75 md:w-90 max-h-100 overflow-y-auto bg-white rounded-lg border border-slate-200 shadow-xl p-1.5">
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
                          <div className="space-y-1">
                            {tripOptions.map((trip) => {
                              const isSelected = trip.id === selectedTripId;
                              return (
                                <button
                                  key={trip.id}
                                  onClick={() => {
                                    onTripChange(trip.id);
                                    close();
                                  }}
                                  className={`w-full text-left p-2.5 rounded-md transition-all flex items-center gap-3 group ${
                                    isSelected
                                      ? "bg-primary/5 border border-primary/20"
                                      : "hover:bg-slate-50 border border-transparent"
                                  }`}
                                >
                                  {/* Time Column */}
                                  <div
                                    className={`flex flex-col items-center justify-center w-12 h-10 rounded border text-xs font-bold shrink-0 ${
                                      isSelected
                                        ? "bg-white border-primary/30 text-primary"
                                        : "bg-slate-50 border-slate-200 text-slate-600"
                                    }`}
                                  >
                                    {trip.displayTime}
                                  </div>

                                  {/* Info Column */}
                                  <div className="flex-1 min-w-0">
                                    <div
                                      className={`text-sm font-medium flex items-center gap-1.5 ${
                                        isSelected
                                          ? "text-primary"
                                          : "text-slate-900"
                                      }`}
                                    >
                                      <span className="truncate">
                                        {trip.route}
                                      </span>
                                      {trip.isEnhanced && (
                                        <span className="shrink-0 inline-flex items-center text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 rounded border border-amber-200 shadow-sm ml-auto md:ml-0">
                                          <Zap
                                            size={9}
                                            className="mr-0.5 fill-amber-700"
                                          />
                                          Tăng cường{" "}
                                          {trip.enhancedIndex > 0
                                            ? `#${trip.enhancedIndex}`
                                            : ""}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 rounded border border-slate-200/50">
                                        {trip.licensePlate}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Checkmark */}
                                  {isSelected && (
                                    <Check
                                      size={16}
                                      className="text-primary ml-auto"
                                    />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  />
                )}
              </div>
            )}
          </div>

          {/* Row 3 (Desktop Only) / End: Right Actions (History) */}
          <div className="hidden md:flex items-center gap-3 pr-8 shrink-0">
            {headerRight}
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto bg-slate-50/50 relative">
          <div className="mx-auto">{children}</div>
          <div className="mt-4 md:absolute bottom-2 left-0 right-0 flex items-center justify-center text-sm">
            <span className="hidden md:block text-slate-400">
              Ứng dụng Đặt vé sử dụng nội bộ{" "}
              <span className="font-semibold text-slate-600">
                Nhà Xe Trung Dũng {" - "}
              </span>
            </span>
            <span className="md:ml-1 text-slate-400">
              © 2026 Thiết kế bởi{" "}
              <a
                href="https://www.facebook.com/pcthanh.ksdt"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-600 hover:text-slate-950 font-semibold"
              >
                Phạm Công Thành
              </a>
            </span>
          </div>
        </main>
      </div>
    </div>
  );
};
