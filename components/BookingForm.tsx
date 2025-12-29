
import React, { useState, useMemo, useEffect } from "react";
import {
  Seat,
  Booking,
  BusTrip,
  Route,
  UndoAction,
  Passenger,
  SeatStatus,
  Bus,
} from "../types";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { formatLunarDate } from "../utils/dateUtils";
import {
  formatPhoneNumber,
  validatePhoneNumber,
  getStandardizedLocation,
  formatCurrency,
  parseCurrency,
} from "../utils/formatters";
import { api } from "../lib/api";
import { useToast } from "./ui/Toast";
import { PaymentModal } from "./PaymentModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/AlertDialog";
import {
  Ticket,
  RotateCcw,
  Zap,
  Banknote,
  Lock,
  Phone,
  History,
  X,
  Clock,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Save,
  AlertTriangle,
  MapPin,
  Locate,
  Notebook,
  ArrowRightLeft,
  CreditCard,
  FileEdit,
  ArrowRight as ArrowRightIcon,
  Calendar,
} from "lucide-react";

interface SeatOverride {
  price?: number;
  pickup?: string;
  dropoff?: string;
}

interface DiffSeat {
  label: string;
  status: "kept" | "added" | "removed";
}

interface TripDiffItem {
  route: string;
  date: Date;
  seats: DiffSeat[];
}

interface BookingFormProps {
  trips: BusTrip[];
  routes: Route[];
  buses: Bus[];
  bookings: Booking[];
  selectionBasket: { trip: BusTrip; seats: Seat[] }[];
  editingBooking: Booking | null;
  setTrips: React.Dispatch<React.SetStateAction<BusTrip[]>>;
  setBookings: React.Dispatch<React.SetStateAction<Booking[]>>;
  setUndoStack: React.Dispatch<React.SetStateAction<UndoAction[]>>;
  setEditingBooking: (booking: Booking | null) => void;
  onCancelSelection: () => void;
  onInitiateSwap?: (seat: Seat) => void;
  onNavigateToTrip?: (date: Date, tripId: string) => void;
}

