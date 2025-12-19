
import React, { useState, useMemo, useEffect, useRef } from "react";
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
import { ManifestReport } from "./components/ManifestReport";
import { useReactToPrint } from "react-to-print";
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
  Users,
  Search,
  X,
  ArrowRightLeft,
  MapPin,
  Locate,
  Save,
  Phone,
  Clock,
  AlertCircle,
  FileEdit,
  ArrowRight as ArrowRightIcon,
  Calendar,
  Calculator,
  Printer,
} from "lucide-react";
import { api } from "./lib/api";
import { isSameDay, formatLunarDate, formatTime } from "./utils/dateUtils";
import { PaymentModal } from "./components/PaymentModal";
import { Button } from "./components/ui/Button";

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

  // -- PRINT REF & HOOK --
  const reportRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: reportRef,
    documentTitle: `Bang_Ke_Hanh_Khach_${Date.now()}`,
  });

  // -- DATA FETCHING --
  const refreshData = async () => {
    try {
      const [tripsData, routesData, busesData, bookingsData] =
        await Promise.all([
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
      toast({
        type: "error",
        title: "Lỗi hệ thống",
        message: "Không thể tải dữ liệu.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // -- LOCAL UI STATE --
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [manifestSearch, setManifestSearch] = useState("");
  const [swapSourceSeat, setSwapSourceSeat] = useState<Seat | null>(null);
  const [highlightedBookingId, setHighlightedBookingId] = useState<string | null>(null);

  const [seatDetailModal, setSeatDetailModal] = useState<{
    booking: Booking | null;
    seat: Seat;
  } | null>(null);

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedDirection, setSelectedDirection] = useState<"outbound" | "inbound">("outbound");

  const [bookingForm, setBookingForm] = useState({
    phone: "",
    pickup: "",
    dropoff: "",
    note: "",
  });

  const [bookingMode, setBookingMode] = useState<"booking" | "payment" | "hold">("booking");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [modalPaymentInput, setModalPaymentInput] = useState({
    paidCash: 0,
    paidTransfer: 0,
  });

  // -- CALCULATED STATES --
  const selectionBasket = useMemo(() => {
    const basket: { trip: BusTrip; seats: Seat[] }[] = [];
    trips.forEach((trip) => {
      const selected = trip.seats.filter((s) => s.status === SeatStatus.SELECTED);
      if (selected.length > 0) {
        const route = routes.find((r) => r.id === trip.routeId || r.name === trip.route);
        const defaultPrice = route?.price || 0;
        const seatsWithPrice = selected.map((s) => ({
          ...s,
          price: s.price > 0 ? s.price : defaultPrice,
        }));
        basket.push({ trip, seats: seatsWithPrice });
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
    return bookings.filter(
      (b) => b.items.some((item) => item.tripId === selectedTrip.id) && b.status !== "cancelled"
    );
  }, [bookings, selectedTrip]);

  const filteredManifest = useMemo(() => {
    if (!manifestSearch.trim()) return tripBookings;
    const query = manifestSearch.toLowerCase();
    return tripBookings.filter((b) => {
      const phoneMatch = b.passenger.phone.includes(query);
      const nameMatch = (b.passenger.name || "").toLowerCase().includes(query);
      const seatMatch = b.items.some(
        (item) => item.tripId === selectedTrip?.id && item.seatIds.some((s) => s.toLowerCase().includes(query))
      );
      return phoneMatch || nameMatch || seatMatch;
    });
  }, [tripBookings, manifestSearch, selectedTrip]);

  const totalManifestPrice = useMemo(() => {
    return filteredManifest.reduce((sum, booking) => {
      const tripItem = booking.items.find((i) => i.tripId === selectedTrip?.id);
      return sum + (tripItem?.price || 0);
    }, 0);
  }, [filteredManifest, selectedTrip]);

  // -- HANDLERS --
  const handleTripSelect = (tripId: string) => {
    setSelectedTripId(tripId);
    setManifestSearch("");
    setSwapSourceSeat(null);
    setHighlightedBookingId(null);
  };

  const handlePrintManifest = () => {
    if (!selectedTrip || filteredManifest.length === 0) {
      toast({
        type: "warning",
        title: "Không có dữ liệu",
        message: "Vui lòng chọn chuyến có khách để xuất bảng kê.",
      });
      return;
    }
    handlePrint();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  return (
    <Layout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      selectedDate={selectedDate}
      onDateChange={setSelectedDate}
      availableTrips={availableTripsForDate}
      selectedTripId={selectedTripId}
      onTripChange={handleTripSelect}
      selectedDirection={selectedDirection}
      onDirectionChange={setSelectedDirection}
      routes={routes}
      headerRight={
        <RightSheet
          bookings={bookings}
          trips={trips}
          onSelectBooking={(b) => setEditingBooking(b)}
        />
      }
    >
      {activeTab === "sales" && (
        <div className="flex flex-col md:flex-row gap-4">
          <div className={`flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden md:flex-1 md:h-[calc(100vh-140px)]`}>
            <div className="px-4 h-[40px] border-b flex items-center justify-between shrink-0 bg-gradient-to-r from-indigo-950 to-indigo-900 text-white">
              <div className="flex items-center gap-3">
                <BusFront size={16} />
                <span className="text-xs font-bold">{selectedTrip ? selectedTrip.name : "Chọn chuyến"}</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {selectedTrip && (
                <SeatMap
                  seats={selectedTrip.seats}
                  busType={selectedTrip.type}
                  onSeatClick={(s) => {}}
                  bookings={tripBookings}
                  currentTripId={selectedTrip.id}
                />
              )}
            </div>
          </div>

          <div className="w-full md:w-[320px] xl:w-[360px] flex flex-col gap-4 shrink-0 md:h-[calc(100vh-140px)]">
            <BookingForm
              bookingForm={bookingForm}
              setBookingForm={setBookingForm}
              bookingMode={bookingMode}
              setBookingMode={setBookingMode}
              selectionBasket={selectionBasket}
              bookings={bookings}
              routes={routes}
              phoneError={phoneError}
              setPhoneError={setPhoneError}
              editingBooking={editingBooking}
              onConfirm={() => {}}
              onCancel={() => {}}
              validatePhoneNumber={() => null}
            />

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col min-h-[300px] md:flex-1 overflow-hidden">
              <div className="px-3 py-2.5 bg-white border-b border-slate-100 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs">
                  <Users size={14} className="text-slate-400" />
                  <span>Danh sách khách ({tripBookings.length})</span>
                </div>
              </div>

              <div className="px-3 py-2 bg-indigo-50/50 border-b border-indigo-100 flex justify-between items-center text-xs shrink-0">
                <div className="flex items-center gap-1.5 text-slate-500 font-bold uppercase tracking-tight">
                  <Calculator size={14} />
                  <span>Tổng thực thu:</span>
                </div>
                <div className="font-black text-red-700 text-sm">
                  {totalManifestPrice.toLocaleString("vi-VN")} đ
                </div>
              </div>

              <div className="flex-1 overflow-y-auto scrollbar-thin">
                {filteredManifest.map((booking, idx) => (
                  <div key={idx} className="px-3 py-2 border-b border-slate-100 hover:bg-slate-50 cursor-pointer">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-slate-800">{booking.passenger.phone}</span>
                    </div>
                    <div className="flex justify-between items-center">
                       <div className="flex gap-1">
                         {booking.items.find(i => i.tripId === selectedTrip?.id)?.seatIds.map(s => (
                           <Badge key={s} className="text-[9px] h-4 px-1">{s}</Badge>
                         ))}
                       </div>
                       <span className="text-xs font-bold text-green-600">
                         {booking.items.find(i => i.tripId === selectedTrip?.id)?.price.toLocaleString("vi-VN")}
                       </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-2 border-t border-slate-100 bg-white">
                <Button
                  variant="default"
                  className="w-full h-9 text-xs font-bold gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handlePrintManifest}
                  disabled={!selectedTrip || filteredManifest.length === 0}
                >
                  <Printer size={14} /> Xuất bảng kê (In PDF)
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Component for Printing */}
      <div className="hidden">
        {selectedTrip && (
          <ManifestReport
            ref={reportRef}
            trip={selectedTrip}
            manifest={filteredManifest}
            totalPrice={totalManifestPrice}
          />
        )}
      </div>

      {activeTab === "finance" && <PaymentManager />}
      {activeTab === "schedule" && (
        <ScheduleView
          trips={trips}
          routes={routes}
          buses={buses}
          onAddTrip={async (d, t) => {}}
          onUpdateTrip={async (id, t) => {}}
          onDeleteTrip={async (id) => {}}
          onUpdateBus={async (id, u) => {}}
        />
      )}
      {activeTab === "settings" && (
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

      <SeatDetailModal
        isOpen={!!seatDetailModal}
        onClose={() => setSeatDetailModal(null)}
        booking={seatDetailModal?.booking || null}
        seat={seatDetailModal?.seat || null}
        bookings={bookings}
        onSave={async (p) => { setSeatDetailModal(null); }}
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
