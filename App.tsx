
import React, { useState, useMemo, useEffect } from "react";
import { Layout } from "./components/Layout";
import { SeatMap } from "./components/SeatMap";
import { SettingsView } from "./components/SettingsView";
import { ScheduleView } from "./components/ScheduleView";
import { PaymentManager } from "./components/PaymentManager";
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
import { isSameDay } from "./utils/dateUtils";

function AppContent() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("sales");

  // -- GLOBAL STATE (Fetched from API) --
  const [trips, setTrips] = useState<BusTrip[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);

  // -- UI STATE --
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [swapSourceSeat, setSwapSourceSeat] = useState<Seat | null>(null);
  const [highlightedBookingId, setHighlightedBookingId] = useState<string | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [seatDetailModal, setSeatDetailModal] = useState<{ booking: Booking | null; seat: Seat } | null>(null);

  // Filters
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedDirection, setSelectedDirection] = useState<"outbound" | "inbound">("outbound");

  // -- DATA FETCHING --
  const refreshData = async () => {
    try {
      const [tripsData, routesData, busesData, bookingsData] = await Promise.all([
        api.trips.getAll(),
        api.routes.getAll(),
        api.buses.getAll(),
        api.bookings.getAll(),
      ]);
      setTrips(tripsData);
      setRoutes(routesData);
      setBuses(busesData);
      setBookings(bookingsData);
    } catch (error) {
      toast({ type: "error", title: "Lỗi hệ thống", message: "Không thể tải dữ liệu." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { refreshData(); }, []);

  // -- CALCULATED STATE --
  const selectionBasket = useMemo(() => {
    const basket: { trip: BusTrip; seats: Seat[] }[] = [];
    trips.forEach((trip) => {
      const selected = trip.seats.filter((s) => s.status === SeatStatus.SELECTED);
      if (selected.length > 0) {
        const route = routes.find((r) => r.id === trip.routeId || r.name === trip.route);
        basket.push({ trip, seats: selected.map(s => ({ ...s, price: s.price > 0 ? s.price : (route?.price || 0) })) });
      }
    });
    return basket;
  }, [trips, routes]);

  const availableTripsForDate = useMemo(() => {
    return trips.filter((trip) => {
      const tripDate = new Date(trip.departureTime.split(" ")[0]);
      return isSameDay(tripDate, selectedDate) && (trip.direction || "outbound") === selectedDirection;
    });
  }, [trips, selectedDate, selectedDirection]);

  const selectedTrip = trips.find((t) => t.id === selectedTripId) || null;
  const tripBookings = useMemo(() => {
    if (!selectedTrip) return [];
    return bookings.filter(b => b.items.some(i => i.tripId === selectedTrip.id) && b.status !== "cancelled");
  }, [bookings, selectedTrip]);

  // -- HANDLERS --
  const handleSeatClick = async (clickedSeat: Seat) => {
    if (!selectedTrip) return;
    if (swapSourceSeat) {
      if (swapSourceSeat.id === clickedSeat.id) return setSwapSourceSeat(null), toast({ type: "info", title: "Hủy đổi" });
      try {
        const result = await api.bookings.swapSeats(selectedTrip.id, swapSourceSeat.id, clickedSeat.id);
        setBookings(result.bookings);
        const updatedTripsMap = new Map<string, BusTrip>(result.trips.map((t: BusTrip) => [t.id, t]));
        setTrips(prev => prev.map(t => updatedTripsMap.get(t.id) || t));
        setUndoStack(p => [...p, { type: 'SWAPPED_SEATS', tripId: selectedTrip.id, seat1: clickedSeat.id, seat2: swapSourceSeat.id, label1: clickedSeat.label, label2: swapSourceSeat.label, tripDate: selectedTrip.departureTime }]);
        toast({ type: "success", title: "Đổi chỗ thành công" });
      } catch (e) {
        toast({ type: "error", title: "Lỗi", message: "Đổi chỗ thất bại." });
      } finally {
        setSwapSourceSeat(null);
        if (editingBooking) setEditingBooking(null);
      }
      return;
    }

    if ([SeatStatus.BOOKED, SeatStatus.SOLD, SeatStatus.HELD].includes(clickedSeat.status)) {
      const booking = tripBookings.find(b => b.items.some(i => i.tripId === selectedTrip.id && i.seatIds.includes(clickedSeat.id)));
      if (editingBooking && booking?.id === editingBooking.id) {
        setTrips(prev => prev.map(t => t.id === selectedTrip.id ? { ...t, seats: t.seats.map(s => s.id === clickedSeat.id ? { ...s, status: SeatStatus.AVAILABLE } : s) } : t));
      } else if (booking) setHighlightedBookingId(booking.id);
      return;
    }

    setTrips(prev => prev.map(t => t.id === selectedTrip.id ? { ...t, seats: t.seats.map(s => s.id === clickedSeat.id ? { ...s, status: s.status === SeatStatus.SELECTED ? (s.originalStatus || SeatStatus.AVAILABLE) : SeatStatus.SELECTED, originalStatus: s.status === SeatStatus.HELD ? SeatStatus.HELD : undefined } : s) } : t));
  };

  const handleSelectBookingFromHistory = (booking: Booking) => {
    setEditingBooking(booking);
    setHighlightedBookingId(null);
    setTrips(prev => prev.map(t => {
      const matchingItem = booking.items.find(i => i.tripId === t.id);
      return { ...t, seats: t.seats.map(s => {
        if (s.status === SeatStatus.SELECTED) return { ...s, status: SeatStatus.AVAILABLE };
        if (matchingItem?.seatIds.includes(s.id)) return { ...s, status: SeatStatus.SELECTED };
        return s;
      })};
    }));
  };

  const handleUndo = async () => {
    if (undoStack.length === 0) return;
    const action = undoStack[undoStack.length - 1];
    try {
      if (action.type === "CREATED_BOOKING") {
        const del = await api.bookings.delete(action.bookingId);
        setBookings(del.bookings);
        const utMap = new Map<string, BusTrip>(del.trips.map((t: BusTrip) => [t.id, t]));
        setTrips(prev => prev.map(t => utMap.get(t.id) || t));
      } else if (action.type === "SWAPPED_SEATS") {
        const swapRes = await api.bookings.swapSeats(action.tripId, action.seat1, action.seat2);
        setBookings(swapRes.bookings);
        const utMap = new Map<string, BusTrip>(swapRes.trips.map((t: BusTrip) => [t.id, t]));
        setTrips(prev => prev.map(t => utMap.get(t.id) || t));
      }
      setUndoStack(prev => prev.slice(0, -1));
      toast({ type: "info", title: "Đã hoàn tác" });
    } catch (e) { toast({ type: "error", title: "Lỗi", message: "Hoàn tác thất bại." }); }
  };

  const cancelAllSelections = () => {
    if (editingBooking) return refreshData().then(() => setEditingBooking(null));
    setTrips(prev => prev.map(t => ({ ...t, seats: t.seats.map(s => s.status === SeatStatus.SELECTED ? { ...s, status: s.originalStatus || SeatStatus.AVAILABLE } : s) })));
    toast({ type: "info", title: "Đã hủy chọn" });
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-primary" size={48} /></div>;

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab} selectedDate={selectedDate} onDateChange={setSelectedDate} availableTrips={availableTripsForDate} selectedTripId={selectedTripId} onTripChange={setSelectedTripId} selectedDirection={selectedDirection} onDirectionChange={setSelectedDirection} routes={routes} headerRight={<RightSheet bookings={bookings} trips={trips} onSelectBooking={handleSelectBookingFromHistory} onUndo={handleUndo} lastUndoAction={undoStack[undoStack.length - 1]} />}>
      {activeTab === "sales" && (
        <div className="flex flex-col md:flex-row gap-4 animate-in fade-in duration-300">
          <div className={`flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden shrink-0 md:flex-1 md:h-[calc(100vh-140px)] ${swapSourceSeat ? "ring-2 ring-indigo-500" : ""}`}>
            <div className={`px-4 h-[40px] border-b flex items-center justify-between shrink-0 rounded-t-xl ${swapSourceSeat ? "bg-indigo-600" : "bg-gradient-to-r from-indigo-950 via-indigo-900 to-indigo-950"}`}>
               <div className="flex items-center gap-3 text-white text-xs font-bold">
                 {swapSourceSeat ? <ArrowRightLeft size={16} className="animate-pulse" /> : <BusFront size={16} />}
                 {selectedTrip ? (swapSourceSeat ? `Đang đổi: ${swapSourceSeat.label}` : `${selectedTrip.name} - ${selectedTrip.licensePlate}`) : "Chọn chuyến xe"}
               </div>
               {swapSourceSeat && <button onClick={() => setSwapSourceSeat(null)} className="text-white text-xs bg-white/20 px-2 py-1 rounded">Hủy</button>}
            </div>
            <div className="flex-1 overflow-y-auto">
              {selectedTrip ? <SeatMap seats={selectedTrip.seats} busType={selectedTrip.type} onSeatClick={handleSeatClick} bookings={tripBookings} currentTripId={selectedTrip.id} onSeatSwap={setSwapSourceSeat} editingBooking={editingBooking} onSeatRightClick={(s, b) => setSeatDetailModal({ booking: b, seat: s })} swapSourceSeatId={swapSourceSeat?.id} /> : <div className="h-full flex flex-col items-center justify-center text-slate-300 p-8 text-center"><BusFront size={48} className="opacity-20 mb-4"/><p className="text-sm font-medium">Vui lòng chọn chuyến xe</p></div>}
            </div>
          </div>

          <div className="w-full md:w-[320px] xl:w-[360px] flex flex-col gap-4 shrink-0 md:h-[calc(100vh-140px)]">
            <BookingForm trips={trips} routes={routes} bookings={bookings} selectionBasket={selectionBasket} editingBooking={editingBooking} setTrips={setTrips} setBookings={setBookings} setUndoStack={setUndoStack} setEditingBooking={setEditingBooking} onCancelSelection={cancelAllSelections} onInitiateSwap={setSwapSourceSeat} onNavigateToTrip={(d, id) => { setSelectedDate(d); setSelectedTripId(id); }} />
            <ManifestList tripBookings={tripBookings} selectedTrip={selectedTrip} highlightedBookingId={highlightedBookingId} onSelectBooking={handleSelectBookingFromHistory} />
          </div>
        </div>
      )}
      {activeTab === "finance" && <PaymentManager />}
      {activeTab === "schedule" && <ScheduleView trips={trips} routes={routes} buses={buses} onAddTrip={async (d, t) => { await api.trips.create(t as any); refreshData(); }} onUpdateTrip={async (id, t) => { await api.trips.update(id, t); refreshData(); }} onDeleteTrip={async (id) => { await api.trips.delete(id); refreshData(); }} onUpdateBus={async (id, u) => { await api.buses.update(id, u); refreshData(); }} />}
      {activeTab === "settings" && <SettingsView routes={routes} setRoutes={setRoutes} buses={buses} setBuses={setBuses} trips={trips} setTrips={setTrips} onDataChange={refreshData} />}

      <SeatDetailModal isOpen={!!seatDetailModal} onClose={() => setSeatDetailModal(null)} booking={seatDetailModal?.booking || null} seat={seatDetailModal?.seat || null} bookings={bookings} onSave={async (p, extra) => {
        if (!seatDetailModal) return;
        const { booking, seat } = seatDetailModal;
        if (booking) {
          const res = await api.bookings.updateTicket(booking.id, seat.id, { 
              pickup: p.pickupPoint, 
              dropoff: p.dropoffPoint, 
              note: p.note, 
              phone: p.phone, 
              name: p.name,
              action: extra?.action,
              payment: extra?.payment
          });
          setBookings(prev => prev.map(b => b.id === booking.id ? res.booking : b));
          
          // Refresh trips if seat status changed (Payment/Refund)
          if (extra?.action) {
              const tripsData = await api.trips.getAll();
              setTrips(tripsData);
          }
        } else {
          // Xử lý hủy giữ chỗ thủ công (không có booking)
          const newStatus = (extra?.action === 'REFUND' && seat.status === SeatStatus.HELD) ? SeatStatus.AVAILABLE : seat.status;
          const updatedSeats = selectedTrip!.seats.map(s => s.id === seat.id ? { ...s, note: p.note, status: newStatus } : s);
          await api.trips.updateSeats(selectedTrip!.id, updatedSeats);
          setTrips(prev => prev.map(t => t.id === selectedTrip!.id ? { ...t, seats: updatedSeats } : t));
        }
        setSeatDetailModal(null);
        toast({ type: "success", title: "Cập nhật thành công" });
      }} />
    </Layout>
  );
}

function App() { return (<ToastProvider><AppContent /></ToastProvider>); }
export default App;