export const BookingForm: React.FC<BookingFormProps> = ({
  trips,
  routes,
  buses,
  bookings,
  selectionBasket,
  editingBooking,
  setTrips,
  setBookings,
  setUndoStack,
  setEditingBooking,
  onCancelSelection,
  onInitiateSwap,
  onNavigateToTrip,
}) => {
  const { toast } = useToast();

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
  const [showHistory, setShowHistory] = useState(false);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [modalPaymentInput, setModalPaymentInput] = useState({
    paidCash: 0,
    paidTransfer: 0,
  });
  const [modalInitialOverrides, setModalInitialOverrides] = useState<
    Record<string, SeatOverride>
  >({});
  const [pendingPaymentContext, setPendingPaymentContext] = useState<{
    type: "new" | "update";
    bookingIds?: string[];
    totalPrice: number;
  } | null>(null);
  const [updateSummary, setUpdateSummary] = useState<{
    diffCount: number;
    diffPrice: number;
    oldPrice: number;
    newPrice: number;
    diffTrips: TripDiffItem[];
  } | null>(null);

  useEffect(() => {
    if (editingBooking) {
      const currentMode =
        editingBooking.status === "payment"
          ? "payment"
          : editingBooking.status === "hold"
          ? "hold"
          : "booking";
      setBookingMode(currentMode);

      const rawNote = editingBooking.passenger.note || "";
      const cleanNote = rawNote
        .replace(/\s*\(Chuyển sang [^\)]+\)/g, "")
        .replace(/\s*\(Cần thu thêm: [^\)]+\)/g, "")
        .replace(/\s*\(Cần hoàn lại: [^\)]+\)/g, "")
        .trim();

      setBookingForm({
        phone: editingBooking.passenger.phone,
        pickup: editingBooking.passenger.pickupPoint || "",
        dropoff: editingBooking.passenger.dropoffPoint || "",
        note: cleanNote,
      });

      setModalPaymentInput({
        paidCash: editingBooking.payment?.paidCash || 0,
        paidTransfer: editingBooking.payment?.paidTransfer || 0,
      });
    } else {
      setBookingForm({ phone: "", pickup: "", dropoff: "", note: "" });
      setBookingMode("booking");
      setPhoneError(null);
    }
  }, [editingBooking]);

  const totalBasketPrice = useMemo(() => {
    if (!editingBooking && bookingMode === "booking") return 0;
    return selectionBasket.reduce((sum, item) => {
      return (
        sum +
        item.seats.reduce((sSum, s) => {
          let price = s.price;
          if (editingBooking) {
            const originalItem = editingBooking.items.find(
              (i) => i.tripId === item.trip.id
            );
            const ticket = originalItem?.tickets?.find(
              (t) => t.seatId === s.id
            );
            if (ticket) price = ticket.price;
          }
          return sSum + price;
        }, 0)
      );
    }, 0);
  }, [selectionBasket, editingBooking, bookingMode]);

  const historyMatches = useMemo(() => {
    const cleanInput = bookingForm.phone.replace(/\D/g, "");
    if (cleanInput.length < 3) return [];
    return bookings.filter(
      (b) =>
        b.status !== "cancelled" &&
        b.passenger.phone.replace(/\D/g, "").includes(cleanInput)
    );
  }, [bookings, bookingForm.phone]);

  const passengerHistory = useMemo(() => {
    const uniqueRoutes = new Map<
      string,
      { pickup: string; dropoff: string; phone: string; lastDate: string }
    >();
    historyMatches.forEach((b) => {
      const pickup = b.passenger.pickupPoint || "";
      const dropoff = b.passenger.dropoffPoint || "";
      if (!pickup && !dropoff) return;
      const key = `${pickup.toLowerCase().trim()}|${dropoff
        .toLowerCase()
        .trim()}`;
      const existing = uniqueRoutes.get(key);
      if (!existing || new Date(b.createdAt) > new Date(existing.lastDate)) {
        uniqueRoutes.set(key, {
          pickup,
          dropoff,
          phone: formatPhoneNumber(b.passenger.phone),
          lastDate: b.createdAt,
        });
      }
    });
    return Array.from(uniqueRoutes.values())
      .sort(
        (a, b) =>
          new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime()
      )
      .slice(0, 5);
  }, [historyMatches]);

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

    const passenger: Passenger = {
      name: "Khách lẻ",
      phone: bookingForm.phone || "0000000000",
      note: noteSuffix ? `${bookingForm.note} ${noteSuffix}` : bookingForm.note,
      pickupPoint: bookingForm.pickup,
      dropoffPoint: bookingForm.dropoff,
    };
    const payment = paymentData || { paidCash: 0, paidTransfer: 0 };
    const isPaid = payment.paidCash + payment.paidTransfer > 0;
    const status =
      explicitStatus ||
      (isPaid ? "payment" : bookingMode === "hold" ? "hold" : "booking");

    try {
      const bookingItems = selectionBasket.map((item) => ({
        tripId: item.trip.id,
        seats: item.seats,
        tickets: item.seats.map((s) => {
          const override = overrides[`${item.trip.id}_${s.id}`];
          return {
            seatId: s.id,
            price: status === "booking" ? 0 : override?.price ?? s.price,
            pickup: override?.pickup ?? passenger.pickupPoint ?? "",
            dropoff: override?.dropoff ?? passenger.dropoffPoint ?? "",
          };
        }),
      }));

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
      setBookings((prev) => [
        ...prev.filter((b) => !result.bookings.some((nb) => nb.id === b.id)),
        ...result.bookings,
      ]);

      const savedBooking = result.bookings[0];

      if (savedBooking) {
        setUndoStack((prev) => [
          ...prev,
          {
            type: "CREATED_BOOKING",
            bookingId: savedBooking.id,
            phone: savedBooking.passenger.phone,
            seatCount: savedBooking.totalTickets,
            seatLabels: selectionBasket.flatMap((i) =>
              i.seats.map((s) => s.label)
            ),
            tripDate: selectionBasket[0].trip.departureTime,
          },
        ]);
        setEditingBooking(savedBooking);
      }

      toast({
        type: "success",
        title: "Thành công",
        message: "Đã tạo đơn hàng thành công.",
      });
      
      return savedBooking;
    } catch (e) {
      toast({
        type: "error",
        title: "Lỗi",
        message: "Có lỗi xảy ra khi tạo đơn.",
      });
      throw e;
    }
  };

  const executeBookingUpdate = async (
    targetBookingId: string,
    paymentData: { paidCash: number; paidTransfer: number },
    overrides: Record<string, SeatOverride> = {},
    noteSuffix: string = "",
    explicitStatus?: "booking" | "payment" | "hold"
  ) => {
    try {
      const passenger = {
        name: "Khách lẻ",
        phone: bookingForm.phone,
        note: noteSuffix
          ? `${bookingForm.note} ${noteSuffix}`
          : bookingForm.note,
        pickupPoint: bookingForm.pickup,
        dropoffPoint: bookingForm.dropoff,
      };
      const status = explicitStatus || bookingMode;
      const oldBooking = bookings.find((b) => b.id === targetBookingId);

      const currentItems = selectionBasket.map((item) => ({
        tripId: item.trip.id,
        seats: item.seats,
        tickets: item.seats.map((s) => {
          const override = overrides[`${item.trip.id}_${s.id}`];
          return {
            seatId: s.id,
            price: status === "booking" ? 0 : override?.price ?? s.price,
            pickup: override?.pickup ?? passenger.pickupPoint ?? "",
            dropoff: override?.dropoff ?? passenger.dropoffPoint ?? "",
          };
        }),
      }));

      const basketTripIds = new Set(currentItems.map((i) => i.tripId));
      const loadedTripIds = new Set(trips.map((t) => t.id));
      const preservedItems = (oldBooking?.items || []).filter(
        (item) =>
          !basketTripIds.has(item.tripId) && !loadedTripIds.has(item.tripId)
      );

      const finalItems = [
        ...preservedItems.map((i) => ({
          tripId: i.tripId,
          seats: i.seatIds.map((id) => ({ id } as Seat)),
          tickets: i.tickets,
        })),
        ...currentItems,
      ];
      const finalPayment =
        status === "booking" || status === "hold"
          ? { paidCash: 0, paidTransfer: 0 }
          : paymentData;

      const result = await api.bookings.update(
        targetBookingId,
        finalItems,
        passenger,
        finalPayment,
        status
      );
      
      const savedBooking = result.booking;
      setBookings((prev) =>
        prev.map((b) => (b.id === targetBookingId ? savedBooking : b))
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

      setEditingBooking(savedBooking);

      toast({
        type: "success",
        title: "Thành công",
        message: "Đã lưu thay đổi đơn hàng.",
      });
      
      return savedBooking;
    } catch (e) {
      toast({ type: "error", title: "Lỗi", message: "Cập nhật thất bại." });
      throw e;
    }
  };

  const handleConfirmAction = () => {
    if (editingBooking) {
      const oldTripMap = new Map<string, string[]>(
        editingBooking.items.map((item) => {
          return [item.tripId, item.seatIds];
        })
      );

      const newTripMap = new Map<string, string[]>(
        selectionBasket.map((item) => [
          item.trip.id,
          item.seats.map((s) => s.id),
        ])
      );

      const allTripIds = new Set([...oldTripMap.keys(), ...newTripMap.keys()]);
      const diffTrips: TripDiffItem[] = [];

      allTripIds.forEach((tripId) => {
        const oldIds = oldTripMap.get(tripId) || [];
        const newIds = newTripMap.get(tripId) || [];

        const addedIds = newIds.filter((s) => !oldIds.includes(s));
        const removedIds = oldIds.filter((s) => !newIds.includes(s));
        const keptIds = oldIds.filter((s) => newIds.includes(s));

        if (addedIds.length || removedIds.length || keptIds.length) {
          const basketItem = selectionBasket.find((i) => i.trip.id === tripId);
          const oldItem = editingBooking.items.find((i) => i.tripId === tripId);
          const tripObj = trips.find((t) => t.id === tripId);

          const getLabel = (id) => {
            if (tripObj) {
              const s = tripObj.seats.find((st) => st.id === id);
              if (s) return s.label;
            }
            return id;
          };

          diffTrips.push({
            route: basketItem?.trip.route || oldItem?.route || "",
            date: new Date(
              basketItem?.trip.departureTime || oldItem?.tripDate || ""
            ),
            seats: [
              ...keptIds.map((id) => ({
                label: getLabel(id),
                status: "kept" as const,
              })),
              ...removedIds.map((id) => ({
                label: getLabel(id),
                status: "removed" as const,
              })),
              ...addedIds.map((id) => ({
                label: getLabel(id),
                status: "added" as const,
              })),
            ].sort((a, b) =>
              a.label.localeCompare(b.label, undefined, { numeric: true })
            ),
          });
        }
      });

      setUpdateSummary({
        diffCount:
          selectionBasket.reduce((s, i) => s + i.seats.length, 0) -
          editingBooking.totalTickets,
        diffPrice: totalBasketPrice - editingBooking.totalPrice,
        oldPrice: editingBooking.totalPrice,
        newPrice: totalBasketPrice,
        diffTrips,
      });
      return;
    }

    if (bookingMode === "booking") processBooking(undefined, {}, "", "booking").then(() => setEditingBooking(null));
    else if (bookingMode === "hold") processBooking(undefined, {}, "", "hold").then(() => setEditingBooking(null));
    else handleInitiatePayment();
  };

  const handleInitiatePayment = () => {
    if (!selectionBasket.length)
      return toast({ type: "warning", title: "Chưa chọn ghế" });
    const error = validatePhoneNumber(bookingForm.phone);
    if (error)
      return (
        setPhoneError(error),
        toast({
          type: "error",
          title: "Số điện thoại không hợp lệ",
          message: error,
        })
      );

    const total = selectionBasket.reduce(
      (s, i) => s + i.seats.reduce((ss, seat) => ss + seat.price, 0),
      0
    );
    setModalPaymentInput({ paidCash: 0, paidTransfer: 0 });
    setPendingPaymentContext({ type: "new", totalPrice: total });
    setIsPaymentModalOpen(true);
  };

  const handleManualPaymentForEdit = () => {
    if (!editingBooking) return;
    setBookingMode("payment");
    const overrides: Record<string, SeatOverride> = {};
    editingBooking.items.forEach((i) =>
      i.tickets?.forEach(
        (t) =>
          (overrides[`${i.tripId}_${t.seatId}`] = {
            price: t.price,
            pickup: t.pickup,
            dropoff: t.dropoff,
          })
      )
    );
    setModalInitialOverrides(overrides);
    setPendingPaymentContext({
      type: "update",
      bookingIds: [editingBooking.id],
      totalPrice: totalBasketPrice,
    });
    setIsPaymentModalOpen(true);
  };

  const handleConfirmPayment = async (
    finalTotal: number,
    overrides: Record<string, SeatOverride>,
    noteSuffix: string = ""
  ) => {
    if (pendingPaymentContext?.type === "update" && editingBooking) {
      return await executeBookingUpdate(
        editingBooking.id,
        modalPaymentInput,
        overrides,
        noteSuffix,
        "payment"
      );
    } else {
      return await processBooking(modalPaymentInput, overrides, noteSuffix);
    }
  };

  const handleProceedUpdate = async () => {
    setUpdateSummary(null);
    if (!editingBooking) return;
    const noteSuffix =
      bookingMode !== editingBooking.status
        ? `(Chuyển sang ${
            bookingMode === "hold"
              ? "Giữ vé"
              : bookingMode === "booking"
              ? "Đặt vé"
              : "Mua vé"
          })`
        : "";
    if (bookingMode !== "payment") {
      await executeBookingUpdate(
        editingBooking.id,
        { paidCash: 0, paidTransfer: 0 },
        {},
        noteSuffix
      );
      setEditingBooking(null);
    } else {
      const overrides: Record<string, SeatOverride> = {};
      editingBooking.items.forEach((i) =>
        i.tickets?.forEach(
          (t) =>
            (overrides[`${i.tripId}_${t.seatId}`] = {
              price: t.price,
              pickup: t.pickup,
              dropoff: t.dropoff,
            })
        )
      );
      setModalInitialOverrides(overrides);
      setPendingPaymentContext({
        type: "update",
        bookingIds: [editingBooking.id],
        totalPrice: totalBasketPrice,
      });
      setIsPaymentModalOpen(true);
    }
  };

  return (
    <>
      <div className="bg-indigo-950 rounded-xl shadow-lg border border-indigo-900 flex flex-col overflow-visible shrink-0 transition-colors duration-300">
        <div className="px-3 h-[40px] bg-gradient-to-r from-indigo-950 via-indigo-900 to-indigo-950 border-b border-indigo-900 flex items-center justify-between shrink-0 rounded-t-xl">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Ticket size={16} className="text-yellow-400" />
            {editingBooking ? "Chỉnh sửa" : "Đặt vé mới"}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancelSelection}
              disabled={selectionBasket.length === 0 && !editingBooking}
              className="text-indigo-300 hover:text-white hover:bg-indigo-800 p-1.5 rounded-full transition-colors disabled:opacity-30"
            >
              {editingBooking ? <X size={16} /> : <RotateCcw size={14} />}
            </button>
            <Badge className="bg-yellow-400 text-indigo-950 font-bold border-transparent">
              {selectionBasket.reduce((s, i) => s + i.seats.length, 0)} vé
            </Badge>
          </div>
        </div>

        <div className="p-3 overflow-y-auto flex-1 bg-indigo-950">
          {selectionBasket.length === 0 ? (
            <div
              className={`text-center py-6 text-xs border-2 border-dashed rounded-lg ${
                editingBooking
                  ? "border-red-800/30 bg-red-900/10 text-red-300"
                  : "border-indigo-900 text-indigo-300/50"
              }`}
            >
              {editingBooking ? "Đã xóa hết giường (Sẽ hủy vé)" : "Chọn giường"}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {selectionBasket.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-indigo-900 border border-indigo-700 rounded-lg p-2.5 text-white relative transition-colors cursor-pointer hover:bg-indigo-800"
                  onClick={() =>
                    onNavigateToTrip?.(
                      new Date(item.trip.departureTime),
                      item.trip.id
                    )
                  }
                >
                  <div className="text-xs text-white mb-1 truncate flex items-center">
                    {item.trip.route}
                  </div>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-1.5">
                      <Clock size={12} className="text-slate-400" />
                      <span className="text-[9px] text-slate-400">
                        {new Date(item.trip.departureTime).getDate()}/
                        {new Date(item.trip.departureTime).getMonth() + 1}
                        {" - "}
                        {formatLunarDate(new Date(item.trip.departureTime))}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {item.seats.map((s) => (
                      <div key={s.id} className="relative group">
                        <span className="inline-block bg-indigo-100 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-indigo-200">
                          {s.label}
                        </span>
                        {editingBooking && onInitiateSwap && (
                          <button
                            title="Đổi ghế"
                            onClick={(e) => {
                              e.stopPropagation();
                              onInitiateSwap(s);
                            }}
                            className="absolute -top-3 right-3 bg-white text-indigo-600 rounded-full p-0.5 shadow-sm border border-slate-200 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-indigo-50"
                          >
                            <ArrowRightLeft size={10} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-3 pb-3 bg-indigo-950">
          <div className="bg-indigo-900/50 p-1 rounded-lg flex border border-indigo-800">
            {(["booking", "payment", "hold"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setBookingMode(mode)}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs rounded-md transition-all ${
                  bookingMode === mode
                    ? "bg-yellow-500 text-indigo-950 shadow-sm"
                    : "text-indigo-300 hover:text-white"
                }`}
              >
                {mode === "booking" ? (
                  <Ticket size={12} />
                ) : mode === "payment" ? (
                  <Banknote size={12} />
                ) : (
                  <Lock size={12} />
                )}{" "}
                {mode === "booking"
                  ? "Đặt vé"
                  : mode === "payment"
                  ? "Mua vé"
                  : "Giữ vé"}
              </button>
            ))}
          </div>
        </div>

        <div className="p-3 border-t bg-indigo-900/50 border-indigo-900 space-y-2 relative">
          {bookingMode !== "hold" ? (
            <>
              <div className="relative">
                <input
                  name="phone"
                  value={bookingForm.phone}
                  onChange={(e) => {
                    setBookingForm((p) => ({
                      ...p,
                      phone: formatPhoneNumber(e.target.value),
                    }));
                    setPhoneError(null);
                    setShowHistory(true);
                  }}
                  onBlur={() => (
                    setTimeout(() => setShowHistory(false), 200),
                    bookingForm.phone &&
                      setPhoneError(validatePhoneNumber(bookingForm.phone))
                  )}
                  onFocus={() =>
                    bookingForm.phone.length >= 3 && setShowHistory(true)
                  }
                  className={`w-full pl-6 pr-2 py-1.5 text-xs rounded border text-white placeholder-indigo-400 bg-indigo-950 border-indigo-800 outline-none transition-colors focus:border-yellow-400 ${
                    phoneError ? "border-red-500 focus:border-red-500" : ""
                  }`}
                  placeholder="Số điện thoại"
                />
                <Phone
                  size={12}
                  className={`absolute left-2 top-[9px] ${
                    phoneError ? "text-red-500" : "text-indigo-400"
                  }`}
                />
                {showHistory && passengerHistory.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border border-slate-200 z-50 animate-in fade-in zoom-in-95">
                    <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-100 flex justify-between items-center">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase">
                        <History size={10} /> Lịch sử
                      </div>
                      <button
                        title="Đóng lịch sử"
                        onClick={() => setShowHistory(false)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <X size={12} />
                      </button>
                    </div>
                    <div className="max-h-[200px] overflow-y-auto">
                      {passengerHistory.map((item, idx) => (
                        <div
                          key={idx}
                          onMouseDown={() => {
                            setBookingForm((p) => ({
                              ...p,
                              phone: item.phone,
                              pickup: item.pickup,
                              dropoff: item.dropoff,
                            }));
                            setPhoneError(null);
                            setShowHistory(false);
                          }}
                          className="px-3 py-2 hover:bg-indigo-50 cursor-pointer border-b border-slate-50 last:border-0"
                        >
                          <div className="flex justify-between items-start">
                            <span className="text-xs font-bold text-indigo-700">
                              {item.phone}
                            </span>
                            <span className="text-[9px] text-slate-400">
                              {new Date(item.lastDate).toLocaleDateString(
                                "vi-VN"
                              )}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-600 truncate">
                            {item.pickup} → {item.dropoff}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {["pickup", "dropoff"].map((f) => (
                  <div key={f} className="relative">
                    <input
                      name={f}
                      value={bookingForm[f as keyof typeof bookingForm]}
                      onChange={(e) =>
                        setBookingForm((p) => ({
                          ...p,
                          [f]: e.target.value.replace(/(?:^|\s)\S/g, (a) =>
                            a.toUpperCase()
                          ),
                        }))
                      }
                      onBlur={() =>
                        setBookingForm((p) => {
                          const v = p[f as keyof typeof bookingForm];
                          const s = getStandardizedLocation(v);
                          return s !== v ? { ...p, [f]: s } : p;
                        })
                      }
                      className="w-full pl-6 pr-2 py-1.5 text-xs rounded border text-white placeholder-indigo-400 bg-indigo-950 border-indigo-800 focus:border-yellow-400 outline-none"
                      placeholder={f === "pickup" ? "Điểm đón" : "Điểm trả"}
                    />
                    {f === "pickup" ? (
                      <MapPin
                        size={12}
                        className="absolute left-2 top-[9px] text-indigo-400"
                      />
                    ) : (
                      <Locate
                        size={12}
                        className="absolute left-2 top-[9px] text-indigo-400"
                      />
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-2 bg-indigo-900/30 rounded border border-indigo-800 border-dashed text-xs text-indigo-300 mb-2">
              <Lock className="mx-auto mb-1 opacity-50" size={16} /> Giữ vé
            </div>
          )}
          <div className="relative">
            <textarea
              name="note"
              value={bookingForm.note}
              onChange={(e) =>
                setBookingForm((p) => ({ ...p, note: e.target.value }))
              }
              className="w-full pl-6 pr-2 py-1.5 text-xs rounded border text-white placeholder-indigo-400 bg-indigo-950 border-indigo-800 h-8 resize-none outline-none focus:border-yellow-400"
              placeholder={
                bookingMode === "hold" ? "Ghi chú giữ chỗ" : "Ghi chú"
              }
            />
            <Notebook
              size={12}
              className="absolute left-2 top-[9px] text-indigo-400"
            />
          </div>
        </div>

        <div
          className={`p-2 border-t rounded-b-xl bg-indigo-950 border-indigo-900 ${
            editingBooking ? "grid grid-cols-2 gap-2" : ""
          }`}
        >
          {editingBooking ? (
            <>
              <Button
                className="bg-green-600 hover:bg-green-500 text-white font-bold h-10 text-sm border border-green-700"
                onClick={handleManualPaymentForEdit}
              >
                <CreditCard size={16} className="mr-2" /> Thanh toán
              </Button>
              <Button
                className={`font-bold h-10 text-sm ${
                  selectionBasket.length === 0
                    ? "bg-red-600 hover:bg-red-500"
                    : "bg-yellow-500 hover:bg-yellow-400 text-indigo-950"
                }`}
                onClick={handleConfirmAction}
              >
                <Save size={16} className="mr-2" />{" "}
                {selectionBasket.length === 0 ? "Xác nhận hủy" : "Lưu thay đổi"}
              </Button>
            </>
          ) : (
            <Button
              className={`w-full font-bold h-10 text-sm ${
                bookingMode === "payment"
                  ? "bg-green-600 hover:bg-green-500"
                  : "bg-yellow-500 hover:bg-yellow-400 text-indigo-950"
              }`}
              onClick={handleConfirmAction}
              disabled={selectionBasket.length === 0}
            >
              {bookingMode === "payment" ? (
                <CreditCard size={16} className="mr-2" />
              ) : (
                <CheckCircle2 size={16} className="mr-2" />
              )}{" "}
              {bookingMode === "payment" ? "Thanh toán" : "Đồng ý"}
            </Button>
          )}
        </div>
      </div>

      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onConfirm={handleConfirmPayment}
        selectionBasket={selectionBasket}
        editingBooking={editingBooking}
        bookingForm={bookingForm}
        buses={buses}
        paidCash={modalPaymentInput.paidCash}
        paidTransfer={modalPaymentInput.paidTransfer}
        onMoneyChange={(e) => {
          const { name, value } = e.target;
          setModalPaymentInput((p) => ({
            ...p,
            [name]: parseCurrency(value),
          }));
        }}
        initialOverrides={modalInitialOverrides}
      />

      <AlertDialog
        open={!!updateSummary}
        onOpenChange={(o) => !o && setUpdateSummary(null)}
      >
        <AlertDialogContent className="max-w-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-blue-600 flex items-center gap-2">
              <FileEdit size={20} /> Xác nhận thay đổi
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-slate-600 pt-2 space-y-4">
                <div className="space-y-4 py-2 text-sm bg-slate-50 rounded-lg p-4 border border-slate-100">
                  {updateSummary?.diffTrips.map((t, idx) => (
                    <div key={idx} className="space-y-2">
                      <div className="text-xs font-bold flex items-center gap-2 border-b pb-1">
                        <MapPin size={12} className="text-blue-500" /> {t.route}{" "}
                        • <Calendar size={12} className="text-slate-400" />{" "}
                        {t.date.toLocaleDateString("vi-VN")}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {t.seats.map((s, si) => (
                          <span
                            key={si}
                            className={`px-2 py-1 rounded text-[11px] font-bold ${
                              s.status === "added"
                                ? "bg-green-100 text-green-700"
                                : s.status === "removed"
                                ? "bg-red-50 text-red-400 line-through"
                                : "bg-slate-100"
                            }`}
                          >
                            {s.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center pt-3 border-t">
                  <span className="text-xs">Tổng tiền:</span>
                  <div className="flex items-center gap-2 font-medium">
                    <span className="text-slate-400 line-through text-xs">
                      {formatCurrency(updateSummary?.oldPrice)}
                    </span>
                    <ArrowRightIcon size={14} className="text-slate-300" />
                    <span className="text-slate-900 font-bold">
                      {formatCurrency(updateSummary?.newPrice)} đ
                    </span>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setUpdateSummary(null)}>
              Quay lại
            </Button>
            <Button className="bg-blue-600" onClick={handleProceedUpdate}>
              Đồng ý lưu
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
