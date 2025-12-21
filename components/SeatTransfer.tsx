
import React, { useState, useMemo } from 'react';
import { BusTrip, Seat, Booking, SeatStatus, BusType } from '../types';
import { SeatMap } from './SeatMap';
import { 
  ArrowRightLeft, 
  BusFront, 
  ChevronRight, 
  AlertCircle, 
  CheckCircle2,
  Loader2,
  ArrowLeftRight,
  Info,
  ShieldAlert,
  MousePointer2,
  RefreshCw,
  ArrowRight,
  MapIcon
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

export const SeatTransfer: React.FC<SeatTransferProps> = ({ trips, bookings, selectedDate, onRefresh }) => {
  const { toast } = useToast();
  const [trip1Id, setTrip1Id] = useState<string>('');
  const [trip2Id, setTrip2Id] = useState<string>('');
  
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedFromTripId, setSelectedFromTripId] = useState<string | null>(null);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  
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
    toast({ type: 'info', title: 'Đã cập nhật', message: 'Dữ liệu ghế mới nhất đã được tải.' });
  };

  // Hàm helper mô tả vị trí ghế (Tầng-Hàng-Cột)
  const getPositionDesc = (s: Seat | undefined) => {
    if (!s) return 'N/A';
    if (s.isFloorSeat) return `Sàn-${(s.row ?? 0) + 1}`;
    const rowDesc = (s.row ?? 0) === 6 ? 'Băng5' : `H${(s.row ?? 0) + 1}`;
    return `T${s.floor}-${rowDesc}-C${(s.col ?? 0) + 1}`;
  };

  // Danh sách hiển thị các mô tả vị trí ghế đang chọn
  const sourceSeatsLabels = useMemo(() => {
    if (!sourceTrip) return [];
    return selectedSeatIds.map(sid => {
        const s = sourceTrip.seats.find(seat => seat.id === sid);
        return s ? `${s.label} (${getPositionDesc(s)})` : sid;
    });
  }, [selectedSeatIds, sourceTrip]);

  // KIỂM TRA TÍNH KHẢ DỤNG: ĐỐI CHIẾU THEO TỌA ĐỘ VẬT LÝ
  const transferValidation = useMemo(() => {
    if (!selectedBooking || !targetTrip || !sourceTrip || selectedSeatIds.length === 0) return null;

    const results = selectedSeatIds.map(seatId => {
      const sourceSeat = sourceTrip.seats.find(s => s.id === seatId);
      if (!sourceSeat) return { sourceSeatId: seatId, isAvailable: false, sourceLabel: '?', targetSeatId: '', posDesc: '?' };

      // TÌM GHẾ ĐÍCH THEO TỌA ĐỘ: floor, row, col, isFloorSeat
      const targetSeatByPos = targetTrip.seats.find(s => 
        s.floor === sourceSeat.floor && 
        s.row === sourceSeat.row && 
        s.col === sourceSeat.col && 
        !!s.isFloorSeat === !!sourceSeat.isFloorSeat
      );
      
      // KIỂM TRA TRÙNG THỰC TẾ TRÊN BOOKINGS (Tránh dữ liệu rác/ghost seats)
      const isOccupiedByBooking = bookings.some(b => 
        b.status !== 'cancelled' && 
        b.items.some(item => item.tripId === targetTrip.id && item.seatIds.includes(targetSeatByPos?.id || ''))
      );

      const isAvailable = targetSeatByPos && !isOccupiedByBooking;
      
      return {
        sourceSeatId: seatId,
        sourceLabel: sourceSeat.label,
        posDesc: getPositionDesc(sourceSeat),
        targetSeatId: targetSeatByPos?.id || '',
        isAvailable: !!isAvailable
      };
    });

    const isAllAvailable = results.every(r => r.isAvailable);
    return {
      results,
      isAllAvailable,
      isPaid: selectedBooking.status === 'payment'
    };
  }, [selectedBooking, targetTrip, sourceTrip, selectedSeatIds, bookings]);

  const handleSeatClick = (seat: Seat, tripId: string) => {
    if (!trip1Id || !trip2Id) {
        toast({ type: 'warning', title: 'Chưa chọn xe', message: 'Vui lòng chọn đủ 2 xe để thực hiện đối chiếu.' });
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
            const isAlreadySelected = prev.includes(seat.id);
            const newList = isAlreadySelected ? prev.filter(id => id !== seat.id) : [...prev, seat.id];
            if (newList.length === 0) {
              setSelectedBooking(null);
              setSelectedFromTripId(null);
            }
            return newList;
          });
        } 
        else {
          const tripItem = booking.items.find(i => i.tripId === tripId);
          if (tripItem) {
            setSelectedBooking(booking);
            setSelectedFromTripId(tripId);
            setSelectedSeatIds(tripItem.seatIds);
            toast({ 
              type: 'info', 
              title: 'Đã nhận diện nhóm khách', 
              message: `Đã chọn đoàn khách ${booking.passenger.phone} (${tripItem.seatIds.length} ghế). Hệ thống sẽ tự động tìm vị trí tương ứng bên xe kia.` 
            });
          }
        }
      }
    } else {
        if (selectedFromTripId === tripId) {
            setSelectedBooking(null);
            setSelectedFromTripId(null);
            setSelectedSeatIds([]);
        } else {
            toast({ type: 'warning', title: 'Thao tác không hợp lệ', message: 'Vui lòng chọn ghế đang có người ngồi.' });
        }
    }
  };

  const handleTransfer = async () => {
    if (!selectedBooking || !selectedFromTripId || !targetTrip || !transferValidation) return;

    if (!transferValidation.isAllAvailable) {
      toast({ 
        type: 'error', 
        title: 'Vị trí đích không khả dụng', 
        message: 'Các vị trí vật lý tương ứng trên xe đích không trống hoặc không tồn tại.' 
      });
      return;
    }

    setIsProcessing(true);
    try {
      const seatTransfers = transferValidation.results.map(r => ({
        sourceSeatId: r.sourceSeatId,
        targetSeatId: r.targetSeatId
      }));

      await api.bookings.transferSeat(
        selectedBooking.id,
        selectedFromTripId,
        targetTrip.id,
        seatTransfers
      );

      await onRefresh();
      
      toast({ 
        type: 'success', 
        title: 'Đổi đúng vị trí thành công', 
        message: `Đã chuyển ${seatTransfers.length} ghế dựa trên tọa độ sơ đồ sang xe ${targetTrip.licensePlate}` 
      });

      setSelectedBooking(null);
      setSelectedSeatIds([]);
      setSelectedFromTripId(null);
    } catch (e) {
      console.error(e);
      toast({ type: 'error', title: 'Lỗi', message: 'Không thể thực hiện đổi chuyến.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const getHighlightedSeats = (trip: BusTrip | undefined) => {
    if (!trip) return [];
    if (selectedFromTripId !== trip.id) return trip.seats;
    return trip.seats.map(s => {
      if (selectedSeatIds.includes(s.id)) return { ...s, status: SeatStatus.SELECTED };
      return s;
    });
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      {/* Header Controls */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="flex-1 w-full">
            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Xe đối chiếu số 1</label>
            <select 
              value={trip1Id} 
              onChange={e => { setTrip1Id(e.target.value); setSelectedBooking(null); setSelectedSeatIds([]); }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-primary/10 transition-all"
            >
              <option value="">-- Chọn xe --</option>
              {availableTrips.map(t => (
                <option key={t.id} value={t.id}>{t.departureTime.split(' ')[1]} - {t.licensePlate} ({t.route})</option>
              ))}
            </select>
          </div>

          <div className="shrink-0 flex flex-col items-center gap-1">
             <div className="flex items-center justify-center w-10 h-10 bg-primary/5 text-primary rounded-full border border-primary/20">
                <ArrowLeftRight size={20} />
             </div>
             <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isRefreshing} className="h-6 text-[10px] font-black uppercase text-slate-400">
                {isRefreshing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                <span className="ml-1">Đồng bộ</span>
             </Button>
          </div>

          <div className="flex-1 w-full">
            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Xe đối chiếu số 2</label>
            <select 
              value={trip2Id} 
              onChange={e => { setTrip2Id(e.target.value); setSelectedBooking(null); setSelectedSeatIds([]); }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-primary/10 transition-all"
            >
              <option value="">-- Chọn xe --</option>
              {availableTrips.filter(t => t.id !== trip1Id).map(t => (
                <option key={t.id} value={t.id}>{t.departureTime.split(' ')[1]} - {t.licensePlate} ({t.route})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Logic Warning */}
      {selectedBooking && sourceTrip && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-4 animate-in slide-in-from-top-2">
            <div className="p-2 bg-white rounded-lg text-blue-600 shadow-sm">
                <MapIcon size={20} />
            </div>
            <div className="flex-1">
                <h4 className="font-black text-blue-900 text-sm">Chế độ chuyển đổi đúng vị trí sơ đồ</h4>
                <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                    Đang chọn <strong>{selectedSeatIds.length} ghế</strong> từ xe {sourceTrip.licensePlate}. 
                    Hệ thống sẽ đối chiếu theo <strong>Tầng - Hàng - Cột</strong> sang xe {targetTrip?.licensePlate}. 
                    Bạn có thể click vào ghế trên sơ đồ xe nguồn để tùy chỉnh danh sách ghế muốn chuyển.
                </p>
                {selectedBooking.status === 'payment' && (
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] font-black uppercase text-red-600">
                      <ShieldAlert size={14}/> Ràng buộc nghiêm ngặt: Vé đã thanh toán chỉ được đổi đúng tọa độ vật lý tương ứng.
                  </div>
                )}
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => { setSelectedBooking(null); setSelectedSeatIds([]); setSelectedFromTripId(null); }}
              className="text-blue-400 hover:text-blue-600"
            >
               Hủy chọn
            </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Column 1 */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-380px)]">
          <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
             <div className="flex items-center gap-2 text-xs font-black text-slate-700 uppercase tracking-tighter">
                <BusFront size={18} className="text-slate-400"/> {trip1 ? trip1.licensePlate : 'Chưa chọn xe'}
             </div>
             {selectedFromTripId === trip1Id && (
                <Badge className="bg-primary text-white border-transparent px-3 py-1 font-black animate-pulse">NGUỒN</Badge>
             )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {trip1 ? (
               <SeatMap 
                 seats={getHighlightedSeats(trip1)} 
                 busType={trip1.type} 
                 onSeatClick={(s) => handleSeatClick(s, trip1Id)} 
                 bookings={bookings.filter(b => b.items.some(i => i.tripId === trip1Id))}
                 currentTripId={trip1.id}
               />
            ) : (
               <div className="h-full flex flex-col items-center justify-center text-slate-300 p-8 text-center opacity-40">
                  <AlertCircle size={48} className="mb-4" />
                  <p className="text-sm font-medium italic">Vui lòng chọn xe đối chiếu số 1</p>
               </div>
            )}
          </div>
        </div>

        {/* Column 2 */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-380px)]">
           <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div className="flex items-center gap-2 text-xs font-black text-slate-700 uppercase tracking-tighter">
                 <BusFront size={18} className="text-slate-400"/> {trip2 ? trip2.licensePlate : 'Chưa chọn xe'}
              </div>
              {selectedFromTripId === trip2Id && (
                <Badge className="bg-primary text-white border-transparent px-3 py-1 font-black animate-pulse">NGUỒN</Badge>
              )}
           </div>
           <div className="flex-1 overflow-y-auto">
             {trip2 ? (
                <SeatMap 
                  seats={getHighlightedSeats(trip2)} 
                  busType={trip2.type} 
                  onSeatClick={(s) => handleSeatClick(s, trip2Id)} 
                  bookings={bookings.filter(b => b.items.some(i => i.tripId === trip2Id))}
                  currentTripId={trip2.id}
                />
             ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 p-8 text-center opacity-40">
                   <AlertCircle size={48} className="mb-4" />
                   <p className="text-sm font-medium italic">Vui lòng chọn xe đối chiếu số 2</p>
                </div>
             )}
           </div>
        </div>
      </div>

      {/* Detailed Position Footer */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-lg flex flex-col md:flex-row items-center justify-between gap-6">
         <div className="flex-1 flex items-center gap-6 text-sm w-full">
            <div className="flex flex-col min-w-0">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Vị trí nguồn ({selectedSeatIds.length})</span>
               <div className="flex gap-2 flex-wrap">
                  {sourceSeatsLabels.length > 0 ? sourceSeatsLabels.map((lbl, idx) => (
                    <Badge key={idx} className="bg-slate-100 text-slate-700 border-slate-200 font-bold py-1 px-2.5 rounded-lg shadow-xs">{lbl}</Badge>
                  )) : <span className="text-slate-300 font-bold italic text-xs">Chưa chọn ghế</span>}
               </div>
            </div>
            
            {sourceTrip && targetTrip && selectedSeatIds.length > 0 && (
                <div className="shrink-0 flex items-center justify-center h-10 w-10 bg-blue-50 rounded-full border border-blue-100">
                    <ArrowRight size={20} className="text-blue-600 animate-pulse" />
                </div>
            )}

            <div className="flex flex-col min-w-0">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Trạng thái xe đích (Theo tọa độ)</span>
               <div className="flex gap-2 flex-wrap">
                  {transferValidation ? transferValidation.results.map((r, i) => (
                    <Badge key={i} className={`${r.isAvailable ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'} font-bold py-1 px-2.5 rounded-lg shadow-xs flex items-center gap-1.5`}>
                       {r.isAvailable ? <CheckCircle2 size={12}/> : <AlertCircle size={12}/>}
                       {r.posDesc}
                    </Badge>
                  )) : <span className="text-slate-300 font-bold italic text-xs">Chờ đối chiếu tọa độ...</span>}
               </div>
            </div>
         </div>

         <div className="shrink-0 flex items-center gap-4 w-full md:w-auto">
             {transferValidation && !transferValidation.isAllAvailable && (
                 <div className="flex items-center gap-2 text-red-600 font-black text-xs bg-red-50 px-4 py-2.5 rounded-xl border border-red-100 animate-bounce">
                    <ShieldAlert size={16}/> Vị trí đích không trống
                 </div>
             )}
             <Button 
               onClick={handleTransfer}
               disabled={selectedSeatIds.length === 0 || !trip1Id || !trip2Id || !transferValidation?.isAllAvailable || isProcessing}
               className={`flex-1 md:flex-initial h-12 px-10 rounded-xl font-black text-sm uppercase tracking-wider transition-all shadow-xl active:scale-95 ${
                 transferValidation?.isAllAvailable 
                 ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200' 
                 : 'bg-slate-400 text-white cursor-not-allowed shadow-none'
               }`}
             >
                {isProcessing ? (
                   <><Loader2 className="animate-spin mr-2" size={20}/> Đang xử lý...</>
                ) : (
                   <><CheckCircle2 className="mr-2" size={20}/> Xác nhận đổi {selectedSeatIds.length} ghế</>
                )}
             </Button>
         </div>
      </div>
    </div>
  );
};
