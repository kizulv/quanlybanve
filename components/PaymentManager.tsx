
import React, { useState, useEffect, useMemo } from "react";
import { api } from "../lib/api";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import {
  DollarSign,
  Calendar as CalendarIcon,
  Search,
  Edit2,
  Eye,
  Phone,
  MapPin,
  Clock,
  Check,
  X,
  Zap,
  Ticket,
  RotateCcw,
  Clock1,
  User,
  CreditCard,
} from "lucide-react";
import { useToast } from "./ui/Toast";
import { Dialog } from "./ui/Dialog";
import { Popover } from "./ui/Popover";
import { Calendar } from "./ui/Calendar";
import { formatLunarDate } from "../utils/dateUtils";
import { Booking, BusTrip, BusType } from "../types";
import { Loader2 } from "lucide-react";
import { formatPhoneNumber } from "../utils/formatters";

interface DateRange {
  from: Date | undefined;
  to?: Date | undefined;
}

interface PaymentGroup {
  bookingId: string;
  bookingDisplayId: string;
  passengerName: string;
  passengerPhone: string;
  tripInfo: {
    route: string;
    date: string;
    seats: { label: string; status: "paid" | "booked" | "refunded" }[];
  };
  payments: any[];
  totalCollected: number;
  latestTransaction: Date;
}

