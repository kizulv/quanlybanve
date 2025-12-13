import React, { useState, useMemo, useEffect } from "react";
import { Bus, BusTrip, Route, BusType } from "../types";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  MapPin,
  Clock,
  Trash2,
  CalendarDays,
  BusFront,
  AlertCircle,
  Zap,
  Edit2,
  ArrowRightLeft,
  AlertTriangle,
  Settings,
  Flower2,
  Calendar,
  Ban,
  Check,
} from "lucide-react";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import {
  getDaysInMonth,
  daysOfWeek,
  formatLunarDate,
  formatTime,
  isSameDay,
} from "../utils/dateUtils";
import { AddTripModal } from "./AddTripModal";
import {
  generateCabinLayout,
  generateSleeperLayout,
} from "../utils/generators";
import { Dialog } from "./ui/Dialog";

interface ScheduleViewProps {
  trips: BusTrip[];
  routes: Route[];
  buses: Bus[];
  onAddTrip: (date: Date, tripData: Partial<BusTrip>) => Promise<void>;
  onUpdateTrip: (tripId: string, tripData: Partial<BusTrip>) => Promise<void>;
  onDeleteTrip: (tripId: string) => Promise<void>;
  onUpdateBus: (busId: string, updates: Partial<Bus>) => Promise<void>;
}

interface ScheduleSettings {
  shutdownStartDate: string;
  shutdownEndDate: string;
  peakDays: string[]; // List of date strings "YYYY-MM-DD"
}

