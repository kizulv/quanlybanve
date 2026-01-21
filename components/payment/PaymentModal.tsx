import React, { useState, useMemo, useEffect } from "react";
import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";
import {
  CheckCircle2,
  CreditCard,
  Calendar,
  MapPin,
  Locate,
  Bus,
  History,
  AlertCircle,
  XCircle,
} from "lucide-react";
import {
  BusTrip,
  Seat,
  Booking,
  Bus as BusTypeData,
  SeatStatus,
} from "../../types";
import { formatLunarDate } from "../../utils/dateUtils";
import {
  getStandardizedLocation,
  formatCurrency,
  parseCurrency,
} from "../../utils/formatters";
import { CurrencyInput } from "../ui/CurrencyInput";
import { BookingPrint } from "../booking/BookingPrint";
import { useToast } from "../ui/Toast";
import { api } from "../../lib/api";
import { QrCode } from "lucide-react";
import { formatDate } from "../../utils/formatters";
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
    stableItems?: PaymentItem[],
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
  const { toast } = useToast();
  const [seatOverrides, setSeatOverrides] = useState<
    Record<string, SeatOverride>
  >({});
  const [savedBooking, setSavedBooking] = useState<Booking | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [localProcessing, setLocalProcessing] = useState(false);
  const [stableItems, setStableItems] = useState<PaymentItem[]>([]);
  const [isWaitingForPayment, setIsWaitingForPayment] = useState(false); // New state for polling
  const [isPaymentSuccessful, setIsPaymentSuccessful] = useState(false); // New state for success

  // Polling Effect
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isWaitingForPayment && isOpen && !isPaymentSuccessful) {
      interval = setInterval(async () => {
        try {
          const res = await api.qrgeneral.get();
          if (res && res.status === "success") {
            setIsWaitingForPayment(false);
            setIsPaymentSuccessful(true); // Mark as successful
            toast({
              type: "success",
              title: "Thanh toán thành công",
              message: "Đã nhận được chuyển khoản.",
            });
            // Auto complete
            handleConfirmClick();
          }
        } catch (error) {
          console.error("Polling error", error);
        }
      }, 3000);
    }

    return () => clearInterval(interval);
  }, [isWaitingForPayment, isOpen, isPaymentSuccessful]);

  // RESET QR STATES WHEN AMOUNT CHANGES
  useEffect(() => {
    if (isWaitingForPayment || isPaymentSuccessful) {
      setIsWaitingForPayment(false);
      setIsPaymentSuccessful(false);
    }
  }, [paidTransfer]);

  useEffect(() => {
    if (
      isOpen &&
      (selectionBasket.length > 0 || editingBooking) &&
      stableItems.length === 0
    ) {
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
            (item) => item.trip.id === tripId,
          );
          const bookingItem = editingBooking?.items.find(
            (item) => item.tripId === tripId,
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
              (oid) => String(oid) === String(seat.id),
            );
            allSeats.push({
              ...seat,
              diffStatus: isOriginal ? "kept" : "added",
            });
          });

          // Ghế "Removed" (có trong booking cũ nhưng không có trong basket mới)
          originalSeatIds.forEach((oid) => {
            const inBasket = basketSeats.some(
              (bs) => String(bs.id) === String(oid),
            );
            if (!inBasket) {
              const originalTicket = bookingItem?.tickets?.find(
                (t) => String(t.seatId) === String(oid),
              );

              // FIND LABEL logic
              let label = String(oid);
              // 1. Try finding in basket trip data (if available)
              if (basketItem?.trip) {
                const s = basketItem.trip.seats?.find(
                  (s) => String(s.id) === String(oid),
                );
                if (s) label = s.label;
              }
              // 2. If not, try bus config
              if (label === String(oid) && busObj?.layoutConfig?.seatLabels) {
                const mapped = busObj.layoutConfig.seatLabels[String(oid)];
                if (mapped) label = mapped;
              }

              allSeats.push({
                id: String(oid),
                label: label, // Corrected label
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
        },
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
                    s.id === String(ticket.seatId) &&
                    s.diffStatus !== "removed",
                ),
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
      setStableItems([]);
      setSeatOverrides({});
      setIsSaved(false);
      setSavedBooking(null);
      setIsWaitingForPayment(false);
      setIsPaymentSuccessful(false);
    }
  }, [isOpen, selectionBasket, buses, bookingForm, initialOverrides]);

  const getSeatValues = (
    tripId: string,
    seat: Seat,
    defaultPickup: string,
    defaultDropoff: string,
    tripBasePrice: number,
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
      const newIsPaid = !current.isPaid;

      // Lấy giá gốc của ghế
      const trip = stableItems.find((t) => t.tripId === tripId);
      const seat = trip?.seats.find((s) => s.id === seatId);
      const originalPrice = seat?.price || 0;

      return {
        ...prev,
        [key]: {
          ...current,
          isPaid: newIsPaid,
          // Nếu bỏ tích → giá về 0, nếu tích lại → khôi phục giá gốc (hoặc giá đã override)
          price: newIsPaid ? (current.price ?? originalPrice) : 0,
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
          trip.basePrice,
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
    value: string,
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

        // Reset CURRENT payments logic
        // We need to calculate what the NEW total should be (history + 0)
        // But since we don't have direct access to setPaidCash/Transfer here (only onMoneyChange)
        // We derive history first.
        const historyCash = editingBooking?.payment?.paidCash || 0;
        const historyTransfer = editingBooking?.payment?.paidTransfer || 0;

        // Reset TOTAL paid to just the history amount (implying current transaction is 0)
        onMoneyChange({
          target: { name: "paidCash", value: historyCash.toString() },
        } as any);
        onMoneyChange({
          target: { name: "paidTransfer", value: historyTransfer.toString() },
        } as any);
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
    value: string,
  ) => {
    const standardized = getStandardizedLocation(value);
    if (standardized !== value) {
      handleOverrideChange(tripId, seatId, field, standardized);
    }
  };

  const handleQuickSettle = (method: "cash" | "transfer") => {
    if (isSaved) setIsSaved(false);

    const historyAmount =
      method === "cash"
        ? editingBooking?.payment?.paidCash || 0
        : editingBooking?.payment?.paidTransfer || 0;

    const gap = remainingBalance;
    const currentTotalVal = method === "cash" ? paidCash : paidTransfer;

    // Quick settle calculates the TOTAL required.
    // gap is (FinalTotal - AllPaid).
    // NewTotal = AllPaid + gap = FinalTotal.
    // So we just add gap to the specific method's current total.

    // For refund, gap is negative.
    // newVal should be simply currentTotalVal + gap.
    // We ALLOW negative values to support cross-method refunds (e.g. Paid Cash -> Refund via Transfer).

    const newVal = currentTotalVal + gap;
    // User requirement: "Không cho hoàn tiền vượt số đã thu" -> Handled by logic check or UI validation?
    // For quick settle, let's just fill the gap.

    const event = {
      target: {
        name: method === "cash" ? "paidCash" : "paidTransfer",
        value: newVal.toString(), // Submit TOTAL amount
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
        Math.abs(remainingBalance),
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
          trip.basePrice,
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
        filteredItems,
      );
      if (result) {
        setSavedBooking(result as Booking);
        // Clean up QR data after successful confirmation
        if (isPaymentSuccessful) {
          await api.qrgeneral.delete();
        }
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
        trip.basePrice,
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
                    e.target.value,
                  )
                }
                onBlur={(e) =>
                  handleLocationBlur(
                    trip.tripId,
                    seat.id,
                    "pickup",
                    e.target.value,
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
                    e.target.value,
                  )
                }
                onBlur={(e) =>
                  handleLocationBlur(
                    trip.tripId,
                    seat.id,
                    "dropoff",
                    e.target.value,
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
                    e.target.value,
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
            trip.basePrice,
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
      className="max-w-5xl text-slate-900 border-indigo-900"
      headerClassName="px-4 h-[40px] border-b border-indigo-900 flex items-center justify-between shrink-0 rounded-t-xl bg-gradient-to-r from-indigo-950 via-indigo-900 to-indigo-950 text-white text-xs font-semibold"
      footer={
        <div className="flex flex-row justify-between items-center w-full px-2 ">
          <div className="flex gap-3">
            <Button
              variant="custom"
              onClick={onClose}
              className="bg-indigo-950 border-indigo-950 text-white hover:bg-indigo-900 hover:text-white h-8 px-6 text-xs font-bold min-w-25"
            >
              {isSaved ? "Đóng" : "Hủy bỏ"}
            </Button>

            <Button
              variant="custom"
              onClick={handleConfirmClick}
              disabled={!isCompleteBtnActive}
              className={`h-8 font-bold text-xs transition-all min-w-35 border text-white ${
                !isCompleteBtnActive
                  ? "bg-slate-700 opacity-40 cursor-not-allowed border-slate-700"
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
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
          {stableItems.length === 0 && (
            <div className="text-center py-10 text-indigo-400 italic text-sm">
              Không có dữ liệu vé.
            </div>
          )}

          <div className="bg-white space-y-4">
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
                        Ngày {formatDate(tripDate.toISOString())} -{" "}
                        {formatLunarDate(tripDate)}
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
          <div className="flex items-end justify-between gap-2 text-center bg-linear-to-r from-indigo-950 via-indigo-900 to-indigo-950 text-white px-4 py-3 rounded-md">
            <span className="font-bold uppercase">Tổng tiền</span>
            <div className="text-xl font-bold">
              {formatCurrency(finalTotal)} VNĐ
            </div>
          </div>
          <div className="rounded p-4 border border-slate-200 space-y-3">
            <div className="space-y-2">
              <div className="flex items-end justify-between gap-2 text-xs font-bold uppercase">
                <div className="flex items-center gap-2">
                  <History size={14} />
                  Đã thanh toán
                </div>
                {editingBooking && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm">
                      {formatCurrency(previouslyPaid)}
                    </span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-100 rounded p-2 flex justify-between items-center opacity-70">
                  <span className="text-slate-600 text-[10px] font-bold flex items-center gap-1">
                    TM
                  </span>
                  <span className="font-bold text-slate-700">
                    {formatCurrency(editingBooking?.payment?.paidCash || 0)}
                  </span>
                </div>
                <div className="bg-slate-100 rounded p-2 flex justify-between items-center opacity-70">
                  <span className="text-slate-600 text-[10px] font-bold flex items-center gap-1">
                    CK
                  </span>
                  <span className="font-bold text-slate-700">
                    {formatCurrency(editingBooking?.payment?.paidTransfer || 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className={`flex space-x-3`}>
            {remainingBalance > 0 ? (
              <div className="flex flex-col w-full gap-2">
                <div className="w-full flex justify-between items-end rounded-md px-4 py-3 bg-linear-to-r from-rose-900 via-rose-700 to-rose-900 text-white">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={20} />
                    <span className="text-xs font-bold">Cần thu thêm</span>
                  </div>
                  <span className="font-bold text-sm">
                    {formatCurrency(Math.abs(remainingBalance))}
                  </span>
                </div>
                <div className="">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleQuickSettle("cash")}
                      className="text-xs font-bold h-10 px-2 rounded transition-colors flex items-center justify-center gap-1  border-2 border-rose-900 text-rose-900 bg-rose-100 cursor-pointer"
                    >
                      Thu TM
                    </button>
                    <button
                      onClick={() => handleQuickSettle("transfer")}
                      className="text-xs font-bold h-10 px-2 rounded transition-colors flex items-center justify-center gap-1  border-2 border-rose-900 text-rose-900 bg-rose-100 cursor-pointer"
                    >
                      Thu CK
                    </button>
                  </div>
                </div>
              </div>
            ) : isBalanceMatched ? (
              <div className="flex flex-col w-full gap-2">
                <div className="w-full flex justify-between items-end rounded-md px-4 py-3 bg-linear-to-r from-green-900 via-green-700 to-green-900 text-white ">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={20} />
                    <span className="text-xs font-bold">Đã đủ tiền</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col w-full gap-2">
                <div className="w-full flex justify-between items-end rounded-md px-4 py-3 bg-linear-to-r from-blue-900 via-blue-700 to-blue-900 text-white ">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={20} />
                    <span className="text-xs font-bold">Cần hoàn lại</span>
                  </div>
                  <span className="font-bold">
                    {formatCurrency(Math.abs(remainingBalance))}
                  </span>
                </div>
                <div className="">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleQuickSettle("cash")}
                      className="text-xs font-bold h-10 px-2 rounded transition-colors flex items-center justify-center gap-1  border-2 border-blue-900 text-blue-900 bg-blue-100 cursor-pointer"
                    >
                      Hoàn TM
                    </button>
                    <button
                      onClick={() => handleQuickSettle("transfer")}
                      className="text-xs font-bold h-10 px-2 rounded transition-colors flex items-center justify-center gap-1  border-2 border-blue-900 text-blue-900 bg-blue-100 cursor-pointer"
                    >
                      Hoàn CK
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border border-slate-200 p-4 rounded space-y-4">
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase mb-2 flex items-center gap-2">
                <CreditCard size={14} />
                <span>
                  {remainingBalance < 0
                    ? "Hoàn tiền lần này"
                    : "Thanh toán lần này"}
                </span>
              </div>
              <div className="w-full flex gap-2">
                {/* INPUT 1: TIỀN MẶT */}
                <div className="w-1/2 relative group">
                  <CurrencyInput
                    value={
                      finalTotal - previouslyPaid < -100
                        ? Math.abs(
                            paidCash - (editingBooking?.payment?.paidCash || 0),
                          ).toString()
                        : (
                            paidCash - (editingBooking?.payment?.paidCash || 0)
                          ).toString()
                    }
                    onChange={(e) => {
                      const history = editingBooking?.payment?.paidCash || 0;
                      const inputVal = parseCurrency(e.target.value);

                      // Logic:
                      // If Refund Mode (Balance < 0 originally OR currently):
                      // Users want to enter POSITIVE refund amount.
                      // If Refunding: newTotal = history - inputVal.
                      // If Paying: newTotal = history + inputVal.

                      // How to detect mode?
                      // "Khi remainingAmount < 0: Xác định đây là nghiệp vụ hoàn tiền".

                      const isRefundContext =
                        finalTotal - previouslyPaid < -100; // Tolerance

                      let newTotal;
                      if (isRefundContext) {
                        // Refund Mode: Input is amount to REFUND (subtract from history)
                        newTotal = history - inputVal;
                      } else {
                        // Payment Mode: Input is amount to ADD
                        newTotal = history + inputVal;
                      }

                      onMoneyChange({
                        target: {
                          name: "paidCash",
                          value: newTotal.toString(),
                        },
                      } as any);
                    }}
                    placeholder="0"
                    className={`w-full h-8 px-2 text-xs bg-slate-100/70 text-slate-600 border rounded text-right font-bold focus:outline-none transition-colors border-none`}
                  />
                  <span className="absolute top-2.25 left-2 text-[10px] pointer-events-none text-slate-600 font-bold">
                    TM
                  </span>
                </div>

                {/* INPUT 2: CHUYỂN KHOẢN */}
                <div className="w-1/2 relative group">
                  <div
                    className={`absolute top-2.5 left-3 pointer-events-none ${
                      remainingBalance < 0
                        ? "text-amber-500"
                        : "group-focus-within:text-blue-500"
                    }`}
                  ></div>
                  <CurrencyInput
                    value={
                      finalTotal - previouslyPaid < -100
                        ? Math.abs(
                            paidTransfer -
                              (editingBooking?.payment?.paidTransfer || 0),
                          ).toString()
                        : (
                            paidTransfer -
                            (editingBooking?.payment?.paidTransfer || 0)
                          ).toString()
                    }
                    onChange={(e) => {
                      const history =
                        editingBooking?.payment?.paidTransfer || 0;
                      const inputVal = parseCurrency(e.target.value);

                      // Determine Mode based on BOOKING STATUS
                      const isRefundContext =
                        finalTotal - previouslyPaid < -100;

                      let newTotal;
                      if (isRefundContext) {
                        // REFUND MODE: Input is "How much to give back"
                        // Operation: SUBTRACT from History
                        newTotal = history - inputVal;
                      } else {
                        // PAYMENT MODE: Input is "How much to add"
                        // Operation: ADD to History
                        newTotal = history + inputVal;
                      }

                      onMoneyChange({
                        target: {
                          name: "paidTransfer",
                          value: newTotal.toString(),
                        },
                      } as any);
                    }}
                    placeholder="0"
                    className={`w-full h-8 px-2 text-xs bg-slate-100/70 text-slate-600 border rounded text-right font-bold focus:outline-none transition-colors border-none`}
                  />
                  <span className="absolute top-2.5 left-2 text-[10px] text-slate-600 pointer-events-none font-bold">
                    CK
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center flex-col gap-2">
            {/* Logic hiển thị nút tạo QR: Chỉ khi có phát sinh thanh toán CK > 0 trong đợt này HOẶC đã thanh toán thành công */}
            {(paidTransfer - (editingBooking?.payment?.paidTransfer || 0) > 0 ||
              isPaymentSuccessful) && (
              <>
                {!isWaitingForPayment && !isPaymentSuccessful && (
                  <button
                    onClick={async () => {
                      const currentBookingItems = stableItems
                        .map((trip) => {
                          const activeSeats = trip.seats.filter(
                            (s) => s.diffStatus !== "removed",
                          );

                          const mappedSeats = activeSeats.map((seat) => {
                            const { price, isPaid, pickup, dropoff } =
                              getSeatValues(
                                trip.tripId,
                                seat,
                                trip.pickup,
                                trip.dropoff,
                                trip.basePrice,
                              );
                            return { ...seat, price, isPaid };
                          });

                          return {
                            tripId: trip.tripId,
                            route: trip.route,
                            tripDate: trip.tripDate,
                            licensePlate: trip.licensePlate,
                            seats: mappedSeats,
                            pickup: trip.pickup,
                            dropoff: trip.dropoff,
                          };
                        })
                        .filter((trip) => trip.seats.length > 0);

                      // Calculate CURRENT transaction amount for QR
                      const historyTransfer =
                        editingBooking?.payment?.paidTransfer || 0;
                      const currentTransactionTransfer =
                        paidTransfer - historyTransfer;

                      const qrData = {
                        passenger: {
                          phone: bookingForm.phone,
                          name: "Khách lẻ",
                          note: bookingForm.note,
                        },
                        items: currentBookingItems,
                        payment: {
                          totalAmount: finalTotal,
                          paidTransfer: currentTransactionTransfer,
                          paidCash: 0,
                        },
                        timestamp: new Date().toISOString(),
                      };

                      try {
                        await api.qrgeneral.create(qrData);
                        setIsWaitingForPayment(true);
                        setIsPaymentSuccessful(false);
                        toast({
                          type: "success",
                          title: "Tạo mã QR thành công",
                          message: "Vui lòng chờ khách hàng thanh toán...",
                        });
                      } catch (e) {
                        toast({
                          type: "error",
                          title: "Lỗi",
                          message: "Không thể tạo mã QR.",
                        });
                      }
                    }}
                    className={`flex items-center justify-center gap-2 text-xs px-3 py-1.5 rounded-md h-9 border transition-colors text-white bg-indigo-700 hover:bg-indigo-800 border-indigo-900 cursor-pointer`}
                  >
                    <QrCode size={14} />
                    Tạo mã QR thanh toán
                  </button>
                )}

                {isWaitingForPayment && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setIsWaitingForPayment(false);
                        setIsPaymentSuccessful(false);
                      }}
                      className="flex items-center justify-center gap-1 text-xs px-3 py-1.5 rounded-md h-9 border transition-colors bg-red-700 text-white hover:bg-red-800 border-red-700 cursor-pointer w-full"
                    >
                      <XCircle size={14} />
                      Không thành công
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          // Explicitly delete QR data immediately as requested
                          await api.qrgeneral.delete();
                        } catch (e) {
                          console.error("Failed to delete QR data", e);
                        }
                        setIsWaitingForPayment(false);
                        setIsPaymentSuccessful(true);
                        handleConfirmClick();
                      }}
                      className="flex items-center justify-center gap-1 text-xs px-3 py-1.5 rounded-md h-9 border transition-colors text-white bg-indigo-700 hover:bg-indigo-800 border-indigo-700 cursor-pointer w-full"
                    >
                      <CheckCircle2 size={14} />
                      Chuyển thành công
                    </button>
                  </div>
                )}

                {isPaymentSuccessful && (
                  <div className="flex items-center justify-center gap-2 text-xs px-3 py-1.5 rounded-md h-9 border transition-colors bg-green-50 text-green-700 border-green-200 cursor-not-allowed w-full font-bold">
                    <CheckCircle2 size={14} />
                    Đã chuyển khoản thành công
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
};