export const PaymentManager: React.FC = () => {
  const { toast } = useToast();
  const [payments, setPayments] = useState<any[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [dateRange, setDateRange] = useState<DateRange>({
    from: undefined,
    to: undefined,
  });

  const [selectedGroup, setSelectedGroup] = useState<PaymentGroup | null>(null);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [paymentsData, bookingsData] = await Promise.all([
        api.payments.getAll(),
        api.bookings.getAll(),
      ]);
      setPayments(paymentsData);
      setBookings(bookingsData);
    } catch (e) {
      console.error(e);
      toast({
        type: "error",
        title: "Lỗi",
        message: "Không thể tải dữ liệu tài chính",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Tính toán các ngày có giao dịch để hiển thị chấm đỏ trên lịch
  const paymentDates = useMemo(() => {
    const dates = new Set<string>();
    payments.forEach((p) => {
      const d = new Date(p.timestamp);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(d.getDate()).padStart(2, "0")}`;
      dates.add(dateStr);
    });
    return Array.from(dates);
  }, [payments]);

  function normalizeTrips(details: any) {
    if (!details) return [];
    if (details.trips && Array.isArray(details.trips)) return details.trips;
    if (details.route || (details.seats && details.seats.length > 0)) {
      return [
        {
          route: details.route || "Unknown",
          tripDate: details.tripDate,
          licensePlate: details.licensePlate,
          seats: details.seats || [],
          labels: details.labels || [],
          tripId: details.tripId,
        },
      ];
    }
    return [];
  }

  const filteredPaymentsByDate = useMemo(() => {
    if (!dateRange.from) return payments;

    const start = new Date(dateRange.from).setHours(0, 0, 0, 0);
    const end = dateRange.to
      ? new Date(dateRange.to).setHours(23, 59, 59, 999)
      : new Date(dateRange.from).setHours(23, 59, 59, 999);

    return payments.filter((p) => {
      const pTime = new Date(p.timestamp).getTime();
      return pTime >= start && pTime <= end;
    });
  }, [payments, dateRange]);

  const filteredBookingsByDate = useMemo(() => {
    if (!dateRange.from) return bookings;

    const start = new Date(dateRange.from).setHours(0, 0, 0, 0);
    const end = dateRange.to
      ? new Date(dateRange.to).setHours(23, 59, 59, 999)
      : new Date(dateRange.from).setHours(23, 59, 59, 999);

    return bookings.filter((b) => {
      const bTime = new Date(b.createdAt).getTime();
      return bTime >= start && bTime <= end;
    });
  }, [bookings, dateRange]);

  const allGroupedPayments = useMemo(() => {
    const groups: Record<string, PaymentGroup> = {};

    payments.forEach((payment) => {
      const booking = payment.bookingId;
      const bKey = booking ? booking.id || booking._id : "orphaned";

      if (!groups[bKey]) {
        groups[bKey] = {
          bookingId: bKey,
          bookingDisplayId:
            bKey === "orphaned"
              ? "N/A"
              : bKey.toString().slice(-6).toUpperCase(),
          passengerName: booking?.passenger?.name || "Khách lẻ / Đã xóa",
          passengerPhone: booking?.passenger?.phone || "N/A",
          tripInfo: {
            route: payment.details?.route || "N/A",
            date: payment.details?.tripDate || "",
            seats: [],
          },
          payments: [],
          totalCollected: 0,
          latestTransaction: new Date(0),
        };
      }

      groups[bKey].payments.push(payment);
      groups[bKey].totalCollected += payment.amount;

      const pDate = new Date(payment.timestamp);
      if (pDate > groups[bKey].latestTransaction) {
        groups[bKey].latestTransaction = pDate;
      }
    });

    Object.values(groups).forEach((g) => {
      const currentBooking = bookings.find((b) => b.id === g.bookingId);
      const activePaidLabels = new Set<string>();
      const activeBookedLabels = new Set<string>();

      if (currentBooking && currentBooking.status !== "cancelled") {
        currentBooking.items.forEach((item) => {
          if (item.tickets && item.tickets.length > 0) {
            item.tickets.forEach((ticket) => {
              if (ticket.price > 0) activePaidLabels.add(ticket.seatId);
              else activeBookedLabels.add(ticket.seatId);
            });
          } else {
            item.seatIds.forEach((sid) => {
              if (currentBooking.status === "payment")
                activePaidLabels.add(sid);
              else activeBookedLabels.add(sid);
            });
          }
        });
      }

      const allLabelsInHistory = new Set<string>();
      g.payments.forEach((p) => {
        const pTrips = normalizeTrips(p.details);
        pTrips.forEach((t: any) => {
          const labels = t.labels && t.labels.length > 0 ? t.labels : t.seats;
          if (labels) labels.forEach((l: string) => allLabelsInHistory.add(l));
        });
      });

      g.tripInfo.seats = Array.from(allLabelsInHistory)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .map((label) => {
          if (activePaidLabels.has(label))
            return { label, status: "paid" as const };
          if (activeBookedLabels.has(label))
            return { label, status: "booked" as const };
          return { label, status: "refunded" as const };
        });
    });

    return Object.values(groups).sort(
      (a, b) => b.latestTransaction.getTime() - a.latestTransaction.getTime()
    );
  }, [payments, bookings]);

  const filteredGroups = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    if (term) {
      return allGroupedPayments.filter(
        (g) =>
          g.passengerPhone.includes(term) ||
          g.passengerName.toLowerCase().includes(term) ||
          g.bookingDisplayId.toLowerCase().includes(term) ||
          g.tripInfo.seats.some((s) => s.label.toLowerCase().includes(term)) ||
          g.payments.some((p) => (p.note || "").toLowerCase().includes(term))
      );
    }

    if (dateRange.from) {
      const start = new Date(dateRange.from).setHours(0, 0, 0, 0);
      const end = dateRange.to
        ? new Date(dateRange.to).setHours(23, 59, 59, 999)
        : new Date(dateRange.from).setHours(23, 59, 59, 999);

      return allGroupedPayments.filter((g) => {
        const t = g.latestTransaction.getTime();
        return t >= start && t <= end;
      });
    }

    return allGroupedPayments;
  }, [allGroupedPayments, searchTerm, dateRange]);

  const stats = useMemo(() => {
    let cashTotal = 0;
    let transferTotal = 0;
    filteredPaymentsByDate.forEach((p) => {
      cashTotal += p.cashAmount || 0;
      transferTotal += p.transferAmount || 0;
    });

    let cabinTickets = 0;
    let sleeperTickets = 0;
    let enhancedTickets = 0;
    let totalBooked = 0;
    let totalTickets = 0;

    filteredBookingsByDate.forEach((b) => {
      if (b.status === "cancelled" || b.status === "hold") return;

      b.items.forEach((item) => {
        const isItemEnhanced = !!item.isEnhanced;
        const itemBusType = item.busType || BusType.SLEEPER;

        if (item.tickets && item.tickets.length > 0) {
          item.tickets.forEach((ticket) => {
            if (ticket.price > 0) {
              totalTickets++;
              if (isItemEnhanced) enhancedTickets++;
              else if (itemBusType === BusType.CABIN) cabinTickets++;
              else sleeperTickets++;
            } else {
              totalBooked++;
            }
          });
        } else if (item.seatIds) {
          item.seatIds.forEach(() => {
            if (b.status === "payment") totalTickets++;
            else totalBooked++;
          });
        }
      });
    });

    return {
      cashTotal,
      transferTotal,
      grandTotal: cashTotal + transferTotal,
      cabinTickets,
      sleeperTickets,
      enhancedTickets,
      totalTickets,
      totalBooked,
    };
  }, [filteredPaymentsByDate, filteredBookingsByDate]);

  const startEditNote = (payment: any) => {
    setEditingPaymentId(payment.id);
    setEditNote(payment.note || "");
  };

  const saveEditNote = async () => {
    if (!editingPaymentId) return;
    try {
      await api.payments.update(editingPaymentId, { note: editNote });
      const updatedPayments = payments.map((p) =>
        p.id === editingPaymentId ? { ...p, note: editNote } : p
      );
      setPayments(updatedPayments);
      if (selectedGroup) {
        const updatedGroupPayments = selectedGroup.payments.map((p) =>
          p.id === editingPaymentId ? { ...p, note: editNote } : p
        );
        setSelectedGroup({ ...selectedGroup, payments: updatedGroupPayments });
      }
      setEditingPaymentId(null);
      toast({
        type: "success",
        title: "Đã cập nhật",
        message: "Đã lưu ghi chú",
      });
    } catch (e) {
      toast({ type: "error", title: "Lỗi", message: "Không thể cập nhật" });
    }
  };

  const getRangeLabel = () => {
    if (!dateRange.from) return "Lọc theo ngày";
    const fromStr = dateRange.from.toLocaleDateString("vi-VN");
    if (!dateRange.to || dateRange.from.getTime() === dateRange.to.getTime()) {
      return `Ngày: ${fromStr}`;
    }
    return `${fromStr} - ${dateRange.to.toLocaleDateString("vi-VN")}`;
  };

  function calculateDiff(prevTrips: any[], currPayment: any) {
    const currTrips = normalizeTrips(currPayment.details);
    const isIncremental = currPayment.transactionType === "incremental";
    const getTripKey = (t: any) => `${t.route}-${t.tripDate}`;

    const prevMap = new Map();
    prevTrips.forEach((t) => prevMap.set(getTripKey(t), t));
    const currMap = new Map();
    currTrips.forEach((t) => currMap.set(getTripKey(t), t));

    const allKeys = new Set([...prevMap.keys(), ...currMap.keys()]);
    const results: any[] = [];

    allKeys.forEach((key) => {
      const prevT = prevMap.get(key);
      const currT = currMap.get(key);
      const pSeats = new Set(
        prevT ? (prevT.labels?.length ? prevT.labels : prevT.seats) : []
      );
      const cSeats = new Set(
        currT ? (currT.labels?.length ? currT.labels : currT.seats) : []
      );
      const meta = currT || prevT || {};
      const seatDiffs: any[] = [];

      if (isIncremental) {
        const status = currPayment.type === "refund" ? "removed" : "added";
        cSeats.forEach((s) => {
          let price = 0;
          if (currT.tickets) {
            const t = currT.tickets.find(
              (tic: any) => tic.label === s || tic.seatId === s
            );
            if (t) price = t.price;
          }
          seatDiffs.push({ id: s, status, price });
        });
      } else {
        const allSeats = new Set([...pSeats, ...cSeats]);
        allSeats.forEach((s) => {
          const inPrev = pSeats.has(s);
          const inCurr = cSeats.has(s);
          let status = "kept";
          if (inCurr && !inPrev) status = "added";
          if (!inCurr && inPrev) status = "removed";

          let price = 0;
          if (status !== "removed" && currT?.tickets) {
            const t = currT.tickets.find(
              (tic: any) => tic.label === s || tic.seatId === s
            );
            if (t) price = t.price;
          }
          if (status === "removed" && prevT?.tickets) {
            const t = prevT.tickets.find(
              (tic: any) => tic.label === s || tic.seatId === s
            );
            if (t) price = t.price;
          }
          seatDiffs.push({ id: s, status, price });
        });
      }

      seatDiffs.sort((a, b) =>
        a.id.localeCompare(b, undefined, { numeric: true })
      );
      if (seatDiffs.length > 0) results.push({ ...meta, diffSeats: seatDiffs });
    });
    return results;
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <Loader2 className="animate-spin mb-4" size={48} />
        <p>Đang tải dữ liệu tài chính...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto space-y-6 animate-in fade-in duration-500">
      {/* STATS CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center shadow-sm">
                <DollarSign size={24} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">
                  {dateRange.from
                    ? "Thống kê thu theo giai đoạn"
                    : "Tổng thu thanh toán"}
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  {dateRange.from ? getRangeLabel() : "Dòng tiền thực nhận"}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black text-green-700 tracking-tight">
                {stats.grandTotal.toLocaleString("vi-VN")} đ
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-100">
              <div className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>{" "}
                Tiền mặt
              </div>
              <p className="text-lg font-black text-slate-800 tracking-tight">
                {stats.cashTotal.toLocaleString("vi-VN")} đ
              </p>
            </div>
            <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-100">
              <div className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>{" "}
                Chuyển khoản
              </div>
              <p className="text-lg font-black text-slate-800 tracking-tight">
                {stats.transferTotal.toLocaleString("vi-VN")} đ
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-sm">
                <Ticket size={24} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">
                  {dateRange.from
                    ? "Lượng vé giai đoạn"
                    : "Thống kê số lượng vé"}
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  {dateRange.from
                    ? "Vé tạo mới trong giai đoạn"
                    : "Chỉ đếm các vé chưa hủy"}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xl font-black text-amber-600 tracking-tight">
                Chưa thu: {stats.totalBooked}{" "}
                <span className="text-xs font-bold uppercase">vé</span>
              </p>
              <p className="text-2xl font-black text-blue-700 tracking-tight">
                Đã thu: {stats.totalTickets}{" "}
                <span className="text-sm font-bold uppercase">vé</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-indigo-50/40 p-3 rounded-xl border border-indigo-100 flex flex-col items-center shadow-sm">
              <p className="text-[10px] font-bold text-indigo-400 uppercase mb-1.5">
                Xe Phòng VIP
              </p>
              <p className="text-2xl font-black text-indigo-700">
                {stats.cabinTickets}
              </p>
            </div>
            <div className="bg-sky-50/40 p-3 rounded-xl border border-sky-100 flex flex-col items-center shadow-sm">
              <p className="text-[10px] font-bold text-sky-500 uppercase mb-1.5">
                Xe Thường
              </p>
              <p className="text-2xl font-black text-sky-700">
                {stats.sleeperTickets}
              </p>
            </div>
            <div className="bg-amber-50/40 p-3 rounded-xl border border-amber-100 flex flex-col items-center shadow-sm">
              <p className="text-[10px] font-bold text-amber-500 uppercase mb-1.5">
                Tăng cường
              </p>
              <p className="text-2xl font-black text-amber-700">
                {stats.enhancedTickets}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* SEARCH & FILTERS BAR */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
        <div className="relative flex-1 group">
          <Search
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors"
          />
          <input
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary placeholder-slate-400 transition-all h-10"
            placeholder="Tìm SĐT, Tên khách, Mã ghế... (Tìm trên toàn bộ dữ liệu)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Popover
            align="right"
            trigger={
              <Button
                variant="outline"
                className={`h-10 px-4 flex items-center gap-2 border-slate-200 hover:border-primary/50 hover:bg-slate-50 transition-all ${
                  dateRange.from
                    ? "border-primary text-primary bg-primary/5 font-bold"
                    : "text-slate-600"
                }`}
              >
                <CalendarIcon size={18} />
                <span className="text-sm">{getRangeLabel()}</span>
                {dateRange.from && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setDateRange({ from: undefined, to: undefined });
                    }}
                    className="ml-1 p-0.5 rounded-full hover:bg-primary/20 transition-colors"
                  >
                    <X size={14} />
                  </div>
                )}
              </Button>
            }
            content={(close) => (
              <Calendar
                mode="range"
                selected={dateRange}
                highlightDays={paymentDates}
                onSelect={(range) => {
                  setDateRange(range);
                  if (range.from && range.to) close();
                }}
              />
            )}
          />
        </div>

        <Button
          onClick={fetchData}
          variant="outline"
          className="bg-slate-900 text-white hover:text-white hover:bg-slate-800 rounded-lg h-10 px-6 flex items-center justify-center transition-all shadow-sm border-none"
        >
          <RotateCcw size={18} className="mr-2" />
          Làm mới
        </Button>
      </div>

      {/* DATA TABLE */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
            <tr>
              <th className="py-3 w-[250px] text-center">Số điện thoại</th>
              <th className="py-3">Số vé</th>
              <th className="py-3 text-center w-[170px]">Giao dịch</th>
              <th className="py-3 text-center w-[200px]">Cập nhật</th>
              <th className="py-3 text-right w-[170px] pr-6">Tổng thực thu</th>
              <th className="py-3 text-center w-[170px]">Chi tiết</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredGroups.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="p-16 text-center text-slate-400 font-medium italic"
                >
                  {searchTerm
                    ? `Không tìm thấy dữ liệu khớp với "${searchTerm}".`
                    : dateRange.from
                    ? `Không tìm thấy giao dịch nào trong giai đoạn ${getRangeLabel()}.`
                    : "Không có dữ liệu thanh toán phù hợp."}
                </td>
              </tr>
            ) : (
              filteredGroups.map((group) => (
                <tr
                  key={group.bookingId}
                  className="hover:bg-slate-50/80 transition-colors group"
                >
                  <td className="py-3">
                    <div className="flex items-center justify-center text-center font-bold text-slate-700">
                      <Phone size={12} className="inline mr-1.5" />
                      {formatPhoneNumber(group.passengerPhone)}
                      {group.bookingId === "orphaned" && " (Đã xóa)"}
                    </div>
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-2">
                      {group.tripInfo.seats.map((s, i) => {
                        let badgeClass =
                          s.status === "refunded"
                            ? "bg-white hover:bg-white text-slate-500 border-slate-500 line-through decoration-slate-400 opacity-60"
                            : s.status === "paid"
                            ? "bg-white hover:bg-white text-slate-500 border-slate-500 font-semibold"
                            : "bg-orange-50 hover:bg-orange-50 text-orange-600 border-orange-200 font-bold shadow-sm";
                        return (
                          <Badge
                            key={i}
                            className={`text-xs px-2 h-6 border ${badgeClass}`}
                          >
                            {s.label}
                          </Badge>
                        );
                      })}
                    </div>
                  </td>
                  <td className="py-3 text-center">
                    <Badge className="bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200 text-[10px] px-2 font-black">
                      {group.payments.length} Giao dịch
                    </Badge>
                  </td>
                  <td className="py-3 text-center">
                    <div className="flex items-center justify-center">
                      <Clock1
                        size={13}
                        className="inline mr-1.5 text-slate-400"
                      />
                      <span className="text-xs text-slate-400">
                        {group.latestTransaction.toLocaleTimeString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="text-xs text-slate-400">
                        &nbsp;ngày&nbsp;
                      </span>
                      <span className="text-xs text-slate-400">
                        {group.latestTransaction.toLocaleDateString("vi-VN")}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 text-right">
                    <span className="text-sm font-semibold tracking-tight text-green-600 pr-6">
                      {group.totalCollected.toLocaleString("vi-VN")}
                    </span>
                  </td>
                  <td className="py-3 text-center">
                    <a
                      onClick={() => setSelectedGroup(group)}
                      className="text-sm cursor-pointer flex items-center justify-center font-semibold mx-auto"
                    >
                      <Eye size={14} className="mr-1.5" /> Chi tiết
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog
        isOpen={!!selectedGroup}
        onClose={() => {
          setSelectedGroup(null);
          setEditingPaymentId(null);
        }}
        title="Lịch sử thanh toán"
        className="max-w-[700px]"
        headerClassName="px-4 h-[40px] border-b flex items-center justify-between shrink-0 rounded-t-xl bg-gradient-to-r from-indigo-950 via-indigo-900 to-indigo-950 text-white text-sm font-semibold"
      >
        {selectedGroup && (
          <div className="space-y-5 max-h-[75vh] overflow-y-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sticky top-0 z-20 bg-white px-4 border-b border-slate-200 shadow-sm py-1">
              <div className="flex items-center gap-1">
                <Phone size={16} className="text-slate-600 mr-1 pr-0" />{" "}
                <span className="text-lg font-semibold text-slate-900">
                  {formatPhoneNumber(selectedGroup.passengerPhone)}
                </span>
              </div>
              <div className="text-right py-2.5 flex items-center justify-center min-w-[140px]">
                <span className="ml-2 text-lg font-bold tracking-tight">
                  Tổng thực thu:
                </span>
                <span className="ml-2 text-lg font-bold text-green-700 tracking-tight">
                  {selectedGroup.totalCollected.toLocaleString("vi-VN")} đ
                </span>
              </div>
            </div>
            <div className="px-4">
              <div className="relative border-l-2 border-slate-200 ml-2 space-y-5 py-4 mb-4">
                {[...selectedGroup.payments]
                  .sort(
                    (a, b) =>
                      new Date(a.timestamp).getTime() -
                      new Date(b.timestamp).getTime()
                  )
                  .map((p, idx, arr) => {
                    const isPositive = p.amount >= 0;
                    const isCash = p.method === "cash";
                    const prevP = idx > 0 ? arr[idx - 1] : null;
                    const prevTrips = prevP
                      ? normalizeTrips(prevP.details)
                      : [];
                    const diffResult = calculateDiff(prevTrips, p);

                    return (
                      <div
                        key={p.id}
                        className="relative pl-6 animate-in slide-in-from-left duration-300"
                      >
                        <div
                          className={`absolute -left-[11px] top-0 w-5 h-5 rounded-full border-4 border-white shadow-md flex items-center justify-center ${
                            isPositive ? "bg-emerald-500" : "bg-red-500"
                          }`}
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                        </div>
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border shadow-sm ${
                                  isPositive
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-red-50 text-red-700 border-red-200"
                                }`}
                              >
                                {isPositive ? "Thanh toán" : "Hoàn tiền"}
                              </span>
                              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                <Clock size={11} />{" "}
                                {new Date(p.timestamp).toLocaleString("vi-VN")}
                              </span>
                            </div>
                            <div
                              className={`flex items-center text-lg font-black tracking-tight`}
                            >
                              {" "}
                              <div className="flex items-center px-2 h-5 justify-center bg-green-50 border border-green-100 rounded">
                                {isCash ? (
                                  <span className="flex items-center text-amber-600 text-[10px] font-semibold">
                                    {/* Fix: Remove unsupported 'title' prop from Lucide icon to avoid TS error */}
                                    <DollarSign
                                      size={10}
                                      className="text-amber-600 mr-1"
                                    />
                                    Tiền mặt
                                  </span>
                                ) : (
                                  <span className="flex items-center text-amber-600 text-[10px] font-semibold">
                                    {/* Fix: Remove unsupported 'title' prop from Lucide icon to avoid TS error */}
                                    <CreditCard
                                      size={10}
                                      className="text-amber-600 mr-1"
                                    />
                                    Chuyển khoản
                                  </span>
                                )}
                              </div>
                              <span
                                className={`text-sm ${
                                  isPositive
                                    ? "text-emerald-600"
                                    : "text-red-600"
                                } ml-2`}
                              >
                                {p.amount.toLocaleString("vi-VN")} đ
                              </span>
                            </div>
                          </div>

                          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-all group/card relative overflow-hidden">
                            {diffResult.length > 0 ? (
                              <div className="space-y-3 mb-4">
                                {diffResult.map((t: any, tripIdx: number) => (
                                  <div
                                    key={tripIdx}
                                    className="text-sm border-b border-slate-100 border-dashed last:border-b-0 pb-3 last:pb-0"
                                  >
                                    <div className="flex items-center gap-3 mb-3">
                                      <span className="flex items-center font-black text-slate-800">
                                        <MapPin
                                          size={13}
                                          className="text-slate-600 mr-1"
                                        />{" "}
                                        {t.route}
                                      </span>
                                      <span className="flex items-center text-xs text-slate-400 tracking-tight ">
                                        <CalendarIcon
                                          size={11}
                                          className="mr-1"
                                        />{" "}
                                        {t.tripDate}
                                      </span>
                                      <span className="bg-yellow-200 border border-yellow-300 rounded-full flex items-center h-5 px-2 text-[10px] text-slate-900 tracking-widest font-semibold">
                                        {t.licensePlate}
                                      </span>

                                      {t.isEnhanced && (
                                        <Badge className="flex items-center bg-amber-50 text-amber-700 border-amber-200 text-[9px] font-black uppercase px-1.5 h-5">
                                          <Zap
                                            size={9}
                                            className="mr-0.5 fill-amber-700"
                                          />{" "}
                                          Tăng cường
                                        </Badge>
                                      )}
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                      {t.diffSeats?.map((s: any, i: number) => (
                                        <Badge
                                          key={i}
                                          variant="outline"
                                          className={`${
                                            s.status === "removed"
                                              ? "text-slate-600 border-slate-200 line-through opacity-60 shadow-sm"
                                              : "text-slate-600 border-slate-200 shadow-sm"
                                          } px-2 py-0.5 text-[10px] flex items-center gap-1.5 rounded-lg`}
                                        >
                                          {s.id}{" "}
                                          {s.price > 0 && (
                                            <span className="border-l pl-1.5 ml-0.5 border-slate-500 text-slate-400 font-normal text-xs">
                                              {s.price.toLocaleString("vi-VN")}
                                            </span>
                                          )}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 text-[11px] italic text-slate-400 mb-4">
                                Snapshot giao dịch không có thông tin chi tiết.
                              </div>
                            )}

                            <div className="bg-slate-50/80 px-3 py-2 rounded-md border border-slate-100 text-xs text-slate-600 flex items-center group/note relative transition-all hover:bg-white">
                              {editingPaymentId === p.id ? (
                                <div className="flex gap-2 w-full animate-in fade-in zoom-in-95">
                                  <input
                                    className="flex-1 bg-white border border-primary/50 rounded-md px-3 py-1.5 outline-none text-xs font-medium"
                                    value={editNote}
                                    onChange={(e) =>
                                      setEditNote(e.target.value)
                                    }
                                    onKeyDown={(e) =>
                                      e.key === "Enter" && saveEditNote()
                                    }
                                    autoFocus
                                    placeholder="Nhập ghi chú..."
                                  />
                                  <button
                                    title="Lưu ghi chú"
                                    onClick={saveEditNote}
                                    className="bg-emerald-600 text-white p-2 rounded-md shadow-md"
                                  >
                                    <Check size={14} />
                                  </button>
                                  <button
                                    title="Hủy"
                                    onClick={() => setEditingPaymentId(null)}
                                    className="bg-slate-200 text-slate-600 p-2 rounded-md"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : (
                                <div className="w-full flex justify-between items-center gap-4">
                                  <span
                                    className={`flex-1 ${
                                      !p.note
                                        ? "italic text-slate-400"
                                        : "font-semibold text-slate-700"
                                    }`}
                                  >
                                    {p.note || "(Không có ghi chú)"}
                                  </span>
                                  <button
                                    title="Chỉnh sửa ghi chú"
                                    onClick={() => startEditNote(p)}
                                    className="opacity-0 group-hover/note:opacity-100 p-1.5 text-primary bg-white border border-primary/10 rounded-lg transition-all"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};
