import React, { useState, useMemo, useEffect } from "react";
import { Layout } from "./components/Layout";
import { SeatMap } from "./components/SeatMap";
import { SettingsView } from "./components/SettingsView";
import { ScheduleView } from "./components/ScheduleView";
import { Badge } from "./components/ui/Badge";
import { Button } from "./components/ui/Button";
import {
  BusTrip,
  Seat,
  SeatStatus,
  Passenger,
  Booking,
  Route,
  Bus,
  BusType,
} from "./types";
import {
  Filter,
  BusFront,
  Ticket,
  Clock,
  Loader2,
  Phone,
  MapPin,
  CheckCircle2,
  Banknote,
  CreditCard,
  RotateCcw,
  MessageSquare,
  ArrowRight,
  History,
  Calendar,
  User,
  MoreHorizontal,
  Users,
} from "lucide-react";
import { api } from "./lib/api";
import { isSameDay } from "./utils/dateUtils";

function App() {
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
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // -- LOCAL UI STATE --
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

  // Filter States
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedDirection, setSelectedDirection] = useState<
    "outbound" | "inbound"
  >("outbound");

  // Booking Form State - Name removed
  const [bookingForm, setBookingForm] = useState({
    phone: "",
    pickup: "",
    dropoff: "",
    paidCash: 0,
    paidTransfer: 0,
    note: "",
  });

  // Logic: Find all trips matching Date & Direction
  const availableTripsForDate = useMemo(() => {
    return trips.filter((trip) => {
      const tripDate = new Date(trip.departureTime.split(" ")[0]);
      const dateMatch = isSameDay(tripDate, selectedDate);
      const tripDir = trip.direction || "outbound";
      return dateMatch && tripDir === selectedDirection;
    });
  }, [trips, selectedDate, selectedDirection]);

  useEffect(() => {
    if (activeTab === "sales") {
      if (availableTripsForDate.length > 0) {
        if (
          !selectedTripId ||
          !availableTripsForDate.find((t) => t.id === selectedTripId)
        ) {
          setSelectedTripId(null);
        }
      } else {
        setSelectedTripId(null);
      }
    }
  }, [availableTripsForDate, activeTab]);

  const selectedTrip = trips.find((t) => t.id === selectedTripId) || null;
  const selectedSeats =
    selectedTrip?.seats.filter((s) => s.status === SeatStatus.SELECTED) || [];
  const totalPrice = selectedSeats.reduce((sum, s) => sum + s.price, 0);

  // Filter bookings for the selected trip to pass to SeatMap
  const tripBookings = useMemo(() => {
    if (!selectedTrip) return [];
    return bookings.filter(
      (b) => b.busId === selectedTrip.id && b.status !== "cancelled"
    );
  }, [bookings, selectedTrip]);

  // --- GROUPED HISTORY (MANIFEST) LOGIC ---
  // Group bookings by Phone Number for the current trip
  const groupedTripBookings = useMemo(() => {
    if (!selectedTrip) return [];

    const groups: Record<
      string,
      {
        phone: string;
        displayPhone: string;
        seats: string[];
        totalPrice: number;
        paidCash: number;
        paidTransfer: number;
        lastCreatedAt: string; // To show the latest booking time
        passengerName: string;
      }
    > = {};

    tripBookings.forEach((b) => {
      // Normalize phone key
      const rawPhone = b.passenger.phone || "";
      const cleanPhone = rawPhone.replace(/\D/g, "");
      
      // If no phone (rare), group by "unknown" or skip
      const key = cleanPhone || "unknown";

      if (!groups[key]) {
        groups[key] = {
          phone: cleanPhone,
          displayPhone: rawPhone,
          seats: [],
          totalPrice: 0,
          paidCash: 0,
          paidTransfer: 0,
          lastCreatedAt: b.createdAt,
          passengerName: b.passenger.name || "Khách lẻ"
        };
      }

      groups[key].seats.push(b.seatId);
      groups[key].totalPrice += b.totalPrice;
      groups[key].paidCash += b.payment?.paidCash || 0;
      groups[key].paidTransfer += b.payment?.paidTransfer || 0;
      
      // Keep track of the most recent activity for this phone
      if (new Date(b.createdAt) > new Date(groups[key].lastCreatedAt)) {
        groups[key].lastCreatedAt = b.createdAt;
      }
    });

    // Sort by most recent booking time
    return Object.values(groups).sort((a, b) => 
        new Date(b.lastCreatedAt).getTime() - new Date(a.lastCreatedAt).getTime()
    );
  }, [tripBookings, selectedTrip]);

  // Auto update payment when total changes (optional: keep cash synced if transfer is 0)
  useEffect(() => {
    if (bookingForm.paidTransfer === 0) {
      setBookingForm((prev) => ({ ...prev, paidCash: totalPrice }));
    } else {
      // If transfer is set, update cash to be the remainder
      setBookingForm((prev) => ({
        ...prev,
        paidCash: Math.max(0, totalPrice - prev.paidTransfer),
      }));
    }
  }, [totalPrice]);

  // --- Helper: Standardize Location Name ---
  const getStandardizedLocation = (input: string) => {
    if (!input) return "";
    const lower = input.toLowerCase().trim();

    // Dictionary mappings for common locations -> Bus Stations
    const mappings: Record<string, string> = {
      "lai chau": "BX Lai Châu",
      "lai châu": "BX Lai Châu",
      "ha tinh": "BX Hà Tĩnh",
      "hà tĩnh": "BX Hà Tĩnh",
      "ha noi": "BX Mỹ Đình",
      "hà nội": "BX Mỹ Đình",
      "my dinh": "BX Mỹ Đình",
      "mỹ đình": "BX Mỹ Đình",
      "giap bat": "BX Giáp Bát",
      "giáp bát": "BX Giáp Bát",
      "nuoc ngam": "BX Nước Ngầm",
      "nước ngầm": "BX Nước Ngầm",
      "sapa": "BX Sapa",
      "sa pa": "BX Sapa",
      "lao cai": "BX Lào Cai",
      "lào cai": "BX Lào Cai",
      "da nang": "BX Đà Nẵng",
      "đà nẵng": "BX Đà Nẵng",
      "vinh": "BX Vinh",
      "nghe an": "BX Vinh",
      "nghệ an": "BX Vinh",
      "thanh hoa": "BX Thanh Hóa",
      "thanh hóa": "BX Thanh Hóa",
      "dien bien": "BX Điện Biên",
      "điện biên": "BX Điện Biên",
      "son la": "BX Sơn La",
      "sơn la": "BX Sơn La",
      "yen bai": "BX Yên Bái",
      "yên bái": "BX Yên Bái",
    };

    return mappings[lower] || input;
  };

  // Handlers
  const handleTripSelect = (tripId: string) => {
    setSelectedTripId(tripId);

    // Find trip and route to set defaults
    const trip = trips.find((t) => t.id === tripId);
    let defaultPickup = "";
    let defaultDropoff = "";

    if (trip) {
      // Try finding route by ID
      let route = routes.find((r) => r.id === trip.routeId);
      // Fallback by name
      if (!route) {
        route = routes.find((r) => r.name === trip.route);
      }

      if (route) {
        let rawPickup = "";
        let rawDropoff = "";

        // Swap based on direction
        if (trip.direction === "inbound") {
          rawPickup = route.destination || "";
          rawDropoff = route.origin || "";
        } else {
          rawPickup = route.origin || "";
          rawDropoff = route.destination || "";
        }

        // Apply standardization immediately upon selection
        defaultPickup = getStandardizedLocation(rawPickup);
        defaultDropoff = getStandardizedLocation(rawDropoff);
      }
    }

    setBookingForm({
      phone: "",
      pickup: defaultPickup,
      dropoff: defaultDropoff,
      paidCash: 0,
      paidTransfer: 0,
      note: "",
    });
  };

  const handleSeatClick = async (clickedSeat: Seat) => {
    if (!selectedTrip) return;

    // Optimistic Update
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

    // Update Local State immediately
    const updatedTrip = { ...selectedTrip, seats: updatedSeats };
    setTrips(trips.map((t) => (t.id === selectedTrip.id ? updatedTrip : t)));

    // Persist
    try {
      await api.trips.updateSeats(selectedTrip.id, updatedSeats);
    } catch (e) {
      console.error("Failed to update seat status", e);
    }
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrip) return;
    if (selectedSeats.length === 0) {
      alert("Vui lòng chọn ít nhất 1 ghế.");
      return;
    }
    if (!bookingForm.phone) {
      alert("Vui lòng nhập số điện thoại.");
      return;
    }

    const passenger: Passenger = {
      name: "Khách lẻ", // Default name as input is removed
      phone: bookingForm.phone,
      note: bookingForm.note,
      pickupPoint: bookingForm.pickup,
      dropoffPoint: bookingForm.dropoff,
    };

    const payment = {
      paidCash: bookingForm.paidCash,
      paidTransfer: bookingForm.paidTransfer,
    };

    try {
      const result = await api.bookings.create(
        selectedTrip.id,
        selectedSeats,
        passenger,
        payment
      );

      setTrips(
        trips.map((t) => (t.id === selectedTrip.id ? result.updatedTrip : t))
      );
      setBookings([...bookings, ...result.bookings]);

      // Reset form but keep defaults
      handleTripSelect(selectedTrip.id);
      alert("Đặt vé thành công!");
    } catch (error) {
      alert("Đặt vé thất bại. Vui lòng thử lại.");
    }
  };

  const cancelSelection = async () => {
    if (!selectedTrip) return;
    const updatedSeats = selectedTrip.seats.map((seat) => {
      if (seat.status === SeatStatus.SELECTED) {
        return { ...seat, status: SeatStatus.AVAILABLE };
      }
      return seat;
    });

    // Update Local
    const updatedTrip = { ...selectedTrip, seats: updatedSeats };
    setTrips(trips.map((t) => (t.id === selectedTrip.id ? updatedTrip : t)));

    // Reset form to defaults
    handleTripSelect(selectedTrip.id);

    // Update DB
    await api.trips.updateSeats(selectedTrip.id, updatedSeats);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    // --- Phone Number Formatting Logic ---
    if (name === "phone") {
      const raw = value.replace(/\D/g, ""); // Keep only numbers
      if (raw.length > 15) return; // Basic length limit

      let formatted = raw;
      if (raw.length > 4) {
        formatted = `${raw.slice(0, 4)} ${raw.slice(4)}`;
      }
      if (raw.length > 7) {
        formatted = `${raw.slice(0, 4)} ${raw.slice(4, 7)} ${raw.slice(7)}`;
      }

      setBookingForm((prev) => ({ ...prev, [name]: formatted }));
      return;
    }

    // --- Auto-Capitalize Pickup & Dropoff ---
    if (name === "pickup" || name === "dropoff") {
      // Capitalize first letter of each word
      const formatted = value.replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());
      setBookingForm((prev) => ({ ...prev, [name]: formatted }));
      return;
    }

    setBookingForm((prev) => ({ ...prev, [name]: value }));
  };

  // --- Location Auto-Complete on Blur ---
  const handleLocationBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (!value) return;

    const standardized = getStandardizedLocation(value);

    // Only update if changed
    if (standardized !== value) {
      setBookingForm((prev) => ({ ...prev, [name]: standardized }));
    }
  };

  const handleMoneyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numValue = parseInt(value.replace(/\D/g, "") || "0", 10);

    setBookingForm((prev) => {
      // If total is 0, just update the field without balancing
      if (totalPrice === 0) {
        return { ...prev, [name]: numValue };
      }

      let newCash = prev.paidCash;
      let newTransfer = prev.paidTransfer;

      if (name === "paidCash") {
        newCash = numValue;
        // Auto balance transfer: Total - Cash
        newTransfer = Math.max(0, totalPrice - newCash);
      } else if (name === "paidTransfer") {
        newTransfer = numValue;
        // Auto balance cash: Total - Transfer
        newCash = Math.max(0, totalPrice - newTransfer);
      }

      return { ...prev, paidCash: newCash, paidTransfer: newTransfer };
    });
  };

  // --- SCHEDULE HANDLERS ---
  const handleAddTrip = async (date: Date, tripData: Partial<BusTrip>) => {
    try {
      const newTrip = { id: `TRIP-${Date.now()}`, ...tripData } as BusTrip;
      await api.trips.create(newTrip);
      await refreshData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateTrip = async (
    tripId: string,
    tripData: Partial<BusTrip>
  ) => {
    try {
      await api.trips.update(tripId, tripData);
      await refreshData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteTrip = async (tripId: string) => {
    try {
      await api.trips.delete(tripId);
      await refreshData();
      if (selectedTripId === tripId) setSelectedTripId(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateBus = async (busId: string, updates: Partial<Bus>) => {
    try {
      await api.buses.update(busId, updates);
      setBuses((prev) =>
        prev.map((b) => (b.id === busId ? { ...b, ...updates } : b))
      );
    } catch (e) {
      console.error(e);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-primary" size={48} />
          <p className="text-slate-500 font-medium">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  const renderTicketSales = () => {
    if (!selectedTrip) {
      return (
        <div className="h-[calc(100vh-140px)] flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 flex flex-col items-center justify-center text-slate-400 border-dashed max-w-lg text-center">
            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6 animate-in zoom-in duration-300">
              <BusFront size={48} className="opacity-20 text-slate-900" />
            </div>
            <h3 className="text-xl font-medium text-slate-700">
              Chưa chọn chuyến xe
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Vui lòng chọn <strong>Chiều đi/về</strong>, <strong>Ngày</strong>{" "}
              và <strong>Chuyến xe</strong> trên thanh công cụ phía trên để bắt
              đầu bán vé.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="h-[calc(100vh-140px)] flex flex-col md:flex-row gap-4 animate-in fade-in duration-300">
        {/* LEFT COLUMN: SEAT MAP (Dark Navy Header, Gentle Body) */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
          {/* Synchronized Header - Height 54px */}
          <div className="px-4 h-[54px] border-b border-indigo-900 flex justify-between items-center bg-indigo-950 shadow-sm z-10 shrink-0">
            {/* Left Side: Icon & Info */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-900 flex items-center justify-center text-yellow-400 shrink-0 border border-indigo-800">
                <BusFront size={16} />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-white tracking-tight leading-none">
                    {selectedTrip.name}
                  </h2>
                  <Badge
                    variant="warning"
                    className="bg-yellow-500 text-indigo-950 border-transparent hover:bg-yellow-400 text-[10px] px-1.5 h-4 font-bold"
                  >
                    {selectedTrip.type === BusType.CABIN
                      ? "Xe Phòng"
                      : "Giường Đơn"}
                  </Badge>
                </div>

                <div className="flex items-center text-[10px] text-white gap-2 mt-0.5">
                  <span className="font-bold">{selectedTrip.licensePlate}</span>
                  <span className="w-0.5 h-2 bg-indigo-800"></span>
                  <span className="flex items-center">
                    <Clock size={10} className="mr-1 opacity-70" />
                    {selectedTrip.departureTime.split(" ")[1]}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Side: Legend */}
            <div className="flex gap-4 text-[10px] font-medium text-indigo-200 hidden lg:flex">
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
            </div>

            {/* Legend Mobile (Compressed) */}
            <div className="lg:hidden flex items-center gap-2 text-[10px] text-indigo-200">
              <div
                className="w-2.5 h-2.5 rounded bg-primary border border-white"
                title="Đang chọn"
              ></div>
              <div
                className="w-2.5 h-2.5 rounded bg-yellow-400 border border-yellow-500"
                title="Đã đặt"
              ></div>
            </div>
          </div>

          {/* Scrollable Map - Gentle Background */}
          <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
            <SeatMap
              seats={selectedTrip.seats}
              busType={selectedTrip.type}
              onSeatClick={handleSeatClick}
              bookings={tripBookings}
            />
          </div>
        </div>

        {/* RIGHT COLUMN: BOOKING FORM & HISTORY */}
        <div className="w-full md:w-[320px] xl:w-[360px] flex flex-col gap-2 shrink-0 h-full">
          {/* CARD 1: BOOKING FORM */}
          <div className="bg-indigo-950 rounded-xl shadow-lg border border-indigo-900 flex flex-col overflow-hidden shrink-0">
            {/* Header Synchronized - Height 54px */}
            <div className="px-3 h-[54px] bg-indigo-950/50 border-b border-indigo-900 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Ticket size={16} className="text-yellow-400" />
                Thông tin đặt vé
              </div>
              <div className="text-[10px] font-bold text-indigo-950 bg-yellow-400 px-2 py-0.5 rounded-full">
                {selectedSeats.length} vé đang chọn
              </div>
            </div>

            <div className="p-3 space-y-3">
              {/* Selected Seats */}
              <div className="flex flex-wrap gap-1 min-h-[24px]">
                {selectedSeats.length > 0 ? (
                  selectedSeats.map((s) => (
                    <Badge
                      key={s.id}
                      className="bg-indigo-800 text-white border border-indigo-700 text-xs py-0.5 px-1.5 rounded-md"
                    >
                      {s.label}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-indigo-300 italic pl-1">
                    Chưa chọn ghế nào
                  </span>
                )}
              </div>

              <form
                id="booking-form"
                onSubmit={handleBookingSubmit}
                className="space-y-2.5"
              >
                {/* Phone Input */}
                <div>
                  <div className="relative">
                    <input
                      type="tel"
                      name="phone"
                      value={bookingForm.phone}
                      onChange={handleInputChange}
                      className="w-full pl-6 pr-2 py-1.5 bg-indigo-900/50 border border-transparent rounded-md text-xs text-white placeholder-indigo-300 focus:bg-indigo-900 focus:ring-1 focus:ring-yellow-400 outline-none transition-all"
                      placeholder="Số điện thoại"
                      required
                      autoFocus
                    />
                    <Phone
                      className="absolute left-2 top-2 text-indigo-300"
                      size={12}
                    />
                  </div>
                </div>

                {/* Pickup / Dropoff */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <MapPin
                      className="absolute left-2 top-2 text-indigo-300"
                      size={12}
                    />
                    <input
                      type="text"
                      name="pickup"
                      value={bookingForm.pickup}
                      onChange={handleInputChange}
                      onBlur={handleLocationBlur}
                      className="w-full pl-6 pr-2 py-1.5 bg-indigo-900/50 border border-transparent rounded-md text-xs text-white placeholder-indigo-300 focus:bg-indigo-900 focus:ring-1 focus:ring-green-400 outline-none transition-all"
                      placeholder="Điểm đón"
                    />
                  </div>
                  <div className="relative">
                    <MapPin
                      className="absolute left-2 top-2 text-indigo-300"
                      size={12}
                    />
                    <input
                      type="text"
                      name="dropoff"
                      value={bookingForm.dropoff}
                      onChange={handleInputChange}
                      onBlur={handleLocationBlur}
                      className="w-full pl-6 pr-2 py-1.5 bg-indigo-900/50 border border-transparent rounded-md text-xs text-white placeholder-indigo-300 focus:bg-indigo-900 focus:ring-1 focus:ring-red-400 outline-none transition-all"
                      placeholder="Điểm trả"
                    />
                  </div>
                </div>

                {/* Note */}
                <div className="relative">
                  <MessageSquare
                    className="absolute left-2 top-2 text-indigo-300"
                    size={12}
                  />
                  <textarea
                    name="note"
                    value={bookingForm.note}
                    onChange={handleInputChange}
                    className="w-full pl-6 pr-2 py-1.5 bg-indigo-900/50 border border-transparent rounded-md text-xs font-medium text-white placeholder-indigo-300 focus:bg-indigo-900 focus:ring-1 focus:ring-yellow-400 outline-none resize-none h-8 transition-all"
                    placeholder="Ghi chú..."
                  />
                </div>

                {/* Payment */}
                <div className="pt-2 border-t border-dashed border-indigo-800">
                  <div className="flex justify-between items-baseline mb-2 px-1">
                    <span className="text-[11px] font-bold text-indigo-300 uppercase">
                      Tổng tiền
                    </span>
                    <span className="text-base font-bold text-yellow-400">
                      {totalPrice.toLocaleString("vi-VN")}{" "}
                      <span className="text-[10px] font-normal text-indigo-300">
                        đ
                      </span>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <span className="absolute left-2 top-1.5 text-[10px] font-bold text-indigo-400 uppercase">
                        Tiền mặt
                      </span>
                      <input
                        placeholder="0"
                        type="text"
                        name="paidCash"
                        value={bookingForm.paidCash.toLocaleString("vi-VN")}
                        onChange={handleMoneyChange}
                        className="w-full pl-8 pr-2 py-1 bg-indigo-900/50 border border-transparent rounded text-[11px] font-bold text-right focus:ring-1 focus:ring-green-400 outline-none text-white h-7 placeholder-indigo-500"
                      />
                    </div>
                    <div className="relative">
                      <span className="absolute left-2 top-1.5 text-[10px] font-bold text-indigo-400 uppercase">
                        Tài khoản
                      </span>
                      <input
                        placeholder="0"
                        type="text"
                        name="paidTransfer"
                        value={bookingForm.paidTransfer.toLocaleString("vi-VN")}
                        onChange={handleMoneyChange}
                        className="w-full pl-8 pr-2 py-1 bg-indigo-900/50 border border-transparent rounded text-[11px] font-bold text-right focus:ring-1 focus:ring-blue-400 outline-none text-white h-7 placeholder-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Balance Text */}
                  <div className="mt-1 text-[10px] text-right px-1 h-4">
                    {(() => {
                      const paid =
                        bookingForm.paidCash + bookingForm.paidTransfer;
                      const diff = totalPrice - paid;
                      if (totalPrice > 0) {
                        if (diff === 0)
                          return (
                            <span className="text-green-400 font-bold">
                              Đã thanh toán đủ
                            </span>
                          );
                        if (diff > 0)
                          return (
                            <span className="text-red-400 font-medium">
                              Thiếu: {diff.toLocaleString()}đ
                            </span>
                          );
                        if (diff < 0)
                          return (
                            <span className="text-blue-300 font-medium">
                              Thừa: {Math.abs(diff).toLocaleString()}đ
                            </span>
                          );
                      }
                      return null;
                    })()}
                  </div>
                </div>
              </form>
            </div>

            {/* Action Buttons */}
            <div className="p-2 bg-indigo-950 border-t border-indigo-900 flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 bg-indigo-900/50 border-indigo-800 text-indigo-200 hover:bg-indigo-800 hover:text-white h-8 text-xs font-medium"
                onClick={cancelSelection}
                disabled={selectedSeats.length === 0}
              >
                <RotateCcw size={13} className="mr-1.5" /> Hủy
              </Button>
              <Button
                type="submit"
                form="booking-form"
                className="flex-[2] bg-yellow-500 hover:bg-yellow-400 text-indigo-950 font-bold h-8 text-xs shadow-sm border border-transparent"
                disabled={selectedSeats.length === 0}
              >
                <CheckCircle2 size={13} className="mr-1.5" /> Đặt vé
              </Button>
            </div>
          </div>

          {/* CARD 2: TRIP BOOKING HISTORY (MANIFEST) */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="px-3 py-2 bg-white border-b border-slate-100 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs">
                <Users size={14} className="text-slate-400" />
                <span>Lịch sử đặt vé ({groupedTripBookings.length})</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-0 scrollbar-thin scrollbar-thumb-slate-200">
              {groupedTripBookings.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 p-4">
                  <Ticket size={24} className="mb-2 opacity-20" />
                  <span className="text-[10px] text-center">
                    Chưa có vé nào được đặt
                  </span>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {groupedTripBookings.map((group, idx) => {
                    const timeStr = new Date(group.lastCreatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                    
                    // Format phone like 0868 868 304
                    const formatPhone = (phone: string) => {
                       if(phone.length >= 10) {
                         return `${phone.slice(0, 4)} ${phone.slice(4, 7)} ${phone.slice(7)}`;
                       }
                       return phone;
                    }

                    return (
                      <div
                        key={idx}
                        className="p-3 hover:bg-slate-50 transition-colors group"
                      >
                         {/* Row 1: Phone + Time */}
                         <div className="flex justify-between items-center mb-1">
                             <span className="text-sm font-bold text-blue-700">
                                 {formatPhone(group.phone)}
                             </span>
                             <span className="text-[10px] text-slate-400 flex items-center">
                                 <Clock size={10} className="mr-1"/> {timeStr}
                             </span>
                         </div>
                         
                         {/* Row 2: Ticket Count + Seat List */}
                         <div className="flex items-start gap-2 mb-1.5">
                             <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                                 {group.seats.length} vé
                             </span>
                             <div className="text-[11px] font-medium text-slate-700 break-words leading-tight">
                                 {group.seats.join(", ")}
                             </div>
                         </div>

                         {/* Row 3: Total Price */}
                         <div className="flex justify-between items-baseline mb-1">
                            <span className="text-[10px] text-slate-500">Tổng tiền:</span>
                            <span className="text-sm font-bold text-slate-900">
                                {group.totalPrice.toLocaleString('vi-VN')} đ
                            </span>
                         </div>
                         
                         {/* Row 4: Breakdown */}
                         <div className="flex justify-end gap-3 text-[10px]">
                            {group.paidCash > 0 && (
                                <span className="text-green-600 font-medium">
                                    TM: {group.paidCash.toLocaleString()}
                                </span>
                            )}
                            {group.paidTransfer > 0 && (
                                <span className="text-blue-600 font-medium">
                                    CK: {group.paidTransfer.toLocaleString()}
                                </span>
                            )}
                            {group.paidCash === 0 && group.paidTransfer === 0 && (
                                <span className="text-slate-400 italic">Chưa thanh toán</span>
                            )}
                         </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTickets = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-900">
            Danh sách vé gần đây
          </h2>
          <Button variant="outline" size="sm">
            <Filter size={16} className="mr-2" /> Bộ lọc
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Mã vé</th>
                <th className="px-6 py-4">Khách hàng</th>
                <th className="px-6 py-4">Hành trình</th>
                <th className="px-6 py-4">Ghế</th>
                <th className="px-6 py-4">Thanh toán</th>
                <th className="px-6 py-4">Ngày đặt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bookings.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Ticket size={32} className="opacity-20" />
                      <span>Chưa có dữ liệu đặt vé nào</span>
                    </div>
                  </td>
                </tr>
              ) : (
                bookings.map((booking) => {
                  const trip = trips.find((t) => t.id === booking.busId);
                  return (
                    <tr
                      key={booking.id}
                      className="hover:bg-slate-50 transition-colors group"
                    >
                      <td className="px-6 py-4 font-medium text-primary">
                        {booking.id}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">
                          {booking.passenger.name}
                        </div>
                        <div className="text-slate-500 text-xs">
                          {booking.passenger.phone}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div
                          className="text-slate-900 max-w-[200px] truncate"
                          title={trip?.route}
                        >
                          {trip?.route}
                        </div>
                        <div className="text-slate-500 text-xs flex items-center mt-0.5">
                          <Clock size={10} className="mr-1" />{" "}
                          {trip?.departureTime}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="default" className="font-base">
                          {booking.seatId}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">
                          {booking.totalPrice.toLocaleString("vi-VN")} đ
                        </div>
                        {booking.payment && (
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {booking.payment.paidCash > 0 &&
                              `TM: ${booking.payment.paidCash.toLocaleString()} `}
                            {booking.payment.paidTransfer > 0 &&
                              `CK: ${booking.payment.paidTransfer.toLocaleString()}`}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {new Date(booking.createdAt).toLocaleDateString(
                          "vi-VN"
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

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
    >
      {activeTab === "sales" && renderTicketSales()}
      {activeTab === "tickets" && renderTickets()}
      {activeTab === "schedule" && (
        <ScheduleView
          trips={trips}
          routes={routes}
          buses={buses}
          onAddTrip={handleAddTrip}
          onUpdateTrip={handleUpdateTrip}
          onDeleteTrip={handleDeleteTrip}
          onUpdateBus={handleUpdateBus}
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
    </Layout>
  );
}

export default App;