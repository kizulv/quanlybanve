import React, { useState, useMemo } from "react";
import { Seat, Booking, BusTrip, Route } from "../types";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { formatLunarDate } from "../utils/dateUtils";
import {
  Ticket,
  RotateCcw,
  Zap,
  Banknote,
  Lock,
  Phone,
  History,
  X,
  Clock,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Save,
  AlertTriangle,
  MapPin,
  Locate,
  Notebook,
  ArrowRightLeft,
} from "lucide-react";

interface BookingFormProps {
  // Data
  bookingForm: {
    phone: string;
    pickup: string;
    dropoff: string;
    paidCash: number;
    paidTransfer: number;
    note: string;
  };
  setBookingForm: React.Dispatch<
    React.SetStateAction<{
      phone: string;
      pickup: string;
      dropoff: string;
      paidCash: number;
      paidTransfer: number;
      note: string;
    }>
  >;
  bookingMode: "booking" | "payment" | "hold";
  setBookingMode: (mode: "booking" | "payment" | "hold") => void;
  selectionBasket: { trip: BusTrip; seats: Seat[] }[];
  bookings: Booking[]; // For history lookup
  routes: Route[]; // For basket display info
  totalPrice: number;
  phoneError: string | null;
  setPhoneError: (error: string | null) => void;

  // NEW: Editing Context
  editingBooking?: Booking | null;

  // Actions
  onConfirm: () => void;
  onCancel: () => void;
  validatePhoneNumber: (phone: string) => string | null;
  
  // NEW: Swap Action
  onInitiateSwap?: (seat: Seat) => void;
}

