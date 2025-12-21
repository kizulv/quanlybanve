
import React, { useState, useMemo } from 'react';
import { BusTrip, Seat, Booking, SeatStatus, BusType } from '../types';
import { SeatMap } from './SeatMap';
import { 
  BusFront, 
  CheckCircle2,
  Loader2,
  ArrowLeftRight,
  RefreshCw,
  ArrowRight,
  ShoppingCart,
  Save,
  X,
  Repeat,
  ChevronRight,
  ChevronLeft,
  Info,
  // Added Trash2 import
  Trash2
} from 'lucide-react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { useToast } from './ui/Toast';
import { api } from '../lib/api';

interface SeatTransferProps {
  trips: BusTrip[];
  bookings: Booking[];
  selectedDate: Date;
  onRefresh: () => Promise<void>;
}

interface PendingTransfer {
  id: string;
  bookingId: string;
  phone: string;
  sourceTripId: string;
  targetTripId: string;
  sourceLabel: string;
  targetLabel: string;
  sourceSeatId: string;
  targetSeatId: string;
  posDesc: string;
  isSwap: boolean;
  swapPhone?: string;
}

export const SeatTransfer: React.FC<SeatTransferProps> = ({ trips, bookings, selectedDate, onRefresh }) => {
  const { toast } = useToast();
  const [trip1Id, setTrip1Id] = useState<string>('');
  const [trip2Id, setTrip2Id] = useState<string>('');
  
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedFromTripId, setSelectedFromTripId] = useState<string | null>(null);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  
  const [transferQueue, setTransferQueue] = useState<PendingTransfer[]>([]);
  const [showQueue, setShowQueue] = useState(false);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const availableTrips = useMemo(() => {
    return trips.filter(t => {
      const tripDate = new Date(t.departureTime.split(' ')[0]);
      return tripDate.toDateString() === selectedDate.toDateString();
    });
  }, [trips, selectedDate]);

  const trip1 = availableTrips.find(t => t.id === trip1Id);
  const trip2 = availableTrips.find(t => t.id === trip2Id);

  const sourceTrip = selectedFromTripId === trip1Id ? trip1 : trip2;
  const targetTrip = selectedFromTripId === trip1Id ? trip2 : trip1;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setIsRefreshing(false);
    toast({ type: 'info', title: 'Đã cập nhật', message: 'Dữ liệu mới nhất đã được đồng bộ.' });
  };

  const getPositionDesc = (s: Seat | undefined) => {
    if (!s) return 'N/A';
    if (s.isFloorSeat) return `Sàn-${(s.row ?? 0) + 1}`;
    const isBench = (s.row ?? 0) >= 6 && !s.isFloorSeat;
    return `T${s.floor}-${isBench ? 'Băng5' : 'H' + ((s.row ?? 0) + 1)}`;
  };

  const transferValidation = useMemo(() => {
    if (!selectedBooking || !targetTrip || !sourceTrip || selectedSeatIds.length === 0) return null;

    const results = selectedSeatIds.map(seatId => {
      const sourceSeat = sourceTrip.seats.find(s => s.id === seatId);
      if (!sourceSeat) return { sourceSeatId: seatId, isValid: false, sourceLabel: '?', targetSeatId: '', posDesc: '?' };

      const targetSeatByPos = targetTrip.seats.find(s => {
        if (s.floor !== sourceSeat.floor) return false;
        if (!!s.isFloorSeat !== !!sourceSeat.isFloorSeat) return false;
        const isSourceBench = (sourceSeat.row ?? 0) >= 6 && !sourceSeat.isFloorSeat;
        if (isSourceBench) {
            return (s.row ?? 0) >= 6 && !s.isFloorSeat && s.col === sourceSeat.col;
        }
        return s.row === sourceSeat.row && s.col === sourceSeat.col;
      });
      
      const isReservedInQueue = transferQueue.some(q => q.targetTripId === targetTrip.id && q.targetSeatId === targetSeatByPos?.id);
      const targetOccupant = bookings.find(b => 
        b.status !== 'cancelled' && 
        b.items.some(item => item.tripId === targetTrip.id && item.seatIds.includes(targetSeatByPos?.id || ''))
      );

      return {
        sourceSeatId: seatId,
        sourceLabel: sourceSeat.label,
        posDesc: getPositionDesc(sourceSeat),
        targetSeatId: targetSeatByPos?.id || '',
        targetLabel: targetSeatByPos?.label || '',
        isValid: !!targetSeatByPos && !isReservedInQueue,
        isSwap: !!targetOccupant,
        swapPhone: targetOccupant?.passenger.phone
      };
    });

    return { results, isAllValid: results.every(r => r.isValid) };
  }, [selectedBooking, targetTrip, sourceTrip, selectedSeatIds, bookings, transferQueue]);

  const handleSeatClick = (seat: Seat, tripId: string) => {
    if (!trip1Id || !trip2Id) {
        toast({ type: 'warning', title: 'Chưa chọn xe', message: 'Vui lòng chọn đủ 2 xe để đối chiếu.' });
        return;
    }

    if (transferQueue.some(q => q.sourceTripId === tripId && q.sourceSeatId === seat.id)) {
        toast({ type: 'info', title: 'Ghế đã chờ chuyển', message: 'Ghế này đã nằm trong danh sách hàng chờ.' });
        return;
    }

    if (seat.status === SeatStatus.BOOKED || seat.status === SeatStatus.SOLD || seat.status === SeatStatus.HELD) {
      const booking = bookings.find(b => 
        b.status !== 'cancelled' && 
        b.items.some(item => item.tripId === tripId && item.seatIds.includes(seat.id))
      );

      if (booking) {
        if (selectedBooking && selectedBooking.id === booking.id && selectedFromTripId === tripId) {
          setSelectedSeatIds(prev => {
            const newList = prev.includes(seat.id) ? prev.filter(id => id !== seat.id) : [...prev, seat.id];
            if (newList.length === 0) { setSelectedBooking(null); setSelectedFromTripId(null); }
            return newList;
          });
        } 
        else {
          setSelectedBooking(booking);
          setSelectedFromTripId(tripId);
          setSelectedSeatIds([seat.id]);
        }
      }
    }
  };

  const addToQueue = () => {
    if (!selectedBooking || !transferValidation || !transferValidation.isAllValid || !targetTrip || !sourceTrip) return;

    const newItems: PendingTransfer[] = transferValidation.results.map(r => ({
        id: `${selectedBooking.id}_${r.sourceSeatId}`,
        bookingId: selectedBooking.id,
        phone: selectedBooking.passenger.phone,
        sourceTripId: sourceTrip.id,
        targetTripId: targetTrip.id,
        sourceLabel: r.sourceLabel,
        targetLabel: r.targetLabel,
        sourceSeatId: r.sourceSeatId,
        targetSeatId: r.targetSeatId,
        posDesc: r.posDesc,
        isSwap: r.isSwap,
        swapPhone: r.swapPhone
    }));

    setTransferQueue(prev => [...prev, ...newItems]);
    setSelectedBooking(null);
    setSelectedSeatIds([]);
    setSelectedFromTripId(null);
    setShowQueue(true);
  };

  const handleSaveAll = async () => {
    if (transferQueue.length === 0) return;
    setIsProcessing(true);
    try {
      const grouped = transferQueue.reduce((acc, curr) => {
          if (!acc[curr.bookingId]) acc[curr.bookingId] = [];
          acc[curr.bookingId].push(curr);
          return acc;
      }, {} as Record<string, PendingTransfer[]>);

      for (const bId of Object.keys(grouped)) {
          const queueItems = grouped[bId];
          const seatTransfers = queueItems.map(q => ({ sourceSeatId: q.sourceSeatId, targetSeatId: q.targetSeatId }));
          await api.bookings.transferSeat(bId, queueItems[0].sourceTripId, queueItems[0].targetTripId, seatTransfers);
      }
      await onRefresh();
      toast({ type: 'success', title: 'Thành công', message: 'Đã cập nhật vị trí các xe.' });
      setTransferQueue([]);
      setShowQueue(false);
    } catch (e) {
      toast({ type: 'error', title: 'Lỗi', message: 'Không thể thực hiện lưu thay đổi.' });
    } finally { setIsProcessing(false); }
  };

  const getAugmentedSeats = (trip: BusTrip | undefined) => {
    if (!trip) return [];
    return trip.seats.map(s => {
      if (selectedFromTripId === trip.id && selectedSeatIds.includes(s.id)) return { ...s, status: SeatStatus.SELECTED };
      if (transferQueue.some(q => q.sourceTripId === trip.id && q.sourceSeatId === s.id)) return { ...s, status: SeatStatus.SELECTED, label: `OUT` };
      if (transferQueue.some(q => q.targetTripId === trip.id && q.targetSeatId === s.id)) return { ...s, status: SeatStatus.BOOKED, label: `IN` };
      return s;
    });
  };

  return (
    <div className="fixed inset-0 top-16 bg-slate-100 flex flex-col overflow-hidden z-20">
      {/* 1. Ultra-slim Header */}
      <div className="bg-slate-900 text-white h-12 flex items-center px-4 gap-4 shrink-0 shadow-lg border-b border-white/10">
        <div className="flex-1 flex items-center gap-3">
          <div className="bg-white/10 px-2 py-1 rounded text-[10px] font-black uppercase text-white/50 tracking-widest">Xe Gốc</div>
          <select 
            value={trip1Id} 
            onChange={e => setTrip1Id(e.target.value)}
            className="bg-slate-800 border-none rounded px-3 py-1 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-primary w-[260px]"
          >
            <option value="">-- Chọn chuyến 1 --</option>
            {availableTrips.map(t => <option key={t.id} value={t.id}>{t.departureTime.split(' ')[1]} - {t.licensePlate} ({t.route})</option>)}
          </select>
        </div>

        <div className="flex items-center gap-4">
           <button onClick={handleRefresh} disabled={isRefreshing} className="p-2 hover:bg-white/10 rounded transition-colors text-white/70">
              {isRefreshing ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
           </button>
           <div className="w-px h-6 bg-white/20"></div>
        </div>

        <div className="flex-1 flex items-center gap-3 justify-end">
          <select 
            value={trip2Id} 
            onChange={e => setTrip2Id(e.target.value)}
            className="bg-slate-800 border-none rounded px-3 py-1 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-primary w-[260px]"
          >
            <option value="">-- Chọn chuyến 2 --</option>
            {availableTrips.filter(t => t.id !== trip1Id).map(t => <option key={t.id} value={t.id}>{t.departureTime.split(' ')[1]} - {t.licensePlate} ({t.route})</option>)}
          </select>
          <div className="bg-white/10 px-2 py-1 rounded text-[10px] font-black uppercase text-white/50 tracking-widest">Xe Đích</div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {/* 2. Optimized Side-by-Side Area */}
        <div className="flex-1 flex divide-x divide-slate-300 bg-slate-200 overflow-hidden">
            {/* Trip 1 Container */}
            <div className="flex-1 flex flex-col overflow-hidden relative bg-white">
                <div className={`p-2 border-b flex justify-between items-center sticky top-0 z-20 transition-colors ${selectedFromTripId === trip1Id ? 'bg-primary/10 border-primary/20' : 'bg-slate-50 border-slate-200'}`}>
                    <span className="text-xs font-black text-slate-700 flex items-center gap-2">
                        <BusFront size={14} className="text-slate-400"/>
                        {trip1 ? trip1.licensePlate : 'CHƯA CHỌN XE 1'}
                    </span>
                    {selectedFromTripId === trip1Id && <Badge className="bg-primary text-white h-4 text-[9px] font-black">NGUỒN ĐIỀU PHỐI</Badge>}
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
                    {trip1 ? (
                        <div className="max-w-[480px] mx-auto scale-95 origin-top">
                            <SeatMap 
                                seats={getAugmentedSeats(trip1)} 
                                busType={trip1.type} 
                                onSeatClick={(s) => handleSeatClick(s, trip1Id)} 
                                bookings={bookings.filter(b => b.items.some(i => i.tripId === trip1Id))}
                                currentTripId={trip1.id}
                            />
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4">
                            <BusFront size={48} className="opacity-10"/>
                            <span className="text-sm font-medium">Chọn xe bên trái</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Trip 2 Container */}
            <div className="flex-1 flex flex-col overflow-hidden relative bg-white">
                <div className={`p-2 border-b flex justify-between items-center sticky top-0 z-20 transition-colors ${selectedFromTripId === trip2Id ? 'bg-primary/10 border-primary/20' : 'bg-slate-50 border-slate-200'}`}>
                    <span className="text-xs font-black text-slate-700 flex items-center gap-2">
                        <BusFront size={14} className="text-slate-400"/>
                        {trip2 ? trip2.licensePlate : 'CHƯA CHỌN XE 2'}
                    </span>
                    {selectedFromTripId === trip2Id && <Badge className="bg-primary text-white h-4 text-[9px] font-black">NGUỒN ĐIỀU PHỐI</Badge>}
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
                    {trip2 ? (
                        <div className="max-w-[480px] mx-auto scale-95 origin-top">
                            <SeatMap 
                                seats={getAugmentedSeats(trip2)} 
                                busType={trip2.type} 
                                onSeatClick={(s) => handleSeatClick(s, trip2Id)} 
                                bookings={bookings.filter(b => b.items.some(i => i.tripId === trip2Id))}
                                currentTripId={trip2.id}
                            />
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4">
                            <BusFront size={48} className="opacity-10"/>
                            <span className="text-sm font-medium">Chọn xe bên phải</span>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* 3. Bottom Float Action / Tooltip */}
        {selectedBooking && sourceTrip && targetTrip && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white rounded-2xl shadow-2xl p-4 flex flex-col gap-4 min-w-[380px] border border-white/10 animate-in slide-in-from-bottom-4 z-50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                            <ShoppingCart size={18}/>
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-white/50 uppercase tracking-widest leading-none mb-1">Đang chọn điều phối</p>
                            <h4 className="text-sm font-black tracking-tight">{selectedBooking.passenger.phone}</h4>
                        </div>
                    </div>
                    <button onClick={() => { setSelectedBooking(null); setSelectedSeatIds([]); }} className="text-white/30 hover:text-white"><X size={20}/></button>
                </div>
                
                <div className="flex flex-wrap gap-2 py-1 max-h-[100px] overflow-y-auto">
                    {transferValidation?.results.map((r, i) => (
                        <div key={i} className={`flex items-center gap-2 px-2 py-1 rounded text-[11px] font-bold border ${r.isSwap ? 'bg-amber-500/20 border-amber-500/50 text-amber-400' : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'}`}>
                           <span>{r.sourceLabel}</span>
                           {r.isSwap ? <Repeat size={12}/> : <ArrowRight size={12}/>} 
                           <span>{r.targetLabel || '?'}</span>
                        </div>
                    ))}
                </div>

                <Button 
                    onClick={addToQueue}
                    disabled={!transferValidation?.isAllValid}
                    className="w-full bg-primary hover:bg-primary/90 text-white font-black h-11 rounded-xl shadow-lg transition-transform active:scale-95"
                >
                    XÁC NHẬN CHỜ CHUYỂN
                </Button>
            </div>
        )}

        {/* 4. Queue Sidebar (Compact & Professional) */}
        <div className={`
            bg-slate-50 border-l border-slate-300 flex flex-col transition-all duration-300 shrink-0
            ${showQueue ? 'w-[320px]' : 'w-0 overflow-hidden border-none'}
        `}>
            <div className="h-12 flex items-center justify-between px-4 border-b bg-white shrink-0">
                <span className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                    <ShoppingCart size={14} className="text-primary"/> Hàng chờ ({transferQueue.length})
                </span>
                <button onClick={() => setShowQueue(false)} className="text-slate-400 hover:text-slate-600"><X size={18}/></button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {transferQueue.map(q => (
                    <div key={q.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2 group hover:border-primary transition-colors">
                        <div className="flex justify-between items-center">
                            <span className="text-[11px] font-black text-slate-900">{q.phone}</span>
                            <button onClick={() => setTransferQueue(prev => prev.filter(i => i.id !== q.id))} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14}/></button>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-black">
                            <Badge className="bg-slate-100 text-slate-600 border-slate-200">{q.sourceLabel}</Badge>
                            {q.isSwap ? <ArrowLeftRight size={12} className="text-amber-500"/> : <ArrowRight size={12} className="text-emerald-500"/>}
                            <Badge className="bg-primary text-white border-transparent">{q.targetLabel}</Badge>
                            <span className="text-[9px] text-slate-400 ml-auto font-medium">{q.posDesc}</span>
                        </div>
                        {q.isSwap && (
                            <div className="text-[9px] bg-amber-50 text-amber-700 p-2 rounded-lg border border-amber-100 font-bold flex items-center gap-1">
                                <Repeat size={10}/> Đổi chéo: {q.swapPhone}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="p-4 bg-white border-t border-slate-200 space-y-3">
                <Button 
                    onClick={handleSaveAll}
                    disabled={transferQueue.length === 0 || isProcessing}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black h-12 rounded-xl flex items-center justify-center gap-2 shadow-xl"
                >
                    {isProcessing ? <Loader2 size={16} className="animate-spin"/> : <><Save size={18}/> LƯU {transferQueue.length} THAY ĐỔI</>}
                </Button>
                <p className="text-[9px] text-slate-400 text-center uppercase font-bold tracking-tighter">Dữ liệu sẽ được cập nhật đồng bộ sau khi nhấn Lưu</p>
            </div>
        </div>

        {/* 5. Floating Toggle Queue Button */}
        {!showQueue && transferQueue.length > 0 && (
            <button 
                onClick={() => setShowQueue(true)}
                className="absolute top-4 right-4 bg-primary text-white w-12 h-12 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform z-40"
            >
                <ShoppingCart size={20}/>
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full border-2 border-white flex items-center justify-center">{transferQueue.length}</span>
            </button>
        )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>
    </div>
  );
};
