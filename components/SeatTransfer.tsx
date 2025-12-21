
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
  ArrowLeftRight
} from 'lucide-react';
import { Button } from './ui/Button';
// Fix: Added missing Badge import
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
  const [selectedSourceSeat, setSelectedSourceSeat] = useState<Seat | null>(null);
  const [selectedTargetSeat, setSelectedTargetSeat] = useState<Seat | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Filter regular trips on the same day
  const availableTrips = useMemo(() => {
    return trips.filter(t => {
      const tripDate = new Date(t.departureTime.split(' ')[0]);
      return tripDate.toDateString() === selectedDate.toDateString() && t.type === BusType.SLEEPER;
    });
  }, [trips, selectedDate]);

  const sourceTrip = availableTrips.find(t => t.id === sourceTripId);
  const targetTrip = availableTrips.find(t => t.id === targetTripId);

  const sourceTripBookings = useMemo(() => {
    if (!sourceTrip) return [];
    return bookings.filter(b => 
      b.items.some(item => item.tripId === sourceTrip.id) && b.status !== 'cancelled'
    );
  }, [bookings, sourceTrip]);

  const handleSourceSeatClick = (seat: Seat) => {
    if (seat.status === SeatStatus.BOOKED || seat.status === SeatStatus.SOLD || seat.status === SeatStatus.HELD) {
      setSelectedSourceSeat(seat);
      toast({ type: 'info', title: 'Ghế nguồn', message: `Đã chọn ghế ${seat.label}` });
    } else {
      toast({ type: 'warning', title: 'Thao tác không hợp lệ', message: 'Vui lòng chọn ghế đã có khách.' });
    }
  };

  const handleTargetSeatClick = (seat: Seat) => {
    if (seat.status === SeatStatus.AVAILABLE) {
      setSelectedTargetSeat(seat);
      toast({ type: 'info', title: 'Ghế đích', message: `Đã chọn ghế ${seat.label}` });
    } else {
      toast({ type: 'warning', title: 'Thao tác không hợp lệ', message: 'Vui lòng chọn ghế trống.' });
    }
  };

  const handleTransfer = async () => {
    if (!sourceTripId || !targetTripId || !selectedSourceSeat || !selectedTargetSeat) return;

    // Tìm booking của ghế nguồn
    const booking = sourceTripBookings.find(b => 
      b.items.some(item => item.tripId === sourceTripId && item.seatIds.includes(selectedSourceSeat.id))
    );

    if (!booking) {
      toast({ type: 'error', title: 'Lỗi', message: 'Không tìm thấy đơn hàng của ghế nguồn.' });
      return;
    }

    setIsProcessing(true);
    try {
      await api.bookings.transferSeat(
        booking.id,
        sourceTripId,
        targetTripId,
        selectedSourceSeat.id,
        selectedTargetSeat.id
      );

      await onRefresh();
      
      toast({ 
        type: 'success', 
        title: 'Đổi chuyến thành công', 
        message: `Đã chuyển khách từ ${sourceTrip?.licensePlate} (${selectedSourceSeat.label}) sang ${targetTrip?.licensePlate} (${selectedTargetSeat.label})` 
      });

      // Reset selection
      setSelectedSourceSeat(null);
      setSelectedTargetSeat(null);
    } catch (e) {
      console.error(e);
      toast({ type: 'error', title: 'Lỗi', message: 'Không thể thực hiện đổi chuyến.' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      {/* Header Controls */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="flex-1 w-full">
            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Xe nguồn (Đang có khách)</label>
            <select 
              value={sourceTripId} 
              onChange={e => { setSourceTripId(e.target.value); setSelectedSourceSeat(null); }}
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
              onChange={e => { setTargetTripId(e.target.value); setSelectedTargetSeat(null); }}
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

      {/* Comparison Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Source Trip Column */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-320px)]">
          <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
             <div className="flex items-center gap-2">
                <BusFront size={18} className="text-slate-400"/>
                <span className="font-black text-slate-700 uppercase text-xs tracking-tighter">Bản đồ nguồn</span>
             </div>
             {selectedSourceSeat && (
                <Badge className="bg-primary text-white border-transparent">
                   Đã chọn: {selectedSourceSeat.label}
                </Badge>
             )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {sourceTrip ? (
               <SeatMap 
                 seats={sourceTrip.seats} 
                 busType={sourceTrip.type} 
                 onSeatClick={handleSourceSeatClick} 
                 bookings={sourceTripBookings}
                 currentTripId={sourceTrip.id}
                 swapSourceSeatId={selectedSourceSeat?.id}
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
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-320px)]">
           <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div className="flex items-center gap-2">
                 <BusFront size={18} className="text-slate-400"/>
                 <span className="font-black text-slate-700 uppercase text-xs tracking-tighter">Bản đồ đích</span>
              </div>
              {selectedTargetSeat && (
                <Badge className="bg-green-600 text-white border-transparent">
                   Sắp xếp vào: {selectedTargetSeat.label}
                </Badge>
              )}
           </div>
           <div className="flex-1 overflow-y-auto">
             {targetTrip ? (
                <SeatMap 
                  seats={targetTrip.seats} 
                  busType={targetTrip.type} 
                  onSeatClick={handleTargetSeatClick} 
                  bookings={bookings.filter(b => b.items.some(i => i.tripId === targetTrip.id))}
                  currentTripId={targetTrip.id}
                  swapSourceSeatId={selectedTargetSeat?.id}
                />
             ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 p-8 text-center opacity-40">
                   <AlertCircle size={48} className="mb-4" />
                   <p className="text-sm font-medium">Vui lòng chọn xe đích để xem sơ đồ</p>
                </div>
             )}
           </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-lg flex items-center justify-between">
         <div className="flex items-center gap-4 text-sm">
            <div className="flex flex-col">
               <span className="text-[10px] font-bold text-slate-400 uppercase">Khách được chuyển</span>
               <span className="font-black text-slate-800">{selectedSourceSeat ? `Ghế ${selectedSourceSeat.label}` : '---'}</span>
            </div>
            <ChevronRight className="text-slate-300" />
            <div className="flex flex-col">
               <span className="text-[10px] font-bold text-slate-400 uppercase">Vị trí mới</span>
               <span className="font-black text-green-600">{selectedTargetSeat ? `Ghế ${selectedTargetSeat.label}` : '---'}</span>
            </div>
         </div>

         <Button 
           onClick={handleTransfer}
           disabled={!selectedSourceSeat || !selectedTargetSeat || isProcessing}
           className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 h-12 rounded-xl font-black text-base shadow-xl shadow-indigo-200"
         >
            {isProcessing ? (
               <><Loader2 className="animate-spin mr-2" size={20}/> Đang thực hiện...</>
            ) : (
               <><CheckCircle2 className="mr-2" size={20}/> Xác nhận đổi xe</>
            )}
         </Button>
      </div>
    </div>
  );
};
