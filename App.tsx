import React, { useState, useMemo, useEffect } from "react";
import { Layout } from "./components/Layout";
import { SeatMap } from "./components/SeatMap";
import { SettingsView } from "./components/SettingsView";
import { ScheduleView } from "./components/ScheduleView";
import { BookingForm } from "./components/BookingForm";
import { PaymentModal } from "./components/PaymentModal";
import { ToastProvider, useToast } from "./components/ui/Toast";
import { RightSheet } from "./components/RightSheet";
import { Button } from "./components/ui/Button";
import {
  BusTrip,
  Seat,
  SeatStatus,
  Passenger,
  Booking,
  Route,
  Bus,
} from "./types";
import { api } from "./lib/api";
import { isSameDay } from "./utils/dateUtils";

function AppContent() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("sales");

  // Global Data
  const [trips, setTrips] = useState<BusTrip[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedDirection, setSelectedDirection] = useState<"outbound" | "inbound">("outbound");
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

  // Modal States
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  
  // Payment Context
  const [pendingPaymentContext, setPendingPaymentContext] = useState<{
    type: 'new' | 'update';
    bookingIds?: string[];
    totalPrice: number;
    initialPaidCash?: number;
    initialPaidTransfer?: number;
  } | null>(null);

  const [paymentForm, setPaymentForm] = useState({
    paidCash: 0,
    paidTransfer: 0
  });

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
      console.error("Failed to fetch data", error);
      toast({ type: "error", title: "Lỗi hệ thống", message: "Không thể tải dữ liệu." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Filter Logic
  const availableTripsForDate = useMemo(() => {
    return trips.filter((trip) => {
      const tripDate = new Date(trip.departureTime.split(" ")[0]);
      const dateMatch = isSameDay(tripDate, selectedDate);
      const tripDir = trip.direction || "outbound";
      return dateMatch && tripDir === selectedDirection;
    });
  }, [trips, selectedDate, selectedDirection]);

  // Select first trip if none selected or invalid
  useEffect(() => {
     if (availableTripsForDate.length > 0) {
         if (!selectedTripId || !availableTripsForDate.find(t => t.id === selectedTripId)) {
             setSelectedTripId(availableTripsForDate[0].id);
         }
     } else {
         setSelectedTripId(null);
     }
  }, [availableTripsForDate, selectedTripId]);

  const selectedTrip = trips.find((t) => t.id === selectedTripId) || null;

  // Bookings for current trip
  const tripBookings = useMemo(() => {
    if (!selectedTrip) return [];
    return bookings.filter(b => b.busId === selectedTrip.id && b.status !== "cancelled");
  }, [bookings, selectedTrip]);

  const selectedSeats = useMemo(() => {
      if (!selectedTrip) return [];
      return selectedTrip.seats.filter(s => s.status === SeatStatus.SELECTED);
  }, [selectedTrip]);

  // Handlers
  const handleSeatClick = (clickedSeat: Seat) => {
    if (!selectedTrip) return;

    // 1. Check if seat is BOOKED (Payment Update Logic)
    if (clickedSeat.status === SeatStatus.BOOKED) {
      const booking = tripBookings.find(b => b.seatId === clickedSeat.id);
      if (booking) {
        const currentPaid = (booking.payment?.paidCash || 0) + (booking.payment?.paidTransfer || 0);
        if (currentPaid < booking.totalPrice) {
           setPendingPaymentContext({
             type: 'update',
             bookingIds: [booking.id],
             totalPrice: booking.totalPrice,
             initialPaidCash: booking.payment?.paidCash || 0,
             initialPaidTransfer: booking.payment?.paidTransfer || 0
           });
           setPaymentForm({
             paidCash: booking.totalPrice - (booking.payment?.paidTransfer || 0), 
             paidTransfer: booking.payment?.paidTransfer || 0
           });
           setIsPaymentModalOpen(true);
        }
      }
      return;
    }

    // 2. Selection Logic
    const updatedSeats = selectedTrip.seats.map((seat) => {
        if (seat.id === clickedSeat.id) {
           let newStatus = seat.status;
           if (seat.status === SeatStatus.AVAILABLE) newStatus = SeatStatus.SELECTED;
           else if (seat.status === SeatStatus.SELECTED) newStatus = SeatStatus.AVAILABLE;
           return { ...seat, status: newStatus };
        }
        return seat;
    });

    const updatedTrip = { ...selectedTrip, seats: updatedSeats };
    setTrips(prev => prev.map(t => t.id === updatedTrip.id ? updatedTrip : t));
  };

  const handleBookingSubmit = async (passenger: Passenger) => {
    if (!selectedTrip || selectedSeats.length === 0) return;

    try {
        await api.bookings.create(selectedTrip.id, selectedSeats, passenger, { paidCash: 0, paidTransfer: 0 });
        toast({ type: 'success', title: 'Đặt vé thành công' });
        setIsBookingModalOpen(false);
        refreshData();
    } catch (e) {
        toast({ type: 'error', title: 'Lỗi', message: 'Không thể đặt vé' });
    }
  };

  const handlePaymentConfirm = async () => {
      if (!pendingPaymentContext) return;

      try {
          if (pendingPaymentContext.type === 'update' && pendingPaymentContext.bookingIds) {
              await api.bookings.updatePayment(pendingPaymentContext.bookingIds, paymentForm);
              toast({ type: 'success', title: 'Cập nhật thanh toán thành công' });
          }
          setIsPaymentModalOpen(false);
          setPendingPaymentContext(null);
          refreshData();
      } catch (e) {
          toast({ type: 'error', title: 'Lỗi', message: 'Thanh toán thất bại' });
      }
  };

  return (
    <Layout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      selectedDate={selectedDate}
      onDateChange={setSelectedDate}
      availableTrips={availableTripsForDate}
      selectedTripId={selectedTripId}
      onTripChange={setSelectedTripId}
      selectedDirection={selectedDirection}
      onDirectionChange={setSelectedDirection}
      routes={routes}
      headerRight={<RightSheet bookings={bookings} trips={trips} />}
    >
      {activeTab === 'sales' && (
        <div className="flex flex-col gap-4">
             {selectedTrip ? (
                <>
                   <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                      <SeatMap 
                        seats={selectedTrip.seats} 
                        busType={selectedTrip.type} 
                        onSeatClick={handleSeatClick}
                        bookings={tripBookings}
                      />
                   </div>
                   
                   {selectedSeats.length > 0 && (
                      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 animate-in slide-in-from-bottom-4 fade-in">
                          <Button 
                            className="shadow-xl rounded-full px-8 h-12 text-lg font-bold"
                            onClick={() => setIsBookingModalOpen(true)}
                          >
                             Đặt {selectedSeats.length} vé ngay
                          </Button>
                      </div>
                   )}
                </>
             ) : (
                <div className="text-center py-20 text-slate-400">
                   <p>Vui lòng chọn chuyến xe để xem sơ đồ ghế.</p>
                </div>
             )}
        </div>
      )}

      {activeTab === 'tickets' && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center text-slate-500">
             <p>Vui lòng sử dụng nút "Lịch sử" (icon đồng hồ) ở góc phải để tra cứu vé.</p>
          </div>
      )}

      {activeTab === 'schedule' && (
        <ScheduleView 
           trips={trips} 
           routes={routes} 
           buses={buses}
           onAddTrip={async (date, data) => {
              await api.trips.create(data as any);
              refreshData();
           }}
           onUpdateTrip={async (id, data) => {
              await api.trips.update(id, data);
              refreshData();
           }}
           onDeleteTrip={async (id) => {
              await api.trips.delete(id);
              refreshData();
           }}
           onUpdateBus={async (id, data) => {
              await api.buses.update(id, data);
              refreshData();
           }}
        />
      )}

      {activeTab === 'settings' && (
        <SettingsView 
           routes={routes} 
           setRoutes={setRoutes}
           buses={buses} 
           setBuses={setBuses}
           trips={trips}
           setTrips={setTrips}
           onDataChange={refreshData}
        />
      )}

      {isBookingModalOpen && (
        <BookingForm 
           selectedSeats={selectedSeats}
           onCancel={() => setIsBookingModalOpen(false)}
           onSubmit={handleBookingSubmit}
        />
      )}

      <PaymentModal 
         isOpen={isPaymentModalOpen}
         onClose={() => setIsPaymentModalOpen(false)}
         onConfirm={handlePaymentConfirm}
         totalPrice={pendingPaymentContext?.totalPrice || 0}
         paidCash={paymentForm.paidCash}
         paidTransfer={paymentForm.paidTransfer}
         onMoneyChange={(e) => {
             const val = parseInt(e.target.value.replace(/\D/g, '')) || 0;
             setPaymentForm(prev => ({ ...prev, [e.target.name]: val }));
         }}
      />
    </Layout>
  );
}

function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

export default App;