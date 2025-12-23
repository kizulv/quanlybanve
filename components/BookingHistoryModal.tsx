import React, { useState, useEffect, useMemo } from "react";
import { Dialog } from "./ui/Dialog";
import { Button } from "./ui/Button";
import { api } from "../lib/api";
import { Booking, BookingHistory } from "../types";
import {
  History,
  Loader2,
  Plus,
  Trash2,
  Edit,
  ArrowRightLeft,
  UserCog,
  FileClock,
  Calendar,
  AlertCircle,
  MapPin,
  ArrowRight,
  User,
  Phone,
  Clock,
  Info,
  Zap,
  CalendarIcon,
  Banknote,
  RotateCcw,
  Truck,
  Bus,
} from "lucide-react";
import { Badge } from "./ui/Badge";

interface BookingHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
}

export const BookingHistoryModal: React.FC<BookingHistoryModalProps> = ({
  isOpen,
  onClose,
  booking,
}) => {
  const [history, setHistory] = useState<BookingHistory[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchHistory = async (id: string) => {
      setLoading(true);
      try {
        const data = await api.bookings.getHistory(id);
        // Sắp xếp theo thứ tự thời gian GIẢM DẦN (Mới nhất lên đầu)
        const sorted = [...data].sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        setHistory(sorted);
      } catch (error) {
        console.error("Failed to load history", error);
      } finally {
        setLoading(false);
      }
    };

    if (isOpen && booking) {
      fetchHistory(booking.id);
    }
  }, [isOpen, booking]);

  const getActionTheme = (action: string) => {
    switch (action) {
      case "CREATE":
        return { icon: <Plus size={14} />, color: "emerald", label: "Tạo đơn" };
      case "DELETE":
      case "CANCEL":
        return { icon: <Trash2 size={14} />, color: "red", label: "Hủy đơn" };
      case "UPDATE":
        return { icon: <Edit size={14} />, color: "blue", label: "Cập nhật" };
      case "SWAP":
        return {
          icon: <ArrowRightLeft size={14} />,
          color: "purple",
          label: "Đổi chỗ",
        };
      case "TRANSFER":
        return {
          icon: <Truck size={14} />,
          color: "indigo",
          label: "Điều chuyển",
        };
      case "PASSENGER_UPDATE":
        return {
          icon: <UserCog size={14} />,
          color: "orange",
          label: "Khách hàng",
        };
      case "PAY_SEAT":
        return {
          icon: <Banknote size={14} />,
          color: "green",
          label: "Thu tiền",
        };
      case "REFUND_SEAT":
        return {
          icon: <RotateCcw size={14} />,
          color: "red",
          label: "Hoàn vé",
        };
      default:
        return {
          icon: <FileClock size={14} />,
          color: "slate",
          label: "Hệ thống",
        };
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return (
        date.toLocaleDateString("vi-VN") +
        " " +
        date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
      );
    } catch (e) {
      return dateStr;
    }
  };

  const renderDetails = (log: BookingHistory) => {
    const details = log.details || {};

    // 1. TẠO MỚI HOẶC HỦY TOÀN BỘ ĐƠN
    if (
      (log.action === "CREATE" ||
        log.action === "DELETE" ||
        log.action === "CANCEL") &&
      details.trips
    ) {
      const isCancelled = log.action === "DELETE" || log.action === "CANCEL";
      return (
        <div className={`space-y-3 mb-4 ${isCancelled ? "opacity-60" : ""}`}>
          {details.trips.map((trip: any, idx: number) => (
            <div
              key={idx}
              className={`text-sm border-b border-slate-100 border-dashed last:border-b-0 pb-3 last:pb-0`}
            >
              <div className="flex items-center gap-3 mb-3">
                <span
                  className={`flex items-center font-black text-slate-800 ${
                    isCancelled ? "line-through text-slate-400" : ""
                  }`}
                >
                  <MapPin size={13} className="text-slate-600 mr-1" />{" "}
                  {trip.route}
                </span>
                <span
                  className={`bg-yellow-200 border border-yellow-300 rounded-full flex items-center h-5 px-2 text-[10px] text-slate-900 tracking-widest font-semibold ${
                    isCancelled ? "grayscale opacity-50" : ""
                  }`}
                >
                  {trip.licensePlate}
                </span>
                <span className="flex items-center text-xs text-slate-400 tracking-tight ml-auto">
                  <CalendarIcon size={11} className="mr-1 mb-[1px]" />{" "}
                  {formatDate(trip.tripDate)}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {trip.seats.map((s: string) => (
                  <Badge
                    key={s}
                    className={`${
                      isCancelled
                        ? "bg-red-50 text-red-400 border-red-100 line-through decoration-red-300"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    } text-[10px] font-black px-2 py-0.5 rounded-lg`}
                  >
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }

    // 2. CẬP NHẬT ĐƠN (GỘP CHUNG GHẾ CÒN LẠI VÀ GHẾ BỊ HỦY)
    if (log.action === "UPDATE" && details.changes) {
      return (
        <div className="">
          {details.changes.map((change: any, idx: number) => {
            const hasKept = change.kept && change.kept.length > 0;
            const hasRemoved = change.removed && change.removed.length > 0;
            const hasAdded = change.added && change.added.length > 0;

            return (
              <div key={idx} className="space-y-3 mb-4">
                <div className="text-sm border-b border-slate-100 border-dashed last:border-b-0 pb-3 last:pb-0">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="flex items-center font-black text-slate-800">
                      <MapPin size={12} className="mr-1" />
                      {change.route}
                    </span>
                    <span className="flex items-center text-xs text-slate-400 tracking-tight ml-auto ">
                      <CalendarIcon size={11} className="mr-1 mb-[1px]" />{" "}
                      {formatDate(change.date)}
                    </span>
                  </div>

                  <div className="flex items-center mb-4">
                    {(hasKept || hasRemoved) && (
                      <div className="flex flex-wrap gap-2">
                        {change.kept?.map((s: string) => (
                          <Badge
                            key={s}
                            className="bg-green-50 text-slate-700 border-green-200 font-bold text-[10px] px-2 py-1 shadow-xs"
                          >
                            {s}
                          </Badge>
                        ))}
                        <div className="flex items-center">
                          {hasRemoved && hasKept && (
                            <span className="mx-4 text-slate-300"> - </span>
                          )}
                          <div className="flex flex-wrap gap-2">
                            {change.removed?.map((s: string) => (
                              <Badge
                                key={s}
                                className="bg-red-50 text-red-400 border-red-100 line-through decoration-red-300 font-bold text-[10px] px-2 py-1 opacity-70"
                              >
                                {s}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {hasAdded && (
                      <div className="flex items-center">
                        <span className="mx-4 text-slate-300">+</span>
                        <div className="flex flex-wrap gap-2">
                          {change.added.map((s: string) => (
                            <Badge
                              key={s}
                              className="bg-emerald-50 text-emerald-700 border-emerald-200 font-black text-[10px] px-2 py-1 shadow-sm ring-1 ring-emerald-500/10"
                            >
                              {s}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    // 3. ĐỔI CHỖ GHẾ
    if (log.action === "SWAP" && details.from && details.to) {
      return (
        <div className="space-y-3 mb-4">
          <div className="text-sm border-b border-slate-100 border-dashed last:border-b-0 pb-3 last:pb-0">
            <div className="flex items-center gap-2 mb-3 pb-2">
              <span className="flex items-center font-black text-purple-900">
                <MapPin size={12} className="text-purple-500 mr-1" />
                {details.route}
              </span>
              <div className="flex items-center text-xs text-slate-400 tracking-tight ml-auto">
                <CalendarIcon size={11} className="mr-1 mb-[1px]" />{" "}
                {formatDate(details.date)}
              </div>
            </div>
            <div className="flex items-center justify-center gap-4 py-1">
              <div className="flex flex-col items-center gap-1">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                  Từ ghế
                </span>
                <span className="font-black text-slate-500 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs text-sm min-w-[45px] text-center">
                  {details.from}
                </span>
              </div>
              <div className="p-2 bg-purple-100 rounded-full text-purple-600 shadow-sm mt-4">
                <ArrowRight size={14} className="animate-pulse" />
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-[9px] font-black text-purple-400 uppercase tracking-tighter">
                  Sang ghế
                </span>
                <span className="font-black text-purple-700 bg-white px-3 py-1.5 rounded-xl border border-purple-300 shadow-md text-sm min-w-[45px] text-center">
                  {details.to}
                </span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // 4. ĐIỀU CHUYỂN XE (TRANSFER)
    if (log.action === "TRANSFER") {
      return (
        <div className="mt-2 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 text-xs">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-indigo-100/50">
            <div className="flex items-center gap-2">
              <Truck size={14} className="text-indigo-500" />
              <span className="font-black text-indigo-900 uppercase">
                Điều chuyển xe
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 bg-white p-3 rounded-lg border border-slate-100 shadow-xs opacity-60">
                <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">
                  Xe gốc
                </div>
                <div className="font-bold text-slate-700 flex items-center gap-1.5">
                  <Bus size={12} /> {details.fromPlate}
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {details.fromRoute}
                </div>
              </div>
              <div className="p-2 bg-indigo-100 rounded-full text-indigo-600 shadow-sm shrink-0">
                <ArrowRight
                  size={16}
                  className="animate-in slide-in-from-left-2 infinite duration-1000"
                />
              </div>
              <div className="flex-1 bg-white p-3 rounded-lg border border-indigo-200 shadow-sm">
                <div className="text-[9px] font-bold text-indigo-400 uppercase mb-1">
                  Xe mới
                </div>
                <div className="font-black text-indigo-800 flex items-center gap-1.5">
                  <Bus size={12} /> {details.toPlate}
                </div>
                <div className="text-[10px] text-indigo-600 truncate">
                  {details.toRoute}
                </div>
              </div>
            </div>
            <div className="pt-2">
              <div className="text-[9px] font-bold text-slate-400 uppercase mb-2">
                Danh sách ghế điều chuyển
              </div>
              <div className="flex flex-wrap gap-1.5">
                {details.seats?.map((s: string) => (
                  <Badge
                    key={s}
                    className="bg-indigo-600 text-white border-transparent text-[10px] font-bold px-2 py-0.5"
                  >
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Lịch sử hoạt động"
      className="max-w-[700px]"
      headerClassName="px-4 h-[40px] border-b flex items-center justify-between shrink-0 rounded-t-xl bg-gradient-to-r from-indigo-950 via-indigo-900 to-indigo-950 text-white text-sm font-semibold"
    >
      <div className="space-y-5 max-h-[75vh] overflow-y-auto">
        {booking && (
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sticky top-0 z-20 bg-white px-4 border-b border-slate-200 shadow-sm py-1">
            <div className="flex items-center gap-1">
              <Phone size={16} className="text-slate-600 mr-1 pr-0" />{" "}
              <span className="text-lg font-semibold text-slate-900">
                {booking.passenger.phone}
              </span>
            </div>
            <div className="text-right py-2.5 flex items-center justify-center min-w-[140px]">
              <span className="ml-2 text-lg font-bold tracking-tight">
                Tổng số vé hiện tại:
              </span>
              <span className="ml-2 text-lg font-bold text-green-700 tracking-tight">
                {booking.totalTickets} vé
              </span>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Loader2 className="animate-spin mb-4" size={48} />
            <p className="font-medium">Đang tải lịch sử...</p>
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-20 text-slate-400 animate-in fade-in duration-500">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed border-slate-200">
              <FileClock size={32} className="opacity-20" />
            </div>
            <p className="font-bold text-slate-500">
              Chưa có ghi nhận hoạt động
            </p>
          </div>
        ) : (
          <div className="px-4">
            <div className="relative border-l-2 border-slate-200 ml-2 space-y-5 py-4 mb-4">
              {history.map((log, idx, arr) => {
                const theme = getActionTheme(log.action);
                const isLatest = idx === 0;
                const colorClasses = {
                  emerald: "bg-emerald-500",
                  red: "bg-red-500",
                  blue: "bg-blue-500",
                  purple: "bg-purple-500",
                  orange: "bg-orange-500",
                  slate: "bg-slate-500",
                  green: "bg-green-600",
                  indigo: "bg-indigo-600",
                }[theme.color];

                return (
                  <div
                    key={log.id}
                    className="relative pl-6 animate-in slide-in-from-left duration-300"
                  >
                    <div
                      className={`absolute -left-[11px] top-0 w-5 h-5 rounded-full border-4 border-white shadow-md flex items-center justify-center ${colorClasses} ${
                        isLatest ? "ring-4 ring-primary/10" : ""
                      }`}
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                    </div>

                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border shadow-sm flex items-center gap-1.5 
                          ${
                            log.action === "CREATE"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : log.action === "DELETE" ||
                                log.action === "CANCEL" ||
                                log.action === "REFUND_SEAT"
                              ? "bg-red-50 text-red-700 border-red-200"
                              : log.action === "UPDATE"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : log.action === "SWAP"
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : log.action === "TRANSFER"
                              ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                              : log.action === "PASSENGER_UPDATE"
                              ? "bg-orange-50 text-orange-700 border-orange-200"
                              : "bg-green-50 text-green-700 border-green-200"
                          }`}
                          >
                            {theme.icon}
                            {theme.label}
                          </span>
                          <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Clock size={11} />
                            {new Date(log.timestamp).toLocaleString("vi-VN")}
                          </span>
                        </div>
                      </div>

                      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-all group/card relative overflow-hidden">
                        {renderDetails(log)}
                        <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
                          <p
                            className={`text-xs leading-relaxed text-slate-700`}
                          >
                            {log.description || "(Không có mô tả chi tiết)"}
                          </p>
                        </div>

                        {/* Phần Details gốc (JSON) thu nhỏ lại hoặc ẩn đi nếu Description đã đầy đủ */}
                        {!log.description && (
                          <div className="text-[10px] text-slate-400 italic">
                            Thông tin hệ thống đang được xử lý...
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
};
