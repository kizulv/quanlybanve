
import React, { useState, useMemo } from 'react';
import { BusTrip, Seat, Booking, SeatStatus, BusType } from '../types';
import { SeatMap } from './SeatMap';
import { 
  ArrowRightLeft, 
  BusFront, 
  ChevronRight, 
  Calendar, 
  AlertCircle, 
  CheckCircle2,
  Loader2,
  ArrowLeftRight,
  Info,
  ShieldAlert,
  MousePointer2
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
  const [sourceTripId, setSourceTripId] = useState<string>('');
  const [targetTripId, setTargetTripId] = useState<string>('');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Lọc các chuyến xe giường đơn (thường) trong cùng ngày
  const availableTrips = useMemo(() => {
    return trips.filter(t => {
      const tripDate = new Date(t.departureTime.split(' ')[0]);
      return tripDate.toDateString() === selectedDate.toDateString() && t.type === BusType.SLEEPER;
    });
  }, [trips, selectedDate]);

  const sourceTrip = availableTrips.find(t => t.id === sourceTripId);
  const targetTrip = availableTrips.find(t => t.id === targetTripId);

  // Danh sách hiển thị các nhãn ghế đang chọn
  const sourceSeatsLabels = useMemo(() => {
    if (!sourceTrip) return [];
    return selectedSeatIds.map(sid => sourceTrip.seats.find(s => s.id === sid)?.label || sid);
  }, [selectedSeatIds, sourceTrip]);

  // Kiểm tra tính khả dụng trên xe đích
  const transferValidation = useMemo(() => {
    if (!selectedBooking || !targetTrip || selectedSeatIds.length === 0) return null;

    const results = selectedSeatIds.map(seatId => {
      // Tìm label của ghế nguồn để đối chiếu
      const sourceSeat = sourceTrip?.seats.find(s => s.id === seatId);
      const targetSeatByLabel = targetTrip.seats.find(s => s.label === sourceSeat?.label);
      
      const isAvailable = targetSeatByLabel?.status === SeatStatus.AVAILABLE;
      
      return {
        sourceSeatId: seatId,
        sourceLabel: sourceSeat?.label || seatId,
        targetSeatId: targetSeatByLabel?.id || '',
        isAvailable
      };
    });

    const isAllAvailable = results.every(r => r.isAvailable);
    const isPaid = selectedBooking.status === 'payment';

    return {
      results,
      isAllAvailable,
      isPaid
    };
  }, [selectedBooking, targetTrip, selectedSeatIds, sourceTrip]);

  const handleSourceSeatClick = (seat: Seat) => {
    if (seat.status === SeatStatus.BOOKED || seat.status === SeatStatus.SOLD || seat.status === SeatStatus.HELD) {
      // Tìm booking chứa ghế này
      const booking = bookings.find(b => 
        b.status !== 'cancelled' && 
        b.items.some(item => item.tripId === sourceTripId && item.seatIds.includes(seat.id))
      );

      if (booking) {
        // TRƯỜNG HỢP 1: Click vào ghế thuộc ĐƠN HÀNG ĐANG CHỌN -> Toggle (Bỏ chọn/Chọn lại)
        if (selectedBooking && selectedBooking.id === booking.id) {
          setSelectedSeatIds(prev => {
            const isAlreadySelected = prev.includes(seat.id);
            const newList = isAlreadySelected 
              ? prev.filter(id => id !== seat.id) 
              : [...prev, seat.id];
            
            // Nếu bỏ chọn sạch sẽ thì reset luôn booking
            if (newList.length === 0) {
              setSelectedBooking(null);
            }
            return newList;
          });
        } 
        // TRƯỜNG HỢP 2: Click vào đơn hàng khác -> Chọn toàn bộ nhóm mới
        else {
          const tripItem = booking.items.find(i => i.tripId === sourceTripId);
          if (tripItem) {
            setSelectedBooking(booking);
            setSelectedSeatIds(tripItem.seatIds);
            toast({ 
              type: 'info', 
              title: 'Đã nhận diện nhóm khách', 
              message: `Chọn tất cả ${tripItem.seatIds.length} ghế của khách ${booking.passenger.phone}. Bạn có thể click để bỏ chọn từng ghế nếu cần.` 
            });
          }
        }
      }
    } else {
      toast({ type: 'warning', title: 'Thao tác không hợp lệ', message: 'Vui lòng chọn ghế đã có khách.' });
    }
  };

  const handleTransfer = async () => {
    if (!selectedBooking || !targetTrip || !transferValidation || selectedSeatIds.length === 0) return;

    if (!transferValidation.isAllAvailable) {
      toast({ 
        type: 'error', 
        title: 'Vị trí đã bị chiếm', 
        message: 'Một số vị trí tương ứng trên xe đích đã có khách. Không thể thực hiện chuyển nhóm.' 
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
        sourceTripId,
        targetTripId,
        seatTransfers
      );

      await onRefresh();
      
      toast({ 
        type: 'success', 
        title: 'Đổi chuyến thành công', 
        message: `Đã chuyển ${seatTransfers.length} ghế từ ${sourceTrip?.licensePlate} sang ${targetTrip?.licensePlate}` 
      });

      setSelectedBooking(null);
      setSelectedSeatIds([]);
    } catch (e) {
      console.error(e);
      toast({ type: 'error', title: 'Lỗi', message: 'Không thể thực hiện đổi chuyến.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Mock ghế nguồn để highlight những ghế được chọn trong SeatMap
  const highlightedSourceSeats = useMemo(() => {
    if (!sourceTrip) return [];
    return sourceTrip.seats.map(s => {
      if (selectedSeatIds.includes(s.id)) {
        return { ...s, status: SeatStatus.SELECTED };
      }
      return s;
    });
  }, [sourceTrip, selectedSeatIds]);

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      {/* Header Controls */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="flex-1 w-full">
            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Xe nguồn (Đang có khách)</label>
            <select 
              value={sourceTripId} 
              onChange={e => { 
                setSourceTripId(e.target.value); 
                setSelectedBooking(null); 
                setSelectedSeatIds([]);
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-primary/10 transition-all"
            >
              <option value="">-- Chọn xe đi --</option>
              {availableTrips.map(t => (
                <option key={t.id} value={t.id}>{t.departureTime.split(' ')[1]} - {t.licensePlate} ({t.route})</option>
              ))}
            </select>
          </div>

          <div className="shrink-0 flex items-center justify-center w-12 h-12 bg-primary/5 text-primary rounded-full border border-primary/20">
             <ArrowLeftRight size={24} />
          </div>

          <div className="flex-1 w-full">
            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Xe đích (Ghế trống)</label>
            <select 
              value={targetTripId} 
              onChange={e => { setTargetTripId(e.target.value); }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-primary/10 transition-all"
            >
              <option value="">-- Chọn xe đến --</option>
              {availableTrips.filter(t => t.id !== sourceTripId).map(t => (
                <option key={t.id} value={t.id}>{t.departureTime.split(' ')[1]} - {t.licensePlate} ({t.route})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Group Info Warning */}
      {selectedBooking && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-start gap-4 animate-in slide-in-from-top-2">
            <div className="p-2 bg-white rounded-lg text-indigo-600 shadow-sm">
                <Info size={20} />
            </div>
            <div className="flex-1">
                <h4 className="font-black text-indigo-900 text-sm">Chế độ chọn lọc theo nhóm</h4>
                <p className="text-xs text-indigo-700 mt-1 leading-relaxed">
                    Đã nhận diện đơn hàng của khách <strong>{selectedBooking.passenger.phone}</strong>. 
                    Bạn có thể <strong>click trực tiếp trên sơ đồ nguồn</strong> để bỏ chọn những ghế không muốn chuyển đi.
                </p>
                {selectedBooking.status === 'payment' && (
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] font-black uppercase text-red-600">
                      <ShieldAlert size={14}/> Ràng buộc: Vé đã thanh toán chỉ được đổi đúng vị trí.
                  </div>
                )}
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => { setSelectedBooking(null); setSelectedSeatIds([]); }}
              className="text-indigo-400 hover:text-indigo-600"
            >
               Hủy chọn nhóm
            </Button>
        </div>
      )}

      {/* Comparison Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Source Trip Column */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-380px)]">
          <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
             <div className="flex items-center gap-2">
                <MousePointer2 size={18} className="text-primary"/>
                <span className="font-black text-slate-700 uppercase text-xs tracking-tighter">Bản đồ nguồn (Chọn ghế muốn chuyển)</span>
             </div>
             {selectedSeatIds.length > 0 && (
                <Badge className="bg-primary text-white border-transparent px-3 py-1 font-black">
                   ĐANG CHỌN: {sourceSeatsLabels.join(', ')}
                </Badge>
             )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {sourceTrip ? (
               <SeatMap 
                 seats={highlightedSourceSeats} 
                 busType={sourceTrip.type} 
                 onSeatClick={handleSourceSeatClick} 
                 bookings={bookings.filter(b => b.items.some(i => i.tripId === sourceTripId))}
                 currentTripId={sourceTrip.id}
                 swapSourceSeatId={selectedSeatIds.length === 1 ? selectedSeatIds[0] : undefined}
               />
            ) : (
               <div className="h-full flex flex-col items-center justify-center text-slate-300 p-8 text-center opacity-40">
                  <AlertCircle size={48} className="mb-4" />
                  <p className="text-sm font-medium">Vui lòng chọn xe nguồn để xem sơ đồ</p>
               </div>
            )}
          </div>
        </div>

        {/* Target Trip Column */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-380px)]">
           <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div className="flex items-center gap-2">
                 <BusFront size={18} className="text-slate-400"/>
                 <span className="font-black text-slate-700 uppercase text-xs tracking-tighter">Bản đồ đích (Đối chiếu)</span>
              </div>
              {transferValidation && (
                <Badge className={`${transferValidation.isAllAvailable ? 'bg-green-600' : 'bg-red-600'} text-white border-transparent px-3 py-1 font-black uppercase`}>
                   {transferValidation.isAllAvailable ? 'KHẢ DỤNG' : 'BỊ TRÙNG VỊ TRÍ'}
                </Badge>
              )}
           </div>
           <div className="flex-1 overflow-y-auto">
             {targetTrip ? (
                <SeatMap 
                  seats={targetTrip.seats} 
                  busType={targetTrip.type} 
                  onSeatClick={() => {}} // Đóng click ở đích vì chúng ta map theo label tương ứng
                  bookings={bookings.filter(b => b.items.some(i => i.tripId === targetTrip.id))}
                  currentTripId={targetTrip.id}
                />
             ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 p-8 text-center opacity-40">
                   <AlertCircle size={48} className="mb-4" />
                   <p className="text-sm font-medium">Vui lòng chọn xe đích để xem đối chiếu</p>
                </div>
             )}
           </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-lg flex items-center justify-between">
         <div className="flex items-center gap-6 text-sm">
            <div className="flex flex-col">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Ghế nguồn ({selectedSeatIds.length})</span>
               <div className="flex gap-1.5 flex-wrap max-w-[300px]">
                  {sourceSeatsLabels.length > 0 ? sourceSeatsLabels.map(s => (
                    <Badge key={s} className="bg-slate-100 text-slate-700 border-slate-200 font-black">{s}</Badge>
                  )) : <span className="text-slate-300 font-bold italic">Chưa chọn ghế</span>}
               </div>
            </div>
            <ChevronRight className="text-slate-300" />
            <div className="flex flex-col">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Vị trí xe đích</span>
               <div className="flex gap-1.5 flex-wrap max-w-[300px]">
                  {transferValidation ? transferValidation.results.map((r, i) => (
                    <Badge key={i} className={`${r.isAvailable ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'} font-black`}>
                       {r.sourceLabel}
                    </Badge>
                  )) : <span className="text-slate-300 font-bold italic">Chờ đối chiếu</span>}
               </div>
            </div>
         </div>

         <div className="flex items-center gap-4">
             {transferValidation && !transferValidation.isAllAvailable && (
                 <div className="flex items-center gap-2 text-red-600 font-bold text-xs bg-red-50 px-4 py-2 rounded-xl border border-red-100">
                    <ShieldAlert size={16}/>
                    Không thể chuyển vì trùng ghế
                 </div>
             )}
             <Button 
               onClick={handleTransfer}
               disabled={selectedSeatIds.length === 0 || !targetTripId || !transferValidation?.isAllAvailable || isProcessing}
               className={`${transferValidation?.isAllAvailable ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-400'} text-white px-8 h-12 rounded-xl font-black text-base shadow-xl shadow-indigo-200 transition-all active:scale-95`}
             >
                {isProcessing ? (
                   <><Loader2 className="animate-spin mr-2" size={20}/> Đang thực hiện...</>
                ) : (
                   <><CheckCircle2 className="mr-2" size={20}/> Xác nhận chuyển {selectedSeatIds.length} ghế</>
                )}
             </Button>
         </div>
      </div>
    </div>
  );
};
