
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
  Repeat
} from 'lucide-react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { useToast } from './ui/Toast';
import { api } from '../lib/api';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/AlertDialog";

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
  isSwap: boolean; // Phân biệt chuyển 1 chiều hay hoán đổi
  swapPhone?: string; // SĐT của khách bị đổi (nếu có)
}

export const SeatTransfer: React.FC<SeatTransferProps> = ({ trips, bookings, selectedDate, onRefresh }) => {
  const { toast } = useToast();
  const [trip1Id, setTrip1Id] = useState<string>('');
  const [trip2Id, setTrip2Id] = useState<string>('');
  
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedFromTripId, setSelectedFromTripId] = useState<string | null>(null);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  
  const [transferQueue, setTransferQueue] = useState<PendingTransfer[]>([]);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSplitWarning, setShowSplitWarning] = useState(false);

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
      
      // Kiểm tra xem vị trí đích này đã có trong hàng chờ chưa
      const isReservedInQueue = transferQueue.some(q => q.targetTripId === targetTrip.id && q.targetSeatId === targetSeatByPos?.id);

      // Tìm booking đang chiếm chỗ ở xe đích
      const targetOccupant = bookings.find(b => 
        b.status !== 'cancelled' && 
        b.items.some(item => item.tripId === targetTrip.id && item.seatIds.includes(targetSeatByPos?.id || ''))
      );

      // Luôn là hợp lệ (có thể chuyển hoặc hoán đổi), trừ khi đã bị giữ trong hàng chờ bởi lệnh khác
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
    toast({ type: 'success', title: 'Đã thêm vào hàng chờ', message: `Đã thêm ${newItems.length} lệnh điều phối.` });
  };

  const removeFromQueue = (id: string) => {
      setTransferQueue(prev => prev.filter(q => q.id !== id));
  };

  const handleSaveAll = async () => {
    if (transferQueue.length === 0) return;
    setIsProcessing(true);
    
    try {
      // Logic backend xử lý tuần tự hoặc gom nhóm đều được, ở đây giữ nguyên tính đơn giản
      const grouped = transferQueue.reduce((acc, curr) => {
          if (!acc[curr.bookingId]) acc[curr.bookingId] = [];
          acc[curr.bookingId].push(curr);
          return acc;
      }, {} as Record<string, PendingTransfer[]>);

      for (const bId of Object.keys(grouped)) {
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
      toast({ type: 'success', title: 'Hoàn tất điều phối', message: `Đã cập nhật thành công ${transferQueue.length} vị trí giữa 2 xe.` });
      setTransferQueue([]);
    } catch (e) {
      console.error(e);
      toast({ type: 'error', title: 'Lỗi hệ thống', message: 'Không thể thực hiện lưu thay đổi.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const getAugmentedSeats = (trip: BusTrip | undefined) => {
    if (!trip) return [];
    
    return trip.seats.map(s => {
      if (selectedFromTripId === trip.id && selectedSeatIds.includes(s.id)) {
        return { ...s, status: SeatStatus.SELECTED };
      }
      
      if (selectedFromTripId === trip.id && selectedBooking) {
          const tripItem = selectedBooking.items.find(i => i.tripId === trip.id);
          if (tripItem?.seatIds.includes(s.id)) return { ...s, status: SeatStatus.HELD };
      }

      // Draft states
      if (transferQueue.some(q => q.sourceTripId === trip.id && q.sourceSeatId === s.id)) {
          return { ...s, status: SeatStatus.SELECTED, label: `OUT` };
      }
      if (transferQueue.some(q => q.targetTripId === trip.id && q.targetSeatId === s.id)) {
          return { ...s, status: SeatStatus.BOOKED, label: `IN` };
      }

      return s;
    });
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      {/* Header Controls */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="flex-1 w-full">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Xe đối chiếu số 1 (Giường đơn)</label>
            <select 
              value={trip1Id} 
              onChange={e => { setTrip1Id(e.target.value); setSelectedBooking(null); setSelectedSeatIds([]); }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-primary/10 transition-all"
            >
              <option value="">-- Chọn xe 1 --</option>
              {availableTrips.map(t => (
                <option key={t.id} value={t.id}>{t.departureTime.split(' ')[1]} - {t.licensePlate} ({t.route})</option>
              ))}
            </select>
          </div>

          <div className="shrink-0 flex flex-col items-center gap-1">
             <div className="flex items-center justify-center w-10 h-10 bg-primary/5 text-primary rounded-full border border-primary/20 shadow-inner">
                <ArrowLeftRight size={20} />
             </div>
             <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isRefreshing} className="h-6 text-[10px] font-black uppercase text-slate-400 hover:text-primary">
                {isRefreshing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                <span className="ml-1">Đồng bộ</span>
             </Button>
          </div>

          <div className="flex-1 w-full">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Xe đối chiếu số 2 (Giường đơn)</label>
            <select 
              value={trip2Id} 
              onChange={e => { setTrip2Id(e.target.value); setSelectedBooking(null); setSelectedSeatIds([]); }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-primary/10 transition-all"
            >
              <option value="">-- Chọn xe 2 --</option>
              {availableTrips.filter(t => t.id !== trip1Id).map(t => (
                <option key={t.id} value={t.id}>{t.departureTime.split(' ')[1]} - {t.licensePlate} ({t.route})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start h-[calc(100vh-280px)]">
        
        <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full relative">
          
          <div className="flex bg-slate-50 border-b border-slate-200 shrink-0 sticky top-0 z-20">
              <div className="flex-1 px-5 py-3 border-r border-slate-200 flex justify-between items-center">
                  <div className="flex items-center gap-2 text-xs font-black text-slate-700 uppercase tracking-tighter">
                    <BusFront size={18} className={selectedFromTripId === trip1Id ? 'text-primary' : 'text-slate-400'}/> 
                    {trip1 ? trip1.licensePlate : 'Chưa chọn xe 1'}
                  </div>
                  {selectedFromTripId === trip1Id && <Badge className="bg-primary text-white border-transparent px-3 py-1 font-black shadow-sm">NGUỒN</Badge>}
              </div>
              <div className="flex-1 px-5 py-3 flex justify-between items-center">
                  <div className="flex items-center gap-2 text-xs font-black text-slate-700 uppercase tracking-tighter">
                    <BusFront size={18} className={selectedFromTripId === trip2Id ? 'text-primary' : 'text-slate-400'}/> 
                    {trip2 ? trip2.licensePlate : 'Chưa chọn xe 2'}
                  </div>
                  {selectedFromTripId === trip2Id && <Badge className="bg-primary text-white border-transparent px-3 py-1 font-black shadow-sm">NGUỒN</Badge>}
              </div>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin">
            <div className="flex h-full min-h-max">
                <div className={`flex-1 border-r border-slate-100 ${selectedFromTripId === trip1Id ? 'bg-primary/[0.02]' : ''}`}>
                    {trip1 ? (
                       <SeatMap 
                         seats={getAugmentedSeats(trip1)} 
                         busType={trip1.type} 
                         onSeatClick={(s) => handleSeatClick(s, trip1Id)} 
                         bookings={bookings.filter(b => b.items.some(i => i.tripId === trip1Id))}
                         currentTripId={trip1.id}
                       />
                    ) : (
                       <div className="h-40 flex items-center justify-center text-slate-300 italic text-sm">Chưa chọn xe 1</div>
                    )}
                </div>

                <div className={`flex-1 ${selectedFromTripId === trip2Id ? 'bg-primary/[0.02]' : ''}`}>
                    {trip2 ? (
                       <SeatMap 
                         seats={getAugmentedSeats(trip2)} 
                         busType={trip2.type} 
                         onSeatClick={(s) => handleSeatClick(s, trip2Id)} 
                         bookings={bookings.filter(b => b.items.some(i => i.tripId === trip2Id))}
                         currentTripId={trip2.id}
                       />
                    ) : (
                       <div className="h-40 flex items-center justify-center text-slate-300 italic text-sm">Chưa chọn xe 2</div>
                    )}
                </div>
            </div>
          </div>

          {selectedBooking && sourceTrip && targetTrip && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-md border border-indigo-200 shadow-2xl rounded-2xl p-4 flex flex-col gap-3 min-w-[420px] animate-in slide-in-from-bottom-4 z-50 ring-2 ring-indigo-500/10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm">
                            <ShoppingCart size={18}/>
                        </div>
                        <span className="font-black text-slate-800 text-sm">Chuẩn bị điều phối {selectedSeatIds.length} ghế</span>
                    </div>
                    <button onClick={() => { setSelectedBooking(null); setSelectedSeatIds([]); }} className="text-slate-400 hover:text-red-500 transition-colors"><X size={18}/></button>
                </div>
                
                <div className="flex flex-wrap gap-2 py-1">
                    {transferValidation?.results.map((r, i) => (
                        <Badge key={i} className={`h-8 px-2.5 rounded-lg border font-bold flex items-center gap-2 ${r.isSwap ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                           {r.sourceLabel} 
                           {r.isSwap ? <ArrowLeftRight size={12} className="animate-pulse"/> : <ArrowRight size={12}/>} 
                           {r.targetLabel || '?'}
                           {r.isSwap && <span className="text-[9px] font-black uppercase opacity-60 ml-1">Hoán đổi</span>}
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
                    {transferValidation?.isAllValid ? 'Xác nhận vào hàng chờ' : 'Lỗi đối chiếu vị trí'}
                </Button>
                {transferValidation?.results.some(r => r.isSwap) && (
                    <div className="text-[10px] text-orange-600 font-bold bg-orange-50/50 p-2 rounded-lg border border-orange-100 flex items-center gap-2">
                        <Repeat size={12}/> Vị trí đích đã có khách. Hệ thống sẽ hoán đổi khách giữa 2 xe.
                    </div>
                )}
            </div>
          )}
        </div>

        <div className="w-full lg:w-[340px] bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden shrink-0">
           <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-xs text-slate-800 uppercase tracking-wider">
                 <ShoppingCart size={16} className="text-indigo-600"/> Hàng chờ lưu ({transferQueue.length})
              </div>
              {transferQueue.length > 0 && (
                  <button onClick={() => setTransferQueue([])} className="text-[10px] font-bold text-red-500 hover:underline">Xóa hết</button>
              )}
           </div>

           <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
              {transferQueue.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-300 text-center px-4">
                      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                        <ShoppingCart size={24} className="opacity-20"/>
                      </div>
                      <p className="text-xs font-medium italic leading-relaxed">Chọn đoàn khách trên xe Nguồn để bắt đầu sắp xếp vào hàng chờ lưu.</p>
                  </div>
              ) : (
                  transferQueue.map(q => (
                      <div key={q.id} className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-2.5 relative group hover:border-indigo-300 transition-all">
                          <div className="flex justify-between items-center">
                              <span className="text-xs font-black text-slate-800">{q.phone}</span>
                              <button onClick={() => removeFromQueue(q.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                                  <X size={16}/>
                              </button>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] font-bold">
                             <Badge className="bg-indigo-600 text-white border-transparent h-6 px-2">{q.sourceLabel}</Badge>
                             {q.isSwap ? <ArrowLeftRight size={14} className="text-orange-500"/> : <ArrowRight size={14} className="text-indigo-400"/>}
                             <Badge className="bg-green-600 text-white border-transparent h-6 px-2">{q.targetLabel}</Badge>
                             <span className="text-[10px] text-slate-400 ml-auto font-medium">({q.posDesc})</span>
                          </div>
                          {q.isSwap && (
                              <div className="text-[10px] bg-orange-50 text-orange-700 p-2 rounded-xl border border-orange-100 font-bold flex flex-col gap-1">
                                  <div className="flex items-center gap-1.5"><Repeat size={10}/> Đổi chéo với khách:</div>
                                  <div className="pl-4 font-black">{q.swapPhone}</div>
                              </div>
                          )}
                      </div>
                  ))
              )}
           </div>

           <div className="p-4 border-t border-slate-200 bg-white space-y-3">
              <Button 
                onClick={handleSaveAll}
                disabled={transferQueue.length === 0 || isProcessing}
                className="w-full h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm uppercase tracking-wider shadow-xl shadow-indigo-500/20"
              >
                {isProcessing ? (
                   <><Loader2 className="animate-spin mr-2" size={18}/> Đang cập nhật...</>
                ) : (
                   <><Save className="mr-2" size={18}/> Lưu tất cả ({transferQueue.length})</>
                )}
              </Button>
              <p className="text-[10px] text-slate-400 text-center px-2">Hệ thống sẽ đồng thời cập nhật vị trí cho cả khách nguồn và khách bị hoán đổi (nếu có).</p>
           </div>
        </div>

      </div>
    </div>
  );
};
