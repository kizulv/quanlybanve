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

  // Customer History Lookup
  const customerHistory = useMemo(() => {
    if (!bookingForm.phone || bookingForm.phone.length < 3) return [];
    const cleanPhone = bookingForm.phone.replace(/\D/g, "");
    
    return bookings
      .filter((b) => {
        const bPhone = b.passenger.phone.replace(/\D/g, "");
        return bPhone.includes(cleanPhone);
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [bookings, bookingForm.phone]);

  // Auto update payment when total changes (optional: keep cash synced if transfer is 0)
  useEffect(() => {
    if (bookingForm.paidTransfer === 0) {
      setBookingForm((prev) => ({ ...prev, paidCash: totalPrice }));
    }
  }, [totalPrice]);

  // Handlers
  const handleTripSelect = (tripId: string) => {
    setSelectedTripId(tripId);
    
    // Find trip and route to set defaults
    const trip = trips.find(t => t.id === tripId);
    let defaultPickup = "";
    let defaultDropoff = "";
    
    if (trip) {
        // Try finding route by ID
        let route = routes.find(r => r.id === trip.routeId);
        // Fallback by name
        if (!route) {
             route = routes.find(r => r.name === trip.route);
        }
        
        if (route) {
            // Swap based on direction
            if (trip.direction === 'inbound') {
                defaultPickup = route.destination || "";
                defaultDropoff = route.origin || "";
            } else {
                defaultPickup = route.origin || "";
                defaultDropoff = route.destination || "";
            }
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
    setBookingForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleMoneyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numValue = parseInt(value.replace(/\D/g, "") || "0", 10);
    setBookingForm((prev) => ({ ...prev, [name]: numValue }));
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
        {/* LEFT COLUMN: SEAT MAP (Flexible Width) */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
          {/* Trip Header Info */}
          <div className="px-4 h-12 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div className="flex inline-flex">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                {selectedTrip.name}
                <Badge
                  variant={
                    selectedTrip.type === BusType.CABIN ? "warning" : "default"
                  }
                >
                  {selectedTrip.type === BusType.CABIN
                    ? "Xe Phòng"
                    : "Xe Giường Đơn"}
                </Badge>
              </h2>
              <div className="flex items-center text-sm text-slate-500 gap-3 ml-2">
                <span className="flex items-center bg-white px-1.5 border rounded text-slate-600 font-bold">
                  <BusFront size={12} className="mr-1" />{" "}
                  {selectedTrip.licensePlate}
                </span>
                <span className="flex items-center">
                  <Clock size={12} className="mr-1" /> Xuất bến:{" "}
                  {selectedTrip.departureTime.split(" ")[1]}
                </span>
              </div>
            </div>
            <div className="flex gap-4 text-[10px] md:text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded border border-slate-300 bg-white"></div>{" "}
                Trống
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-primary"></div> Đang chọn
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-yellow-100 border border-yellow-400"></div>{" "}
                Đã đặt
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-slate-100 border border-slate-200"></div>{" "}
                Đã bán
              </div>
            </div>
          </div>

          {/* Scrollable Map */}
          <div className="flex-1 overflow-y-auto p-4 bg-slate-50/30">
            <SeatMap
              seats={selectedTrip.seats}
              busType={selectedTrip.type}
              onSeatClick={handleSeatClick}
              bookings={tripBookings}
            />
          </div>
        </div>

        {/* RIGHT COLUMN: BOOKING FORM & HISTORY (Clean, Flat Design) */}
        <div className="w-full md:w-[320px] xl:w-[360px] flex flex-col gap-2 shrink-0 h-full">
          
          {/* CARD 1: BOOKING FORM (Top) */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden shrink-0">
            <div className="p-2.5 bg-white border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <Ticket size={16} className="text-primary" />
                Thông tin đặt vé
              </div>
              <div className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                {selectedSeats.length} vé đang chọn
              </div>
            </div>

            <div className="p-3 space-y-3">
              {/* Selected Seats */}
              <div className="flex flex-wrap gap-1 min-h-[24px]">
                 {selectedSeats.length > 0 ? selectedSeats.map((s) => (
                    <Badge
                      key={s.id}
                      className="bg-blue-50 text-blue-700 border border-blue-100 font-mono text-xs py-0.5 px-1.5 rounded-md"
                    >
                      {s.label}
                    </Badge>
                  )) : (
                     <span className="text-xs text-slate-400 italic pl-1">Chưa chọn ghế nào...</span>
                  )}
              </div>

              <form id="booking-form" onSubmit={handleBookingSubmit} className="space-y-2.5">
                {/* Phone Input - Flat */}
                <div>
                  <div className="relative">
                    <input
                      type="tel"
                      name="phone"
                      value={bookingForm.phone}
                      onChange={handleInputChange}
                      className="w-full pl-8 pr-2 py-1.5 bg-slate-50 border border-transparent rounded-md text-sm font-bold text-slate-900 placeholder-slate-400 focus:bg-white focus:border-primary/30 focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                      placeholder="Số điện thoại khách..."
                      required
                      autoFocus
                    />
                    <Phone className="absolute left-2.5 top-2 text-slate-400" size={14} />
                  </div>
                </div>

                {/* Pickup / Dropoff - Grid, Flat */}
                <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                       <MapPin className="absolute left-2 top-2 text-green-600" size={12} />
                       <input
                        type="text"
                        name="pickup"
                        value={bookingForm.pickup}
                        onChange={handleInputChange}
                        className="w-full pl-6 pr-2 py-1.5 bg-slate-50 border border-transparent rounded-md text-xs font-medium focus:bg-white focus:border-green-500/30 focus:ring-2 focus:ring-green-500/10 outline-none transition-all"
                        placeholder="Điểm đón..."
                      />
                    </div>
                    <div className="relative">
                       <MapPin className="absolute left-2 top-2 text-red-500" size={12} />
                       <input
                        type="text"
                        name="dropoff"
                        value={bookingForm.dropoff}
                        onChange={handleInputChange}
                        className="w-full pl-6 pr-2 py-1.5 bg-slate-50 border border-transparent rounded-md text-xs font-medium focus:bg-white focus:border-red-500/30 focus:ring-2 focus:ring-red-500/10 outline-none transition-all"
                        placeholder="Điểm trả..."
                      />
                    </div>
                </div>

                {/* Note - Flat */}
                <div className="relative">
                   <MessageSquare className="absolute left-2.5 top-2 text-slate-400" size={14} />
                   <textarea
                    name="note"
                    value={bookingForm.note}
                    onChange={handleInputChange}
                    className="w-full pl-8 pr-2 py-1.5 bg-slate-50 border border-transparent rounded-md text-xs font-medium focus:bg-white focus:border-primary/30 focus:ring-2 focus:ring-primary/10 outline-none resize-none h-8 placeholder-slate-400 transition-all"
                    placeholder="Ghi chú..."
                  />
                </div>

                {/* Payment - Receipt Style (No heavy box) */}
                <div className="pt-2 border-t border-dashed border-slate-200">
                  <div className="flex justify-between items-baseline mb-2 px-1">
                    <span className="text-[11px] font-bold text-slate-500 uppercase">Tổng tiền</span>
                    <span className="text-base font-bold text-slate-900">
                      {totalPrice.toLocaleString("vi-VN")} <span className="text-[10px] font-normal text-slate-400">đ</span>
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <span className="absolute left-2 top-1.5 text-[10px] font-bold text-slate-400 uppercase">TM</span>
                      <input
                        placeholder="0"
                        type="text"
                        name="paidCash"
                        value={bookingForm.paidCash.toLocaleString("vi-VN")}
                        onChange={handleMoneyChange}
                        className="w-full pl-8 pr-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] font-bold text-right focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none text-slate-900 h-7"
                      />
                    </div>
                    <div className="relative">
                      <span className="absolute left-2 top-1.5 text-[10px] font-bold text-slate-400 uppercase">CK</span>
                      <input
                        placeholder="0"
                        type="text"
                        name="paidTransfer"
                        value={bookingForm.paidTransfer.toLocaleString("vi-VN")}
                        onChange={handleMoneyChange}
                        className="w-full pl-8 pr-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] font-bold text-right focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-slate-900 h-7"
                      />
                    </div>
                  </div>
                  
                   {/* Balance Text */}
                   <div className="mt-1 text-[10px] text-right px-1 h-4">
                    {(() => {
                        const paid = bookingForm.paidCash + bookingForm.paidTransfer;
                        const diff = totalPrice - paid;
                        if (totalPrice > 0) {
                            if (diff === 0) return <span className="text-green-600 font-bold">Đã thanh toán đủ</span>;
                            if (diff > 0) return <span className="text-red-500 font-medium">Thiếu: {diff.toLocaleString()}đ</span>;
                            if (diff < 0) return <span className="text-blue-600 font-medium">Thừa: {Math.abs(diff).toLocaleString()}đ</span>;
                        }
                        return null;
                    })()}
                   </div>
                </div>
              </form>
            </div>
            
            {/* Action Buttons */}
            <div className="p-2 bg-slate-50 border-t border-slate-200 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 bg-white border-slate-200 text-slate-600 hover:bg-slate-100 h-8 text-xs font-medium"
                  onClick={cancelSelection}
                  disabled={selectedSeats.length === 0}
                >
                  <RotateCcw size={13} className="mr-1.5" /> Hủy
                </Button>
                <Button
                  type="submit"
                  form="booking-form"
                  className="flex-[2] bg-primary hover:bg-primary/90 text-white font-bold h-8 text-xs shadow-sm"
                  disabled={selectedSeats.length === 0}
                >
                  <CheckCircle2 size={13} className="mr-1.5" /> Đặt vé
                </Button>
            </div>
          </div>

          {/* CARD 2: CUSTOMER HISTORY (Minimal) */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col flex-1 min-h-0 overflow-hidden">
             <div className="px-3 py-2 bg-white border-b border-slate-100 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs">
                   <History size={14} className="text-slate-400" /> 
                   <span>Lịch sử đặt vé</span>
                </div>
             </div>
             
             <div className="flex-1 overflow-y-auto p-0 scrollbar-thin scrollbar-thumb-slate-200">
                {bookingForm.phone.length < 3 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 p-4">
                        <User size={24} className="mb-2 opacity-20" />
                        <span className="text-[10px] text-center">Nhập SĐT để xem lịch sử</span>
                    </div>
                ) : customerHistory.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 p-4">
                        <Ticket size={24} className="mb-2 opacity-20" />
                        <span className="text-[10px] text-center">Khách chưa có vé cũ</span>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50">
                       {customerHistory.map(h => {
                           const hTrip = trips.find(t => t.id === h.busId);
                           const dateStr = hTrip ? hTrip.departureTime.split(' ')[0] : '';
                           const timeStr = hTrip ? hTrip.departureTime.split(' ')[1] : '';
                           const formattedDate = dateStr ? new Date(dateStr).toLocaleDateString('vi-VN') : '---';

                           return (
                             <div key={h.id} className="p-2.5 hover:bg-slate-50 transition-colors group">
                                <div className="flex justify-between items-start mb-0.5">
                                   <div className="flex items-center gap-1.5">
                                      <span className="font-mono text-[10px] font-bold bg-slate-100 text-slate-600 px-1 rounded">{h.seatId}</span>
                                      <span className="text-[11px] font-bold text-slate-700 truncate max-w-[120px]" title={hTrip?.route}>
                                         {hTrip?.route || "Chuyến cũ"}
                                      </span>
                                   </div>
                                   <span className={`text-[10px] font-bold ${h.status === 'confirmed' ? 'text-green-600' : 'text-slate-400'}`}>
                                      {h.totalPrice.toLocaleString()}đ
                                   </span>
                                </div>
                                <div className="flex justify-between items-center text-[10px] text-slate-400 group-hover:text-slate-500">
                                    <div className="flex items-center gap-1">
                                       <span>{formattedDate}</span>
                                       <span className="text-slate-300">•</span>
                                       <span>{timeStr}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                       <span className="truncate max-w-[80px]">{h.passenger.pickupPoint || ''}</span>
                                    </div>
                                </div>
                             </div>
                           )
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