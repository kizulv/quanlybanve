
import React, { useState, useMemo } from 'react';
import { BusTrip, Seat, Booking, SeatStatus, BusType } from '../types';
import { SeatMap } from './SeatMap';
import { 
  BusFront, 
  CheckCircle2,
  Loader2,
  ArrowLeftRight,
  ShieldAlert,
  RefreshCw,
  ArrowRight,
  Users,
  AlertTriangle,
  CheckSquare,
  Trash2,
  ShoppingCart,
  Save,
  X,
  Repeat,
  ChevronRight,
  ChevronLeft,
  LayoutGrid
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
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter trips for the selected date
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
    const rowDesc = isBench ? 'Băng5' : `H${(s.row ?? 0) + 1}`;
    return `T${s.floor}-${rowDesc}-C${(s.col ?? 0) + 1}`;
  };

  const transferValidation = useMemo(() => {
    if (!selectedBooking || !targetTrip || !sourceTrip || selectedSeatIds.length === 0) return null;

    const results = selectedSeatIds.map(seatId => {
      const sourceSeat = sourceTrip.seats.find(s => s.id === seatId);
      if (!sourceSeat) return { sourceSeatId: seatId, isValid: false, sourceLabel: '?', targetSeatId: '', posDesc: '?' };

      // FIX: Ưu tiên tìm ghế đích dựa trên Số thứ tự (Label) thay vì tọa độ vật lý
      let targetSeat = targetTrip.seats.find(s => s.label === sourceSeat.label);
      
      // Nếu không tìm thấy theo số thứ tự (do bus khác loại), mới fall-back về tọa độ
      if (!targetSeat) {
        targetSeat = targetTrip.seats.find(s => {
            if (s.floor !== sourceSeat.floor) return false;
            if (!!s.isFloorSeat !== !!sourceSeat.isFloorSeat) return false;
            const isSourceBench = (sourceSeat.row ?? 0) >= 6 && !sourceSeat.isFloorSeat;
            if (isSourceBench) {
                const isTargetBench = (s.row ?? 0) >= 6 && !s.isFloorSeat;
                return isTargetBench && s.col === sourceSeat.col;
            }
            return s.row === sourceSeat.row && s.col === sourceSeat.col;
        });
      }
      
      const isReservedInQueue = transferQueue.some(q => q.targetTripId === targetTrip.id && q.targetSeatId === targetSeat?.id);
      const targetOccupant = bookings.find(b => 
        b.status !== 'cancelled' && 
        b.items.some(item => item.tripId === targetTrip.id && item.seatIds.includes(targetSeat?.id || ''))
      );

      const isValid = !!targetSeat && !isReservedInQueue;
      const isSwap = !!targetOccupant;
      
      return {
        sourceSeatId: seatId,
        sourceLabel: sourceSeat.label,
        posDesc: getPositionDesc(sourceSeat),
        targetSeatId: targetSeat?.id || '',
        targetLabel: targetSeat?.label || '',
        isValid,
        isSwap,
        swapPhone: targetOccupant?.passenger.phone
      };
    });

    return {
      results,
      isAllValid: results.every(r => r.isValid),
    };
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
    toast({ type: 'success', title: 'Đã thêm hàng chờ', message: `Thêm ${newItems.length} vị trí cần điều phối.` });
  };

  const handleSaveAll = async () => {
    if (transferQueue.length === 0 || isProcessing) return;
    setIsProcessing(true);
    
    try {
      const grouped = transferQueue.reduce((acc, curr) => {
          if (!acc[curr.bookingId]) acc[curr.bookingId] = [];
          acc[curr.bookingId].push(curr);
          return acc;
      }, {} as Record<string, PendingTransfer[]>);

      const bookingIds = Object.keys(grouped);
      for (const bId of bookingIds) {
          const queueItems = grouped[bId];
          const seatTransfers = queueItems.map(q => ({ 
              sourceSeatId: q.sourceSeatId, 
              targetSeatId: q.targetSeatId 
          }));
          
          await api.bookings.transferSeat(
            bId, 
            queueItems[0].sourceTripId, 
            queueItems[0].targetTripId, 
            seatTransfers
          );
      }
      
      await onRefresh();
      toast({ type: 'success', title: 'Thành công', message: `Đã lưu toàn bộ thay đổi điều phối.` });
      setTransferQueue([]);
    } catch (e) {
      console.error(e);
      toast({ type: 'error', title: 'Lỗi', message: 'Quá trình lưu dữ liệu gặp sự cố.' });
    } finally { 
      setIsProcessing(false); 
    }
  };

  const getAugmentedSeats = (trip: BusTrip | undefined) => {
    if (!trip) return [];
    return trip.seats.map(s => {
      if (selectedFromTripId === trip.id && selectedSeatIds.includes(s.id)) return { ...s, status: SeatStatus.SELECTED };
      if (selectedFromTripId === trip.id && selectedBooking) {
          const tripItem = selectedBooking.items.find(i => i.tripId === trip.id);
          if (tripItem?.seatIds.includes(s.id)) return { ...s, status: SeatStatus.HELD };
      }
      if (transferQueue.some(q => q.sourceTripId === trip.id && q.sourceSeatId === s.id)) return { ...s, status: SeatStatus.SELECTED, label: `OUT` };
      if (transferQueue.some(q => q.targetTripId === trip.id && q.targetSeatId === s.id)) return { ...s, status: SeatStatus.BOOKED, label: `IN` };
      return s;
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] animate-in fade-in duration-300">
      <div className="bg-white border-b border-slate-200 shrink-0 z-30 shadow-sm rounded-none">
        <div className="flex flex-col md:flex-row items-center gap-4 px-4 py-2">
          <div className="flex-1 w-full flex items-center gap-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Xe 1:</span>
            <select 
              value={trip1Id} 
              onChange={e => { setTrip1Id(e.target.value); setSelectedBooking(null); setSelectedSeatIds([]); }}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-none px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            >
              <option value="">-- Chọn chuyến --</option>
              {availableTrips.map(t => (
                <option key={t.id} value={t.id}>{t.departureTime.split(' ')[1]} - {t.licensePlate} ({t.route})</option>
              ))}
            </select>
          </div>

          <div className="shrink-0 flex items-center gap-2">
             <div className="flex items-center justify-center w-7 h-7 bg-primary/5 text-primary rounded-none border border-primary/20">
                <ArrowLeftRight size={14} />
             </div>
             <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isRefreshing} className="h-7 text-[10px] font-black uppercase text-slate-400 hover:text-primary rounded-none">
                {isRefreshing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                <span className="ml-1 hidden sm:inline">Làm mới</span>
             </Button>
          </div>

          <div className="flex-1 w-full flex items-center gap-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Xe 2:</span>
            <select 
              value={trip2Id} 
              onChange={e => { setTrip2Id(e.target.value); setSelectedBooking(null); setSelectedSeatIds([]); }}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-none px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            >
              <option value="">-- Chọn chuyến --</option>
              {availableTrips.filter(t => t.id !== trip1Id).map(t => (
                <option key={t.id} value={t.id}>{t.departureTime.split(' ')[1]} - {t.licensePlate} ({t.route})</option>
              ))}
            </select>
          </div>

          <div className="shrink-0">
             <Button 
                variant={isSidebarVisible ? "secondary" : "default"} 
                size="sm" 
                onClick={() => setIsSidebarVisible(!isSidebarVisible)}
                className="h-8 rounded-none text-xs font-bold px-3 flex items-center gap-2"
             >
                <ShoppingCart size={14}/>
                {isSidebarVisible ? "Ẩn hàng chờ" : `Hiện hàng chờ (${transferQueue.length})`}
             </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex gap-0 items-start overflow-hidden relative">
        <div className="flex-1 bg-white border-r border-slate-200 flex flex-col h-full relative rounded-none overflow-hidden">
          <div className="flex bg-slate-50 border-b border-slate-200 shrink-0 sticky top-0 z-20">
              <div className={`basis-1/2 min-w-0 px-4 py-2 border-r border-slate-200 flex justify-between items-center ${selectedFromTripId === trip1Id ? 'bg-primary/5' : ''}`}>
                  <div className="flex items-center gap-2 text-[10px] font-black text-slate-700 uppercase tracking-tight truncate">
                    <BusFront size={14} className={selectedFromTripId === trip1Id ? 'text-primary' : 'text-slate-400'}/> 
                    {trip1 ? trip1.licensePlate : 'Chuyến 1'}
                  </div>
                  {selectedFromTripId === trip1Id && <Badge className="bg-primary text-white border-transparent px-2 py-0 h-4 text-[8px] font-black rounded-none">NGUỒN</Badge>}
              </div>
              <div className={`basis-1/2 min-w-0 px-4 py-2 flex justify-between items-center ${selectedFromTripId === trip2Id ? 'bg-primary/5' : ''}`}>
                  <div className="flex items-center gap-2 text-[10px] font-black text-slate-700 uppercase tracking-tight truncate">
                    <BusFront size={14} className={selectedFromTripId === trip2Id ? 'text-primary' : 'text-slate-400'}/> 
                    {trip2 ? trip2.licensePlate : 'Chuyến 2'}
                  </div>
                  {selectedFromTripId === trip2Id && <Badge className="bg-primary text-white border-transparent px-2 py-0 h-4 text-[8px] font-black rounded-none">NGUỒN</Badge>}
              </div>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className="flex h-full min-h-max min-w-full">
                <div className={`basis-1/2 min-w-0 border-r border-slate-100 ${selectedFromTripId === trip1Id ? 'bg-primary/[0.01]' : ''}`}>
                    {trip1 ? (
                       <div className="p-2">
                        <SeatMap 
                          seats={getAugmentedSeats(trip1)} 
                          busType={trip1.type} 
                          onSeatClick={(s) => handleSeatClick(s, trip1Id)} 
                          bookings={bookings.filter(b => b.items.some(i => i.tripId === trip1Id))}
                          currentTripId={trip1.id}
                        />
                       </div>
                    ) : (
                       <div className="h-full flex items-center justify-center text-slate-300 italic text-xs">Vui lòng chọn xe 1</div>
                    )}
                </div>

                <div className={`basis-1/2 min-w-0 ${selectedFromTripId === trip2Id ? 'bg-primary/[0.01]' : ''}`}>
                    {trip2 ? (
                       <div className="p-2">
                        <SeatMap 
                          seats={getAugmentedSeats(trip2)} 
                          busType={trip2.type} 
                          onSeatClick={(s) => handleSeatClick(s, trip2Id)} 
                          bookings={bookings.filter(b => b.items.some(i => i.tripId === trip2Id))}
                          currentTripId={trip2.id}
                        />
                       </div>
                    ) : (
                       <div className="h-full flex items-center justify-center text-slate-300 italic text-xs">Vui lòng chọn xe 2</div>
                    )}
                </div>
            </div>
          </div>

          {selectedBooking && sourceTrip && targetTrip && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white border border-indigo-200 shadow-xl rounded-none p-3 flex flex-col gap-3 min-w-[320px] animate-in slide-in-from-bottom-2 z-40">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-none bg-indigo-600 flex items-center justify-center text-white">
                            <ShoppingCart size={14}/>
                        </div>
                        <span className="font-black text-slate-800 text-[11px] uppercase">Điều phối {selectedSeatIds.length} vị trí</span>
                    </div>
                    <button onClick={() => { setSelectedBooking(null); setSelectedSeatIds([]); }} className="text-slate-400 hover:text-red-500"><X size={16}/></button>
                </div>
                
                <div className="flex flex-wrap gap-1.5 py-1 max-h-[60px] overflow-y-auto">
                    {transferValidation?.results.map((r, i) => (
                        <Badge key={i} className={`h-6 px-1.5 rounded-none border font-bold flex items-center gap-2 text-[10px] ${r.isSwap ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                           {r.sourceLabel} 
                           {r.isSwap ? <ArrowLeftRight size={10}/> : <ArrowRight size={10}/>} 
                           {r.targetLabel || '?'}
                        </Badge>
                    ))}
                </div>

                <Button 
                    onClick={addToQueue}
                    disabled={!transferValidation?.isAllValid}
                    className={`h-9 rounded-none font-black uppercase text-[10px] tracking-wider transition-all ${
                        transferValidation?.isAllValid 
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white' 
                        : 'bg-slate-300 text-white cursor-not-allowed'
                    }`}
                >
                    {transferValidation?.isAllValid ? 'Thêm vào hàng chờ' : 'Vị trí đích không hợp lệ'}
                </Button>
            </div>
          )}
        </div>

        <div className={`bg-slate-50 flex flex-col h-full overflow-hidden transition-all duration-300 shrink-0 border-l border-slate-200 ${isSidebarVisible ? 'w-[300px]' : 'w-0 border-none'}`}>
          <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 font-black text-[10px] text-slate-800 uppercase tracking-widest">
                <ShoppingCart size={14} className="text-indigo-600"/> Danh sách chờ ({transferQueue.length})
            </div>
            {transferQueue.length > 0 && (
                <button onClick={() => setTransferQueue([])} className="text-[9px] font-bold text-red-500 hover:underline uppercase">Xóa hết</button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {transferQueue.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center px-6">
                      <ShoppingCart size={32} className="opacity-10 mb-2"/>
                      <p className="text-[10px] font-bold uppercase tracking-tight opacity-40">Chưa có lệnh điều phối nào</p>
                  </div>
              ) : (
                  transferQueue.map(q => (
                      <div key={q.id} className="bg-white p-2.5 rounded-none border border-slate-200 shadow-sm flex flex-col gap-2 relative group hover:border-indigo-400 transition-all">
                          <div className="flex justify-between items-center">
                              <span className="text-[10px] font-black text-slate-900">{q.phone}</span>
                              <button onClick={() => setTransferQueue(prev => prev.filter(item => item.id !== q.id))} className="text-slate-300 hover:text-red-500">
                                  <X size={14}/>
                              </button>
                          </div>
                          <div className="flex items-center gap-1.5 text-[9px] font-black">
                              <Badge className="bg-indigo-600 text-white border-transparent h-4 px-1 rounded-none">{q.sourceLabel}</Badge>
                              {q.isSwap ? <ArrowLeftRight size={10} className="text-orange-500"/> : <ArrowRight size={10} className="text-indigo-400"/>}
                              <Badge className="bg-green-600 text-white border-transparent h-4 px-1 rounded-none">{q.targetLabel}</Badge>
                              <span className="text-[8px] text-slate-400 ml-auto font-medium">({q.posDesc})</span>
                          </div>
                          {q.isSwap && (
                              <div className="text-[8px] bg-orange-50 text-orange-700 p-1.5 border border-orange-100 font-bold flex items-center gap-1">
                                  <Repeat size={10}/> Đổi chéo: <span className="font-black">{q.swapPhone}</span>
                              </div>
                          )}
                      </div>
                  ))
              )}
          </div>

          <div className="p-3 border-t border-slate-200 bg-white space-y-2 shrink-0">
              <Button 
                onClick={handleSaveAll}
                disabled={transferQueue.length === 0 || isProcessing}
                className="w-full h-11 rounded-none bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[11px] uppercase tracking-widest shadow-md disabled:bg-slate-200 disabled:text-slate-400"
              >
                {isProcessing ? <Loader2 className="animate-spin" size={16}/> : <><Save className="mr-2" size={14}/> Lưu {transferQueue.length} thay đổi</>}
              </Button>
              <p className="text-[9px] text-slate-400 text-center uppercase tracking-tighter">Nhấn lưu để cập nhật vào hệ thống</p>
          </div>
        </div>
      </div>
    </div>
  );
};
