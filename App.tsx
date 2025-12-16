import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Layout } from "./components/Layout";
import { SeatMap } from "./components/SeatMap";
import { BookingForm } from "./components/BookingForm";
import { RightSheet } from "./components/RightSheet";
import { ScheduleView } from "./components/ScheduleView";
import { SettingsView } from "./components/SettingsView";
import { SeatDetailModal } from "./components/SeatDetailModal";
import { ToastProvider, useToast } from "./components/ui/Toast";
import { api } from "./lib/api";
import {
  BusTrip,
  Route,
  Bus,
  Booking,
  Seat,
  SeatStatus,
  UndoAction,
  Passenger,
} from "./types";
import { isSameDay } from "./utils/dateUtils";
import { BusFront } from "lucide-react";

const MainApp = () => {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("sales");
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  const [trips, setTrips] = useState<BusTrip[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [selectedDirection, setSelectedDirection] = useState<"outbound" | "inbound">("outbound");

  const [bookingMode, setBookingMode] = useState<"booking" | "payment" | "hold">("booking");
  const [bookingForm, setBookingForm] = useState({
    phone: "",
    pickup: "",
    dropoff: "",
    note: "",
    paidCash: 0,
    paidTransfer: 0,
  });
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [swapSourceSeat, setSwapSourceSeat] = useState<Seat | null>(null);
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  
  const [isSeatDetailModalOpen, setIsSeatDetailModalOpen] = useState(false);
  const [selectedSeatForDetail, setSelectedSeatForDetail] = useState<Seat | null>(null);
  const [selectedBookingForDetail, setSelectedBookingForDetail] = useState<Booking | null>(null);

  // Initial Data Load
  const loadData = useCallback(async () => {
    try {
      const [tripsData, routesData, busesData, bookingsData] = await Promise.all([
        api.trips.getAll(),
        api.routes.getAll(),
        api.buses.getAll(),
        api.bookings.getAll(),
      ]);
      setTrips(tripsData);
      setRoutes(routesData);
      setBuses(busesData);
      setBookings(bookingsData);
    } catch (e) {
      console.error("Failed to load data", e);
      toast({ type: "error", title: "Lỗi kết nối", message: "Không thể tải dữ liệu." });
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived State
  const tripsOnDate = useMemo(() => {
    return trips.filter((t) => {
      const tDate = new Date(t.departureTime.split(" ")[0]);
      return isSameDay(tDate, selectedDate);
    });
  }, [trips, selectedDate]);

  const availableTrips = useMemo(() => {
    return tripsOnDate.filter(t => !selectedDirection || t.direction === selectedDirection);
  }, [tripsOnDate, selectedDirection]);

  useEffect(() => {
    if (availableTrips.length > 0 && !availableTrips.find(t => t.id === selectedTripId)) {
        setSelectedTripId(availableTrips[0].id);
    } else if (availableTrips.length === 0) {
        setSelectedTripId(null);
    }
  }, [availableTrips, selectedTripId]);

  const selectedTrip = useMemo(() => 
    trips.find((t) => t.id === selectedTripId) || null, 
  [trips, selectedTripId]);

  const tripBookings = useMemo(() => {
    if (!selectedTrip) return [];
    return bookings.filter(b => 
      b.items.some(item => item.tripId === selectedTrip.id) && b.status !== 'cancelled'
    );
  }, [bookings, selectedTrip]);

  const selectionBasket = useMemo(() => {
      if (!selectedTrip) return [];
      const selectedSeats = selectedTrip.seats.filter(s => s.status === SeatStatus.SELECTED);
      if (selectedSeats.length === 0) return [];
      return [{ trip: selectedTrip, seats: selectedSeats }];
  }, [selectedTrip]);

  const totalPrice = useMemo(() => {
    return selectionBasket.reduce((acc, item) => {
      return acc + item.seats.reduce((sSum, s) => sSum + s.price, 0);
    }, 0);
  }, [selectionBasket]);

  // Handlers
  const handleSeatClick = async (clickedSeat: Seat) => {
    if (!selectedTrip) return;

    if (swapSourceSeat) {
        if (swapSourceSeat.id === clickedSeat.id) {
            setSwapSourceSeat(null);
            toast({ type: 'info', title: 'Hủy đổi', message: 'Đã hủy chế độ đổi chỗ' });
            return;
        }

        try {
            const result = await api.bookings.swapSeats(selectedTrip.id, swapSourceSeat.id, clickedSeat.id);
            setBookings(result.bookings);
            
            const updatedTripsMap = new Map<string, BusTrip>(
                result.trips.map((t: BusTrip) => [t.id, t])
            );
            setTrips((prev) => prev.map((t) => updatedTripsMap.get(t.id) || t));
            
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
            if (editingBooking) {
                setEditingBooking(null);
                setBookingForm({ ...bookingForm, phone: '', note: '' });
            }
        }
        return;
    }

    if (
      clickedSeat.status === SeatStatus.BOOKED ||
      clickedSeat.status === SeatStatus.SOLD
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
        setTrips((prevTrips) =>
          prevTrips.map((t) => (t.id === selectedTrip.id ? updatedTrip : t))
        );
        return;
      }

      if (booking) {
        setSelectedSeatForDetail(clickedSeat);
        setSelectedBookingForDetail(booking);
        setIsSeatDetailModalOpen(true);
      }
      return;
    }

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
    setTrips((prevTrips) =>
      prevTrips.map((t) => (t.id === selectedTrip.id ? updatedTrip : t))
    );
  };

  const handleSeatRightClick = (seat: Seat, booking: Booking) => {
      handleSelectBooking(booking);
  };

  const handleSelectBooking = (booking: Booking) => {
      setEditingBooking(booking);
      setBookingForm({
          phone: booking.passenger.phone,
          pickup: booking.passenger.pickupPoint || "",
          dropoff: booking.passenger.dropoffPoint || "",
          note: booking.passenger.note || "",
          paidCash: booking.payment?.paidCash || 0,
          paidTransfer: booking.payment?.paidTransfer || 0,
      });
      if (activeTab !== 'sales') setActiveTab('sales');
      
      if (booking.items.length > 0) {
          const item = booking.items[0];
          const tripDate = new Date(item.tripDate.split(" ")[0]);
          if (!isSameDay(tripDate, selectedDate)) {
              setSelectedDate(tripDate);
          }
          if (selectedTripId !== item.tripId) {
              setSelectedTripId(item.tripId);
          }
      }
  };

  const validatePhoneNumber = (phone: string) => {
    const regex = /^(0?)(3[2-9]|5[6|8|9]|7[0|6-9]|8[0-6|8|9]|9[0-4|6-9])[0-9]{7}$/;
    if (!phone) return "Vui lòng nhập số điện thoại";
    const clean = phone.replace(/\D/g, "");
    if (!regex.test(clean)) return "Số điện thoại không hợp lệ";
    return null;
  };

  const handleConfirmBooking = async () => {
      if (bookingMode !== 'hold') {
          const err = validatePhoneNumber(bookingForm.phone);
          if (err) {
              setPhoneError(err);
              return;
          }
      }

      const passenger: Passenger = {
          phone: bookingForm.phone,
          pickupPoint: bookingForm.pickup,
          dropoffPoint: bookingForm.dropoff,
          note: bookingForm.note,
          name: editingBooking?.passenger.name
      };

      const payment = {
          paidCash: bookingForm.paidCash,
          paidTransfer: bookingForm.paidTransfer
      };

      try {
          const itemsToBook = selectionBasket.map(item => ({
              tripId: item.trip.id,
              seats: item.seats
          }));

          if (editingBooking) {
              if (!selectedTrip) return;
              const finalSeatsForTrip = selectedTrip.seats.filter(s => 
                  s.status === SeatStatus.SELECTED || 
                  (s.status === SeatStatus.BOOKED && editingBooking.items.some(i => i.tripId === selectedTrip.id && i.seatIds.includes(s.id))) ||
                  (s.status === SeatStatus.SOLD && editingBooking.items.some(i => i.tripId === selectedTrip.id && i.seatIds.includes(s.id)))
              );

              const editItems = [{
                  tripId: selectedTrip.id,
                  seats: finalSeatsForTrip
              }];
              
              await api.bookings.update(editingBooking.id, editItems, passenger, payment);
              
              setUndoStack(prev => [...prev, {
                  type: 'UPDATED_BOOKING',
                  previousBooking: editingBooking,
                  phone: passenger.phone
              }]);
              
              toast({ type: "success", title: "Cập nhật thành công" });
          } else {
              const result = await api.bookings.create(itemsToBook, passenger, payment);
              
              setUndoStack(prev => [...prev, {
                  type: 'CREATED_BOOKING',
                  bookingId: result.bookings[0].id,
                  phone: passenger.phone,
                  seatCount: result.bookings[0].totalTickets,
                  seatLabels: itemsToBook.flatMap(i => i.seats.map(s => s.label)),
                  tripDate: itemsToBook[0]?.seats[0] ? selectedTrip?.departureTime || "" : "" 
              }]);

              toast({ type: "success", title: "Đặt vé thành công" });
          }
          loadData();
          handleCancelBooking();
      } catch (e) {
          console.error(e);
          toast({ type: "error", title: "Lỗi", message: "Không thể lưu đơn hàng" });
      }
  };

  const handleCancelBooking = () => {
      setEditingBooking(null);
      setBookingForm({
          phone: "",
          pickup: "",
          dropoff: "",
          note: "",
          paidCash: 0,
          paidTransfer: 0
      });
      setPhoneError(null);
      
      if (selectedTrip) {
          const updatedSeats = selectedTrip.seats.map(s => {
              if (s.status === SeatStatus.SELECTED) return { ...s, status: SeatStatus.AVAILABLE };
              return s;
          });
          setTrips(prev => prev.map(t => t.id === selectedTrip.id ? { ...selectedTrip, seats: updatedSeats } : t));
      }
  };

  const handleUpdatePassenger = async (passenger: Passenger) => {
      if (!selectedBookingForDetail) return;
      try {
          await api.bookings.updatePassenger(selectedBookingForDetail.id, passenger);
          toast({ type: "success", title: "Cập nhật hành khách thành công" });
          loadData();
          setIsSeatDetailModalOpen(false);
      } catch (e) {
          toast({ type: "error", title: "Lỗi", message: "Không thể cập nhật" });
      }
  };

  const handleUndo = async () => {
      const action = undoStack[undoStack.length - 1];
      if (!action) return;

      try {
          if (action.type === 'CREATED_BOOKING') {
              await api.bookings.delete(action.bookingId);
          } else if (action.type === 'UPDATED_BOOKING') {
              const b = action.previousBooking;
              const items = b.items.map(i => ({
                   tripId: i.tripId,
                   seats: i.seatIds.map(sid => ({ id: sid, price: i.price / i.seatIds.length } as any))
              }));
              await api.bookings.update(b.id, items as any, b.passenger, b.payment);
          } else if (action.type === 'SWAPPED_SEATS') {
              await api.bookings.swapSeats(action.tripId, action.seat2, action.seat1);
          }
          toast({ type: "info", title: "Đã hoàn tác" });
          setUndoStack(prev => prev.slice(0, -1));
          loadData();
      } catch (e) {
           toast({ type: "error", title: "Lỗi", message: "Hoàn tác thất bại" });
      }
  };

  return (
    <Layout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      selectedDate={selectedDate}
      onDateChange={setSelectedDate}
      availableTrips={availableTrips}
      selectedTripId={selectedTripId}
      onTripChange={setSelectedTripId}
      selectedDirection={selectedDirection}
      onDirectionChange={setSelectedDirection}
      routes={routes}
      headerRight={
         <RightSheet 
             bookings={bookings} 
             trips={trips} 
             onSelectBooking={handleSelectBooking}
             onUndo={undoStack.length > 0 ? handleUndo : undefined}
             lastUndoAction={undoStack[undoStack.length - 1]}
         />
      }
    >
      {activeTab === 'sales' && selectedTrip ? (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)]">
           <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <div className="flex items-center gap-2">
                      <div className="font-bold text-slate-800">{selectedTrip.licensePlate}</div>
                      <div className="text-xs text-slate-500">|</div>
                      <div className="text-sm text-slate-600">{selectedTrip.driver || 'Tài xế chưa cập nhật'}</div>
                  </div>
                  <div className="flex gap-2">
                       <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <div className="w-3 h-3 bg-white border border-slate-300 rounded-sm"></div> Trống
                       </div>
                       <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <div className="w-3 h-3 bg-yellow-100 border border-yellow-300 rounded-sm"></div> Đặt
                       </div>
                       <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <div className="w-3 h-3 bg-green-100 border border-green-300 rounded-sm"></div> TT
                       </div>
                       <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <div className="w-3 h-3 bg-primary border border-primary rounded-sm"></div> Chọn
                       </div>
                  </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 flex justify-center bg-slate-100/30">
                  <div className="w-full max-w-[600px]">
                      <SeatMap 
                          seats={selectedTrip.seats}
                          busType={selectedTrip.type as any}
                          onSeatClick={handleSeatClick}
                          bookings={tripBookings}
                          currentTripId={selectedTrip.id}
                          onSeatSwap={(seat) => {
                             setSwapSourceSeat(seat);
                             toast({ type: "info", title: "Chế độ đổi chỗ", message: `Đang chọn ghế để đổi cho ${seat.label}` });
                          }}
                          onSeatRightClick={handleSeatRightClick}
                          editingBooking={editingBooking}
                      />
                  </div>
              </div>
           </div>

           <div className="w-full lg:w-[320px] xl:w-[360px] flex flex-col shrink-0">
               <BookingForm 
                   bookingForm={bookingForm}
                   setBookingForm={setBookingForm}
                   bookingMode={bookingMode}
                   setBookingMode={setBookingMode}
                   selectionBasket={selectionBasket}
                   bookings={bookings}
                   routes={routes}
                   totalPrice={totalPrice}
                   phoneError={phoneError}
                   setPhoneError={setPhoneError}
                   editingBooking={editingBooking}
                   onConfirm={handleConfirmBooking}
                   onCancel={handleCancelBooking}
                   validatePhoneNumber={validatePhoneNumber}
                   onInitiateSwap={(seat) => {
                        setSwapSourceSeat(seat);
                        toast({ type: "info", title: "Chế độ đổi chỗ", message: `Đang chọn ghế để đổi cho ${seat.label}` });
                   }}
                   onNavigateToTrip={(date, tripId) => {
                      setSelectedDate(date);
                      setSelectedTripId(tripId);
                   }}
               />
           </div>
        </div>
      ) : activeTab === 'sales' ? (
         <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
               <BusFront size={40} className="opacity-20"/>
            </div>
            <p>Vui lòng chọn chuyến xe để tiếp tục</p>
         </div>
      ) : activeTab === 'schedule' ? (
          <ScheduleView 
              trips={trips}
              routes={routes}
              buses={buses}
              onAddTrip={async (date, data) => {
                  await api.trips.create(data as any);
                  loadData();
              }}
              onUpdateTrip={async (id, data) => {
                  await api.trips.update(id, data);
                  loadData();
              }}
              onDeleteTrip={async (id) => {
                  await api.trips.delete(id);
                  loadData();
              }}
              onUpdateBus={async (id, data) => {
                  await api.buses.update(id, data);
                  loadData();
              }}
          />
      ) : activeTab === 'settings' ? (
          <SettingsView 
              routes={routes}
              buses={buses}
              trips={trips}
              setRoutes={setRoutes}
              setBuses={setBuses}
              setTrips={setTrips}
              onDataChange={loadData}
          />
      ) : (
          <div>Chức năng đang phát triển</div>
      )}

      <SeatDetailModal 
          isOpen={isSeatDetailModalOpen}
          onClose={() => setIsSeatDetailModalOpen(false)}
          seat={selectedSeatForDetail}
          booking={selectedBookingForDetail}
          bookings={bookings}
          onSave={handleUpdatePassenger}
      />
    </Layout>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <MainApp />
    </ToastProvider>
  );
}