
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
  Clock
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

// Data structure for per-seat overrides
interface SeatOverride {
  price?: number;
  pickup?: string;
  dropoff?: string;
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Updated onConfirm to return full seat details including overrides
  onConfirm: (finalTotal: number, seatOverrides: Record<string, SeatOverride>) => void;
  
  // Data Sources
  selectionBasket: { trip: BusTrip; seats: Seat[] }[];
  editingBooking?: Booking | null;
  bookingForm: { pickup: string; dropoff: string };
  
  // Payment State
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
  // Store overrides: key = "tripId_seatId"
  const [seatOverrides, setSeatOverrides] = useState<Record<string, SeatOverride>>({});

  // 1. Normalize Data into PaymentItems
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

  // 2. Helper to get effective values for a seat
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

  // --- LOGIC FROM BOOKINGFORM (Standardization) ---
  const getStandardizedLocation = (input: string) => {
    if (!input) return "";
    let value = input.trim();
    const lower = value.toLowerCase();
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

    // Auto prefix if needed
    if (!/^bx\s/i.test(value) && value.length > 2) {
      value = value.replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());
      return `${value}`;
    }
    return value.replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());
  };

  // 3. Calculate Totals
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

    return {
      totalOriginal: original,
      finalTotal: final
    };
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

      return {
        ...prev,
        [key]: {
          ...current,
          [field]: newValue
        }
      };
    });
  };

  const handleInputChange = (tripId: string, seatId: string, field: 'pickup' | 'dropoff', value: string) => {
      // Auto-capitalize first letters
      const formatted = value.replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());
      handleOverrideChange(tripId, seatId, field, formatted);
  };

  const handleInputBlur = (tripId: string, seatId: string, field: 'pickup' | 'dropoff', value: string) => {
      // Standardize on blur
      const standardized = getStandardizedLocation(value);
      if (standardized !== value) {
          handleOverrideChange(tripId, seatId, field, standardized);
      }
  };

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
        setSeatOverrides({});
    }
  }, [isOpen]);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Thanh toán & Xuất vé"
      className="max-w-5xl h-[90vh] flex flex-col"
      footer={null} 
    >
      <div className="flex flex-col h-full overflow-hidden">
        
        {/* --- BODY: SCROLLABLE LIST OF TRIPS --- */}
        <div className="flex-1 overflow-y-auto pr-2 space-y-4 pb-4 bg-slate-50/50 -mx-6 px-6 pt-4">
          {items.length === 0 && (
             <div className="text-center py-10 text-slate-400 italic">Không có dữ liệu vé cần thanh toán.</div>
          )}

          {items.map((trip) => {
            const tripDate = new Date(trip.tripDate);
            return (
              <div key={trip.tripId} className="bg-indigo-900 rounded-xl border border-indigo-800 shadow-md overflow-hidden">
                {/* Card Header */}
                <div className="bg-indigo-950/50 px-4 py-2 border-b border-indigo-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="bg-indigo-800 text-indigo-300 p-1.5 rounded-lg border border-indigo-700/50">
                      <Bus size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">{trip.route}</h4>
                      <div className="text-[10px] text-indigo-300 font-medium opacity-80">{trip.tripName}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-medium bg-indigo-950/80 px-3 py-1 rounded-full border border-indigo-800 text-indigo-300">
                    <Calendar size={12} className="text-indigo-400"/>
                    <span>{tripDate.toLocaleDateString('vi-VN')}</span>
                    <span className="text-[9px] bg-indigo-800 px-1 rounded text-white">{formatLunarDate(tripDate)}</span>
                  </div>
                </div>

                {/* Seat List (Rows) */}
                <div className="divide-y divide-indigo-800/50">
                  {trip.seats.map((seat) => {
                    const { price, pickup, dropoff, isPriceChanged } = getSeatValues(trip.tripId, seat, trip.pickup, trip.dropoff);
                    
                    return (
                      <div key={seat.id} className="p-3 hover:bg-indigo-800/30 transition-colors">
                        <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
                            
                            {/* 1. Seat Info */}
                            <div className="flex items-center gap-2 w-full md:w-auto md:min-w-[80px]">
                                <div className="w-8 h-8 rounded-lg bg-indigo-700 text-white flex items-center justify-center font-bold border border-indigo-600 shadow-sm text-xs">
                                    {seat.label}
                                </div>
                                <div className="md:hidden font-bold text-indigo-200 text-sm">Ghế {seat.label}</div>
                            </div>

                            {/* 2. Route Detail Inputs (Editable) */}
                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                                {/* PICKUP */}
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                                        <MapPin size={12} className="text-indigo-400" />
                                    </div>
                                    <input 
                                        type="text"
                                        className="w-full pl-8 pr-2 py-1.5 text-xs border border-indigo-700 rounded bg-indigo-950 text-white placeholder-indigo-500/70 focus:ring-1 focus:ring-green-500 focus:border-green-500 outline-none transition-colors"
                                        placeholder="Điểm đón"
                                        value={pickup}
                                        onChange={(e) => handleInputChange(trip.tripId, seat.id, 'pickup', e.target.value)}
                                        onBlur={(e) => handleInputBlur(trip.tripId, seat.id, 'pickup', e.target.value)}
                                    />
                                </div>

                                {/* DROPOFF */}
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                                        <Locate size={12} className="text-indigo-400" />
                                    </div>
                                    <input 
                                        type="text"
                                        className="w-full pl-8 pr-2 py-1.5 text-xs border border-indigo-700 rounded bg-indigo-950 text-white placeholder-indigo-500/70 focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none transition-colors"
                                        placeholder="Điểm trả"
                                        value={dropoff}
                                        onChange={(e) => handleInputChange(trip.tripId, seat.id, 'dropoff', e.target.value)}
                                        onBlur={(e) => handleInputBlur(trip.tripId, seat.id, 'dropoff', e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* 3. Price Override */}
                            <div className="w-full md:w-auto flex items-center justify-between md:justify-end gap-3 md:pl-3 md:border-l border-indigo-800">
                                <div className="text-right flex items-center md:block gap-2 w-full md:w-auto">
                                    <div className="text-[10px] text-indigo-400 uppercase font-bold tracking-wider mb-0.5 md:hidden">Giá vé</div>
                                    <div className="relative flex-1 md:w-28">
                                        <input 
                                            type="text"
                                            className={`w-full text-right font-bold text-sm border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-yellow-500 
                                                ${isPriceChanged 
                                                    ? 'text-orange-300 border-orange-500/50 bg-orange-950/30' 
                                                    : 'text-yellow-400 border-indigo-700 bg-indigo-950'}
                                            `}
                                            value={price.toLocaleString('vi-VN')}
                                            onChange={(e) => handleOverrideChange(trip.tripId, seat.id, 'price', e.target.value)}
                                        />
                                        <div className="absolute inset-y-0 right-7 flex items-center pointer-events-none">
                                            {isPriceChanged && <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></div>}
                                        </div>
                                        <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none text-xs text-indigo-500">đ</div>
                                    </div>
                                </div>
                            </div>

                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* --- FOOTER: SUMMARY & PAYMENT --- */}
        <div className="bg-white border-t border-slate-200 p-4 -mx-6 -mb-6 mt-auto shrink-0 space-y-4 shadow-[0_-4px_10px_-1px_rgba(0,0,0,0.05)] z-20">
           
           {/* Total Summary Bar */}
           <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="flex gap-6 text-sm">
                 <div>
                    <span className="text-slate-500 block text-xs">Tổng giá gốc</span>
                    <span className="font-bold text-slate-700">{totalOriginal.toLocaleString('vi-VN')}</span>
                 </div>
                 {finalTotal !== totalOriginal && (
                   <div className="flex items-center gap-2">
                      <ArrowRight size={14} className="text-slate-300"/>
                      <div>
                        <span className="text-slate-500 block text-xs">Sau điều chỉnh</span>
                        <span className={`font-bold ${finalTotal > totalOriginal ? 'text-orange-600' : 'text-blue-600'}`}>
                            {finalTotal.toLocaleString('vi-VN')}
                        </span>
                      </div>
                   </div>
                 )}
              </div>
              <div className="text-right">
                 <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Tổng thanh toán</span>
                 <span className="text-2xl font-bold text-indigo-700">{finalTotal.toLocaleString('vi-VN')} <span className="text-sm text-slate-400 font-medium">VNĐ</span></span>
              </div>
           </div>

           {/* Payment Inputs */}
           <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-green-600 group-focus-within:text-green-500">
                    <DollarSign size={18} />
                  </div>
                  <input
                    type="text"
                    name="paidCash"
                    value={paidCash.toLocaleString("vi-VN")}
                    onChange={onMoneyChange}
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none bg-white text-slate-900 font-bold text-lg shadow-sm text-right transition-all"
                    placeholder="0"
                  />
                  <div className="absolute -top-2.5 left-3 bg-white px-1 text-[10px] font-bold text-green-600 uppercase tracking-wide">Tiền mặt</div>
                </div>
              </div>

              <div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-blue-600 group-focus-within:text-blue-500">
                    <CreditCard size={18} />
                  </div>
                  <input
                    type="text"
                    name="paidTransfer"
                    value={paidTransfer.toLocaleString("vi-VN")}
                    onChange={onMoneyChange}
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white text-slate-900 font-bold text-lg shadow-sm text-right transition-all"
                    placeholder="0"
                  />
                  <div className="absolute -top-2.5 left-3 bg-white px-1 text-[10px] font-bold text-blue-600 uppercase tracking-wide">Chuyển khoản</div>
                </div>
              </div>
           </div>

           {/* Action Buttons */}
           <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={onClose} disabled={isProcessing} className="h-12 px-6 border-slate-300 text-slate-600 hover:bg-slate-50">
                Đóng
              </Button>
              
              <div className="flex-1 flex gap-3 justify-end">
                 <Button 
                    variant="secondary" 
                    className="h-12 bg-slate-100 text-slate-400 border border-slate-200 flex-1 hover:bg-slate-100 cursor-not-allowed"
                    disabled
                    title="Chức năng đang phát triển"
                 >
                    <Ticket size={18} className="mr-2 opacity-50"/> In vé / QR
                 </Button>

                 <Button
                    onClick={() => onConfirm(finalTotal, seatOverrides)}
                    disabled={isProcessing}
                    className={`h-12 flex-1 text-base font-bold shadow-lg shadow-green-900/10 transition-all ${
                        remaining <= 0 
                            ? 'bg-green-600 hover:bg-green-700 text-white hover:shadow-green-900/20' 
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-indigo-900/20'
                    }`}
                  >
                    {isProcessing ? (
                      "Đang xử lý..."
                    ) : (
                      <>
                        <CheckCircle2 size={20} className="mr-2" /> 
                        {remaining <= 0 ? "HOÀN TẤT" : `XÁC NHẬN (${remaining.toLocaleString('vi-VN')} đ)`}
                      </>
                    )}
                  </Button>
              </div>
           </div>
        </div>

      </div>
    </Dialog>
  );
};
