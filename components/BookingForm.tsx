
import React, { useState, useMemo, useEffect } from "react";
import { Seat, Booking, BusTrip, Route, UndoAction, Passenger, SeatStatus } from "../types";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { api } from "../lib/api";
import { useToast } from "./ui/Toast";
import { PaymentModal } from "./PaymentModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/AlertDialog";
import {
  Ticket,
  RotateCcw,
  Banknote,
  Lock,
  Phone,
  History,
  X,
  Clock,
  CheckCircle2,
  Save,
  MapPin,
  Locate,
  Notebook,
  ArrowRightLeft,
  CreditCard,
  FileEdit,
  ArrowRight as ArrowRightIcon,
  Calendar,
} from "lucide-react";

interface SeatOverride {
  price?: number;
  pickup?: string;
  dropoff?: string;
}

interface DiffSeat {
  label: string;
  status: "kept" | "added" | "removed";
}

interface TripDiffItem {
  route: string;
  date: Date;
  seats: DiffSeat[];
}

interface BookingFormProps {
  trips: BusTrip[];
  routes: Route[];
  bookings: Booking[];
  selectionBasket: { trip: BusTrip; seats: Seat[] }[];
  editingBooking: Booking | null;
  setTrips: React.Dispatch<React.SetStateAction<BusTrip[]>>;
  setBookings: React.Dispatch<React.SetStateAction<Booking[]>>;
  setUndoStack: React.Dispatch<React.SetStateAction<UndoAction[]>>;
  setEditingBooking: (booking: Booking | null) => void;
  onCancelSelection: () => void;
  onInitiateSwap?: (seat: Seat) => void;
  onNavigateToTrip?: (date: Date, tripId: string) => void;
}

