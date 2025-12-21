
import React, { useState, useMemo } from 'react';
import { BusTrip, Seat, Booking, SeatStatus, BusType } from '../types';
import { SeatMap } from './SeatMap';
import { 
  BusFront, 
  Loader2,
  ArrowLeftRight,
  RefreshCw,
  ArrowRight,
  ShoppingCart,
  X,
  Repeat,
  ChevronRight,
  ChevronLeft
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
  trip1Id: string;
  trip2Id: string;
  onTrip1Change: (id: string) => void;
  onTrip2Change: (id: string) => void;
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

export const SeatTransfer: React.FC<SeatTransferProps> = ({ 
  trips, bookings, selectedDate, onRefresh,
  trip1Id, trip2Id
}) => {
  const { toast } = useToast();
  
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedFromTripId, setSelectedFromTripId] = useState<string | null>(null);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  
  const [transferQueue, setTransferQueue] = useState<PendingTransfer[]>([]);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  
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
    return `T${s.floor}-H${(s.row ?? 0) + 1}-C${(s.col ?? 0) + 1}`;
  };

  const transferValidation = useMemo(() => {
    if (!selectedBooking || !targetTrip || !sourceTrip || selectedSeatIds.length === 0) return null;

    const results = selectedSeatIds.map(seatId => {
      const sourceSeat = sourceTrip.seats.find(s => s.id === seatId);
      if (!sourceSeat) return { sourceSeatId: seatId, isValid: false, sourceLabel: '?', targetSeatId: '', posDesc: '?' };

      const targetSeatByPos = targetTrip.seats.find(s => {
        if (s.floor !== sourceSeat.floor) return false;
        if (!!s.isFloorSeat !== !!sourceSeat.isFloorSeat) return false;
        return s.row === sourceSeat.row && s.col === sourceSeat.col;
      });
      
      const isReservedInQueue = transferQueue.some(q => q.targetTripId === targetTrip.id && q.targetSeatId === targetSeatByPos?.id);
      const targetOccupant = bookings.find(b => 
        b.status !== 'cancelled' && 
        b.items.some(item => item.tripId === targetTrip.id && item.seatIds.includes(targetSeatByPos?.id || ''))
      );

      const isValid = targetSeatByPos && !isReservedInQueue;
      
      return {
        sourceSeatId: seatId,
        sourceLabel: sourceSeat.label,
        posDesc: getPositionDesc(sourceSeat),
        targetSeatId: targetSeatByPos?.id || '',
        targetLabel: targetSeatByPos?.label || '',
        isValid: !!isValid,
        isSwap: !!targetOccupant,
        swapPhone: targetOccupant?.passenger.phone
      };
    });

    return { results, isAllValid: results.every(r => r.isValid) };
  }, [selectedBooking, targetTrip, sourceTrip, selectedSeatIds, bookings, transferQueue]);

  const handleSeatClick = (seat: Seat, tripId: string) => {
    if (!trip1Id || !trip2Id) {
        toast({ type: 'warning', title: 'Chưa chọn đủ xe', message: 'Vui lòng chọn 2 xe để đối chiếu.' });
        return;
    }

    if (transferQueue.some(q => q.sourceTripId === tripId && q.sourceSeatId === seat.id)) return;

    if (seat.status === SeatStatus.BOOKED || seat.status === SeatStatus.SOLD || seat.status === SeatStatus.HELD) {
      const booking = bookings.find(b => 
        b.status !== 'cancelled' && b.items.some(item => item.tripId === tripId && item.seatIds.includes(seat.id))
      );

      if (booking) {
        if (selectedBooking?.id === booking.id && selectedFromTripId === tripId) {
          setSelectedSeatIds(prev => {
            const newList = prev.includes(seat.id) ? prev.filter(id => id !== seat.id) : [...prev, seat.id];
            if (newList.length === 0) { setSelectedBooking(null); setSelectedFromTripId(null); }
            return newList;
          });
        } else {
          setSelectedBooking(booking); setSelectedFromTripId(tripId); setSelectedSeatIds([seat.id]);
        }
      }
    } else {
        if (selectedFromTripId === tripId) { setSelectedBooking(null); setSelectedFromTripId(null); setSelectedSeatIds([]); }
    }
  };

  const addToQueue = () => {
    if (!selectedBooking || !transferValidation?.isAllValid || !targetTrip || !sourceTrip) return;
    const newItems: PendingTransfer[] = transferValidation.results.map(r => ({
        id: `${selectedBooking.id}_${r.sourceSeatId}`,
        bookingId: selectedBooking.id, phone: selectedBooking.passenger.phone,
        sourceTripId: sourceTrip.id, targetTripId: targetTrip.id,
        sourceLabel: r.sourceLabel, targetLabel: r.targetLabel,
        sourceSeatId: r.sourceSeatId, targetSeatId: r.targetSeatId,
        posDesc: r.posDesc, isSwap: r.isSwap, swapPhone: r.swapPhone
    }));
    setTransferQueue(prev => [...prev, ...newItems]);
    setSelectedBooking(null); setSelectedSeatIds([]); setSelectedFromTripId(null);
  };

  const handleSaveAll = async () => {
    if (transferQueue.length === 0) return;
    setIsProcessing(true);
    try {
      const grouped = transferQueue.reduce((acc, curr) => {
          if (!acc[curr.bookingId]) acc[curr.bookingId] = [];
          acc[curr.bookingId].push(curr); return acc;
      }, {} as Record<string, PendingTransfer[]>);

      for (const bId of Object.keys(grouped)) {
          const items = grouped[bId];
          const transfers = items.map(q => ({ sourceSeatId: q.sourceSeatId, targetSeatId: q.targetSeatId }));
          await api.bookings.transferSeat(bId, items[0].sourceTripId, items[0].targetTripId, transfers);
      }
      await onRefresh();
      toast({ type: 'success', title: 'Thành công', message: `Đã di dời ${transferQueue.length} khách.` });
      setTransferQueue([]);
    } catch (e) {
      toast({ type: 'error', title: 'Lỗi', message: 'Không thể lưu thay đổi.' });
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
    <div className="flex flex-col h-[calc(100vh-100px)] animate-in fade-in duration-300">
      <div className="flex-1 flex gap-0 items-start overflow-hidden relative">
        <div className="flex-1 bg-white border-r border-slate-200 flex flex-col h-full relative rounded-none overflow-hidden">
          <div className="flex bg-slate-50 border-b border-slate-200 shrink-0 sticky top-0 z-20 h-10">
              <div className={`basis-1/2 px-4 flex justify-between items-center border-r border-slate-200 ${selectedFromTripId === trip1Id ? 'bg-primary/5' : ''}`}>
                  <div className="flex items-center gap-2 text-[10px] font-black text-slate-700 uppercase">{trip1?.licensePlate || 'Xe nguồn'}</div>
                  {selectedFromTripId === trip1Id && <Badge className="bg-primary text-white text-[8px] h-4 rounded-none">NGUỒN</Badge>}
              </div>
              <div className={`basis-1/2 px-4 flex justify-between items-center ${selectedFromTripId === trip2Id ? 'bg-primary/5' : ''}`}>
                  <div className="flex items-center gap-2 text-[10px] font-black text-slate-700 uppercase">{trip2?.licensePlate || 'Xe đích'}</div>
                  {selectedFromTripId === trip2Id && <Badge className="bg-primary text-white text-[8px] h-4 rounded-none">NGUỒN</Badge>}
              </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="flex h-full min-w-full">
                <div className="basis-1/2 min-w-0 border-r border-slate-100">
                    {trip1 ? <div className="p-2"><SeatMap seats={getAugmentedSeats(trip1)} busType={trip1.type} onSeatClick={(s) => handleSeatClick(s, trip1Id)} bookings={bookings} currentTripId={trip1.id}/></div> : <div className="h-full flex items-center justify-center text-slate-300 italic text-xs">Vui lòng chọn xe 1</div>}
                </div>
                <div className="basis-1/2 min-w-0">
                    {trip2 ? <div className="p-2"><SeatMap seats={getAugmentedSeats(trip2)} busType={trip2.type} onSeatClick={(s) => handleSeatClick(s, trip2Id)} bookings={bookings} currentTripId={trip2.id}/></div> : <div className="h-full flex items-center justify-center text-slate-300 italic text-xs">Vui lòng chọn xe 2</div>}
                </div>
            </div>
          </div>

          {selectedBooking && sourceTrip && targetTrip && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white border border-indigo-200 shadow-2xl rounded-none p-4 flex flex-col gap-3 min-w-[340px] z-40 animate-in slide-in-from-bottom-4">
                <div className="flex justify-between items-center"><div className="flex items-center gap-2 font-black text-slate-800 text-[11px] uppercase"><ShoppingCart size={14} className="text-indigo-600"/> Điều phối {selectedSeatIds.length} vị trí</div><button onClick={() => { setSelectedBooking(null); setSelectedSeatIds([]); }} className="text-slate-400 hover:text-red-500"><X size={16}/></button></div>
                <div className="flex flex-wrap gap-2">{transferValidation?.results.map((r, i) => (<Badge key={i} className={`h-6 px-2 rounded-none border font-bold text-[10px] ${r.isSwap ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-green-50 text-green-700 border-green-200'}`}>{r.sourceLabel} {r.isSwap ? <ArrowLeftRight size={10}/> : <ArrowRight size={10}/>} {r.targetLabel || '?'}</Badge>))}</div>
                <Button onClick={addToQueue} disabled={!transferValidation?.isAllValid} className="h-10 rounded-none bg-indigo-600 text-white font-black uppercase text-xs">Thêm vào hàng chờ</Button>
            </div>
          )}
        </div>

        <div className={`bg-slate-50 flex flex-col h-full transition-all duration-300 shrink-0 border-l border-slate-200 ${isSidebarVisible ? 'w-[320px]' : 'w-0 border-none'}`}>
          <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
            <div className="font-black text-[10px] text-slate-800 uppercase tracking-widest flex items-center gap-2"><ShoppingCart size={14}/> Chờ lưu ({transferQueue.length})</div>
            {transferQueue.length > 0 && <button onClick={() => setTransferQueue([])} className="text-[9px] font-bold text-red-500 uppercase hover:underline">Xóa hết</button>}
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {transferQueue.length === 0 ? <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-50 italic text-xs"><ShoppingCart size={32} className="mb-2"/>Trống</div> : transferQueue.map(q => (
                  <div key={q.id} className="bg-white p-3 border border-slate-200 shadow-sm flex flex-col gap-2 relative">
                      <div className="flex justify-between font-black text-[10px]"><span>{q.phone}</span><button onClick={() => setTransferQueue(prev => prev.filter(i => i.id !== q.id))}><X size={14} className="text-slate-300 hover:text-red-500"/></button></div>
                      <div className="flex items-center gap-2"><Badge className="bg-indigo-600 text-white text-[9px] h-4 rounded-none">{q.sourceLabel}</Badge><ArrowRight size={10} className="text-slate-400"/><Badge className="bg-green-600 text-white text-[9px] h-4 rounded-none">{q.targetLabel}</Badge><span className="text-[8px] text-slate-400 ml-auto">({q.posDesc})</span></div>
                      {q.isSwap && <div className="text-[8px] bg-orange-50 text-orange-700 p-1.5 border border-orange-100 font-bold flex items-center gap-1"><Repeat size={10}/> Đổi chéo: {q.swapPhone}</div>}
                  </div>
              ))}
          </div>
          <div className="p-4 border-t border-slate-200 bg-white space-y-3 shrink-0">
              <Button onClick={handleSaveAll} disabled={transferQueue.length === 0 || isProcessing} className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest">{isProcessing ? <Loader2 className="animate-spin" size={16}/> : `Lưu ${transferQueue.length} thay đổi`}</Button>
              <Button variant="ghost" onClick={handleRefresh} disabled={isRefreshing} className="w-full h-10 text-[10px] font-black uppercase text-slate-400">{isRefreshing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} className="mr-2"/>} Cập nhật dữ liệu mới</Button>
          </div>
        </div>
        <button onClick={() => setIsSidebarVisible(!isSidebarVisible)} className="absolute right-[320px] top-1/2 -translate-y-1/2 z-50 bg-white border border-slate-200 w-6 h-12 flex items-center justify-center rounded-l-md shadow-lg transition-all" style={{ right: isSidebarVisible ? '320px' : '0' }}>{isSidebarVisible ? <ChevronRight size={16}/> : <ChevronLeft size={16}/>}</button>
      </div>
    </div>
  );
};
