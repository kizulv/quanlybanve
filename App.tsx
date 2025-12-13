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
  User,
  Phone,
  MapPin,
  DollarSign,
  CheckCircle2,
  Banknote,
  CreditCard,
  RotateCcw,
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

  // Booking Form State
  const [bookingForm, setBookingForm] = useState({
    name: "",
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

  // Auto update payment when total changes (optional: keep cash synced if transfer is 0)
  useEffect(() => {
    if (bookingForm.paidTransfer === 0) {
      setBookingForm((prev) => ({ ...prev, paidCash: totalPrice }));
    }
  }, [totalPrice]);

  // Handlers
  const handleTripSelect = (tripId: string) => {
    setSelectedTripId(tripId);
    setBookingForm({
      name: "",
      phone: "",
      pickup: "",
      dropoff: "",
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
    if (!bookingForm.phone || !bookingForm.name) {
      alert("Vui lòng nhập tên và số điện thoại.");
      return;
    }

    const passenger: Passenger = {
      name: bookingForm.name,
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

      // Reset form but keep trip selected
      setBookingForm({
        name: "",
        phone: "",
        pickup: "",
        dropoff: "",
        paidCash: 0,
        paidTransfer: 0,
        note: "",
      });
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
    setBookingForm({
      name: "",
      phone: "",
      pickup: "",
      dropoff: "",
      paidCash: 0,
      paidTransfer: 0,
      note: "",
    });

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

        {/* RIGHT COLUMN: BOOKING FORM (Fixed Width on Desktop) */}
        <div className="w-full md:w-[380px] xl:w-[420px] bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col shrink-0 h-full overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-slate-800 flex items-center gap-2">
            <Ticket size={18} className="text-primary" />
            Thông tin đặt vé
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Selected Seats Summary */}
            <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100">
              <div className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
                Ghế đang chọn
              </div>
              {selectedSeats.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedSeats.map((s) => (
                    <Badge
                      key={s.id}
                      className="bg-white text-primary border border-blue-200 shadow-sm text-sm py-1"
                    >
                      {s.label}
                    </Badge>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-400 italic">
                  Chưa chọn ghế nào
                </div>
              )}
            </div>

            <form
              id="booking-form"
              onSubmit={handleBookingSubmit}
              className="space-y-4"
            >
              {/* Customer Info */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Số điện thoại <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone
                      className="absolute left-3 top-2.5 text-slate-400"
                      size={16}
                    />
                    <input
                      type="tel"
                      name="phone"
                      value={bookingForm.phone}
                      onChange={handleInputChange}
                      className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none font-medium"
                      placeholder="Nhập SĐT khách..."
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tên khách hàng <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User
                      className="absolute left-3 top-2.5 text-slate-400"
                      size={16}
                    />
                    <input
                      type="text"
                      name="name"
                      value={bookingForm.name}
                      onChange={handleInputChange}
                      className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none font-medium"
                      placeholder="Nhập tên khách..."
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 my-2"></div>

              {/* Trip Info */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Điểm đón
                  </label>
                  <div className="relative">
                    <MapPin
                      className="absolute left-3 top-2.5 text-green-500"
                      size={16}
                    />
                    <input
                      type="text"
                      name="pickup"
                      value={bookingForm.pickup}
                      onChange={handleInputChange}
                      className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                      placeholder="VD: Bến xe Mỹ Đình"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Điểm trả
                  </label>
                  <div className="relative">
                    <MapPin
                      className="absolute left-3 top-2.5 text-red-500"
                      size={16}
                    />
                    <input
                      type="text"
                      name="dropoff"
                      value={bookingForm.dropoff}
                      onChange={handleInputChange}
                      className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                      placeholder="VD: Khách sạn Sapa..."
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 my-2"></div>

              {/* Payment Info */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-sm font-bold text-slate-600">
                    Tổng tiền vé
                  </span>
                  <span className="text-xl font-bold text-primary">
                    {totalPrice.toLocaleString("vi-VN")} đ
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                      Tiền mặt
                    </label>
                    <div className="relative">
                      <Banknote
                        className="absolute left-2.5 top-2 text-slate-400"
                        size={14}
                      />
                      <input
                        placeholder="0"
                        type="text"
                        name="paidCash"
                        value={bookingForm.paidCash.toLocaleString("vi-VN")}
                        onChange={handleMoneyChange}
                        className="w-full pl-8 pr-2 py-1.5 border border-slate-200 rounded text-sm font-bold text-right focus:ring-2 focus:ring-green-500/20 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                      Chuyển khoản
                    </label>
                    <div className="relative">
                      <CreditCard
                        className="absolute left-2.5 top-2 text-slate-400"
                        size={14}
                      />
                      <input
                        placeholder="0"
                        type="text"
                        name="paidTransfer"
                        value={bookingForm.paidTransfer.toLocaleString("vi-VN")}
                        onChange={handleMoneyChange}
                        className="w-full pl-8 pr-2 py-1.5 border border-slate-200 rounded text-sm font-bold text-right focus:ring-2 focus:ring-blue-500/20 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Payment Status Indicator */}
                {(() => {
                  const paid = bookingForm.paidCash + bookingForm.paidTransfer;
                  const diff = totalPrice - paid;
                  if (totalPrice > 0) {
                    if (diff === 0)
                      return (
                        <div className="text-xs text-green-600 font-bold text-right flex items-center justify-end">
                          <CheckCircle2 size={12} className="mr-1" /> Đã thanh
                          toán đủ
                        </div>
                      );
                    if (diff > 0)
                      return (
                        <div className="text-xs text-red-500 font-bold text-right">
                          Còn thiếu: {diff.toLocaleString("vi-VN")} đ
                        </div>
                      );
                    if (diff < 0)
                      return (
                        <div className="text-xs text-blue-500 font-bold text-right">
                          Thừa: {Math.abs(diff).toLocaleString("vi-VN")} đ
                        </div>
                      );
                  }
                  return null;
                })()}
              </div>

              {/* Note */}
              <div>
                <textarea
                  name="note"
                  value={bookingForm.note}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none resize-none h-16"
                  placeholder="Ghi chú thêm (nếu có)..."
                />
              </div>
            </form>
          </div>

          {/* Footer Actions */}
          <div className="p-4 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10 flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={cancelSelection}
              disabled={selectedSeats.length === 0}
            >
              <RotateCcw size={16} className="mr-2" /> Hủy
            </Button>
            <Button
              type="submit"
              form="booking-form"
              className="flex-[2] shadow-lg shadow-primary/20"
              disabled={selectedSeats.length === 0}
            >
              <CheckCircle2 size={18} className="mr-2" /> Đặt vé
            </Button>
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
                        <Badge variant="default" className="font-mono">
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
