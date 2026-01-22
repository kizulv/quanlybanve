import React, { useState, useMemo } from "react";
import { Bus, BusTrip, Route } from "../../types";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarDays,
  Calendar,
  X,
  Zap,
  ArrowRight,
  Settings,
  ArrowLeft,
} from "lucide-react";
import { Button } from "../ui/Button";
import { Card, CardHeader, CardContent, CardTitle } from "../ui/Card";
import {
  getDaysInMonth,
  daysOfWeek,
  formatLunarDate,
  isSameDay,
  formatTime,
} from "../../utils/dateUtils";
import { AddTripModal } from "./AddTripModal";
import { ScheduleSetting, ScheduleSettingsData } from "./ScheduleSetting";
import { api } from "../../lib/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/AlertDialog";

interface ScheduleProps {
  trips: BusTrip[];
  routes: Route[];
  buses: Bus[];
  onAddTrip: (date: Date, tripData: Partial<BusTrip>) => Promise<void>;
  onUpdateTrip: (tripId: string, tripData: Partial<BusTrip>) => Promise<void>;
  onDeleteTrip: (tripId: string) => Promise<void>;
  onUpdateBus: (busId: string, updates: Partial<Bus>) => Promise<void>;
}

export const Schedule: React.FC<ScheduleProps> = ({
  trips,
  routes,
  buses,
  onAddTrip,
  onUpdateTrip,
  onDeleteTrip,
  onUpdateBus,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDateForAdd, setSelectedDateForAdd] = useState<Date>(
    new Date(),
  );
  const [preSelectedRouteId, setPreSelectedRouteId] = useState<string>("");
  const [editingTrip, setEditingTrip] = useState<BusTrip | undefined>(
    undefined,
  );

  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<ScheduleSettingsData>({
    shutdownStartDate: "",
    shutdownEndDate: "",
    peakDays: [],
  });

  // Load settings
  React.useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await api.settings.get("schedule_settings");
        if (data) {
          setSettings(data);
        }
      } catch (e) {
        console.error("Failed to load settings", e);
      }
    };
    loadSettings();
  }, []);

  const handleSaveSettings = async () => {
    try {
      await api.settings.set("schedule_settings", settings);
      setIsSettingsOpen(false);
    } catch (e) {
      console.error("Failed to save settings", e);
    }
  };

  const [deletingTripId, setDeletingTripId] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const days = getDaysInMonth(year, month);

  const activeRoutes = useMemo(() => {
    return routes.filter((r) => r.status !== "inactive");
  }, [routes]);

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const handleToday = () => setCurrentDate(new Date());

  const handleOpenAdd = (date: Date, routeId: string = "") => {
    setSelectedDateForAdd(date);
    setPreSelectedRouteId(routeId);
    setEditingTrip(undefined);
    setIsModalOpen(true);
  };

  const handleEditTrip = (trip: BusTrip) => {
    setEditingTrip(trip);
    setSelectedDateForAdd(new Date(trip.departureTime.split(" ")[0]));
    setPreSelectedRouteId(trip.routeId ? String(trip.routeId) : "");
    setIsModalOpen(true);
  };

  const handleSaveTrip = async (tripData: Partial<BusTrip>) => {
    if (editingTrip) {
      await onUpdateTrip(editingTrip.id, tripData);
    } else {
      await onAddTrip(selectedDateForAdd, tripData);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, tripId: string) => {
    e.stopPropagation();
    setDeletingTripId(tripId);
  };

  const handleConfirmDelete = async () => {
    if (deletingTripId) {
      await onDeleteTrip(deletingTripId);
      setDeletingTripId(null);
    }
  };

  return (
    <div className="h-full flex flex-col space-y-4 mb-4">
      {/* Header */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Navigation Group */}
          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
            <button
              title="Tháng trước"
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-md transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="px-3 text-sm font-bold text-slate-700 min-w-35 text-center select-none">
              Tháng {month + 1} / {year}
            </span>
            <button
              title="Tháng sau"
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-md transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Today Button */}
          <button
            onClick={handleToday}
            className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:border-slate-300 hover:text-slate-800 shadow-sm transition-all"
          >
            Hôm nay
          </button>

          {/* Settings Button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 text-slate-400 bg-white border border-slate-200 rounded-lg hover:border-slate-300 hover:text-slate-600 shadow-sm transition-colors"
            title="Cấu hình lịch trình"
          >
            <Settings size={18} />
          </button>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-500">
          {/* You can add route stats here later if needed */}
        </div>
      </div>

      {/* Grid Content */}
      <div className="flex-1 overflow-y-auto pr-2">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {days.map((day) => {
            const isToday = new Date().toDateString() === day.toDateString();
            const dateStr = day.toISOString().split("T")[0];

            // Filter trips for this day
            const dayTrips = trips.filter((t) => {
              const tDate = new Date(t.departureTime.split(" ")[0]);
              return isSameDay(tDate, day);
            });

            return (
              <Card
                key={day.toISOString()}
                className={`flex flex-col h-full shadow-sm hover:shadow-md transition-shadow bg-white ${
                  isToday
                    ? "border-primary ring-1 ring-primary/20"
                    : "border-slate-200"
                }`}
              >
                <CardHeader className="p-3 py-1.5 border-b border-slate-100 bg-slate-50/50 rounded-t-lg">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-slate-700">
                        {day.getDate()}
                      </span>
                      <span className="text-xs uppercase font-medium text-slate-500">
                        {daysOfWeek[day.getDay()]}
                      </span>
                    </div>

                    <span className="text-[10px] text-slate-500 font-medium bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      {formatLunarDate(day).replace(" ÂL", "")}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-3 flex-1 flex flex-col gap-4">
                  {activeRoutes.map((route) => {
                    const outboundTrips = dayTrips.filter(
                      (t) =>
                        (t.routeId === route.id ||
                          (!t.routeId && t.route === route.name)) &&
                        t.direction === "outbound",
                    );
                    const inboundTrips = dayTrips.filter(
                      (t) =>
                        (t.routeId === route.id ||
                          (!t.routeId && t.route === route.name)) &&
                        t.direction === "inbound",
                    );

                    // const hasTrips = outboundTrips.length > 0 || inboundTrips.length > 0;
                    // if (!hasTrips) return null; // Optional: Hide routes with no trips if desired, or keep as is. User didn't specify hiding.
                    // Actually, current code shows activeRoutes. Let's keep showing them but maybe cleaner if empty.
                    // Wait, the user didn't ask to hide empty routes. I'll just add the header.

                    return (
                      <div
                        key={route.id}
                        className="border border-slate-100 rounded-md p-2 bg-slate-50/50"
                      >
                        {/* Route Header */}
                        <div className="flex items-center gap-1 text-[11px] font-bold text-slate-800 mb-2 pb-1 border-b border-slate-100 uppercase tracking-tight group/zap cursor-pointer">
                          <span className="truncate">{route.name}</span>
                          {route.isEnhanced && (
                            <div className="relative flex items-center">
                              <Zap
                                size={12}
                                className="text-amber-500 fill-amber-500"
                              />
                              <span className="absolute left-full ml-1 hidden group-hover/zap:inline-block whitespace-nowrap bg-amber-100 text-amber-700 text-[9px] px-1 py-0.5 rounded border border-amber-200 normal-case font-medium z-10">
                                Tăng cường
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-1">
                          {/* Outbound */}
                          <div className="border-r border-slate-100 pr-1">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-1.5">
                                <span className="flex items-center gap-1 text-[10px] font-normal text-zinc-500 uppercase">
                                  <ArrowRight size={8} />
                                  Chiều đi
                                </span>
                                {route.departureTime && (
                                  <span className="text-[10px] text-slate-400">
                                    ({route.departureTime.slice(0, 5)})
                                  </span>
                                )}
                              </div>
                              <button
                                title="Thêm chuyến"
                                onClick={() =>
                                  handleOpenAdd(day, String(route.id))
                                }
                                className="text-slate-400 hover:text-primary transition-colors"
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                            <div className="space-y-1">
                              {outboundTrips.length > 0 ? (
                                outboundTrips.map((trip) => (
                                  <div
                                    key={trip.id}
                                    onClick={() => handleEditTrip(trip)}
                                    className="group/trip text-[10px] font-bold text-slate-700 bg-indigo-50/50 border border-indigo-100 rounded px-1.5 py-1 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50 transition-all flex items-center gap-1.5 relative pr-5"
                                  >
                                    <div className="w-1 h-2.5 bg-indigo-300 rounded-full shrink-0"></div>
                                    <span className="truncate">
                                      {trip.licensePlate}
                                    </span>
                                    <button
                                      title="Xóa chuyến"
                                      onClick={(e) =>
                                        handleDeleteClick(e, trip.id)
                                      }
                                      className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded hidden group-hover/trip:block transition-all"
                                    >
                                      <X size={10} />
                                    </button>
                                  </div>
                                ))
                              ) : (
                                <div className="text-[10px] text-slate-300 italic px-1.5 py-1 border border-transparent flex items-center">
                                  -
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Inbound */}
                          <div className="pl-1">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-1.5">
                                <span className="flex items-center gap-1 text-[10px] font-normal text-zinc-500 uppercase">
                                  <ArrowLeft size={8} />
                                  Chiều về
                                </span>
                                {route.returnTime && (
                                  <span className="text-[10px] text-slate-400">
                                    ({route.returnTime.slice(0, 5)})
                                  </span>
                                )}
                              </div>
                              <button
                                title="Thêm chuyến"
                                onClick={() =>
                                  handleOpenAdd(day, String(route.id))
                                }
                                className="text-slate-400 hover:text-primary transition-colors"
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                            <div className="space-y-1">
                              {inboundTrips.length > 0 ? (
                                inboundTrips.map((trip) => (
                                  <div
                                    key={trip.id}
                                    onClick={() => handleEditTrip(trip)}
                                    className="group/trip text-[10px] font-bold text-slate-700 bg-orange-50/50 border border-orange-100 rounded px-1.5 py-1 cursor-pointer hover:border-orange-300 hover:bg-orange-50 transition-all flex items-center gap-1.5 relative pr-5"
                                  >
                                    <div className="w-1 h-2.5 bg-orange-500 rounded-full shrink-0"></div>
                                    <span className="truncate">
                                      {trip.licensePlate}
                                    </span>
                                    <span className="ml-auto text-slate-400 font-normal">
                                      {formatTime(trip.departureTime)}
                                    </span>
                                    <button
                                      title="Xóa chuyến"
                                      onClick={(e) =>
                                        handleDeleteClick(e, trip.id)
                                      }
                                      className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded hidden group-hover/trip:block transition-all"
                                    >
                                      <X size={10} />
                                    </button>
                                  </div>
                                ))
                              ) : (
                                <div className="text-[10px] text-slate-300 italic px-1.5 py-1 border border-transparent flex items-center">
                                  -
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <AddTripModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        targetDate={selectedDateForAdd}
        preSelectedRouteId={preSelectedRouteId}
        initialData={editingTrip}
        existingTrips={trips}
        routes={routes}
        buses={buses}
        onSave={handleSaveTrip}
      />

      <AlertDialog
        open={!!deletingTripId}
        onOpenChange={(open) => !open && setDeletingTripId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa chuyến xe</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa chuyến này không? Hành động này không
              thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ScheduleSetting
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSettingsChange={setSettings}
        onSave={handleSaveSettings}
        currentMonthDate={currentDate}
      />
    </div>
  );
};
