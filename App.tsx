
import React, { useState, useMemo, useEffect } from "react";
import { Layout } from "./components/Layout";
import { SeatMap } from "./components/SeatMap";
import { SettingsView } from "./components/SettingsView";
import { ScheduleView } from "./components/ScheduleView";
import { PaymentManager } from "./components/PaymentManager";
import { SeatSortingView } from "./components/SeatSortingView";
import { Badge } from "./components/ui/Badge";
import { ToastProvider, useToast } from "./components/ui/Toast";
import { RightSheet } from "./components/RightSheet";
import { BookingForm } from "./components/BookingForm";
import { SeatDetailModal } from "./components/SeatDetailModal";
import { ManifestPrint } from "./components/ManifestPrint";
import { BusTrip, Seat, SeatStatus, Passenger, Booking, Route, Bus, UndoAction } from "./types";
import { BusFront, Loader2, Users, Search, X, Clock3, ArrowRightLeft, FileEdit, Calculator } from "lucide-react";
import { api } from "./lib/api";
import { isSameDay } from "./utils/dateUtils";
import { PaymentModal } from "./components/PaymentModal";
import { Button } from "./ui/Button";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./components/ui/AlertDialog";

function AppContent() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("sales");
  const [trips, setTrips] = useState<BusTrip[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [manifestSearch, setManifestSearch] = useState("");
  const [swapSourceSeat, setSwapSourceSeat] = useState<Seat | null>(null);
  const [highlightedBookingId, setHighlightedBookingId] = useState<string | null>(null);
  const [seatDetailModal, setSeatDetailModal] = useState<{ booking: Booking | null; seat: Seat; } | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedDirection, setSelectedDirection] = useState<"outbound" | "inbound">("outbound");
  const [bookingForm, setBookingForm] = useState({ phone: "", pickup: "", dropoff: "", note: "" });
  const [bookingMode, setBookingMode] = useState<"booking" | "payment" | "hold">("booking");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [updateSummary, setUpdateSummary] = useState<any | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const refreshData = async () => {
    try {
      const [tripsData, routesData, busesData, bookingsData] = await Promise.all([api.trips.getAll(), api.routes.getAll(), api.buses.getAll(), api.bookings.getAll()]);
      setTrips(tripsData); setRoutes(routesData); setBuses(busesData); setBookings(bookingsData);
    } catch (error) { toast({ type: "error", title: "Lỗi hệ thống", message: "Không thể tải dữ liệu." }); } finally { setIsLoading(false); }
  };

  useEffect(() => { refreshData(); }, []);

  useEffect(() => {
    if (editingBooking) {
      setTrips(currentTrips => currentTrips.map(trip => {
        const bookingItem = editingBooking.items.find(item => item.tripId === trip.id);
        if (bookingItem) {
          return {
            ...trip,
            seats: trip.seats.map(seat => 
              bookingItem.seatIds.includes(seat.id) 
                ? { ...seat, status: SeatStatus.SELECTED, originalStatus: seat.status } 
                : seat
            )
          };
        }
        return trip;
      }));
      setBookingForm({
        phone: editingBooking.passenger.phone,
        pickup: editingBooking.passenger.pickupPoint || "",
        dropoff: editingBooking.passenger.dropoffPoint || "",
        note: editingBooking.passenger.note || ""
      });
      setBookingMode(editingBooking.status === 'payment' ? 'payment' : editingBooking.status === 'hold' ? 'hold' : 'booking');
    }
  }, [editingBooking]);

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
  const tripBookings = useMemo(() => !selectedTrip ? [] : bookings.filter((b) => b.items.some((item) => item.tripId === selectedTrip.id) && b.status !== "cancelled"), [bookings, selectedTrip]);
  
  const handleSelectBookingForEdit = (booking: Booking) => {
      if (booking.items.length > 0) {
          const firstItem = booking.items[0];
          const tripDate = new Date(firstItem.tripDate.split(' ')[0]);
          setSelectedDate(tripDate);
          setSelectedTripId(firstItem.tripId);
          const trip = trips.find(t => t.id === firstItem.tripId);
          if (trip && trip.direction) setSelectedDirection(trip.direction);
      }
      setEditingBooking(booking);
      setActiveTab("sales");
  };

  const handleTripSelect = (tripId: string) => {
    setSelectedTripId(tripId); setManifestSearch(""); setSwapSourceSeat(null); setHighlightedBookingId(null);
    const trip = trips.find(t => t.id === tripId);
    if (trip && !bookingForm.pickup && !bookingForm.dropoff && !editingBooking) {
      const route = routes.find(r => r.id === trip.routeId || r.name === trip.route);
      if (route) setBookingForm(p => ({ ...p, pickup: trip.direction === "inbound" ? (route.destination || "") : (route.origin || ""), dropoff: trip.direction === "inbound" ? (route.origin || "") : (route.destination || "") }));
    }
  };

  const handleSeatClick = async (clickedSeat: Seat) => {
    if (!selectedTrip) return;
    if (swapSourceSeat) {
      if (swapSourceSeat.id === clickedSeat.id) { setSwapSourceSeat(null); toast({ type: "info", title: "Hủy đổi", message: "Đã hủy chế độ đổi chỗ" }); return; }
      try {
        const result = await api.bookings.transfer(selectedTrip.id, swapSourceSeat.id, selectedTrip.id, clickedSeat.id);
        setBookings(result.bookings); setTrips(result.trips);
        toast({ type: "success", title: "Thanh công", message: `Đã đổi chỗ thành công.` });
      } catch (e) { toast({ type: "error", title: "Lỗi", message: "Thao tác thất bại." }); } finally { setSwapSourceSeat(null); }
      return;
    }
    
    if ([SeatStatus.BOOKED, SeatStatus.SOLD, SeatStatus.HELD].includes(clickedSeat.status) && !editingBooking) {
        const booking = tripBookings.find(b => b.items.some(i => i.tripId === selectedTrip.id && i.seatIds.includes(clickedSeat.id)));
        if (booking) setHighlightedBookingId(booking.id); 
        return;
    }

    const updatedSeats = selectedTrip.seats.map(s => {
        if (s.id === clickedSeat.id) {
            const isCurrentlySelected = s.status === SeatStatus.SELECTED;
            const nextStatus = isCurrentlySelected ? (s.originalStatus || SeatStatus.AVAILABLE) : SeatStatus.SELECTED;
            return { ...s, status: nextStatus, originalStatus: !isCurrentlySelected ? s.status : s.originalStatus };
        }
        return s;
    });
    setTrips(p => p.map(t => t.id === selectedTrip.id ? { ...selectedTrip, seats: updatedSeats } : t));
  };

  const handleSavePassengerDetail = async (passenger: Passenger) => {
    if (!seatDetailModal || !selectedTrip) return;
    const { seat, booking } = seatDetailModal;
    
    try {
        if (booking) {
            // Update an existing booking
            await api.bookings.update(booking.id, booking.items, passenger, booking.payment, booking.status);
            toast({ type: 'success', title: 'Thành công', message: 'Đã cập nhật thông tin khách hàng' });
        } else {
            // "Hold" an available seat or update existing Hold note directly on Trip
            const updatedSeats = selectedTrip.seats.map(s => {
                if (s.id === seat.id) {
                    return { ...s, status: SeatStatus.HELD, note: passenger.note || '' };
                }
                return s;
            });
            await api.trips.updateSeats(selectedTrip.id, updatedSeats);
            toast({ type: 'success', title: 'Thành công', message: 'Đã cập nhật ghi chú giữ vé' });
        }
        await refreshData();
        setSeatDetailModal(null);
    } catch (e) {
        toast({ type: 'error', title: 'Lỗi', message: 'Không thể lưu thông tin' });
    }
  };

  const filteredManifest = useMemo(() => !manifestSearch.trim() ? tripBookings : tripBookings.filter(b => b.passenger.phone.includes(manifestSearch.toLowerCase()) || (b.passenger.name || "").toLowerCase().includes(manifestSearch.toLowerCase()) || b.items.some(i => i.tripId === selectedTrip?.id && i.seatIds.some(s => s.toLowerCase().includes(manifestSearch.toLowerCase())))), [tripBookings, manifestSearch, selectedTrip]);
  const totalManifestPrice = useMemo(() => filteredManifest.reduce((sum, booking) => sum + (booking.items.find(i => i.tripId === selectedTrip?.id)?.price || 0), 0), [filteredManifest, selectedTrip]);

  return (
    <Layout
      activeTab={activeTab} onTabChange={setActiveTab} selectedDate={selectedDate} onDateChange={setSelectedDate} availableTrips={availableTripsForDate} selectedTripId={selectedTripId} onTripChange={handleTripSelect} selectedDirection={selectedDirection} onDirectionChange={setSelectedDirection} routes={routes}
      headerRight={<RightSheet bookings={bookings} trips={trips} onSelectBooking={handleSelectBookingForEdit} onUndo={() => refreshData()} />}
    >
      {activeTab === "sales" && (
        <div className="flex flex-col md:flex-row gap-4 animate-in fade-in duration-300">
          <div className={`flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-all shrink-0 md:flex-1 md:h-[calc(100vh-140px)] ${swapSourceSeat ? "ring-2 ring-indigo-500 ring-offset-2" : ""}`}>
            <div className={`px-4 h-[40px] border-b flex items-center justify-between shrink-0 rounded-t-xl transition-colors ${swapSourceSeat ? "bg-indigo-600 border-indigo-600" : "bg-gradient-to-r from-indigo-950 via-indigo-900 to-indigo-950 border-indigo-900"}`}>
              <div className="flex items-center gap-3"><div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 border ${swapSourceSeat ? "bg-indigo-50 border-indigo-400" : "bg-indigo-900 border-indigo-800"}`}>{swapSourceSeat ? <ArrowRightLeft size={16} className="animate-pulse" /> : <BusFront size={16} />}</div>{selectedTrip ? (<div className="min-w-0"><div className="flex items-center gap-2 flex-wrap sm:flex-nowrap"><h2 className="text-xs sm:text-sm font-bold text-white leading-none truncate max-w-[120px] sm:max-w-none">{swapSourceSeat ? `Đang đổi: ${swapSourceSeat.label}` : selectedTrip.name}</h2>{selectedTrip.seats.some(s => s.status === SeatStatus.SELECTED) && !swapSourceSeat && <Badge className="bg-primary border-transparent h-4 text-[9px] px-1 whitespace-nowrap">Đang chọn</Badge>}{!swapSourceSeat && <div className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs"><span className="bg-yellow-400 px-1.5 py-0.5 rounded-md inline-flex items-center justify-center font-bold text-slate-900 border border-yellow-500 whitespace-nowrap">{selectedTrip.licensePlate}</span><span className="bg-slate-400 px-1.5 py-0.5 rounded-md inline-flex items-center justify-center text-white border border-slate-500 whitespace-nowrap hidden sm:inline-flex">{selectedTrip.departureTime.split(" ")[1]}</span></div>}</div></div>) : <div className="text-white text-xs sm:text-sm font-medium">Chọn chuyến xe</div>}</div>
              {swapSourceSeat && <button onClick={() => setSwapSourceSeat(null)} className="text-white text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded">Hủy</button>}
            </div>
            <div className="flex-1 overflow-y-auto">{selectedTrip ? <SeatMap seats={selectedTrip.seats} busType={selectedTrip.type} onSeatClick={handleSeatClick} bookings={tripBookings} currentTripId={selectedTrip.id} onSeatSwap={setSwapSourceSeat} editingBooking={editingBooking} swapSourceSeatId={swapSourceSeat?.id} onSeatRightClick={(s,b) => setSeatDetailModal({seat:s, booking:b})} /> : <div className="h-[400px] md:h-full flex flex-col items-center justify-center text-slate-300 p-8 text-center"><BusFront size={48} className="mb-4 opacity-20" /><p className="text-sm font-medium">Vui lòng chọn chuyến xe</p></div>}</div>
          </div>
          <div className="w-full md:w-[320px] xl:w-[360px] flex flex-col gap-4 shrink-0 md:h-[calc(100vh-140px)]">
            <BookingForm bookingForm={bookingForm} setBookingForm={setBookingForm} bookingMode={bookingMode} setBookingMode={setBookingMode} selectionBasket={selectionBasket} bookings={bookings} routes={routes} phoneError={phoneError} setPhoneError={setPhoneError} editingBooking={editingBooking} onConfirm={() => setIsPaymentModalOpen(true)} onCancel={() => { setEditingBooking(null); refreshData(); }} validatePhoneNumber={v => null} onNavigateToTrip={(date, id) => { setSelectedDate(date); setSelectedTripId(id); }} />
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col min-h-[300px] md:flex-1 overflow-hidden">
               <div className="px-3 py-2.5 bg-white border-b border-slate-100 flex justify-between items-center shrink-0"><div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs"><Users size={14} className="text-slate-400" /><span>Danh sách khách ({tripBookings.length})</span></div><ManifestPrint selectedTrip={selectedTrip} manifest={filteredManifest} /></div>
               <div className="p-2 border-b border-slate-100 bg-slate-50/50"><div className="relative"><Search size={14} className="absolute left-2.5 top-2 text-slate-400" /><input type="text" value={manifestSearch} onChange={e => setManifestSearch(e.target.value)} placeholder="Tìm kiếm..." className="w-full pl-8 pr-7 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none bg-white" /></div></div>
               <div className="px-3 py-2 bg-indigo-50/50 border-b border-indigo-100 flex justify-between items-center text-xs shrink-0"><div className="flex items-center gap-1.5 text-slate-500 font-bold uppercase tracking-tight"><Calculator size={14} /><span>Tổng thực thu:</span></div><div className="font-black text-red-700 text-sm">{totalManifestPrice.toLocaleString("vi-VN")}</div></div>
               <div className="flex-1 overflow-y-auto">{filteredManifest.map((b, idx) => (<div key={idx} onClick={() => handleSelectBookingForEdit(b)} className="px-3 py-2 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors"><div className="flex justify-between items-center mb-1.5"><span className="text-xs font-bold text-slate-800">{b.passenger.phone}</span></div><div className="flex justify-between items-start gap-2"><div className="flex gap-1 text-[11px] text-slate-600 flex-wrap">{b.items.find(i => i.tripId === selectedTrip?.id)?.seatIds.map(s => (<span key={s} className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{s}</span>))}</div><div className="text-xs font-black text-green-600">{(b.items.find(i => i.tripId === selectedTrip?.id)?.price || 0).toLocaleString("vi-VN")}</div></div></div>))}</div>
            </div>
          </div>
        </div>
      )}

      {seatDetailModal && (
        <SeatDetailModal
          isOpen={!!seatDetailModal}
          onClose={() => setSeatDetailModal(null)}
          booking={seatDetailModal.booking}
          seat={seatDetailModal.seat}
          bookings={bookings}
          onSave={handleSavePassengerDetail}
        />
      )}

      {activeTab === "sorting" && <SeatSortingView trips={trips} bookings={bookings} onRefresh={refreshData} selectedDate={selectedDate} />}
      {activeTab === "finance" && <PaymentManager />}
      {activeTab === "schedule" && <ScheduleView trips={trips} routes={routes} buses={buses} onAddTrip={async () => {}} onUpdateTrip={async () => {}} onDeleteTrip={async () => {}} onUpdateBus={async () => {}} />}
      {activeTab === "settings" && <SettingsView routes={routes} setRoutes={setRoutes} buses={buses} setBuses={setBuses} trips={trips} setTrips={setTrips} onDataChange={refreshData} />}
    </Layout>
  );
}

function App() { return <ToastProvider><AppContent /></ToastProvider>; }
export default App;
