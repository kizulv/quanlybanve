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
  Search,
  X,
  Clock3,
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
  const [manifestSearch, setManifestSearch] = useState(""); // Search state for Manifest

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

  // History Search Suggestion State
  const [showHistory, setShowHistory] = useState(false);

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
      const key = `${pickup.toLowerCase().trim()}|${dropoff.toLowerCase().trim()}`;
      
      const existing = uniqueRoutes.get(key);
      const isNewer = existing ? new Date(b.createdAt) > new Date(existing.lastDate) : true;

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
          totalPrice: 0,
          paidCash: 0,
          paidTransfer: 0,
          lastCreatedAt: b.createdAt,
          passengerName: b.passenger.name || "Khách lẻ",
        };
      }

      groups[key].seats.push(b.seatId);
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
    if (bookingForm.paidTransfer === 0) {
      setBookingForm((prev) => ({ ...prev, paidCash: totalPrice }));
    } else {
      setBookingForm((prev) => ({
        ...prev,
        paidCash: Math.max(0, totalPrice - prev.paidTransfer),
      }));
    }
  }, [totalPrice]);

  // Reset search when trip changes
  useEffect(() => {
    setManifestSearch("");
  }, [selectedTripId]);

  // --- Helper: Standardize Location Name ---
  const getStandardizedLocation = (input: string) => {
    if (!input) return "";
    const lower = input.toLowerCase().trim();

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
      sapa: "BX Sapa",
      "sa pa": "BX Sapa",
      "lao cai": "BX Lào Cai",
      "lào cai": "BX Lào Cai",
      "da nang": "BX Đà Nẵng",
      "đà nẵng": "BX Đà Nẵng",
      vinh: "BX Vinh",
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

  const handleTripSelect = (tripId: string) => {
    setSelectedTripId(tripId);

    const trip = trips.find((t) => t.id === tripId);
    let defaultPickup = "";
    let defaultDropoff = "";

    if (trip) {
      let route = routes.find((r) => r.id === trip.routeId);
      if (!route) {
        route = routes.find((r) => r.name === trip.route);
      }

      if (route) {
        let rawPickup = "";
        let rawDropoff = "";

        if (trip.direction === "inbound") {
          rawPickup = route.destination || "";
          rawDropoff = route.origin || "";
        } else {
          rawPickup = route.origin || "";
          rawDropoff = route.destination || "";
        }

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
    setShowHistory(false);
  };

  const handleSeatClick = async (clickedSeat: Seat) => {
    if (!selectedTrip) return;

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

    const updatedTrip = { ...selectedTrip, seats: updatedSeats };
    setTrips(trips.map((t) => (t.id === selectedTrip.id ? updatedTrip : t)));

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
      name: "Khách lẻ",
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

    const updatedTrip = { ...selectedTrip, seats: updatedSeats };
    setTrips(trips.map((t) => (t.id === selectedTrip.id ? updatedTrip : t)));
    handleTripSelect(selectedTrip.id);
    await api.trips.updateSeats(selectedTrip.id, updatedSeats);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    if (name === "phone") {
      const formatted = formatPhoneNumber(value);
      setBookingForm((prev) => ({ ...prev, [name]: formatted }));
      // Trigger history dropdown
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

  const handleLocationBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (!value) return;
    const standardized = getStandardizedLocation(value);
    if (standardized !== value) {
      setBookingForm((prev) => ({ ...prev, [name]: standardized }));
    }
  };

  const handleMoneyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numValue = parseInt(value.replace(/\D/g, "") || "0", 10);

    setBookingForm((prev) => {
      if (totalPrice === 0) {
        return { ...prev, [name]: numValue };
      }

      let newCash = prev.paidCash;
      let newTransfer = prev.paidTransfer;

      if (name === "paidCash") {
        newCash = numValue;
        newTransfer = Math.max(0, totalPrice - newCash);
      } else if (name === "paidTransfer") {
        newTransfer = numValue;
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
    return (
      <div className="h-[calc(100vh-140px)] flex flex-col md:flex-row gap-4 animate-in fade-in duration-300">
        {/* LEFT COLUMN: SEAT MAP */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
          {/* Synchronized Header */}
          <div className="px-4 h-[54px] bg-gradient-to-r from-indigo-950 via-indigo-900 to-indigo-950 flex justify-between items-center shadow-sm z-10 shrink-0">
            {/* Left Side: Icon & Info */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-900 flex items-center justify-center text-yellow-400 shrink-0 border border-indigo-800">
                <BusFront size={16} />
              </div>

              {selectedTrip ? (
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
                    <span className="font-bold">
                      {selectedTrip.licensePlate}
                    </span>
                    <span className="w-0.5 h-2 bg-indigo-800"></span>
                    <span className="flex items-center">
                      <Clock size={10} className="mr-1 opacity-70" />
                      {selectedTrip.departureTime.split(" ")[1]}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-white text-sm font-medium">
                  Chưa chọn chuyến xe
                </div>
              )}
            </div>

            {/* Right Side: Legend */}
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
            </div>

            {/* Legend Mobile */}
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

          {/* Scrollable Map */}
          <div className="flex-1 overflow-y-auto">
            {selectedTrip ? (
              <SeatMap
                seats={selectedTrip.seats}
                busType={selectedTrip.type}
                onSeatClick={handleSeatClick}
                bookings={tripBookings}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-300">
                <BusFront size={48} className="mb-4 opacity-20" />
                <p className="text-sm font-medium">
                  Vui lòng chọn chuyến xe để xem sơ đồ ghế
                </p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: BOOKING FORM & HISTORY */}
        <div className="w-full md:w-[320px] xl:w-[360px] flex flex-col gap-2 shrink-0 h-full">
          {/* CARD 1: BOOKING FORM */}
          <div className="bg-indigo-950 rounded-xl shadow-lg border border-indigo-900 flex flex-col overflow-visible shrink-0 z-20">
            {/* Header */}
            <div className="px-3 h-[54px] bg-gradient-to-r from-indigo-950 via-indigo-900 to-indigo-950 border-b border-indigo-900 flex items-center justify-between shrink-0 rounded-t-xl">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Ticket size={16} className="text-yellow-400" />
                Thông tin đặt vé
              </div>
              <div className="text-[10px] font-bold text-indigo-950 bg-yellow-400 px-2 py-0.5 rounded-full">
                {selectedSeats.length} vé đang chọn
              </div>
            </div>

            <div className="p-3 space-y-3 relative">
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
                className={`space-y-2.5 ${
                  !selectedTrip ? "opacity-50 pointer-events-none" : ""
                }`}
              >
                {/* Phone Input with History Dropdown */}
                <div className="relative">
                  <div className="relative">
                    <input
                      type="tel"
                      name="phone"
                      value={bookingForm.phone}
                      onChange={handleInputChange}
                      onFocus={() => {
                        if (bookingForm.phone.length >= 3) setShowHistory(true);
                      }}
                      className="w-full pl-6 pr-2 py-1.5 bg-indigo-900/100 border border-transparent rounded-md text-xs text-white placeholder-indigo-300 focus:bg-indigo-900 focus:ring-1 focus:ring-yellow-400 outline-none transition-all disabled:cursor-not-allowed"
                      placeholder="Số điện thoại"
                      required
                      autoFocus
                      disabled={!selectedTrip}
                      autoComplete="off"
                    />
                    <Phone
                      className="absolute left-2 top-2 text-indigo-300"
                      size={12}
                    />
                  </div>

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
                      className="w-full pl-6 pr-2 py-1.5 bg-indigo-900/100 border border-transparent rounded-md text-xs text-white placeholder-indigo-300 focus:bg-indigo-900 focus:ring-1 focus:ring-green-400 outline-none transition-all disabled:cursor-not-allowed"
                      placeholder="Điểm đón"
                      disabled={!selectedTrip}
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
                      className="w-full pl-6 pr-2 py-1.5 bg-indigo-900/100 border border-transparent rounded-md text-xs text-white placeholder-indigo-300 focus:bg-indigo-900 focus:ring-1 focus:ring-red-400 outline-none transition-all disabled:cursor-not-allowed"
                      placeholder="Điểm trả"
                      disabled={!selectedTrip}
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
                    className="w-full pl-6 pr-2 py-1.5 bg-indigo-900/100 border border-transparent rounded-md text-xs font-medium text-white placeholder-indigo-300 focus:bg-indigo-900 focus:ring-1 focus:ring-yellow-400 outline-none resize-none h-8 transition-all disabled:cursor-not-allowed"
                    placeholder="Ghi chú..."
                    disabled={!selectedTrip}
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
                        className="w-full pl-8 pr-2 py-1 bg-indigo-900/100 border border-transparent rounded text-[11px] font-bold text-right focus:ring-1 focus:ring-green-400 outline-none text-white h-7 placeholder-indigo-500 disabled:cursor-not-allowed"
                        disabled={!selectedTrip}
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
                        className="w-full pl-8 pr-2 py-1 bg-indigo-900/100 border border-transparent rounded text-[11px] font-bold text-right focus:ring-1 focus:ring-blue-400 outline-none text-white h-7 placeholder-indigo-500 disabled:cursor-not-allowed"
                        disabled={!selectedTrip}
                      />
                    </div>
                  </div>
                </div>
              </form>
            </div>

            {/* Action Buttons */}
            <div className="p-2 bg-indigo-950 border-t border-indigo-900 flex gap-2 rounded-b-xl">
              <Button
                type="button"
                variant="outline"
                className="flex-1 bg-indigo-900/100 border-indigo-800 text-indigo-200 hover:bg-indigo-800 hover:text-white h-8 text-xs font-medium"
                onClick={cancelSelection}
                disabled={!selectedTrip || selectedSeats.length === 0}
              >
                <RotateCcw size={13} className="mr-1.5" /> Hủy
              </Button>
              <Button
                type="submit"
                form="booking-form"
                className="flex-[2] bg-yellow-500 hover:bg-yellow-400 text-indigo-950 font-bold h-8 text-xs shadow-sm border border-transparent"
                disabled={!selectedTrip || selectedSeats.length === 0}
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
                <span>Danh sách đặt vé ({groupedTripBookings.length})</span>
              </div>
            </div>

            {/* Search Bar */}
            <div className="p-2 border-b border-slate-100 bg-slate-50/50">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                  <Search size={14} className="text-slate-400" />
                </div>
                <input
                  type="text"
                  value={manifestSearch}
                  onChange={(e) => setManifestSearch(e.target.value)}
                  placeholder="Tìm SĐT hoặc số ghế..."
                  className="w-full pl-8 pr-7 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white placeholder-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
                  disabled={!selectedTrip}
                />
                {manifestSearch && (
                  <button
                    title="Tìm SĐT hoặc số ghế"
                    onClick={() => setManifestSearch("")}
                    className="absolute inset-y-0 right-0 pr-2 flex items-center cursor-pointer text-slate-400 hover:text-slate-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-0 scrollbar-thin scrollbar-thumb-slate-200">
              {filteredManifest.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 p-4">
                  {manifestSearch ? (
                    <>
                      <Search size={24} className="mb-2 opacity-20" />
                      <span className="text-[10px] text-center">
                        Không tìm thấy kết quả
                      </span>
                    </>
                  ) : (
                    <>
                      <Ticket size={24} className="mb-2 opacity-20" />
                      <span className="text-[10px] text-center">
                        {selectedTrip
                          ? "Chưa có vé nào được đặt"
                          : "Chưa chọn chuyến xe"}
                      </span>
                    </>
                  )}
                </div>
              ) : (
                <div>
                  {filteredManifest.map((group, idx) => {
                    const timeStr = new Date(
                      group.lastCreatedAt
                    ).toLocaleTimeString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });

                    // Format phone like 0868 868 304
                    const formatPhone = (phone: string) => {
                      if (phone.length >= 10) {
                        return `${phone.slice(0, 4)} ${phone.slice(
                          4,
                          7
                        )} ${phone.slice(7)}`;
                      }
                      return phone;
                    };

                    return (
                      <div
                        key={idx}
                        className="p-2 border-b border-slate-100 hover:bg-slate-50 transition-colors group"
                      >
                        {/* Row 1: Phone + Time */}
                        <div className="flex justify-between items-center mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-indigo-800">
                              {formatPhone(group.phone)}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {timeStr}
                          </span>
                        </div>

                        {/* Row 2: Ticket Count/Seat List + Total Price */}
                        <div className="flex justify-between items-start mb-0.5">
                          <div className="flex items-start gap-1.5 pr-1">
                            <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-1 rounded border border-slate-200 shrink-0 h-4 flex items-center">
                              {group.seats.length} Vé
                            </span>
                            <div className="flex items-center text-[11px] font-bold text-slate-800 break-words leading-tight">
                              {group.seats.join(", ")}
                            </div>
                          </div>

                          <div className="text-xs font-bold text-indigo-600 shrink-0 text-right">
                            {group.totalPrice.toLocaleString("vi-VN")}
                          </div>
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