export const BookingForm: React.FC<BookingFormProps> = ({
  bookingForm,
  setBookingForm,
  bookingMode,
  setBookingMode,
  selectionBasket,
  bookings,
  routes,
  totalPrice,
  phoneError,
  setPhoneError,
  editingBooking,
  onConfirm,
  onCancel,
  validatePhoneNumber,
  onInitiateSwap,
}) => {
  const [showHistory, setShowHistory] = useState(false);

  // --- HELPERS ---
  const formatPhoneNumber = (value: string) => {
    const raw = value.replace(/\D/g, "");
    if (raw.length > 15) return raw.slice(0, 15);
    if (raw.length > 7) {
      return `${raw.slice(0, 4)} ${raw.slice(4, 7)} ${raw.slice(7)}`;
    }
    if (raw.length > 4) {
      return `${raw.slice(0, 4)} ${raw.slice(4)}`;
    }
    return raw;
  };

  const getStandardizedLocation = (input: string) => {
    if (!input) return "";
    let value = input.trim();
    const lower = value.toLowerCase();
    const mappings: Record<string, string> = {
      "lai chau": "BX Lai Châu",
      "lai châu": "BX Lai Châu",
      "ha tinh": "BX Hà Tĩnh",
      "hà tĩnh": "BX Hà Tĩnh",
      "lao cai": "BX Lào Cai",
      vinh: "BX Vinh",
      "nghe an": "BX Vinh",
      "nghệ an": "BX Vinh",
    };
    if (mappings[lower]) return mappings[lower];

    // Auto prefix if needed
    if (!/^bx\s/i.test(value) && value.length > 2) {
      value = value.replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());
      return `BX ${value}`;
    }
    return value.replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());
  };

  // --- HANDLER FOR MODE SWITCHING ---
  const handleModeSwitch = (mode: "booking" | "payment" | "hold") => {
    setBookingMode(mode);

    // Auto-logic for payment fields
    if (mode === "payment") {
      // If switching to payment, autofill full price if currently 0
      if (bookingForm.paidCash === 0 && bookingForm.paidTransfer === 0) {
        setBookingForm((prev) => ({
          ...prev,
          paidCash: totalPrice,
          paidTransfer: 0,
        }));
      }
    } else {
      // If switching to Booking/Hold, clear payment (assume unpaid)
      // Unless user manually keeps it, but usually switching mode means changing intent
      setBookingForm((prev) => ({ ...prev, paidCash: 0, paidTransfer: 0 }));
    }
  };

  // --- HISTORY LOGIC ---
  const historyMatches = useMemo(() => {
    const cleanInput = bookingForm.phone.replace(/\D/g, "");
    if (cleanInput.length < 3) return [];
    return bookings.filter((b) =>
      b.passenger.phone.replace(/\D/g, "").includes(cleanInput)
    );
  }, [bookings, bookingForm.phone]);

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
      const isNewer = existing
        ? new Date(b.createdAt) > new Date(existing.lastDate)
        : true;

      if (!existing || isNewer) {
        uniqueRoutes.set(key, {
          pickup: b.passenger.pickupPoint || "",
          dropoff: b.passenger.dropoffPoint || "",
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

  const applyHistory = (item: (typeof passengerHistory)[0]) => {
    setBookingForm((prev) => ({
      ...prev,
      phone: item.phone,
      pickup: item.pickup,
      dropoff: item.dropoff,
    }));
    setPhoneError(null);
    setShowHistory(false);
  };

  // --- HANDLERS ---
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    if (name === "phone") {
      setBookingForm((prev) => ({ ...prev, [name]: formatPhoneNumber(value) }));
      setPhoneError(null);
      setShowHistory(true);
      return;
    }
    if (name === "pickup" || name === "dropoff") {
      const formatted = value.replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());
      setBookingForm((prev) => ({ ...prev, [name]: formatted }));
      return;
    }
    setBookingForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhoneBlur = () => {
    if (bookingForm.phone.length > 0) {
      const error = validatePhoneNumber(bookingForm.phone);
      setPhoneError(error);
    }
    setTimeout(() => setShowHistory(false), 200);
  };

  const handleLocationBlur = (field: "pickup" | "dropoff") => {
    let value = bookingForm[field].trim();
    if (!value) return;
    const standardized = getStandardizedLocation(value);
    if (standardized !== value) {
      setBookingForm((prev) => ({ ...prev, [field]: standardized }));
    }
  };

  // --- CHANGE DETECTION LOGIC (EDIT MODE) ---
  const changes = useMemo(() => {
    if (!editingBooking) return null;

    const originalCount = editingBooking.totalTickets;
    const currentCount = selectionBasket.reduce(
      (acc, item) => acc + item.seats.length,
      0
    );

    const originalPrice = editingBooking.totalPrice;
    const currentPrice = totalPrice;

    if (originalCount === currentCount && originalPrice === currentPrice)
      return null;

    const diffCount = currentCount - originalCount;
    const diffPrice = currentPrice - originalPrice;

    return {
      diffCount,
      diffPrice,
      hasChanges: true,
    };
  }, [editingBooking, selectionBasket, totalPrice]);

  // --- RENDER HELPERS ---
  const renderBasketItems = () => {
    // If basket is empty (unlikely in edit mode unless user deselected all)
    if (selectionBasket.length === 0) {
      return (
        <div
          className={`text-center py-6 text-xs border-2 border-dashed rounded-lg transition-colors
                ${
                  editingBooking
                    ? "border-red-800/30 bg-red-900/10 text-red-300"
                    : "border-indigo-900 text-indigo-300/50"
                }
            `}
        >
          {editingBooking ? "Đã xóa hết giường (Sẽ hủy vé)" : "Chọn giường"}
        </div>
      );
    }

    // Unified Basket View (Edit mode simply uses the same selectionBasket)
    return (
      <div className="grid grid-cols-2 gap-2">
        {selectionBasket.map((item, idx) => {
          const tripDate = new Date(item.trip.departureTime);
          const routeInfo = routes.find((r) => r.id === item.trip.routeId);
          const isEnhanced =
            routeInfo?.isEnhanced || item.trip.name.includes("Tăng cường");

          return (
            <div
              key={idx}
              className="bg-indigo-900 border border-indigo-700 rounded-lg p-2.5 text-white relative"
            >
              <div
                className="text-xs text-white mb-1 truncate flex items-center"
                title={item.trip.route}
              >
                {item.trip.route}
                {isEnhanced && (
                  <span title="Tăng cường" className="flex items-center">
                    <Zap
                      size={10}
                      className="text-[9px] ml-1 fill-amber-700 text-yellow-400"
                    />
                  </span>
                )}
              </div>
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-1.5">
                  <Clock size={12} className="text-slate-400" />
                  <span className="text-[9px] text-slate-400">
                    {tripDate.getDate()}/{tripDate.getMonth() + 1} {" - "}
                    {formatLunarDate(tripDate).replace(" Âm Lịch", " Âm")}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {item.seats.map((s) => (
                  <div key={s.id} className="relative group">
                      <span
                        className="inline-block bg-indigo-100 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-indigo-200 cursor-default"
                      >
                        {s.label}
                      </span>
                      {/* SWAP BUTTON - Only in edit mode */}
                      {editingBooking && onInitiateSwap && (
                          <button 
                             onClick={(e) => { e.stopPropagation(); onInitiateSwap(s); }}
                             className="absolute -top-2 -right-2 bg-white text-indigo-600 rounded-full p-0.5 shadow-sm border border-slate-200 opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-indigo-50"
                             title="Đổi chỗ"
                          >
                              <ArrowRightLeft size={10} />
                          </button>
                      )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const totalItemCount = selectionBasket.reduce(
    (acc, item) => acc + item.seats.length,
    0
  );

  return (
    <div className="bg-indigo-950 rounded-xl shadow-lg border border-indigo-900 flex flex-col overflow-visible shrink-0 z-20 max-h-[75%] transition-colors duration-300">
      {/* 1. Basket Header */}
      <div className="px-3 h-[40px] bg-gradient-to-r from-indigo-950 via-indigo-900 to-indigo-950 border-b border-indigo-900 flex items-center justify-between shrink-0 rounded-t-xl">
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          <Ticket size={16} className="text-yellow-400" />
          {editingBooking ? "Chỉnh sửa" : "Đặt vé mới"}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            disabled={selectionBasket.length === 0 && !editingBooking}
            className="text-indigo-300 hover:text-white hover:bg-indigo-800 p-1.5 rounded-full transition-colors disabled:opacity-30"
            title={editingBooking ? "Đóng" : "Hủy chọn tất cả"}
          >
            {editingBooking ? <X size={16} /> : <RotateCcw size={14} />}
          </button>
          <Badge className="bg-yellow-400 text-indigo-950 font-bold border-transparent">
            {totalItemCount} vé
          </Badge>
        </div>
      </div>

      {/* 2. Basket Items */}
      <div className="p-3 overflow-y-auto flex-1 bg-indigo-950">
        {renderBasketItems()}
      </div>

      {/* CHANGE WARNING ALERT (Edit Mode Only) */}
      {changes && changes.hasChanges && (
        <div className="px-3 pb-3 bg-indigo-950 animate-in fade-in slide-in-from-bottom-2">
          <div
            className={`border rounded-lg p-2 text-xs flex items-start gap-2 ${
              selectionBasket.length === 0
                ? "bg-red-500/10 border-red-500/30 text-red-200"
                : "bg-amber-500/10 border-amber-500/30 text-amber-200"
            }`}
          >
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="font-bold mb-0.5">
                {selectionBasket.length === 0
                  ? "Cảnh báo hủy vé:"
                  : "Thay đổi đặt chỗ:"}
              </div>
              <div className="flex flex-col gap-0.5 opacity-90">
                {selectionBasket.length === 0 ? (
                  <span>
                    Bạn đang xóa hết ghế. Đơn hàng sẽ chuyển sang trạng thái{" "}
                    <strong>Đã hủy</strong>.
                  </span>
                ) : (
                  <>
                    {changes.diffCount !== 0 && (
                      <span>
                        • Số lượng:{" "}
                        {changes.diffCount > 0
                          ? `+${changes.diffCount}`
                          : changes.diffCount}{" "}
                        vé
                      </span>
                    )}
                    {changes.diffPrice !== 0 && (
                      <span>
                        • Tổng tiền: {changes.diffPrice > 0 ? `+` : ``}
                        {changes.diffPrice.toLocaleString("vi-VN")} đ
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Mode Selector - ALWAYS VISIBLE */}
      <div className="px-3 pb-3 bg-indigo-950">
        <div className="bg-indigo-900/50 p-1 rounded-lg flex border border-indigo-800">
          <button
            onClick={() => handleModeSwitch("booking")}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs rounded-md transition-all ${
              bookingMode === "booking"
                ? "bg-yellow-500 text-indigo-950 shadow-sm"
                : "text-indigo-300 hover:text-white"
            }`}
          >
            <Ticket size={12} /> Đặt vé
          </button>
          <button
            onClick={() => handleModeSwitch("payment")}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs rounded-md transition-all ${
              bookingMode === "payment"
                ? "bg-yellow-500 text-indigo-950 shadow-sm"
                : "text-indigo-300 hover:text-white"
            }`}
          >
            <Banknote size={12} /> Mua vé
          </button>
          <button
            onClick={() => handleModeSwitch("hold")}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs rounded-md transition-all ${
              bookingMode === "hold"
                ? "bg-yellow-500 text-indigo-950 shadow-sm"
                : "text-indigo-300 hover:text-white"
            }`}
          >
            <Lock size={12} /> Giữ vé
          </button>
        </div>
      </div>

      {/* 4. Input Fields */}
      <div className="p-3 border-t bg-indigo-900/50 border-indigo-900 space-y-2 relative">
        {bookingMode !== "hold" ? (
          <>
            <div className="relative">
              <input
                type="tel"
                name="phone"
                value={bookingForm.phone}
                onChange={handleInputChange}
                onBlur={handlePhoneBlur}
                onFocus={() => {
                  if (bookingForm.phone.length >= 3) setShowHistory(true);
                }}
                className={`w-full pl-6 pr-2 py-1.5 text-xs rounded border text-white placeholder-indigo-400 outline-none transition-colors
                  bg-indigo-950 border-indigo-800 focus:border-yellow-400
                  ${phoneError ? "border-red-500 focus:border-red-500" : ""}
                `}
                placeholder="Số điện thoại"
              />
              <Phone
                size={12}
                className={`absolute left-2 top-[9px] ${
                  phoneError ? "text-red-500" : "text-indigo-400"
                }`}
              />

              {/* HISTORY DROPDOWN - Always available if matches exist */}
              {showHistory && passengerHistory.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden z-[50] animate-in fade-in zoom-in-95 duration-200">
                  <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-100 flex justify-between items-center">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase">
                      <History size={10} />
                      Lịch sử
                      <span className="ml-1 bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full text-[9px] min-w-[16px] text-center">
                        {historyMatches.length}
                      </span>
                    </div>
                    <button
                      title="Đóng"
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setShowHistory(false);
                      }}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <div className="max-h-[200px] overflow-y-auto">
                    {passengerHistory.map((item, idx) => (
                      <div
                        key={idx}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          applyHistory(item);
                        }}
                        className="px-3 py-2 hover:bg-indigo-50 cursor-pointer border-b border-slate-50 last:border-0 group"
                      >
                        <div className="flex justify-between items-start mb-0.5">
                          <span className="text-xs font-bold text-indigo-700">
                            {item.phone}
                          </span>
                          <span className="text-[9px] text-slate-400 flex items-center gap-1">
                            <Clock size={9} />
                            {new Date(item.lastDate).toLocaleDateString(
                              "vi-VN"
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
                          <span className="truncate max-w-[45%] font-medium">
                            {item.pickup}
                          </span>
                          <ArrowRight size={10} className="text-slate-300" />
                          <span className="truncate max-w-[45%] font-medium">
                            {item.dropoff}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {phoneError && (
              <div className="text-[10px] text-red-400 px-1 flex items-center gap-1">
                <AlertCircle size={10} /> {phoneError}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <input
                  type="text"
                  name="pickup"
                  value={bookingForm.pickup}
                  onChange={handleInputChange}
                  onBlur={() => handleLocationBlur("pickup")}
                  className="w-full pl-6 pr-2 py-1.5 text-xs rounded border text-white placeholder-indigo-400 outline-none
                    bg-indigo-950 border-indigo-800 focus:border-green-500"
                  placeholder="Điểm đón"
                />
                <MapPin
                  size={12}
                  className="absolute left-2 top-[9px] text-indigo-400"
                />
              </div>
              <div className="relative">
                <input
                  type="text"
                  name="dropoff"
                  value={bookingForm.dropoff}
                  onChange={handleInputChange}
                  onBlur={() => handleLocationBlur("dropoff")}
                  className="w-full pl-6 pr-2 py-1.5 text-xs rounded border text-white placeholder-indigo-400 outline-none
                    bg-indigo-950 border-indigo-800 focus:border-red-500"
                  placeholder="Điểm trả"
                />
                <Locate
                  size={12}
                  className="absolute left-2 top-[9px] text-indigo-400"
                />
              </div>
            </div>
            <div className="relative">
              <textarea
                name="note"
                value={bookingForm.note}
                onChange={handleInputChange}
                className="w-full pl-6 pr-2 py-1.5 text-xs rounded border text-white placeholder-indigo-400 outline-none resize-none h-8
                 bg-indigo-950 border-indigo-800 focus:border-yellow-400"
                placeholder="Ghi chú"
              />
              <Notebook
                size={12}
                className="absolute left-2 top-[9px] text-indigo-400"
              />
            </div>
          </>
        ) : (
          <div className="text-center py-4 bg-indigo-900/30 rounded border border-indigo-800 border-dashed text-xs text-indigo-300">
            <Lock className="mx-auto mb-1 opacity-50" size={24} />
            Chế độ Giữ vé không yêu cầu nhập thông tin khách hàng.
          </div>
        )}

        {/* Total Price */}
        <div className="flex justify-between items-center pt-1">
          <span className="text-xs font-bold uppercase text-indigo-300">
            TỔNG TIỀN
          </span>
          <span className="text-base font-bold text-yellow-400">
            {totalPrice.toLocaleString("vi-VN")}{" "}
            <span className="text-[10px] font-normal">đ</span>
          </span>
        </div>
      </div>

      {/* 5. Submit Button */}
      <div className="p-2 border-t rounded-b-xl bg-indigo-950 border-indigo-900">
        <Button
          className={`w-full font-bold h-10 text-sm bg-yellow-500 hover:bg-yellow-400 text-indigo-950`}
          onClick={onConfirm}
          disabled={!editingBooking && selectionBasket.length === 0}
        >
          {editingBooking ? (
            <>
              <Save size={16} className="mr-2" />{" "}
              {selectionBasket.length === 0 ? "Xác nhận hủy" : "Chỉnh sửa"}
            </>
          ) : (
            <>
              <CheckCircle2 size={16} className="mr-2" /> Đồng ý
            </>
          )}
        </Button>
      </div>
    </div>
  );
};