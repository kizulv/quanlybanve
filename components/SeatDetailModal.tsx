
import React, { useState, useEffect, useMemo } from "react";
import { Dialog } from "./ui/Dialog";
import { Button } from "./ui/Button";
import { Booking, Seat, Passenger, SeatStatus } from "../types";
import {
  Save,
  MapPin,
  Locate,
  Notebook,
  Phone,
  History,
  X,
  Clock,
  ArrowRight,
  AlertCircle,
  Lock,
  CreditCard,
  Banknote,
  DollarSign,
  ShieldCheck,
  RotateCcw,
  User,
  Calculator,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Tag,
  Trash2,
} from "lucide-react";
import {
  formatPhoneNumber,
  getStandardizedLocation,
} from "../utils/formatters";

interface SeatDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  seat: Seat | null;
  bookings: Booking[];
  onSave: (
    passenger: Passenger,
    extraAction?: {
      action: "PAY" | "REFUND";
      payment?: { paidCash: number; paidTransfer: number };
    }
  ) => Promise<void>;
}

export const SeatDetailModal: React.FC<SeatDetailModalProps> = ({
  isOpen,
  onClose,
  booking,
  seat,
  bookings,
  onSave,
}) => {
  const [form, setForm] = useState({
    phone: "",
    pickup: "",
    dropoff: "",
    note: "",
    name: "",
  });

  const [paymentInput, setPaymentInput] = useState({
    paidCash: 0,
    paidTransfer: 0,
  });

  const [showHistory, setShowHistory] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const seatPrice = useMemo(() => {
    if (!booking || !seat) return 0;
    const item = booking.items.find((i) => i.seatIds.includes(seat.id));
    const ticket = item?.tickets?.find((t) => t.seatId === seat.id);
    return ticket?.price || seat.price || 0;
  }, [booking, seat]);

  useEffect(() => {
    if (isOpen) {
      if (booking && seat) {
        let initialNote = "";
        let initialPickup = booking.passenger.pickupPoint || "";
        let initialDropoff = booking.passenger.dropoffPoint || "";

        const bookingItem = booking.items.find((i) =>
          i.seatIds.includes(seat.id)
        );
        if (bookingItem && bookingItem.tickets) {
          const ticket = bookingItem.tickets.find((t) => t.seatId === seat.id);
          if (ticket) {
            initialNote =
              ticket.note !== undefined && ticket.note !== null
                ? ticket.note
                : booking.passenger.note || "";
            initialPickup = ticket.pickup || initialPickup;
            initialDropoff = ticket.dropoff || initialDropoff;
          }
        } else {
          initialNote = booking.passenger.note || "";
        }

        setForm({
          phone: formatPhoneNumber(booking.passenger.phone),
          pickup: initialPickup,
          dropoff: initialDropoff,
          note: initialNote,
          name: booking.passenger.name || "Khách lẻ",
        });

        if (seat.status === SeatStatus.BOOKED) {
          setPaymentInput({ paidCash: seatPrice, paidTransfer: 0 });
        } else {
          setPaymentInput({ paidCash: 0, paidTransfer: 0 });
        }
      } else if (seat) {
        setForm({
          phone: "",
          pickup: "",
          dropoff: "",
          note: seat.note || "",
          name: "",
        });
      }
      setShowHistory(false);
    }
  }, [isOpen, booking, seat, seatPrice]);

  const historyMatches = useMemo(() => {
    if (!form.phone) return [];
    const cleanInput = form.phone.replace(/\D/g, "");
    if (cleanInput.length < 3) return [];
    return bookings.filter(
      (b) =>
        b.status !== "cancelled" &&
        b.passenger.phone.replace(/\D/g, "").includes(cleanInput)
    );
  }, [bookings, form.phone]);

  const passengerHistory = useMemo(() => {
    const uniqueRoutes = new Map<
      string,
      { pickup: string; dropoff: string; phone: string; lastDate: string }
    >();
    historyMatches.forEach((b) => {
      const pickup = b.passenger.pickupPoint || "";
      const dropoff = b.passenger.dropoffPoint || "";
      if (!pickup && !dropoff) return;
      const key = `${pickup.toLowerCase().trim()}|${dropoff
        .toLowerCase()
        .trim()}`;
      const existing = uniqueRoutes.get(key);
      if (!existing || new Date(b.createdAt) > new Date(existing.lastDate)) {
        uniqueRoutes.set(key, {
          pickup,
          dropoff,
          phone: formatPhoneNumber(b.passenger.phone),
          lastDate: b.createdAt,
        });
      }
    });
    return Array.from(uniqueRoutes.values())
      .sort(
        (a, b) =>
          new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime()
      )
      .slice(0, 5);
  }, [historyMatches]);

  const handleMoneyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPaymentInput((prev) => ({
      ...prev,
      [name]: parseInt(value.replace(/\D/g, "") || "0", 10),
    }));
  };

  const handleSaveOnly = async () => {
    setIsSaving(true);
    try {
      await onSave({
        ...form,
        phone: form.phone.replace(/\D/g, ""),
        pickupPoint: form.pickup,
        dropoffPoint: form.dropoff,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePaySeat = async () => {
    if (paymentInput.paidCash + paymentInput.paidTransfer === 0) return;
    setIsSaving(true);
    try {
      await onSave(
        {
          ...form,
          phone: form.phone.replace(/\D/g, ""),
          pickupPoint: form.pickup,
          dropoffPoint: form.dropoff,
        },
        { action: "PAY", payment: paymentInput }
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleRefundSeat = async () => {
    setIsSaving(true);
    try {
      await onSave(
        {
          ...form,
          phone: form.phone.replace(/\D/g, ""),
          pickupPoint: form.pickup,
          dropoffPoint: form.dropoff,
        },
        { action: "REFUND" }
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (!seat) return null;

  const isSold = seat.status === SeatStatus.SOLD;
  const isBooked = seat.status === SeatStatus.BOOKED;
  const isHeld = seat.status === SeatStatus.HELD;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={`${seat.label} - ${
        isSold ? "Đã thanh toán" : isBooked ? "Đã đặt vé" : "Đang giữ"
      }`}
      className={`${
        isSold ? "max-w-md" : "max-w-3xl"
      } bg-indigo-950 text-white border-indigo-900 rounded-xl overflow-hidden transition-all duration-300`}
      headerClassName="h-[40px] bg-gradient-to-r from-indigo-950 via-indigo-900 to-indigo-950 border-indigo-900 text-white"
    >
      <div className="flex flex-col md:flex-row h-full md:h-[290px]">
        {/* LEFT: Customer Info */}
        <div
          className={`flex-1 overflow-y-auto p-4 ${
            !isSold ? "border-r border-indigo-900/50" : ""
          } bg-indigo-950 space-y-4`}
        >
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">
                Số điện thoại
              </label>
              <div className="relative">
                <div className="absolute left-2.5 top-2 pointer-events-none text-indigo-500">
                  <Phone size={14} />
                </div>
                <input
                  className="w-full pl-8 pr-3 py-1.5 bg-indigo-900/30 border border-indigo-800 rounded text-xs text-white placeholder-indigo-700 focus:border-yellow-500 outline-none transition-all"
                  placeholder="09xx xxx xxx"
                  value={form.phone}
                  onChange={(e) => {
                    setForm({
                      ...form,
                      phone: formatPhoneNumber(e.target.value),
                    });
                    setShowHistory(true);
                  }}
                  onFocus={() => form.phone.length >= 3 && setShowHistory(true)}
                  onBlur={() => setTimeout(() => setShowHistory(false), 200)}
                />
                {showHistory && passengerHistory.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95">
                    {passengerHistory.map((item, idx) => (
                      <div
                        key={idx}
                        onMouseDown={() => {
                          setForm({
                            ...form,
                            phone: item.phone,
                            pickup: item.pickup,
                            dropoff: item.dropoff,
                          });
                          setShowHistory(false);
                        }}
                        className="px-3 py-2 hover:bg-indigo-50 cursor-pointer border-b border-slate-50 last:border-0"
                      >
                        <div className="flex justify-between items-start">
                          <span className="text-xs font-bold text-indigo-700">
                            {item.phone}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">
                          {item.pickup} → {item.dropoff}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">
                  Điểm đón
                </label>
                <div className="relative">
                  <div className="absolute left-2.5 top-2 pointer-events-none text-indigo-500">
                    <MapPin size={14} />
                  </div>
                  <input
                    className="w-full pl-8 pr-3 py-1.5 bg-indigo-900/30 border border-indigo-800 rounded text-xs text-white placeholder-indigo-700 focus:border-yellow-500 outline-none transition-all"
                    placeholder="Bến đi"
                    value={form.pickup}
                    onChange={(e) =>
                      setForm({ ...form, pickup: e.target.value })
                    }
                    onBlur={() =>
                      setForm((f) => ({
                        ...f,
                        pickup: getStandardizedLocation(f.pickup),
                      }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">
                  Điểm trả
                </label>
                <div className="relative">
                  <div className="absolute left-2.5 top-2 pointer-events-none text-indigo-500">
                    <Locate size={14} />
                  </div>
                  <input
                    className="w-full pl-8 pr-3 py-1.5 bg-indigo-900/30 border border-indigo-800 rounded text-xs text-white placeholder-indigo-700 focus:border-yellow-500 outline-none transition-all"
                    placeholder="Bến đến"
                    value={form.dropoff}
                    onChange={(e) =>
                      setForm({ ...form, dropoff: e.target.value })
                    }
                    onBlur={() =>
                      setForm((f) => ({
                        ...f,
                        dropoff: getStandardizedLocation(f.dropoff),
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">
                Ghi chú
              </label>
              <div className="relative">
                <div className="absolute left-2.5 top-2 pointer-events-none text-indigo-500">
                  <Notebook size={14} />
                </div>
                <textarea
                  className="w-full pl-8 pr-3 py-1.5 bg-indigo-900/30 border border-indigo-800 rounded text-xs text-white placeholder-indigo-700 focus:border-yellow-500 outline-none transition-all h-8 resize-none"
                  placeholder="Ghi chú riêng cho ghế..."
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                />
              </div>
            </div>
          </div>

          <Button
            onClick={handleSaveOnly}
            disabled={isSaving}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-9 text-sm border border-indigo-700 shadow-sm"
          >
            <Save size={14} className="mr-2" /> Cập nhật thông tin
          </Button>
        </div>

        {/* RIGHT: Financial Actions / Cancel Actions */}
        {!isSold && (
          <div className="w-full md:w-[280px] bg-indigo-900/20 p-4 flex flex-col gap-4 border-t md:border-t-0 md:border-l border-indigo-900/50 shadow-xl overflow-y-auto animate-in fade-in duration-300">
            <div className="bg-indigo-900/50 rounded-lg p-3 border border-indigo-800 space-y-3 shadow-inner mt-2">
              <div className="flex items-center gap-2 text-indigo-400 text-[10px] font-black uppercase tracking-widest">
                <Calculator size={12} /> Giá vé thu thực tế
              </div>
              <div className="text-2xl font-black text-yellow-400 tracking-tight">
                {seatPrice.toLocaleString("vi-VN")}{" "}
                <span className="text-[10px] font-normal opacity-60">VNĐ</span>
              </div>
            </div>

            {isBooked && (
              <div className="space-y-3 animate-in fade-in slide-in-from-right-2 duration-300 mt-[2px]">
                <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest px-1 flex items-center gap-2">
                  <CreditCard size={12} className="text-emerald-400" /> Thu tiền
                  lẻ ghế này
                </div>

                <div className="space-y-2">
                  <div className="relative group">
                    <div className="absolute left-2.5 top-2 text-indigo-500 group-focus-within:text-green-500 transition-colors">
                      <DollarSign size={14} />
                    </div>
                    <input
                      title="Số tiền thu bằng tiền mặt"
                      name="paidCash"
                      className="w-full pl-8 pr-10 py-1.5 bg-indigo-950 border border-indigo-800 rounded text-right font-bold text-xs text-white focus:border-green-500 outline-none transition-all"
                      value={paymentInput.paidCash.toLocaleString("vi-VN")}
                      onChange={handleMoneyChange}
                    />
                    <span className="absolute right-2.5 top-2 text-[9px] font-black text-indigo-700">
                      TM
                    </span>
                  </div>
                  <div className="relative group">
                    <div className="absolute left-2.5 top-2 text-indigo-500 group-focus-within:text-blue-500 transition-colors">
                      <CreditCard size={14} />
                    </div>
                    <input
                      title="Số tiền thu bằng chuyển khoản"
                      name="paidTransfer"
                      className="w-full pl-8 pr-10 py-1.5 bg-indigo-950 border border-indigo-800 rounded text-right font-bold text-xs text-white focus:border-blue-500 outline-none transition-all"
                      value={paymentInput.paidTransfer.toLocaleString("vi-VN")}
                      onChange={handleMoneyChange}
                    />
                    <span className="absolute right-2.5 top-2 text-[9px] font-black text-indigo-700">
                      CK
                    </span>
                  </div>
                </div>

                <Button
                  onClick={handlePaySeat}
                  disabled={
                    isSaving ||
                    paymentInput.paidCash + paymentInput.paidTransfer === 0
                  }
                  className="w-full bg-green-600 hover:bg-green-500 text-white font-black uppercase text-[10px] h-9 shadow-lg shadow-green-900/20 border border-green-700"
                >
                  {isSaving ? (
                    <Loader2 className="animate-spin mr-2" size={14} />
                  ) : (
                    <CheckCircle2 size={14} className="mr-2" />
                  )}
                  Xác nhận thu tiền
                </Button>
              </div>
            )}

            {isHeld && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300 mt-2">
                <div className="bg-purple-900/30 p-3 rounded-lg border border-purple-800/50 flex items-start gap-2">
                   <AlertTriangle size={16} className="text-purple-400 shrink-0 mt-0.5" />
                   <p className="text-[10px] text-purple-300 italic">Ghế đang được giữ chỗ. Bạn có thể cập nhật thông tin khách hoặc hủy lệnh giữ chỗ này.</p>
                </div>

                <Button
                  onClick={handleRefundSeat}
                  disabled={isSaving}
                  className="w-full bg-red-600 hover:bg-red-500 text-white font-black uppercase text-[10px] h-9 shadow-lg shadow-red-900/20 border border-red-700"
                >
                  {isSaving ? (
                    <Loader2 className="animate-spin mr-2" size={14} />
                  ) : (
                    <Trash2 size={14} className="mr-2" />
                  )}
                  Hủy giữ chỗ
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
};

const Loader2 = ({
  className,
  size = 16,
}: {
  className?: string;
  size?: number;
}) => (
  <svg
    className={`animate-spin ${className}`}
    style={{ width: size, height: size }}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    ></circle>
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    ></path>
  </svg>
);
