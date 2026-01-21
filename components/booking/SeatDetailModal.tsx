import React, { useState, useEffect, useMemo } from "react";
import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";
import { Booking, Seat, Passenger, SeatStatus } from "../../types";
import {
  Save,
  MapPin,
  Locate,
  Notebook,
  Phone,
  CreditCard,
  Loader2,
  DollarSign,
  CheckCircle2,
  Tag,
  Trash2,
} from "lucide-react";
import {
  formatPhoneNumber,
  getStandardizedLocation,
  formatCurrency,
  parseCurrency,
} from "../../utils/formatters";
import { CurrencyInput } from "../ui/CurrencyInput";

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
    },
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

  const [ticketPrice, setTicketPrice] = useState(0); // Giá vé có thể chỉnh sửa
  const [exactBed, setExactBed] = useState(false); // ✅ Xếp đúng giường
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
          i.seatIds.includes(seat.id),
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
            // ✅ Khởi tạo exactBed từ ticket
            setExactBed(ticket.exactBed || false);
          }
          // Prioritize ticket specific info if available
          const ticketName =
            ticket?.name || booking.passenger.name || "Khách lẻ";
          const ticketPhone = ticket?.phone || booking.passenger.phone || "";

          setForm({
            phone: formatPhoneNumber(ticketPhone),
            pickup: initialPickup,
            dropoff: initialDropoff,
            note: initialNote,
            name: ticketName,
          });
        } else {
          initialNote = booking.passenger.note || "";
          setForm({
            phone: formatPhoneNumber(booking.passenger.phone),
            pickup: initialPickup,
            dropoff: initialDropoff,
            note: initialNote,
            name: booking.passenger.name || "Khách lẻ",
          });
        }

        // Khởi tạo giá vé
        setTicketPrice(seatPrice);

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
        setTicketPrice(0);
        setExactBed(false);
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
        b &&
        b.status !== "cancelled" &&
        b.passenger?.phone &&
        b.passenger.phone.replace(/\D/g, "").includes(cleanInput),
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
          new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime(),
      )
      .slice(0, 5);
  }, [historyMatches]);

  const handleMoneyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPaymentInput((prev) => ({
      ...prev,
      [name]: parseCurrency(value),
    }));
  };

  const handleTicketPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPrice = parseCurrency(e.target.value);
    setTicketPrice(newPrice);
    // Tự động điền vào ô tiền mặt
    setPaymentInput({ paidCash: newPrice, paidTransfer: 0 });
  };

  const handleSaveOnly = async () => {
    setIsSaving(true);
    try {
      await onSave({
        ...form,
        phone: formatPhoneNumber(form.phone),
        pickupPoint: form.pickup,
        dropoffPoint: form.dropoff,
        exactBed: exactBed, // ✅ Truyền exactBed
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
          phone: formatPhoneNumber(form.phone),
          pickupPoint: form.pickup,
          dropoffPoint: form.dropoff,
          exactBed: exactBed, // ✅ Truyền exactBed
        },
        { action: "PAY", payment: paymentInput },
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
          phone: formatPhoneNumber(form.phone),
          pickupPoint: form.pickup,
          dropoffPoint: form.dropoff,
          exactBed: exactBed, // ✅ Truyền exactBed
        },
        { action: "REFUND" },
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (!seat) return null;

  const isSold = seat.status === SeatStatus.SOLD;
  const isBooked = seat.status === SeatStatus.BOOKED;
  const isHeld = seat.status === SeatStatus.HELD;

  const showRightPanel = isBooked;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={`${seat.label} - ${
        isSold ? "Đã thanh toán" : isBooked ? "Đã đặt vé" : "Đang giữ"
      }`}
      className={`${
        !showRightPanel ? "max-w-md" : "max-w-3xl"
      } text-white border-indigo-900 rounded-xl overflow-hidden transition-all duration-300`}
      headerClassName="h-[40px] bg-gradient-to-r from-indigo-950 via-indigo-900 to-indigo-950 border-indigo-900 text-white text-xs font-semibold"
      footer={
        <div
          className={`flex gap-2 pt-2 ${
            isHeld || isBooked ? "justify-between" : "justify-center"
          }`}
        >
          {isHeld && (
            <Button
              onClick={handleRefundSeat}
              disabled={isSaving}
              variant="custom"
              className="bg-red-600 hover:bg-red-500 text-white font-bold h-9 text-xs border border-red-700 shadow-sm"
            >
              <Trash2 size={14} className="mr-1" /> Hủy giữ chỗ
            </Button>
          )}

          {isBooked && (
            <Button
              onClick={handleRefundSeat}
              disabled={isSaving}
              variant="custom"
              className="bg-red-700 hover:bg-red-800 text-white font-bold h-9 text-xs border border-red-700 shadow-sm"
            >
              <Trash2 size={14} className="mr-1" /> Hủy vé
            </Button>
          )}
          <Button
            onClick={handleSaveOnly}
            disabled={isSaving}
            variant="custom"
            className="w-62 bg-indigo-950 hover:bg-indigo-900 text-white font-bold h-9 text-xs border border-indigo-900 shadow-sm"
          >
            <Save size={14} className="mr-1" /> Cập nhật
          </Button>
        </div>
      }
    >
      <div className="flex flex-col md:flex-row h-full">
        {/* LEFT: Customer Info */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 text-slate-700">
          <div className="space-y-3 bg-white p-4 rounded border border-slate-200">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest ml-1">
                Số điện thoại
              </label>
              <div className="relative">
                <div className="absolute left-2.5 top-2 pointer-events-none ">
                  <Phone size={14} />
                </div>
                <input
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs  placeholder-slate-400 focus:border-yellow-500 outline-none transition-all"
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
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95">
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
                <label className="text-[10px] font-black uppercase tracking-widest ml-1">
                  Điểm đón
                </label>
                <div className="relative">
                  <div className="absolute left-2.5 top-2 pointer-events-none">
                    <MapPin size={14} />
                  </div>
                  <input
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 placeholder-slate-400 focus:border-yellow-500 outline-none transition-all"
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
                <label className="text-[10px] font-black uppercase tracking-widest ml-1">
                  Điểm trả
                </label>
                <div className="relative">
                  <div className="absolute left-2.5 top-2 pointer-events-none">
                    <Locate size={14} />
                  </div>
                  <input
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 placeholder-slate-400 focus:border-yellow-500 outline-none transition-all"
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
              <label className="text-[10px] font-black uppercase tracking-widest ml-1">
                Ghi chú
              </label>
              <div className="relative">
                <div className="absolute left-2.5 top-2 pointer-events-none">
                  <Notebook size={14} />
                </div>
                <textarea
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 placeholder-slate-400 focus:border-yellow-500 outline-none transition-all h-8 resize-none"
                  placeholder="Ghi chú riêng cho ghế..."
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* ✅ Checkbox Xếp đúng giường - chỉ hiển thị cho ghế booking */}
          {isBooked && (
            <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded">
              <input
                type="checkbox"
                id="exactBed"
                checked={exactBed}
                onChange={(e) => setExactBed(e.target.checked)}
                className="w-4 h-4 text-amber-700 border-amber-400 rounded focus:ring-amber-500"
              />
              <label
                htmlFor="exactBed"
                className="text-xs font-semibold text-amber-900 cursor-pointer select-none"
              >
                Xếp đúng giường
              </label>
            </div>
          )}
        </div>

        {/* RIGHT: Financial Actions */}
        {showRightPanel && (
          <div className="w-full md:w-70 bg-white p-4 flex flex-col gap-4 border-t md:border-t-0 md:border-l border-slate-200 overflow-y-auto animate-in fade-in duration-300 text-slate-700 ">
            <div className="flex-1 space-y-3">
              <div className="rounded space-y-1">
                <div className="relative">
                  <div className="absolute left-2.5 top-2.5 pointer-events-none text-sm font-black uppercase">
                    Giá vé
                  </div>
                  <CurrencyInput
                    value={ticketPrice}
                    onChange={handleTicketPriceChange}
                    className="w-full pl-9 pr-9.5 py-1 bg-slate-50 border border-slate-200 rounded text-right font-black text-lg focus:border-yellow-500 focus:outline-none transition-all"
                  />
                  <span className="absolute right-2 top-3 text-xs font-black">
                    VNĐ
                  </span>
                </div>
              </div>
              <div className="space-y-3 animate-in fade-in slide-in-from-right-2 duration-300">
                <div className="text-[10px] font-black  uppercase tracking-widest px-1 flex items-center gap-2">
                  <CreditCard size={14} className="" /> Thu tiền
                </div>

                <div className="space-y-2">
                  <div className="relative group">
                    <div className="absolute left-2.5 top-2 group-focus-within:text-green-500 transition-colors text-[9px] font-black">
                      TM
                    </div>
                    <CurrencyInput
                      title="Số tiền thu bằng tiền mặt"
                      name="paidCash"
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-right font-bold text-xs  focus:border-green-500 focus:text-green-500 outline-none transition-all"
                      value={paymentInput.paidCash}
                      onChange={handleMoneyChange}
                    />
                  </div>
                  <div className="relative group">
                    <div className="absolute left-2.5 top-2 group-focus-within:text-blue-500 transition-colors text-[9px] font-black">
                      CK
                    </div>
                    <CurrencyInput
                      title="Số tiền thu bằng chuyển khoản"
                      name="paidTransfer"
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-right font-bold text-xs  focus:border-blue-500 focus:text-blue-500 outline-none transition-all"
                      value={paymentInput.paidTransfer}
                      onChange={handleMoneyChange}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handlePaySeat}
                variant="custom"
                disabled={
                  isSaving ||
                  paymentInput.paidCash + paymentInput.paidTransfer === 0
                }
                className="w-full bg-blue-900 hover:bg-blue-800 text-white font-black uppercase text-[10px] h-9 shadow-lg  border border-blue-800 mt-3"
              >
                {isSaving ? (
                  <Loader2 className="animate-spin mr-2" size={14} />
                ) : (
                  <CheckCircle2 size={14} className="mr-2" />
                )}
                Xác nhận thu tiền
              </Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
};
