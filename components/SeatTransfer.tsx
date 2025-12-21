
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
  MapIcon,
  Users,
  AlertTriangle,
  CheckSquare,
  Square
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

export const SeatTransfer: React.FC<SeatTransferProps> = ({ trips, bookings, selectedDate, onRefresh }) => {
  const { toast } = useToast();
  const [trip1Id, setTrip1Id] = useState<string>('');
  const [trip2Id, setTrip2Id] = useState<string>('');
  
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedFromTripId, setSelectedFromTripId] = useState<string | null>(null);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  
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
    // Băng 5 thường có row >= 6 (tùy cấu hình)
    const isBench = (s.row ?? 0) >= 6;
    const rowDesc = isBench ? 'Băng5' : `H${(s.row ?? 0) + 1}`;
    return `T${s.floor}-${rowDesc}-C${(s.col ?? 0) + 1}`;
  };

  const sourceSeatsLabels = useMemo(() => {
    if (!sourceTrip) return [];
    return selectedSeatIds.map(sid => {
        const s = sourceTrip.seats.find(seat => seat.id === sid);
        return s ? `${s.label} (${getPositionDesc(s)})` : sid;
    });
  }, [selectedSeatIds, sourceTrip]);

  // LOGIC ĐỐI CHIẾU VỊ TRÍ THÔNG MINH
  const transferValidation = useMemo(() => {
    if (!selectedBooking || !targetTrip || !sourceTrip || selectedSeatIds.length === 0) return null;

    const results = selectedSeatIds.map(seatId => {
      const sourceSeat = sourceTrip.seats.find(s => s.id === seatId);
      if (!sourceSeat) return { sourceSeatId: seatId, isAvailable: false, sourceLabel: '?', targetSeatId: '', posDesc: '?' };

      const isSourceBench = (sourceSeat.row ?? 0) >= 6;

      // Tìm ghế đích theo tọa độ logic
      const targetSeatByPos = targetTrip.seats.find(s => {
        // 1. Cùng tầng
        if (s.floor !== sourceSeat.floor) return false;
        // 2. Cùng loại (Sàn hoặc Ghế tiêu chuẩn)
        if (!!s.isFloorSeat !== !!sourceSeat.isFloorSeat) return false;
        
        // 3. Xử lý Băng 5: Nếu là băng 5 thì chỉ cần khớp cột (cùng là băng 5)
        if (isSourceBench) {
            const isTargetBench = (s.row ?? 0) >= 6;
            return isTargetBench && s.col === sourceSeat.col;
        }

        // 4. Ghế thường: Khớp hàng và cột
        return s.row === sourceSeat.row && s.col === sourceSeat.col;
      });
      
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

    const resultsWithValidTarget = results.filter(r => r.targetSeatId !== '');
    const isAllMapped = resultsWithValidTarget.length === selectedSeatIds.length;

    return {
      results,
      isAllAvailable: isAllMapped && results.every(r => r.isAvailable),
      isPaid: selectedBooking.status === 'payment'
    };
  }, [selectedBooking, targetTrip, sourceTrip, selectedSeatIds, bookings]);

  const handleSeatClick = (seat: Seat, tripId: string) => {
    if (!trip1Id || !trip2Id) {
        toast({ type: 'warning', title: 'Chưa chọn xe', message: 'Vui lòng chọn đủ 2 xe để đối chiếu.' });
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

  const selectFullGroup = () => {
      if (!selectedBooking || !selectedFromTripId) return;
      const tripItem = selectedBooking.items.find(i => i.tripId === selectedFromTripId);
      if (tripItem) {
          setSelectedSeatIds(tripItem.seatIds);
          toast({ type: 'success', title: 'Đã chọn cả đoàn', message: `Đã chọn toàn bộ ${tripItem.seatIds.length} ghế.` });
      }
  };

  const handleTransferInitiate = () => {
    if (!selectedBooking || !selectedFromTripId) return;
    
    const tripItem = selectedBooking.items.find(i => i.tripId === selectedFromTripId);
    if (!tripItem) return;

    const isPartialTransfer = selectedSeatIds.length < tripItem.seatIds.length;
    
    if (isPartialTransfer) {
      setShowSplitWarning(true);
    } else {
      handleTransfer();
    }
  };

  const handleTransfer = async () => {
    if (!selectedBooking || !selectedFromTripId || !targetTrip || !transferValidation) return;

    if (!transferValidation.isAllAvailable) {
      toast({ 
        type: 'error', 
        title: 'Lỗi đối chiếu', 
        message: 'Có ghế không tìm thấy vị trí tương ứng hoặc vị trí đích đã có khách.' 
      });
      return;
    }

    setIsProcessing(true);
    setShowSplitWarning(false);

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
        title: 'Thành công', 
        message: `Đã chuyển ${seatTransfers.length} ghế sang xe ${targetTrip.licensePlate}` 
      });

      setSelectedBooking(null);
      setSelectedSeatIds([]);
      setSelectedFromTripId(null);
    } catch (e) {
      console.error(e);
      toast({ type: 'error', title: 'Lỗi', message: 'Không thể thực hiện chuyển ghế.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const getHighlightedSeats = (trip: BusTrip | undefined) => {
    if (!trip) return [];
    if (selectedFromTripId === trip.id && selectedBooking) {
      const tripItem = selectedBooking.items.find(i => i.tripId === trip.id);
      const groupSeatIds = tripItem ? tripItem.seatIds : [];
      return trip.seats.map(s => {
        if (selectedSeatIds.includes(s.id)) return { ...s, status: SeatStatus.SELECTED };
        if (groupSeatIds.includes(s.id)) return { ...s, status: SeatStatus.HELD };
        return s;
      });
    }
    return trip.seats;
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      {/* Header Controls */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="flex-1 w-full">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Xe 1 (Giường đơn)</label>
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
             <div className="flex items-center justify-center w-10 h-10 bg-primary/5 text-primary rounded-full border border-primary/20 shadow-inner">
                <ArrowLeftRight size={20} />
             </div>
             <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isRefreshing} className="h-6 text-[10px] font-black uppercase text-slate-400 hover:text-primary">
                {isRefreshing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                <span className="ml-1">Đồng bộ</span>
             </Button>
          </div>

          <div className="flex-1 w-full">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Xe 2 (Giường đơn)</label>
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

      {/* Group Control Panel */}
      {selectedBooking && sourceTrip && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center gap-4 animate-in slide-in-from-top-2">
            <div className="p-3 bg-white rounded-xl text-indigo-600 shadow-sm shrink-0">
                <Users size={24} />
            </div>
            <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                    <h4 className="font-black text-indigo-900 text-sm">Đoàn khách: {selectedBooking.passenger.phone}</h4>
                    <Badge className="bg-indigo-600 text-white font-black px-2.5 py-0.5 text-[10px] rounded-lg">
                        ĐÃ CHỌN {selectedSeatIds.length} / {selectedBooking.items.find(i => i.tripId === selectedFromTripId)?.seatIds.length} GHẾ
                    </Badge>
                    <div className="flex items-center gap-1.5 ml-2">
                        <div className="w-2 h-2 rounded-full bg-primary"></div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Ghế sẽ chuyển</span>
                        <div className="w-2 h-2 rounded-full bg-purple-500 ml-2"></div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Ghế ở lại</span>
                    </div>
                </div>
                <p className="text-xs text-indigo-700 mt-1.5 leading-relaxed">
                    Bạn có thể click trực tiếp vào các ghế <span className="text-purple-600 font-black">Tím</span> để thêm vào danh sách chuyển, hoặc click <span className="text-primary font-black">Xanh</span> để bỏ chọn.
                </p>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
                <Button 
                    size="sm"
                    onClick={selectFullGroup}
                    className="flex-1 md:flex-initial bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-100 font-black text-[11px] h-9 px-4 rounded-xl"
                >
                    <CheckSquare size={14} className="mr-2"/> Chọn cả đoàn
                </Button>
                <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => { setSelectedBooking(null); setSelectedSeatIds([]); setSelectedFromTripId(null); }}
                    className="flex-1 md:flex-initial text-indigo-400 hover:text-indigo-600 font-black text-[11px] h-9 px-4"
                >
                    Hủy chọn
                </Button>
            </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Column 1 */}
        <div className={`bg-white rounded-3xl border transition-all duration-300 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-380px)] ${selectedFromTripId === trip1Id ? 'ring-2 ring-primary ring-offset-4' : 'border-slate-200'}`}>
          <div className={`px-5 py-3.5 border-b flex justify-between items-center ${selectedFromTripId === trip1Id ? 'bg-primary/5 border-primary/20' : 'bg-slate-50/50 border-slate-200'}`}>
             <div className="flex items-center gap-2 text-xs font-black text-slate-700 uppercase tracking-tighter">
                <BusFront size={18} className={selectedFromTripId === trip1Id ? 'text-primary' : 'text-slate-400'}/> {trip1 ? trip1.licensePlate : 'Chưa chọn xe 1'}
             </div>
             {selectedFromTripId === trip1Id && (
                <Badge className="bg-primary text-white border-transparent px-3 py-1 font-black shadow-sm">NGUỒN</Badge>
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
               <div className="h-full flex flex-col items-center justify-center text-slate-300 p-8 text-center opacity-40 italic">
                  <p className="text-sm font-medium">Vui lòng chọn xe 1 phía trên</p>
               </div>
            )}
          </div>
        </div>

        {/* Column 2 */}
        <div className={`bg-white rounded-3xl border transition-all duration-300 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-380px)] ${selectedFromTripId === trip2Id ? 'ring-2 ring-primary ring-offset-4' : 'border-slate-200'}`}>
           <div className={`px-5 py-3.5 border-b flex justify-between items-center ${selectedFromTripId === trip2Id ? 'bg-primary/5 border-primary/20' : 'bg-slate-50/50 border-slate-200'}`}>
              <div className="flex items-center gap-2 text-xs font-black text-slate-700 uppercase tracking-tighter">
                 <BusFront size={18} className={selectedFromTripId === trip2Id ? 'text-primary' : 'text-slate-400'}/> {trip2 ? trip2.licensePlate : 'Chưa chọn xe 2'}
              </div>
              {selectedFromTripId === trip2Id && (
                <Badge className="bg-primary text-white border-transparent px-3 py-1 font-black shadow-sm">NGUỒN</Badge>
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
                <div className="h-full flex flex-col items-center justify-center text-slate-300 p-8 text-center opacity-40 italic">
                   <p className="text-sm font-medium">Vui lòng chọn xe 2 phía trên</p>
                </div>
             )}
           </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
         <div className="flex-1 flex items-center gap-6 text-sm w-full min-w-0">
            <div className="flex flex-col min-w-0">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Ghế sẽ chuyển ({selectedSeatIds.length})</span>
               <div className="flex gap-2 flex-wrap">
                  {sourceSeatsLabels.length > 0 ? sourceSeatsLabels.map((lbl, idx) => (
                    <Badge key={idx} className="bg-indigo-600 text-white border-transparent font-bold py-1 px-3 rounded-xl shadow-sm">{lbl}</Badge>
                  )) : <span className="text-slate-300 font-bold italic text-xs">Hãy chọn ghế từ xe nguồn...</span>}
               </div>
            </div>
            
            {sourceTrip && targetTrip && selectedSeatIds.length > 0 && (
                <div className="shrink-0 flex items-center justify-center h-10 w-10 bg-indigo-50 rounded-full border border-indigo-100 shadow-inner">
                    <ArrowRight size={20} className="text-indigo-600 animate-pulse" />
                </div>
            )}

            <div className="flex flex-col min-w-0">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Vị trí tương ứng xe đích</span>
               <div className="flex gap-2 flex-wrap">
                  {transferValidation ? transferValidation.results.map((r, i) => (
                    <Badge key={i} className={`${r.isAvailable ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'} font-bold py-1 px-3 rounded-xl shadow-xs flex items-center gap-2`}>
                       {r.isAvailable ? <CheckCircle2 size={12}/> : <AlertCircle size={12}/>}
                       {r.posDesc}
                    </Badge>
                  )) : <span className="text-slate-300 font-bold italic text-xs">Chờ đối chiếu tọa độ...</span>}
               </div>
            </div>
         </div>

         <div className="shrink-0 flex items-center gap-4 w-full md:w-auto">
             {transferValidation && !transferValidation.isAllAvailable && (
                 <div className="flex items-center gap-2 text-red-600 font-black text-[11px] uppercase bg-red-50 px-4 py-2.5 rounded-2xl border border-red-100 animate-bounce">
                    <ShieldAlert size={16}/> Vị trí đích đã bị chiếm
                 </div>
             )}
             <Button 
               onClick={handleTransferInitiate}
               disabled={selectedSeatIds.length === 0 || !trip1Id || !trip2Id || !transferValidation?.isAllAvailable || isProcessing}
               className={`flex-1 md:flex-initial h-14 px-10 rounded-2xl font-black text-sm uppercase tracking-wider transition-all shadow-xl active:scale-95 ${
                 transferValidation?.isAllAvailable 
                 ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200' 
                 : 'bg-slate-400 text-white cursor-not-allowed shadow-none'
               }`}
             >
                {isProcessing ? (
                   <><Loader2 className="animate-spin mr-2" size={20}/> Đang xử lý...</>
                ) : (
                   <><CheckCircle2 className="mr-2" size={20}/> Xác nhận chuyển {selectedSeatIds.length} vé</>
                )}
             </Button>
         </div>
      </div>

      <AlertDialog open={showSplitWarning} onOpenChange={setShowSplitWarning}>
          <AlertDialogContent className="rounded-3xl p-8">
              <AlertDialogHeader>
                  <AlertDialogTitle className="text-orange-600 flex items-center gap-3 text-xl font-black">
                      <AlertTriangle size={28}/> CẢNH BÁO TÁCH ĐOÀN
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-slate-600 pt-4 text-base leading-relaxed">
                      Bạn đang chuyển <strong>{selectedSeatIds.length}</strong> ghế nhưng đơn hàng có tổng cộng <strong>{selectedBooking?.items.find(i => i.tripId === selectedFromTripId)?.seatIds.length}</strong> ghế.
                      <br/><br/>
                      Đơn hàng sẽ bị <strong>tách làm 2 phần</strong> nằm ở 2 xe khác nhau. Hành động này không thể hoàn tác sau khi lưu.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="mt-8 gap-4">
                  <AlertDialogCancel className="rounded-2xl border-slate-200 h-12 flex-1 font-bold">Quay lại chọn thêm</AlertDialogCancel>
                  <AlertDialogAction onClick={handleTransfer} className="rounded-2xl bg-orange-600 hover:bg-orange-700 h-12 flex-1 font-black">Tôi hiểu, tiếp tục tách</AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
