import React, { useState, useMemo, useEffect } from "react";
import { Layout } from "./components/layout/Layout";
import { SeatMap } from "./components/booking/SeatMap";
import { SettingsView } from "./components/settings/SettingsView";
import { ScheduleView } from "./components/schedule/ScheduleView";
import { Schedule } from "./components/schedule/Schedule";
import { PaymentManager } from "./components/payment/PaymentManager";
import { OrderInformation } from "./components/booking/OrderInformation";
import { QRPaymentPage } from "./components/payment/QRPaymentPage";
import { ToastProvider, useToast } from "./components/ui/Toast";
import { RightSheet } from "./components/booking/RightSheet";
import { BookingForm } from "./components/booking/BookingForm";
import { SeatDetailModal } from "./components/booking/SeatDetailModal";
import { ManifestList } from "./components/booking/ManifestList";
import { AuthProvider, useAuth } from "./components/auth/AuthContext";
import { LoginView } from "./components/auth/LoginView";
import { UserManagement } from "./components/auth/UserManagement";
import { AccountSettings } from "./components/auth/AccountSettings";

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
import { BusFront, Loader2, ArrowRightLeft } from "lucide-react";
import { api } from "./lib/api";
import { isSameDay, formatDateForApi } from "./utils/dateUtils";
import { ORDER_DOMAIN } from "./constants";
import { PERMISSIONS } from "./lib/permissions";

import { generateSeatsFromLayout } from "./utils/seatUtils";

