
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
  Locate
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
        <div className="flex-1 overflow-y-auto pr-2 space-y-6 pb-4 bg-slate-50/50 -mx-6 px-6">
          {items.length === 0 && (
             <div className="text-center py-10 text-slate-400 italic">Không có dữ liệu vé cần thanh toán.</div>
          )}

          {items.map((trip) => {
            const tripDate = new Date(trip.tripDate);
            return (
              <div key={trip.tripId} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-4">
                {/* Card Header */}
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 text-blue-600 p-2 rounded-lg">
                      <Bus size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">{trip.route}</h4>
                      <div className="text-xs text-slate-500 font-medium">{trip.tripName}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-medium bg-white px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 shadow-sm">
                    <Calendar size={14} className="text-slate-400"/>
                    <span>{tripDate.toLocaleDateString('vi-VN')}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300 mx-1"></span>
                    <span>{formatLunarDate(tripDate)}</span>
                  </div>
                </div>

                {/* Seat List (Rows) */}
                <div className="divide-y divide-slate-100">
                  {trip.seats.map((seat) => {
                    const { price, pickup, dropoff, isPriceChanged } = getSeatValues(trip.tripId, seat, trip.pickup, trip.dropoff);
                    
                    return (
                      <div key={seat.id} className="p-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                            
                            {/* 1. Seat Info */}
                            <div className="flex items-center gap-3 w-full md:w-auto md:min-w-[90px]">
                                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold border border-blue-100 shadow-sm text-sm">
                                    {seat.label}
                                </div>
                                <div className="md:hidden font-bold text-slate-700">Ghế {seat.label}</div>
                            </div>

                            {/* 2. Route Detail Inputs (Editable) */}
                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                                {/* PICKUP */}
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <MapPin size={14} className="text-green-600" />
                                    </div>
                                    <input 
                                        type="text"
                                        className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:ring-1 focus:ring-green-500 focus:border-green-500 outline-none bg-white text-slate-700 placeholder-slate-400 transition-colors hover:border-green-300"
                                        placeholder="Điểm đón"
                                        value={pickup}
                                        onChange={(e) => handleInputChange(trip.tripId, seat.id, 'pickup', e.target.value)}
                                        onBlur={(e) => handleInputBlur(trip.tripId, seat.id, 'pickup', e.target.value)}
                                    />
                                </div>

                                {/* DROPOFF */}
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Locate size={14} className="text-red-600" />
                                    </div>
                                    <input 
                                        type="text"
                                        className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none bg-white text-slate-700 placeholder-slate-400 transition-colors hover:border-red-300"
                                        placeholder="Điểm trả"
                                        value={dropoff}
                                        onChange={(e) => handleInputChange(trip.tripId, seat.id, 'dropoff', e.target.value)}
                                        onBlur={(e) => handleInputBlur(trip.tripId, seat.id, 'dropoff', e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* 3. Price Override */}
                            <div className="w-full md:w-auto flex items-center justify-between md:justify-end gap-3 md:pl-4 md:border-l border-slate-100">
                                <div className="text-right">
                                    <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Giá vé</div>
                                    <div className="relative w-full md:w-32">
                                        <input 
                                            type="text"
                                            className={`w-full text-right font-bold text-sm border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 
                                                ${isPriceChanged ? 'text-orange-600 border-orange-300 bg-orange-50' : 'text-slate-700 border-slate-200'}
                                            `}
                                            value={price.toLocaleString('vi-VN')}
                                            onChange={(e) => handleOverrideChange(trip.tripId, seat.id, 'price', e.target.value)}
                                        />
                                        <div className="absolute inset-y-0 right-8 flex items-center pointer-events-none">
                                            {isPriceChanged && <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></div>}
                                        </div>
                                        <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none text-xs text-slate-400">đ</div>
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
        <div className="bg-slate-50 border-t border-slate-200 p-4 -mx-6 -mb-6 mt-auto shrink-0 space-y-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
           
           {/* Total Summary Bar */}
           <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
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
                 <span className="text-slate-500 block text-xs uppercase font-bold tracking-wider">Tổng thanh toán</span>
                 <span className="text-2xl font-bold text-primary">{finalTotal.toLocaleString('vi-VN')} <span className="text-sm text-slate-400">đ</span></span>
              </div>
           </div>

           {/* Payment Inputs */}
           <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-green-600">
                    <DollarSign size={16} />
                  </div>
                  <input
                    type="text"
                    name="paidCash"
                    value={paidCash.toLocaleString("vi-VN")}
                    onChange={onMoneyChange}
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none bg-white text-slate-900 font-bold text-base shadow-sm text-right"
                    placeholder="Tiền mặt"
                  />
                  <div className="absolute -top-2.5 left-2 bg-slate-50 px-1 text-[10px] font-bold text-green-700 uppercase">Tiền mặt</div>
                </div>
              </div>

              <div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-blue-600">
                    <CreditCard size={16} />
                  </div>
                  <input
                    type="text"
                    name="paidTransfer"
                    value={paidTransfer.toLocaleString("vi-VN")}
                    onChange={onMoneyChange}
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white text-slate-900 font-bold text-base shadow-sm text-right"
                    placeholder="Chuyển khoản"
                  />
                  <div className="absolute -top-2.5 left-2 bg-slate-50 px-1 text-[10px] font-bold text-blue-700 uppercase">Chuyển khoản</div>
                </div>
              </div>
           </div>

           {/* Action Buttons */}
           <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={onClose} disabled={isProcessing} className="h-12 px-6">
                Đóng
              </Button>
              
              <div className="flex-1 flex gap-3 justify-end">
                 <Button 
                    variant="secondary" 
                    className="h-12 bg-slate-200 text-slate-700 hover:bg-slate-300 border border-slate-300 flex-1"
                    disabled
                    title="Chức năng đang phát triển"
                 >
                    <Ticket size={18} className="mr-2"/> Tạo thanh toán (Chờ)
                 </Button>

                 <Button
                    onClick={() => onConfirm(finalTotal, seatOverrides)}
                    disabled={isProcessing}
                    className={`h-12 flex-1 text-base font-bold shadow-lg shadow-green-900/10 ${
                        remaining <= 0 ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-primary hover:bg-primary/90 text-white'
                    }`}
                  >
                    {isProcessing ? (
                      "Đang xử lý..."
                    ) : (
                      <>
                        <CheckCircle2 size={18} className="mr-2" /> 
                        {remaining <= 0 ? "Đã Thanh toán" : "Xác nhận (Chưa đủ)"}
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
