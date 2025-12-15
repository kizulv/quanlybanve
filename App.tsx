import React, { useState, useMemo, useEffect } from "react";
import { Layout } from "./components/Layout";
import { SeatMap } from "./components/SeatMap";
import { SettingsView } from "./components/SettingsView";
import { ScheduleView } from "./components/ScheduleView";
import { Badge } from "./components/ui/Badge";
import { Button } from "./components/ui/Button";
import { ToastProvider, useToast } from "./components/ui/Toast";
import { RightSheet } from "./components/RightSheet";
import { BookingForm } from "./components/BookingForm";
import {
  BusTrip,
  Seat,
  SeatStatus,
  Passenger,
  Booking,
  Route,
  Bus,
  BusType,
  ActivityLog,
} from "./types";
import {
  BusFront,
  Ticket,
  Loader2,
  Phone,
  Banknote,
  RotateCcw,
  Users,
  Search,
  X,
  Zap,
  CheckCircle2,
  Lock,
  Clock3,
  ArrowRight,
  History,
  AlertCircle,
} from "lucide-react";
import { api } from "./lib/api";
import { isSameDay, formatLunarDate, formatTime } from "./utils/dateUtils";
import { PaymentModal } from "./components/PaymentModal";

function AppContent() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("sales");

  // -- GLOBAL STATE (Fetched from API) --
  const [trips, setTrips] = useState<BusTrip[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  // Filter States
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedDirection, setSelectedDirection] = useState<
    "outbound" | "inbound"
  >("outbound");

  // Booking Form State
  const [bookingForm, setBookingForm] = useState({
    phone: "",
    pickup: "",
    dropoff: "",
    paidCash: 0,
    paidTransfer: 0,
    note: "",
  });

  const [bookingMode, setBookingMode] = useState<
    "booking" | "payment" | "hold"
  >("booking");

  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [pendingPaymentContext, setPendingPaymentContext] = useState<{
    type: "new" | "update";
    bookingIds?: string[];
    totalPrice: number;
  } | null>(null);

  // -- CALCULATED STATES (BASKET) --
  // Calculate all selected seats across ALL trips
  const selectionBasket = useMemo(() => {
    const basket: { trip: BusTrip; seats: Seat[] }[] = [];
    trips.forEach((trip) => {
      const selected = trip.seats.filter(
        (s) => s.status === SeatStatus.SELECTED
      );
      if (selected.length > 0) {
        basket.push({ trip, seats: selected });
      }
    });
    return basket;
  }, [trips]);

  const totalBasketPrice = useMemo(() => {
    return selectionBasket.reduce(
      (sum, item) => sum + item.seats.reduce((s, seat) => s + seat.price, 0),
      0
    );
  }, [selectionBasket]);

  // -- UTILS --
  const validatePhoneNumber = (phone: string): string | null => {
    const raw = phone.replace(/\D/g, "");
    if (raw.length === 0) return "Vui lòng nhập số điện thoại";
    if (!raw.startsWith("0")) return "SĐT phải bắt đầu bằng số 0";
    if (raw.length !== 10) return "SĐT phải đủ 10 số";
    return null;
  };

  // Logic: Find all trips matching Date & Direction
  const availableTripsForDate = useMemo(() => {
    return trips.filter((trip) => {
      const tripDate = new Date(trip.departureTime.split(" ")[0]);
      const dateMatch = isSameDay(tripDate, selectedDate);
      const tripDir = trip.direction || "outbound";
      return dateMatch && tripDir === selectedDirection;
    });
  }, [trips, selectedDate, selectedDirection]);

  const selectedTrip = trips.find((t) => t.id === selectedTripId) || null;

  // Filter bookings for the selected trip to pass to SeatMap
  // UPDATED: Must check inside nested `items` array
  const tripBookings = useMemo(() => {
    if (!selectedTrip) return [];
    return bookings.filter(
      (b) =>
        b.items.some((item) => item.tripId === selectedTrip.id) &&
        b.status !== "cancelled"
    );
  }, [bookings, selectedTrip]);

  // --- FILTERED MANIFEST (SEARCH) ---
  const filteredManifest = useMemo(() => {
    if (!manifestSearch.trim()) return tripBookings;

    const query = manifestSearch.toLowerCase();
    return tripBookings.filter((b) => {
      const phoneMatch = b.passenger.phone.includes(query);
      const nameMatch = (b.passenger.name || "").toLowerCase().includes(query);
      // Check seat IDs in the array for THIS trip
      const seatMatch = b.items.some(
        (item) =>
          item.tripId === selectedTrip?.id &&
          item.seatIds.some((s) => s.toLowerCase().includes(query))
      );
      return phoneMatch || nameMatch || seatMatch;
    });
  }, [tripBookings, manifestSearch, selectedTrip]);

  // Auto update payment when total changes
  useEffect(() => {
    if (pendingPaymentContext && pendingPaymentContext.type === "update")
      return;

    // Use totalBasketPrice for new bookings
    const currentTotal = pendingPaymentContext?.totalPrice || totalBasketPrice;

    if (bookingForm.paidTransfer === 0) {
      setBookingForm((prev) => ({ ...prev, paidCash: currentTotal }));
    } else {
      setBookingForm((prev) => ({
        ...prev,
        paidCash: Math.max(0, currentTotal - prev.paidTransfer),
      }));
    }
  }, [totalBasketPrice, pendingPaymentContext]);

  // --- Handlers ---

  // Helper to ensure "BX " prefix
  const ensureBxPrefix = (location: string) => {
    if (!location) return "";
    const trimmed = location.trim();
    if (!trimmed) return "";
    // Check if starts with BX (case insensitive)
    if (/^bx\s/i.test(trimmed)) {
      // It already has BX, just return nicely formatted
      return trimmed.replace(/^bx\s/i, "BX ");
    }
    return `BX ${trimmed}`;
  };

  const handleTripSelect = (tripId: string) => {
    setSelectedTripId(tripId);
    setManifestSearch("");

    // Auto-fill location based on route if form is empty
    const trip = trips.find((t) => t.id === tripId);
    if (trip && !bookingForm.pickup && !bookingForm.dropoff) {
      // Logic to find route and fill
      let route = routes.find((r) => r.id === trip.routeId);
      if (!route) route = routes.find((r) => r.name === trip.route);

      if (route) {
        let rawPickup =
          trip.direction === "inbound" ? route.destination : route.origin;
        let rawDropoff =
          trip.direction === "inbound" ? route.origin : route.destination;

        // Ensure "BX" prefix logic
        rawPickup = ensureBxPrefix(rawPickup || "");
        rawDropoff = ensureBxPrefix(rawDropoff || "");

        setBookingForm((prev) => ({
          ...prev,
          pickup: rawPickup || "",
          dropoff: rawDropoff || "",
        }));
      }
    }
  };

  const handleSeatClick = async (clickedSeat: Seat) => {
    if (!selectedTrip) return;

    // 1. Check if seat is BOOKED (Payment Update Logic)
    if (clickedSeat.status === SeatStatus.BOOKED) {
      // Find the booking that contains this seat ID for this trip
      const booking = tripBookings.find((b) =>
        b.items.some(
          (item) =>
            item.tripId === selectedTrip.id &&
            item.seatIds.includes(clickedSeat.id)
        )
      );

      if (booking) {
        const currentPaid =
          (booking.payment?.paidCash || 0) +
          (booking.payment?.paidTransfer || 0);
        if (currentPaid < booking.totalPrice) {
          setPendingPaymentContext({
            type: "update",
            bookingIds: [booking.id],
            totalPrice: booking.totalPrice,
          });
          setBookingForm((prev) => ({
            ...prev,
            paidCash: booking.totalPrice - (booking.payment?.paidTransfer || 0),
            paidTransfer: booking.payment?.paidTransfer || 0,
          }));
          setIsPaymentModalOpen(true);
        }
      }
      return;
    }

    // Check if seat is HELD
    if (clickedSeat.status === SeatStatus.HELD) {
      const updatedSeats = selectedTrip.seats.map((seat) => {
        if (seat.id === clickedSeat.id) {
          // If it was HELD, make it SELECTED so we can operate on it
          return { ...seat, status: SeatStatus.SELECTED };
        }
        return seat;
      });

      const updatedTrip = { ...selectedTrip, seats: updatedSeats };
      setTrips((prevTrips) =>
        prevTrips.map((t) => (t.id === selectedTrip.id ? updatedTrip : t))
      );
      return;
    }

    // 2. Selection Logic (Modify the specific trip in the global trips array)
    const updatedSeats = selectedTrip.seats.map((seat) => {
      if (seat.id === clickedSeat.id) {
        return {
          ...seat,
          status:
            seat.status === SeatStatus.SELECTED
              ? SeatStatus.AVAILABLE
              : SeatStatus.SELECTED,
        };
      }
      return seat;
    });

    // Optimistically update global state
    const updatedTrip = { ...selectedTrip, seats: updatedSeats };
    setTrips((prevTrips) =>
      prevTrips.map((t) => (t.id === selectedTrip.id ? updatedTrip : t))
    );

    // Sync with backend (optional, but good for persistence if implemented)
    try {
      await api.trips.updateSeats(selectedTrip.id, updatedSeats);
    } catch (e) {
      console.error("Failed to update seat status", e);
      toast({
        type: "error",
        title: "Lỗi",
        message: "Không thể cập nhật trạng thái ghế.",
      });
    }
  };

  // Handle Create Booking (Single or Multi-Trip)
  const processBooking = async (isPaid: boolean) => {
    if (selectionBasket.length === 0) {
      toast({
        type: "warning",
        title: "Chưa chọn ghế",
        message: "Vui lòng chọn ít nhất 1 ghế.",
      });
      return;
    }

    // Validate Phone Strict
    const error = validatePhoneNumber(bookingForm.phone);
    if (error) {
      setPhoneError(error);
      toast({
        type: "error",
        title: "Số điện thoại không hợp lệ",
        message: error,
      });
      return;
    }

    if (!bookingForm.phone) {
      toast({
        type: "warning",
        title: "Thiếu thông tin",
        message: "Vui lòng nhập số điện thoại khách hàng.",
      });
      return;
    }

    const passenger: Passenger = {
      name: "Khách lẻ",
      phone: bookingForm.phone,
      note: bookingForm.note,
      pickupPoint: bookingForm.pickup,
      dropoffPoint: bookingForm.dropoff,
    };

    const payment = isPaid
      ? {
          paidCash: bookingForm.paidCash,
          paidTransfer: bookingForm.paidTransfer,
        }
      : { paidCash: 0, paidTransfer: 0 };

    // Prepare items for single API call
    const bookingItems = selectionBasket.map((item) => ({
      tripId: item.trip.id,
      seats: item.seats,
    }));

    try {
      // Single API Call
      const result = await api.bookings.create(
        bookingItems,
        passenger,
        payment
      );

      // Update Local State with returned data
      const updatedTripsMap = new Map<string, BusTrip>(
        result.updatedTrips.map((t: BusTrip) => [t.id, t])
      );
      setTrips((prev) => prev.map((t) => updatedTripsMap.get(t.id) || t));

      setBookings((prev) => [...prev, ...result.bookings]);

      // Reset
      setIsPaymentModalOpen(false);
      setPendingPaymentContext(null);
      setBookingForm((prev) => ({ ...prev, note: "", phone: "" })); // Keep location?
      setPhoneError(null);

      if (selectedTrip) handleTripSelect(selectedTrip.id);

      toast({
        type: "success",
        title: "Thanh toán thành công",
        message: `Đã tạo 1 đơn hàng gồm ${selectionBasket.reduce(
          (a, b) => a + b.seats.length,
          0
        )} vé.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        type: "error",
        title: "Lỗi",
        message: "Có lỗi xảy ra khi tạo vé.",
      });
    }
  };

  // NEW: Handle Hold Logic
  const processHoldSeats = async () => {
    if (selectionBasket.length === 0) {
      toast({
        type: "warning",
        title: "Chưa chọn ghế",
        message: "Vui lòng chọn ghế để giữ.",
      });
      return;
    }

    try {
      // Iterate over basket and update each trip
      for (const item of selectionBasket) {
        // Update SELECTED to HELD
        const updatedSeats = item.trip.seats.map((s) => {
          if (s.status === SeatStatus.SELECTED) {
            return { ...s, status: SeatStatus.HELD };
          }
          return s;
        });

        // Call API to update seats only
        await api.trips.updateSeats(item.trip.id, updatedSeats);

        // Update local state
        setTrips((prev) =>
          prev.map(
            (t): BusTrip =>
              t.id === item.trip.id ? { ...t, seats: updatedSeats } : t
          )
        );
      }

      toast({
        type: "info",
        title: "Đã giữ vé",
        message: "Đã cập nhật trạng thái ghế sang Đang giữ.",
      });
      // Clear basket is automatic since status changed from SELECTED to HELD
    } catch (error) {
      console.error(error);
      toast({ type: "error", title: "Lỗi", message: "Không thể giữ vé." });
    }
  };

  const handleBookingOnly = () => processBooking(false);

  const handleInitiatePayment = () => {
    if (selectionBasket.length === 0) {
      toast({
        type: "warning",
        title: "Chưa chọn ghế",
        message: "Vui lòng chọn ít nhất 1 ghế.",
      });
      return;
    }
    
    const error = validatePhoneNumber(bookingForm.phone);
    if (error) {
      setPhoneError(error);
      toast({
        type: "error",
        title: "Số điện thoại không hợp lệ",
        message: error,
      });
      return;
    }

    if (!bookingForm.phone) {
      toast({
        type: "warning",
        title: "Thiếu thông tin",
        message: "Vui lòng nhập số điện thoại.",
      });
      return;
    }
    setPendingPaymentContext({
      type: "new",
      totalPrice: totalBasketPrice,
    });
    setIsPaymentModalOpen(true);
  };

  // UNIFIED ACTION HANDLER
  const handleConfirmAction = () => {
    if (bookingMode === "booking") {
      handleBookingOnly();
    } else if (bookingMode === "payment") {
      handleInitiatePayment();
    } else if (bookingMode === "hold") {
      processHoldSeats();
    }
  };

  const handleConfirmPayment = async () => {
    if (pendingPaymentContext?.type === "update") {
      // Handle Update (Existing Booking)
      if (!pendingPaymentContext.bookingIds) return;
      try {
        const payment = {
          paidCash: bookingForm.paidCash,
          paidTransfer: bookingForm.paidTransfer,
        };
        const result = await api.bookings.updatePayment(
          pendingPaymentContext.bookingIds,
          payment
        );
        setBookings(result.updatedBookings);
        // Sync trips from result.updatedTrips
        const updatedTripsMap = new Map<string, BusTrip>(
          result.updatedTrips.map((t: BusTrip) => [t.id, t])
        );
        setTrips((prev) => prev.map((t) => updatedTripsMap.get(t.id) || t));

        setIsPaymentModalOpen(false);
        setPendingPaymentContext(null);
        toast({
          type: "success",
          title: "Cập nhật thành công",
          message: "Đã cập nhật thanh toán.",
        });
      } catch (e) {
        toast({ type: "error", title: "Lỗi", message: "Cập nhật thất bại." });
      }
    } else {
      // Handle New Booking with Payment
      await processBooking(true);
    }
  };

  // Cancel all selections
  const cancelAllSelections = async () => {
    const tripsToUpdate = selectionBasket.map((item) => item.trip);
    const promises = tripsToUpdate.map(async (trip) => {
      const resetSeats = trip.seats.map((s) =>
        s.status === SeatStatus.SELECTED
          ? { ...s, status: SeatStatus.AVAILABLE }
          : s
      );
      return api.trips.updateSeats(trip.id, resetSeats);
    });

    try {
      await Promise.all(promises);

      // Update local state
      setTrips((prev) =>
        prev.map((t): BusTrip => {
          if (selectionBasket.find((i) => i.trip.id === t.id)) {
            return {
              ...t,
              seats: t.seats.map((s) =>
                s.status === SeatStatus.SELECTED
                  ? { ...s, status: SeatStatus.AVAILABLE }
                  : s
              ),
            };
          }
          return t;
        })
      );
      toast({
        type: "info",
        title: "Đã hủy chọn",
        message: "Đã hủy chọn tất cả ghế.",
      });
      setPhoneError(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleMoneyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numValue = parseInt(value.replace(/\D/g, "") || "0", 10);
    const targetTotal = pendingPaymentContext?.totalPrice || totalBasketPrice;

    setBookingForm((prev) => {
      if (targetTotal === 0) return { ...prev, [name]: numValue };
      let newCash = prev.paidCash;
      let newTransfer = prev.paidTransfer;
      if (name === "paidCash") {
        newCash = numValue;
        newTransfer = Math.max(0, targetTotal - newCash);
      } else if (name === "paidTransfer") {
        newTransfer = numValue;
        newCash = Math.max(0, targetTotal - newTransfer);
      }
      return { ...prev, paidCash: newCash, paidTransfer: newTransfer };
    });
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
      onDateChange={(d) => {
        setSelectedDate(d);
      }}
      availableTrips={availableTripsForDate}
      selectedTripId={selectedTripId}
      onTripChange={handleTripSelect}
      selectedDirection={selectedDirection}
      onDirectionChange={setSelectedDirection}
      routes={routes}
      headerRight={<RightSheet bookings={bookings} trips={trips} />}
    >
      {activeTab === "sales" && (
        <div className="h-[calc(100vh-140px)] flex flex-col md:flex-row gap-4 animate-in fade-in duration-300">
          {/* LEFT: SEAT MAP */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
            <div className="px-4 h-[54px] bg-gradient-to-r from-indigo-950 via-indigo-900 to-indigo-950 flex justify-between items-center shadow-sm z-10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-900 flex items-center justify-center text-yellow-400 shrink-0 border border-indigo-800">
                  <BusFront size={16} />
                </div>
                {selectedTrip ? (
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-white leading-none">
                        {selectedTrip.name}
                      </h2>
                      {selectedTrip.seats.some(
                        (s) => s.status === SeatStatus.SELECTED
                      ) && (
                        <Badge className="bg-primary border-transparent h-4 text-[9px] px-1">
                          Đang chọn
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center text-[10px] text-white gap-2 mt-0.5 opacity-80">
                      <span>{selectedTrip.licensePlate}</span>
                      <span>•</span>
                      <span>{selectedTrip.departureTime.split(" ")[1]}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-white text-sm font-medium">
                    Chọn chuyến để xem ghế
                  </div>
                )}
              </div>
              <div className="flex gap-4 text-[12px] text-white hidden lg:flex">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded border border-white/50 bg-white/10"></div>{" "}
                  Trống
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded bg-primary border border-white"></div>{" "}
                  Đang chọn
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded bg-yellow-400 border border-yellow-500"></div>{" "}
                  Đã đặt
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded bg-slate-400 border border-slate-500"></div>{" "}
                  Đã bán
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded bg-purple-400 border border-purple-500"></div>{" "}
                  Giữ
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {selectedTrip ? (
                <SeatMap
                  seats={selectedTrip.seats}
                  busType={selectedTrip.type}
                  onSeatClick={handleSeatClick}
                  bookings={tripBookings}
                  currentTripId={selectedTrip.id}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-300">
                  <BusFront size={48} className="mb-4 opacity-20" />
                  <p className="text-sm font-medium">Vui lòng chọn chuyến xe</p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: BOOKING FORM */}
          <div className="w-full md:w-[320px] xl:w-[360px] flex flex-col gap-2 shrink-0 h-full">
            <BookingForm
              bookingForm={bookingForm}
              setBookingForm={setBookingForm}
              bookingMode={bookingMode}
              setBookingMode={setBookingMode}
              selectionBasket={selectionBasket}
              bookings={bookings}
              routes={routes}
              totalPrice={totalBasketPrice}
              phoneError={phoneError}
              setPhoneError={setPhoneError}
              onConfirm={handleConfirmAction}
              onCancel={cancelAllSelections}
              validatePhoneNumber={validatePhoneNumber}
            />

            {/* MANIFEST LIST */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="px-3 py-2 bg-white border-b border-slate-100 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs">
                  <Users size={14} className="text-slate-400" />
                  <span>Danh sách đặt vé ({tripBookings.length})</span>
                </div>
              </div>

              <div className="p-2 border-b border-slate-100 bg-slate-50/50">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                    <Search size={14} className="text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={manifestSearch}
                    onChange={(e) => setManifestSearch(e.target.value)}
                    placeholder="Tìm..."
                    className="w-full pl-8 pr-7 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none bg-white placeholder-slate-400"
                  />
                  {manifestSearch && (
                    <button
                      title="Clear"
                      onClick={() => setManifestSearch("")}
                      className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-0 scrollbar-thin">
                {filteredManifest.map((booking, idx) => {
                  const totalPaid =
                    (booking.payment?.paidCash || 0) +
                    (booking.payment?.paidTransfer || 0);
                  const isFullyPaid = totalPaid >= booking.totalPrice;
                  const timeStr = new Date(
                    booking.createdAt
                  ).toLocaleTimeString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  // Extract seats for THIS selected trip
                  const tripItem = booking.items.find(
                    (i) => i.tripId === selectedTrip?.id
                  );
                  const seatsToShow = tripItem ? tripItem.seatIds : [];

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        const remaining = booking.totalPrice - totalPaid;
                        if (remaining > 0) {
                          setPendingPaymentContext({
                            type: "update",
                            bookingIds: [booking.id],
                            totalPrice: booking.totalPrice,
                          });
                          setBookingForm((prev) => ({
                            ...prev,
                            paidCash:
                              booking.totalPrice -
                              (booking.payment?.paidTransfer || 0),
                            paidTransfer: booking.payment?.paidTransfer || 0,
                          }));
                          setIsPaymentModalOpen(true);
                        }
                      }}
                      className={`p-2 border-b border-slate-100 cursor-pointer hover:bg-slate-50 ${
                        !isFullyPaid ? "bg-yellow-50/30" : ""
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-indigo-800">
                          {booking.passenger.phone}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {timeStr}
                        </span>
                      </div>
                      <div className="flex justify-between items-start">
                        <div className="flex gap-1 text-[11px] text-slate-600 font-medium w-[70%] flex-wrap">
                          {seatsToShow.map((s) => (
                            <span key={s} className="bg-slate-100 px-1 rounded">
                              {s}
                            </span>
                          ))}
                        </div>
                        <div
                          className={`text-xs font-bold ${
                            isFullyPaid ? "text-indigo-600" : "text-yellow-600"
                          }`}
                        >
                          {isFullyPaid
                            ? booking.totalPrice.toLocaleString("vi-VN")
                            : "Vé đặt"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TICKET LIST TAB */}
      {activeTab === "tickets" && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-900">
                Danh sách vé gần đây
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4">Mã vé</th>
                    <th className="px-6 py-4">Khách hàng</th>
                    <th className="px-6 py-4">Chi tiết (Chuyến/Ghế)</th>
                    <th className="px-6 py-4">Thanh toán</th>
                    <th className="px-6 py-4">Ngày tạo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bookings.map((booking) => {
                    const totalPaid =
                      (booking.payment?.paidCash || 0) +
                      (booking.payment?.paidTransfer || 0);
                    const isFullyPaid = totalPaid >= booking.totalPrice;
                    return (
                      <tr key={booking.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 font-medium text-primary align-top">
                          {booking.id.slice(-6).toUpperCase()}
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="font-bold">
                            {booking.passenger.name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {booking.passenger.phone}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-2">
                            {booking.items.map((item, i) => (
                              <div
                                key={i}
                                className="text-xs border-l-2 border-slate-200 pl-2"
                              >
                                <div className="font-semibold text-slate-700">
                                  {item.route} ({item.licensePlate})
                                </div>
                                <div className="text-slate-500">
                                  {new Date(item.tripDate).toLocaleDateString(
                                    "vi-VN",
                                    { day: "2-digit", month: "2-digit" }
                                  )}{" "}
                                  - {formatTime(item.tripDate)}
                                </div>
                                <div className="flex gap-1 mt-1">
                                  {item.seatIds.map((s) => (
                                    <Badge
                                      key={s}
                                      className="text-[10px] h-4 px-1"
                                    >
                                      {s}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div
                            className={`font-bold ${
                              isFullyPaid ? "text-slate-900" : "text-yellow-600"
                            }`}
                          >
                            {isFullyPaid
                              ? `${booking.totalPrice.toLocaleString(
                                  "vi-VN"
                                )} đ`
                              : "Vé đặt"}
                          </div>
                          {!isFullyPaid && (
                            <div className="text-xs text-slate-400 mt-1">
                              Đã cọc: {totalPaid.toLocaleString("vi-VN")}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-500 align-top">
                          {new Date(booking.createdAt).toLocaleDateString(
                            "vi-VN"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "schedule" && (
        <ScheduleView
          trips={trips}
          routes={routes}
          buses={buses}
          onAddTrip={async (d, t) => {
            await api.trips.create({
              ...t,
              id: `TRIP-${Date.now()}`,
            } as BusTrip);
            await refreshData();
          }}
          onUpdateTrip={async (id, t) => {
            await api.trips.update(id, t);
            await refreshData();
          }}
          onDeleteTrip={async (id) => {
            await api.trips.delete(id);
            await refreshData();
          }}
          onUpdateBus={async (id, u) => {
            await api.buses.update(id, u);
            await refreshData();
          }}
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

      {/* Payment Modal */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setPendingPaymentContext(null);
        }}
        onConfirm={handleConfirmPayment}
        totalPrice={pendingPaymentContext?.totalPrice || totalBasketPrice}
        paidCash={bookingForm.paidCash}
        paidTransfer={bookingForm.paidTransfer}
        onMoneyChange={handleMoneyChange}
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