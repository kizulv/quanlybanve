import React, { useState, useMemo, useEffect } from "react";
import { Layout } from "./components/Layout";
import { SeatMap } from "./components/SeatMap";
import { SettingsView } from "./components/SettingsView";
import { ScheduleView } from "./components/ScheduleView";
import { Badge } from "./components/ui/Badge";
import { Button } from "./components/ui/Button";
import { ToastProvider, useToast } from "./components/ui/Toast";
import { RightSheet } from "./components/RightSheet";
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
  // History Search Suggestion State
  const [showHistory, setShowHistory] = useState(false);

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

  const validatePhoneNumber = (phone: string): string | null => {
    const raw = phone.replace(/\D/g, "");
    if (raw.length === 0) return "Vui lòng nhập số điện thoại";
    if (!raw.startsWith("0")) return "SĐT phải bắt đầu bằng số 0";
    if (raw.length !== 10) return "SĐT phải đủ 10 số";
    return null;
  };

  // -- HISTORY SEARCH LOGIC --

  // 1. Get ALL matches (for total count badge)
  const historyMatches = useMemo(() => {
    const cleanInput = bookingForm.phone.replace(/\D/g, "");
    if (cleanInput.length < 3) return []; // Start searching after 3 digits

    return bookings.filter((b) =>
      b.passenger.phone.replace(/\D/g, "").includes(cleanInput)
    );
  }, [bookings, bookingForm.phone]);

  // 2. Process for Display (Unique Routes List)
  const passengerHistory = useMemo(() => {
    // Group by unique route (Pickup -> Dropoff) to avoid duplicates
    // We only keep the MOST RECENT usage of a specific route pair
    const uniqueRoutes = new Map<
      string,
      {
        pickup: string;
        dropoff: string;
        phone: string;
        lastDate: string;
      }
    >();

    historyMatches.forEach((b) => {
      const pickup = b.passenger.pickupPoint || "";
      const dropoff = b.passenger.dropoffPoint || "";

      // Skip if both are empty as it's not useful history
      if (!pickup && !dropoff) return;

      // Normalize key: remove spaces, lowercase to ensure exact duplicate detection
      const key = `${pickup.toLowerCase().trim()}|${dropoff
        .toLowerCase()
        .trim()}`;

      const existing = uniqueRoutes.get(key);
      const isNewer = existing
        ? new Date(b.createdAt) > new Date(existing.lastDate)
        : true;

      if (!existing || isNewer) {
        uniqueRoutes.set(key, {
          pickup: b.passenger.pickupPoint || "", // Keep original casing
          dropoff: b.passenger.dropoffPoint || "", // Keep original casing
          phone: formatPhoneNumber(b.passenger.phone), // Ensure consistent format
          lastDate: b.createdAt,
        });
      }
    });

    return Array.from(uniqueRoutes.values())
      .sort(
        (a, b) =>
          new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime()
      )
      .slice(0, 5); // Take top 5 recent unique routes
  }, [historyMatches]);

  const applyHistory = (item: (typeof passengerHistory)[0]) => {
    setBookingForm((prev) => ({
      ...prev,
      phone: item.phone, // Already formatted in useMemo
      pickup: item.pickup,
      dropoff: item.dropoff,
    }));
    setPhoneError(null); // Clear error if picking from history (assumed valid)
    setShowHistory(false);
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

  // ... (Keep existing input handlers) ...
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    if (name === "phone") {
      setBookingForm((prev) => ({ ...prev, [name]: formatPhoneNumber(value) }));
      setPhoneError(null); // Clear error on change
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
    // Only validate if there is content
    if (bookingForm.phone.length > 0) {
      const error = validatePhoneNumber(bookingForm.phone);
      setPhoneError(error);
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

  const getStandardizedLocation = (input: string) => {
    if (!input) return "";
    let value = input.trim();
    // Logic: Nếu chưa có chữ BX ở đầu thì thêm vào
    if (!/^bx\s/i.test(value)) {
      // Simple case: add prefix
    }
    // Existing mappings logic (keep it)
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
      // Capitalize first letters
      value = value.replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());
      return `BX ${value}`;
    }

    return value.replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());
  };

  const handleLocationBlur = (field: "pickup" | "dropoff") => {
    let value = bookingForm[field].trim();
    if (!value) return;
    const standardized = getStandardizedLocation(value);
    if (standardized !== value) {
      setBookingForm((prev) => ({ ...prev, [field]: standardized }));
    }
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
            <div className="bg-indigo-950 rounded-xl shadow-lg border border-indigo-900 flex flex-col overflow-visible shrink-0 z-20 max-h-[75%]">
              {/* Basket Header & List similar to before... */}
              <div className="px-3 h-[50px] bg-gradient-to-r from-indigo-950 via-indigo-900 to-indigo-950 border-b border-indigo-900 flex items-center justify-between shrink-0 rounded-t-xl">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Ticket size={16} className="text-yellow-400" />
                  Thông tin đặt vé
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={cancelAllSelections}
                    disabled={selectionBasket.length === 0}
                    className="text-indigo-300 hover:text-white hover:bg-indigo-800 p-1.5 rounded-full transition-colors disabled:opacity-30"
                    title="Hủy chọn tất cả"
                  >
                    <RotateCcw size={14} />
                  </button>
                  <Badge className="bg-yellow-400 text-indigo-950 font-bold border-transparent">
                    {selectionBasket.reduce(
                      (acc, item) => acc + item.seats.length,
                      0
                    )}{" "}
                    vé
                  </Badge>
                </div>
              </div>

              <div className="p-3 overflow-y-auto flex-1 space-y-3 bg-indigo-950">
                {selectionBasket.length === 0 ? (
                  <div className="text-center py-6 text-indigo-300/50 italic text-sm border-2 border-dashed border-indigo-900 rounded-lg">
                    Chưa chọn ghế nào
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectionBasket.map((item, idx) => {
                      const tripDate = new Date(item.trip.departureTime);
                      const routeInfo = routes.find(
                        (r) => r.id === item.trip.routeId
                      );
                      const isEnhanced =
                        routeInfo?.isEnhanced ||
                        item.trip.name.includes("Tăng cường");

                      return (
                        <div
                          key={idx}
                          className="bg-white rounded-lg p-2.5 shadow-sm border-l-4 border-l-yellow-400"
                        >
                          <div className="flex justify-between items-start mb-1.5">
                            <div className="flex items-center gap-1.5">
                              <Badge
                                variant="outline"
                                className="text-[9px] h-4 px-1 bg-slate-50 border-slate-200"
                              >
                                {tripDate.getDate()}/{tripDate.getMonth() + 1}
                              </Badge>
                              <Badge
                                variant="secondary"
                                className="text-[9px] h-4 px-1 bg-indigo-50 text-indigo-700"
                              >
                                {formatLunarDate(tripDate).replace(
                                  " Âm Lịch",
                                  " ÂL"
                                )}
                              </Badge>
                            </div>
                            {isEnhanced && (
                              <Badge className="text-[9px] h-4 px-1 bg-amber-100 text-amber-700 border-amber-200">
                                <Zap
                                  size={8}
                                  className="mr-0.5 fill-amber-700"
                                />{" "}
                                TC
                              </Badge>
                            )}
                          </div>

                          <div
                            className="text-xs font-bold text-slate-800 mb-1 truncate"
                            title={item.trip.route}
                          >
                            {item.trip.route}
                          </div>

                          <div className="flex flex-wrap gap-1">
                            {item.seats.map((s) => (
                              <span
                                key={s.id}
                                className="inline-block bg-indigo-100 text-indigo-700 text-[10px] font-bold px-1.5 rounded border border-indigo-200"
                              >
                                {s.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* BOOKING MODE SELECTOR */}
              <div className="px-3 pb-3 bg-indigo-950">
                <div className="bg-indigo-900/50 p-1 rounded-lg flex border border-indigo-800">
                  <button
                    onClick={() => setBookingMode("booking")}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                      bookingMode === "booking"
                        ? "bg-yellow-500 text-indigo-950 shadow-sm"
                        : "text-indigo-300 hover:text-white"
                    }`}
                  >
                    <Ticket size={12} /> Đặt vé
                  </button>
                  <button
                    onClick={() => setBookingMode("payment")}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                      bookingMode === "payment"
                        ? "bg-green-600 text-white shadow-sm"
                        : "text-indigo-300 hover:text-white"
                    }`}
                  >
                    <Banknote size={12} /> Mua vé
                  </button>
                  <button
                    onClick={() => setBookingMode("hold")}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                      bookingMode === "hold"
                        ? "bg-purple-500 text-white shadow-sm"
                        : "text-indigo-300 hover:text-white"
                    }`}
                  >
                    <Lock size={12} /> Giữ vé
                  </button>
                </div>
              </div>

              {/* Input Form...  */}
              <div className="p-3 bg-indigo-900/50 border-t border-indigo-900 space-y-2 relative">
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
                          if (bookingForm.phone.length >= 3)
                            setShowHistory(true);
                        }}
                        className={`w-full pl-7 pr-2 py-1.5 text-xs rounded bg-indigo-950 border text-white placeholder-indigo-400 outline-none transition-colors
                          ${
                            phoneError
                              ? "border-red-500 focus:border-red-500"
                              : "border-indigo-800 focus:border-yellow-400"
                          }`}
                        placeholder="Số điện thoại"
                      />
                      <Phone
                        size={12}
                        className={`absolute left-2 top-2 ${
                          phoneError ? "text-red-500" : "text-indigo-400"
                        }`}
                      />

                      {/* HISTORY DROPDOWN */}
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
                                e.preventDefault(); // Prevent input blur
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
                                  e.preventDefault(); // Prevent blur before click
                                  applyHistory(item);
                                }}
                                className="px-3 py-2 hover:bg-indigo-50 cursor-pointer border-b border-slate-50 last:border-0 group"
                              >
                                <div className="flex justify-between items-start mb-0.5">
                                  <span className="text-xs font-bold text-indigo-700">
                                    {item.phone}
                                  </span>
                                  <span className="text-[9px] text-slate-400 flex items-center gap-1">
                                    <Clock3 size={9} />
                                    {new Date(item.lastDate).toLocaleDateString(
                                      "vi-VN"
                                    )}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
                                  <span className="truncate max-w-[45%] font-medium">
                                    {item.pickup}
                                  </span>
                                  <ArrowRight
                                    size={10}
                                    className="text-slate-300"
                                  />
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
                      <input
                        type="text"
                        name="pickup"
                        value={bookingForm.pickup}
                        onChange={handleInputChange}
                        onBlur={() => handleLocationBlur("pickup")}
                        className="w-full pl-2 pr-2 py-1.5 text-xs rounded bg-indigo-950 border border-indigo-800 text-white placeholder-indigo-400 focus:border-green-500 outline-none"
                        placeholder="Điểm đón"
                      />
                      <input
                        type="text"
                        name="dropoff"
                        value={bookingForm.dropoff}
                        onChange={handleInputChange}
                        onBlur={() => handleLocationBlur("dropoff")}
                        className="w-full pl-2 pr-2 py-1.5 text-xs rounded bg-indigo-950 border border-indigo-800 text-white placeholder-indigo-400 focus:border-red-500 outline-none"
                        placeholder="Điểm trả"
                      />
                    </div>
                    <textarea
                      name="note"
                      value={bookingForm.note}
                      onChange={handleInputChange}
                      className="w-full pl-2 pr-2 py-1.5 text-xs rounded bg-indigo-950 border border-indigo-800 text-white placeholder-indigo-400 focus:border-yellow-400 outline-none resize-none h-8"
                      placeholder="Ghi chú..."
                    />
                  </>
                ) : (
                  <div className="text-center py-4 bg-indigo-900/30 rounded border border-indigo-800 border-dashed text-xs text-indigo-300">
                    <Lock className="mx-auto mb-1 opacity-50" size={24} />
                    Chế độ Giữ vé không yêu cầu nhập thông tin khách hàng.
                  </div>
                )}

                <div className="flex justify-between items-center pt-1">
                  <span className="text-xs font-bold text-indigo-300 uppercase">
                    TỔNG TIỀN
                  </span>
                  <span className="text-base font-bold text-yellow-400">
                    {totalBasketPrice.toLocaleString("vi-VN")}{" "}
                    <span className="text-[10px] font-normal">đ</span>
                  </span>
                </div>
              </div>

              <div className="p-2 bg-indigo-950 border-t border-indigo-900 rounded-b-xl">
                <Button
                  className={`w-full font-bold h-10 text-sm ${
                    bookingMode === "booking"
                      ? "bg-yellow-500 hover:bg-yellow-400 text-indigo-950"
                      : bookingMode === "payment"
                      ? "bg-green-600 hover:bg-green-500 text-white"
                      : "bg-purple-600 hover:bg-purple-500 text-white"
                  }`}
                  onClick={handleConfirmAction}
                  disabled={selectionBasket.length === 0}
                >
                  <CheckCircle2 size={16} className="mr-2" /> Đồng ý
                </Button>
              </div>
            </div>

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