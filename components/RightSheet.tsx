import React, { useState, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/Sheet";
import { Button } from "./ui/Button";
import {
  History,
  Phone,
  Clock,
  Search,
  X,
  Calendar,
  Ticket,
  Undo2,
  AlertTriangle,
  FileClock,
  MapPin,
  User,
  ChevronRight,
  Hash,
  Zap,
  PlusCircle,
  RefreshCw,
  ArrowRightLeft,
  Trash2,
  // Added Info icon import to fix the error on line 489
  Info,
} from "lucide-react";
import { Badge } from "./ui/Badge";
import { Booking, BusTrip, UndoAction } from "../types";
import { formatLunarDate, formatTime } from "../utils/dateUtils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/AlertDialog";
import { BookingHistoryModal } from "./BookingHistoryModal";

interface RightSheetProps {
  bookings: Booking[];
  trips: BusTrip[];
  onSelectBooking: (booking: Booking) => void;
  onUndo?: () => void;
  lastUndoAction?: UndoAction;
}

export const RightSheet: React.FC<RightSheetProps> = ({
  bookings,
  trips,
  onSelectBooking,
  onUndo,
  lastUndoAction,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isUndoAlertOpen, setIsUndoAlertOpen] = useState(false);

  const [viewHistoryBooking, setViewHistoryBooking] = useState<Booking | null>(
    null
  );

  const sortedBookings = useMemo(() => {
    return [...bookings].sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.createdAt).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt).getTime();
      return timeB - timeA;
    });
  }, [bookings]);

  const filteredList = useMemo(() => {
    // Lọc bỏ các đơn hàng trạng thái 'hold' theo yêu cầu
    const baseList = sortedBookings.filter((b) => b.status !== "hold");

    if (!searchTerm.trim()) return baseList;

    const lowerTerm = searchTerm.toLowerCase();
    return baseList.filter((booking) => {
      const itemMatch = booking.items.some(
        (item) =>
          item.route.toLowerCase().includes(lowerTerm) ||
          item.licensePlate.toLowerCase().includes(lowerTerm) ||
          item.seatIds.some((s) => s.toLowerCase().includes(lowerTerm))
      );
      return (
        booking.passenger.phone.includes(lowerTerm) ||
        (booking.passenger.name || "").toLowerCase().includes(lowerTerm) ||
        itemMatch
      );
    });
  }, [sortedBookings, searchTerm]);

  const listByDate = useMemo(() => {
    const groups: Record<string, Booking[]> = {};
    filteredList.forEach((item) => {
      const date = new Date(item.updatedAt || item.createdAt);
      const dateStr = date.toLocaleDateString("vi-VN", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push(item);
    });
    return groups;
  }, [filteredList]);

  const handleSelect = (booking: Booking) => {
    onSelectBooking(booking);
    setIsOpen(false);
  };

  const handleConfirmUndo = () => {
    if (onUndo) {
      onUndo();
      setIsUndoAlertOpen(false);
    }
  };

  const handleViewHistory = (e: React.MouseEvent, booking: Booking) => {
    e.stopPropagation();
    setViewHistoryBooking(booking);
  };

  // Logic diễn giải hành động hoàn tác
  const renderUndoSummary = () => {
    if (!lastUndoAction) return null;

    switch (lastUndoAction.type) {
      case "CREATED_BOOKING":
        return (
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-emerald-700 font-black text-xs uppercase tracking-wider">
              <PlusCircle size={14} /> Vừa tạo đơn hàng mới
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Phone size={14} className="text-slate-400" />{" "}
                {lastUndoAction.phone}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {lastUndoAction.seatLabels.map((l) => (
                  <Badge
                    key={l}
                    className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] px-1.5 h-4"
                  >
                    {l}
                  </Badge>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-emerald-600/80 font-medium italic border-t border-emerald-100 pt-2">
              Hành động hoàn tác sẽ **XÓA** đơn hàng này và trả lại ghế trống.
            </p>
          </div>
        );
      case "UPDATED_BOOKING":
        return (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-blue-700 font-black text-xs uppercase tracking-wider">
              <RefreshCw size={14} /> Vừa cập nhật đơn hàng
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Phone size={14} className="text-slate-400" />{" "}
                {lastUndoAction.phone}
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                Mã đơn:{" "}
                <span className="font-mono font-bold">
                  #{lastUndoAction.previousBooking.id.slice(-6).toUpperCase()}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-blue-600/80 font-medium italic border-t border-blue-100 pt-2">
              Hành động hoàn tác sẽ khôi phục lại trạng thái (ghế/giá/điểm đón)
              **TRƯỚC KHI SỬA**.
            </p>
          </div>
        );
      case "SWAPPED_SEATS":
        return (
          <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-purple-700 font-black text-xs uppercase tracking-wider">
              <ArrowRightLeft size={14} /> Vừa đổi chỗ ghế
            </div>
            <div className="flex items-center justify-center gap-4 py-1">
              <div className="flex flex-col items-center gap-1">
                <span className="font-black text-slate-500 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs text-sm min-w-[45px] text-center">
                  {lastUndoAction.label1}
                </span>
              </div>
              <ArrowRightLeft size={16} className="text-purple-400" />
              <div className="flex flex-col items-center gap-1">
                <span className="font-black text-purple-700 bg-white px-3 py-1.5 rounded-xl border border-purple-300 shadow-md text-sm min-w-[45px] text-center">
                  {lastUndoAction.label2}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-purple-600/80 font-medium italic border-t border-purple-100 pt-2 text-center">
              Hành động hoàn tác sẽ hoán đổi lại vị trí 2 ghế này.
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  const renderStatusBadge = (status: string) => {
    if (status === "cancelled") {
      return (
        <Badge className="bg-red-50 text-red-600 border-red-100 text-[10px] px-1.5 h-5">
          Hủy vé
        </Badge>
      );
    }
    // Logic hiển thị: payment (hoặc đã trả đủ tiền) -> Mua vé, booking -> Đặt vé
    if (status === "payment") {
      return (
        <Badge className="bg-green-50 text-green-600 border-green-100 text-[10px] px-1.5 h-5">
          Mua vé
        </Badge>
      );
    }
    if (status === "booking") {
      return (
        <Badge className="bg-amber-50 text-amber-600 border-amber-100 text-[10px] px-1.5 h-5">
          Đặt vé
        </Badge>
      );
    }
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="bg-white border-slate-200 text-slate-600 hover:text-primary hover:border-primary/50 shrink-0 shadow-sm transition-all hover:shadow-md"
          >
            <History size={20} />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="right"
          className="flex flex-col h-full w-full p-0 gap-0 border-l shadow-xl bg-white"
        >
          <SheetHeader className="px-6 py-5 border-b border-slate-100 shrink-0 bg-white">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <History size={20} />
                </div>
                <span className="font-bold text-md">Lịch sử đặt vé</span>
              </SheetTitle>

              {onUndo && lastUndoAction && (
                <Button
                  onClick={() => setIsUndoAlertOpen(true)}
                  className="text-white bg-red-500 hover:bg-red-600 border border-red-600 h-8 px-4 rounded-full font-black text-[11px] uppercase tracking-wider mr-5 shadow-lg shadow-red-500/20 animate-in zoom-in duration-300"
                >
                  <Undo2 size={14} className="mr-2" />
                  <span>Hoàn tác</span>
                </Button>
              )}
            </div>
          </SheetHeader>

          <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 shrink-0">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Search
                  size={16}
                  className="text-slate-400 group-focus-within:text-primary transition-colors"
                />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm theo SĐT, tên, tuyến đường..."
                className="w-full pl-10 pr-10 py-2.5 h-8 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary bg-white placeholder-slate-400 shadow-sm transition-all"
              />
              {searchTerm && (
                <button
                  title="Bỏ tìm kiếm"
                  onClick={() => setSearchTerm("")}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-0 bg-slate-50/30">
            {Object.keys(listByDate).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 p-12 text-center">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <Search size={32} className="opacity-20" />
                </div>
                <p className="font-bold text-slate-500">
                  Không tìm thấy dữ liệu
                </p>
                <p className="text-xs mt-1">
                  Hãy thử tìm kiếm với từ khóa khác.
                </p>
              </div>
            ) : (
              <div className="pb-10">
                {(Object.entries(listByDate) as [string, Booking[]][]).map(
                  ([dateStr, items]) => (
                    <div key={dateStr} className="mt-4 first:mt-0">
                      <div className="sticky top-0 z-20 px-6 py-2 bg-slate-100/90 backdrop-blur-md border-y border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <Calendar size={12} className="text-slate-400" />
                        {dateStr}
                      </div>
                      <div className="px-4 py-3 space-y-3">
                        {items.map((booking) => {
                          const paid =
                            (booking.payment?.paidCash || 0) +
                            (booking.payment?.paidTransfer || 0);
                          const isFullyPaid = paid >= booking.totalPrice;
                          const displayTime = new Date(
                            booking.updatedAt || booking.createdAt
                          ).toLocaleTimeString("vi-VN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          });

                          return (
                            <div
                              key={booking.id}
                              onClick={() => handleSelect(booking)}
                              className="relative bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group active:scale-[0.98]"
                            >
                              <div className="flex justify-between items-center mb-3 pb-3 border-b border-slate-200 border-dashed">
                                <div className="flex flex-col gap-0.5 ">
                                  <div className="flex items-center gap-2 ">
                                    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500  transition-colors">
                                      <Phone size={15} />
                                    </div>
                                    <div className="flex flex-col">
                                      <div className="flex items-center gap-1">
                                        <span className="text-sm font-bold text-slate-900">
                                          {booking.passenger.phone}
                                        </span>
                                      </div>
                                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                                        <span
                                          className="flex items-center gap-1"
                                          title="Thời gian chỉnh sửa gần nhất"
                                        >
                                          <Clock
                                            size={10}
                                            className="text-slate-400"
                                          />
                                          <span className="text-slate-400">
                                            Cập nhật: {displayTime}
                                          </span>
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex flex-col justify-between items-end gap-1">
                                  <Badge className="w-full flex items-center text-slate-600 text-xs bg-slate-100 border-slate-200 px-1 h-5 justify-center font-bold">
                                    {booking.totalTickets}
                                    {" vé"}
                                  </Badge>
                                  {renderStatusBadge(booking.status)}
                                </div>
                              </div>

                              {booking.items.length === 0 && (
                                <div className="text-[11px] text-slate-400 text-center py-2 bg-red-50/30 rounded-md border border-dashed border-red-100">
                                  Đã hủy
                                </div>
                              )}
                              <div className="mb-3 flex flex-col gap-1">
                                {booking.items.map((item, idx) => {
                                  const tripDateObj = new Date(item.tripDate);
                                  return (
                                    <div
                                      key={idx}
                                      className="grid grid-cols-2 gap-1 items-center p-2.5 rounded-md bg-slate-50/80 border border-slate-100 group-hover:bg-primary/5 group-hover:border-primary/10 transition-colors"
                                    >
                                      <div className="flex flex-col justify-between flex-1 w-full">
                                        <div className="flex items-center gap-1.5  text-slate-700 text-[12px] whitespace-nowrap overflow-hidden text-ellipsis relative">
                                          {item.route}
                                          {item.isEnhanced && (
                                            <span className="absolute top-[2px] right-2 inline-flex items-center text-[8px] font-black bg-amber-100 text-amber-700 px-1 py-0.5 rounded border border-amber-200 leading-none">
                                              <Zap
                                                size={8}
                                                className="mr-0.5 fill-amber-700"
                                              />
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-medium">
                                          <Calendar
                                            size={10}
                                            className="text-slate-400"
                                          />
                                          <span>
                                            {tripDateObj.getDate()}/
                                            {tripDateObj.getMonth() + 1}
                                          </span>
                                          <span className="text-slate-300">
                                            •
                                          </span>
                                          <span className="text-slate-400">
                                            {formatLunarDate(
                                              tripDateObj
                                            ).replace(" Âm Lịch", " Âm")}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex flex-wrap justify-end gap-1 w-full">
                                        {item.seatIds.map((s) => (
                                          <Badge
                                            key={s}
                                            className="bg-indigo-600 text-white border-transparent text-[9px] font-bold px-[6px] py-0 h-4 shadow-sm"
                                          >
                                            {s}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              <div className="flex justify-between items-center pt-3 border-t border-slate-200 border-dashed">
                                <button
                                  onClick={(e) => handleViewHistory(e, booking)}
                                  className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 px-2 py-1 rounded-lg transition-colors border border-transparent hover:border-slate-200"
                                >
                                  <FileClock size={12} /> Lịch sử
                                </button>

                                <div className="flex items-center gap-3">
                                  <div className="text-right">
                                    <div className="text-sm font-black text-slate-900">
                                      {isFullyPaid ||
                                      booking.status === "payment" ? (
                                        <>
                                          {booking.totalPrice.toLocaleString(
                                            "vi-VN"
                                          )}{" "}
                                          <span className="text-[10px]">đ</span>
                                        </>
                                      ) : (
                                        <span className="text-amber-600 font-bold">
                                          Đã đặt vé
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={isUndoAlertOpen} onOpenChange={setIsUndoAlertOpen}>
        <AlertDialogContent className="max-w-md rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
          <AlertDialogHeader className="p-6 pb-0">
            <AlertDialogTitle className="text-red-600 flex items-center gap-3 text-xl">
              <div className="p-2.5 bg-red-50 rounded-2xl">
                <AlertTriangle size={24} />
              </div>
              Xác nhận hoàn tác
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-slate-600 pt-4 text-sm leading-relaxed space-y-4">
                <p className="font-medium">
                  Bạn đang yêu cầu hủy bỏ tác vụ vừa thực hiện để khôi phục lại
                  trạng thái dữ liệu trước đó.
                </p>

                {/* HIỂN THỊ CHI TIẾT HÀNH ĐỘNG SẮP HOÀN TÁC */}
                {renderUndoSummary()}

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex gap-2 items-start">
                  <Info size={14} className="text-slate-400 mt-0.5 shrink-0" />
                  <span className="text-[11px] text-slate-500 italic">
                    Lưu ý: Hành động hoàn tác là thao tác trực tiếp vào dữ liệu
                    hệ thống và không thể rút lại sau khi xác nhận.
                  </span>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="p-6 bg-slate-50/50 border-t border-slate-100 mt-6 gap-3">
            <Button
              variant="outline"
              onClick={() => setIsUndoAlertOpen(false)}
              className="rounded-xl flex-1 h-11 border-slate-200 text-slate-600 hover:bg-white font-bold"
            >
              Đóng
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmUndo}
              className="rounded-xl flex-1 h-11 bg-red-600 hover:bg-red-700 shadow-lg shadow-red-500/20 font-black uppercase text-xs tracking-widest"
            >
              Xác nhận hoàn tác
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BookingHistoryModal
        isOpen={!!viewHistoryBooking}
        onClose={() => setViewHistoryBooking(null)}
        booking={viewHistoryBooking}
      />
    </>
  );
};
