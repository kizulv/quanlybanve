
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
  Calculator,
  RotateCcw,
  History,
  TrendingUp,
  AlertCircle,
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
  basePrice: number;
}

interface SeatOverride {
  price?: number;
  pickup?: string;
  dropoff?: string;
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (payment: { paidCash: number; paidTransfer: number }, overrides: Record<string, SeatOverride>, noteSuffix: string) => void;
  selectionBasket: { trip: BusTrip; seats: Seat[] }[];
  editingBooking?: Booking | null;
  bookingForm: { pickup: string; dropoff: string };
  paidCash: number;
  paidTransfer: number;
  onMoneyChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
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
  initialOverrides = {},
}) => {
  const [seatOverrides, setSeatOverrides] = useState<Record<string, SeatOverride>>({});

  useEffect(() => {
    if (isOpen) setSeatOverrides(initialOverrides);
    else setSeatOverrides({});
  }, [isOpen, initialOverrides]);

  const items: PaymentItem[] = useMemo(() => {
    return selectionBasket.map(item => ({
      tripId: item.trip.id,
      tripName: item.trip.name,
      tripDate: item.trip.departureTime,
      route: item.trip.route,
      seats: item.seats,
      pickup: bookingForm.pickup || "",
      dropoff: bookingForm.dropoff || "",
      basePrice: item.trip.basePrice || 0
    }));
  }, [selectionBasket, bookingForm]);

  const getSeatValues = (tripId: string, seat: Seat, defaultPickup: string, defaultDropoff: string, tripBasePrice: number) => {
    const key = `${tripId}_${seat.id}`;
    const override = seatOverrides[key];
    
    let price = override?.price ?? seat.price;
    if (price === 0) price = tripBasePrice;

    return {
      price,
      pickup: override?.pickup ?? defaultPickup,
      dropoff: override?.dropoff ?? defaultDropoff,
      isChanged: override?.price !== undefined
    };
  };

  const finalTotal = useMemo(() => {
    let total = 0;
    items.forEach(trip => {
      trip.seats.forEach(seat => {
        total += getSeatValues(trip.tripId, seat, trip.pickup, trip.dropoff, trip.basePrice).price;
      });
    });
    return total;
  }, [items, seatOverrides]);

  const previouslyPaid = editingBooking ? ((editingBooking.payment?.paidCash || 0) + (editingBooking.payment?.paidTransfer || 0)) : 0;
  const currentPaid = paidCash + paidTransfer;
  const remaining = finalTotal - currentPaid;
  const gapFromPrevious = finalTotal - previouslyPaid;

  const handleOverride = (tripId: string, seatId: string, field: keyof SeatOverride, value: string | number) => {
    const key = `${tripId}_${seatId}`;
    setSeatOverrides(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: typeof value === 'string' && field === 'price' ? parseInt(value.replace(/\D/g, '') || '0', 10) : value }
    }));
  };

  const handleSettle = (method: 'cash' | 'transfer') => {
    const newVal = (method === 'cash' ? paidCash : paidTransfer) + remaining;
    onMoneyChange({ target: { name: method === 'cash' ? 'paidCash' : 'paidTransfer', value: newVal.toString() } } as any);
  };

  const handleConfirm = () => {
    let noteSuffix = "";
    if (remaining > 0) noteSuffix = `(Cần thu thêm: ${remaining.toLocaleString()}đ)`;
    else if (remaining < 0) noteSuffix = `(Cần hoàn lại: ${Math.abs(remaining).toLocaleString()}đ)`;

    const finalMap: Record<string, SeatOverride> = { ...seatOverrides };
    items.forEach(trip => {
      trip.seats.forEach(seat => {
        const key = `${trip.tripId}_${seat.id}`;
        const vals = getSeatValues(trip.tripId, seat, trip.pickup, trip.dropoff, trip.basePrice);
        finalMap[key] = { price: vals.price, pickup: vals.pickup, dropoff: vals.dropoff };
      });
    });

    onConfirm({ paidCash, paidTransfer }, finalMap, noteSuffix);
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Thanh toán & Xuất vé" className="max-w-5xl bg-indigo-950 text-white">
      <div className="flex flex-col md:flex-row h-[600px]">
        <div className="flex-1 overflow-y-auto p-4 border-r border-indigo-900 bg-indigo-950/50">
          <div className="space-y-4">
            {items.map(trip => {
              const date = new Date(trip.tripDate);
              return (
                <div key={trip.tripId} className="bg-indigo-900/40 rounded-lg border border-indigo-800 overflow-hidden">
                  <div className="bg-indigo-900/60 px-3 py-2 border-b border-indigo-800 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Bus size={14} className="text-indigo-400" />
                      <span className="font-bold text-xs">{trip.route}</span>
                    </div>
                    <div className="text-[10px] text-indigo-300">
                      {date.getDate()}/{date.getMonth() + 1} ({formatLunarDate(date).replace(' Âm Lịch', '')})
                    </div>
                  </div>
                  <div className="p-2 space-y-2">
                    {trip.seats.map(seat => {
                      const vals = getSeatValues(trip.tripId, seat, trip.pickup, trip.dropoff, trip.basePrice);
                      return (
                        <div key={seat.id} className="flex flex-col sm:flex-row gap-2 items-center bg-indigo-950/50 p-2 rounded border border-indigo-900/50">
                          <span className="w-8 h-7 bg-indigo-800 text-white font-bold text-xs rounded flex items-center justify-center shrink-0">{seat.label}</span>
                          <div className="flex-1 grid grid-cols-2 gap-2">
                            <div className="relative">
                              <MapPin size={10} className="absolute left-2 top-2 text-indigo-400" />
                              <input value={vals.pickup} onChange={e => handleOverride(trip.tripId, seat.id, 'pickup', e.target.value)} className="w-full pl-6 pr-2 py-1 text-[11px] bg-indigo-950 border border-indigo-800 rounded outline-none focus:border-yellow-500" placeholder="Đón" />
                            </div>
                            <div className="relative">
                              <Locate size={10} className="absolute left-2 top-2 text-indigo-400" />
                              <input value={vals.dropoff} onChange={e => handleOverride(trip.tripId, seat.id, 'dropoff', e.target.value)} className="w-full pl-6 pr-2 py-1 text-[11px] bg-indigo-950 border border-indigo-800 rounded outline-none focus:border-yellow-500" placeholder="Trả" />
                            </div>
                          </div>
                          <div className="relative shrink-0">
                            <input value={vals.price.toLocaleString()} onChange={e => handleOverride(trip.tripId, seat.id, 'price', e.target.value)} className={`w-24 text-right font-bold text-xs bg-indigo-950 border rounded px-2 py-1 outline-none ${vals.isChanged ? 'text-yellow-400 border-yellow-500' : 'text-white border-indigo-800'}`} />
                            <span className="absolute right-8 top-1.5 text-[10px] text-indigo-500">đ</span>
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

        <div className="w-[340px] bg-indigo-900/20 p-5 flex flex-col gap-4 border-l border-indigo-900">
           <div className="bg-indigo-900/50 rounded-xl p-5 border border-indigo-800 space-y-3">
              <div className="flex items-center gap-2 text-indigo-300 text-[10px] font-bold uppercase tracking-wider"><Calculator size={14} /> Tổng thanh toán</div>
              {editingBooking && (
                <div className="space-y-1 pb-2 border-b border-indigo-800/50 mb-2">
                   <div className="flex justify-between text-[11px] text-slate-400"><span>Tiền cũ:</span><span className="line-through">{editingBooking.totalPrice.toLocaleString()} đ</span></div>
                   <div className="flex justify-between text-[11px] text-yellow-500 font-bold"><span>Tiền mới:</span><span>{finalTotal.toLocaleString()} đ</span></div>
                </div>
              )}
              <div className="flex justify-between items-end">
                 <span className="text-xs text-indigo-400">Cần thu</span>
                 <span className="text-3xl font-black text-yellow-400">{finalTotal.toLocaleString()} <span className="text-xs font-normal">đ</span></span>
              </div>
           </div>

           {editingBooking && gapFromPrevious !== 0 && (
             <div className={`p-3 rounded-lg border flex items-center gap-3 ${gapFromPrevious > 0 ? 'bg-amber-950/40 border-amber-700 text-amber-100' : 'bg-blue-950/40 border-blue-700 text-blue-100'}`}>
                {gapFromPrevious > 0 ? <AlertCircle size={20}/> : <RotateCcw size={20}/>}
                <div><div className="text-[10px] font-bold uppercase">{gapFromPrevious > 0 ? 'Thu thêm' : 'Hoàn tiền'}</div><div className="text-lg font-bold">{Math.abs(gapFromPrevious).toLocaleString()} đ</div></div>
             </div>
           )}

           <div className="space-y-3">
              <div className="relative">
                 <DollarSign size={14} className="absolute left-3 top-2.5 text-indigo-400" />
                 <input name="paidCash" value={paidCash.toLocaleString()} onChange={onMoneyChange} className="w-full pl-9 pr-12 py-2 bg-indigo-950 border border-indigo-800 rounded text-right font-bold text-white focus:border-green-500 outline-none" placeholder="Tiền mặt" />
                 <span className="absolute right-3 top-2.5 text-[10px] font-bold text-indigo-500">TM</span>
              </div>
              <div className="relative">
                 <CreditCard size={14} className="absolute left-3 top-2.5 text-indigo-400" />
                 <input name="paidTransfer" value={paidTransfer.toLocaleString()} onChange={onMoneyChange} className="w-full pl-9 pr-12 py-2 bg-indigo-950 border border-indigo-800 rounded text-right font-bold text-white focus:border-blue-500 outline-none" placeholder="Chuyển khoản" />
                 <span className="absolute right-3 top-2.5 text-[10px] font-bold text-indigo-500">CK</span>
              </div>
           </div>

           <div className="flex flex-col gap-2 mt-auto">
              {remaining !== 0 && (
                <div className="grid grid-cols-2 gap-2 mb-2">
                   <Button size="sm" variant="outline" className="text-[10px] border-indigo-700 text-indigo-300" onClick={() => handleSettle('cash')}>Khớp TM</Button>
                   <Button size="sm" variant="outline" className="text-[10px] border-indigo-700 text-indigo-300" onClick={() => handleSettle('transfer')}>Khớp CK</Button>
                </div>
              )}
              <Button onClick={handleConfirm} className={`w-full h-11 font-bold ${remaining <= 0 ? 'bg-green-600 hover:bg-green-500' : 'bg-yellow-500 hover:bg-yellow-400 text-indigo-950'}`}>
                 {remaining <= 0 ? <CheckCircle2 size={16} className="mr-2"/> : <Calculator size={16} className="mr-2"/>} {remaining <= 0 ? 'Xác nhận thanh toán' : 'Lưu công nợ'}
              </Button>
              <Button variant="ghost" onClick={onClose} className="w-full text-indigo-400 hover:text-white h-9 text-xs">Quay lại</Button>
           </div>
        </div>
      </div>
    </Dialog>
  );
};