export const BookingForm: React.FC<BookingFormProps> = ({
  trips,
  routes,
  bookings,
  selectionBasket,
  editingBooking,
  setTrips,
  setBookings,
  setUndoStack,
  setEditingBooking,
  onCancelSelection,
  onInitiateSwap,
  onNavigateToTrip,
}) => {
  const { toast } = useToast();

  const [bookingForm, setBookingForm] = useState({
    phone: "",
    pickup: "",
    dropoff: "",
    note: "",
  });
  const [bookingMode, setBookingMode] = useState<"booking" | "payment" | "hold">("booking");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [modalPaymentInput, setModalPaymentInput] = useState({ paidCash: 0, paidTransfer: 0 });
  const [modalInitialOverrides, setModalInitialOverrides] = useState<Record<string, SeatOverride>>({});
  const [pendingPaymentContext, setPendingPaymentContext] = useState<{ type: "new" | "update"; totalPrice: number } | null>(null);
  const [updateSummary, setUpdateSummary] = useState<{
    oldPrice: number;
    newPrice: number;
    diffTrips: TripDiffItem[];
  } | null>(null);

  useEffect(() => {
    if (editingBooking) {
      setBookingMode(editingBooking.status === "payment" ? "payment" : editingBooking.status === "hold" ? "hold" : "booking");
      setBookingForm({
        phone: editingBooking.passenger.phone,
        pickup: editingBooking.passenger.pickupPoint || "",
        dropoff: editingBooking.passenger.dropoffPoint || "",
        note: (editingBooking.passenger.note || "")
          .replace(/\s*\(Chuyển sang [^\)]+\)/g, "")
          .replace(/\s*\(Cần thu thêm: [^\)]+\)/g, "")
          .replace(/\s*\(Cần hoàn lại: [^\)]+\)/g, "")
          .trim(),
      });
      setModalPaymentInput({
        paidCash: editingBooking.payment?.paidCash || 0,
        paidTransfer: editingBooking.payment?.paidTransfer || 0,
      });
    } else {
      setBookingForm({ phone: "", pickup: "", dropoff: "", note: "" });
      setBookingMode("booking");
      setPhoneError(null);
    }
  }, [editingBooking]);

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

  const totalBasketPrice = useMemo(() => {
    return selectionBasket.reduce((sum, item) => {
      return sum + item.seats.reduce((sSum, s) => {
        let p = s.price;
        if (editingBooking) {
           const ticket = editingBooking.items.find(i => i.tripId === item.trip.id)?.tickets?.find(t => t.seatId === s.id);
           if (ticket) p = ticket.price;
        }
        if (p === 0) p = item.trip.basePrice || 0;
        return sSum + p;
      }, 0);
    }, 0);
  }, [selectionBasket, editingBooking]);

  const passengerHistory = useMemo(() => {
    const cleanInput = bookingForm.phone.replace(/\D/g, "");
    if (cleanInput.length < 3) return [];
    const matches = bookings.filter(b => b.status !== "cancelled" && b.passenger.phone.replace(/\D/g, "").includes(cleanInput));
    const uniqueRoutes = new Map<string, any>();
    matches.forEach(b => {
      const key = `${(b.passenger.pickupPoint || "").toLowerCase()}|${(b.passenger.dropoffPoint || "").toLowerCase()}`;
      if (!uniqueRoutes.has(key) || new Date(b.createdAt) > new Date(uniqueRoutes.get(key).lastDate)) {
        uniqueRoutes.set(key, { phone: b.passenger.phone, pickup: b.passenger.pickupPoint, dropoff: b.passenger.dropoffPoint, lastDate: b.createdAt });
      }
    });
    return Array.from(uniqueRoutes.values()).slice(0, 5);
  }, [bookings, bookingForm.phone]);

  const handleConfirmAction = () => {
    const error = validatePhoneNumber(bookingForm.phone);
    if (error && bookingMode !== "hold") {
      setPhoneError(error);
      return;
    }

    if (editingBooking) {
      const oldTripMap = new Map(editingBooking.items.map(i => [i.tripId, i.seatIds]));
      const newTripMap = new Map(selectionBasket.map(i => [i.trip.id, i.seats.map(s => s.label)]));
      const allIds = new Set([...oldTripMap.keys(), ...newTripMap.keys()]);
      const diffTrips: TripDiffItem[] = [];

      allIds.forEach(id => {
        const oldS = oldTripMap.get(id) || [];
        const newS = newTripMap.get(id) || [];
        const added = newS.filter(s => !oldS.includes(s));
        const removed = oldS.filter(s => !newS.includes(s));
        const kept = oldS.filter(s => newS.includes(s));
        if (added.length || removed.length) {
          const trip = trips.find(t => t.id === id) || editingBooking.items.find(i => i.tripId === id);
          diffTrips.push({
            route: trip?.route || "N/A",
            // FIX: Access either 'departureTime' from BusTrip or 'tripDate' from BookingItem snapshot
            date: new Date((trip as any)?.departureTime || (trip as any)?.tripDate || Date.now()),
            seats: [
              ...kept.map(l => ({ label: l, status: "kept" as const })),
              ...removed.map(l => ({ label: l, status: "removed" as const })),
              ...added.map(l => ({ label: l, status: "added" as const }))
            ].sort((a,b) => a.label.localeCompare(b.label, undefined, {numeric: true}))
          });
        }
      });
      setUpdateSummary({ oldPrice: editingBooking.totalPrice, newPrice: totalBasketPrice, diffTrips });
    } else {
      if (bookingMode === "payment") {
        setModalPaymentInput({ paidCash: totalBasketPrice, paidTransfer: 0 });
        setIsPaymentModalOpen(true);
      } else {
        executeSave(undefined, {}, "", bookingMode);
      }
    }
  };

  const executeSave = async (paymentData?: { paidCash: number; paidTransfer: number }, overrides: Record<string, SeatOverride> = {}, noteSuffix: string = "", statusOverride?: string) => {
    try {
      const passenger: Passenger = { 
        name: "Khách lẻ", 
        phone: bookingForm.phone || "0000000000", 
        note: noteSuffix ? `${bookingForm.note} ${noteSuffix}`.trim() : bookingForm.note,
        pickupPoint: bookingForm.pickup,
        dropoffPoint: bookingForm.dropoff 
      };
      
      const status = statusOverride || (paymentData && (paymentData.paidCash + paymentData.paidTransfer > 0) ? "payment" : bookingMode);
      const payment = paymentData || { paidCash: 0, paidTransfer: 0 };

      const formattedItems = selectionBasket.map(item => ({
        tripId: item.trip.id,
        seats: item.seats,
        tickets: item.seats.map(s => {
          const over = overrides[`${item.trip.id}_${s.id}`];
          return {
            seatId: s.id,
            price: over?.price ?? (s.price || item.trip.basePrice || 0),
            pickup: over?.pickup ?? passenger.pickupPoint ?? "",
            dropoff: over?.dropoff ?? passenger.dropoffPoint ?? ""
          };
        })
      }));

      if (editingBooking) {
        const res = await api.bookings.update(editingBooking.id, formattedItems, passenger, payment, status);
        setBookings(prev => prev.map(b => b.id === editingBooking.id ? res.booking : b));
        setUndoStack(prev => [...prev, { type: "UPDATED_BOOKING", previousBooking: editingBooking, phone: editingBooking.passenger.phone }]);
        setEditingBooking(null);
      } else {
        const res = await api.bookings.create(formattedItems, passenger, payment, status);
        setBookings(prev => [...prev, ...res.bookings]);
        setUndoStack(prev => [...prev, { type: "CREATED_BOOKING", bookingId: res.bookings[0].id, phone: res.bookings[0].passenger.phone, seatCount: res.bookings[0].totalTickets, seatLabels: selectionBasket.flatMap(i => i.seats.map(s => s.label)), tripDate: selectionBasket[0].trip.departureTime }]);
      }

      const updatedTripsMap = new Map(trips.map(t => [t.id, t]));
      setTrips(prev => prev.map(t => updatedTripsMap.get(t.id) || t));
      setIsPaymentModalOpen(false);
      setBookingForm({ phone: "", pickup: "", dropoff: "", note: "" });
      toast({ type: "success", title: "Thành công", message: "Đã lưu đơn hàng." });
    } catch (e) {
      toast({ type: "error", title: "Lỗi", message: "Không thể lưu đơn hàng." });
    }
  };

  const handleManualPayment = () => {
    const error = validatePhoneNumber(bookingForm.phone);
    if (error) { setPhoneError(error); return; }
    
    const overrides: Record<string, SeatOverride> = {};
    if (editingBooking) {
      editingBooking.items.forEach(i => i.tickets?.forEach(t => overrides[`${i.tripId}_${t.seatId}`] = { price: t.price, pickup: t.pickup, dropoff: t.dropoff }));
    }
    setModalInitialOverrides(overrides);
    setModalPaymentInput(editingBooking?.payment || { paidCash: totalBasketPrice, paidTransfer: 0 });
    setIsPaymentModalOpen(true);
  };

  return (
    <>
      <div className="bg-indigo-950 rounded-xl shadow-lg border border-indigo-900 flex flex-col overflow-visible shrink-0 transition-all duration-300">
        <div className="px-3 h-[40px] bg-gradient-to-r from-indigo-950 via-indigo-900 to-indigo-950 border-b border-indigo-900 flex items-center justify-between shrink-0 rounded-t-xl">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Ticket size={16} className="text-yellow-400" />
            {editingBooking ? "Chỉnh sửa đơn" : "Đặt vé mới"}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onCancelSelection} className="text-indigo-300 hover:text-white hover:bg-indigo-800 p-1.5 rounded-full transition-colors">
              {editingBooking ? <X size={16} /> : <RotateCcw size={14} />}
            </button>
            <Badge className="bg-yellow-400 text-indigo-950 font-bold border-transparent">
              {selectionBasket.reduce((s, i) => s + i.seats.length, 0)} vé
            </Badge>
          </div>
        </div>

        <div className="p-3 overflow-y-auto flex-1 bg-indigo-950 min-h-[120px]">
          {selectionBasket.length === 0 ? (
            <div className={`text-center py-6 text-xs border-2 border-dashed rounded-lg ${editingBooking ? "border-red-800/30 bg-red-900/10 text-red-300" : "border-indigo-900 text-indigo-300/50"}`}>
              {editingBooking ? "Đã xóa hết ghế (Sẽ hủy đơn)" : "Vui lòng chọn ghế"}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {selectionBasket.map((item, idx) => (
                <div key={idx} className="bg-indigo-900 border border-indigo-700 rounded-lg p-2 text-white relative hover:bg-indigo-800 cursor-pointer" onClick={() => onNavigateToTrip?.(new Date(item.trip.departureTime), item.trip.id)}>
                  <div className="text-[10px] text-slate-300 mb-1 truncate">{item.trip.route}</div>
                  <div className="flex flex-wrap gap-1">
                    {item.seats.map((s) => (
                      <span key={s.id} className="inline-block bg-indigo-100 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded">{s.label}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-3 pb-3 space-y-3 bg-indigo-950">
          <div className="bg-indigo-900/50 p-1 rounded-lg flex border border-indigo-800">
            {(['booking', 'payment', 'hold'] as const).map(mode => (
              <button key={mode} onClick={() => setBookingMode(mode)} className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-[11px] rounded-md transition-all ${bookingMode === mode ? "bg-yellow-500 text-indigo-950 font-bold shadow-sm" : "text-indigo-300 hover:text-white"}`}>
                {mode === 'booking' ? 'Đặt vé' : mode === 'payment' ? 'Mua vé' : 'Giữ vé'}
              </button>
            ))}
          </div>

          <div className="space-y-2 relative">
            <div className="relative">
              <input value={bookingForm.phone} onChange={e => { setBookingForm(p => ({ ...p, phone: formatPhoneNumber(e.target.value) })); setPhoneError(null); setShowHistory(true); }} onFocus={() => setShowHistory(true)} onBlur={() => setTimeout(() => setShowHistory(false), 200)} className={`w-full pl-8 pr-2 py-2 text-xs rounded border text-white placeholder-indigo-400 bg-indigo-950 border-indigo-800 focus:border-yellow-400 outline-none transition-all ${phoneError ? "border-red-500" : ""}`} placeholder="Số điện thoại" />
              <Phone size={12} className={`absolute left-2.5 top-2.5 ${phoneError ? "text-red-500" : "text-indigo-400"}`} />
              {showHistory && passengerHistory.length > 0 && (
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-lg shadow-xl border border-slate-200 z-50">
                   {passengerHistory.map((h, i) => (
                     <div key={i} onMouseDown={() => { setBookingForm(p => ({ ...p, phone: h.phone, pickup: h.pickup, dropoff: h.dropoff })); setShowHistory(false); }} className="px-3 py-2 hover:bg-indigo-50 cursor-pointer border-b last:border-0">
                        <div className="text-xs font-bold text-indigo-700">{h.phone}</div>
                        <div className="text-[10px] text-slate-500 truncate">{h.pickup} → {h.dropoff}</div>
                     </div>
                   ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <input value={bookingForm.pickup} onChange={e => setBookingForm(p => ({ ...p, pickup: e.target.value }))} className="w-full pl-8 pr-2 py-2 text-xs rounded border text-white placeholder-indigo-400 bg-indigo-950 border-indigo-800 focus:border-yellow-400 outline-none" placeholder="Điểm đón" />
                <MapPin size={12} className="absolute left-2.5 top-2.5 text-indigo-400" />
              </div>
              <div className="relative">
                <input value={bookingForm.dropoff} onChange={e => setBookingForm(p => ({ ...p, dropoff: e.target.value }))} className="w-full pl-8 pr-2 py-2 text-xs rounded border text-white placeholder-indigo-400 bg-indigo-950 border-indigo-800 focus:border-yellow-400 outline-none" placeholder="Điểm trả" />
                <Locate size={12} className="absolute left-2.5 top-2.5 text-indigo-400" />
              </div>
            </div>
            <div className="relative">
              <textarea value={bookingForm.note} onChange={e => setBookingForm(p => ({ ...p, note: e.target.value }))} className="w-full pl-8 pr-2 py-2 text-xs rounded border text-white placeholder-indigo-400 bg-indigo-950 border-indigo-800 focus:border-yellow-400 outline-none h-12 resize-none" placeholder="Ghi chú" />
              <Notebook size={12} className="absolute left-2.5 top-2.5 text-indigo-400" />
            </div>
          </div>
        </div>

        <div className="p-2 border-t border-indigo-900 bg-indigo-900/20 grid grid-cols-2 gap-2 rounded-b-xl">
           {editingBooking ? (
             <>
               <Button className="bg-green-600 hover:bg-green-500 text-white font-bold h-10 text-xs" onClick={handleManualPayment}><CreditCard size={14} className="mr-2" /> Thanh toán</Button>
               <Button className="bg-yellow-500 hover:bg-yellow-400 text-indigo-950 font-bold h-10 text-xs" onClick={handleConfirmAction}><Save size={14} className="mr-2" /> {selectionBasket.length === 0 ? "Hủy đơn" : "Lưu thay đổi"}</Button>
             </>
           ) : (
             <Button className={`col-span-2 font-bold h-10 text-sm ${bookingMode === 'payment' ? 'bg-green-600 hover:bg-green-500' : 'bg-yellow-500 hover:bg-yellow-400 text-indigo-950'}`} disabled={selectionBasket.length === 0} onClick={handleConfirmAction}>
                {bookingMode === 'payment' ? <CreditCard size={16} className="mr-2" /> : <CheckCircle2 size={16} className="mr-2" />} {bookingMode === 'payment' ? "Thanh toán" : "Xác nhận"}
             </Button>
           )}
        </div>
      </div>

      <PaymentModal 
        isOpen={isPaymentModalOpen} 
        onClose={() => setIsPaymentModalOpen(false)} 
        onConfirm={executeSave} 
        selectionBasket={selectionBasket} 
        editingBooking={editingBooking} 
        bookingForm={bookingForm} 
        paidCash={modalPaymentInput.paidCash} 
        paidTransfer={modalPaymentInput.paidTransfer} 
        onMoneyChange={e => setModalPaymentInput(p => ({ ...p, [e.target.name]: parseInt(e.target.value.replace(/\D/g, '') || '0', 10) }))} 
        initialOverrides={modalInitialOverrides} 
      />

      <AlertDialog open={!!updateSummary} onOpenChange={o => !o && setUpdateSummary(null)}>
        <AlertDialogContent className="max-w-2xl bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-indigo-600"><FileEdit size={20} /> Xác nhận thay đổi</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 pt-4">
                <div className="max-h-[300px] overflow-y-auto space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-100">
                  {updateSummary?.diffTrips.map((t, i) => (
                    <div key={i} className="border-b last:border-0 pb-2 mb-2">
                       <div className="text-[10px] font-bold text-slate-500 flex items-center gap-2 uppercase mb-1">
                          <MapPin size={10} /> {t.route} • <Calendar size={10} /> {t.date.toLocaleDateString("vi-VN")}
                       </div>
                       <div className="flex flex-wrap gap-1.5">
                          {t.seats.map((s, si) => (
                            <span key={si} className={`px-2 py-0.5 rounded text-[11px] font-bold ${s.status === 'added' ? 'bg-green-100 text-green-700' : s.status === 'removed' ? 'bg-red-50 text-red-400 line-through' : 'bg-slate-200 text-slate-600'}`}>{s.label}</span>
                          ))}
                       </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center text-sm font-bold pt-2 border-t">
                   <span className="text-slate-500">Tổng tiền:</span>
                   <div className="flex items-center gap-2">
                      <span className="text-slate-400 line-through text-xs">{updateSummary?.oldPrice.toLocaleString()} đ</span>
                      <ArrowRightIcon size={14} className="text-slate-300" />
                      <span className="text-indigo-600 text-lg">{updateSummary?.newPrice.toLocaleString()} đ</span>
                   </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setUpdateSummary(null)}>Quay lại</Button>
            <Button className="bg-indigo-600 hover:bg-indigo-500" onClick={() => { setUpdateSummary(null); executeSave(); }}>Lưu thay đổi</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
