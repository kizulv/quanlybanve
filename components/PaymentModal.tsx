
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
  PlusCircle,
  MinusCircle,
  Ticket
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

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (finalTotal: number, adjustments: Record<string, number>) => void;
  
  // Data Sources
  selectionBasket: { trip: BusTrip; seats: Seat[] }[];
  editingBooking?: Booking | null; // Used to extract info if in edit mode
  bookingForm: { pickup: string; dropoff: string }; // Current form values
  
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
  // Store adjustments: key = "tripId_seatId", value = number (positive or negative)
  const [adjustments, setAdjustments] = useState<Record<string, number>>({});

  // 1. Normalize Data into PaymentItems
  const items: PaymentItem[] = useMemo(() => {
    // If we have a basket (New Booking or Modified Booking items)
    if (selectionBasket.length > 0) {
      return selectionBasket.map(item => ({
        tripId: item.trip.id,
        tripName: item.trip.name,
        tripDate: item.trip.departureTime,
        route: item.trip.route,
        seats: item.seats,
        pickup: bookingForm.pickup || "Chưa xác định",
        dropoff: bookingForm.dropoff || "Chưa xác định"
      }));
    }
    
    // Fallback for direct payment of existing booking without modification (rare case in this flow but good safety)
    if (editingBooking) {
       // Note: This simplified logic assumes we can reconstruct trip info. 
       // In a real app, you might need to fetch full trip details or pass them in.
       // For now, relying on selectionBasket is the primary flow.
       return [];
    }
    return [];
  }, [selectionBasket, editingBooking, bookingForm]);

  // 2. Calculate Totals
  const { baseTotal, totalAdjustment, finalTotal } = useMemo(() => {
    let base = 0;
    let adj = 0;

    items.forEach(trip => {
      trip.seats.forEach(seat => {
        base += seat.price;
        const key = `${trip.tripId}_${seat.id}`;
        adj += (adjustments[key] || 0);
      });
    });

    return {
      baseTotal: base,
      totalAdjustment: adj,
      finalTotal: base + adj
    };
  }, [items, adjustments]);

  const remaining = finalTotal - paidCash - paidTransfer;

  // Handlers
  const handleAdjustmentChange = (tripId: string, seatId: string, value: string) => {
    const num = parseInt(value.replace(/\D/g, '') || '0', 10);
    const key = `${tripId}_${seatId}`;
    setAdjustments(prev => ({
      ...prev,
      [key]: num
    }));
  };

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
        setAdjustments({});
    }
  }, [isOpen]);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Thanh toán & Xuất vé"
      className="max-w-4xl h-[90vh] flex flex-col"
      footer={null} // Custom footer
    >
      <div className="flex flex-col h-full overflow-hidden">
        
        {/* --- BODY: SCROLLABLE LIST OF TRIPS --- */}
        <div className="flex-1 overflow-y-auto pr-2 space-y-6 pb-4">
          {items.length === 0 && (
             <div className="text-center py-10 text-slate-400 italic">Không có dữ liệu vé cần thanh toán.</div>
          )}

          {items.map((trip) => {
            const tripDate = new Date(trip.tripDate);
            return (
              <div key={trip.tripId} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
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
                    const adjKey = `${trip.tripId}_${seat.id}`;
                    const currentAdj = adjustments[adjKey] || 0;
                    
                    return (
                      <div key={seat.id} className="p-4 flex flex-col sm:flex-row items-center gap-4 hover:bg-slate-50/50 transition-colors">
                        
                        {/* 1. Seat Info */}
                        <div className="flex items-center gap-3 min-w-[80px]">
                           <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold border border-blue-100">
                              {seat.label}
                           </div>
                           <div className="sm:hidden font-medium text-slate-700">Ghế {seat.label}</div>
                        </div>

                        {/* 2. Route Detail */}
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                           <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-2 py-1.5 rounded border border-slate-100">
                              <MapPin size={12} className="text-green-600 shrink-0"/> 
                              <span className="font-medium text-slate-400 mr-1">Đón:</span>
                              <span className="truncate font-bold">{trip.pickup}</span>
                           </div>
                           <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-2 py-1.5 rounded border border-slate-100">
                              <MapPin size={12} className="text-red-600 shrink-0"/> 
                              <span className="font-medium text-slate-400 mr-1">Trả:</span>
                              <span className="truncate font-bold">{trip.dropoff}</span>
                           </div>
                        </div>

                        {/* 3. Price & Adjustment */}
                        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                           <div className="text-right">
                              <div className="text-[10px] text-slate-400 uppercase font-bold">Giá vé</div>
                              <div className="font-bold text-slate-700">{seat.price.toLocaleString('vi-VN')}</div>
                           </div>
                           
                           <div className="flex items-center gap-1 text-slate-300">
                              <PlusCircle size={16} />
                           </div>

                           <div className="w-[110px]">
                              <label className="block text-[10px] text-slate-400 uppercase font-bold mb-0.5">Bổ sung</label>
                              <div className="relative">
                                <input 
                                  type="text"
                                  className={`w-full text-right text-sm font-bold border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/20 
                                    ${currentAdj > 0 ? 'text-orange-600 border-orange-200 bg-orange-50' : currentAdj < 0 ? 'text-green-600 border-green-200 bg-green-50' : 'text-slate-700 border-slate-200'}
                                  `}
                                  placeholder="0"
                                  value={currentAdj === 0 ? '' : currentAdj.toLocaleString('vi-VN')}
                                  onChange={(e) => handleAdjustmentChange(trip.tripId, seat.id, e.target.value)}
                                />
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
        <div className="bg-slate-50 border-t border-slate-200 p-4 -mx-6 -mb-6 mt-auto shrink-0 space-y-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
           
           {/* Total Summary Bar */}
           <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
              <div className="flex gap-6 text-sm">
                 <div>
                    <span className="text-slate-500 block text-xs">Tổng giá gốc</span>
                    <span className="font-bold text-slate-700">{baseTotal.toLocaleString('vi-VN')}</span>
                 </div>
                 {totalAdjustment !== 0 && (
                   <div>
                      <span className="text-slate-500 block text-xs">Tổng bổ sung</span>
                      <span className={`font-bold ${totalAdjustment > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                        {totalAdjustment > 0 ? '+' : ''}{totalAdjustment.toLocaleString('vi-VN')}
                      </span>
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
                    onClick={() => onConfirm(finalTotal, adjustments)}
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
