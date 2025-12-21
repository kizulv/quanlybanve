
import React, { useState, useMemo, useEffect } from "react";
import { Layout } from "./components/Layout";
import { SeatMap } from "./components/SeatMap";
import { SettingsView } from "./components/SettingsView";
import { ScheduleView } from "./components/ScheduleView";
import { PaymentManager } from "./components/PaymentManager";
import { Badge } from "./components/ui/Badge";
import { ToastProvider, useToast } from "./components/ui/Toast";
import { RightSheet } from "./components/RightSheet";
import { BookingForm } from "./components/BookingForm";
import { SeatDetailModal } from "./components/SeatDetailModal";
import { ManifestList } from "./components/ManifestList";
import {
  BusTrip,
  Seat,
  SeatStatus,
  Passenger,
  Booking,
  Route,
  Bus,
  UndoAction,
} from "./types";
import {
  BusFront,
  Loader2,
  ArrowRightLeft,
} from "lucide-react";
import { api } from "./lib/api";
import { isSameDay, formatTime } from "./utils/dateUtils";
import { PaymentModal } from "./components/PaymentModal";

interface SeatOverride {
  price?: number;
  pickup?: string;
  dropoff?: string;
}

function AppContent() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("sales");

  // -- GLOBAL STATE --
  const [trips, setTrips] = useState<BusTrip[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);

  // -- UI STATE --
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedDirection, setSelectedDirection] = useState<"outbound" | "inbound">("outbound");
  const [swapSourceSeat, setSwapSourceSeat] = useState<Seat | null>(null);
  const [highlightedBookingId, setHighlightedBookingId] = useState<string | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [seatDetailModal, setSeatDetailModal] = useState<{ booking: Booking | null; seat: Seat; } | null>(null);

  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [pendingPaymentContext, setPendingPaymentContext] = useState<{
    type: "new" | "update";
    bookingIds?: string[];
    totalPrice: number;
  } | null>(null);
  const [modalPaymentInput, setModalPaymentInput] = useState({ paidCash: 0, paidTransfer: 0 });
  const [modalInitialOverrides, setModalInitialOverrides] = useState<Record<string, SeatOverride>>({});

  const refreshData = async () => {
    try {
      const [tripsData, routesData, busesData, bookingsData] = await Promise.all([
        api.trips.getAll(), api.routes.getAll(), api.buses.getAll(), api.bookings.getAll()
      ]);
      setTrips(tripsData); setRoutes(routesData); setBuses(busesData); setBookings(bookingsData);
    } catch (error) {
      toast({ type: "error", title: "Lỗi hệ thống", message: "Không thể tải dữ liệu." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { refreshData(); }, []);

  // -- COMPUTED --
  const selectionBasket = useMemo(() => {
    const basket: { trip: BusTrip; seats: Seat[] }[] = [];
    trips.forEach((trip) => {
      const selected = trip.seats.filter(s => s.status === SeatStatus.SELECTED);
      if (selected.length > 0) {
        const route = routes.find(r => r.id === trip.routeId || r.name === trip.route);
        const defaultPrice = route?.price || 0;
        basket.push({ trip, seats: selected.map(s => ({ ...s, price: s.price > 0 ? s.price : defaultPrice })) });
      }
    });
    return basket;
  }, [trips, routes]);

  const totalBasketPrice = useMemo(() => {
    return selectionBasket.reduce((sum, item) => {
      return sum + item.seats.reduce((sSum, seat) => {
        let effectivePrice = seat.price;
        if (editingBooking) {
          const ticket = editingBooking.items.find(i => i.tripId === item.trip.id)?.tickets?.find(t => t.seatId === seat.id);
          if (ticket) effectivePrice = ticket.price;
        }
        return sSum + effectivePrice;
      }, 0);
    }, 0);
  }, [selectionBasket, editingBooking]);

  const availableTripsForDate = useMemo(() => {
    return trips.filter(trip => isSameDay(new Date(trip.departureTime.split(" ")[0]), selectedDate) && (trip.direction || "outbound") === selectedDirection);
  }, [trips, selectedDate, selectedDirection]);

  const selectedTrip = trips.find(t => t.id === selectedTripId) || null;
  const tripBookings = useMemo(() => !selectedTrip ? [] : bookings.filter(b => b.status !== "cancelled" && b.items.some(item => item.tripId === selectedTrip.id)), [bookings, selectedTrip]);

  // -- HANDLERS --
  const handleTripSelect = (tripId: string) => {
    setSelectedTripId(tripId); setSwapSourceSeat(null); setHighlightedBookingId(null);
  };

  const handleSeatClick = async (clickedSeat: Seat) => {
    if (!selectedTrip) return;
    if (swapSourceSeat) {
      if (swapSourceSeat.id === clickedSeat.id) { setSwapSourceSeat(null); return; }
      try {
        const result = await api.bookings.swapSeats(selectedTrip.id, swapSourceSeat.id, clickedSeat.id);
        setBookings(result.bookings);
        // Explicitly define Map type to avoid unknown[] inference during setTrips
        const updatedTripsMap = new Map<string, BusTrip>(result.trips.map((t: BusTrip) => [t.id, t]));
        setTrips((prev: BusTrip[]) => prev.map(t => updatedTripsMap.get(t.id) || t));
        setUndoStack(prev => [...prev, { type: "SWAPPED_SEATS", tripId: selectedTrip.id, seat1: clickedSeat.id, seat2: swapSourceSeat.id, label1: clickedSeat.label, label2: swapSourceSeat.label, tripDate: selectedTrip.departureTime }]);
        toast({ type: "success", title: "Thành công", message: `Đã đổi ${swapSourceSeat.label} sang ${clickedSeat.label}` });
      } catch (e) { toast({ type: "error", title: "Lỗi", message: "Không thể đổi chỗ." }); }
      finally { setSwapSourceSeat(null); setEditingBooking(null); }
      return;
    }

    if ([SeatStatus.BOOKED, SeatStatus.SOLD, SeatStatus.HELD].includes(clickedSeat.status)) {
      const booking = tripBookings.find(b => b.items.some(i => i.tripId === selectedTrip.id && i.seatIds.includes(clickedSeat.id)));
      if (editingBooking && booking?.id === editingBooking.id) {
        setTrips(prev => prev.map(t => t.id === selectedTrip.id ? { ...t, seats: t.seats.map(s => s.id === clickedSeat.id ? { ...s, status: SeatStatus.AVAILABLE } : s) } : t));
      } else if (booking) setHighlightedBookingId(booking.id);
      return;
    }

    setTrips(prev => prev.map(t => t.id === selectedTrip.id ? { ...t, seats: t.seats.map(s => s.id === clickedSeat.id ? (s.status === SeatStatus.SELECTED ? { ...s, status: s.originalStatus || SeatStatus.AVAILABLE } : { ...s, status: SeatStatus.SELECTED, originalStatus: s.status === SeatStatus.HELD ? SeatStatus.HELD : undefined }) : s) } : t));
  };

  const cancelAllSelections = () => {
    if (editingBooking) { refreshData(); setEditingBooking(null); return; }
    setTrips(prev => prev.map(t => ({ ...t, seats: t.seats.map(s => s.status === SeatStatus.SELECTED ? { ...s, status: s.originalStatus || SeatStatus.AVAILABLE } : s) })));
  };

  const executeBookingUpdate = async (targetBookingId: string, paymentData: { paidCash: number; paidTransfer: number }, overrides: Record<string, SeatOverride>, noteSuffix: string) => {
    try {
      const booking = bookings.find(b => b.id === targetBookingId);
      if (!booking) return;
      const passenger = { ...booking.passenger, note: `${booking.passenger.note || ""} ${noteSuffix}`.trim() };
      const currentItems = selectionBasket.map(i => ({
        tripId: i.trip.id, seats: i.seats,
        tickets: i.seats.map(s => {
          const ov = overrides[`${i.trip.id}_${s.id}`];
          return { seatId: s.id, price: ov?.price ?? s.price, pickup: ov?.pickup ?? passenger.pickupPoint ?? "", dropoff: ov?.dropoff ?? passenger.dropoffPoint ?? "" };
        })
      }));
      const result = await api.bookings.update(targetBookingId, currentItems, passenger, paymentData, "payment");
      setBookings(prev => prev.map(b => b.id === targetBookingId ? result.booking : b));
      // Explicitly define Map type to avoid unknown[] inference during setTrips
      const updatedTripsMap = new Map<string, BusTrip>(result.updatedTrips.map((t: BusTrip) => [t.id, t]));
      setTrips((prev: BusTrip[]) => prev.map(t => updatedTripsMap.get(t.id) || t));
      setUndoStack(prev => [...prev, { type: "UPDATED_BOOKING", previousBooking: booking, phone: booking.passenger.phone }]);
      setIsPaymentModalOpen(false); setEditingBooking(null);
      toast({ type: "success", title: "Cập nhật thành công", message: "Đã lưu thay đổi thanh toán." });
    } catch (e) { toast({ type: "error", title: "Lỗi", message: "Cập nhật thất bại." }); }
  };

  const handleUndo = async () => {
    if (undoStack.length === 0) return;
    const action = undoStack[undoStack.length - 1];
    try {
      if (action.type === "CREATED_BOOKING") {
        const del = await api.bookings.delete(action.bookingId);
        setBookings(del.bookings); 
        // Explicitly define types and update logic to avoid unknown[] inference
        setTrips((prev: BusTrip[]) => { const m = new Map<string, BusTrip>(del.trips.map((t: any) => [t.id, t])); return prev.map(t => m.get(t.id) || t); });
      } else if (action.type === "UPDATED_BOOKING") {
        const oldB = action.previousBooking;
        const res = await api.bookings.update(oldB.id, oldB.items.map(i => ({ tripId: i.tripId, seats: i.seatIds.map(id => ({ id } as Seat)), tickets: i.tickets })), oldB.passenger, oldB.payment, oldB.status);
        setBookings(prev => prev.map(b => b.id === oldB.id ? res.booking : b));
        // Explicitly define types and update logic to avoid unknown[] inference
        setTrips((prev: BusTrip[]) => { const m = new Map<string, BusTrip>(res.updatedTrips.map((t: any) => [t.id, t])); return prev.map(t => m.get(t.id) || t); });
      } else if (action.type === "SWAPPED_SEATS") {
        const res = await api.bookings.swapSeats(action.tripId, action.seat1, action.seat2);
        setBookings(res.bookings); 
        // Explicitly define types and update logic to avoid unknown[] inference
        setTrips((prev: BusTrip[]) => { const m = new Map<string, BusTrip>(res.trips.map((t: any) => [t.id, t])); return prev.map(t => m.get(t.id) || t); });
      }
      setUndoStack(prev => prev.slice(0, -1));
      toast({ type: "info", title: "Đã hoàn tác" });
    } catch (e) { toast({ type: "error", title: "Lỗi", message: "Không thể hoàn tác." }); }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-primary" size={48} /></div>;

  return (
    <Layout
      activeTab={activeTab} onTabChange={setActiveTab} selectedDate={selectedDate} onDateChange={setSelectedDate}
      availableTrips={availableTripsForDate} selectedTripId={selectedTripId} onTripChange={handleTripSelect}
      selectedDirection={selectedDirection} onDirectionChange={setSelectedDirection} routes={routes}
      headerRight={<RightSheet bookings={bookings} trips={trips} onSelectBooking={b => { setEditingBooking(b); setActiveTab("sales"); }} onUndo={handleUndo} lastUndoAction={undoStack[undoStack.length - 1]} />}
    >
      {activeTab === "sales" && (
        <div className="flex flex-col md:flex-row gap-4 animate-in fade-in duration-300">
          <div className={`flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden md:flex-1 md:h-[calc(100vh-140px)] ${swapSourceSeat ? "ring-2 ring-indigo-500" : ""}`}>
            <div className={`px-4 h-[40px] border-b flex items-center justify-between transition-colors ${swapSourceSeat ? "bg-indigo-600 border-indigo-600" : "bg-gradient-to-r from-indigo-950 via-indigo-900 to-indigo-950 border-indigo-900"}`}>
              <div className="flex items-center gap-3 text-white text-xs font-bold uppercase tracking-wider">{selectedTrip ? (swapSourceSeat ? `Đang đổi: ${swapSourceSeat.label}` : selectedTrip.name) : "Chọn chuyến xe"}</div>
              {swapSourceSeat && <button onClick={() => setSwapSourceSeat(null)} className="text-white text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded">Hủy</button>}
            </div>
            <div className="flex-1 overflow-y-auto">
              {selectedTrip ? <SeatMap seats={selectedTrip.seats} busType={selectedTrip.type} onSeatClick={handleSeatClick} bookings={tripBookings} currentTripId={selectedTrip.id} onSeatSwap={setSwapSourceSeat} editingBooking={editingBooking} onSeatRightClick={(s, b) => setSeatDetailModal({ seat: s, booking: b })} swapSourceSeatId={swapSourceSeat?.id} /> 
              : <div className="h-full flex flex-col items-center justify-center text-slate-300 p-8"><BusFront size={48} className="mb-4 opacity-20" /><p className="text-sm">Vui lòng chọn chuyến xe</p></div>}
            </div>
          </div>

          <div className="w-full md:w-[320px] xl:w-[360px] flex flex-col gap-4 md:h-[calc(100vh-140px)]">
            <BookingForm
              selectionBasket={selectionBasket} totalBasketPrice={totalBasketPrice} bookings={bookings} routes={routes} editingBooking={editingBooking}
              onDataUpdate={(t, b) => { setTrips(t); setBookings(b); }} onCancelEdit={cancelAllSelections} onAddUndo={a => setUndoStack(prev => [...prev, a])}
              onInitiateSwap={setSwapSourceSeat} onNavigateToTrip={(d, id) => { setSelectedDate(d); setSelectedTripId(id); }}
              onOpenPaymentModal={(ctx, input, overrides) => { setPendingPaymentContext(ctx); setModalPaymentInput(input); setModalInitialOverrides(overrides); setIsPaymentModalOpen(true); }}
            />
            <ManifestList tripBookings={tripBookings} selectedTrip={selectedTrip} highlightedBookingId={highlightedBookingId} onSelectBooking={setEditingBooking} />
          </div>
        </div>
      )}

      {activeTab === "finance" && <PaymentManager />}
      {activeTab === "schedule" && <ScheduleView trips={trips} routes={routes} buses={buses} onAddTrip={async (d, t) => { await api.trips.create(t as any); refreshData(); }} onUpdateTrip={async (id, t) => { await api.trips.update(id, t); refreshData(); }} onDeleteTrip={async id => { await api.trips.delete(id); refreshData(); }} onUpdateBus={async (id, u) => { await api.buses.update(id, u); refreshData(); }} />}
      {activeTab === "settings" && <SettingsView routes={routes} setRoutes={() => {}} buses={buses} setBuses={() => {}} trips={trips} setTrips={() => {}} onDataChange={refreshData} />}

      <PaymentModal
        isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} selectionBasket={selectionBasket} editingBooking={editingBooking}
        bookingForm={{ pickup: "", dropoff: "" }} paidCash={modalPaymentInput.paidCash} paidTransfer={modalPaymentInput.paidTransfer}
        onMoneyChange={e => { const { name, value } = e.target; setModalPaymentInput(p => ({ ...p, [name]: parseInt(value.replace(/\D/g, "") || "0") })); }}
        initialOverrides={modalInitialOverrides}
        onConfirm={async (finalTotal, overrides, noteSuffix) => {
          if (pendingPaymentContext?.type === "update") await executeBookingUpdate(pendingPaymentContext.bookingIds![0], { paidCash: modalPaymentInput.paidCash, paidTransfer: modalPaymentInput.paidTransfer }, overrides, noteSuffix || "");
          else {
            const passenger = { phone: "0000000000" }; // This would normally come from the form, but in this refactor the form logic handles its own creation mostly.
            // Note: If creating a new booking from Payment modal, BookingForm should ideally handle this.
            toast({ type: "info", title: "Tính năng đang được chuyển đổi" });
          }
        }}
      />

      <SeatDetailModal
        isOpen={!!seatDetailModal} onClose={() => setSeatDetailModal(null)} booking={seatDetailModal?.booking || null} seat={seatDetailModal?.seat || null} bookings={bookings}
        onSave={async p => {
          if (!seatDetailModal) return;
          const { booking, seat } = seatDetailModal;
          if (booking) {
            const res = await api.bookings.updateTicket(booking.id, seat.id, { pickup: p.pickupPoint, dropoff: p.dropoffPoint, note: p.note, phone: p.phone, name: p.name });
            setBookings(prev => prev.map(b => b.id === booking.id ? res.booking : b));
          } else {
            const updated = selectedTrip!.seats.map(s => s.id === seat.id ? { ...s, note: p.note } : s);
            await api.trips.updateSeats(selectedTrip!.id, updated);
            setTrips(prev => prev.map(t => t.id === selectedTrip!.id ? { ...t, seats: updated } : t));
          }
          setSeatDetailModal(null); toast({ type: "success", title: "Đã cập nhật" });
        }}
      />
    </Layout>
  );
}

function App() { return <ToastProvider><AppContent /></ToastProvider>; }
export default App;
