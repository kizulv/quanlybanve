
import React, { useState, useMemo, useEffect } from "react";
import { Layout } from "./components/Layout";
import { SeatMap } from "./components/SeatMap";
import { SettingsView } from "./components/SettingsView";
import { ScheduleView } from "./components/ScheduleView";
import { Badge } from "./components/ui/Badge";
import { ToastProvider, useToast } from "./components/ui/Toast";
import { RightSheet } from "./components/RightSheet";
import { BookingForm } from "./components/BookingForm";
import { SeatDetailModal } from "./components/SeatDetailModal";
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
  Clock3,
  Keyboard,
  ArrowRightLeft,
  MapPin,
  Locate,
  Notebook,
  Save,
  Phone,
  History,
  Clock,
  ArrowRight,
  AlertCircle,
  FileEdit,
  ArrowRight as ArrowRightIcon,
  Calendar
} from "lucide-react";
import { api } from "./lib/api";
import { isSameDay, formatLunarDate, formatTime } from "./utils/dateUtils";
import { PaymentModal } from "./components/PaymentModal";
import { Dialog } from "./components/ui/Dialog";
import { Button } from "./components/ui/Button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./components/ui/AlertDialog";

function AppContent() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("sales");

  // -- GLOBAL STATE (Fetched from API) --
  const [trips, setTrips] = useState<BusTrip[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // -- UNDO STACK --
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);

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

  // SWAP MODE STATE
  const [swapSourceSeat, setSwapSourceSeat] = useState<Seat | null>(null);

  // HIGHLIGHT STATE
  const [highlightedBookingId, setHighlightedBookingId] = useState<string | null>(null);

  // SEAT DETAIL MODAL STATE
  const [seatDetailModal, setSeatDetailModal] = useState<{
    booking: Booking | null;
    seat: Seat;
  } | null>(null);

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

  // EDIT MODE STATE
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  
  // UPDATE CONFIRMATION DIALOG STATE
  interface TripSummaryItem {
      route: string;
      date: Date;
      seats: string[];
  }

  const [updateSummary, setUpdateSummary] = useState<{
      diffCount: number;
      diffPrice: number;
      oldSeatCount: number;
      newSeatCount: number;
      oldPrice: number;
      newPrice: number;
      changesDetected: boolean;
      oldTrips: TripSummaryItem[];
      newTrips: TripSummaryItem[];
  } | null>(null);

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

  // Scroll to highlighted booking
  useEffect(() => {
    if (highlightedBookingId) {
      const el = document.getElementById(`booking-item-${highlightedBookingId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [highlightedBookingId]);

  // --- Handlers ---

  const handleTripSelect = (tripId: string) => {
    setSelectedTripId(tripId);
    setManifestSearch("");
    setSwapSourceSeat(null); // Reset swap mode
    setHighlightedBookingId(null); // Clear highlight

    // Auto-fill location based on route if form is empty
    const trip = trips.find((t) => t.id === tripId);
    if (
      trip &&
      !bookingForm.pickup &&
      !bookingForm.dropoff &&
      !editingBooking
    ) {
      // Logic to find route and fill
      let route = routes.find((r) => r.id === trip.routeId);
      if (!route) route = routes.find((r) => r.name === trip.route);

      if (route) {
        let rawPickup =
          trip.direction === "inbound" ? route.destination : route.origin;
        let rawDropoff =
          trip.direction === "inbound" ? route.origin : route.destination;

        // Ensure "BX" prefix logic (simple version)
        const formatLoc = (loc: string) =>
          loc && !/^bx\s/i.test(loc.trim()) ? `BX ${loc.trim()}` : loc;

        setBookingForm((prev) => ({
          ...prev,
          pickup: formatLoc(rawPickup || "") || "",
          dropoff: formatLoc(rawDropoff || "") || "",
        }));
      }
    }
  };

  const handleSeatClick = async (clickedSeat: Seat) => {
    if (!selectedTrip) return;

    // --- SWAP MODE LOGIC ---
    if (swapSourceSeat) {
        if (swapSourceSeat.id === clickedSeat.id) {
            // Clicked same seat, cancel swap
            setSwapSourceSeat(null);
            toast({ type: 'info', title: 'Hủy đổi', message: 'Đã hủy chế độ đổi chỗ' });
            return;
        }

        try {
            const result = await api.bookings.swapSeats(selectedTrip.id, swapSourceSeat.id, clickedSeat.id);
            setBookings(result.bookings);
            
            // Re-sync trips
            const updatedTripsMap = new Map<string, BusTrip>(
                result.trips.map((t: BusTrip) => [t.id, t])
            );
            setTrips((prev) => prev.map((t) => updatedTripsMap.get(t.id) || t));
            
            // Add to Undo Stack with details
            setUndoStack(prev => [...prev, {
                type: 'SWAPPED_SEATS',
                tripId: selectedTrip.id,
                seat1: clickedSeat.id, 
                seat2: swapSourceSeat.id,
                label1: clickedSeat.label,
                label2: swapSourceSeat.label,
                tripDate: selectedTrip.departureTime
            }]);

            toast({ type: 'success', title: 'Đổi chỗ thành công', message: `Đã đổi ${swapSourceSeat.label} sang ${clickedSeat.label}` });
        } catch (e) {
            toast({ type: 'error', title: 'Lỗi', message: 'Không thể đổi chỗ' });
        } finally {
            setSwapSourceSeat(null);
            // Close editing if open to refresh
            if (editingBooking) {
                setEditingBooking(null);
                setBookingForm({ ...bookingForm, phone: '', note: '' });
            }
        }
        return;
    }

    // 1. Check if seat is BOOKED/SOLD
    if (
      clickedSeat.status === SeatStatus.BOOKED ||
      clickedSeat.status === SeatStatus.SOLD
    ) {
      // Find the booking that contains this seat ID for this trip
      const booking = tripBookings.find((b) =>
        b.items.some(
          (item) =>
            item.tripId === selectedTrip.id &&
            item.seatIds.includes(clickedSeat.id)
        )
      );

      // Check if this booked seat belongs to the CURRENTLY editing booking
      if (editingBooking && booking && booking.id === editingBooking.id) {
        // It matches! This means user wants to REMOVE this seat from the edit session
        const updatedSeats = selectedTrip.seats.map((seat) => {
          if (seat.id === clickedSeat.id) {
            return { ...seat, status: SeatStatus.AVAILABLE };
          }
          return seat;
        });

        const updatedTrip = { ...selectedTrip, seats: updatedSeats };
        setTrips((prevTrips) =>
          prevTrips.map((t) => (t.id === selectedTrip.id ? updatedTrip : t))
        );
        return;
      }

      if (booking) {
        // HIGHLIGHT ONLY (DO NOT OPEN MODAL/EDIT)
        setHighlightedBookingId(booking.id);
      }
      return;
    }

    // 2. Selection Logic (Modify the specific trip in the global trips array)
    const updatedSeats = selectedTrip.seats.map((seat) => {
      if (seat.id === clickedSeat.id) {
        // CASE: Deselecting (currently SELECTED)
        if (seat.status === SeatStatus.SELECTED) {
           // Restore to original status (e.g. HELD) or default to AVAILABLE
           const restoreStatus = seat.originalStatus || SeatStatus.AVAILABLE;
           return {
             ...seat,
             status: restoreStatus,
             // If restoring to HELD, we keep the original status (or just status)
             // We can clear originalStatus now since it's back to normal
             // But preserving note is automatic via spread
           };
        }

        // CASE: Selecting (currently AVAILABLE or HELD)
        const isHeld = seat.status === SeatStatus.HELD;
        return {
          ...seat,
          status: SeatStatus.SELECTED,
          originalStatus: isHeld ? SeatStatus.HELD : undefined,
        };
      }
      return seat;
    });

    // Optimistically update global state
    const updatedTrip = { ...selectedTrip, seats: updatedSeats };
    setTrips((prevTrips) =>
      prevTrips.map((t) => (t.id === selectedTrip.id ? updatedTrip : t))
    );
  };

  const handleSeatRightClick = (seat: Seat, booking: Booking | null) => {
      setSeatDetailModal({
          booking,
          seat
      });
  };

  const handleSaveSeatDetail = async (updatedPassenger: Passenger) => {
      if (!seatDetailModal) return;
      const { booking, seat } = seatDetailModal;
      
      try {
          if (booking) {
              // CASE 1: Updating existing booking
              // Validate phone if changed
              const phoneError = validatePhoneNumber(updatedPassenger.phone);
              if (phoneError) {
                  toast({ type: 'warning', title: 'Số điện thoại không hợp lệ', message: phoneError });
                  return;
              }

              const result = await api.bookings.updatePassenger(booking.id, updatedPassenger);
              
              // Update local state
              setBookings(prev => prev.map(b => b.id === booking.id ? result.booking : b));
              
              toast({ type: 'success', title: 'Cập nhật thành công', message: 'Đã lưu thông tin hành khách.' });
          } else if (seat && selectedTrip) {
              // CASE 2: Updating HELD seat note
              const updatedSeats = selectedTrip.seats.map((s) => {
                  if (s.id === seat.id) {
                      return { ...s, note: updatedPassenger.note };
                  }
                  return s;
              });

              // Call API
              await api.trips.updateSeats(selectedTrip.id, updatedSeats);

              // Update Local
              setTrips((prev) =>
                  prev.map((t) => (t.id === selectedTrip.id ? { ...t, seats: updatedSeats } : t))
              );
              
              toast({ type: 'success', title: 'Cập nhật thành công', message: 'Đã lưu ghi chú cho ghế đang giữ.' });
          }
          
          setSeatDetailModal(null);
      } catch (e) {
          console.error(e);
          toast({ type: 'error', title: 'Lỗi', message: 'Không thể cập nhật thông tin.' });
      }
  };

  const handleSelectBookingFromHistory = (booking: Booking) => {
    setEditingBooking(booking);
    setHighlightedBookingId(null); // Clear highlight when entering edit mode

    // 1. Restore currently SELECTED seats to CORRECT STATUS (Booked/Sold/Held or Available)
    // IMPORTANT: If user had selected HELD seats before clicking edit, restore them to HELD
    const restoredTrips = trips.map((t) => ({
      ...t,
      seats: t.seats.map((s) => {
        if (s.status === SeatStatus.SELECTED) {
          const activeBooking = bookings.find(
            (b) =>
              b.status !== "cancelled" &&
              b.items.some(
                (item) => item.tripId === t.id && item.seatIds.includes(s.id)
              )
          );

          if (activeBooking) {
             const totalPaid = (activeBooking.payment?.paidCash || 0) + (activeBooking.payment?.paidTransfer || 0);
             const isSold = totalPaid >= activeBooking.totalPrice;
             return { ...s, status: isSold ? SeatStatus.SOLD : SeatStatus.BOOKED };
          }
          // Restore to HELD if it was held, else AVAILABLE
          return { ...s, status: s.originalStatus || SeatStatus.AVAILABLE };
        }
        return s;
      }),
    }));

    // 2. Convert the NEW Booking Items to Selected Seats
    const newTripsState = restoredTrips.map((trip) => {
      const matchingItem = booking.items.find((i) => i.tripId === trip.id);
      if (matchingItem) {
        return {
          ...trip,
          seats: trip.seats.map((s) => {
            if (matchingItem.seatIds.includes(s.id)) {
              return { ...s, status: SeatStatus.SELECTED };
            }
            return s;
          }),
        };
      }
      return trip;
    });

    setTrips(newTripsState);

    const paid =
      (booking.payment?.paidCash || 0) + (booking.payment?.paidTransfer || 0);
    const isFullyPaid = paid >= booking.totalPrice;

    setBookingMode(isFullyPaid ? "payment" : "booking");

    setBookingForm({
      phone: booking.passenger.phone,
      pickup: booking.passenger.pickupPoint || "",
      dropoff: booking.passenger.dropoffPoint || "",
      note: booking.passenger.note || "",
      paidCash: booking.payment?.paidCash || 0,
      paidTransfer: booking.payment?.paidTransfer || 0,
    });
  };

  // Helper to jump to a specific trip from basket
  const handleNavigateToTrip = (date: Date, tripId: string) => {
      setSelectedDate(date);
      setSelectedTripId(tripId);
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

      // Add to Undo Stack
      if (result.bookings.length > 0) {
          const b = result.bookings[0];
          // Collect labels for display
          const allLabels = selectionBasket.flatMap(i => i.seats.map(s => s.label));
          // Get primary trip date (first item) for display
          const primaryTripDate = selectionBasket.length > 0 ? selectionBasket[0].trip.departureTime : "";
          
          setUndoStack(prev => [...prev, {
              type: 'CREATED_BOOKING',
              bookingId: b.id,
              phone: b.passenger.phone,
              seatCount: b.totalTickets,
              seatLabels: allLabels,
              tripDate: primaryTripDate
          }]);
      }

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
        // Update SELECTED to HELD and Add Note
        const updatedSeats = item.trip.seats.map((s) => {
          if (s.status === SeatStatus.SELECTED) {
            // Note: When moving to confirmed HELD, we don't need originalStatus anymore
            // as this is the new committed state.
            const { originalStatus, ...rest } = s; 
            return { ...rest, status: SeatStatus.HELD, note: bookingForm.note };
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
      // Also clear note to be clean
      setBookingForm(prev => ({ ...prev, note: '' }));
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

  // Helper to execute update logic directly (used when no payment modal is needed)
  const executeBookingUpdate = async (targetBookingId: string) => {
      try {
        const payment = {
          paidCash: bookingForm.paidCash,
          paidTransfer: bookingForm.paidTransfer,
        };
        const passenger = {
          name: "Khách lẻ",
          phone: bookingForm.phone,
          note: bookingForm.note,
          pickupPoint: bookingForm.pickup,
          dropoffPoint: bookingForm.dropoff,
        };

        // Get currently selected items (from basket)
        const currentBookingItems = selectionBasket.map((item) => ({
          tripId: item.trip.id,
          seats: item.seats,
        }));

        // STORE OLD STATE FOR UNDO
        const oldBooking = bookings.find(b => b.id === targetBookingId);

        // MERGE LOGIC:
        // Since `selectionBasket` might only contain items for the displayed trip,
        // we must preserve items from other trips that are in `editingBooking` but not in the basket.
        let finalBookingItems = [...currentBookingItems];
        
        if (oldBooking) {
            // Find IDs of trips currently in basket
            const basketTripIds = new Set(currentBookingItems.map(i => i.tripId));
            
            // Find IDs of trips that are LOADED in the UI. 
            // If a trip is loaded in the UI, but has NO items in the basket, it means the user deliberately deselected all.
            const loadedTripIds = new Set(trips.map(t => t.id));
            
            // Filter original items
            const preservedItems = oldBooking.items.filter(item => {
                // If it's in the basket, we have new data, so don't preserve old data.
                if (basketTripIds.has(item.tripId)) return false;

                // If it's NOT in the basket, BUT the trip is currently loaded/visible,
                // it implies the user saw it and deselected everything. So we DO NOT preserve (we effectively delete it).
                if (loadedTripIds.has(item.tripId)) return false;

                // If the trip is NOT loaded in the UI (e.g. it's on a different date we haven't fetched/filtered),
                // then we MUST preserve it because the user couldn't have edited it.
                // (Note: `trips` state technically holds all fetched trips, so checking against it is safe)
                return true;
            });
            
            // Reconstruct seat objects for preserved items (since API expects {tripId, seats: Seat[]})
            // We need to look up these seats in `trips` state
            const reconstructedPreservedItems = preservedItems.map(item => {
                const trip = trips.find(t => t.id === item.tripId);
                const seatsObj = trip ? trip.seats.filter(s => item.seatIds.includes(s.id)) : [];
                return {
                    tripId: item.tripId,
                    seats: seatsObj.length > 0 ? seatsObj : item.seatIds.map(sid => ({ id: sid, price: 0 } as Seat))
                };
            });

            finalBookingItems = [...reconstructedPreservedItems, ...currentBookingItems];
        }

        const result = await api.bookings.update(
          targetBookingId,
          finalBookingItems,
          passenger,
          payment
        );

        // Update local list
        setBookings((prev) =>
          prev.map((b) => (b.id === targetBookingId ? result.booking : b))
        );

        // Sync trips from result.updatedTrips
        const updatedTripsMap = new Map<string, BusTrip>(
          result.updatedTrips.map((t: BusTrip) => [t.id, t])
        );
        setTrips((prev) => prev.map((t) => updatedTripsMap.get(t.id) || t));

        // Add to Undo Stack
        if (oldBooking) {
            setUndoStack(prev => [...prev, {
                type: 'UPDATED_BOOKING',
                previousBooking: oldBooking,
                phone: oldBooking.passenger.phone
            }]);
        }

        setIsPaymentModalOpen(false);
        setPendingPaymentContext(null);
        setEditingBooking(null); // Exit edit mode
        setBookingForm({ ...bookingForm, phone: "", note: "" }); // Reset form partially

        toast({
          type: "success",
          title: "Cập nhật thành công",
          message: "Đã lưu thay đổi đơn hàng.",
        });
      } catch (e) {
        console.error(e);
        toast({ type: "error", title: "Lỗi", message: "Cập nhật thất bại." });
      }
  };

  // UNIFIED ACTION HANDLER
  const handleConfirmAction = () => {
    if (editingBooking) {
      // 1. CALCULATE CHANGES FOR SUMMARY
      const oldPrice = editingBooking.totalPrice;
      const newPrice = totalBasketPrice;
      const oldSeatCount = editingBooking.totalTickets;
      const newSeatCount = selectionBasket.reduce((sum, item) => sum + item.seats.length, 0);
      
      const diffCount = newSeatCount - oldSeatCount;
      const diffPrice = newPrice - oldPrice;
      
      // Determine if there are *any* effective changes to commit
      const hasSeatChanges = diffCount !== 0 || newPrice !== oldPrice; 
      
      // 2. Build Old Trips Data
      const oldTrips = editingBooking.items.map(item => {
          // Try to find the live trip object to get latest seat labels if possible
          const liveTrip = trips.find(t => t.id === item.tripId);
          const seatLabels = item.seatIds.map(sid => {
              if (liveTrip) {
                  const s = liveTrip.seats.find(seat => seat.id === sid);
                  return s ? s.label : sid;
              }
              // If trip not loaded, return ID (or we could try to infer if we had map, but ID is safe fallback)
              return sid;
          });

          return {
              route: item.route,
              date: new Date(item.tripDate),
              seats: seatLabels.sort()
          };
      });

      // 3. Build New Trips Data
      const newTrips = selectionBasket.map(item => ({
          route: item.trip.route,
          date: new Date(item.trip.departureTime),
          seats: item.seats.map(s => s.label).sort()
      }));
      
      setUpdateSummary({
          diffCount,
          diffPrice,
          oldSeatCount,
          newSeatCount,
          oldPrice,
          newPrice,
          changesDetected: true,
          oldTrips,
          newTrips
      });
      return;
    }

    if (bookingMode === "booking") {
      handleBookingOnly();
    } else if (bookingMode === "payment") {
      handleInitiatePayment();
    } else if (bookingMode === "hold") {
      processHoldSeats();
    }
  };

  // PROCEED AFTER DIALOG CONFIRMATION
  const handleProceedUpdate = async () => {
      setUpdateSummary(null); // Close dialog
      
      if (!editingBooking) return;

      // CHECK IF PRICE INCREASED -> PAYMENT MODAL
      const priceIncreased = totalBasketPrice > editingBooking.totalPrice;
      
      if (!priceIncreased) {
          // If price is same or lower, save immediately without modal
          executeBookingUpdate(editingBooking.id);
      } else {
          // If price increased, need to show payment modal
          setPendingPaymentContext({
            type: "update",
            bookingIds: [editingBooking.id],
            totalPrice: totalBasketPrice,
          });
          setIsPaymentModalOpen(true);
      }
  };

  const handleConfirmPayment = async () => {
    if (pendingPaymentContext?.type === "update") {
      // Handle Update (Existing Booking)
      if (!pendingPaymentContext.bookingIds) return;
      // Re-use extracted function
      await executeBookingUpdate(pendingPaymentContext.bookingIds[0]);
    } else {
      // Handle New Booking with Payment
      await processBooking(true);
    }
  };

  const cancelAllSelections = async () => {
    // If editing, reverting means discarding changes and restoring original seat status
    if (editingBooking) {
      // We simply refresh data from API to restore original state
      // Or cleaner: Revert local state manually
      await refreshData();
      setEditingBooking(null);
      setBookingForm({ ...bookingForm, phone: "", note: "" });
      return;
    }

    // Update local state ONLY. Do not call API here.
    setTrips((prev) =>
      prev.map((t): BusTrip => {
        // Optimization: only update trips that have SELECTED seats
        if (t.seats.some(s => s.status === SeatStatus.SELECTED)) {
            return {
              ...t,
              seats: t.seats.map((s) =>
                s.status === SeatStatus.SELECTED
                  ? { ...s, status: s.originalStatus || SeatStatus.AVAILABLE } // Restore HELD/AVAILABLE
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

  const initiateSwap = (seat: Seat) => {
      setSwapSourceSeat(seat);
      toast({ 
          type: 'info', 
          title: 'Chế độ đổi chỗ', 
          message: `Đang chọn đổi ghế ${seat.label}. Vui lòng chọn ghế mới trên sơ đồ.` 
      });
  };

  // --- UNDO HANDLER ---
  const handleUndo = async () => {
      if (undoStack.length === 0) return;

      const action = undoStack[undoStack.length - 1];
      
      try {
          switch (action.type) {
              case 'CREATED_BOOKING':
                  // Call Delete/Cancel API
                  const delResult = await api.bookings.delete(action.bookingId);
                  // Refresh Data
                  setBookings(delResult.bookings);
                  // Re-sync trips manually or fetch
                  const updatedTripsMap = new Map<string, BusTrip>(
                    delResult.trips.map((t: BusTrip) => [t.id, t])
                  );
                  setTrips((prev) => prev.map((t) => updatedTripsMap.get(t.id) || t));
                  toast({ type: 'info', title: 'Đã hoàn tác', message: 'Đã hủy đơn hàng vừa tạo.' });
                  break;

              case 'UPDATED_BOOKING':
                  // Restore Old Booking Data
                  const oldB = action.previousBooking;
                  
                  // Reconstruct items payload for API
                  const bookingItemsPayload = oldB.items.map(item => {
                      const trip = trips.find(t => t.id === item.tripId);
                      const seatsObj = trip ? trip.seats.filter(s => item.seatIds.includes(s.id)) : [];
                      return {
                          tripId: item.tripId,
                          seats: seatsObj.length > 0 ? seatsObj : item.seatIds.map(sid => ({ id: sid, price: 0 } as Seat))
                      };
                  });

                  const res = await api.bookings.update(oldB.id, bookingItemsPayload, oldB.passenger, oldB.payment);
                  
                  // Update State
                  setBookings((prev) =>
                    prev.map((b) => (b.id === oldB.id ? res.booking : b))
                  );
                  const updatedTripsMap2 = new Map<string, BusTrip>(
                    res.updatedTrips.map((t: BusTrip) => [t.id, t])
                  );
                  setTrips((prev) => prev.map((t) => updatedTripsMap2.get(t.id) || t));
                  
                  toast({ type: 'info', title: 'Đã hoàn tác', message: 'Đã khôi phục trạng thái đơn hàng.' });
                  break;

              case 'SWAPPED_SEATS':
                  // Swap back: seat1 and seat2 are reversed from original action
                  const swapRes = await api.bookings.swapSeats(action.tripId, action.seat1, action.seat2);
                  setBookings(swapRes.bookings);
                  const updatedTripsMap3 = new Map<string, BusTrip>(
                    swapRes.trips.map((t: BusTrip) => [t.id, t])
                  );
                  setTrips((prev) => prev.map((t) => updatedTripsMap3.get(t.id) || t));
                  toast({ type: 'info', title: 'Đã hoàn tác', message: 'Đã đổi lại vị trí ghế.' });
                  break;
          }

          // Remove from stack
          setUndoStack(prev => prev.slice(0, -1));

      } catch (e) {
          console.error("Undo failed", e);
          toast({ type: 'error', title: 'Lỗi', message: 'Không thể hoàn tác hành động này.' });
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
      headerRight={
        <RightSheet
          bookings={bookings}
          trips={trips}
          onSelectBooking={handleSelectBookingFromHistory}
          onUndo={handleUndo}
          lastUndoAction={undoStack[undoStack.length - 1]}
        />
      }
    >
      {activeTab === "sales" && (
        <div className="h-[calc(100vh-140px)] flex flex-col md:flex-row gap-4 animate-in fade-in duration-300">
          {/* LEFT: SEAT MAP */}
          <div className={`flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden transition-all ${swapSourceSeat ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}`}>
            <div className={`px-4 h-[40px] border-b flex items-center justify-between shrink-0 rounded-t-xl transition-colors ${swapSourceSeat ? 'bg-indigo-600 border-indigo-600' : 'bg-gradient-to-r from-indigo-950 via-indigo-900 to-indigo-950 border-indigo-900'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 border ${swapSourceSeat ? 'bg-indigo-500 border-indigo-400' : 'bg-indigo-900 border-indigo-800'}`}>
                  {swapSourceSeat ? <ArrowRightLeft size={16} className="animate-pulse" /> : <BusFront size={16} />}
                </div>
                {selectedTrip ? (
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-white leading-none">
                        {swapSourceSeat ? `Đang đổi ghế: ${swapSourceSeat.label}` : selectedTrip.name}
                      </h2>
                      {selectedTrip.seats.some(
                        (s) => s.status === SeatStatus.SELECTED
                      ) && !swapSourceSeat && (
                        <Badge className="bg-primary border-transparent h-4 text-[9px] px-1">
                          Đang chọn
                        </Badge>
                      )}
                      {!swapSourceSeat && (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="bg-yellow-400 px-2 py-1 rounded-md inline-flex items-center justify-center font-bold text-slate-900 border border-yellow-500">
                              <Keyboard size={12} className="mr-1" />
                              {selectedTrip.licensePlate}
                            </span>
                            <span className="bg-slate-400 px-2 py-1 rounded-md inline-flex items-center justify-center text-white border border-slate-500">
                              Xuất bến: {selectedTrip.departureTime.split(" ")[1]}
                            </span>
                          </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-white text-sm font-medium">
                    Chọn chuyến để xem ghế
                  </div>
                )}
              </div>
              
              {swapSourceSeat && (
                  <button onClick={() => setSwapSourceSeat(null)} className="text-white text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded">Hủy đổi</button>
              )}

              {!swapSourceSeat && (
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
                      <div className="w-2.5 h-2.5 rounded bg-green-400 border border-slate-500"></div>{" "}
                      Đã bán
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded bg-purple-400 border border-purple-500"></div>{" "}
                      Giữ
                    </div>
                  </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {selectedTrip ? (
                <SeatMap
                  seats={selectedTrip.seats}
                  busType={selectedTrip.type}
                  onSeatClick={handleSeatClick}
                  bookings={tripBookings}
                  currentTripId={selectedTrip.id}
                  onSeatSwap={swapSourceSeat ? undefined : initiateSwap}
                  editingBooking={editingBooking}
                  onSeatRightClick={handleSeatRightClick}
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
              editingBooking={editingBooking}
              onConfirm={handleConfirmAction}
              onCancel={cancelAllSelections}
              validatePhoneNumber={validatePhoneNumber}
              onInitiateSwap={initiateSwap}
              onNavigateToTrip={handleNavigateToTrip}
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
                  const isHighlighted = booking.id === highlightedBookingId;

                  return (
                    <div
                      key={idx}
                      id={`booking-item-${booking.id}`}
                      onClick={() => handleSelectBookingFromHistory(booking)}
                      className={`p-2 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${
                        !isFullyPaid ? "bg-yellow-50/30" : ""
                      } ${
                        isHighlighted ? "bg-indigo-50 ring-2 ring-indigo-500 z-10" : ""
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-xs font-bold ${isHighlighted ? "text-indigo-600" : "text-indigo-800"}`}>
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
                    <th className="px-6 py-4">Trạng thái</th>
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
                            {booking.items.length === 0 && (
                              <span className="text-xs text-slate-400 italic">
                                Đã hủy hết ghế
                              </span>
                            )}
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
                          {booking.status === "cancelled" && (
                            <Badge
                              variant="destructive"
                              className="bg-red-100 text-red-700 border-red-200"
                            >
                              Đã hủy
                            </Badge>
                          )}
                          {booking.status === "modified" && (
                            <Badge
                              variant="default"
                              className="bg-blue-100 text-blue-700 border-blue-200"
                            >
                              Đã thay đổi
                            </Badge>
                          )}
                          {booking.status === "confirmed" && (
                            <Badge
                              variant="success"
                              className="bg-green-100 text-green-700 border-green-200"
                            >
                              Đã thanh toán
                            </Badge>
                          )}
                          {booking.status === "pending" && (
                            <Badge
                              variant="warning"
                              className="bg-yellow-100 text-yellow-700 border-yellow-200"
                            >
                              Tạo mới
                            </Badge>
                          )}
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

      {/* SEAT DETAIL MODAL */}
      <SeatDetailModal
        isOpen={!!seatDetailModal}
        onClose={() => setSeatDetailModal(null)}
        booking={seatDetailModal?.booking || null}
        seat={seatDetailModal?.seat || null}
        bookings={bookings}
        onSave={handleSaveSeatDetail}
      />
      
      {/* UPDATE CONFIRMATION DIALOG */}
      <AlertDialog open={!!updateSummary} onOpenChange={(open) => !open && setUpdateSummary(null)}>
        <AlertDialogContent className="max-w-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-blue-600 flex items-center gap-2">
                <FileEdit size={20} />
                Xác nhận thay đổi
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-slate-600 pt-2 space-y-4">
                <p>Bạn có chắc muốn lưu các thay đổi cho đơn hàng này?</p>
                
                {updateSummary && (
                    <div className="grid grid-cols-2 gap-4 py-2 text-sm">
                        {/* LEFT: OLD */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 bg-slate-50 p-2 rounded">
                                <History size={14}/> Trước khi sửa
                            </h4>
                            {updateSummary.oldTrips.length === 0 && <p className="text-xs italic text-slate-400 pl-2">Trống</p>}
                            {updateSummary.oldTrips.map((trip, idx) => (
                                <div key={idx} className="bg-slate-50 border border-slate-200 rounded-lg p-3 opacity-90">
                                    <div className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                                        <ArrowRightIcon size={10} className="text-slate-400"/>
                                        {trip.route}
                                    </div>
                                    <div className="text-[10px] text-slate-500 mb-2 pl-3.5">
                                        {trip.date.toLocaleDateString('vi-VN')} - {formatLunarDate(trip.date)}
                                    </div>
                                    <div className="flex flex-wrap gap-1 pl-3.5">
                                        {trip.seats.map(s => (
                                            <span key={s} className="bg-white text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                                {s}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* RIGHT: NEW */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-bold text-blue-600 uppercase flex items-center gap-2 bg-blue-50 p-2 rounded">
                                <FileEdit size={14}/> Sau khi sửa
                            </h4>
                            {updateSummary.newTrips.length === 0 && (
                                <div className="p-3 bg-red-50 text-red-600 rounded-lg border border-red-100 text-xs italic flex items-center gap-2">
                                    <AlertCircle size={14} /> Hủy hết vé
                                </div>
                            )}
                            {updateSummary.newTrips.map((trip, idx) => (
                                <div key={idx} className="bg-white border border-blue-200 rounded-lg p-3 shadow-sm ring-1 ring-blue-50">
                                    <div className="text-xs font-bold text-blue-800 mb-1 flex items-center gap-1">
                                        <ArrowRightIcon size={10} className="text-blue-400"/>
                                        {trip.route}
                                    </div>
                                    <div className="text-[10px] text-blue-600 mb-2 pl-3.5">
                                        {trip.date.toLocaleDateString('vi-VN')} - {formatLunarDate(trip.date)}
                                    </div>
                                    <div className="flex flex-wrap gap-1 pl-3.5">
                                        {trip.seats.map(s => (
                                            <span key={s} className="bg-blue-100 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                                {s}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {updateSummary && (
                    <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                        <span className="text-slate-500 text-xs">Tổng tiền:</span>
                        <div className="flex items-center gap-2 font-medium">
                            <span className="text-slate-400 line-through decoration-slate-300 text-xs">
                                {updateSummary.oldPrice.toLocaleString('vi-VN')}
                            </span>
                            <ArrowRightIcon size={14} className="text-slate-300" />
                            <span className={updateSummary.diffPrice > 0 ? "text-orange-600 font-bold" : updateSummary.diffPrice < 0 ? "text-blue-600 font-bold" : "text-slate-900 font-bold"}>
                                {updateSummary.newPrice.toLocaleString('vi-VN')} đ
                            </span>
                            {updateSummary.diffPrice !== 0 && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${updateSummary.diffPrice > 0 ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                    {updateSummary.diffPrice > 0 ? '+' : ''}{updateSummary.diffPrice.toLocaleString('vi-VN')}
                                </span>
                            )}
                        </div>
                    </div>
                )}
                
                {updateSummary && updateSummary.newSeatCount === 0 && (
                    <div className="p-2 bg-red-50 text-red-600 rounded text-xs border border-red-100 flex items-center gap-2 justify-center">
                        <AlertCircle size={14} />
                        <span>Đơn hàng sẽ chuyển sang trạng thái <strong>Đã hủy</strong>.</span>
                    </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setUpdateSummary(null)}>Quay lại</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleProceedUpdate}>Đồng ý lưu</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
