import React, { useState, useMemo, useEffect } from "react";
import { Dialog } from "./ui/Dialog";
import { Button } from "./ui/Button";
import {
  CheckCircle2,
  DollarSign,
  CreditCard,
  Calendar,
  MapPin,
  Locate,
  Bus,
  Ticket,
  Calculator,
  RotateCcw,
  History,
  TrendingUp,
  AlertCircle,
  X,
  Printer,
} from "lucide-react";
import {
  BusTrip,
  Seat,
  Booking,
  Bus as BusTypeData,
  SeatStatus,
} from "../types";
import { formatLunarDate } from "../utils/dateUtils";
import {
  getStandardizedLocation,
  formatCurrency,
  parseCurrency,
} from "../utils/formatters";
import { CurrencyInput } from "./ui/CurrencyInput";
import { BookingPrint } from "./BookingPrint";

interface SeatOverride {
  price?: number;
  pickup?: string;
  dropoff?: string;
  isPaid?: boolean; // NEW: Track if this seat is selected for payment
  status?: "booking" | "payment" | "hold"; // NEW: Track ticket status
}

interface PaymentSeat extends Seat {
  diffStatus?: "kept" | "added" | "removed";
}

interface PaymentItem {
  tripId: string;
  tripName: string;
  tripDate: string;
  route: string;
  licensePlate: string;
  busPhoneNumber: string;
  seats: PaymentSeat[];
  pickup: string;
  dropoff: string;
  basePrice: number;
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (
    finalTotal: number,
    seatOverrides: Record<string, SeatOverride>,
    noteSuffix?: string,
    stableItems?: PaymentItem[]
  ) => Promise<Booking | void>;
  selectionBasket: { trip: BusTrip; seats: Seat[] }[];
  editingBooking?: Booking | null;
  bookingForm: {
    phone: string;
    pickup: string;
    dropoff: string;
    note: string;
    exactBed?: boolean;
  };
  buses: BusTypeData[];
  paidCash: number;
  paidTransfer: number;
  onMoneyChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isProcessing?: boolean;
  initialOverrides?: Record<string, SeatOverride>;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  selectionBasket,
  editingBooking,
  bookingForm,
  buses,
  paidCash,
  paidTransfer,
  onMoneyChange,
  isProcessing = false,
  initialOverrides = {},
}) => {
  const [seatOverrides, setSeatOverrides] = useState<
    Record<string, SeatOverride>
  >({});
  const [savedBooking, setSavedBooking] = useState<Booking | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [localProcessing, setLocalProcessing] = useState(false);
  const [stableItems, setStableItems] = useState<PaymentItem[]>([]);

  useEffect(() => {
    if (isOpen && selectionBasket.length > 0 && stableItems.length === 0) {
      // 1. Thu thập tất cả tripIds liên quan (từ selectionBasket và editingBooking)
      const allTripIds = new Set<string>();
      selectionBasket.forEach((item) => allTripIds.add(item.trip.id));
      if (editingBooking) {
        editingBooking.items.forEach((item) => allTripIds.add(item.tripId));
      }

      // 2. Tạo stableItems bao gồm cả ghế mới, cũ và hủy
      const initialItems: PaymentItem[] = Array.from(allTripIds).map(
        (tripId) => {
          const basketItem = selectionBasket.find(
            (item) => item.trip.id === tripId
          );
          const bookingItem = editingBooking?.items.find(
            (item) => item.tripId === tripId
          );

          // Lấy thông tin chuyến xe từ basket hoặc từ list trips (cần backup nếu basket không có)
          const tripInfo = basketItem?.trip || {
            id: tripId,
            name: bookingItem?.route || "Chuyến xe", // Fallback if trip not in basket
            departureTime: bookingItem?.tripDate || new Date().toISOString(),
            route: bookingItem?.route || "---",
            licensePlate: bookingItem?.licensePlate || "---",
            basePrice: 0, // Will be updated if available
          };

          const busObj = buses.find((b) => b.plate === tripInfo.licensePlate);

          // Phân loại ghế
          const basketSeats = basketItem?.seats || [];
          const originalSeatIds = bookingItem?.seatIds || [];

          const allSeats: PaymentSeat[] = [];

          // Ghế "Kept" hoặc "Added" (có trong basket)
          basketSeats.forEach((seat) => {
            const isOriginal = originalSeatIds.some(
              (oid) => String(oid) === String(seat.id)
            );
            allSeats.push({
              ...seat,
              diffStatus: isOriginal ? "kept" : "added",
            });
          });

          // Ghế "Removed" (có trong booking cũ nhưng không có trong basket mới)
          originalSeatIds.forEach((oid) => {
            const inBasket = basketSeats.some(
              (bs) => String(bs.id) === String(oid)
            );
            if (!inBasket) {
              const originalTicket = bookingItem?.tickets?.find(
                (t) => String(t.seatId) === String(oid)
              );
              allSeats.push({
                id: String(oid),
                label: String(oid), // Use ID as label if we don't have snapshot
                status: SeatStatus.AVAILABLE, // Trở thành trống
                price: originalTicket?.price || 0,
                diffStatus: "removed",
                floor: 1, // Dummy
              } as PaymentSeat);
            }
          });

          return {
            tripId: tripId,
            tripName: tripInfo.name,
            tripDate: tripInfo.departureTime,
            route: tripInfo.route,
            licensePlate: tripInfo.licensePlate,
            busPhoneNumber: busObj?.phoneNumber || "---",
            seats: allSeats,
            pickup: bookingForm.pickup || "",
            dropoff: bookingForm.dropoff || "",
            basePrice: tripInfo.basePrice || 0,
          };
        }
      );

      setStableItems(initialItems);

      // 3. Initialize overrides
      const overrides: Record<string, SeatOverride> = {
        ...(initialOverrides || {}),
      };

      if (editingBooking) {
        editingBooking.items.forEach((item) => {
          item.tickets?.forEach((ticket) => {
            const key = `${item.tripId}_${ticket.seatId}`;
            if (!overrides[key]) overrides[key] = {};

            // Nếu vẫn còn giữ ghế này, mặc định isPaid dựa trên giá
            const stillExists = initialItems.some(
              (ii) =>
                ii.tripId === item.tripId &&
                ii.seats.some(
                  (s) =>
                    s.id === String(ticket.seatId) && s.diffStatus !== "removed"
                )
            );

            if (stillExists) {
              overrides[key].isPaid = (ticket.price || 0) > 0;
            } else {
              overrides[key].isPaid = false; // Ghế bị xóa thì không thu tiền
            }

            overrides[key].status = ticket.status || "booking";
            overrides[key].price = ticket.price;
            overrides[key].pickup = ticket.pickup;
            overrides[key].dropoff = ticket.dropoff;
          });
        });

        // Đảm bảo các ghế mới thêm cũng có isPaid mặc định
        initialItems.forEach((item) => {
          item.seats
            .filter((s) => s.diffStatus === "added")
            .forEach((seat) => {
              const key = `${item.tripId}_${seat.id}`;
              if (!overrides[key]) {
                overrides[key] = { isPaid: (seat.price || 0) > 0 };
              }
            });
        });
      } else {
        selectionBasket.forEach((item) => {
          item.seats.forEach((seat) => {
            const key = `${item.trip.id}_${seat.id}`;
            if (!overrides[key]) overrides[key] = {};
            overrides[key].isPaid = (seat.price || 0) > 0;
          });
        });
      }

      setSeatOverrides(overrides);
    }

    if (!isOpen) {
      setStableItems([]);
      setSeatOverrides({});
      setIsSaved(false);
      setSavedBooking(null);
    }
  }, [isOpen, selectionBasket, buses, bookingForm, initialOverrides]);

  const getSeatValues = (
    tripId: string,
    seat: Seat,
    defaultPickup: string,
    defaultDropoff: string,
    tripBasePrice: number
  ) => {
    const key = `${tripId}_${seat.id}`;
    const override = seatOverrides[key];

    const isPaid = override?.isPaid ?? seat.price > 0;

    // Xác định xem ghế này có phải đã thanh toán từ trước không (trong DB)
    const isAlreadyPaid =
      editingBooking?.items
        .find((i) => i.tripId === tripId)
        ?.tickets?.find((t) => String(t.seatId) === String(seat.id))?.status ===
      "payment";

    return {
      price: override?.price ?? seat.price,
      pickup: override?.pickup ?? defaultPickup,
      dropoff: override?.dropoff ?? defaultDropoff,
      isPaid,
      isAlreadyPaid,
      isPriceChanged:
        override?.price !== undefined && override.price !== seat.price,
    };
  };

  const toggleSeatPayment = (tripId: string, seatId: string) => {
    if (isSaved) setIsSaved(false);
    const key = `${tripId}_${seatId}`;

    // Không cho phép bỏ tích nếu ghế đã ở trạng thái payment trong DB
    const isAlreadyPaid =
      editingBooking?.items
        .find((i) => i.tripId === tripId)
        ?.tickets?.find((t) => String(t.seatId) === String(seatId))?.status ===
      "payment";
    if (isAlreadyPaid) return;

    setSeatOverrides((prev) => {
      const current = prev[key] || {};
      return {
        ...prev,
        [key]: {
          ...current,
          isPaid: !current.isPaid,
        },
      };
    });
  };

  const finalTotal = useMemo(() => {
    let total = 0;
    stableItems.forEach((trip) => {
      trip.seats.forEach((seat) => {
        const { price, isPaid } = getSeatValues(
          trip.tripId,
          seat,
          trip.pickup,
          trip.dropoff,
          trip.basePrice
        );
        if (isPaid) total += price;
      });
    });
    return total;
  }, [stableItems, seatOverrides, editingBooking]);

  const previouslyPaid = useMemo(() => {
    if (!editingBooking) return 0;
    return (
      (editingBooking.payment?.paidCash || 0) +
      (editingBooking.payment?.paidTransfer || 0)
    );
  }, [editingBooking]);

  const currentInputTotal = paidCash + paidTransfer;
  const remainingBalance = finalTotal - currentInputTotal;
  const isBalanceMatched = currentInputTotal === finalTotal && finalTotal > 0;

  // Kiểm tra xem có bất kỳ thay đổi nào so với dữ liệu khởi tạo không
  const hasChanges = useMemo(() => {
    if (!editingBooking) return true;
    return JSON.stringify(seatOverrides) !== JSON.stringify(initialOverrides);
  }, [seatOverrides, initialOverrides, editingBooking]);

  const handleOverrideChange = (
    tripId: string,
    seatId: string,
    field: keyof SeatOverride,
    value: string
  ) => {
    // Nếu có sự thay đổi, đặt lại trạng thái chưa lưu để nút Hoàn tất hiện lại
    if (isSaved) setIsSaved(false);

    const key = `${tripId}_${seatId}`;
    setSeatOverrides((prev) => {
      const current = prev[key] || {};
      let newValue: string | number = value;
      let extraChanges: Partial<SeatOverride> = {};

      if (field === "price") {
        newValue = parseCurrency(value);
        // Tự động tích nếu > 0, bỏ tích nếu = 0
        extraChanges.isPaid = (newValue as number) > 0;
      }

      return {
        ...prev,
        [key]: { ...current, [field]: newValue, ...extraChanges },
      };
    });
  };

  const handleLocationBlur = (
    tripId: string,
    seatId: string,
    field: "pickup" | "dropoff",
    value: string
  ) => {
    const standardized = getStandardizedLocation(value);
    if (standardized !== value) {
      handleOverrideChange(tripId, seatId, field, standardized);
    }
  };

  const handleQuickSettle = (method: "cash" | "transfer") => {
    if (isSaved) setIsSaved(false);
    const gap = remainingBalance;
    const currentVal = method === "cash" ? paidCash : paidTransfer;
    const newVal = Math.max(0, currentVal + gap);
    const event = {
      target: {
        name: method === "cash" ? "paidCash" : "paidTransfer",
        value: newVal.toString(),
      },
    } as React.ChangeEvent<HTMLInputElement>;
    onMoneyChange(event);
  };

  // Wrapper cho onMoneyChange để reset isSaved
  const handleMoneyChangeLocal = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isSaved) setIsSaved(false);
    onMoneyChange(e);
  };

  const hasPaymentChanges = useMemo(() => {
    if (!editingBooking) return false;
    const initialCash = editingBooking.payment?.paidCash || 0;
    const initialTransfer = editingBooking.payment?.paidTransfer || 0;
    return paidCash !== initialCash || paidTransfer !== initialTransfer;
  }, [paidCash, paidTransfer, editingBooking]);

  const handleConfirmClick = async () => {
    if (isSaved) return;
    setLocalProcessing(true);

    let noteSuffix = "";
    if (remainingBalance > 0) {
      noteSuffix = `(Cần thu thêm: ${formatCurrency(remainingBalance)}đ)`;
    } else if (remainingBalance < 0) {
      noteSuffix = `(Cần hoàn lại: ${formatCurrency(
        Math.abs(remainingBalance)
      )}đ)`;
    }

    const finalOverrides: Record<string, SeatOverride> = { ...seatOverrides };
    const filteredItems = stableItems
      .map((trip) => ({
        ...trip,
        seats: trip.seats.filter((s) => s.diffStatus !== "removed") as Seat[],
      }))
      .filter((trip) => trip.seats.length > 0);

    stableItems.forEach((trip) => {
      trip.seats.forEach((seat) => {
        if (seat.diffStatus === "removed") return; // Bỏ qua ghế đã xóa

        const key = `${trip.tripId}_${seat.id}`;
        const { price, isPaid } = getSeatValues(
          trip.tripId,
          seat,
          trip.pickup,
          trip.dropoff,
          trip.basePrice
        );
        if (!finalOverrides[key]) finalOverrides[key] = {};
        finalOverrides[key].price = price;
        // Cập nhật trạng thái vé dựa trên việc có được chọn thanh toán hay không
        finalOverrides[key].status = isPaid ? "payment" : "booking";
      });
    });

    try {
      const result = await onConfirm(
        finalTotal,
        finalOverrides,
        noteSuffix,
        filteredItems
      );
      if (result) {
        setSavedBooking(result as Booking);
      }
      setIsSaved(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLocalProcessing(false);
    }
  };

  // Logic hiển thị trạng thái active cho các nút
  const isCompleteBtnActive =
    !isSaved &&
    (!editingBooking || hasChanges || hasPaymentChanges) &&
    !localProcessing &&
    !isProcessing;

  // In phiếu active khi: Đã lưu thành công HOẶC Đơn sửa đã khớp tiền và không thay đổi gì
  const isPrintBtnActive =
    (isSaved && (!!savedBooking || !!editingBooking)) ||
    (editingBooking && !hasChanges && isBalanceMatched);

  const renderSeatRow = (trip: PaymentItem, seat: PaymentSeat) => {
    const { price, pickup, dropoff, isPaid, isAlreadyPaid, isPriceChanged } =
      getSeatValues(
        trip.tripId,
        seat,
        trip.pickup,
        trip.dropoff,
        trip.basePrice
      );

    const isRemoved = seat.diffStatus === "removed";
    const isAdded = seat.diffStatus === "added";

    return (
      <div
        key={seat.id}
        className={`flex flex-col sm:flex-row gap-2 items-start sm:items-center transition-colors pb-2 border-b border-slate-200 last:border-0 ${
          isRemoved ? "opacity-60 rounded" : ""
        } ${isAdded ? "rounded" : ""}`}
      >
        <div className="flex items-center gap-3 w-full">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium ml-6">Số vé</label>
            <div className="relative">
              <div className="flex items-center gap-2">
                <input
                  title={
                    isAlreadyPaid
                      ? "Đã thanh toán"
                      : isRemoved
                      ? "Vé đã hủy"
                      : ""
                  }
                  type="checkbox"
                  checked={isPaid}
                  disabled={isAlreadyPaid || isRemoved}
                  onChange={() => toggleSeatPayment(trip.tripId, seat.id)}
                  className={`w-4 h-4 rounded border-indigo-700 bg-indigo-950 text-yellow-500 focus:ring-yellow-500 focus:ring-offset-indigo-950 ${
                    isAlreadyPaid || isRemoved
                      ? "opacity-50 cursor-not-allowed"
                      : "cursor-pointer"
                  }`}
                />
                <span
                  className={`flex items-center justify-center w-10 h-7 font-bold text-xs rounded border ${
                    isRemoved
                      ? "bg-red-100 text-red-700 border-red-500"
                      : isAdded
                      ? "bg-green-100 text-green-700 border-green-500"
                      : "bg-slate-50 text-slate-700 border-slate-300"
                  }`}
                >
                  {seat.label}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium ml-0.5">Điểm đón</label>
            <div className="relative">
              <Locate
                size={10}
                className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                value={pickup}
                disabled={isRemoved}
                onChange={(e) =>
                  handleOverrideChange(
                    trip.tripId,
                    seat.id,
                    "pickup",
                    e.target.value
                  )
                }
                onBlur={(e) =>
                  handleLocationBlur(
                    trip.tripId,
                    seat.id,
                    "pickup",
                    e.target.value
                  )
                }
                className={`w-full h-7 pl-5 pr-2 border bg-slate-50 text-slate-700 border-slate-300 rounded text-xs outline-none focus:ring-1  ${
                  isRemoved ? "opacity-50" : ""
                }`}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium ml-0.5">Điểm trả</label>
            <div className="relative">
              <MapPin
                size={10}
                className="absolute left-1.5 top-1/2 -translate-y-1/2 "
              />
              <input
                value={dropoff}
                disabled={isRemoved}
                onChange={(e) =>
                  handleOverrideChange(
                    trip.tripId,
                    seat.id,
                    "dropoff",
                    e.target.value
                  )
                }
                onBlur={(e) =>
                  handleLocationBlur(
                    trip.tripId,
                    seat.id,
                    "dropoff",
                    e.target.value
                  )
                }
                className={`w-full h-7 pl-5 pr-2 border bg-slate-50 text-slate-700 border-slate-300 rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500/30 ${
                  isRemoved ? "opacity-50" : ""
                }`}
              />
            </div>
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <label className="text-xs font-medium ml-0.5">
              Giá vé {isRemoved && "(Hoàn trả)"}
            </label>
            <div className="relative">
              <CurrencyInput
                value={price.toString()}
                disabled={isRemoved}
                onChange={(e) =>
                  handleOverrideChange(
                    trip.tripId,
                    seat.id,
                    "price",
                    e.target.value
                  )
                }
                className={`w-full h-7 pl-5 pr-2 border bg-slate-50 text-slate-700 border-slate-300 rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500/30 text-right font-bold ${
                  isPriceChanged ? "border-yellow-500/50 text-yellow-400" : ""
                } ${isRemoved ? "text-red-300 border-red-900/50" : ""}`}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const printableItems = useMemo(() => {
    return stableItems
      .map((trip) => ({
        ...trip,
        seats: trip.seats.filter((seat) => {
          const { price, isPaid } = getSeatValues(
            trip.tripId,
            seat,
            trip.pickup,
            trip.dropoff,
            trip.basePrice
          );
          return isPaid && price > 0;
        }),
      }))
      .filter((trip) => trip.seats.length > 0);
  }, [stableItems, seatOverrides, editingBooking]);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={
        editingBooking && editingBooking.id
          ? "Cập nhật thanh toán"
          : "Thanh toán & Xuất vé"
      }
      className="max-w-5xl bg-white text-slate-900 border-indigo-900"
      headerClassName="px-4 h-[40px] border-b border-indigo-900 flex items-center justify-between shrink-0 rounded-t-xl bg-gradient-to-r from-indigo-950 via-indigo-900 to-indigo-950 text-white text-xs font-semibold"
      footer={
        <div className="flex flex-row justify-between items-center w-full px-2 ">
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="bg-indigo-950 border-indigo-950 text-white hover:bg-indigo-900 hover:text-white h-8 px-6 text-xs font-bold min-w-25"
            >
              {isSaved ? "Đóng" : "Hủy bỏ"}
            </Button>

            <Button
              variant="outline"
              onClick={handleConfirmClick}
              disabled={!isCompleteBtnActive}
              className={`h-8 font-bold text-xs shadow-lg transition-all min-w-35 border text-white
                ${
                  !isCompleteBtnActive
                    ? "bg-slate-700 opacity-40 cursor-not-allowed border-slate-700 shadow-none"
                    : "bg-indigo-950 border-indigo-950 text-white hover:bg-indigo-900 hover:text-white shadow-slate-500/20 active:scale-95"
                }`}
            >
              {localProcessing || isProcessing
                ? "Đang xử lý..."
                : isSaved
                ? "Đã lưu"
                : "Hoàn tất"}
            </Button>
          </div>

          <BookingPrint
            items={printableItems}
            bookingForm={
              savedBooking
                ? { phone: savedBooking.passenger.phone }
                : bookingForm
            }
            paidCash={paidCash}
            paidTransfer={paidTransfer}
            finalTotal={finalTotal}
            getSeatValues={getSeatValues}
            bookingId={savedBooking?.id || editingBooking?.id}
            disabled={!isPrintBtnActive}
          />
        </div>
      }
    >
      <div className="flex flex-col md:flex-row h-full md:h-137.5">
        <div className="flex-1 overflow-y-auto p-4 bg-white">
          {stableItems.length === 0 && (
            <div className="text-center py-10 text-indigo-400 italic text-sm">
              Không có dữ liệu vé.
            </div>
          )}

          <div className="space-y-4">
            {stableItems.map((trip) => {
              const tripDate = new Date(trip.tripDate);
              return (
                <div
                  key={trip.tripId}
                  className="rounded border border-slate-200 overflow-hidden"
                >
                  <div className=" px-3 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Bus size={14} className="text-slate-900" />
                      <span className="font-bold text-xs text-slate-900">
                        {trip.route}
                      </span>
                      <span className="text-xs text-slate-900 hidden sm:inline">
                        ({trip.licensePlate || "Chưa có biển số"})
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Calendar size={12} />
                      <span>
                        Ngày {tripDate.getDate()}/{tripDate.getMonth() + 1}/
                        {tripDate.getFullYear()} - {formatLunarDate(tripDate)}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 space-y-4">
                    {/* 1. Vé Ổn Định (Kept) */}
                    {trip.seats.filter((s) => s.diffStatus === "kept").length >
                      0 && (
                      <div className="space-y-2">
                        <div className="text-[10px] font-bold  uppercase tracking-wider flex items-center gap-1.5 mb-1">
                          <CheckCircle2 size={10} />
                          Vé hiện tại
                        </div>
                        {trip.seats
                          .filter((s) => s.diffStatus === "kept")
                          .map((seat) => renderSeatRow(trip, seat))}
                      </div>
                    )}

                    {/* 2. Vé Thay Đổi (Added / Removed) */}
                    {trip.seats.filter((s) => s.diffStatus !== "kept").length >
                      0 && (
                      <div className="space-y-2 pt-2 border-t border-slate-200">
                        <div className="text-[10px] font-bold  uppercase tracking-wider flex items-center gap-1.5 mb-1">
                          <History size={10} />
                          Thay đổi (Mới / Hủy)
                        </div>
                        {trip.seats
                          .filter((s) => s.diffStatus !== "kept")
                          .map((seat) => renderSeatRow(trip, seat))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="w-full md:w-90 p-4 flex flex-col gap-4 shrink-0 border-t md:border-t-0 md:border-l border-slate-200 overflow-y-auto">
          <div className="rounded p-4 border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wider">
              <Calculator size={14} /> Tổng thanh toán
            </div>

            {editingBooking && (
              <div className="space-y-2 pb-3 border-b border-slate-200">
                <div className="flex justify-between items-center text-xs">
                  <span className=" flex items-center gap-1">
                    <History size={12} /> Đã thanh toán:
                  </span>
                  <span className="text-slate-400 decoration-slate-400 line-through decoration-1">
                    {formatCurrency(previouslyPaid)} đ
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="flex items-center gap-1">
                    <TrendingUp size={12} /> Tổng tiền mới:
                  </span>
                  <span className="font-bold ">
                    {formatCurrency(finalTotal)} đ
                  </span>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span className="text-xs font-medium">Cần thanh toán</span>
              <span className="text-xl font-bold text-slate-700 tracking-tight">
                {formatCurrency(finalTotal)}{" "}
                <span className="text-sm font-normal text-slate-700">đ</span>
              </span>
            </div>
          </div>

          <div
            className={`p-2 rounded border shadow-sm animate-in fade-in slide-in-from-top-2 flex items-center gap-3 justify-between
                 ${
                   remainingBalance > 0
                     ? "bg-amber-50/20 border-amber-700/50 text-amber-400"
                     : isBalanceMatched
                     ? "border-green-700/50 text-green-400"
                     : "border-blue-700/50 text-blue-400"
                 }
             `}
          >
            <div className="flex items-center gap-2">
              <div
                className={`p-2 rounded-full shrink-0 ${
                  remainingBalance > 0
                    ? "bg-amber-50/20 "
                    : isBalanceMatched
                    ? "bg-green-500/20 text-green-400"
                    : "bg-blue-500/20 text-blue-400"
                }`}
              >
                {remainingBalance > 0 ? (
                  <AlertCircle size={20} />
                ) : isBalanceMatched ? (
                  <CheckCircle2 size={20} />
                ) : (
                  <RotateCcw size={20} />
                )}
              </div>
              <div>
                <h4 className="text-xs font-bold">
                  {remainingBalance > 0
                    ? "Cần thu thêm"
                    : isBalanceMatched
                    ? "Đã khớp tiền"
                    : "Cần hoàn lại"}
                </h4>
                {!isBalanceMatched && (
                  <div className="text-sm font-bold">
                    {formatCurrency(Math.abs(remainingBalance))}{" "}
                    <span className="text-xs font-normal opacity-70">đ</span>
                  </div>
                )}
              </div>
            </div>

            {!isBalanceMatched && !isSaved && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleQuickSettle("cash")}
                  className="text-[10px] font-bold py-2 px-2 rounded border transition-colors flex items-center justify-center gap-1 bg-white/10 hover:bg-white/20"
                >
                  <DollarSign size={10} />{" "}
                  {remainingBalance > 0 ? "Thu TM" : "Hoàn TM"}
                </button>
                <button
                  onClick={() => handleQuickSettle("transfer")}
                  className="text-[10px] font-bold py-2 px-2 rounded border transition-colors flex items-center justify-center gap-1 bg-white/10 hover:bg-white/20"
                >
                  <CreditCard size={10} />{" "}
                  {remainingBalance > 0 ? "Thu CK" : "Hoàn CK"}
                </button>
              </div>
            )}
          </div>

          <div className="space-y-3 pt-2">
            <div className="text-xs font-bold uppercase mb-2">
              Thanh toán hiện tại
            </div>
            <div className="relative group">
              <div className="absolute top-2.5 left-3 pointer-events-none group-focus-within:text-green-500">
                <DollarSign size={16} />
              </div>
              <CurrencyInput
                name="paidCash"
                value={paidCash}
                onChange={handleMoneyChangeLocal}
                className="w-full pl-9 pr-8 py-2 border border-slate-300 rounded text-right font-bold text-sm  focus:border-green-500 focus:outline-none transition-colors"
                placeholder="0"
              />
              <span className="absolute top-3 right-3 text-[10px]  pointer-events-none font-bold">
                TM
              </span>
            </div>
            <div className="relative group">
              <div className="absolute top-2.5 left-3 pointer-events-none group-focus-within:text-slate-500">
                <CreditCard size={16} />
              </div>
              <CurrencyInput
                name="paidTransfer"
                value={paidTransfer}
                onChange={handleMoneyChangeLocal}
                className="w-full pl-9 pr-8 py-2  border border-slate-300 rounded text-right font-bold text-sm  focus:border-slate-400 focus:outline-none transition-colors"
                placeholder="0"
              />
              <span className="absolute top-3 right-3 text-[10px] pointer-events-none font-bold">
                CK
              </span>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
};
