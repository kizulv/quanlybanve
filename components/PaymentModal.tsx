
import React, { useState, useMemo, useEffect } from "react";
import { Dialog } from "./ui/Dialog";
import { Button } from "./ui/Button";
import { 
  CheckCircle2, 
  DollarSign, 
  CreditCard, 
  Calendar, 
  MapPin, 
  Bus,
  Ticket,
  ArrowRight,
  Locate,
  Calculator,
  Tag
} from "lucide-react";
import { BusTrip, Seat, Booking } from "../types";
import { formatLunarDate } from "../utils/dateUtils";

interface PaymentItem {
  tripId: string;
  tripName: string;
  tripDate: string;
  route: string;
  seats: Seat[];
  pickup: string;
  dropoff: string;
}

interface SeatOverride {
  price?: number;
  pickup?: string;
  dropoff?: string;
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (finalTotal: number, seatOverrides: Record<string, SeatOverride>) => void;
  selectionBasket: { trip: BusTrip; seats: Seat[] }[];
  editingBooking?: Booking | null;
  bookingForm: { pickup: string; dropoff: string };
  paidCash: number;
  paidTransfer: number;
  onMoneyChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isProcessing?: boolean;
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
}) => {
  const [seatOverrides, setSeatOverrides] = useState<Record<string, SeatOverride>>({});

  // 1. Normalize Data
  const items: PaymentItem[] = useMemo(() => {
    if (selectionBasket.length > 0) {
      return selectionBasket.map(item => ({
        tripId: item.trip.id,
        tripName: item.trip.name,
        tripDate: item.trip.departureTime,
        route: item.trip.route,
        seats: item.seats,
        pickup: bookingForm.pickup || "",
        dropoff: bookingForm.dropoff || ""
      }));
    }
    return [];
  }, [selectionBasket, bookingForm]);

  // 2. Helper to get effective values
  const getSeatValues = (tripId: string, seat: Seat, defaultPickup: string, defaultDropoff: string) => {
    const key = `${tripId}_${seat.id}`;
    const override = seatOverrides[key];
    return {
      price: override?.price !== undefined ? override.price : seat.price,
      pickup: override?.pickup !== undefined ? override.pickup : defaultPickup,
      dropoff: override?.dropoff !== undefined ? override.dropoff : defaultDropoff,
      isPriceChanged: override?.price !== undefined && override.price !== seat.price
    };
  };

  // 3. Standardize Location Logic (Matches BookingForm)
  const getStandardizedLocation = (input: string) => {
    if (!input) return "";
    let value = input.trim();
    const lower = value.toLowerCase();
    
    // Common mappings (Example - can be expanded or moved to shared util)
    const mappings: Record<string, string> = {
      "lai chau": "BX Lai Châu",
      "lai châu": "BX Lai Châu",
      "ha tinh": "BX Hà Tĩnh",
      "hà tĩnh": "BX Hà Tĩnh",
      "lao cai": "BX Lào Cai",
      vinh: "BX Vinh",
      "nghe an": "BX Vinh",
      "nghệ an": "BX Vinh",
    };
    if (mappings[lower]) return mappings[lower];

    // Auto prefix "BX" if it looks like a station but user typed quickly
    // Simple Auto Capitalize
    if (!/^bx\s/i.test(value) && value.length > 2) {
      value = value.replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());
    } else if (/^bx\s/i.test(value)) {
       // Ensure BX is uppercase
       value = value.replace(/^bx\s/i, "BX ");
       // Uppercase the rest
       value = value.replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());
    }
    
    return value;
  };

  // 4. Totals Calculation
  const { totalOriginal, finalTotal } = useMemo(() => {
    let original = 0;
    let final = 0;
    items.forEach(trip => {
      trip.seats.forEach(seat => {
        original += seat.price;
        const { price } = getSeatValues(trip.tripId, seat, trip.pickup, trip.dropoff);
        final += price;
      });
    });
    return { totalOriginal: original, finalTotal: final };
  }, [items, seatOverrides]);

  const remaining = finalTotal - paidCash - paidTransfer;

  // Handlers
  const handleOverrideChange = (tripId: string, seatId: string, field: keyof SeatOverride, value: string) => {
    const key = `${tripId}_${seatId}`;
    setSeatOverrides(prev => {
      const current = prev[key] || {};
      let newValue: string | number = value;
      if (field === 'price') {
        newValue = parseInt(value.replace(/\D/g, '') || '0', 10);
      }
      return { ...prev, [key]: { ...current, [field]: newValue } };
    });
  };

  const handleLocationBlur = (tripId: string, seatId: string, field: 'pickup' | 'dropoff', value: string) => {
      const standardized = getStandardizedLocation(value);
      if (standardized !== value) {
          handleOverrideChange(tripId, seatId, field, standardized);
      }
  };

  useEffect(() => {
    if (isOpen) setSeatOverrides({});
  }, [isOpen]);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Thanh toán & Xuất vé"
      className="max-w-5xl bg-indigo-950 text-white border-indigo-900"
      headerClassName="bg-indigo-950 border-indigo-900 text-white"
      footer={null} 
    >
      <div className="flex flex-col md:flex-row h-full md:h-[600px]">
        
        {/* --- LEFT: SCROLLABLE LIST OF SEATS (65%) --- */}
        <div className="flex-1 overflow-y-auto p-4 border-r border-indigo-900 bg-indigo-950/50">
          {items.length === 0 && (
             <div className="text-center py-10 text-indigo-400 italic text-sm">Không có dữ liệu vé.</div>
          )}

          <div className="space-y-4">
            {items.map((trip) => {
              const tripDate = new Date(trip.tripDate);
              return (
                <div key={trip.tripId} className="bg-indigo-900/40 rounded-lg border border-indigo-800 overflow-hidden">
                  {/* Trip Header */}
                  <div className="bg-indigo-900/60 px-3 py-2 border-b border-indigo-800 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Bus size={14} className="text-indigo-400" />
                      <span className="font-bold text-xs text-white">{trip.route}</span>
                      <span className="text-[10px] text-indigo-300 hidden sm:inline">({trip.tripName})</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-indigo-300">
                      <Calendar size={12} />
                      <span>{tripDate.getDate()}/{tripDate.getMonth()+1}</span>
                      <span>({formatLunarDate(tripDate).replace(' Âm Lịch', '')})</span>
                    </div>
                  </div>

                  {/* Seats List */}
                  <div className="p-2 space-y-2">
                    {trip.seats.map((seat) => {
                      const { price, pickup, dropoff, isPriceChanged } = getSeatValues(trip.tripId, seat, trip.pickup, trip.dropoff);
                      return (
                        <div key={seat.id} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-indigo-950/50 p-2 rounded border border-indigo-900/50 hover:border-indigo-700 transition-colors">
                            {/* Label */}
                            <div className="shrink-0">
                                <span className="inline-flex items-center justify-center w-8 h-7 bg-indigo-800 text-white font-bold text-xs rounded border border-indigo-700 shadow-sm">
                                    {seat.label}
                                </span>
                            </div>

                            {/* Inputs Container */}
                            <div className="flex-1 grid grid-cols-2 gap-2 w-full">
                                {/* Pickup Input */}
                                <div className="relative group">
                                    <div className="absolute left-2 top-1.5 pointer-events-none">
                                        <MapPin size={10} className="text-indigo-400 group-focus-within:text-yellow-400 transition-colors" />
                                    </div>
                                    <input 
                                        type="text"
                                        className="w-full pl-6 pr-2 py-1 text-[11px] bg-indigo-950 border border-indigo-800 rounded focus:border-yellow-400 focus:outline-none text-white placeholder-indigo-500/50 transition-colors"
                                        placeholder="Điểm đón"
                                        value={pickup}
                                        onChange={(e) => handleOverrideChange(trip.tripId, seat.id, 'pickup', e.target.value)}
                                        onBlur={(e) => handleLocationBlur(trip.tripId, seat.id, 'pickup', e.target.value)}
                                    />
                                </div>

                                {/* Dropoff Input */}
                                <div className="relative group">
                                    <div className="absolute left-2 top-1.5 pointer-events-none">
                                        <Locate size={10} className="text-indigo-400 group-focus-within:text-yellow-400 transition-colors" />
                                    </div>
                                    <input 
                                        type="text"
                                        className="w-full pl-6 pr-2 py-1 text-[11px] bg-indigo-950 border border-indigo-800 rounded focus:border-yellow-400 focus:outline-none text-white placeholder-indigo-500/50 transition-colors"
                                        placeholder="Điểm trả"
                                        value={dropoff}
                                        onChange={(e) => handleOverrideChange(trip.tripId, seat.id, 'dropoff', e.target.value)}
                                        onBlur={(e) => handleLocationBlur(trip.tripId, seat.id, 'dropoff', e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Price */}
                            <div className="w-full sm:w-28 relative shrink-0">
                                <input 
                                    type="text"
                                    className={`w-full text-right font-bold text-xs bg-indigo-950 border rounded px-2 py-1 focus:outline-none transition-colors
                                        ${isPriceChanged ? 'text-yellow-400 border-yellow-500/50 ring-1 ring-yellow-500/20' : 'text-white border-indigo-800'}
                                    `}
                                    value={price.toLocaleString('vi-VN')}
                                    onChange={(e) => handleOverrideChange(trip.tripId, seat.id, 'price', e.target.value)}
                                />
                                <span className="absolute right-8 top-1.5 text-[10px] text-indigo-500 pointer-events-none hidden sm:block">đ</span>
                                {isPriceChanged && <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse shadow-sm"></div>}
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

        {/* --- RIGHT: PAYMENT & ACTIONS (35%) --- */}
        <div className="w-full md:w-[340px] bg-indigo-900/20 p-5 flex flex-col gap-4 shrink-0 border-t md:border-t-0 md:border-l border-indigo-900 shadow-xl">
           
           {/* Summary Card */}
           <div className="bg-indigo-900/50 rounded-xl p-5 border border-indigo-800 shadow-inner">
              <div className="flex items-center gap-2 mb-4 text-indigo-300 text-xs font-bold uppercase tracking-wider">
                  <Calculator size={14} /> Tổng thanh toán
              </div>
              
              <div className="flex justify-between items-baseline mb-1">
                 <span className="text-xs text-indigo-400">Giá gốc</span>
                 <span className="text-sm text-indigo-300 line-through decoration-indigo-500">{totalOriginal.toLocaleString('vi-VN')}</span>
              </div>
              
              <div className="flex justify-between items-end border-b border-indigo-800/50 pb-4 mb-4">
                 <span className="text-xs text-indigo-400">Phải thu</span>
                 <span className="text-3xl font-bold text-yellow-400 tracking-tight">{finalTotal.toLocaleString('vi-VN')} <span className="text-sm font-normal text-yellow-400/70">đ</span></span>
              </div>

              {/* Inputs */}
              <div className="space-y-3">
                 <div className="relative group">
                    <div className="absolute top-2 left-3 text-indigo-400 pointer-events-none group-focus-within:text-green-500 transition-colors">
                        <DollarSign size={16} />
                    </div>
                    <input
                      type="text"
                      name="paidCash"
                      value={paidCash.toLocaleString("vi-VN")}
                      onChange={onMoneyChange}
                      className="w-full pl-9 pr-12 py-2 bg-indigo-950 border border-indigo-800 rounded text-right font-bold text-sm text-white focus:border-green-500 focus:outline-none transition-colors"
                    />
                    <span className="absolute top-2.5 right-3 text-[10px] text-indigo-500 pointer-events-none font-bold">TM</span>
                 </div>
                 <div className="relative group">
                    <div className="absolute top-2 left-3 text-indigo-400 pointer-events-none group-focus-within:text-blue-500 transition-colors">
                        <CreditCard size={16} />
                    </div>
                    <input
                      type="text"
                      name="paidTransfer"
                      value={paidTransfer.toLocaleString("vi-VN")}
                      onChange={onMoneyChange}
                      className="w-full pl-9 pr-12 py-2 bg-indigo-950 border border-indigo-800 rounded text-right font-bold text-sm text-white focus:border-blue-500 focus:outline-none transition-colors"
                    />
                     <span className="absolute top-2.5 right-3 text-[10px] text-indigo-500 pointer-events-none font-bold">CK</span>
                 </div>
              </div>

              {remaining > 0 ? (
                  <div className="mt-4 p-2 rounded bg-red-950/30 border border-red-900/50 text-right text-xs text-red-400 font-bold flex justify-between items-center">
                      <span>Còn thiếu:</span>
                      <span>{remaining.toLocaleString('vi-VN')} đ</span>
                  </div>
              ) : remaining < 0 ? (
                  <div className="mt-4 p-2 rounded bg-blue-950/30 border border-blue-900/50 text-right text-xs text-blue-400 font-bold flex justify-between items-center">
                      <span>Thừa tiền:</span>
                      <span>{Math.abs(remaining).toLocaleString('vi-VN')} đ</span>
                  </div>
              ) : (
                  <div className="mt-4 p-2 rounded bg-green-950/30 border border-green-900/50 text-right text-xs text-green-400 font-bold flex justify-center items-center gap-2">
                      <CheckCircle2 size={14}/> Đã đủ tiền
                  </div>
              )}
           </div>

           <div className="mt-auto space-y-3">
              <Button
                onClick={() => onConfirm(finalTotal, seatOverrides)}
                disabled={isProcessing}
                className={`w-full h-11 font-bold text-sm shadow-lg transition-all ${
                    remaining <= 0 
                    ? 'bg-green-600 hover:bg-green-500 text-white border-green-700 shadow-green-900/20' 
                    : 'bg-yellow-500 hover:bg-yellow-400 text-indigo-950 border-yellow-600 shadow-yellow-900/20'
                }`}
              >
                {isProcessing ? "Đang xử lý..." : (remaining <= 0 ? "Xác nhận thanh toán" : "Lưu công nợ")}
              </Button>
              <Button 
                variant="outline" 
                onClick={onClose} 
                className="w-full border-indigo-800 text-indigo-300 hover:bg-indigo-900 hover:text-white bg-transparent h-10 text-xs"
              >
                Hủy bỏ
              </Button>
           </div>
        </div>

      </div>
    </Dialog>
  );
};
