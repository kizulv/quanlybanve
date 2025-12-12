import React, { useState, useEffect } from "react";
import {
  Bus,
  Calendar as CalendarIcon,
  LayoutDashboard,
  Settings,
  LogOut,
  Ticket,
  Menu,
  MapPin,
} from "lucide-react";
import { Button } from "./ui/Button";
import { Popover } from "./ui/Popover";
import { Calendar } from "./ui/Calendar";

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  // Header Props
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  selectedRoute: string;
  onRouteChange: (route: string) => void;
  routes: string[];
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
  selectedRoute,
  onRouteChange,
  routes,
}) => {
  // Default sidebar state set to false (Hidden by default)
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [scheduleSettings, setScheduleSettings] = useState<ScheduleSettings>({
    shutdownStartDate: "",
    shutdownEndDate: "",
    peakDays: []
  });

  // Load schedule settings for calendar visualization
  useEffect(() => {
    const loadSettings = () => {
      const saved = localStorage.getItem("vinabus_schedule_settings");
      if (saved) {
        try {
          setScheduleSettings(JSON.parse(saved));
        } catch (e) {
          console.error("Failed to parse schedule settings", e);
        }
      }
    };

    loadSettings();
    // Listen for storage events (if multiple tabs or update from ScheduleView)
    window.addEventListener('storage', loadSettings);
    // Custom event listener if we want instant updates within same window
    // For now simple mount load is enough as switching tabs often re-renders Layout or we can rely on parent updates if we lifted state
    
    return () => window.removeEventListener('storage', loadSettings);
  }, [activeTab]); // Reload when tab changes (e.g. coming back from Schedule tab)

  const navItems = [
    { id: "sales", icon: <Bus size={20} />, label: "Bán vé" },
    { id: "tickets", icon: <Ticket size={20} />, label: "Danh sách vé" },
    { id: "schedule", icon: <CalendarIcon size={20} />, label: "Lịch trình" },
  ];

  // Page Info Mapping
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

  // Helper for Vietnamese Date
  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    };
    return new Intl.DateTimeFormat("vi-VN", options).format(date);
  };

  // Mock Lunar Date
  const getLunarDate = (date: Date) => {
    const lunarDay =
      date.getDate() > 15 ? date.getDate() - 15 : date.getDate() + 15;
    const lunarMonth =
      date.getDate() > 15 ? date.getMonth() + 1 : date.getMonth();
    return `${lunarDay}/${lunarMonth} ÂL`;
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
                // Auto close on mobile when clicking item
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
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-red-600 hover:bg-red-50 mt-1 whitespace-nowrap">
            <LogOut size={20} />
            <span>Đăng xuất</span>
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
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!isSidebarOpen)}
              className="text-slate-500 hover:text-slate-900 shrink-0"
            >
              <Menu size={20} />
            </Button>

            {/* Title and Description */}
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

          {/* Filters - Only visible on 'sales' tab */}
          {activeTab === "sales" && (
            <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-4 duration-300 shrink-0 ml-4">
              {/* Route Selector */}
              <div className="relative hidden lg:block group">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                  <MapPin size={16} />
                </div>
                <select
                  value={selectedRoute}
                  onChange={(e) => onRouteChange(e.target.value)}
                  className="h-9 pl-9 pr-8 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 hover:border-slate-300 transition-colors appearance-none cursor-pointer min-w-[200px]"
                >
                  <option value="all">Tất cả tuyến</option>
                  {routes.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-slate-400">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </div>
              </div>

              {/* Date Picker using Custom Popover & Calendar */}
              <Popover
                align="right"
                trigger={
                  <div className="flex items-center gap-2 h-9 px-3 border border-slate-200 rounded-md bg-white hover:bg-slate-50 hover:border-slate-300 transition-colors select-none cursor-pointer">
                    <CalendarIcon size={16} className="text-slate-500" />
                    <span className="text-sm font-medium text-slate-700 capitalize whitespace-nowrap">
                      {formatDate(selectedDate)}
                    </span>
                    <span className="text-xs text-slate-400 font-medium ml-1 bg-slate-100 px-1.5 py-0.5 rounded hidden sm:inline-block">
                      {getLunarDate(selectedDate)}
                    </span>
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
                      end: scheduleSettings.shutdownEndDate 
                    }}
                    peakDays={scheduleSettings.peakDays}
                  />
                )}
              />
            </div>
          )}
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto bg-slate-50/50">
          <div className="mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
};