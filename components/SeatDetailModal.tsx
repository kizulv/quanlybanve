
import React, { useState, useEffect, useMemo } from "react";
import { Dialog } from "./ui/Dialog";
import { Button } from "./ui/Button";
import { Booking, Seat, Passenger, SeatStatus } from "../types";
// Added missing CheckCircle2 import
import {
  Save,
  MapPin,
  Locate,
  Notebook,
  Phone,
  History,
  X,
  Clock,
  ArrowRight,
  AlertCircle,
  Lock,
  CreditCard,
  Banknote,
  DollarSign,
  ShieldCheck,
  RotateCcw,
  User,
  Calculator,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";
import { formatPhoneNumber, getStandardizedLocation } from "../utils/formatters";

interface SeatDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  seat: Seat | null;
  bookings: Booking[]; 
  onSave: (passenger: Passenger, extraAction?: { action: 'PAY' | 'REFUND', payment?: { paidCash: number, paidTransfer: number } }) => Promise<void>;
}

export const SeatDetailModal: React.FC<SeatDetailModalProps> = ({
  isOpen,
  onClose,
  booking,
  seat,
  bookings,
  onSave,
}) => {
  const [form, setForm] = useState({
    phone: "",
    pickup: "",
    dropoff: "",
    note: "",
    name: "",
  });
  
  const [paymentInput, setPaymentInput] = useState({
      paidCash: 0,
      paidTransfer: 0
  });

  const [showHistory, setShowHistory] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Lấy thông tin giá vé hiện tại của ghế
  const seatPrice = useMemo(() => {
    if (!booking || !seat) return 0;
    const item = booking.items.find(i => i.seatIds.includes(seat.id));
    const ticket = item?.tickets?.find(t => t.seatId === seat.id);
    return ticket?.price || seat.price || 0;
  }, [booking, seat]);

  useEffect(() => {
    if (isOpen) {
        if (booking && seat) {
          let initialNote = "";
          let initialPickup = booking.passenger.pickupPoint || "";
          let initialDropoff = booking.passenger.dropoffPoint || "";
          
          const bookingItem = booking.items.find(i => i.seatIds.includes(seat.id));
          if (bookingItem && bookingItem.tickets) {
              const ticket = bookingItem.tickets.find(t => t.seatId === seat.id);
              if (ticket) {
                  initialNote = ticket.note !== undefined && ticket.note !== null ? ticket.note : (booking.passenger.note || "");
                  initialPickup = ticket.pickup || initialPickup;
                  initialDropoff = ticket.dropoff || initialDropoff;
              }
          } else {
              initialNote = booking.passenger.note || "";
          }

          setForm({
            phone: formatPhoneNumber(booking.passenger.phone),
            pickup: initialPickup,
            dropoff: initialDropoff,
            note: initialNote,
            name: booking.passenger.name || "Khách lẻ"
          });
          
          // Mặc định điền tiền mặt bằng giá vé nếu chưa thanh toán
          if (seat.status === SeatStatus.BOOKED) {
              setPaymentInput({ paidCash: seatPrice, paidTransfer: 0 });
          } else {
              setPaymentInput({ paidCash: 0, paidTransfer: 0 });
          }
        } else if (seat) {
            setForm({
                phone: "",
                pickup: "",
                dropoff: "",
                note: seat.note || "",
                name: ""
            });
        }
      setShowHistory(false);
    }
  }, [isOpen, booking, seat, seatPrice]);

  const historyMatches = useMemo(() => {
    if (!form.phone) return [];
    const cleanInput = form.phone.replace(/\D/g, "");
    if (cleanInput.length < 3) return [];
    return bookings.filter((b) =>
      b.passenger.phone.replace(/\D/g, "").includes(cleanInput)
    );
  }, [bookings, form.phone]);

  const passengerHistory = useMemo(() => {
    const uniqueRoutes = new Map<string, { pickup: string; dropoff: string; phone: string; lastDate: string }>();
    historyMatches.forEach((b) => {
      const pickup = b.passenger.pickupPoint || "";
      const dropoff = b.passenger.dropoffPoint || "";
      if (!pickup && !dropoff) return;
      const key = `${pickup.toLowerCase().trim()}|${dropoff.toLowerCase().trim()}`;
      const existing = uniqueRoutes.get(key);
      if (!existing || new Date(b.createdAt) > new Date(existing.lastDate)) {
        uniqueRoutes.set(key, { pickup, dropoff, phone: formatPhoneNumber(b.passenger.phone), lastDate: b.createdAt });
      }
    });
    return Array.from(uniqueRoutes.values()).sort((a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime()).slice(0, 5);
  }, [historyMatches]);

  const handleMoneyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setPaymentInput(prev => ({
          ...prev,
          [name]: parseInt(value.replace(/\D/g, "") || "0", 10)
      }));
  };

  const handleSaveOnly = async () => {
      setIsSaving(true);
      try {
          await onSave({ ...form, phone: form.phone.replace(/\D/g, "") });
      } finally { setIsSaving(false); }
  };

  const handlePaySeat = async () => {
      if ((paymentInput.paidCash + paymentInput.paidTransfer) === 0) return;
      setIsSaving(true);
      try {
          await onSave({ ...form, phone: form.phone.replace(/\D/g, "") }, { action: 'PAY', payment: paymentInput });
      } finally { setIsSaving(false); }
  };

  const handleRefundSeat = async () => {
      setIsSaving(true);
      try {
          await onSave({ ...form, phone: form.phone.replace(/\D/g, "") }, { action: 'REFUND' });
      } finally { setIsSaving(false); }
  };

  if (!seat) return null;

  const isSold = seat.status === SeatStatus.SOLD;
  const isBooked = seat.status === SeatStatus.BOOKED;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Chi tiết ghế ${seat.label}`}
      className="max-w-4xl bg-indigo-950 text-white border-indigo-900"
      headerClassName="bg-indigo-950 border-indigo-900 text-white"
    >
      <div className="flex flex-col md:flex-row h-full md:h-[520px]">
        {/* LEFT: Customer Info */}
        <div className="flex-1 overflow-y-auto p-5 border-r border-indigo-900 bg-indigo-950/50 space-y-4">
            <div className="flex items-center gap-3 mb-2">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg border shadow-sm
                    ${isSold ? 'bg-green-600 border-green-500' : isBooked ? 'bg-yellow-500 text-indigo-950 border-yellow-400' : 'bg-indigo-800 border-indigo-700'}
                `}>
                    {seat.label}
                </div>
                <div>
                    <h3 className="font-bold text-slate-100 flex items-center gap-2">
                        {form.name || "Khách lẻ"} 
                        {isSold && <ShieldCheck size={14} className="text-green-400"/>}
                    </h3>
                    <p className="text-xs text-indigo-400 font-medium">
                        {isSold ? 'Đã thanh toán (Sold)' : isBooked ? 'Đã đặt chỗ (Booked)' : 'Đang giữ (Held)'}
                    </p>
                </div>
            </div>

            <div className="space-y-3 pt-2">
                <div className="relative group">
                    <div className="absolute left-3 top-2.5 pointer-events-none text-indigo-400 group-focus-within:text-yellow-400 transition-colors">
                        <User size={16} />
                    </div>
                    <input 
                        className="w-full pl-10 pr-3 py-2 bg-indigo-900/50 border border-indigo-800 rounded-lg focus:border-yellow-400 focus:outline-none text-sm text-white placeholder-indigo-500"
                        placeholder="Họ tên khách hàng"
                        value={form.name}
                        onChange={e => setForm({...form, name: e.target.value})}
                    />
                </div>

                <div className="relative">
                    <div className="absolute left-3 top-2.5 pointer-events-none text-indigo-400">
                        <Phone size={16} />
                    </div>
                    <input 
                        className="w-full pl-10 pr-3 py-2 bg-indigo-900/50 border border-indigo-800 rounded-lg focus:border-yellow-400 focus:outline-none text-sm text-white placeholder-indigo-500"
                        placeholder="Số điện thoại"
                        value={form.phone}
                        onChange={e => { setForm({...form, phone: formatPhoneNumber(e.target.value)}); setShowHistory(true); }}
                        onFocus={() => form.phone.length >= 3 && setShowHistory(true)}
                        onBlur={() => setTimeout(() => setShowHistory(false), 200)}
                    />
                    {showHistory && passengerHistory.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95">
                            {passengerHistory.map((item, idx) => (
                                <div key={idx} onMouseDown={() => {setForm({...form, phone: item.phone, pickup: item.pickup, dropoff: item.dropoff}); setShowHistory(false);}} className="px-3 py-2 hover:bg-indigo-50 cursor-pointer border-b border-slate-50 last:border-0">
                                    <div className="flex justify-between items-start"><span className="text-xs font-bold text-indigo-700">{item.phone}</span></div>
                                    <div className="text-[10px] text-slate-500 truncate">{item.pickup} → {item.dropoff}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                        <div className="absolute left-3 top-2.5 pointer-events-none text-indigo-400">
                            <MapPin size={16} />
                        </div>
                        <input 
                            className="w-full pl-10 pr-3 py-2 bg-indigo-900/50 border border-indigo-800 rounded-lg focus:border-yellow-400 focus:outline-none text-sm text-white placeholder-indigo-500"
                            placeholder="Điểm đón"
                            value={form.pickup}
                            onChange={e => setForm({...form, pickup: e.target.value})}
                            onBlur={() => setForm(f => ({...f, pickup: getStandardizedLocation(f.pickup)}))}
                        />
                    </div>
                    <div className="relative">
                        <div className="absolute left-3 top-2.5 pointer-events-none text-indigo-400">
                            <Locate size={16} />
                        </div>
                        <input 
                            className="w-full pl-10 pr-3 py-2 bg-indigo-900/50 border border-indigo-800 rounded-lg focus:border-yellow-400 focus:outline-none text-sm text-white placeholder-indigo-500"
                            placeholder="Điểm trả"
                            value={form.dropoff}
                            onChange={e => setForm({...form, dropoff: e.target.value})}
                            onBlur={() => setForm(f => ({...f, dropoff: getStandardizedLocation(f.dropoff)}))}
                        />
                    </div>
                </div>

                <div className="relative">
                    <div className="absolute left-3 top-2.5 pointer-events-none text-indigo-400">
                        <Notebook size={16} />
                    </div>
                    <textarea 
                        className="w-full pl-10 pr-3 py-2 bg-indigo-900/50 border border-indigo-800 rounded-lg focus:border-yellow-400 focus:outline-none text-sm text-white placeholder-indigo-500 h-24 resize-none"
                        placeholder="Ghi chú riêng cho ghế này..."
                        value={form.note}
                        onChange={e => setForm({...form, note: e.target.value})}
                    />
                </div>
            </div>

            <Button onClick={handleSaveOnly} disabled={isSaving} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-11 border-b-4 border-indigo-800 active:border-b-0 active:mt-1 transition-all">
                <Save size={18} className="mr-2"/> Cập nhật thông tin
            </Button>
        </div>

        {/* RIGHT: Financial Actions */}
        <div className="w-full md:w-[320px] bg-indigo-900/30 p-5 flex flex-col gap-4 border-t md:border-t-0 md:border-l border-indigo-900 shadow-xl overflow-y-auto">
            <div className="bg-indigo-900/60 rounded-xl p-4 border border-indigo-800 space-y-3">
                <div className="flex items-center gap-2 text-indigo-300 text-[10px] font-black uppercase tracking-widest">
                    <Calculator size={14} /> Giá vé niêm yết
                </div>
                <div className="text-3xl font-black text-yellow-400 tracking-tight">
                    {seatPrice.toLocaleString('vi-VN')} <span className="text-xs font-normal opacity-70">đ</span>
                </div>
            </div>

            {isBooked && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="text-xs font-bold text-indigo-300 uppercase tracking-wider px-1 flex items-center gap-2">
                        <CreditCard size={14} className="text-emerald-400"/> Thanh toán riêng ghế này
                    </div>
                    
                    <div className="space-y-2.5">
                        <div className="relative">
                            <div className="absolute left-3 top-2.5 text-indigo-400">
                                <DollarSign size={16} />
                            </div>
                            <input 
                                name="paidCash"
                                className="w-full pl-10 pr-10 py-2 bg-indigo-950 border border-indigo-800 rounded-lg text-right font-black text-sm text-white focus:border-green-500 focus:outline-none transition-colors"
                                value={paymentInput.paidCash.toLocaleString('vi-VN')}
                                onChange={handleMoneyChange}
                            />
                            <span className="absolute right-3 top-2.5 text-[9px] font-black text-indigo-500">TM</span>
                        </div>
                        <div className="relative">
                            <div className="absolute left-3 top-2.5 text-indigo-400">
                                <CreditCard size={16} />
                            </div>
                            <input 
                                name="paidTransfer"
                                className="w-full pl-10 pr-10 py-2 bg-indigo-950 border border-indigo-800 rounded-lg text-right font-black text-sm text-white focus:border-blue-500 focus:outline-none transition-colors"
                                value={paymentInput.paidTransfer.toLocaleString('vi-VN')}
                                onChange={handleMoneyChange}
                            />
                            <span className="absolute right-3 top-2.5 text-[9px] font-black text-indigo-500">CK</span>
                        </div>
                    </div>

                    <Button onClick={handlePaySeat} disabled={isSaving || (paymentInput.paidCash + paymentInput.paidTransfer) === 0} className="w-full bg-green-600 hover:bg-green-500 text-white font-black uppercase text-xs h-11 shadow-lg shadow-green-900/20">
                        {isSaving ? <Loader2 className="animate-spin mr-2"/> : <CheckCircle2 size={16} className="mr-2"/>}
                        Xác nhận thanh toán
                    </Button>
                </div>
            )}

            {isSold && (
                <div className="bg-red-950/20 border border-red-900/30 rounded-xl p-4 space-y-4 animate-in fade-in zoom-in-95 duration-300">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-red-500/20 rounded-lg text-red-400">
                            <AlertTriangle size={20}/>
                        </div>
                        <div>
                            <h4 className="font-bold text-sm text-red-200">Ghế đã thanh toán</h4>
                            <p className="text-[10px] text-red-400/80 leading-relaxed mt-1">
                                Thực hiện hoàn vé sẽ trả lại tiền cho khách và giải phóng ghế về trạng thái trống.
                            </p>
                        </div>
                    </div>
                    
                    <Button onClick={handleRefundSeat} disabled={isSaving} className="w-full bg-red-600 hover:bg-red-500 text-white font-black uppercase text-xs h-11 border-b-4 border-red-800 active:border-b-0 active:mt-1 transition-all">
                        <RotateCcw size={16} className="mr-2"/> Hoàn vé & Hủy ghế
                    </Button>
                </div>
            )}

            <div className="mt-auto pt-4 border-t border-indigo-900/50">
                <Button variant="outline" onClick={onClose} className="w-full border-indigo-800 text-indigo-400 hover:bg-indigo-900 hover:text-white bg-transparent h-10 text-xs font-bold">
                    Hủy bỏ
                </Button>
            </div>
        </div>
      </div>
    </Dialog>
  );
};

const Loader2 = ({className}: {className?: string}) => (
    <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);
