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
  Printer,
} from "lucide-react";
import { BusTrip, Seat, Booking } from "../types";
import { formatLunarDate } from "../utils/dateUtils";
import { getStandardizedLocation, formatCurrency, parseCurrency } from "../utils/formatters";
import { CurrencyInput } from "./ui/CurrencyInput";

interface SeatOverride {
  price?: number;
  pickup?: string;
  dropoff?: string;
}

interface PaymentItem {
  tripId: string;
  tripName: string;
  tripDate: string;
  route: string;
  licensePlate: string;
  seats: Seat[];
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
    noteSuffix?: string
  ) => void;
  selectionBasket: { trip: BusTrip; seats: Seat[] }[];
  editingBooking?: Booking | null;
  // Fixed error: Property 'phone' does not exist on type '{ pickup: string; dropoff: string; }' by adding phone and note to the bookingForm type definition
  bookingForm: { phone: string; pickup: string; dropoff: string; note: string };
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
  paidCash,
  paidTransfer,
  onMoneyChange,
  isProcessing = false,
  initialOverrides = {},
}) => {
  const [seatOverrides, setSeatOverrides] = useState<
    Record<string, SeatOverride>
  >({});

  const items: PaymentItem[] = useMemo(() => {
    if (selectionBasket.length > 0) {
      return selectionBasket.map((item) => ({
        tripId: item.trip.id,
        tripName: item.trip.name,
        tripDate: item.trip.departureTime,
        route: item.trip.route,
        licensePlate: item.trip.licensePlate,
        seats: item.seats,
        pickup: bookingForm.pickup || "",
        dropoff: bookingForm.dropoff || "",
        basePrice: item.trip.basePrice || 0,
      }));
    }
    return [];
  }, [selectionBasket, bookingForm]);

  const getSeatValues = (
    tripId: string,
    seat: Seat,
    defaultPickup: string,
    defaultDropoff: string,
    tripBasePrice: number
  ) => {
    const key = `${tripId}_${seat.id}`;
    const override = seatOverrides[key];

    let displayPrice =
      override?.price !== undefined ? override.price : seat.price;
    if (displayPrice === 0) {
      displayPrice = tripBasePrice;
    }

    return {
      price: displayPrice,
      pickup: override?.pickup !== undefined ? override.pickup : defaultPickup,
      dropoff:
        override?.dropoff !== undefined ? override.dropoff : defaultDropoff,
      isPriceChanged:
        override?.price !== undefined && override.price !== seat.price,
    };
  };

  const { totalOriginal, finalTotal } = useMemo(() => {
    let original = 0;
    let final = 0;
    items.forEach((trip) => {
      trip.seats.forEach((seat) => {
        original += seat.price;
        const { price } = getSeatValues(
          trip.tripId,
          seat,
          trip.pickup,
          trip.dropoff,
          trip.basePrice
        );
        final += price;
      });
    });
    return { totalOriginal: original, finalTotal: final };
  }, [items, seatOverrides]);

  const previouslyPaid = editingBooking
    ? (editingBooking.payment?.paidCash || 0) +
      (editingBooking.payment?.paidTransfer || 0)
    : 0;
  const currentInputTotal = paidCash + paidTransfer;
  const remainingBalance = finalTotal - currentInputTotal;
  const isBalanceMatched = currentInputTotal === finalTotal;

  const getActionInfo = () => {
    if (isProcessing)
      return {
        text: "Đang xử lý...",
        colorClass: "bg-slate-600 border-slate-700",
      };

    if (!isBalanceMatched) {
      return {
        text: "Hoàn tất",
        colorClass: "bg-slate-600 border-slate-700 text-slate-400 cursor-not-allowed",
      };
    }

    return {
      text: "Hoàn tất",
      colorClass: "bg-indigo-600 hover:bg-indigo-500 border-indigo-700 text-white shadow-indigo-500/20",
    };
  };

  const actionInfo = getActionInfo();

  const handleOverrideChange = (
    tripId: string,
    seatId: string,
    field: keyof SeatOverride,
    value: string
  ) => {
    const key = `${tripId}_${seatId}`;
    setSeatOverrides((prev) => {
      const current = prev[key] || {};
      let newValue: string | number = value;
      if (field === "price") {
        newValue = parseCurrency(value);
      }
      return { ...prev, [key]: { ...current, [field]: newValue } };
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
    const gap = remainingBalance;
    const currentVal = method === "cash" ? paidCash : paidTransfer;
    const newVal = currentVal + gap;
    const event = {
      target: {
        name: method === "cash" ? "paidCash" : "paidTransfer",
        value: newVal.toString(),
      },
    } as React.ChangeEvent<HTMLInputElement>;
    onMoneyChange(event);
  };

  const handlePrintReceipt = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const bookingDetails = items.map(trip => {
      const seatList = trip.seats.map(s => {
        const { price, pickup, dropoff } = getSeatValues(trip.tripId, s, trip.pickup, trip.dropoff, trip.basePrice);
        return `<li>Ghế ${s.label}: ${formatCurrency(price)}đ (${pickup} → ${dropoff})</li>`;
      }).join("");

      return `
        <div style="margin-bottom: 20px; border-bottom: 1px dashed #ccc; padding-bottom: 10px;">
          <p><strong>Chuyến:</strong> ${trip.route}</p>
          <p><strong>Ngày đi:</strong> ${new Date(trip.tripDate).toLocaleDateString('vi-VN')} - ${formatLunarDate(new Date(trip.tripDate))}</p>
          <p><strong>Biển số:</strong> ${trip.licensePlate}</p>
          <ul style="list-style: none; padding-left: 10px; font-size: 14px;">
            ${seatList}
          </ul>
        </div>
      `;
    }).join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Phiếu thu tạm tính</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #333; line-height: 1.5; }
            .header { text-align: center; border-bottom: 2px solid #000; margin-bottom: 20px; padding-bottom: 10px; }
            .footer { margin-top: 30px; text-align: center; font-size: 12px; font-style: italic; }
            .total-box { background: #f9f9f9; padding: 15px; border: 1px solid #ddd; margin-top: 20px; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>PHIẾU THU TẠM TÍNH</h2>
            <p>SĐT Khách: ${bookingForm.phone || "---"}</p>
          </div>
          ${bookingDetails}
          <div class="total-box">
            <p><strong>Tổng tiền:</strong> ${formatCurrency(finalTotal)} đ</p>
            <p><strong>Tiền mặt:</strong> ${formatCurrency(paidCash)} đ</p>
            <p><strong>Chuyển khoản:</strong> ${formatCurrency(paidTransfer)} đ</p>
          </div>
          <div class="footer">
            <p>Cảm ơn quý khách đã sử dụng dịch vụ!</p>
            <p>Thời gian in: ${new Date().toLocaleString('vi-VN')}</p>
          </div>
          <div class="no-print" style="margin-top: 20px; text-align: center;">
            <button onclick="window.print()" style="padding: 10px 20px; cursor: pointer; background: #000; color: #fff; border: none; border-radius: 5px;">In phiếu này</button>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleConfirmClick = () => {
    if (!isBalanceMatched) return;

    let noteSuffix = "";
    if (remainingBalance > 0) {
      noteSuffix = `(Cần thu thêm: ${formatCurrency(remainingBalance)}đ)`;
    } else if (remainingBalance < 0) {
      noteSuffix = `(Cần hoàn lại: ${formatCurrency(Math.abs(remainingBalance))}đ)`;
    }

    const finalOverrides: Record<string, SeatOverride> = { ...seatOverrides };
    items.forEach((trip) => {
      trip.seats.forEach((seat) => {
        const key = `${trip.tripId}_${seat.id}`;
        const { price } = getSeatValues(
          trip.tripId,
          seat,
          trip.pickup,
          trip.dropoff,
          trip.basePrice
        );
        if (!finalOverrides[key]) finalOverrides[key] = {};
        finalOverrides[key].price = price;
      });
    });

    onConfirm(finalTotal, finalOverrides, noteSuffix);
  };

  useEffect(() => {
    if (isOpen) {
      setSeatOverrides(initialOverrides);
    } else {
      setSeatOverrides({});
    }
  }, [isOpen, initialOverrides]);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={editingBooking ? "Cập nhật thanh toán" : "Thanh toán & Xuất vé"}
      className="max-w-5xl bg-indigo-950 text-white border-indigo-900"
      headerClassName="bg-indigo-950 border-indigo-900 text-white"
      footer={null}
    >
      <div className="flex flex-col md:flex-row h-full md:h-[600px]">
        <div className="flex-1 overflow-y-auto p-4 bg-indigo-950/50">
          {items.length === 0 && (
            <div className="text-center py-10 text-indigo-400 italic text-sm">
              Không có dữ liệu vé.
            </div>
          )}

          <div className="space-y-4">
            {items.map((trip) => {
              const tripDate = new Date(trip.tripDate);
              return (
                <div
                  key={trip.tripId}
                  className="bg-indigo-900/40 rounded-lg border border-indigo-800 overflow-hidden"
                >
                  <div className="bg-indigo-900/60 px-3 py-2 border-b border-indigo-800 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Bus size={14} className="text-indigo-400" />
                      <span className="font-bold text-xs text-white">
                        {trip.route}
                      </span>
                      <span className="text-[10px] text-indigo-300 hidden sm:inline">
                        ({trip.licensePlate || "Chưa có biển số"})
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-indigo-300">
                      <Calendar size={12} />
                      <span>
                        Ngày {tripDate.getDate()}/{tripDate.getMonth() + 1}/
                        {tripDate.getFullYear()} - {formatLunarDate(tripDate)}
                      </span>
                    </div>
                  </div>

                  <div className="p-2 space-y-2">
                    {trip.seats.map((seat) => {
                      const { price, pickup, dropoff, isPriceChanged } =
                        getSeatValues(
                          trip.tripId,
                          seat,
                          trip.pickup,
                          trip.dropoff,
                          trip.basePrice
                        );
                      return (
                        <div
                          key={seat.id}
                          className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-indigo-950/50 p-2 rounded border border-indigo-900/50 hover:border-indigo-700 transition-colors"
                        >
                          <div className="shrink-0">
                            <span className="inline-flex items-center justify-center w-12 h-[24.5px] bg-indigo-800 text-white font-bold text-xs rounded border border-indigo-700 shadow-sm">
                              {seat.label}
                            </span>
                          </div>

                          <div className="flex-1 grid grid-cols-2 gap-2 w-full">
                            <div className="relative group">
                              <div className="absolute left-2 top-[9px] pointer-events-none">
                                <MapPin
                                  size={10}
                                  className="text-indigo-400 group-focus-within:text-yellow-400 transition-colors"
                                />
                              </div>
                              <input
                                type="text"
                                className="w-full pl-6 pr-2 py-1 text-[11px] bg-indigo-950 border border-indigo-800 rounded focus:border-yellow-400 focus:outline-none text-white placeholder-indigo-500/50 transition-colors"
                                placeholder="Điểm đón"
                                value={pickup}
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
                              />
                            </div>

                            <div className="relative group">
                              <div className="absolute left-2 top-[9px] pointer-events-none">
                                <Locate
                                  size={10}
                                  className="text-indigo-400 group-focus-within:text-yellow-400 transition-colors"
                                />
                              </div>
                              <input
                                type="text"
                                className="w-full pl-6 pr-2 py-1 text-[11px] bg-indigo-950 border border-indigo-800 rounded focus:border-yellow-400 focus:outline-none text-white placeholder-indigo-500/50 transition-colors "
                                placeholder="Điểm trả"
                                value={dropoff}
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
                              />
                            </div>
                          </div>

                          <div className="w-full sm:w-28 relative shrink-0">
                            <CurrencyInput
                              title="Giá vé"
                              className={`w-full text-right font-bold text-xs bg-indigo-950 border rounded px-2 py-1 pr-3 focus:outline-none transition-colors ${
                                isPriceChanged || seat.price === 0
                                  ? "text-yellow-400 border-yellow-500/50 ring-1 ring-yellow-500/20"
                                  : "text-white border-indigo-800"
                              }`}
                              value={price}
                              onChange={(e) =>
                                handleOverrideChange(
                                  trip.tripId,
                                  seat.id,
                                  "price",
                                  e.target.value
                                )
                              }
                            />
                            <span
                              className={`absolute right-1 top-[7px] text-[10px] pointer-events-none hidden sm:block  ${
                                isPriceChanged || seat.price === 0
                                  ? "text-yellow-400 font-semibold"
                                  : "text-white"
                              }`}
                            >
                              đ
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="w-full md:w-[360px] bg-indigo-900/20 p-4 flex flex-col gap-4 shrink-0 border-t md:border-t-0 border-indigo-900 shadow-xl overflow-y-auto">
          <div className="bg-indigo-900/50 rounded-xl p-4 border border-indigo-800 shadow-inner space-y-3">
            <div className="flex items-center gap-2 mb-2 text-indigo-300 text-xs font-bold uppercase tracking-wider">
              <Calculator size={14} /> Tổng thanh toán
            </div>

            {editingBooking && (
              <div className="space-y-2 pb-3 border-b border-indigo-800/50">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-indigo-400 flex items-center gap-1">
                    <History size={12} /> Tổng tiền cũ:
                  </span>
                  <span className="text-indigo-300 decoration-slate-500 line-through decoration-1">
                    {formatCurrency(previouslyPaid)} đ
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-yellow-500 flex items-center gap-1">
                    <TrendingUp size={12} /> Tổng tiền mới:
                  </span>
                  <span className="font-bold text-yellow-400">
                    {formatCurrency(finalTotal)} đ
                  </span>
                </div>
              </div>
            )}

            <div className="flex justify-between items-end">
              <span className="text-xs text-indigo-400 font-medium">
                Cần thanh toán
              </span>
              <span className="text-3xl font-bold text-yellow-400 tracking-tight">
                {formatCurrency(finalTotal)}{" "}
                <span className="text-sm font-normal text-yellow-400/70">
                  đ
                </span>
              </span>
            </div>
          </div>

          <div
            className={`p-4 rounded-xl border shadow-sm animate-in fade-in slide-in-from-top-2 flex flex-col gap-3
                 ${
                   remainingBalance > 0
                     ? "bg-amber-950/40 border-amber-700/50 text-amber-100"
                     : isBalanceMatched
                     ? "bg-green-950/40 border-green-700/50 text-green-100"
                     : "bg-blue-950/40 border-blue-700/50 text-blue-100"
                 }
             `}
          >
            <div className="flex items-start gap-3">
              <div
                className={`p-2 rounded-full shrink-0 ${
                  remainingBalance > 0
                    ? "bg-amber-500/20 text-amber-400"
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
                <h4 className="font-bold text-sm">
                  {remainingBalance > 0
                    ? "Cần thu thêm"
                    : isBalanceMatched
                    ? "Đã khớp tiền"
                    : "Cần hoàn lại"}
                </h4>
                <div className="text-2xl font-bold mt-1">
                  {formatCurrency(Math.abs(remainingBalance))}{" "}
                  <span className="text-xs font-normal opacity-70">đ</span>
                </div>
              </div>
            </div>

            {!isBalanceMatched && (
              <div className="grid grid-cols-2 gap-2 mt-1">
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
            <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2">
              Thanh toán hiện tại
            </div>
            <div className="relative group">
              <div className="absolute top-2 left-3 text-indigo-400 pointer-events-none group-focus-within:text-green-500">
                <DollarSign size={16} />
              </div>
              <CurrencyInput
                name="paidCash"
                value={paidCash}
                onChange={onMoneyChange}
                className="w-full pl-9 pr-12 py-2 bg-indigo-950 border border-indigo-800 rounded text-right font-bold text-sm text-white focus:border-green-500 focus:outline-none transition-colors"
                placeholder="0"
              />
              <span className="absolute top-2.5 right-3 text-[10px] text-indigo-500 pointer-events-none font-bold">
                TM
              </span>
            </div>
            <div className="relative group">
              <div className="absolute top-2 left-3 text-indigo-400 pointer-events-none group-focus-within:text-blue-500">
                <CreditCard size={16} />
              </div>
              <CurrencyInput
                name="paidTransfer"
                value={paidTransfer}
                onChange={onMoneyChange}
                className="w-full pl-9 pr-12 py-2 bg-indigo-950 border border-indigo-800 rounded text-right font-bold text-sm text-white focus:border-blue-500 focus:outline-none transition-colors"
                placeholder="0"
              />
              <span className="absolute top-2.5 right-3 text-[10px] text-indigo-500 pointer-events-none font-bold">
                CK
              </span>
            </div>
          </div>

          <div className="mt-auto pt-4 border-t border-indigo-900/50">
            <div className="flex flex-row gap-2">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1 border-indigo-800 text-indigo-300 hover:bg-indigo-900 hover:text-white bg-transparent h-11 text-xs font-bold"
              >
                Hủy bỏ
              </Button>
              <Button
                variant="outline"
                onClick={handlePrintReceipt}
                className="flex-1 border-indigo-700 text-indigo-100 hover:bg-indigo-800 bg-indigo-900/40 h-11 text-xs font-bold flex items-center justify-center gap-2"
              >
                <Printer size={16} />
                In phiếu
              </Button>
              <Button
                onClick={handleConfirmClick}
                disabled={isProcessing || !isBalanceMatched}
                className={`flex-1 h-11 font-bold text-sm shadow-lg transition-all ${actionInfo.colorClass}`}
              >
                {actionInfo.text}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
};