export const ScheduleView: React.FC<ScheduleViewProps> = ({
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
    new Date()
  );
  const [preSelectedRouteId, setPreSelectedRouteId] = useState<string>("");
  const [editingTrip, setEditingTrip] = useState<BusTrip | undefined>(
    undefined
  );

  // State for delete confirmation
  const [tripToDelete, setTripToDelete] = useState<string | null>(null);

  // State for Schedule Settings (Shutdown & Peak)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<ScheduleSettings>({
    shutdownStartDate: "",
    shutdownEndDate: "",
    peakDays: [],
  });

  // Load settings from local storage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem("vinabus_schedule_settings");
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const handleSaveSettings = () => {
    localStorage.setItem("vinabus_schedule_settings", JSON.stringify(settings));
    setIsSettingsOpen(false);
  };

  // Helper to check if a date is within shutdown range
  const isShutdownDay = (date: Date) => {
    if (!settings.shutdownStartDate || !settings.shutdownEndDate) return false;

    const check = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    ).getTime();
    const start = new Date(settings.shutdownStartDate).setHours(0, 0, 0, 0);
    const end = new Date(settings.shutdownEndDate).setHours(0, 0, 0, 0);

    return check >= start && check <= end;
  };

  // Helper to check if a date is marked as peak
  const isPeakDay = (date: Date) => {
    const dateStr = `${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return settings.peakDays.includes(dateStr);
  };

  const togglePeakDay = (date: Date) => {
    const dateStr = `${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const newPeakDays = settings.peakDays.includes(dateStr)
      ? settings.peakDays.filter((d) => d !== dateStr)
      : [...settings.peakDays, dateStr];

    setSettings({ ...settings, peakDays: newPeakDays });
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const days = getDaysInMonth(year, month);

  const displayRoutes = useMemo(() => {
    return routes
      .filter((r) => r.status !== "inactive")
      .sort((a, b) => {
        if (!!a.isEnhanced !== !!b.isEnhanced) return a.isEnhanced ? 1 : -1;
        return 0;
      });
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

  const handleOpenEdit = (trip: BusTrip) => {
    const tripDate = new Date(trip.departureTime.split(" ")[0]);
    setSelectedDateForAdd(tripDate);
    let routeIdToEdit = "";
    if (trip.routeId) {
      routeIdToEdit = String(trip.routeId);
    } else {
      const route = routes.find((r) => r.name === trip.route);
      routeIdToEdit = route ? String(route.id) : "";
    }

    setPreSelectedRouteId(routeIdToEdit);
    setEditingTrip(trip);
    setIsModalOpen(true);
  };

  const handleSaveTrip = async (tripData: Partial<BusTrip>) => {
    if (editingTrip) {
      await onUpdateTrip(editingTrip.id, tripData);
    } else {
      await onAddTrip(selectedDateForAdd, tripData);
    }
  };

  const confirmDelete = async () => {
    if (tripToDelete) {
      await onDeleteTrip(tripToDelete);
      setTripToDelete(null);
    }
  };

  const renderTripItem = (trip: BusTrip, route: Route) => {
    const isReturn = trip.direction === "inbound";
    return (
      <div
        key={trip.id}
        className="group relative flex flex-col items-start gap-2 p-3 rounded-lg border border-slate-200 hover:border-primary/30 hover:bg-slate-50 transition-all bg-white shadow-sm w-1/2 md:w-1/4"
      >
        {/* Header: Time & Direction Badge */}
        <div className="w-full flex justify-between items-start">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="bg-slate-100 text-slate-700 border-slate-200"
            >
              {formatTime(trip.departureTime)}
            </Badge>
          </div>
          <Badge
            variant={isReturn ? "warning" : "default"}
            className={`text-[10px] px-1.5 h-5 ${
              isReturn
                ? "bg-orange-100 text-orange-700 border-orange-200"
                : "bg-blue-100 text-blue-700 border-blue-200"
            }`}
          >
            {isReturn ? "Chiều về" : "Chiều đi"}
          </Badge>
        </div>

        <div className="w-full">
          <div className="flex items-center gap-1 mb-1">
            <span className="font-bold text-slate-800 text-sm">
              {trip.licensePlate}
            </span>
          </div>
          <h4
            className="font-medium text-slate-600 text-xs truncate"
            title={trip.name}
          >
            {trip.name}
          </h4>
        </div>

        <div className="w-full flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 mt-1">
          <span className="flex items-center gap-1">
            <MapPin size={12} />{" "}
            {trip.seats.filter((s) => s.status === "available").length} chỗ
          </span>
          <span className="text-[10px] uppercase bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">
            {trip.type === BusType.CABIN ? "Phòng" : "Giường"}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur rounded p-1 border border-slate-100 shadow-sm z-10">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-slate-400 hover:text-primary"
            onClick={() => handleOpenEdit(trip)}
            title="Chỉnh sửa"
          >
            <Edit2 size={12} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-slate-400 hover:text-destructive"
            onClick={() => setTripToDelete(trip.id)}
            title="Xóa"
          >
            <Trash2 size={12} />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <CalendarDays className="text-primary" />
          <h2 className="text-lg font-bold text-slate-800 capitalize">
            Lịch chạy xe tháng {month + 1}/{year}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 rounded-lg p-1">
            <button
              title="Tháng trước"
              onClick={handlePrevMonth}
              className="p-2 hover:bg-white hover:shadow-sm rounded-md transition-all text-slate-600"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              title="Hôm nay"
              onClick={handleToday}
              className="px-4 py-1.5 text-sm font-medium text-slate-600 hover:text-primary"
            >
              Hôm nay
            </button>
            <button
              title="Tháng sau"
              onClick={handleNextMonth}
              className="p-2 hover:bg-white hover:shadow-sm rounded-md transition-all text-slate-600"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <Button
            variant="outline"
            size="icon"
            className="bg-white border-slate-200 text-slate-600 hover:text-primary hover:border-primary/50"
            onClick={() => setIsSettingsOpen(true)}
            title="Cấu hình lịch nghỉ/Cao điểm"
          >
            <Settings size={20} />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {days.map((day) => {
          const isToday = new Date().toDateString() === day.toDateString();
          const isShutdown = isShutdownDay(day);
          const isPeak = isPeakDay(day);

          return (
            <div
              key={day.toISOString()}
              className={`
                flex flex-col md:flex-row rounded-xl border transition-all 
                ${isToday ? "ring-1 ring-primary/20 shadow-sm" : ""}
                ${
                  isShutdown
                    ? "bg-red-50/40 border-red-200"
                    : isPeak
                    ? "bg-orange-50/40 border-orange-200"
                    : "bg-white border-slate-200"
                }
              `}
            >
              <div
                className={`
                md:w-36 p-4 flex flex-row md:flex-col justify-between md:justify-center items-center md:items-start gap-2 border-b md:border-b-0 md:border-r relative overflow-hidden
                ${
                  isShutdown
                    ? "border-red-100 bg-red-50"
                    : isPeak
                    ? "border-orange-100 bg-orange-50"
                    : "border-slate-100 bg-white"
                }
              `}
              >
                <div className="flex items-center gap-3 md:block relative z-10 w-full">
                  <div className="flex flex-col items-center md:items-center w-full">
                    <span
                      className={`text-3xl font-bold ${
                        isShutdown
                          ? "text-red-500"
                          : isPeak
                          ? "text-orange-500"
                          : isToday
                          ? "text-primary"
                          : "text-slate-700"
                      }`}
                    >
                      {day.getDate()}
                    </span>
                    <span
                      className={`text-xs font-bold uppercase tracking-wide ${
                        isShutdown
                          ? "text-red-400"
                          : isPeak
                          ? "text-orange-400"
                          : "text-slate-400"
                      }`}
                    >
                      {daysOfWeek[day.getDay()]}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full justify-center relative z-10">
                  <Badge
                    variant="secondary"
                    className={`font-normal text-[10px] px-1.5 ${
                      isShutdown
                        ? "bg-red-100 text-red-600"
                        : isPeak
                        ? "bg-orange-100 text-orange-600"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {formatLunarDate(day)}
                  </Badge>
                </div>

                {/* Visual Indicators */}
                {isShutdown && (
                  <div className="mt-2 w-full flex flex-col items-center">
                    <div className="text-[10px] font-bold text-red-600 uppercase border border-red-200 bg-red-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Ban size={10} /> Nghỉ Tết
                    </div>
                  </div>
                )}
                {isPeak && !isShutdown && (
                  <div className="mt-2 w-full flex flex-col items-center">
                    <div className="text-[10px] font-bold text-orange-600 uppercase border border-orange-200 bg-orange-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Zap size={10} className="fill-orange-600" /> Cao điểm
                    </div>
                  </div>
                )}
              </div>

              <div className="flex-1 p-4 space-y-4 relative">
                {isShutdown && (
                  <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center backdrop-blur-[1px] rounded-r-xl">
                    <div className="text-red-300 font-bold text-4xl -rotate-12 select-none border-4 border-red-200 p-4 rounded-xl opacity-50">
                      NGHỈ TẾT NGUYÊN ĐÁN
                    </div>
                  </div>
                )}

                {displayRoutes.map((route) => {
                  // Filter and Sort Trips
                  const routeTrips = trips
                    .filter((t) => {
                      const tDate = new Date(t.departureTime.split(" ")[0]);
                      const isSameDayCheck = isSameDay(tDate, day);
                      if (!isSameDayCheck) return false;
                      if (t.routeId && route.id)
                        return String(t.routeId) === String(route.id);
                      return t.route === route.name;
                    })
                    .sort((a, b) => {
                      const dirA = a.direction === "inbound" ? 1 : 0;
                      const dirB = b.direction === "inbound" ? 1 : 0;
                      if (dirA !== dirB) return dirA - dirB;
                      return a.departureTime.localeCompare(b.departureTime);
                    });

                  const isLimitReached =
                    !route.isEnhanced && routeTrips.length >= 2;

                  return (
                    <div
                      key={`${route.id}-${day.getDate()}`}
                      className={`rounded-xl border p-3 ${
                        isShutdown
                          ? "opacity-50"
                          : isPeak
                          ? "bg-white border-orange-100"
                          : "bg-slate-50/30 border-slate-100"
                      }`}
                    >
                      {/* Route Title with Action */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-bold text-sm ${
                              route.isEnhanced
                                ? "text-yellow-700"
                                : "text-slate-800"
                            }`}
                          >
                            {route.name}
                          </span>
                          {route.isEnhanced && (
                            <Badge
                              variant="warning"
                              className="text-[10px] px-1 h-5"
                            >
                              Tăng cường
                            </Badge>
                          )}
                        </div>

                        {!isLimitReached && !isShutdown ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-primary hover:bg-primary/10 hover:text-primary"
                            onClick={() => handleOpenAdd(day, String(route.id))}
                          >
                            <Plus size={14} className="mr-1" /> Thêm xe
                          </Button>
                        ) : isShutdown ? (
                          <span className="text-[10px] text-red-400 font-medium px-2">
                            Đã khóa
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic px-2">
                            Đã đủ chuyến
                          </span>
                        )}
                      </div>

                      {/* Horizontal Trip List */}
                      {routeTrips.length > 0 ? (
                        <div className="flex flex-wrap gap-3">
                          {routeTrips.map((t) => renderTripItem(t, route))}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 italic pl-1">
                          Chưa có chuyến nào
                        </div>
                      )}
                    </div>
                  );
                })}

                {displayRoutes.length === 0 && (
                  <div className="text-center py-8 text-slate-400 text-sm">
                    Chưa có tuyến đường nào được cấu hình.
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div className="h-10"></div>
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

      {/* Delete Confirmation Dialog */}
      <Dialog
        isOpen={!!tripToDelete}
        onClose={() => setTripToDelete(null)}
        title="Xác nhận xóa"
      >
        <div className="flex flex-col items-center justify-center p-4 text-center space-y-4">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3 className="text-lg font-medium text-slate-900">
              Bạn có chắc chắn muốn xóa chuyến xe này?
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Hành động này không thể hoàn tác. Các dữ liệu liên quan đến vé đã
              đặt cũng sẽ bị xóa.
            </p>
          </div>
          <div className="flex gap-3 w-full mt-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setTripToDelete(null)}
            >
              Hủy bỏ
            </Button>
            <Button
              variant="destructive"
              className="w-full"
              onClick={confirmDelete}
            >
              Xóa ngay
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Settings Dialog (Tet & Peak) */}
      <Dialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        title="Cấu hình lịch trình"
        className="max-w-2xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>
              Đóng
            </Button>
            <Button onClick={handleSaveSettings}>Lưu cấu hình</Button>
          </>
        }
      >
        <div className="space-y-6 py-2">
          {/* Section 1: Shutdown Range */}
          <div className="space-y-3">
            <div className="bg-red-50 p-3 rounded-lg border border-red-100 flex gap-3 items-start">
              <div className="bg-red-100 p-2 rounded-full text-red-600">
                <Ban size={18} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-red-800">
                  Lịch Ngưng Hoạt Động (Nghỉ Tết)
                </h4>
                <p className="text-xs text-red-600 mt-1">
                  Chọn khoảng thời gian toàn bộ hệ thống ngưng hoạt động. Trong
                  những ngày này,{" "}
                  <strong>không thể thêm chuyến hoặc đặt vé</strong>.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 px-2">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                  Từ ngày
                </label>
                <input
                  title="Chọn ngày bắt đầu nghỉ Tết"
                  type="date"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none text-sm"
                  value={settings.shutdownStartDate}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      shutdownStartDate: e.target.value,
                    })
                  }
                />
                <div className="text-[11px] text-slate-500 mt-1.5 pl-1 italic flex items-center gap-1">
                  <Flower2 size={10} className="text-red-400" />
                  {settings.shutdownStartDate
                    ? `Âm lịch: ${formatLunarDate(
                        new Date(settings.shutdownStartDate)
                      )}`
                    : "--"}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                  Đến ngày
                </label>
                <input
                  title="Chọn ngày kết thúc nghỉ Tết"
                  type="date"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none text-sm"
                  value={settings.shutdownEndDate}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      shutdownEndDate: e.target.value,
                    })
                  }
                />
                <div className="text-[11px] text-slate-500 mt-1.5 pl-1 italic flex items-center gap-1">
                  <Flower2 size={10} className="text-red-400" />
                  {settings.shutdownEndDate
                    ? `Âm lịch: ${formatLunarDate(
                        new Date(settings.shutdownEndDate)
                      )}`
                    : "--"}
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 my-4"></div>

          {/* Section 2: Peak Days Selection */}
          <div className="space-y-3">
            <div className="bg-orange-50 p-3 rounded-lg border border-orange-100 flex gap-3 items-start">
              <div className="bg-orange-100 p-2 rounded-full text-orange-600">
                <Zap size={18} className="fill-orange-600" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-orange-800">
                  Cấu hình Ngày Cao Điểm
                </h4>
                <p className="text-xs text-orange-700 mt-1">
                  Chọn các ngày cụ thể là ngày cao điểm. Các ngày này sẽ được
                  đánh dấu màu cam trên lịch trình để dễ dàng nhận biết.
                </p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="font-bold text-slate-700">
                  Chọn ngày cao điểm (Tháng {month + 1}/{year})
                </span>
                <div className="text-xs text-slate-400 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm bg-orange-500"></span>{" "}
                  Đang chọn
                  <span className="w-3 h-3 rounded-sm bg-slate-100 border border-slate-200 ml-2"></span>{" "}
                  Bình thường
                </div>
              </div>

              {/* Simple Month Grid */}
              <div className="grid grid-cols-7 gap-2">
                {["CN", "T2", "T3", "T4", "T5", "T6", "T7"].map((d) => (
                  <div
                    key={d}
                    className="text-center text-xs font-bold text-slate-400 py-1"
                  >
                    {d}
                  </div>
                ))}

                {/* Empty slots for start of month */}
                {Array.from({ length: new Date(year, month, 1).getDay() }).map(
                  (_, i) => (
                    <div key={`empty-${i}`} />
                  )
                )}

                {/* Days */}
                {days.map((d) => {
                  const isPeak = isPeakDay(d);
                  const isShutdown = isShutdownDay(d);
                  return (
                    <button
                      key={d.toISOString()}
                      onClick={() => !isShutdown && togglePeakDay(d)}
                      disabled={isShutdown}
                      className={`
                                        h-12 rounded-lg flex flex-col items-center justify-center border text-sm transition-all relative
                                        ${
                                          isShutdown
                                            ? "bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed"
                                            : isPeak
                                            ? "bg-orange-500 text-white border-orange-600 shadow-sm font-bold"
                                            : "bg-white text-slate-700 border-slate-200 hover:border-orange-300 hover:bg-orange-50"
                                        }
                                    `}
                    >
                      <span className="leading-none">{d.getDate()}</span>
                      <span
                        className={`text-[9px] leading-none mt-1 ${
                          isPeak
                            ? "opacity-80 font-normal"
                            : "text-slate-400 font-medium"
                        }`}
                      >
                        {formatLunarDate(d).replace(" ÂL", "")}
                      </span>
                      {isPeak && (
                        <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-white rounded-full"></div>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-400 mt-3 text-center italic">
                * Bạn đang cấu hình cho tháng {month + 1}/{year}. Đóng bảng này
                và chuyển tháng ở màn hình chính để cấu hình cho tháng khác.
              </p>
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
