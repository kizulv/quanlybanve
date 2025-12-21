
import React, { useState, useMemo, useEffect } from "react";
import { Seat, Booking, BusTrip, Route, UndoAction } from "../types";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { formatLunarDate } from "../utils/dateUtils";
import { api } from "../lib/api";
import { useToast } from "./ui/Toast";
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
  CreditCard,
  FileEdit,
  Calendar,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/AlertDialog";

interface SeatOverride {
  price?: number;
  pickup?: string;
  dropoff?: string;
}

interface BookingFormProps {
  // Data from Parent
  selectionBasket: { trip: BusTrip; seats: Seat[] }[];
  totalBasketPrice: number;
  bookings: Booking[];
  routes: Route[];
  editingBooking: Booking | null;
  
  // Callback to update parent state
  onDataUpdate: (trips: BusTrip[], bookings: Booking[]) => void;
  onCancelEdit: () => void;
  onAddUndo: (action: UndoAction) => void;
  onInitiateSwap?: (seat: Seat) => void;
  onNavigateToTrip?: (date: Date, tripId: string) => void;
  
  // Trigger for Payment Modal (which stays in App for now due to complexity)
  onOpenPaymentModal: (context: any, input: any, overrides: any) => void;
}

export const BookingForm: React.FC<BookingFormProps> = ({
  selectionBasket,
  totalBasketPrice,
  bookings,
  routes,
  editingBooking,
  onDataUpdate,
  onCancelEdit,
  onAddUndo,
  onInitiateSwap,
  onNavigateToTrip,
  onOpenPaymentModal,
}) => {
  const { toast } = useToast();
  
  // -- INTERNAL STATE --
  const [bookingForm, setBookingForm] = useState({
    phone: "",
    pickup: "",
    dropoff: "",
    note: "",
  });
  const [bookingMode, setBookingMode] = useState<"booking" | "payment" | "hold">("booking");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Edit Confirmation State
  interface DiffSeat { label: string; status: "kept" | "added" | "removed"; }
  interface TripDiffItem { route: string; date: Date; seats: DiffSeat[]; }
  const [updateSummary, setUpdateSummary] = useState<{
    diffCount: number; diffPrice: number; oldPrice: number; newPrice: number; diffTrips: TripDiffItem[];
    newSeatCount: number;
  } | null>(null);

  // Sync form when editingBooking changes
  useEffect(() => {
    if (editingBooking) {
      const currentMode = editingBooking.status === "payment" ? "payment" : editingBooking.status === "hold" ? "hold" : "booking";
      setBookingMode(currentMode);
      
      const rawNote = editingBooking.passenger.note || "";
      const cleanNote = rawNote
        .replace(/\s*\(Chuyển sang [^\)]+\)/g, "")
        .replace(/\s*\(Cần thu thêm: [^\)]+\)/g, "")
        .replace(/\s*\(Cần hoàn lại: [^\)]+\)/g, "")
        .trim();

      setBookingForm({
        phone: editingBooking.passenger.phone,
        pickup: editingBooking.passenger.pickupPoint || "",
        dropoff: editingBooking.passenger.dropoffPoint || "",
        note: cleanNote,
      });
    } else {
      // Clear form when exiting edit mode but keep pickup/dropoff if seats are still selected
      setBookingForm(prev => ({ ...prev, phone: "", note: "" }));
      setBookingMode("booking");
      setPhoneError(null);
    }
  }, [editingBooking]);

  // -- UTILS --
  const validatePhoneNumber = (phone: string): string | null => {
    const raw = phone.replace(/\D/g, "");
    if (raw.length === 0) return "Vui lòng nhập số điện thoại";
    if (!raw.startsWith("0")) return "SĐT phải bắt đầu bằng số 0";
    if (raw.length !== 10) return "SĐT phải đủ 10 số";
    return null;
  };

  const formatPhoneNumber = (value: string) => {
    const raw = value.replace(/\D/g, "");
    if (raw.length > 10) return raw.slice(0, 10);
    if (raw.length > 7) return `${raw.slice(0, 4)} ${raw.slice(4, 7)} ${raw.slice(7)}`;
    if (raw.length > 4) return `${raw.slice(0, 4)} ${raw.slice(4)}`;
    return raw;
  };

  const getStandardizedLocation = (input: string) => {
    if (!input) return "";
    let value = input.trim();
    const lower = value.toLowerCase();
    const mappings: Record<string, string> = {
      "lai chau": "BX Lai Châu", "lai châu": "BX Lai Châu",
      "ha tinh": "BX Hà Tĩnh", "hà tĩnh": "BX Hà Tĩnh",
      "lao cai": "BX Lào Cai", "vinh": "BX Vinh",
      "nghe an": "BX Vinh", "nghệ an": "BX Vinh",
    };
    if (mappings[lower]) return mappings[lower];
    if (!/^bx\s/i.test(value) && value.length > 2) {
      return value.replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());
    }
    return value.replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());
  };

  // -- HISTORY LOGIC --
  const historyMatches = useMemo(() => {
    const cleanInput = bookingForm.phone.replace(/\D/g, "");
    if (cleanInput.length < 3) return [];
    return bookings.filter(b => b.status !== "cancelled" && b.passenger.phone.replace(/\D/g, "").includes(cleanInput));
  }, [bookings, bookingForm.phone]);

  const passengerHistory = useMemo(() => {
    const uniqueRoutes = new Map<string, { pickup: string; dropoff: string; phone: string; lastDate: string }>();
    historyMatches.forEach((b) => {
      const pickup = b.passenger.pickupPoint || "";
      const dropoff = b.passenger.dropoffPoint || "";
      if (!pickup && !dropoff) return;
      const key = `${pickup.toLowerCase().trim()}|${dropoff.toLowerCase().trim()}`;
      const existing = uniqueRoutes.get(key);
      const isNewer = existing ? new Date(b.createdAt) > new Date(existing.lastDate) : true;
      if (!existing || isNewer) {
        uniqueRoutes.set(key, { pickup, dropoff, phone: formatPhoneNumber(b.passenger.phone), lastDate: b.createdAt });
      }
    });
    return Array.from(uniqueRoutes.values()).sort((a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime()).slice(0, 5);
  }, [historyMatches]);

  const applyHistory = (item: (typeof passengerHistory)[0]) => {
    setBookingForm(prev => ({ ...prev, phone: item.phone, pickup: item.pickup, dropoff: item.dropoff }));
    setPhoneError(null);
    setShowHistory(false);
  };

  // -- CORE BOOKING LOGIC --
  const processBooking = async (
    paymentData?: { paidCash: number; paidTransfer: number },
    overrides: Record<string, SeatOverride> = {},
    noteSuffix: string = "",
    explicitStatus?: "booking" | "payment" | "hold"
  ) => {
    if (selectionBasket.length === 0) {
      toast({ type: "warning", title: "Chưa chọn ghế", message: "Vui lòng chọn ít nhất 1 ghế." });
      return;
    }

    const error = validatePhoneNumber(bookingForm.phone);
    if (error && bookingMode !== "hold") {
      setPhoneError(error);
      toast({ type: "error", title: "Số điện thoại không hợp lệ", message: error });
      return;
    }

    const finalNote = noteSuffix ? `${bookingForm.note} ${noteSuffix}` : bookingForm.note;
    const passenger = { name: "Khách lẻ", phone: bookingForm.phone || "0000000000", note: finalNote, pickupPoint: bookingForm.pickup, dropoffPoint: bookingForm.dropoff };
    const payment = paymentData || { paidCash: 0, paidTransfer: 0 };
    const status = explicitStatus || (payment.paidCash + payment.paidTransfer > 0 ? "payment" : bookingMode === "hold" ? "hold" : "booking");

    const bookingItems = selectionBasket.map(item => {
      const tickets = item.seats.map(s => {
        const key = `${item.trip.id}_${s.id}`;
        const override = overrides[key];
        return {
          seatId: s.id,
          price: status === 'booking' ? 0 : (override?.price !== undefined ? override.price : s.price),
          pickup: override?.pickup !== undefined ? override.pickup : passenger.pickupPoint || "",
          dropoff: override?.dropoff !== undefined ? override.dropoff : passenger.dropoffPoint || "",
        };
      });
      return { tripId: item.trip.id, seats: item.seats, tickets };
    });

    try {
      const result = await api.bookings.create(bookingItems, passenger, payment, status);
      onDataUpdate(result.updatedTrips, result.bookings);
      
      if (result.bookings.length > 0) {
        const b = result.bookings[0];
        onAddUndo({
          type: "CREATED_BOOKING",
          bookingId: b.id,
          phone: b.passenger.phone,
          seatCount: b.totalTickets,
          seatLabels: selectionBasket.flatMap(i => i.seats.map(s => s.label)),
          tripDate: selectionBasket[0]?.trip.departureTime || "",
        });
      }
      
      setBookingForm(prev => ({ ...prev, note: "", phone: "" }));
      setPhoneError(null);
      toast({ type: "success", title: "Thành công", message: "Đã tạo đơn hàng thành công." });
    } catch (error) {
      console.error(error);
      toast({ type: "error", title: "Lỗi", message: "Có lỗi xảy ra khi tạo đơn." });
    }
  };

  const handleInitiatePayment = () => {
    if (selectionBasket.length === 0) return;
    const error = validatePhoneNumber(bookingForm.phone);
    if (error) { setPhoneError(error); return; }

    const realPriceTotal = selectionBasket.reduce((sum, item) => sum + item.seats.reduce((sSum, s) => sSum + s.price, 0), 0);
    onOpenPaymentModal(
      { type: "new", totalPrice: realPriceTotal },
      { paidCash: realPriceTotal, paidTransfer: 0 },
      {}
    );
  };

  const handleManualPaymentForEdit = () => {
    if (!editingBooking) return;
    setBookingMode("payment");
    const overrides: Record<string, SeatOverride> = {};
    editingBooking.items.forEach(item => {
      item.tickets?.forEach(ticket => {
        overrides[`${item.tripId}_${ticket.seatId}`] = { price: ticket.price, pickup: ticket.pickup, dropoff: ticket.dropoff };
      });
    });
    onOpenPaymentModal(
      { type: "update", bookingIds: [editingBooking.id], totalPrice: totalBasketPrice },
      { paidCash: editingBooking.payment?.paidCash || 0, paidTransfer: editingBooking.payment?.paidTransfer || 0 },
      overrides
    );
  };

  const handleConfirmAction = () => {
    if (editingBooking) {
      const oldPrice = editingBooking.totalPrice;
      const newPrice = totalBasketPrice;
      const oldSeatCount = editingBooking.totalTickets;
      const newSeatCount = selectionBasket.reduce((sum, item) => sum + item.seats.length, 0);

      const oldTripMap = new Map<string, string[]>();
      editingBooking.items.forEach(item => oldTripMap.set(item.tripId, item.seatIds));

      const newTripMap = new Map<string, string[]>();
      selectionBasket.forEach(item => newTripMap.set(item.trip.id, item.seats.map(s => s.label)));

      const diffTrips: TripDiffItem[] = [];
      const allTripIds = new Set([...oldTripMap.keys(), ...newTripMap.keys()]);
      
      allTripIds.forEach(tripId => {
        const basketItem = selectionBasket.find(i => i.trip.id === tripId);
        const oldItem = editingBooking.items.find(i => i.tripId === tripId);
        if (!basketItem && !oldItem) return;

        const oldSeats = oldItem ? oldItem.seatIds : [];
        const newSeats = basketItem ? basketItem.seats.map(s => s.label) : [];
        const seatDiffs: DiffSeat[] = [];
        
        newSeats.forEach(s => seatDiffs.push({ label: s, status: oldSeats.includes(s) ? "kept" : "added" }));
        oldSeats.filter(s => !newSeats.includes(s)).forEach(s => seatDiffs.push({ label: s, status: "removed" }));

        diffTrips.push({
          route: basketItem?.trip.route || oldItem?.route || "",
          date: new Date(basketItem?.trip.departureTime || oldItem?.tripDate || ""),
          seats: seatDiffs.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })),
        });
      });

      setUpdateSummary({ diffCount: newSeatCount - oldSeatCount, diffPrice: newPrice - oldPrice, oldPrice, newPrice, diffTrips, newSeatCount });
      return;
    }

    if (bookingMode === "booking") processBooking(undefined, {}, "", "booking");
    else if (bookingMode === "payment") handleInitiatePayment();
    else if (bookingMode === "hold") processBooking(undefined, {}, "", "hold");
  };

  const handleProceedUpdate = async () => {
    setUpdateSummary(null);
    if (!editingBooking) return;

    if (bookingMode === 'booking' || bookingMode === 'hold') {
      let noteSuffix = bookingMode !== editingBooking.status ? `(Chuyển sang ${bookingMode === 'hold' ? 'Giữ vé' : 'Đặt vé'})` : "";
      const passenger = { name: "Khách lẻ", phone: bookingForm.phone, note: `${bookingForm.note} ${noteSuffix}`.trim(), pickupPoint: bookingForm.pickup, dropoffPoint: bookingForm.dropoff };
      
      const result = await api.bookings.update(editingBooking.id, selectionBasket.map(i => ({ tripId: i.trip.id, seats: i.seats })), passenger, { paidCash: 0, paidTransfer: 0 }, bookingMode);
      onDataUpdate(result.updatedTrips, [result.booking]);
      onAddUndo({ type: "UPDATED_BOOKING", previousBooking: editingBooking, phone: editingBooking.passenger.phone });
      onCancelEdit();
      toast({ type: "success", title: "Cập nhật thành công", message: "Đã lưu thay đổi đơn hàng." });
    } else {
      handleManualPaymentForEdit();
    }
  };

  // -- UI RENDER --
  return (
    <div className="bg-indigo-950 rounded-xl shadow-lg border border-indigo-900 flex flex-col overflow-visible shrink-0 transition-colors duration-300">
      <div className="px-3 h-[40px] bg-gradient-to-r from-indigo-950 via-indigo-900 to-indigo-950 border-b border-indigo-900 flex items-center justify-between shrink-0 rounded-t-xl">
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          <Ticket size={16} className="text-yellow-400" />
          {editingBooking ? "Chỉnh sửa" : "Đặt vé mới"}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onCancelEdit} className="text-indigo-300 hover:text-white hover:bg-indigo-800 p-1.5 rounded-full transition-colors" title={editingBooking ? "Đóng" : "Hủy chọn tất cả"}>
            {editingBooking ? <X size={16} /> : <RotateCcw size={14} />}
          </button>
          <Badge className="bg-yellow-400 text-indigo-950 font-bold border-transparent">{selectionBasket.reduce((a, i) => a + i.seats.length, 0)} vé</Badge>
        </div>
      </div>

      <div className="p-3 overflow-y-auto flex-1 bg-indigo-950 min-h-[60px]">
        {selectionBasket.length === 0 ? (
          <div className={`text-center py-6 text-xs border-2 border-dashed rounded-lg ${editingBooking ? "border-red-800/30 bg-red-900/10 text-red-300" : "border-indigo-900 text-indigo-300/50"}`}>
            {editingBooking ? "Đã xóa hết giường (Sẽ hủy vé)" : "Chọn giường"}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {selectionBasket.map((item, idx) => (
              <div key={idx} className="bg-indigo-900 border border-indigo-700 rounded-lg p-2.5 text-white cursor-pointer hover:bg-indigo-800 transition-colors" onClick={() => onNavigateToTrip?.(new Date(item.trip.departureTime), item.trip.id)}>
                <div className="text-xs text-white mb-1 truncate flex items-center">{item.trip.route}</div>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-1.5"><Clock size={12} className="text-slate-400" /><span className="text-[9px] text-slate-400">{new Date(item.trip.departureTime).getDate()}/{new Date(item.trip.departureTime).getMonth() + 1}</span></div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.seats.map((s) => (
                    <div key={s.id} className="relative group">
                      <span className="inline-block bg-indigo-100 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-indigo-200">{s.label}</span>
                      {editingBooking && onInitiateSwap && (
                        <button onClick={(e) => { e.stopPropagation(); onInitiateSwap(s); }} className="absolute -top-3 right-3 bg-white text-indigo-600 rounded-full p-0.5 shadow-sm border border-slate-200 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-indigo-50"><ArrowRightLeft size={10} /></button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-3 pb-3 bg-indigo-950">
        <div className="bg-indigo-900/50 p-1 rounded-lg flex border border-indigo-800">
          {(["booking", "payment", "hold"] as const).map(mode => (
            <button key={mode} onClick={() => setBookingMode(mode)} className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs rounded-md transition-all ${bookingMode === mode ? "bg-yellow-500 text-indigo-950 shadow-sm" : "text-indigo-300 hover:text-white"}`}>
              {mode === 'booking' ? <Ticket size={12}/> : mode === 'payment' ? <Banknote size={12}/> : <Lock size={12}/>}
              {mode === 'booking' ? 'Đặt vé' : mode === 'payment' ? 'Mua vé' : 'Giữ vé'}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 border-t bg-indigo-900/50 border-indigo-900 space-y-2 relative">
        {bookingMode !== "hold" ? (
          <>
            <div className="relative">
              <input type="tel" value={bookingForm.phone} onChange={e => { setBookingForm({ ...bookingForm, phone: formatPhoneNumber(e.target.value) }); setPhoneError(null); setShowHistory(true); }} onBlur={() => setTimeout(() => setShowHistory(false), 200)} onFocus={() => bookingForm.phone.length >= 3 && setShowHistory(true)} className={`w-full pl-6 pr-2 py-1.5 text-xs rounded border text-white placeholder-indigo-400 outline-none bg-indigo-950 border-indigo-800 focus:border-yellow-400 ${phoneError ? "border-red-500" : ""}`} placeholder="Số điện thoại" />
              <Phone size={12} className={`absolute left-2 top-[9px] ${phoneError ? "text-red-500" : "text-indigo-400"}`} />
              {showHistory && passengerHistory.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden z-[50] animate-in fade-in zoom-in-95 duration-200">
                  {passengerHistory.map((item, idx) => (
                    <div key={idx} onMouseDown={e => { e.preventDefault(); applyHistory(item); }} className="px-3 py-2 hover:bg-indigo-50 cursor-pointer border-b border-slate-50 last:border-0 group">
                      <div className="flex justify-between items-start mb-0.5"><span className="text-xs font-bold text-indigo-700">{item.phone}</span><span className="text-[9px] text-slate-400">{new Date(item.lastDate).toLocaleDateString("vi-VN")}</span></div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-600"><span className="truncate">{item.pickup}</span><ArrowRight size={10} className="text-slate-300" /><span className="truncate">{item.dropoff}</span></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {phoneError && <div className="text-[10px] text-red-400 px-1 flex items-center gap-1"><AlertCircle size={10} /> {phoneError}</div>}
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <input type="text" value={bookingForm.pickup} onChange={e => setBookingForm({ ...bookingForm, pickup: e.target.value.replace(/(?:^|\s)\S/g, a => a.toUpperCase()) })} onBlur={() => setBookingForm(prev => ({ ...prev, pickup: getStandardizedLocation(prev.pickup) }))} className="w-full pl-6 pr-2 py-1.5 text-xs rounded border text-white bg-indigo-950 border-indigo-800" placeholder="Điểm đón" />
                <MapPin size={12} className="absolute left-2 top-[9px] text-indigo-400" />
              </div>
              <div className="relative">
                <input type="text" value={bookingForm.dropoff} onChange={e => setBookingForm({ ...bookingForm, dropoff: e.target.value.replace(/(?:^|\s)\S/g, a => a.toUpperCase()) })} onBlur={() => setBookingForm(prev => ({ ...prev, dropoff: getStandardizedLocation(prev.dropoff) }))} className="w-full pl-6 pr-2 py-1.5 text-xs rounded border text-white bg-indigo-950 border-indigo-800" placeholder="Điểm trả" />
                <Locate size={12} className="absolute left-2 top-[9px] text-indigo-400" />
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-2 bg-indigo-900/30 rounded border border-indigo-800 border-dashed text-xs text-indigo-300 mb-2">
            <Lock className="mx-auto mb-1 opacity-50" size={16} /><span>Chế độ Giữ vé</span>
          </div>
        )}
        <div className="relative">
          <textarea value={bookingForm.note} onChange={e => setBookingForm({ ...bookingForm, note: e.target.value })} className="w-full pl-6 pr-2 py-1.5 text-xs rounded border text-white bg-indigo-950 border-indigo-800 resize-none h-8" placeholder="Ghi chú" />
          <Notebook size={12} className="absolute left-2 top-[9px] text-indigo-400" />
        </div>
      </div>

      <div className={`p-2 border-t rounded-b-xl bg-indigo-950 border-indigo-900 ${editingBooking ? "grid grid-cols-2 gap-2" : ""}`}>
        {editingBooking ? (
          <>
            <Button className="bg-green-600 hover:bg-green-500 text-white font-bold h-10 text-sm border border-green-700" onClick={handleManualPaymentForEdit} title="Thanh toán"><CreditCard size={16} className="mr-2" /> Thu tiền</Button>
            <Button className={`font-bold h-10 text-sm ${selectionBasket.length === 0 ? "bg-red-600 border-red-700" : "bg-yellow-500 text-indigo-950"}`} onClick={handleConfirmAction}><Save size={16} className="mr-2" /> {selectionBasket.length === 0 ? "Xác nhận hủy" : "Lưu thay đổi"}</Button>
          </>
        ) : (
          <Button className={`w-full font-bold h-10 text-sm ${bookingMode === "payment" ? "bg-green-600 hover:bg-green-500 text-white" : "bg-yellow-500 hover:bg-yellow-400 text-indigo-950"}`} onClick={handleConfirmAction} disabled={selectionBasket.length === 0}>
            {bookingMode === "payment" ? <CreditCard size={16} className="mr-2" /> : <CheckCircle2 size={16} className="mr-2" />}
            {bookingMode === "payment" ? "Thanh toán" : "Đồng ý"}
          </Button>
        )}
      </div>

      <AlertDialog open={!!updateSummary} onOpenChange={o => !o && setUpdateSummary(null)}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-blue-600 flex items-center gap-2"><FileEdit size={20} /> Xác nhận thay đổi</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-slate-600 pt-2 space-y-4">
                <p>Bạn có chắc muốn lưu các thay đổi cho đơn hàng này?</p>
                {updateSummary?.diffTrips.map((trip, idx) => (
                  <div key={idx} className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-2">
                    <div className="text-xs font-bold text-slate-700 flex items-center gap-2 border-b pb-1"><MapPin size={12}/> {trip.route} • {trip.date.toLocaleDateString("vi-VN")}</div>
                    <div className="flex flex-wrap gap-2">
                      {trip.seats.map((s, i) => (
                        <span key={i} className={`px-2 py-0.5 rounded text-[10px] border ${s.status === 'added' ? 'bg-green-100 text-green-700 border-green-200' : s.status === 'removed' ? 'bg-red-50 text-red-400 border-red-100 line-through' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{s.label}</span>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-3 border-t">
                  <span className="text-slate-500 text-xs">Tổng tiền:</span>
                  <div className="flex items-center gap-2 font-bold">
                    <span className="text-slate-400 line-through text-xs">{updateSummary?.oldPrice.toLocaleString("vi-VN")} đ</span>
                    <ArrowRight size={14} className="text-slate-300"/>
                    <span className="text-primary text-sm">{updateSummary?.newPrice.toLocaleString("vi-VN")} đ</span>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><Button variant="outline" onClick={() => setUpdateSummary(null)}>Quay lại</Button><Button onClick={handleProceedUpdate}>Đồng ý lưu</Button></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