function AppContent() {
  const { toast } = useToast();
  const { isAuthenticated, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState("sales");

  // -- GLOBAL STATE (Fetched from API) --
  const [trips, setTrips] = useState<BusTrip[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);

  // -- UI STATE --
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [swapSource, setSwapSource] = useState<{
    seat: Seat;
    trip: BusTrip;
  } | null>(null);
  const [highlightedBookingId, setHighlightedBookingId] = useState<
    string | null
  >(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [seatDetailModal, setSeatDetailModal] = useState<{
    booking: Booking | null;
    seat: Seat;
  } | null>(null);

  // Filters
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedDirection, setSelectedDirection] = useState<
    "outbound" | "inbound"
  >("outbound");

  // -- DEEP LINKING & SUBDOMAIN ROUTING --
  useEffect(() => {
    const hostname = window.location.hostname;

    // Check if accessing via the specific order tracking domain
    if (hostname.includes(ORDER_DOMAIN)) {
      setActiveTab("order-info");
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get("bookingId")) {
      setActiveTab("order-info");
    }
  }, []);

  // -- DATA FETCHING --
  const refreshData = async () => {
    try {
      if (trips.length === 0) setIsLoading(true);
      const dateStr = formatDateForApi(selectedDate);
      const [tripsData, routesData, busesData, bookingsData] =
        await Promise.all([
          api.trips.getAll(),
          api.routes.getAll(),
          api.buses.getAll(),
          api.bookings.getAll(),
        ]);
      setRoutes(routesData);
      setBuses(busesData);
      setBookings(bookingsData);

      // Hydrate trips with seats from bus layout
      const hydratedTrips = tripsData.map((trip: BusTrip) => {
        const bus = busesData.find(
          (b: Bus) => b.id === trip.busId || b.plate === trip.licensePlate,
        );
        let seats =
          bus && bus.layoutConfig
            ? generateSeatsFromLayout(bus.layoutConfig, 0, bus.type)
            : [];

        // Nếu đang chỉnh sửa booking, restore trạng thái SELECTED cho các ghế đã có trong đơn hàng
        if (editingBooking) {
          const matchingItem = editingBooking.items.find(
            (i) => i.tripId === trip.id,
          );
          if (matchingItem) {
            seats = seats.map((s) => {
              if (
                matchingItem.seatIds.some((sid) => String(sid) === String(s.id))
              ) {
                return { ...s, status: SeatStatus.SELECTED };
              }
              return s;
            });
          }
        }

        return { ...trip, seats };
      });
      setTrips(hydratedTrips);
    } catch (error) {
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
  }, [selectedDate]);

  // -- CALCULATED STATE --
  const selectionBasket = useMemo(() => {
    const basket: { trip: BusTrip; seats: Seat[] }[] = [];
    trips.forEach((trip) => {
      const selected = (trip.seats || []).filter(
        (s) => s.status === SeatStatus.SELECTED,
      );
      if (selected.length > 0) {
        const route = routes.find(
          (r) => r.id === trip.routeId || r.name === trip.route,
        );
        basket.push({
          trip,
          seats: selected.map((s) => ({
            ...s,
            price: s.price > 0 ? s.price : route?.price || 0,
          })),
        });
      }
    });
    return basket;
  }, [trips, routes]);

  const availableTripsForDate = useMemo(() => {
    return trips.filter((trip) => {
      const tripDate = new Date(trip.departureTime.split(" ")[0]);
      return (
        isSameDay(tripDate, selectedDate) &&
        (trip.direction || "outbound") === selectedDirection
      );
    });
  }, [trips, selectedDate, selectedDirection]);

  const selectedTrip = trips.find((t) => t.id === selectedTripId) || null;
  const tripBookings = useMemo(() => {
    if (!selectedTrip) return [];
    return bookings.filter(
      (b) =>
        b &&
        b.items &&
        b.items.some((i) => i.tripId === selectedTrip.id) &&
        b.status !== "cancelled",
    );
  }, [bookings, selectedTrip]);

  // -- HELPERS --
  const getCorrectSeatStatus = (
    seatId: string,
    tripId: string,
    excludeBookingId?: string,
  ): SeatStatus => {
    const booking = bookings.find(
      (b) =>
        b.id !== excludeBookingId &&
        b.status !== "cancelled" &&
        b.items.some(
          (i) =>
            i.tripId === tripId &&
            i.seatIds.some((sid) => String(sid) === String(seatId)),
        ),
    );
    if (!booking) return SeatStatus.AVAILABLE;

    const tripItem = booking.items.find((i) => i.tripId === tripId);
    if (
      tripItem &&
      tripItem.seatIds.some((sid) => String(sid) === String(seatId))
    ) {
      // Ưu tiên trạng thái của từng vé nếu có
      const ticket = tripItem.tickets?.find(
        (t) => String(t.seatId) === String(seatId),
      );
      if (ticket?.status) {
        if (ticket.status === "payment") return SeatStatus.SOLD;
        if (ticket.status === "hold") return SeatStatus.HELD;
        return SeatStatus.BOOKED;
      }

      // Fallback về trạng thái của đơn hàng
      if (booking.status === "payment") return SeatStatus.SOLD;
      if (booking.status === "hold") return SeatStatus.HELD;
      return SeatStatus.BOOKED;
    }
    return SeatStatus.AVAILABLE; // Should not be reached if booking was found and seat is in tripItem
  };

  // -- HANDLERS --
  const handleSeatClick = async (clickedSeat: Seat) => {
    if (!selectedTrip) return;
    if (swapSource) {
      if (
        swapSource.seat.id === clickedSeat.id &&
        swapSource.trip.id === selectedTrip.id
      )
        return (setSwapSource(null), toast({ type: "info", title: "Hủy đổi" }));

      // Check if trying to swap between different vehicle types
      if (swapSource.trip.type !== selectedTrip.type) {
        return toast({
          type: "error",
          title: "Lỗi",
          message: "Không thể đổi chỗ giữa các loại xe khác nhau",
        });
      }

      try {
        const result = await api.bookings.swapSeats(
          swapSource.trip.id,
          swapSource.seat.id,
          selectedTrip.id,
          clickedSeat.id,
        );

        // Reload all data to ensure payment and booking info are updated
        await refreshData();

        setUndoStack((p) => [
          ...p,
          {
            type: "SWAPPED_SEATS",
            tripId: selectedTrip.id,
            tripId2: swapSource.trip.id,
            seat1: clickedSeat.id,
            seat2: swapSource.seat.id,
            label1: clickedSeat.label,
            label2: swapSource.seat.label,
            tripDate: selectedTrip.departureTime,
          },
        ]);
        toast({ type: "success", title: "Đổi chỗ thành công" });
      } catch (e) {
        toast({ type: "error", title: "Lỗi", message: "Đổi chỗ thất bại." });
      } finally {
        setSwapSource(null);
        if (editingBooking) setEditingBooking(null);
      }
      return;
    }

    if (
      clickedSeat.status &&
      [SeatStatus.BOOKED, SeatStatus.SOLD, SeatStatus.HELD].includes(
        clickedSeat.status,
      )
    ) {
      const booking = tripBookings.find((b) =>
        b.items.some(
          (i) =>
            i.tripId === selectedTrip.id &&
            i.seatIds.some((sid) => String(sid) === String(clickedSeat.id)),
        ),
      );
      if (editingBooking && booking?.id === editingBooking.id) {
        // Toggling off a seat from the current editing booking
        setTrips((prev) =>
          prev.map((t) =>
            t.id === selectedTrip.id
              ? {
                  ...t,
                  seats: (t.seats || []).map((s) =>
                    s.id === clickedSeat.id
                      ? { ...s, status: SeatStatus.AVAILABLE }
                      : s,
                  ),
                }
              : t,
          ),
        );
      } else if (booking) setHighlightedBookingId(booking.id);
      return;
    }

    setTrips((prev) =>
      prev.map((t) =>
        t.id === selectedTrip.id
          ? {
              ...t,
              seats: (t.seats || []).map((s) =>
                s.id === clickedSeat.id
                  ? {
                      ...s,
                      status:
                        s.status === SeatStatus.SELECTED
                          ? s.originalStatus || SeatStatus.AVAILABLE
                          : SeatStatus.SELECTED,
                      originalStatus:
                        s.status === SeatStatus.HELD
                          ? SeatStatus.HELD
                          : undefined,
                    }
                  : s,
              ),
            }
          : t,
      ),
    );
  };

  const handleSelectBookingFromHistory = (booking: Booking) => {
    setEditingBooking(booking);
    setHighlightedBookingId(null);
    setTrips((prevTrips) =>
      prevTrips.map((trip) => {
        const matchingItemInBooking = booking.items.find(
          (i) => i.tripId === trip.id,
        );

        return {
          ...trip,
          ...trip,
          seats: (trip.seats || []).map((seat) => {
            // Nếu ghế thuộc đơn hàng mới chọn, đặt thành SELECTED
            if (
              matchingItemInBooking?.seatIds.some(
                (sid) => String(sid) === String(seat.id),
              )
            ) {
              return { ...seat, status: SeatStatus.SELECTED };
            }

            // Nếu ghế đang ở trạng thái SELECTED (của đơn hàng cũ đang sửa dở),
            // khôi phục trạng thái thực tế của nó thay vì đưa về Available
            if (seat.status === SeatStatus.SELECTED) {
              return {
                ...seat,
                status: getCorrectSeatStatus(
                  seat.id,
                  trip.id,
                  editingBooking?.id || "",
                ),
              };
            }

            return seat;
          }),
        };
      }),
    );
  };

  const handleUndo = async () => {
    if (undoStack.length === 0) return;
    const action = undoStack[undoStack.length - 1];
    try {
      if (action.type === "CREATED_BOOKING") {
        const del = await api.bookings.delete(action.bookingId);
        setBookings(del.bookings);
        const utMap = new Map<string, BusTrip>(
          del.trips.map((t: BusTrip) => [t.id, t]),
        );
        setTrips((prev) => prev.map((t) => utMap.get(t.id) || t));
      } else if (action.type === "SWAPPED_SEATS") {
        const swapRes = await api.bookings.swapSeats(
          action.tripId, // trip for seat1
          action.seat1,
          action.tripId2 || action.tripId, // trip for seat2 (fallback for old stack)
          action.seat2,
        );
        setBookings(swapRes.bookings);
        const utMap = new Map<string, BusTrip>(
          swapRes.trips.map((t: BusTrip) => [t.id, t]),
        );
        setTrips((prev) => prev.map((t) => utMap.get(t.id) || t));
      }
      setUndoStack((prev) => prev.slice(0, -1));
      toast({ type: "info", title: "Đã hoàn tác" });
    } catch (e) {
      toast({ type: "error", title: "Lỗi", message: "Hoàn tác thất bại." });
    }
  };

  const cancelAllSelections = (
    suppressToast: boolean = false,
    forceClear: boolean = false,
  ) => {
    // Nếu không phải forceClear và đang có đơn hàng đang sửa, thực hiện logic hồi phục trạng thái ghế
    if (!forceClear && editingBooking) {
      const savedBooking = editingBooking;
      setEditingBooking(null);
      setTrips((prevTrips) =>
        prevTrips.map((trip) => {
          const bookingItem = savedBooking.items.find(
            (i) => i.tripId === trip.id,
          );
          const bookingSeatIds = bookingItem ? bookingItem.seatIds : [];

          return {
            ...trip,
            seats: (trip.seats || []).map((seat) => {
              // 1. Restore seats that were originally part of the booking
              if (
                bookingSeatIds.some((sid) => String(sid) === String(seat.id))
              ) {
                // Tìm ticket tương ứng với ghế này để lấy trạng thái chính xác
                const ticket = bookingItem?.tickets?.find(
                  (t) => String(t.seatId) === String(seat.id),
                );

                let status = SeatStatus.BOOKED;

                if (ticket?.status) {
                  // Ưu tiên dùng ticket.status (trạng thái riêng của từng ghế)
                  if (ticket.status === "payment") status = SeatStatus.SOLD;
                  else if (ticket.status === "hold") status = SeatStatus.HELD;
                  else status = SeatStatus.BOOKED;
                } else {
                  // Fallback về booking.status nếu không có ticket (dữ liệu cũ)
                  if (savedBooking.status === "payment")
                    status = SeatStatus.SOLD;
                  else if (savedBooking.status === "hold")
                    status = SeatStatus.HELD;
                }

                return { ...seat, status };
              }

              // 2. Revert newly selected seats to their underlying status
              if (seat.status === SeatStatus.SELECTED) {
                return {
                  ...seat,
                  status: getCorrectSeatStatus(
                    seat.id,
                    trip.id,
                    savedBooking.id,
                  ),
                };
              }
              return seat;
            }),
          };
        }),
      );
      return;
    }

    setTrips((prev) =>
      prev.map((t) => ({
        ...t,
        seats: (t.seats || []).map((s) =>
          s.status === SeatStatus.SELECTED
            ? { ...s, status: s.originalStatus || SeatStatus.AVAILABLE }
            : s,
        ),
      })),
    );
    if (!suppressToast) {
      toast({ type: "info", title: "Đã hủy chọn" });
    }
  };

  if (isLoading && trips.length === 0)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );

  // Render OrderInformation as a standalone page without Sidebar and Header
  if (activeTab === "order-info") {
    return <OrderInformation onBackToDashboard={() => setActiveTab("sales")} />;
  }

  // Require login for all pages except order-info
  if (!isAuthenticated) {
    return <LoginView onLoginSuccess={() => setActiveTab("sales")} />;
  }

  // Render QRPaymentPage as a standalone page without Sidebar and Header
  if (activeTab === "qr-payment") {
    return <QRPaymentPage />;
  }

  return (
    <Layout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      selectedDate={selectedDate}
      onDateChange={setSelectedDate}
      availableTrips={availableTripsForDate}
      selectedTripId={selectedTripId}
      onTripChange={setSelectedTripId}
      selectedDirection={selectedDirection}
      onDirectionChange={setSelectedDirection}
      routes={routes}
      headerRight={
        <RightSheet
          bookings={bookings}
          trips={trips}
          buses={buses}
          onSelectBooking={handleSelectBookingFromHistory}
          onUndo={handleUndo}
          lastUndoAction={undoStack[undoStack.length - 1]}
        />
      }
    >
      {activeTab === "sales" && hasPermission(PERMISSIONS.VIEW_SALES) && (
        <div className="flex flex-col md:flex-row gap-4 animate-in fade-in duration-300">
          <div
            className={`flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden shrink-0 md:flex-1 md:h-[calc(100vh-140px)] ${
              swapSource ? "ring-2 ring-indigo-500" : ""
            }`}
          >
            <div
              className={`px-4 h-10 border-b flex items-center justify-between shrink-0 rounded-t-xl ${
                swapSource
                  ? "bg-indigo-600"
                  : "bg-linear-to-r from-indigo-950 via-indigo-900 to-indigo-950"
              }`}
            >
              <div className="flex items-center gap-3 text-white text-xs font-bold">
                {swapSource ? (
                  <ArrowRightLeft size={16} className="animate-pulse" />
                ) : (
                  <BusFront size={16} />
                )}
                {selectedTrip
                  ? swapSource
                    ? `Đang đổi: ${swapSource.seat.label} (${swapSource.trip.route})`
                    : `${selectedTrip.name} - ${selectedTrip.licensePlate}`
                  : "Chọn chuyến xe"}
              </div>
              {swapSource && (
                <button
                  onClick={() => setSwapSource(null)}
                  className="text-white text-xs bg-white/20 px-2 py-1 rounded"
                >
                  Hủy
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              {selectedTrip ? (
                <SeatMap
                  seats={selectedTrip.seats}
                  bus={buses.find((b) => b.plate === selectedTrip.licensePlate)}
                  busType={selectedTrip.type}
                  onSeatClick={handleSeatClick}
                  bookings={tripBookings}
                  currentTripId={selectedTrip.id}
                  onSeatSwap={(seat) => {
                    if (selectedTrip)
                      setSwapSource({ seat, trip: selectedTrip });
                  }}
                  editingBooking={editingBooking}
                  onSeatRightClick={(s, b) =>
                    setSeatDetailModal({ booking: b, seat: s })
                  }
                  swapSourceSeatId={
                    swapSource?.trip.id === selectedTrip.id
                      ? swapSource?.seat.id
                      : undefined
                  }
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 p-8 text-center">
                  <BusFront size={48} className="opacity-20 mb-4" />
                  <p className="text-sm font-medium">Vui lòng chọn chuyến xe</p>
                </div>
              )}
            </div>
          </div>

          <div className="w-full md:w-[320px] xl:w-90 flex flex-col gap-4 shrink-0 md:h-[calc(100vh-140px)]">
            <BookingForm
              trips={trips}
              routes={routes}
              buses={buses}
              bookings={bookings}
              selectionBasket={selectionBasket}
              editingBooking={editingBooking}
              setTrips={setTrips}
              setBookings={setBookings}
              setUndoStack={setUndoStack}
              setEditingBooking={setEditingBooking}
              onCancelSelection={cancelAllSelections}
              onInitiateSwap={(seat) => {
                if (selectedTrip) setSwapSource({ seat, trip: selectedTrip });
              }}
              onNavigateToTrip={(d, id) => {
                setSelectedDate(d);
                setSelectedTripId(id);
              }}
              onRefreshData={refreshData}
            />
            <ManifestList
              tripBookings={tripBookings}
              selectedTrip={selectedTrip}
              highlightedBookingId={highlightedBookingId}
              onSelectBooking={handleSelectBookingFromHistory}
              buses={buses}
            />
          </div>
        </div>
      )}
      {activeTab === "finance" && hasPermission(PERMISSIONS.VIEW_FINANCE) && (
        <PaymentManager />
      )}
      {activeTab === "schedule" && hasPermission(PERMISSIONS.VIEW_SCHEDULE) && (
        <ScheduleView
          trips={trips}
          routes={routes}
          buses={buses}
          onAddTrip={async (d, t) => {
            await api.trips.create(t as any);
            refreshData();
          }}
          onUpdateTrip={async (id, t) => {
            await api.trips.update(id, t);
            refreshData();
          }}
          onDeleteTrip={async (id) => {
            await api.trips.delete(id);
            refreshData();
          }}
          onUpdateBus={async (id, u) => {
            await api.buses.update(id, u);
            refreshData();
          }}
        />
      )}
      {activeTab === "schedule-new" &&
        hasPermission(PERMISSIONS.VIEW_SCHEDULE) && (
          <Schedule
            trips={trips}
            routes={routes}
            buses={buses}
            onAddTrip={async (d, t) => {
              await api.trips.create(t as any);
              refreshData();
            }}
            onUpdateTrip={async (id, t) => {
              await api.trips.update(id, t);
              refreshData();
            }}
            onDeleteTrip={async (id) => {
              await api.trips.delete(id);
              refreshData();
            }}
            onUpdateBus={async (id, u) => {
              await api.buses.update(id, u);
              refreshData();
            }}
          />
        )}

      {activeTab === "settings" &&
        hasPermission(PERMISSIONS.MANAGE_SETTINGS) && (
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
      {activeTab === "users" && hasPermission(PERMISSIONS.MANAGE_USERS) && (
        <UserManagement />
      )}
      {activeTab === "account" && isAuthenticated && <AccountSettings />}

      <SeatDetailModal
        isOpen={!!seatDetailModal}
        onClose={() => setSeatDetailModal(null)}
        booking={seatDetailModal?.booking || null}
        seat={seatDetailModal?.seat || null}
        bookings={bookings}
        onSave={async (p, extra) => {
          if (!seatDetailModal) return;
          const { booking, seat } = seatDetailModal;
          if (booking) {
            const res = await api.bookings.updateTicket(booking.id, seat.id, {
              pickup: p.pickupPoint,
              dropoff: p.dropoffPoint,
              note: p.note,
              phone: p.phone,
              name: p.name,
              exactBed: p.exactBed, // ✅ Truyền exactBed
              action: extra?.action,
              payment: extra?.payment,
            });

            // Refresh all data to ensure consistency after any changes
            // Especially important for REFUND which may delete tickets or cancel bookings
            if (extra?.action === "REFUND" || extra?.action === "PAY") {
              await refreshData();
            } else {
              // For simple updates, just update local state
              setBookings((prev) =>
                prev.map((b) => (b.id === booking.id ? res.booking || b : b)),
              );
            }
          } else {
            // Xử lý hủy giữ chỗ thủ công (không có booking)
            const newStatus =
              extra?.action === "REFUND" && seat.status === SeatStatus.HELD
                ? SeatStatus.AVAILABLE
                : seat.status;
            const updatedSeats = (selectedTrip!.seats || []).map((s) =>
              s.id === seat.id ? { ...s, note: p.note, status: newStatus } : s,
            );
            await api.trips.updateSeats(selectedTrip!.id, updatedSeats);
            setTrips((prev) =>
              prev.map((t) =>
                t.id === selectedTrip!.id ? { ...t, seats: updatedSeats } : t,
              ),
            );
          }
          setSeatDetailModal(null);
          toast({
            type: "success",
            title:
              extra?.action === "REFUND"
                ? "Đã hủy vé thành công"
                : "Cập nhật thành công",
          });
        }}
      />
    </Layout>
  );
}

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ToastProvider>
  );
}
export default App;
