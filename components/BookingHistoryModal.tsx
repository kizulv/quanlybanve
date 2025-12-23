
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
        // Sắp xếp theo thứ tự thời gian TĂNG DẦN (Cũ nhất lên đầu)
        const sorted = [...data].sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
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
      case "PASSENGER_UPDATE":
        return {
          icon: <UserCog size={14} />,
          color: "orange",
          label: "Khách hàng",
        };
      case "PAY_SEAT":
        return { icon: <Banknote size={14} />, color: "green", label: "Thu tiền" };
      case "REFUND_SEAT":
        return { icon: <RotateCcw size={14} />, color: "red", label: "Hoàn vé" };
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
    if ((log.action === "CREATE" || log.action === "DELETE" || log.action === "CANCEL") && details.trips) {
      const isCancelled = log.action === "DELETE" || log.action === "CANCEL";
      return (
        <div className={`space-y-3 mb-4 ${isCancelled ? "opacity-60" : ""}`}>
          {details.trips.map((trip: any, idx: number) => (
            <div
              key={idx}
              className={`text-sm border-b border-slate-100 border-dashed last:border-b-0 pb-3 last:pb-0`}
            >
              <div className="flex items-center gap-3 mb-3">
                <span className={`flex items-center font-black text-slate-800 ${isCancelled ? "line-through text-slate-400" : ""}`}>
                  <MapPin size={13} className="text-slate-600 mr-1" />{" "}
                  {trip.route}
                </span>
                <span className="flex items-center text-xs text-slate-400 tracking-tight ">
                  <CalendarIcon size={11} className="mr-1" /> {trip.tripDate}
                </span>
                <span className={`bg-yellow-200 border border-yellow-300 rounded-full flex items-center h-5 px-2 text-[10px] text-slate-900 tracking-widest font-semibold ${isCancelled ? "grayscale opacity-50" : ""}`}>
                  {trip.licensePlate}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {trip.seats.map((s: string) => (
                  <Badge
                    key={s}
                    className={`${
                      isCancelled 
                        ? "bg-red-50 text-red-400 border-red-100 line-through" 
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

    // 2. CẬP NHẬT ĐƠN (HÀNH ĐỘNG SỬA VÉ)
    if (log.action === "UPDATE" && details.changes) {
      return (
        <div className="space-y-2 mt-2">
          {details.changes.map((change: any, idx: number) => (
            <div
              key={idx}
              className="bg-blue-50/30 p-3 rounded-xl border border-blue-100 text-xs"
            >
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-blue-50">
                <MapPin size={12} className="text-blue-500" />
                <span className="font-black text-slate-800 tracking-tight">
                  {change.route}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-bold mb-3 flex items-center gap-1 uppercase">
                <Calendar size={10} /> {formatDate(change.date)}
              </div>

              <div className="space-y-2">
                {change.added && change.added.length > 0 && (
                  <div className="flex items-start gap-3">
                    <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded min-w-[45px] text-center">
                      Thêm
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {change.added.map((s: string) => (
                        <span
                          key={s}
                          className="bg-white text-emerald-700 px-2 py-0.5 rounded-lg border border-emerald-200 font-black text-[11px] shadow-xs"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {change.removed && change.removed.length > 0 && (
                  <div className="flex items-start gap-3">
                    <span className="text-[10px] font-black uppercase text-red-600 bg-red-50 px-1.5 py-0.5 rounded min-w-[45px] text-center">
                      Bỏ
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {change.removed.map((s: string) => (
                        <span
                          key={s}
                          className="bg-white text-red-400 px-2 py-0.5 rounded-lg border border-red-200 line-through decoration-red-300 font-bold text-[11px] opacity-70 shadow-xs"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      );
    }

    // 3. ĐỔI CHỖ GHẾ
    if (log.action === "SWAP" && details.from && details.to) {
      return (
        <div className="mt-2 bg-purple-50/50 p-4 rounded-xl border border-purple-100 text-xs">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-purple-100/50">
            <MapPin size={12} className="text-purple-500" />
            <span className="font-black text-purple-900 tracking-tight">
              {details.route}
            </span>
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
          <div className="text-[10px] text-purple-400 font-bold mt-4 flex items-center justify-center gap-1">
            <Calendar size={10} /> {formatDate(details.date)}
          </div>
        </div>
      );
    }

    // 4. CẬP NHẬT THÔNG TIN KHÁCH HÀNG
    if (log.action === "PASSENGER_UPDATE") {
      return (
        <div className="mt-2 text-xs bg-orange-50/50 p-4 rounded-xl border border-orange-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-xs opacity-60">
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                Thông tin cũ
              </div>
              <div className="flex flex-col gap-1">
                <div className="font-bold text-slate-600 flex items-center gap-1.5">
                  <User size={10} /> {details.oldName || "---"}
                </div>
                <div className="text-slate-500 font-mono text-[10px] flex items-center gap-1.5">
                  <Phone size={10} /> {details.oldPhone || "---"}
                </div>
              </div>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-orange-200 shadow-sm ring-2 ring-orange-500/5">
              <div className="text-[9px] font-black text-orange-400 uppercase tracking-widest mb-1.5">
                Thông tin mới
              </div>
              <div className="flex flex-col gap-1">
                <div className="font-black text-orange-900 flex items-center gap-1.5">
                  <User size={10} /> {details.newName || "---"}
                </div>
                <div className="text-orange-700 font-mono text-[10px] font-black flex items-center gap-1.5">
                  <Phone size={10} /> {details.newPhone || "---"}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // 5. THANH TOÁN HOẶC HOÀN VÉ LẺ (HỖ TRỢ HIỂN THỊ DẤU GẠCH NGANG CHO GHẾ HOÀN)
    if (log.action === "PAY_SEAT" || log.action === "REFUND_SEAT") {
        const isRefund = log.action === "REFUND_SEAT";
        return (
            <div className={`mt-2 p-3 rounded-xl border ${isRefund ? "bg-red-50/50 border-red-100" : "bg-green-50/50 border-green-100"}`}>
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg ${isRefund ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                            {details.seat || "Ghế lẻ"}
                        </span>
                        <span className={`text-sm font-black ${isRefund ? "text-red-600 line-through" : "text-green-600"}`}>
                            {isRefund ? "-" : "+"}{details.amount?.toLocaleString("vi-VN")} đ
                        </span>
                    </div>
                    {isRefund && <AlertCircle size={14} className="text-red-400" />}
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
      title="Lịch sử đặt vé"
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
                Tổng số vé:
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
            <p className="font-medium">Đang tải lịch sử hoạt động...</p>
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
                const isLatest = idx === arr.length - 1;
                const colorClasses = {
                  emerald: "bg-emerald-500",
                  red: "bg-red-500",
                  blue: "bg-blue-500",
                  purple: "bg-purple-500",
                  orange: "bg-orange-500",
                  slate: "bg-slate-500",
                  green: "bg-green-600",
                }[theme.color];

                return (
                  <div
                    key={log.id}
                    className="relative pl-6 animate-in slide-in-from-left duration-300"
                  >
                    {/* Timeline Dot */}
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
                              : (log.action === "DELETE" || log.action === "CANCEL" || log.action === "REFUND_SEAT")
                              ? "bg-red-50 text-red-700 border-red-200"
                              : log.action === "UPDATE"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : log.action === "SWAP"
                              ? "bg-purple-50 text-purple-700 border-purple-200"
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
                        <div className="bg-slate-50/80 px-3 py-2 rounded-md border border-slate-100 text-xs text-slate-600 flex items-center group/note relative transition-all hover:bg-white">
                          <div className="w-full flex justify-between items-center gap-4">
                            <span
                              className={`flex-1 ${
                                !log.description
                                  ? "italic text-slate-400"
                                  : "font-semibold text-slate-700"
                              }`}
                            >
                              {log.description || "(Không có ghi chú)"}
                            </span>
                          </div>
                        </div>
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
