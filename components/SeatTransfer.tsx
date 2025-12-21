
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
  PanelRightClose,
  PanelRightOpen
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

  const availableTrips = useMemo(() => {
    return trips.filter(t => {
      const tripDate = new Date(t.departureTime.split(' ')[0]);
      return tripDate.toDateString() === selectedDate.toDateString() && t.type === BusType.SLEEPER;
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
    const isBench = (s.row ?? 0) >= 6;
    const rowDesc = isBench ? 'Băng5' : `H${(s.row ?? 0) + 1}`;
    return `T${s.floor}-${rowDesc}-C${(s.col ?? 0) + 1}`;
  };

  const transferValidation = useMemo(() => {
    if (!selectedBooking || !targetTrip || !sourceTrip || selectedSeatIds.length === 0) return null;

    const results = selectedSeatIds.map(seatId => {
      const sourceSeat = sourceTrip.seats.find(s => s.id === seatId);
      if (!sourceSeat) return { sourceSeatId: seatId, isValid: false, sourceLabel: '?', targetSeatId: '', posDesc: '?' };

      const isSourceBench = (sourceSeat.row ?? 0) >= 6;

      const targetSeatByPos = targetTrip.seats.find(s => {
        if (s.floor !== sourceSeat.floor) return false;
        if (!!s.isFloorSeat !== !!sourceSeat.isFloorSeat) return false;
        if (isSourceBench) {
            const isTargetBench = (s.row ?? 0) >= 6;
            return isTargetBench && s.col === sourceSeat.col;
        }
        return s.row === sourceSeat.row && s.col === sourceSeat.col;
      });
      
      const isReservedInQueue = transferQueue.some(q => q.targetTripId === targetTrip.id && q.targetSeatId === targetSeatByPos?.id);
      const targetOccupant = bookings.find(b => 
        b.status !== 'cancelled' && 
        b.items.some(item => item.tripId === targetTrip.id && item.seatIds.includes(targetSeatByPos?.id || ''))
      );

      const isValid = targetSeatByPos && !isReservedInQueue;
      const isSwap = !!targetOccupant;
      
      return {
        sourceSeatId: seatId,
        sourceLabel: sourceSeat.label,
        posDesc: getPositionDesc(sourceSeat),
        targetSeatId: targetSeatByPos?.id || '',
        targetLabel: targetSeatByPos?.label || '',
        isValid: !!isValid,
        isSwap: isSwap,
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
        toast({ type: 'info', title: 'Ghế đã chờ chuyển', message: 'Ghế này đã nằm trong danh sách hàng chờ lưu.' });
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
    } else {
        if (selectedFromTripId === tripId) {
            setSelectedBooking(null);
            setSelectedFromTripId(null);
            setSelectedSeatIds([]);
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
    if (!isSidebarVisible) setIsSidebarVisible(true);
    toast({ type: 'success', title: 'Đã thêm vào hàng chờ', message: `Đã thêm ${newItems.length} lệnh điều phối.` });
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
      toast({ type: 'success', title: 'Thành công', message: `Đã cập nhật ${transferQueue.length} vị trí.` });
      setTransferQueue([]);
    } catch (e) {
      console.error(e);
      toast({ type: 'error', title: 'Lỗi', message: 'Không thể thực hiện lưu thay đổi.' });
    } finally { setIsProcessing(false); }
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
    <div className="flex flex-col gap-4 animate-in fade-in duration-300">
      {/* Header Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="flex-1 w-full">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Xe đối chiếu số 1</label>
            <select 
              value={trip1Id} 
              onChange={e => { setTrip1Id(e.target.value); setSelectedBooking(null); setSelectedSeatIds([]); }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-primary/10 transition-all"
            >
              <option value="">-- Chọn xe 1 --</option>
              {availableTrips.map(t => (
                <option key={t.id} value={t.id}>{t.departureTime.split(' ')[1]} - {t.licensePlate} ({t.route})</option>
              ))}
            </select>
          </div>

          <div className="shrink-0 flex flex-col items-center gap-0.5">
             <div className="flex items-center justify-center w-9 h-9 bg-primary/5 text-primary rounded-full border border-primary/20">
                <ArrowLeftRight size={18} />
             </div>
             <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isRefreshing} className="h-5 text-[9px] font-black uppercase text-slate-400 hover:text-primary">
                {isRefreshing ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                <span className="ml-1">Đồng bộ</span>
             </Button>
          </div>

          <div className="flex-1 w-full">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Xe đối chiếu số 2</label>
            <select 
              value={trip2Id} 
              onChange={e => { setTrip2Id(e.target.value); setSelectedBooking(null); setSelectedSeatIds([]); }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-primary/10 transition-all"
            >
              <option value="">-- Chọn xe 2 --</option>
              {availableTrips.filter(t => t.id !== trip1Id).map(t => (
                <option key={t.id} value={t.id}>{t.departureTime.split(' ')[1]} - {t.licensePlate} ({t.route})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex gap-4 items-start h-[calc(100vh-250px)] relative overflow-hidden">
        
        {/* Main Mapping Area */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full relative">
          
          <div className="flex bg-slate-50 border-b border-slate-200 shrink-0 sticky top-0 z-20">
              <div className="basis-1/2 min-w-0 px-4 py-2.5 border-r border-slate-200 flex justify-between items-center">
                  <div className="flex items-center gap-2 text-[11px] font-black text-slate-700 uppercase tracking-tight truncate">
                    <BusFront size={16} className={selectedFromTripId === trip1Id ? 'text-primary' : 'text-slate-400'}/> 
                    {trip1 ? trip1.licensePlate : 'Xe 1'}
                  </div>
                  {selectedFromTripId === trip1Id && <Badge className="bg-primary text-white border-transparent px-2 py-0.5 text-[9px] font-black">NGUỒN</Badge>}
              </div>
              <div className="basis-1/2 min-w-0 px-4 py-2.5 flex justify-between items-center">
                  <div className="flex items-center gap-2 text-[11px] font-black text-slate-700 uppercase tracking-tight truncate">
                    <BusFront size={16} className={selectedFromTripId === trip2Id ? 'text-primary' : 'text-slate-400'}/> 
                    {trip2 ? trip2.licensePlate : 'Xe 2'}
                  </div>
                  {selectedFromTripId === trip2Id && <Badge className="bg-primary text-white border-transparent px-2 py-0.5 text-[9px] font-black">NGUỒN</Badge>}
              </div>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin">
            <div className="flex h-full min-h-max min-w-full">
                {/* Column 1 (Fixed 50%) */}
                <div className={`basis-1/2 min-w-0 border-r border-slate-100 ${selectedFromTripId === trip1Id ? 'bg-primary/[0.01]' : ''}`}>
                    {trip1 ? (
                       <SeatMap 
                         seats={getAugmentedSeats(trip1)} 
                         busType={trip1.type} 
                         onSeatClick={(s) => handleSeatClick(s, trip1Id)} 
                         bookings={bookings.filter(b => b.items.some(i => i.tripId === trip1Id))}
                         currentTripId={trip1.id}
                       />
                    ) : (
                       <div className="h-40 flex items-center justify-center text-slate-300 italic text-xs">Chưa chọn xe 1</div>
                    )}
                </div>

                {/* Column 2 (Fixed 50%) */}
                <div className={`basis-1/2 min-w-0 ${selectedFromTripId === trip2Id ? 'bg-primary/[0.01]' : ''}`}>
                    {trip2 ? (
                       <SeatMap 
                         seats={getAugmentedSeats(trip2)} 
                         busType={trip2.type} 
                         onSeatClick={(s) => handleSeatClick(s, trip2Id)} 
                         bookings={bookings.filter(b => b.items.some(i => i.tripId === trip2Id))}
                         currentTripId={trip2.id}
                       />
                    ) : (
                       <div className="h-40 flex items-center justify-center text-slate-300 italic text-xs">Chưa chọn xe 2</div>
                    )}
                </div>
            </div>
          </div>

          {/* Floated Control for Current Selection */}
          {selectedBooking && sourceTrip && targetTrip && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-md border border-indigo-200 shadow-2xl rounded-2xl p-4 flex flex-col gap-3 min-w-[400px] animate-in slide-in-from-bottom-4 z-40 ring-1 ring-indigo-500/20">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm">
                            <ShoppingCart size={18}/>
                        </div>
                        <span className="font-black text-slate-800 text-sm">Điều phối {selectedSeatIds.length} ghế</span>
                    </div>
                    <button onClick={() => { setSelectedBooking(null); setSelectedSeatIds([]); }} className="text-slate-400 hover:text-red-500 transition-colors"><X size={18}/></button>
                </div>
                
                <div className="flex flex-wrap gap-2 py-1 max-h-[80px] overflow-y-auto">
                    {transferValidation?.results.map((r, i) => (
                        <Badge key={i} className={`h-7 px-2 rounded-lg border font-bold flex items-center gap-2 ${r.isSwap ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                           {r.sourceLabel} 
                           {r.isSwap ? <ArrowLeftRight size={10} className="animate-pulse"/> : <ArrowRight size={10}/>} 
                           {r.targetLabel || '?'}
                        </Badge>
                    ))}
                </div>

                <Button 
                    onClick={addToQueue}
                    disabled={!transferValidation?.isAllValid}
                    className={`h-11 rounded-xl font-black uppercase text-xs tracking-wider shadow-lg transition-all ${
                        transferValidation?.isAllValid 
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white' 
                        : 'bg-slate-400 text-white cursor-not-allowed'
                    }`}
                >
                    {transferValidation?.isAllValid ? 'Thêm vào hàng chờ lưu' : 'Lỗi vị trí đích'}
                </Button>
            </div>
          )}
        </div>

        {/* Transfer Queue Side Panel - COLLAPSIBLE */}
        <div 
          className={`
            bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full overflow-visible shrink-0 transition-all duration-300 relative
            ${isSidebarVisible ? 'w-[320px] opacity-100' : 'w-0 opacity-0'}
          `}
        >
           {/* Toggle Button */}
           <button 
              onClick={() => setIsSidebarVisible(!isSidebarVisible)}
              className={`
                absolute top-1/2 -translate-y-1/2 -left-4 z-50 w-8 h-12 bg-white border border-slate-200 rounded-lg shadow-md flex items-center justify-center text-slate-400 hover:text-primary transition-all
                ${!isSidebarVisible ? 'left-[-40px] opacity-100' : ''}
              `}
              title={isSidebarVisible ? "Thu gọn hàng chờ" : "Mở hàng chờ lưu"}
           >
              {isSidebarVisible ? <ChevronRight size={20}/> : <div className="relative"><ChevronLeft size={20}/>{transferQueue.length > 0 && <span className="absolute -top-5 -right-2 bg-red-500 text-white text-[8px] font-black rounded-full w-4 h-4 flex items-center justify-center ring-2 ring-white animate-bounce">{transferQueue.length}</span>}</div>}
           </button>

           {isSidebarVisible && (
              <>
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2 font-black text-[11px] text-slate-800 uppercase tracking-wider">
                     <ShoppingCart size={14} className="text-indigo-600"/> Hàng chờ lưu ({transferQueue.length})
                  </div>
                  {transferQueue.length > 0 && (
                      <button onClick={() => setTransferQueue([])} className="text-[9px] font-bold text-red-500 hover:underline">Xóa hết</button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-slate-50/50">
                    {transferQueue.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-300 text-center px-4">
                            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                              <ShoppingCart size={20} className="opacity-20"/>
                            </div>
                            <p className="text-[10px] font-medium italic leading-relaxed">Chọn đoàn khách trên xe Nguồn để bắt đầu sắp xếp vào hàng chờ lưu.</p>
                        </div>
                    ) : (
                        transferQueue.map(q => (
                            <div key={q.id} className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs flex flex-col gap-2 relative group hover:border-indigo-300 transition-all">
                                <div className="flex justify-between items-center">
                                    <span className="text-[11px] font-black text-slate-800">{q.phone}</span>
                                    <button onClick={() => setTransferQueue(prev => prev.filter(item => item.id !== q.id))} className="text-slate-300 hover:text-red-500">
                                        <X size={14}/>
                                    </button>
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] font-bold">
                                   <Badge className="bg-indigo-600 text-white border-transparent h-5 px-1.5">{q.sourceLabel}</Badge>
                                   {q.isSwap ? <ArrowLeftRight size={12} className="text-orange-500"/> : <ArrowRight size={12} className="text-indigo-400"/>}
                                   <Badge className="bg-green-600 text-white border-transparent h-5 px-1.5">{q.targetLabel}</Badge>
                                   <span className="text-[9px] text-slate-400 ml-auto font-medium">({q.posDesc})</span>
                                </div>
                                {q.isSwap && (
                                    <div className="text-[9px] bg-orange-50 text-orange-700 p-1.5 rounded-lg border border-orange-100 font-bold">
                                        <div className="flex items-center gap-1"><Repeat size={10}/> Đổi chéo: <span className="font-black ml-1">{q.swapPhone}</span></div>
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
                      className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-indigo-500/20"
                    >
                      {isProcessing ? <Loader2 className="animate-spin" size={16}/> : <><Save className="mr-2" size={14}/> Lưu {transferQueue.length} thay đổi</>}
                    </Button>
                    <p className="text-[9px] text-slate-400 text-center px-2 leading-tight">Nhấn "Lưu" để thực hiện cập nhật toàn bộ các vị trí đã sắp xếp lên hệ thống.</p>
                </div>
              </>
           )}
        </div>

      </div>
    </div>
  );
};
