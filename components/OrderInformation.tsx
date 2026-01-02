import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  Ticket,
  Calendar,
  MapPin,
  Phone,
  User,
  Clock,
  Bus,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  QrCode,
  FileClock,
  Loader2,
  Plus,
  Trash2,
  Edit,
  ArrowRightLeft,
  Truck,
  UserCog,
  Banknote,
  RotateCcw,
  Info,
  Zap,
  CalendarIcon,
  ArrowRight,
  LayoutGrid,
  Locate,
  Home,
  Notebook,
  PhoneCall,
  NotebookIcon,
  NotepadText,
} from "lucide-react";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { api } from "../lib/api";
import { Booking, BookingHistory, BusTrip, BusType, Seat } from "../types";
import {
  formatCurrency,
  formatPhoneNumber,
  formatDate,
} from "../utils/formatters";
import { formatLunarDate } from "../utils/dateUtils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/Collapsible";

const SeatMapPreview: React.FC<{ trip: BusTrip; bookedSeatIds: string[] }> = ({
  trip,
  bookedSeatIds,
}) => {
  const isCabin = trip.type === BusType.CABIN;
  const seats = trip.seats || [];

  const renderSeat = (seat: Seat | undefined) => {
    if (!seat)
      return (
        <div
          className={`${
            isCabin ? "h-8 w-[60px]" : "h-9 w-9 sm:w-11"
          } rounded-md border border-dashed border-slate-200 bg-slate-50/50`}
        />
      );

    const isBooked = bookedSeatIds.includes(seat.id);
    return (
      <div
        key={seat.id}
        className={`
          relative flex items-center justify-center border transition-all duration-200 rounded-md shadow-sm
          ${
            isCabin
              ? "h-[35.5px] w-[60px] text-[10px]"
              : "h-8 w-9 sm:w-11 text-[10px]"
          }
          ${
            isBooked
              ? "bg-slate-900 border-slate-900 text-white font-black ring-2 ring-slate-100"
              : "bg-slate-200 border-slate-300 text-slate-500 font-bold"
          }
        `}
        title={`${seat.label} ${isBooked ? "(Ghế của bạn)" : ""}`}
      >
        {seat.label}
      </div>
    );
  };

  if (isCabin) {
    const regularSeats = seats.filter(
      (s) => !s.isFloorSeat && (s.row ?? 0) < 90
    );
    const benchSeats = seats.filter(
      (s) => !s.isFloorSeat && (s.row ?? 0) >= 90
    );
    const rows = Array.from(new Set(regularSeats.map((s) => s.row ?? 0))).sort(
      (a: number, b: number) => a - b
    );

    return (
      <div className="flex flex-col items-center md:gap-4 bg-slate-50 py-4 rounded border border-slate-100 w-full overflow-hidden">
        <div className="md:hidden text-slate-400 font-semibold text-xs text-center uppercase">
          Sơ đồ vị trí
        </div>
        <div className="grid grid-cols-2 gap-4 w-full">
          <div className="flex flex-col items-center">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
              Dãy B
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
              <div className="text-[10px] font-bold text-slate-300 text-center uppercase">
                T1
              </div>
              <div className="text-[10px] font-bold text-slate-300 text-center uppercase">
                T2
              </div>
              {rows.map((r) => (
                <React.Fragment key={`row-b-${r}`}>
                  {renderSeat(
                    regularSeats.find(
                      (s) => s.row === r && s.col === 0 && s.floor === 1
                    )
                  )}
                  {renderSeat(
                    regularSeats.find(
                      (s) => s.row === r && s.col === 0 && s.floor === 2
                    )
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
              Dãy A
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
              <div className="text-[10px] font-bold text-slate-300 text-center uppercase">
                T1
              </div>
              <div className="text-[10px] font-bold text-slate-300 text-center uppercase">
                T2
              </div>
              {rows.map((r) => (
                <React.Fragment key={`row-a-${r}`}>
                  {renderSeat(
                    regularSeats.find(
                      (s) => s.row === r && s.col === 1 && s.floor === 1
                    )
                  )}
                  {renderSeat(
                    regularSeats.find(
                      (s) => s.row === r && s.col === 1 && s.floor === 2
                    )
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
        {benchSeats.length > 0 && (
          <div className="pt-4 border-t border-slate-200 border-dashed w-full flex flex-col items-center gap-2">
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              Băng cuối
            </div>
            <div className="flex gap-2 justify-center">
              {benchSeats
                .sort((a, b) => (a.col ?? 0) - (b.col ?? 0))
                .map((s) => renderSeat(s))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const standardSeats = seats.filter((s) => !s.isFloorSeat && (s.row ?? 0) < 6);
  const benchSeats = seats.filter((s) => !s.isFloorSeat && (s.row ?? 0) >= 6);
  const rows = [0, 1, 2, 3, 4, 5];

  return (
    <div className="flex flex-col gap-3 bg-slate-50 p-4 rounded border border-slate-100 w-full overflow-hidden">
      <div className="md:hidden text-slate-400 font-semibold text-xs text-center uppercase">
        Sơ đồ vị trí
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-6 w-full">
        {[1, 2].map((f) => (
          <div key={`floor-${f}`} className="flex flex-col items-center">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
              Tầng {f}
            </div>
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {rows.map((r) => (
                <React.Fragment key={`row-${f}-${r}`}>
                  {[0, 1, 2].map((c) => {
                    const s = standardSeats.find(
                      (st) => st.row === r && st.col === c && st.floor === f
                    );
                    return s ? (
                      renderSeat(s)
                    ) : (
                      <div
                        key={`empty-${f}-${r}-${c}`}
                        className="h-9 w-9 sm:w-11"
                      />
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        ))}
      </div>
      {benchSeats.length > 0 && (
        <div className="w-full flex flex-col items-center">
          <div className="flex gap-4 w-full px-2 lg:px-0">
            {[1, 2].map((f) => {
              const floorBench = benchSeats
                .filter((s) => s.floor === f)
                .sort((a, b) => (a.col ?? 0) - (b.col ?? 0));
              if (floorBench.length === 0) return null;
              return (
                <div
                  key={`bench-row-${f}`}
                  className="flex justify-between items-center w-full"
                >
                  <div className="text-[10px] font-black text-slate-300 uppercase tracking-tighter">
                    Tầng {f}
                  </div>
                  <div className="flex gap-1.5 sm:gap-2 justify-center">
                    {floorBench.map((s) => renderSeat(s))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

interface OrderInformationProps {
  onBackToDashboard?: () => void;
}

export const OrderInformation: React.FC<OrderInformationProps> = ({
  onBackToDashboard,
}) => {
  const [searchId, setSearchId] = useState("");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [history, setHistory] = useState<BookingHistory[]>([]);
  const [trips, setTrips] = useState<BusTrip[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint in tailwind
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bookingId = params.get("bookingId");
    if (bookingId) {
      handleSearch(bookingId);
    }
  }, []);

  const fetchHistory = async (id: string) => {
    setHistoryLoading(true);
    try {
      const data = await api.bookings.getHistory(id);
      const sorted = [...data].sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      setHistory(sorted);
    } catch (error) {
      console.error("Failed to load history", error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSearch = async (id: string = searchId) => {
    const cleanId = id.trim();
    if (!cleanId) return;

    setLoading(true);
    setError(null);
    setHistory([]);
    try {
      const [allBookings, allTrips] = await Promise.all([
        api.bookings.getAll(),
        api.trips.getAll(),
      ]);

      setTrips(allTrips);
      const found = allBookings.find(
        (b: Booking) =>
          b.id === cleanId ||
          b.id.slice(-6).toUpperCase() === cleanId.toUpperCase() ||
          b.passenger.phone === cleanId
      );

      if (found) {
        setBooking(found);
        await fetchHistory(found.id);
      } else {
        setError("Không tìm thấy thông tin vé, kiểm tra lại số điện thoại.");
        setBooking(null);
      }
    } catch (e) {
      setError("Lỗi hệ thống khi tra cứu dữ liệu.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "payment":
        return (
          <Badge className="font-normal bg-slate-200 rounded hover:bg-slate-300 text-slate-600">
            Đã thanh toán
          </Badge>
        );
      case "booking":
        return (
          <Badge className="font-normal bg-amber-500 rounded">Đã đặt chỗ</Badge>
        );
      case "hold":
        return (
          <Badge className="font-normal bg-purple-500 rounded">
            Đang giữ chỗ
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="destructive" className="rounded">
            Đã hủy
          </Badge>
        );
      default:
        return <Badge className="rounded">{status}</Badge>;
    }
  };

  const getActionTheme = (action: string) => {
    switch (action) {
      case "CREATE":
        return { icon: <Plus size={14} />, color: "emerald", label: "Đặt vé" };
      case "DELETE":
      case "CANCEL":
        return { icon: <Trash2 size={14} />, color: "red", label: "Hủy vé" };
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

  const renderLogDetails = (log: BookingHistory) => {
    const details = log.details || {};
    if (
      (log.action === "CREATE" ||
        log.action === "DELETE" ||
        log.action === "CANCEL") &&
      details.trips
    ) {
      const isCancelled = log.action === "DELETE" || log.action === "CANCEL";
      return (
        <div className={`space-y-3 mb-2 ${isCancelled ? "opacity-60" : ""}`}>
          {details.trips.map((trip: any, idx: number) => (
            <div
              key={idx}
              className="grid items-center gap-3 text-sm border-b border-slate-200 border-dashed pb-2"
            >
              <div className="flex justify-between md:justify-start items-center gap-2">
                <div className="flex items-center gap-2 justify-between md:justify-center">
                  <span
                    className={`flex items-center font-black text-slate-800 ${
                      isCancelled ? "line-through text-slate-400" : ""
                    }`}
                  >
                    <MapPin size={13} className="text-slate-600 mr-1" />{" "}
                    {trip.route}
                  </span>
                  <span className="hidden md:block bg-yellow-200 border border-yellow-300 rounded flex items-center h-5 px-2 text-[10px] text-slate-900 font-semibold tracking-wider">
                    {trip.licensePlate}
                  </span>
                </div>
                <div className=" flex items-center gap-2">
                  <span className="flex items-center text-[11px] text-slate-400 bg-slate-100 border border-slate-300 rounded px-2 h-5">
                    <CalendarIcon size={11} className="mr-1" />{" "}
                    {formatDate(trip.tripDate)}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                {trip.seats.map((s: string) => (
                  <span
                    key={s}
                    className={`rounded-full w-8 text-center border ${
                      isCancelled
                        ? "bg-red-50 text-red-400 border-red-100 line-through hover:bg-red-50"
                        : "bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-100"
                    } text-[10px] font-black px-2 py-0.5 rounded`}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }
    if (log.action === "UPDATE" && details.changes) {
      return (
        <div className="space-y-3 mb-2 ">
          {details.changes.map((change: any, idx: number) => (
            <div
              key={idx}
              className="grid items-center gap-3 text-sm border-b border-slate-200 border-dashed pb-2"
            >
              <div className="flex items-center gap-2">
                <span className="flex items-center font-black text-slate-800">
                  <MapPin size={12} className="mr-1" />
                  {change.route}
                </span>
                <span className="flex items-center text-[11px] text-slate-400 bg-slate-100 border border-slate-300 rounded px-2 h-5">
                  <CalendarIcon size={11} className="mr-1" />
                  {formatDate(change.date)}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {change.kept?.map((s: string) => (
                  <Badge
                    key={s}
                    className="bg-slate-50 text-slate-600 border-slate-200 font-bold text-[10px] px-2 rounded"
                  >
                    {s}
                  </Badge>
                ))}
                {change.removed?.map((s: string) => (
                  <Badge
                    key={s}
                    className="bg-red-50 text-red-400 border-red-100 line-through font-bold text-[10px] px-2 rounded"
                  >
                    {s}
                  </Badge>
                ))}
                {change.added?.map((s: string) => (
                  <Badge
                    key={s}
                    className="bg-emerald-50 text-emerald-700 border-emerald-200 font-black text-[10px] px-2 rounded"
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
    if (log.action === "SWAP" && details.from && details.to) {
      return (
        <div className="grid items-center gap-3 text-sm border-b border-slate-200 border-dashed pb-2">
          <div className="flex items-center gap-2">
            <span className="font-black text-purple-900 min-w-[120px]">
              {details.route}
            </span>
            <span className="flex items-center text-[11px] text-slate-400 bg-slate-100 border border-slate-300 rounded px-2 h-5">
              <CalendarIcon size={11} className="mr-1" />
              {formatDate(details.date)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[9px] font-black text-slate-400 uppercase">
              Từ
            </span>
            <span className="font-black text-slate-500 bg-white px-3 py-0.5 rounded border border-slate-200 text-xs">
              {details.from}
            </span>
            <ArrowRight size={14} className="text-purple-400" />
            <span className="text-[9px] font-black text-purple-400 uppercase">
              Sang
            </span>
            <span className="font-black text-purple-700 bg-white px-3 py-0.5 rounded border border-purple-300 text-xs shadow-sm">
              {details.to}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-4 md:p-10 animate-in fade-in duration-500">
      <div className="max-w-5xl mx-auto w-full space-y-6">
        {/* Standalone Header with Back Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-slate-100 border-2 border-slate-900 rounded flex items-center justify-center text-white shadow-lg">
              <Bus size={28} className="text-slate-900 font-normal" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">
                NHÀ XE TRUNG DŨNG
              </h1>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                Tra cứu vé Tết trực tuyến
              </p>
            </div>
          </div>
        </div>

        {booking ? (
          // PhoneNumber without Search
          <div className="overflow-hidden flex flex-col bg-white rounded-lg rounded-t-xl border border-slate-200 text-center">
            <h3 className="px-4 h-[40px] border-b flex items-center bg-gradient-to-r from-indigo-950 via-indigo-900 to-indigo-950 uppercase gap-2 shadow-sm border-b border-slate-200 text-white text-xs">
              <NotepadText size={18} /> Thông tin đặt vé
            </h3>
            <div className="flex items-center justify-between px-4 py-4">
              <div className="flex items-center gap-2 text-lg font-bold text-indent">
                <PhoneCall size={14} />
                {booking.passenger.phone}
              </div>
              <span className="flex items-center gap-2 bg-slate-200 border-slate-300 text-slate-600 rounded-full px-4 py-1 text-xs">
                <Clock size={12} />
                {formatDate(booking.createdAt)}
              </span>
            </div>
          </div>
        ) : (
          // Search Bar - Full Width Standalone
          <div className="bg-white p-4 rounded border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center bg-primary/10 rounded h-[36px] w-[36px]">
                <QrCode size={26} className="text-slate-700" />
              </div>
              <div className="relative flex-1 group">
                <Search
                  size={20}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-400 transition-colors"
                />
                <input
                  className="w-full h-[36px] pl-10 pr-3 py-4 text-lg font-bold border border-slate-200 rounded outline-none focus:border-slate-900 transition-all placeholder-slate-400 placeholder:text-xs placeholder:font-normal text-indent"
                  placeholder="Nhập số điện thoại đã Đặt hoặc Mua vé"
                  value={searchId}
                  onChange={(e) =>
                    setSearchId(formatPhoneNumber(e.target.value))
                  }
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <Button
                onClick={() => handleSearch()}
                disabled={loading}
                className="rounded px-5 lg:px-10 h-10 text-xs shadow-lg shadow-primary/20 bg-slate-900 hover:bg-slate-800 font-normal"
              >
                {loading ? (
                  <Loader2 size={24} className="animate-spin mr-2" />
                ) : null}
                {loading ? "Đang tìm..." : "Tra cứu"}
              </Button>
            </div>
            {error && (
              <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded flex items-center gap-3 text-red-600 text-sm animate-in slide-in-from-top-2">
                <AlertCircle size={20} />
                {error}
              </div>
            )}
          </div>
        )}

        {booking ? (
          <div className="space-y-8 animate-in zoom-in-95 duration-300">
            {/* Trips Detail */}
            <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <h3 className="bg-slate-50 text-xs font-semibold text-slate-400 uppercase flex items-center gap-2 px-4 h-[40px] border-b border-slate-200">
                <Bus size={16} /> Chi tiết chuyến ({booking.items.length}{" "}
                chuyến)
              </h3>
              <div className="overflow-hidden py-6">
                {booking.items.map((item, idx) => {
                  const tripDate = new Date(item.tripDate);
                  const fullTrip = trips.find((t) => t.id === item.tripId);
                  return (
                    <div
                      key={idx}
                      className="flex flex-col lg:flex-row justify-between gap-6 border-b-2 border-slate-300 border-dashed last:border-0 pb-6 mb-6 last:mb-0 last:pb-0"
                    >
                      <div className="flex-1 px-5 lg:pr-0">
                        <div className="bg-slate-50 rounded border border-slate-100 space-y-1 lg:space-y-3 p-4">
                          <div className="flex items-center gap-2">
                            <Bus size={16} className="text-slate-400 rounded" />
                            <h4 className="text-sm font-black text-slate-900 uppercase">
                              {item.route}
                            </h4>
                          </div>
                          <div className="grid md:grid-cols-2 gap-2 lg:gap-6">
                            <div className="space-y-1">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Biển số xe (dự kiến)
                              </span>
                              <div className="text-xl font-black text-slate-800">
                                {item.licensePlate}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Thời gian xuất bến (Dự kiến)
                              </span>
                              <div
                                className="font-bold text-slate-800 truncate text-lg"
                                title="Thời gian xuất bến dự kiến"
                              >
                                {formatDate(item.tripDate)}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="pt-4">
                          <div className="flex items-center justify-between mb-4">
                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                              Tổng số vé
                            </span>
                            <Badge className="bg-slate-900 text-white font-semibold border-transparent px-4 h-7 rounded-full uppercase ">
                              {item.tickets.length} vé
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {item.tickets.map((t) => (
                              <div
                                key={t.seatId}
                                className="flex flex-col bg-white border-2 border-slate-300 rounded px-4 py-2 hover:border-primary transition-all duration-300 group/ticket"
                              >
                                <div className="flex justify-between items-center">
                                  <span className="text-xl font-black text-slate-900 group-hover/ticket:scale-110 transition-transform">
                                    {t.seatId}
                                  </span>
                                  <span className="text-sm text-slate-900 font-black">
                                    {formatCurrency(t.price)} đ
                                  </span>
                                </div>
                                <div className="mt-1 pt-2 border-t border-slate-50  flex flex-col md:flex-row md:gap-2 items-center">
                                  <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium truncate">
                                    <MapPin
                                      size={10}
                                      className="text-slate-500"
                                    />{" "}
                                    {t.pickup || "---"}
                                  </div>
                                  <div className="flex items-center gap-1 md:gap-2 text-[10px] text-slate-500 font-medium truncate">
                                    <ArrowRight
                                      size={10}
                                      className="text-slate-500"
                                    />{" "}
                                    {t.dropoff || "---"}
                                  </div>
                                </div>
                                {t.note && (
                                  <span className="text-[10px] text-amber-600 font-bold italic mt-1 truncate border-t border-amber-50 pt-2">
                                    *{t.note}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                          <div className="px-4 py-3 bg-blue-50/70 rounded border-2 border-dashed border-slate-200 flex justify-between items-center mt-6">
                            <span className="text-sm font-black text-slate-600">
                              Thanh toán
                            </span>
                            <span className="text-xl font-black text-slate-700">
                              {formatCurrency(item.price)} đ
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="lg:w-[35%] flex flex-col items-center lg:items-start  overflow-hidden px-5 md:pl-0">
                        {fullTrip ? (
                          <div className="w-full">
                            <div className="flex justify-center w-full overflow-hidden">
                              <SeatMapPreview
                                trip={fullTrip}
                                bookedSeatIds={item.seatIds}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="h-full w-full flex flex-col items-center justify-center text-slate-300 py-20 border-2 border-dashed border-slate-100 rounded">
                            <Bus
                              size={64}
                              className="opacity-10 mb-4 animate-pulse"
                            />
                            <p className="text-sm font-bold uppercase tracking-widest">
                              Đang tải sơ đồ ghế...
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Main Content Grid: Summary & Payment */}
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Booking Summary */}
              <Collapsible
                disabled={!isMobile}
                defaultOpen={!isMobile}
                className="w-full lg:flex-1 bg-white rounded border border-slate-200 shadow-sm overflow-hidden h-fit"
              >
                <div className="bg-slate-50 h-[40px] md:border-b md:border-slate-200">
                  <CollapsibleTrigger className="h-full">
                    <h3 className="bg-slate-50 text-xs flex items-center justify-between gap-2 px-4 h-full w-full">
                      <div className="flex items-center font-semibold text-slate-400 uppercase">
                        <User size={16} className="mr-2" /> Lịch sử đặt vé
                      </div>
                      <div className="text-xs">
                        {getStatusBadge(booking.status)}
                      </div>
                    </h3>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="p-4 pl-2 md:p-4">
                  {historyLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                      <Loader2 className="animate-spin mb-4" size={48} />
                      <p className="text-xs tracking-widest uppercase">
                        Đang đồng bộ dữ liệu lịch sử...
                      </p>
                    </div>
                  ) : history.length === 0 ? (
                    <div className="text-center py-20 text-slate-400">
                      <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-dashed border-slate-200 opacity-50">
                        <FileClock size={40} />
                      </div>
                      <p className="text-xs text-slate-500 uppercase tracking-widest">
                        Hệ thống chưa ghi nhận biến động dữ liệu
                      </p>
                    </div>
                  ) : (
                    <div className="relative border-l-4 border-slate-100 ml-2 md:ml-3 space-y-6 py-2">
                      {history.map((log, idx) => {
                        const theme = getActionTheme(log.action);
                        const colorClasses = {
                          emerald: "bg-emerald-500 shadow-emerald-500/20",
                          red: "bg-red-500 shadow-red-500/20",
                          blue: "bg-blue-500 shadow-blue-500/20",
                          purple: "bg-purple-500 shadow-purple-500/20",
                          orange: "bg-orange-500 shadow-orange-500/20",
                          slate: "bg-slate-500 shadow-slate-500/20",
                          green: "bg-green-600 shadow-green-600/20",
                          indigo: "bg-indigo-600 shadow-indigo-600/20",
                        }[theme.color];

                        return (
                          <div
                            key={log.id}
                            className="relative pl-4 md:pl-6 animate-in slide-in-from-left duration-500"
                          >
                            <div
                              className={`absolute -left-[14px] top-1 w-6 h-6 rounded-full border-4 border-white shadow-lg flex items-center justify-center ${colorClasses} z-10`}
                            >
                              <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                            </div>

                            <div className="flex flex-col gap-4">
                              <div className="flex items-center justify-between flex-wrap gap-3">
                                <span
                                  className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-full border flex items-center gap-1 shadow-sm
                                ${
                                  log.action === "CREATE"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : log.action === "DELETE" ||
                                      log.action === "CANCEL" ||
                                      log.action === "REFUND_SEAT"
                                    ? "bg-red-50 text-red-700 border-red-200"
                                    : log.action === "UPDATE"
                                    ? "bg-slate-50 text-slate-900 border-slate-200"
                                    : log.action === "SWAP"
                                    ? "bg-slate-50 text-slate-900 border-slate-200"
                                    : log.action === "TRANSFER"
                                    ? "bg-slate-50 text-slate-900 border-slate-200"
                                    : log.action === "PASSENGER_UPDATE"
                                    ? "bg-orange-50 text-orange-700 border-orange-200"
                                    : "bg-green-50 text-green-700 border-green-200"
                                }
                              `}
                                >
                                  {theme.icon}
                                  {theme.label}
                                </span>
                                <span className="text-[11px] text-slate-400 bg-slate-50 px-4 py-1.5 rounded-full border border-slate-100 flex items-center gap-2">
                                  <Clock size={14} />{" "}
                                  {formatDate(log.timestamp)}
                                </span>
                              </div>

                              <div className="bg-slate-50/50 p-3  md:px-6 md:py-4 rounded border border-slate-100 hover:bg-white hover:shadow-2xl hover:border-primary/20 transition-all duration-300 group/log">
                                {renderLogDetails(log)}
                                <div className="mt-3 flex items-center gap-1 px-3 py-2 border border-slate-200 bg-slate-100 rounded">
                                  <p className="text-xs leading-relaxed text-slate-500">
                                    {log.description}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div className="absolute -bottom-0 -left-[8px] w-3 h-3 rounded-full bg-slate-200"></div>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
              {/* Payment Summary */}
              <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden flex flex-col w-full lg:w-[35%]">
                <h3 className="bg-slate-50 text-xs font-semibold text-slate-400 uppercase flex items-center gap-2 px-4 h-[40px] border-b border-slate-200">
                  <CheckCircle2 size={16} /> Tổng thanh toán
                </h3>
                <div className="px-5">
                  <div className="flex justify-between items-end py-4">
                    <span className="text-slate-500 font-bold text-sm mb-[4px]">
                      Tổng tiền vé:
                    </span>
                    <span className="text-2xl font-black text-slate-600">
                      {formatCurrency(booking.totalPrice)} đ
                    </span>
                  </div>
                  <div className="space-y-1 py-4 border-t border-slate-100">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400 text-xs">Tiền mặt:</span>
                      <span className="font-black text-slate-500">
                        {formatCurrency(booking.payment?.paidCash || 0)} đ
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400 text-xs">
                        Chuyển khoản:
                      </span>
                      <span className="font-black text-slate-500">
                        {formatCurrency(booking.payment?.paidTransfer || 0)} đ
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          !loading &&
          !error && (
            <div className="py-40 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded bg-white/50 backdrop-blur-sm">
              <div className="w-16 h-16 md:w-24 md:h-24 bg-slate-100 flex items-center justify-center mx-auto mb-8 border-2 border-slate-200">
                <QrCode size={40} className="text-slate-600" />
              </div>
              <h3 className="text-lg md:text-xl font-black text-slate-500 uppercase tracking-widest">
                Quét mã QR để tra cứu
              </h3>
              <p className="text-slate-400 mt-3 text-xs md:text-md">
                Mã QR trên vé đã thanh toán
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
};
