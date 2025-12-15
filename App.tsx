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
} from "lucide-react";
import { api } from "./lib/api";
import { isSameDay, formatLunarDate } from "./utils/dateUtils";
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
      toast({ type: "error", title: "Lỗi hệ thống", message: "Không thể tải dữ liệu." });
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

  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [pendingPaymentContext, setPendingPaymentContext] = useState<{
    type: 'new' | 'update';
    bookingIds?: string[];
    totalPrice: number;
  } | null>(null);

  // Activity Log State (Kept for internal logic if needed, but removed from UI)
  const [recentActivities, setRecentActivities] = useState<ActivityLog[]>([]);

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

  // Logic: Find all trips matching Date & Direction
  const availableTripsForDate = useMemo(() => {
    return trips.filter((trip) => {
      const tripDate = new Date(trip.departureTime.split(" ")[0]);
      const dateMatch = isSameDay(tripDate, selectedDate);
      const tripDir = trip.direction || "outbound";
      return dateMatch && tripDir === selectedDirection;
    });
  }, [trips, selectedDate, selectedDirection]);

  // Update selectedTripId when date changes if needed, 
  // BUT we don't want to reset it aggressively if the user is just browsing.
  // However, the Layout needs to know if the selectedTrip is in the current date to highlight it.

  const selectedTrip = trips.find((t) => t.id === selectedTripId) || null;

  // Filter bookings for the selected trip to pass to SeatMap
  const tripBookings = useMemo(() => {
    if (!selectedTrip) return [];
    return bookings.filter(
      (b) => b.busId === selectedTrip.id && b.status !== "cancelled"
    );
  }, [bookings, selectedTrip]);

  // --- GROUPED HISTORY (MANIFEST) LOGIC ---
  const groupedTripBookings = useMemo(() => {
    if (!selectedTrip) return [];

    const groups: Record<
      string,
      {
        phone: string;
        displayPhone: string;
        seats: string[];
        bookingIds: string[];
        totalPrice: number;
        paidCash: number;
        paidTransfer: number;
        lastCreatedAt: string;
        passengerName: string;
      }
    > = {};

    tripBookings.forEach((b) => {
      const rawPhone = b.passenger.phone || "";
      const cleanPhone = rawPhone.replace(/\D/g, "");
      const key = `${cleanPhone || "unknown"}_${b.createdAt}`;

      if (!groups[key]) {
        groups[key] = {
          phone: cleanPhone,
          displayPhone: rawPhone,
          seats: [],
          bookingIds: [],
          totalPrice: 0,
          paidCash: 0,
          paidTransfer: 0,
          lastCreatedAt: b.createdAt,
          passengerName: b.passenger.name || "Khách lẻ",
        };
      }

      groups[key].seats.push(b.seatId);
      groups[key].bookingIds.push(b.id);
      groups[key].totalPrice += b.totalPrice;
      groups[key].paidCash += b.payment?.paidCash || 0;
      groups[key].paidTransfer += b.payment?.paidTransfer || 0;

      if (new Date(b.createdAt) > new Date(groups[key].lastCreatedAt)) {
        groups[key].lastCreatedAt = b.createdAt;
      }
    });

    return Object.values(groups).sort(
      (a, b) =>
        new Date(b.lastCreatedAt).getTime() -
        new Date(a.lastCreatedAt).getTime()
    );
  }, [tripBookings, selectedTrip]);

  // --- FILTERED MANIFEST (SEARCH) ---
  const filteredManifest = useMemo(() => {
    if (!manifestSearch.trim()) return groupedTripBookings;

    const query = manifestSearch.toLowerCase();
    return groupedTripBookings.filter((group) => {
      const phoneMatch =
        group.phone.includes(query) || group.displayPhone.includes(query);
      const seatMatch = group.seats.some((s) =>
        s.toLowerCase().includes(query)
      );
      return phoneMatch || seatMatch;
    });
  }, [groupedTripBookings, manifestSearch]);

  // Auto update payment when total changes
  useEffect(() => {
    if (pendingPaymentContext && pendingPaymentContext.type === 'update') return;

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
        let rawPickup = trip.direction === "inbound" ? route.destination : route.origin;
        let rawDropoff = trip.direction === "inbound" ? route.origin : route.destination;
        setBookingForm(prev => ({
          ...prev,
          pickup: rawPickup || "",
          dropoff: rawDropoff || ""
        }));
      }
    }
  };

  const handleSeatClick = async (clickedSeat: Seat) => {
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
             totalPrice: booking.totalPrice
           });
           setBookingForm(prev => ({
             ...prev,
             paidCash: booking.totalPrice,
             paidTransfer: 0
           }));
           setIsPaymentModalOpen(true);
        }
      }
      return;
    }

    // 2. Selection Logic (Modify the specific trip in the global trips array)
    const updatedSeats = selectedTrip.seats.map((seat) => {