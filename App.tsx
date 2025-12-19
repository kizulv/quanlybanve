import React, { useState, useMemo, useEffect } from "react";
import { Layout } from "./components/Layout";
import { SeatMap } from "./components/SeatMap";
import { SettingsView } from "./components/SettingsView";
import { ScheduleView } from "./components/ScheduleView";
import { PaymentManager } from "./components/PaymentManager"; // New Component
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
  Calendar,
  Calculator,
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

interface SeatOverride {
  price?: number;
  pickup?: string;
  dropoff?: string;
}

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
  const [highlightedBookingId, setHighlightedBookingId] = useState<
    string | null
  >(null);

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

  // Booking Form State - REMOVED PAYMENT FIELDS
  const [bookingForm, setBookingForm] = useState({
    phone: "",
    pickup: "",
    dropoff: "",
    note: "",
  });

  const [bookingMode, setBookingMode] = useState<
    "booking" | "payment" | "hold"
  >("booking");

  const [phoneError, setPhoneError] = useState<string | null>(null);

  // EDIT MODE STATE
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);

  // UPDATE CONFIRMATION DIALOG STATE
  interface DiffSeat {
    label: string;
    status: "kept" | "added" | "removed";
  }

  interface TripDiffItem {
    route: string;
    date: Date;
    seats: DiffSeat[];
  }

  const [updateSummary, setUpdateSummary] = useState<{
    diffCount: number;
    diffPrice: number;
    oldSeatCount: number;
    newSeatCount: number;
    oldPrice: number;
    newPrice: number;
    diffTrips: TripDiffItem[]; // NEW: Combined diff
  } | null>(null);

  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [pendingPaymentContext, setPendingPaymentContext] = useState<{
    type: "new" | "update";
    bookingIds?: string[];
    totalPrice: number;
  } | null>(null);

  // Local state for Payment Modal inputs (since removed from BookingForm)
  const [modalPaymentInput, setModalPaymentInput] = useState({
    paidCash: 0,
    paidTransfer: 0,
  });
  const [modalInitialOverrides, setModalInitialOverrides] = useState<
    Record<string, SeatOverride>
  >({});

  // -- CALCULATED STATES (BASKET) --
  // Calculate all selected seats across ALL trips
  const selectionBasket = useMemo(() => {
    const basket: { trip: BusTrip; seats: Seat[] }[] = [];
    trips.forEach((trip) => {
      const selected = trip.seats.filter(
        (s) => s.status === SeatStatus.SELECTED
      );
      if (selected.length > 0) {
        // Fallback: If seat price is 0, use Route's default price
        const route = routes.find(
          (r) => r.id === trip.routeId || r.name === trip.route
        );
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

  const totalBasketPrice = useMemo(() => {
    // If just booking (not payment), visually show 0 in summary
    if (!editingBooking && bookingMode === "booking") return 0;

    return selectionBasket.reduce((sum, basketItem) => {
      const itemTotal = basketItem.seats.reduce((seatSum, seat) => {
        let effectivePrice = seat.price;

        if (editingBooking) {
          const originalItem = editingBooking.items.find(
            (i) => i.tripId === basketItem.trip.id
          );

          if (originalItem && originalItem.tickets) {
            const ticket = originalItem.tickets.find(
              (t) => t.seatId === seat.id
            );
            if (ticket) effectivePrice = ticket.price;
          }
        }
        return seatSum + effectivePrice;
      }, 0);
      return sum + itemTotal;
    }, 0);
  }, [selectionBasket, editingBooking, bookingMode]);

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
      const seatMatch = b.items.some(
        (item) =>
          item.tripId === selectedTrip?.id &&
          item.seatIds.some((s) => s.toLowerCase().includes(query))
      );
      return phoneMatch || nameMatch || seatMatch;
    });
  }, [tripBookings, manifestSearch, selectedTrip]);

  // NEW: Calculate Total Price of the Filtered Manifest for current trip
  const totalManifestPrice = useMemo(() => {
    return filteredManifest.reduce((sum, booking) => {
      const tripItem = booking.items.find((i) => i.tripId === selectedTrip?.id);
      return sum + (tripItem?.price || 0);
    }, 0);
  }, [filteredManifest, selectedTrip]);

  // Auto update payment when total changes - ONLY IN PAYMENT MODE
  useEffect(() => {
    if (!isPaymentModalOpen) {
      setModalPaymentInput({ paidCash: 0, paidTransfer: 0 });
      setModalInitialOverrides({});
    }
  }, [isPaymentModalOpen]);

  // Scroll to highlighted booking
  useEffect(() => {
    if (highlightedBookingId) {
      const el = document.getElementById(
        `booking-item-${highlightedBookingId}`
      );
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [highlightedBookingId]);

  // --- Handlers ---

  const handleTripSelect = (tripId: string) => {
    setSelectedTripId(tripId);
    setManifestSearch("");
    setSwapSourceSeat(null);
    setHighlightedBookingId(null);

    const trip = trips.find((t) => t.id === tripId);
    if (
      trip &&
      !bookingForm.pickup &&
      !bookingForm.dropoff &&
      !editingBooking
    ) {
      let route = routes.find((r) => r.id === trip.routeId);
      if (!route) route = routes.find((r) => r.name === trip.route);

      if (route) {
        let rawPickup =
          trip.direction === "inbound" ? route.destination : route.origin;
        let rawDropoff =
          trip.direction === "inbound" ? route.origin : route.destination;

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

    if (swapSourceSeat) {
      if (swapSourceSeat.id === clickedSeat.id) {
        setSwapSourceSeat(null);
        toast({
          type: "info",
          title: "Hủy đổi",
          message: "Đã hủy chế độ đổi chỗ",
        });
        return;
      }

      try {
        const result = await api.bookings.swapSeats(
          selectedTrip.id,
          swapSourceSeat.id,
          clickedSeat.id
        );

        // Cập nhật state toàn cục để UI phản ánh thay đổi ngay lập tức
        setBookings(result.bookings);

        const updatedTripsMap = new Map<string, BusTrip>(
          result.trips.map((t: BusTrip) => [t.id, t])
        );
        setTrips((prev) => prev.map((t) => updatedTripsMap.get(t.id) || t));

        setUndoStack((prev) => [
          ...prev,
          {
            type: "SWAPPED_SEATS",
            tripId: selectedTrip.id,
            seat1: clickedSeat.id,
            seat2: swapSourceSeat.id,
            label1: clickedSeat.label,
            label2: swapSourceSeat.label,
            tripDate: selectedTrip.departureTime,
          },
        ]);

        toast({
          type: "success",
          title: "Đổi chỗ thành công",
          message: `Đã đổi ${swapSourceSeat.label} sang ${clickedSeat.label}`,
        });
      } catch (e) {
        console.error("Swap failed:", e);
        toast({
          type: "error",
          title: "Lỗi",
          message: "Không thể đổi chỗ. Vui lòng thử lại.",
        });
      } finally {
        setSwapSourceSeat(null);
        if (editingBooking) {
          setEditingBooking(null);
          setBookingForm({ ...bookingForm, phone: "", note: "" });
        }
      }
      return;
    }

    if (
      clickedSeat.status === SeatStatus.BOOKED ||
      clickedSeat.status === SeatStatus.SOLD ||
      clickedSeat.status === SeatStatus.HELD
    ) {
      const booking = tripBookings.find((b) =>
        b.items.some(
          (item) =>
            item.tripId === selectedTrip.id &&
            item.seatIds.includes(clickedSeat.id)
        )
      );

      if (editingBooking && booking && booking.id === editingBooking.id) {
        const updatedSeats = selectedTrip.seats.map((seat) => {
          if (seat.id === clickedSeat.id) {
            return { ...seat, status: SeatStatus.AVAILABLE };
          }
          return seat;
        });

        const updatedTrip = { ...selectedTrip, seats: updatedSeats };
        setTrips((prev) =>
          prev.map((t) => (t.id === selectedTrip.id ? updatedTrip : t))
        );
        return;
      }

      if (booking) {
        setHighlightedBookingId(booking.id);
      }
      return;
    }

    const updatedSeats = selectedTrip.seats.map((seat) => {
      if (seat.id === clickedSeat.id) {
        if (seat.status === SeatStatus.SELECTED) {
          const restoreStatus = seat.originalStatus || SeatStatus.AVAILABLE;
          return {
            ...seat,
            status: restoreStatus,
          };
        }

        const isHeld = seat.status === SeatStatus.HELD;
        return {
          ...seat,
          status: SeatStatus.SELECTED,
          originalStatus: isHeld ? SeatStatus.HELD : undefined,
        };
      }
      return seat;
    });

    const updatedTrip = { ...selectedTrip, seats: updatedSeats };
    setTrips((prev) =>
      prev.map((t) => (t.id === selectedTrip.id ? updatedTrip : t))
    );
  };

  const handleSeatRightClick = (seat: Seat, booking: Booking | null) => {
    setSeatDetailModal({
      booking,
      seat,
    });
  };

  const handleSaveSeatDetail = async (updatedPassenger: Passenger) => {
    if (!seatDetailModal) return;
    const { booking, seat } = seatDetailModal;

    try {
      if (booking) {
        const phoneError = validatePhoneNumber(updatedPassenger.phone);
        if (phoneError) {
          toast({
            type: "warning",
            title: "Số điện thoại không hợp lệ",
            message: phoneError,
          });
          return;
        }

        const result = await api.bookings.updatePassenger(
          booking.id,
          updatedPassenger
        );

        setBookings((prev) =>
          prev.map((b) => (b.id === booking.id ? result.booking : b))
        );

        toast({
          type: "success",
          title: "Cập nhật thành công",
          message: "Đã lưu thông tin hành khách.",
        });
      } else if (seat && selectedTrip) {
        // Find existing 'hold' booking if any for this seat
        const existingHold = tripBookings.find(
          (b) =>
            b.status === "hold" &&
            b.items.some(
              (i) => i.tripId === selectedTrip.id && i.seatIds.includes(seat.id)
            )
        );

        if (existingHold) {
          await api.bookings.updatePassenger(existingHold.id, updatedPassenger);
          await refreshData();
        } else {
          // Just update seat note if no booking record
          const updatedSeats = selectedTrip.seats.map((s) => {
            if (s.id === seat.id) {
              return { ...s, note: updatedPassenger.note };
            }
            return s;
          });

          await api.trips.updateSeats(selectedTrip.id, updatedSeats);
          setTrips((prev) =>
            prev.map((t) =>
              t.id === selectedTrip.id ? { ...t, seats: updatedSeats } : t
            )
          );
        }

        toast({
          type: "success",
          title: "Cập nhật thành công",
          message: "Đã lưu ghi chú.",
        });
      }

      setSeatDetailModal(null);
    } catch (e) {
      console.error(e);
      toast({
        type: "error",
        title: "Lỗi",
        message: "Không thể cập nhật thông tin.",
      });
    }
  };

  const handleSelectBookingFromHistory = (booking: Booking) => {
    setEditingBooking(booking);
    setHighlightedBookingId(null);

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
            const totalPaid =
              (activeBooking.payment?.paidCash || 0) +
              (activeBooking.payment?.paidTransfer || 0);
            const isSold = totalPaid >= activeBooking.totalPrice;
            return {
              ...s,
              status: isSold ? SeatStatus.SOLD : SeatStatus.BOOKED,
            };
          }
          return { ...s, status: s.originalStatus || SeatStatus.AVAILABLE };
        }
        return s;
      }),
    }));

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

    setBookingMode(
      isFullyPaid ? "payment" : booking.status === "hold" ? "hold" : "booking"
    );

    setBookingForm({
      phone: booking.passenger.phone,
      pickup: booking.passenger.pickupPoint || "",
      dropoff: booking.passenger.dropoffPoint || "",
      note: booking.passenger.note || "",
    });

    setModalPaymentInput({
      paidCash: booking.payment?.paidCash || 0,
      paidTransfer: booking.payment?.paidTransfer || 0,
    });
  };

  const handleNavigateToTrip = (date: Date, tripId: string) => {
    setSelectedDate(date);
    setSelectedTripId(tripId);
  };

  // Handle Create Booking (Single or Multi-Trip)
  const processBooking = async (
    paymentData?: { paidCash: number; paidTransfer: number },
    overrides: Record<string, SeatOverride> = {},
    noteSuffix: string = "",
    explicitStatus?: "booking" | "payment" | "hold"
  ) => {
    if (selectionBasket.length === 0) {
      toast({
        type: "warning",
        title: "Chưa chọn ghế",
        message: "Vui lòng chọn ít nhất 1 ghế.",
      });
      return;
    }

    const error = validatePhoneNumber(bookingForm.phone);
    if (error && bookingMode !== "hold") {
      setPhoneError(error);
      toast({
        type: "error",
        title: "Số điện thoại không hợp lệ",
        message: error,
      });
      return;
    }

    const finalNote = noteSuffix
      ? `${bookingForm.note} ${noteSuffix}`
      : bookingForm.note;

    const passenger: Passenger = {
      name: "Khách lẻ",
      phone: bookingForm.phone || "0000000000",
      note: finalNote,
      pickupPoint: bookingForm.pickup,
      dropoffPoint: bookingForm.dropoff,
    };

    const payment = paymentData || { paidCash: 0, paidTransfer: 0 };
    const isPaid = payment.paidCash + payment.paidTransfer > 0;

    const bookingItems = selectionBasket.map((item) => {
      const tickets = item.seats.map((s) => {
        const key = `${item.trip.id}_${s.id}`;
        const override = overrides[key];

        let finalPrice =
          override?.price !== undefined ? override.price : s.price;

        // QUAN TRỌNG: Nếu đang ở chế độ Đặt vé, ép giá vé về 0
        if (bookingMode === "booking") {
          finalPrice = 0;
        }

        return {
          seatId: s.id,
          price: finalPrice,
          pickup:
            override?.pickup !== undefined
              ? override.pickup
              : passenger.pickupPoint || "",
          dropoff:
            override?.dropoff !== undefined
              ? override.dropoff
              : passenger.dropoffPoint || "",
        };
      });

      return {
        tripId: item.trip.id,
        seats: item.seats,
        tickets: tickets,
      };
    });

    const status =
      explicitStatus ||
      (isPaid ? "payment" : bookingMode === "hold" ? "hold" : "booking");

    try {
      const result = await api.bookings.create(
        bookingItems,
        passenger,
        payment,
        status
      );

      const updatedTripsMap = new Map<string, BusTrip>(
        result.updatedTrips.map((t: BusTrip) => [t.id, t])
      );
      setTrips((prev) => prev.map((t) => updatedTripsMap.get(t.id) || t));

      setBookings((prev) => [...prev, ...result.bookings]);

      if (result.bookings.length > 0) {
        const b = result.bookings[0];
        const allLabels = selectionBasket.flatMap((i) =>
          i.seats.map((s) => s.label)
        );
        const primaryTripDate =
          selectionBasket.length > 0
            ? selectionBasket[0].trip.departureTime
            : "";

        setUndoStack((prev) => [
          ...prev,
          {
            type: "CREATED_BOOKING",
            bookingId: b.id,
            phone: b.passenger.phone,
            seatCount: b.totalTickets,
            seatLabels: allLabels,
            tripDate: primaryTripDate,
          },
        ]);
      }

      setIsPaymentModalOpen(false);
      setPendingPaymentContext(null);
      setBookingForm((prev) => ({ ...prev, note: "", phone: "" }));
      setPhoneError(null);
      setModalPaymentInput({ paidCash: 0, paidTransfer: 0 });
      setModalInitialOverrides({});

      if (selectedTrip) handleTripSelect(selectedTrip.id);

      toast({
        type: "success",
        title: "Thành công",
        message: "Đã tạo đơn hàng thành công.",
      });
    } catch (error) {
      console.error(error);
      toast({
        type: "error",
        title: "Lỗi",
        message: "Có lỗi xảy ra khi tạo đơn.",
      });
    }
  };

  const processHoldSeats = () => {
    // Hold mode now creates a booking with status 'hold'
    processBooking(undefined, {}, "", "hold");
  };

  const handleBookingOnly = () => processBooking(undefined, {}, "", "booking");

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

    const realPriceTotal = selectionBasket.reduce((sum, item) => {
      return sum + item.seats.reduce((sSum, s) => sSum + s.price, 0);
    }, 0);

    if (
      modalPaymentInput.paidCash === 0 &&
      modalPaymentInput.paidTransfer === 0
    ) {
      setModalPaymentInput({ paidCash: realPriceTotal, paidTransfer: 0 });
    }

    setPendingPaymentContext({
      type: "new",
      totalPrice: realPriceTotal,
    });
    setModalInitialOverrides({});
    setIsPaymentModalOpen(true);
  };

  const handleManualPaymentForEdit = () => {
    if (!editingBooking) return;

    const overrides: Record<string, SeatOverride> = {};
    editingBooking.items.forEach((item) => {
      if (item.tickets && item.tickets.length > 0) {
        item.tickets.forEach((ticket) => {
          overrides[`${item.tripId}_${ticket.seatId}`] = {
            price: ticket.price,
            pickup: ticket.pickup,
            dropoff: ticket.dropoff,
          };
        });
      }
    });

    setModalInitialOverrides(overrides);

    setPendingPaymentContext({
      type: "update",
      bookingIds: [editingBooking.id],
      totalPrice: totalBasketPrice,
    });
    setModalPaymentInput({
      paidCash: editingBooking.payment?.paidCash || 0,
      paidTransfer: editingBooking.payment?.paidTransfer || 0,
    });
    setIsPaymentModalOpen(true);
  };

  // Helper to execute update logic
  const executeBookingUpdate = async (
    targetBookingId: string,
    paymentData: { paidCash: number; paidTransfer: number },
    overrides: Record<string, SeatOverride> = {},
    noteSuffix: string = ""
  ) => {
    try {
      const finalNote = noteSuffix
        ? `${bookingForm.note} ${noteSuffix}`
        : bookingForm.note;

      const passenger = {
        name: "Khách lẻ",
        phone: bookingForm.phone,
        note: finalNote,
        pickupPoint: bookingForm.pickup,
        dropoffPoint: bookingForm.dropoff,
      };

      const currentBookingItems = selectionBasket.map((item) => {
        const tickets = item.seats.map((s) => {
          const key = `${item.trip.id}_${s.id}`;
          const override = overrides[key];

          let finalPrice =
            override?.price !== undefined ? override.price : s.price;

          // QUAN TRỌNG: Nếu đang ở chế độ Đặt vé, ép giá vé về 0
          if (bookingMode === "booking") {
            finalPrice = 0;
          }

          return {
            seatId: s.id,
            price: finalPrice,
            pickup:
              override?.pickup !== undefined
                ? override.pickup
                : passenger.pickupPoint || "",
            dropoff:
              override?.dropoff !== undefined
                ? override.dropoff
                : passenger.dropoffPoint || "",
          };
        });

        return {
          tripId: item.trip.id,
          seats: item.seats,
          tickets: tickets,
        };
      });

      const oldBooking = bookings.find((b) => b.id === targetBookingId);

      let finalBookingItems = [...currentBookingItems];

      if (oldBooking) {
        const basketTripIds = new Set(currentBookingItems.map((i) => i.tripId));
        const loadedTripIds = new Set(trips.map((t) => t.id));

        const preservedItems = oldBooking.items.filter((item) => {
          if (basketTripIds.has(item.tripId)) return false;
          if (loadedTripIds.has(item.tripId)) return false;
          return true;
        });

        const reconstructedPreservedItems = preservedItems.map((item) => {
          const trip = trips.find((t) => t.id === item.tripId);
          const seatsObj = trip
            ? trip.seats.filter((s) => item.seatIds.includes(s.id))
            : [];

          return {
            tripId: item.tripId,
            seats:
              seatsObj.length > 0
                ? seatsObj
                : item.seatIds.map((sid) => ({ id: sid, price: 0 } as Seat)),
            tickets: item.tickets,
          };
        });

        finalBookingItems = [
          ...reconstructedPreservedItems,
          ...currentBookingItems,
        ];
      }

      // Nếu chuyển sang Đặt vé, ép paymentData về 0 để đồng bộ
      const finalPayment =
        bookingMode === "booking"
          ? { paidCash: 0, paidTransfer: 0 }
          : paymentData;

      const result = await api.bookings.update(
        targetBookingId,
        finalBookingItems,
        passenger,
        finalPayment
      );

      setBookings((prev) =>
        prev.map((b) => (b.id === targetBookingId ? result.booking : b))
      );

      const updatedTripsMap = new Map<string, BusTrip>(
        result.updatedTrips.map((t: BusTrip) => [t.id, t])
      );
      setTrips((prev) => prev.map((t) => updatedTripsMap.get(t.id) || t));

      if (oldBooking) {
        setUndoStack((prev) => [
          ...prev,
          {
            type: "UPDATED_BOOKING",
            previousBooking: oldBooking,
            phone: oldBooking.passenger.phone,
          },
        ]);
      }

      setIsPaymentModalOpen(false);
      setPendingPaymentContext(null);
      setEditingBooking(null);
      setBookingForm({ ...bookingForm, phone: "", note: "" });
      setModalInitialOverrides({});

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
      const oldPrice = editingBooking.totalPrice;
      const newPrice = totalBasketPrice;
      const oldSeatCount = editingBooking.totalTickets;
      const newSeatCount = selectionBasket.reduce(
        (sum, item) => sum + item.seats.length,
        0
      );

      const diffCount = newSeatCount - oldSeatCount;
      const diffPrice = newPrice - oldPrice;

      const oldTripMap = new Map<string, string[]>();
      editingBooking.items.forEach((item) => {
        const liveTrip = trips.find((t) => t.id === item.tripId);
        const labels = item.seatIds.map((sid) => {
          if (liveTrip) {
            const s = liveTrip.seats.find((seat) => seat.id === sid);
            return s ? s.label : sid;
          }
          return sid;
        });
        oldTripMap.set(item.tripId, labels);
      });

      const newTripMap = new Map<string, string[]>();
      selectionBasket.forEach((item) => {
        const labels = item.seats.map((s) => s.label);
        newTripMap.set(item.trip.id, labels);
      });

      const allTripIds = new Set([...oldTripMap.keys(), ...newTripMap.keys()]);
      const diffTrips: TripDiffItem[] = [];

      allTripIds.forEach((tripId) => {
        const oldSeats = oldTripMap.get(tripId) || [];
        const newSeats = newTripMap.get(tripId) || [];
        const oldSet = new Set(oldSeats);
        const newSet = new Set(newSeats);

        const added = newSeats.filter((s) => !oldSet.has(s));
        const removed = oldSeats.filter((s) => !newSet.has(s));
        const kept = oldSeats.filter((s) => newSet.has(s));

        if (added.length === 0 && removed.length === 0 && kept.length === 0)
          return;

        let route = "";
        let dateStr = "";

        const basketItem = selectionBasket.find((i) => i.trip.id === tripId);
        if (basketItem) {
          route = basketItem.trip.route;
          dateStr = basketItem.trip.departureTime;
        } else {
          const oldItem = editingBooking.items.find((i) => i.tripId === tripId);
          if (oldItem) {
            route = oldItem.route;
            dateStr = oldItem.tripDate;
          }
        }

        const seatDiffs: DiffSeat[] = [];

        kept.forEach((s) => seatDiffs.push({ label: s, status: "kept" }));
        removed.forEach((s) => seatDiffs.push({ label: s, status: "removed" }));
        added.forEach((s) => seatDiffs.push({ label: s, status: "added" }));

        seatDiffs.sort((a, b) =>
          a.label.localeCompare(b.label, undefined, { numeric: true })
        );

        diffTrips.push({
          route,
          date: new Date(dateStr),
          seats: seatDiffs,
        });
      });

      setUpdateSummary({
        diffCount,
        diffPrice,
        oldSeatCount,
        newSeatCount,
        oldPrice,
        newPrice,
        diffTrips,
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

  const handleProceedUpdate = async () => {
    setUpdateSummary(null);

    if (!editingBooking) return;

    // Nếu đang chuyển sang Đặt vé, không cần qua bước Payment Modal phức tạp
    if (bookingMode === "booking") {
      await executeBookingUpdate(
        editingBooking.id,
        { paidCash: 0, paidTransfer: 0 },
        {},
        "(Chuyển sang Đặt vé)"
      );
      return;
    }

    setModalPaymentInput({
      paidCash: editingBooking.payment?.paidCash || 0,
      paidTransfer: editingBooking.payment?.paidTransfer || 0,
    });

    const overrides: Record<string, SeatOverride> = {};
    editingBooking.items.forEach((item) => {
      if (item.tickets) {
        item.tickets.forEach((ticket) => {
          overrides[`${item.tripId}_${ticket.seatId}`] = {
            price: ticket.price,
            pickup: ticket.pickup,
            dropoff: ticket.dropoff,
          };
        });
      }
    });
    setModalInitialOverrides(overrides);

    setPendingPaymentContext({
      type: "update",
      bookingIds: [editingBooking.id],
      totalPrice: totalBasketPrice,
    });
    setIsPaymentModalOpen(true);
  };

  const handleConfirmPayment = async (
    finalTotal?: number,
    overrides: Record<string, SeatOverride> = {},
    noteSuffix: string = ""
  ) => {
    const paymentPayload = {
      paidCash: modalPaymentInput.paidCash,
      paidTransfer: modalPaymentInput.paidTransfer,
    };

    if (pendingPaymentContext?.type === "update") {
      if (!pendingPaymentContext.bookingIds) return;
      await executeBookingUpdate(
        pendingPaymentContext.bookingIds[0],
        paymentPayload,
        overrides,
        noteSuffix
      );
    } else {
      await processBooking(paymentPayload, overrides, noteSuffix);
    }
  };

  const cancelAllSelections = async () => {
    if (editingBooking) {
      await refreshData();
      setEditingBooking(null);
      setBookingForm({ ...bookingForm, phone: "", note: "" });
      return;
    }

    setTrips((prev) =>
      prev.map((t): BusTrip => {
        if (t.seats.some((s) => s.status === SeatStatus.SELECTED)) {
          return {
            ...t,
            seats: t.seats.map((s) =>
              s.status === SeatStatus.SELECTED
                ? { ...s, status: s.originalStatus || SeatStatus.AVAILABLE }
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

  const handleModalMoneyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numValue = parseInt(value.replace(/\D/g, "") || "0", 10);
    setModalPaymentInput((prev) => ({ ...prev, [name]: numValue }));
  };

  const initiateSwap = (seat: Seat) => {
    setSwapSourceSeat(seat);
    toast({
      type: "info",
      title: "Chế độ đổi chỗ",
      message: `Đang chọn đổi ghế ${seat.label}. Vui lòng chọn ghế mới trên sơ đồ.`,
    });
  };

  const handleUndo = async () => {
    if (undoStack.length === 0) return;
    const action = undoStack[undoStack.length - 1];

    try {
      switch (action.type) {
        case "CREATED_BOOKING":
          const delResult = await api.bookings.delete(action.bookingId);
          setBookings(delResult.bookings);
          const updatedTripsMap = new Map<string, BusTrip>(
            delResult.trips.map((t: BusTrip) => [t.id, t])
          );
          setTrips((prev) => prev.map((t) => updatedTripsMap.get(t.id) || t));
          toast({
            type: "info",
            title: "Đã hoàn tác",
            message: "Đã hủy đơn hàng vừa tạo.",
          });
          break;

        case "UPDATED_BOOKING":
          const oldB = action.previousBooking;
          const bookingItemsPayload = oldB.items.map((item) => {
            const trip = trips.find((t) => t.id === item.tripId);
            const seatsObj = trip
              ? trip.seats.filter((s) => item.seatIds.includes(s.id))
              : [];
            return {
              tripId: item.tripId,
              seats:
                seatsObj.length > 0
                  ? seatsObj
                  : item.seatIds.map((sid) => ({ id: sid, price: 0 } as Seat)),
              tickets: item.tickets,
            };
          });

          const res = await api.bookings.update(
            oldB.id,
            bookingItemsPayload,
            oldB.passenger,
            oldB.payment
          );

          setBookings((prev) =>
            prev.map((b) => (b.id === oldB.id ? res.booking : b))
          );
          const updatedTripsMap2 = new Map<string, BusTrip>(
            res.updatedTrips.map((t: BusTrip) => [t.id, t])
          );
          setTrips((prev) => prev.map((t) => updatedTripsMap2.get(t.id) || t));

          toast({
            type: "info",
            title: "Đã hoàn tác",
            message: "Đã khôi phục trạng thái đơn hàng.",
          });
          break;

        case "SWAPPED_SEATS":
          const swapRes = await api.bookings.swapSeats(
            action.tripId,
            action.seat1,
            action.seat2
          );
          setBookings(swapRes.bookings);
          const updatedTripsMap3 = new Map<string, BusTrip>(
            swapRes.trips.map((t: BusTrip) => [t.id, t])
          );
          setTrips((prev) => prev.map((t) => updatedTripsMap3.get(t.id) || t));
          toast({
            type: "info",
            title: "Đã hoàn tác",
            message: "Đã đổi lại vị trí ghế.",
          });
          break;
      }

      setUndoStack((prev) => prev.slice(0, -1));
    } catch (e) {
      console.error("Undo failed", e);
      toast({
        type: "error",
        title: "Lỗi",
        message: "Không thể hoàn tác hành động này.",
      });
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
        <div className="flex flex-col md:flex-row gap-4 animate-in fade-in duration-300">
          {/* LEFT: SEAT MAP */}
          <div
            className={`flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-all shrink-0 md:flex-1 md:h-[calc(100vh-140px)] ${
              swapSourceSeat ? "ring-2 ring-indigo-500 ring-offset-2" : ""
            }`}
          >
            <div
              className={`px-4 h-[40px] border-b flex items-center justify-between shrink-0 rounded-t-xl transition-colors ${
                swapSourceSeat
                  ? "bg-indigo-600 border-indigo-600"
                  : "bg-gradient-to-r from-indigo-950 via-indigo-900 to-indigo-950 border-indigo-900"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 border ${
                    swapSourceSeat
                      ? "bg-indigo-50 border-indigo-400"
                      : "bg-indigo-900 border-indigo-800"
                  }`}
                >
                  {swapSourceSeat ? (
                    <ArrowRightLeft size={16} className="animate-pulse" />
                  ) : (
                    <BusFront size={16} />
                  )}
                </div>
                {selectedTrip ? (
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                      <h2 className="text-xs sm:text-sm font-bold text-white leading-none truncate max-w-[120px] sm:max-w-none">
                        {swapSourceSeat
                          ? `Đang đổi: ${swapSourceSeat.label}`
                          : selectedTrip.name}
                      </h2>
                      {selectedTrip.seats.some(
                        (s) => s.status === SeatStatus.SELECTED
                      ) &&
                        !swapSourceSeat && (
                          <Badge className="bg-primary border-transparent h-4 text-[9px] px-1 whitespace-nowrap">
                            Đang chọn
                          </Badge>
                        )}
                      {!swapSourceSeat && (
                        <div className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs">
                          <span className="bg-yellow-400 px-1.5 py-0.5 rounded-md inline-flex items-center justify-center font-bold text-slate-900 border border-yellow-500 whitespace-nowrap">
                            {selectedTrip.licensePlate}
                          </span>
                          <span className="bg-slate-400 px-1.5 py-0.5 rounded-md inline-flex items-center justify-center text-white border border-slate-500 whitespace-nowrap hidden sm:inline-flex">
                            {selectedTrip.departureTime.split(" ")[1]}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-white text-xs sm:text-sm font-medium">
                    Chọn chuyến xe
                  </div>
                )}
              </div>

              {swapSourceSeat && (
                <button
                  onClick={() => setSwapSourceSeat(null)}
                  className="text-white text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded"
                >
                  Hủy
                </button>
              )}

              {!swapSourceSeat && (
                <div className="flex gap-2 sm:gap-4 text-[10px] sm:text-[12px] text-white hidden lg:flex">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded border border-white/50 bg-white/10"></div>{" "}
                    Trống
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded bg-primary border border-white"></div>{" "}
                    Chọn
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded bg-yellow-400 border border-yellow-500"></div>{" "}
                    Đặt
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded bg-green-400 border border-slate-500"></div>{" "}
                    Bán
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
                  swapSourceSeatId={swapSourceSeat?.id} // Truyền ID ghế đang đổi
                />
              ) : (
                <div className="h-[400px] md:h-full flex flex-col items-center justify-center text-slate-300 p-8 text-center">
                  <BusFront size={48} className="mb-4 opacity-20" />
                  <p className="text-sm font-medium">
                    Vui lòng chọn chuyến xe từ thanh công cụ phía trên
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: BOOKING FORM & MANIFEST */}
          <div className="w-full md:w-[320px] xl:w-[360px] flex flex-col gap-4 shrink-0 md:h-[calc(100vh-140px)]">
            <div className="shrink-0">
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
                onConfirm={handleConfirmAction}
                onCancel={cancelAllSelections}
                validatePhoneNumber={validatePhoneNumber}
                onInitiateSwap={initiateSwap}
                onNavigateToTrip={handleNavigateToTrip}
                onOpenPayment={handleManualPaymentForEdit}
              />
            </div>

            {/* MANIFEST LIST */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col min-h-[300px] md:flex-1 overflow-hidden">
              <div className="px-3 py-2.5 bg-white border-b border-slate-100 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs">
                  <Users size={14} className="text-slate-400" />
                  <span>Danh sách khách ({tripBookings.length})</span>
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
                    placeholder="Tìm theo SĐT, tên, ghế..."
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

              {/* Manifest Summary Row */}
              <div className="px-3 py-2 bg-indigo-50/50 border-b border-indigo-100 flex justify-between items-center text-xs shadow-inner shrink-0">
                <div className="flex items-center gap-1.5 text-slate-500 font-bold uppercase tracking-tight">
                  <Calculator size={14} className="" />
                  <span>Tổng thực thu:</span>
                </div>
                <div className="font-black text-red-700 text-sm tracking-tight">
                  {totalManifestPrice.toLocaleString("vi-VN")}{" "}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-0 scrollbar-thin">
                {filteredManifest.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs italic">
                    Không có dữ liệu đặt vé
                  </div>
                ) : (
                  filteredManifest.map((booking, idx) => {
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

                    const tripItem = booking.items.find(
                      (i) => i.tripId === selectedTrip?.id
                    );
                    const seatsToShow = tripItem ? tripItem.seatIds : [];
                    const isHighlighted = booking.id === highlightedBookingId;
                    const tripSubtotal = tripItem ? tripItem.price || 0 : 0;

                    return (
                      <div
                        key={idx}
                        id={`booking-item-${booking.id}`}
                        onClick={() => handleSelectBookingFromHistory(booking)}
                        className={`px-3 py-2 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${
                          !isFullyPaid && booking.status !== "hold"
                            ? "bg-yellow-50/30"
                            : booking.status === "hold"
                            ? "bg-purple-50/30"
                            : ""
                        } ${
                          isHighlighted
                            ? "bg-indigo-50 ring-2 ring-indigo-500 z-10"
                            : ""
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1.5">
                          <span
                            className={`text-xs font-bold ${
                              isHighlighted
                                ? "text-indigo-600"
                                : "text-slate-800"
                            }`}
                          >
                            {booking.passenger.phone}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {timeStr}
                          </span>
                        </div>
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex gap-1 text-[11px] text-slate-600 font-medium flex-wrap">
                            {seatsToShow.map((s) => (
                              <span
                                key={s}
                                className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                          <div
                            className={`text-xs font-black whitespace-nowrap ${
                              booking.status === "payment"
                                ? "text-green-600"
                                : booking.status === "hold"
                                ? "text-purple-600"
                                : "text-amber-600"
                            }`}
                          >
                            {booking.status === "booking"
                              ? "Đã đặt vé"
                              : tripSubtotal.toLocaleString("vi-VN")}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FINANCE TAB */}
      {activeTab === "finance" && <PaymentManager />}

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
                              Hủy vé
                            </Badge>
                          )}
                          {booking.status === "payment" && (
                            <Badge
                              variant="success"
                              className="bg-green-100 text-green-700 border-green-200"
                            >
                              Mua vé
                            </Badge>
                          )}
                          {booking.status === "booking" && (
                            <Badge
                              variant="warning"
                              className="bg-yellow-100 text-yellow-700 border-yellow-200"
                            >
                              Đặt vé
                            </Badge>
                          )}
                          {booking.status === "hold" && (
                            <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                              Giữ vé
                            </Badge>
                          )}
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div
                            className={`font-bold ${
                              isFullyPaid ? "text-slate-900" : "text-yellow-600"
                            }`}
                          >
                            {booking.totalPrice.toLocaleString("vi-VN")} đ
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
        selectionBasket={selectionBasket}
        editingBooking={editingBooking}
        bookingForm={{
          pickup: bookingForm.pickup,
          dropoff: bookingForm.dropoff,
        }}
        paidCash={modalPaymentInput.paidCash}
        paidTransfer={modalPaymentInput.paidTransfer}
        onMoneyChange={handleModalMoneyChange}
        initialOverrides={modalInitialOverrides}
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
      <AlertDialog
        open={!!updateSummary}
        onOpenChange={(open) => !open && setUpdateSummary(null)}
      >
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
                  <div className="space-y-4 py-2 text-sm bg-slate-50 rounded-lg p-4 border border-slate-100">
                    {/* COMBINED DIFF LIST */}
                    {updateSummary.diffTrips.map((trip, idx) => (
                      <div key={idx} className="space-y-2">
                        <div className="text-xs font-bold text-slate-700 flex items-center gap-2 border-b border-slate-200 pb-1">
                          <MapPin size={12} className="text-blue-500" />{" "}
                          {trip.route}
                          <span className="font-normal text-slate-400">•</span>
                          <Calendar size={12} className="text-slate-400" />
                          <span className="font-normal text-slate-500">
                            {trip.date.toLocaleDateString("vi-VN")}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {trip.seats.map((s, sIdx) => {
                            let style =
                              "bg-slate-100 text-slate-600 border border-slate-200";
                            if (s.status === "added")
                              style =
                                "bg-green-100 text-green-700 border border-green-200 ring-1 ring-green-400 font-bold";
                            if (s.status === "removed")
                              style =
                                "bg-red-50 text-red-400 border border-red-100 line-through decoration-red-400 decoration-2";

                            return (
                              <span
                                key={sIdx}
                                className={`px-2 py-1 rounded text-[11px] ${style}`}
                              >
                                {s.label}
                              </span>
                            );
                          })}
                          {trip.seats.length === 0 && (
                            <span className="text-xs text-slate-400 italic">
                              Không có ghế
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {updateSummary && (
                  <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                    <span className="text-slate-500 text-xs">Tổng tiền:</span>
                    <div className="flex items-center gap-2 font-medium">
                      <span className="text-slate-400 line-through decoration-slate-300 text-xs">
                        {updateSummary.oldPrice.toLocaleString("vi-VN")}
                      </span>
                      <ArrowRightIcon size={14} className="text-slate-300" />
                      <span
                        className={
                          updateSummary.diffPrice > 0
                            ? "text-orange-600 font-bold"
                            : updateSummary.diffPrice < 0
                            ? "text-blue-600 font-bold"
                            : "text-slate-900 font-bold"
                        }
                      >
                        {updateSummary.newPrice.toLocaleString("vi-VN")} đ
                      </span>
                      {updateSummary.diffPrice !== 0 && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded ${
                            updateSummary.diffPrice > 0
                              ? "bg-orange-100 text-orange-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {updateSummary.diffPrice > 0 ? "+" : ""}
                          {updateSummary.diffPrice.toLocaleString("vi-VN")}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {updateSummary && updateSummary.newSeatCount === 0 && (
                  <div className="p-2 bg-red-50 text-red-600 rounded text-xs border border-red-100 flex items-center gap-2 justify-center">
                    <AlertCircle size={14} />
                    <span>
                      Đơn hàng sẽ chuyển sang trạng thái <strong>Hủy vé</strong>
                      .
                    </span>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setUpdateSummary(null)}>
              Quay lại
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={handleProceedUpdate}
            >
              Đồng ý lưu
            </Button>
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
