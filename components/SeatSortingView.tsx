
import React, { useState, useMemo } from "react";
import { BusTrip, Seat, SeatStatus, Booking, BusType } from "../types";
import { SeatMap } from "./SeatMap";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { 
  ArrowRight, 
  ArrowLeft,
  ArrowRightLeft, 
  Bus as BusIcon, 
  ChevronRight, 
  ChevronLeft,
  Info,
  RotateCcw,
  Loader2,
  Save,
  Trash2,
  AlertTriangle
} from "lucide-react";
import { api } from "../lib/api";
import { useToast } from "./ui/Toast";

interface StagedMove {
  id: string;
  sourceTripId: string;
  sourceTripName: string;
  sourceSeatLabel: string;
  sourceSeatId: string;
  targetTripId: string;
  targetTripName: string;
  targetSeatLabel: string;
  targetSeatId: string;
  phone: string;
  direction: 'left-to-right' | 'right-to-left';
}

interface SeatSortingViewProps {
  trips: BusTrip[];
  bookings: Booking[];
  onRefresh: () => Promise<void>;
  selectedDate: Date;
}

export const SeatSortingView: React.FC<SeatSortingViewProps> = ({
  trips,
  bookings,
  onRefresh,
  selectedDate
}) => {
  const { toast } = useToast();
  // Trip ID cho 2 cột Trái và Phải
  const [leftTripId, setLeftTripId] = useState<string>("");
  const [rightTripId, setRightTripId] = useState<string>("");
  
  // Trạng thái chọn nguồn
  const [selectionContext, setSelectionContext] = useState<{
    side: 'left' | 'right';
    seats: Seat[];
    targetSeats: Seat[];
  } | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [stagedMoves, setStagedMoves] = useState<StagedMove[]>([]);

  // Lọc chuyến xe: Chỉ xe giường đơn (SLEEPER) trong ngày đã chọn
  const dailySleeperTrips = useMemo(() => {
    const dStr = selectedDate.toISOString().split('T')[0];
    return trips.filter(t => 
      t.departureTime.startsWith(dStr) && 
      t.type === BusType.SLEEPER
    );
  }, [trips, selectedDate]);

  const leftTrip = useMemo(() => dailySleeperTrips.find(t => t.id === leftTripId), [dailySleeperTrips, leftTripId]);
  const rightTrip = useMemo(() => dailySleeperTrips.find(t => t.id === rightTripId), [dailySleeperTrips, rightTripId]);

  // Bookings theo từng bên
  const leftBookings = useMemo(() => {
    if (!leftTripId) return [];
    return bookings.filter(b => b.status !== 'cancelled' && b.items.some(i => i.tripId === leftTripId));
  }, [bookings, leftTripId]);

  const rightBookings = useMemo(() => {
    if (!rightTripId) return [];
    return bookings.filter(b => b.status !== 'cancelled' && b.items.some(i => i.tripId === rightTripId));
  }, [bookings, rightTripId]);

  // Các ghế đang nằm trong danh sách "chờ chuyển"
  const stagedLeftOccupied = useMemo(() => stagedMoves.filter(m => m.targetTripId === leftTripId).map(m => m.targetSeatId), [stagedMoves, leftTripId]);
  const stagedLeftAvailable = useMemo(() => stagedMoves.filter(m => m.sourceTripId === leftTripId).map(m => m.sourceSeatId), [stagedMoves, leftTripId]);
  
  const stagedRightOccupied = useMemo(() => stagedMoves.filter(m => m.targetTripId === rightTripId).map(m => m.targetSeatId), [stagedMoves, rightTripId]);
  const stagedRightAvailable = useMemo(() => stagedMoves.filter(m => m.sourceTripId === rightTripId).map(m => m.sourceSeatId), [stagedMoves, rightTripId]);

  const handleSeatClick = (side: 'left' | 'right', seat: Seat) => {
    const currentTripId = side === 'left' ? leftTripId : rightTripId;
    const oppositeTripId = side === 'left' ? rightTripId : leftTripId;
    const currentBookings = side === 'left' ? leftBookings : rightBookings;
    const currentTrip = side === 'left' ? leftTrip : rightTrip;
    
    // TRƯỜNG HỢP 1: Chưa chọn nguồn, hoặc đang muốn đổi nhóm nguồn khác ở cùng bên
    if (!selectionContext || selectionContext.side === side) {
        if (seat.status === SeatStatus.AVAILABLE) {
            toast({ type: "info", title: "Ghế trống", message: "Hãy chọn ghế đã có khách để bắt đầu điều chuyển." });
            return;
        }

        // Kiểm tra xem ghế có đang nằm trong danh sách chờ chuyển đi không
        const isAlreadyMovingOut = side === 'left' ? stagedLeftAvailable.includes(seat.id) : stagedRightAvailable.includes(seat.id);
        if (isAlreadyMovingOut) {
            toast({ type: "warning", title: "Đang xử lý", message: "Ghế này đã nằm trong danh sách chờ điều chuyển đi." });
            return;
        }

        // Tìm booking và cả nhóm ghế của khách đó
        const booking = currentBookings.find(b => b.items.some(i => i.tripId === currentTripId && i.seatIds.includes(seat.id)));
        if (!booking) return;

        const bookingItem = booking.items.find(i => i.tripId === currentTripId);
        if (!bookingItem) return;

        const allSeatsInGroup = currentTrip?.seats.filter(s => bookingItem.seatIds.includes(s.id)) || [];
        
        setSelectionContext({ side, seats: allSeatsInGroup, targetSeats: [] });
        toast({ type: "info", title: "Đã chọn nhóm", message: `Đã chọn ${allSeatsInGroup.length} ghế của khách ${booking.passenger.phone}. Hãy chọn ${allSeatsInGroup.length} ghế trống ở xe đối diện.` });
    } 
    // TRƯỜNG HỢP 2: Đã có nguồn, giờ chọn ghế trống ở bên đối diện làm ĐÍCH
    else {
        if (!oppositeTripId) {
            toast({ type: "warning", title: "Thiếu xe đích", message: "Vui lòng chọn xe ở cột đối diện trước." });
            return;
        }

        if (seat.status !== SeatStatus.AVAILABLE) {
            toast({ type: "warning", title: "Ghế không trống", message: "Vui lòng chọn một ghế đang trống." });
            return;
        }

        // Kiểm tra xem ghế trống này có đang bị "chiếm tạm thời" bởi một lệnh chuyển khác không
        const isTemporarilyOccupied = side === 'left' ? stagedLeftOccupied.includes(seat.id) : stagedRightOccupied.includes(seat.id);
        if (isTemporarilyOccupied) {
            toast({ type: "warning", title: "Đã có người đặt", message: "Ghế này đang chờ một khách khác chuyển đến." });
            return;
        }

        // Nếu ghế này đã được chọn trong target list hiện tại thì bỏ chọn
        if (selectionContext.targetSeats.some(s => s.id === seat.id)) {
            setSelectionContext({ ...selectionContext, targetSeats: selectionContext.targetSeats.filter(s => s.id !== seat.id) });
            return;
        }

        // Nếu đã đủ số lượng ghế đích
        if (selectionContext.targetSeats.length >= selectionContext.seats.length) {
            toast({ type: "warning", title: "Đủ số lượng", message: `Bạn chỉ cần chọn đúng ${selectionContext.seats.length} ghế trống.` });
            return;
        }

        const newTargetSeats = [...selectionContext.targetSeats, seat];
        
        // Nếu vừa chọn đủ ghế cuối cùng
        if (newTargetSeats.length === selectionContext.seats.length) {
            const originTrip = selectionContext.side === 'left' ? leftTrip : rightTrip;
            const destTrip = selectionContext.side === 'left' ? rightTrip : leftTrip;
            const originBookings = selectionContext.side === 'left' ? leftBookings : rightBookings;
            const direction: 'left-to-right' | 'right-to-left' = selectionContext.side === 'left' ? 'left-to-right' : 'right-to-left';

            const newMoves: StagedMove[] = selectionContext.seats.map((src, idx) => ({
                id: Math.random().toString(36).substr(2, 9),
                sourceTripId: originTrip!.id,
                sourceTripName: `${originTrip?.departureTime.split(' ')[1]} - ${originTrip?.route}`,
                sourceSeatId: src.id,
                sourceSeatLabel: src.label,
                targetTripId: destTrip!.id,
                targetTripName: `${destTrip?.departureTime.split(' ')[1]} - ${destTrip?.route}`,
                targetSeatId: newTargetSeats[idx].id,
                targetSeatLabel: newTargetSeats[idx].label,
                phone: originBookings.find(b => b.items.some(i => i.tripId === originTrip!.id && i.seatIds.includes(src.id)))?.passenger.phone || "N/A",
                direction
            }));

            setStagedMoves(prev => [...prev, ...newMoves]);
            setSelectionContext(null);
            toast({ type: "success", title: "Đã tạm lưu", message: `Đã dồn ${newMoves.length} ghế vào danh sách chờ xác nhận.` });
        } else {
            setSelectionContext({ ...selectionContext, targetSeats: newTargetSeats });
        }
    }
  };

  const saveAllChanges = async () => {
    if (stagedMoves.length === 0) return;
    
    setIsProcessing(true);
    try {
      const payload = stagedMoves.map(m => ({
          sourceTripId: m.sourceTripId,
          sourceSeatId: m.sourceSeatId,
          targetTripId: m.targetTripId,
          targetSeatId: m.targetSeatId
      }));

      await api.bookings.bulkTransfer(payload);
      await onRefresh();
      setStagedMoves([]);
      setSelectionContext(null);
      toast({ type: "success", title: "Thành công", message: "Toàn bộ dữ liệu đã được cập nhật lên hệ thống." });
    } catch (e) {
      console.error(e);
      toast({ type: "error", title: "Lỗi", message: "Không thể lưu thay đổi. Vui lòng thử lại." });
    } finally {
      setIsProcessing(false);
    }
  };

  const removeStagedMove = (moveId: string) => {
      setStagedMoves(prev => prev.filter(m => m.id !== moveId));
  };

  const clearAllStaged = () => {
      setStagedMoves([]);
      setSelectionContext(null);
  };

  // Tính toán sơ đồ ghế giả lập cho bên Trái
  const modifiedLeftSeats = useMemo(() => {
      if (!leftTrip) return [];
      return leftTrip.seats.map(s => {
          // Nếu ghế này đang được chuyển ĐI -> Hiển thị là Trống
          if (stagedLeftAvailable.includes(s.id)) return { ...s, status: SeatStatus.AVAILABLE };
          // Nếu ghế này đang được chuyển ĐẾN -> Hiển thị là Đã bán
          if (stagedLeftOccupied.includes(s.id)) return { ...s, status: SeatStatus.SOLD };
          // Nếu đang trong quá trình chọn
          if (selectionContext?.side === 'left' && selectionContext.seats.some(sel => sel.id === s.id)) return { ...s, status: SeatStatus.SELECTED };
          if (selectionContext?.side === 'right' && selectionContext.targetSeats.some(sel => sel.id === s.id)) return { ...s, status: SeatStatus.SELECTED };
          return s;
      });
  }, [leftTrip, stagedLeftAvailable, stagedLeftOccupied, selectionContext]);

  // Tính toán sơ đồ ghế giả lập cho bên Phải
  const modifiedRightSeats = useMemo(() => {
      if (!rightTrip) return [];
      return rightTrip.seats.map(s => {
          // Nếu ghế này đang được chuyển ĐI -> Hiển thị là Trống
          if (stagedRightAvailable.includes(s.id)) return { ...s, status: SeatStatus.AVAILABLE };
          // Nếu ghế này đang được chuyển ĐẾN -> Hiển thị là Đã bán
          if (stagedRightOccupied.includes(s.id)) return { ...s, status: SeatStatus.SOLD };
          // Nếu đang trong quá trình chọn
          if (selectionContext?.side === 'right' && selectionContext.seats.some(sel => sel.id === s.id)) return { ...s, status: SeatStatus.SELECTED };
          if (selectionContext?.side === 'left' && selectionContext.targetSeats.some(sel => sel.id === s.id)) return { ...s, status: SeatStatus.SELECTED };
          return s;
      });
  }, [rightTrip, stagedRightAvailable, stagedRightOccupied, selectionContext]);

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 h-[calc(100vh-140px)]">
      {/* Header Info */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <ArrowRightLeft size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
                <h2 className="font-bold text-slate-800">Điều chuyển & Dồn khách linh hoạt</h2>
                <Badge className="bg-blue-100 text-blue-700 border-blue-200">Giường đơn ➜ Giường đơn</Badge>
            </div>
            <p className="text-xs text-slate-500">Cho phép dồn khách giữa bất kỳ chuyến nào trong ngày. <b>Bên nào cũng có thể là nguồn hoặc đích.</b></p>
          </div>
        </div>

        <div className="flex items-center gap-3">
           {(stagedMoves.length > 0 || selectionContext) && (
               <Button variant="outline" size="sm" onClick={clearAllStaged} className="text-red-600 border-red-200 hover:bg-red-50 h-9">
                  <RotateCcw size={14} className="mr-2"/> Đặt lại toàn bộ
               </Button>
           )}
           <Button 
            disabled={stagedMoves.length === 0 || isProcessing} 
            onClick={saveAllChanges}
            className="bg-green-600 hover:bg-green-700 shadow-lg shadow-green-200 h-10 px-6 font-bold"
           >
              {isProcessing ? <Loader2 size={18} className="animate-spin mr-2"/> : <Save size={18} className="mr-2"/>}
              Xác nhận lưu ({stagedMoves.length} ghế)
           </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0">
        
        {/* Left Trip Column */}
        <div className="flex-1 flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm relative">
           {selectionContext?.side === 'right' && (
               <div className="absolute top-1 right-1 z-10 animate-bounce">
                   <Badge className="bg-green-500 text-white border-white shadow-lg">CHỌN ĐÍCH TẠI ĐÂY</Badge>
               </div>
           )}
           <div className="p-3 bg-slate-50 border-b border-slate-200">
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 tracking-widest">Xe 1 (Trái)</label>
              <select 
                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 outline-none"
                value={leftTripId}
                onChange={e => { setLeftTripId(e.target.value); setSelectionContext(null); }}
              >
                <option value="">-- Chọn chuyến xe --</option>
                {dailySleeperTrips.map(t => (
                  <option key={t.id} value={t.id}>{t.departureTime.split(' ')[1]} - {t.route} ({t.licensePlate})</option>
                ))}
              </select>
           </div>
           
           <div className="flex-1 overflow-y-auto p-2">
              {leftTrip ? (
                <SeatMap 
                   seats={modifiedLeftSeats}
                   busType={BusType.SLEEPER}
                   onSeatClick={(s) => handleSeatClick('left', s)}
                   bookings={leftBookings}
                   currentTripId={leftTripId}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-50 p-12 text-center">
                   <BusIcon size={48} className="mb-4" />
                   <p className="text-sm font-bold">Hãy chọn chuyến xe 1</p>
                </div>
              )}
           </div>
        </div>

        {/* Center Staging / Direction indicator */}
        <div className="w-full md:w-80 flex flex-col gap-4">
            <div className="bg-indigo-950 rounded-xl shadow-xl flex flex-col h-full overflow-hidden border border-indigo-900">
                <div className="px-4 py-3 bg-indigo-900/50 border-b border-indigo-800 flex justify-between items-center shrink-0">
                    <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <AlertTriangle size={14} className="text-yellow-400"/> Chờ lưu thay đổi
                    </span>
                    <Badge className="bg-yellow-400 text-indigo-950 font-black">{stagedMoves.length}</Badge>
                </div>
                
                <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-indigo-950/30">
                    {/* Progress Indicator for current selection */}
                    {selectionContext && (
                        <div className="bg-white/10 border border-white/20 rounded-xl p-3 animate-pulse border-dashed">
                             <div className="flex justify-between items-center mb-2">
                                <span className="text-[10px] text-yellow-400 font-black uppercase">Đang thực hiện chuyển</span>
                                <Badge className="bg-yellow-400 text-indigo-950 text-[10px] font-black">{selectionContext.targetSeats.length} / {selectionContext.seats.length}</Badge>
                             </div>
                             <div className="flex items-center gap-3">
                                 <div className="flex-1 bg-white/10 rounded-lg p-2 text-center border border-white/5">
                                    <div className="text-[9px] text-white/40">Nguồn: Xe {selectionContext.side === 'left' ? 'Trái' : 'Phải'}</div>
                                    <div className="text-white font-bold text-xs">{selectionContext.seats.map(s => s.label).join(', ')}</div>
                                 </div>
                                 {selectionContext.side === 'left' ? <ArrowRight size={16} className="text-yellow-400"/> : <ArrowLeft size={16} className="text-yellow-400"/>}
                                 <div className="flex-1 bg-white/10 rounded-lg p-2 text-center border border-white/5 border-dashed">
                                    <div className="text-[9px] text-white/40">Đích: Xe {selectionContext.side === 'left' ? 'Phải' : 'Trái'}</div>
                                    <div className="text-white font-bold text-xs">{selectionContext.targetSeats.length > 0 ? selectionContext.targetSeats.map(s => s.label).join(', ') : '...'}</div>
                                 </div>
                             </div>
                        </div>
                    )}

                    {stagedMoves.length === 0 && !selectionContext ? (
                        <div className="h-full flex flex-col items-center justify-center text-indigo-300/30 text-center p-6">
                            <Info size={32} className="mb-3"/>
                            <p className="text-xs font-bold uppercase tracking-tighter leading-tight">Chưa có thay đổi nào</p>
                            <p className="text-[10px] mt-2 italic">Chọn ghế có khách ở xe này, sau đó chọn ghế trống ở xe đối diện</p>
                        </div>
                    ) : (
                        stagedMoves.map(move => (
                            <div key={move.id} className="bg-white/5 border border-white/10 rounded-lg p-2.5 relative group animate-in slide-in-from-bottom-2">
                                <button 
                                    onClick={() => removeStagedMove(move.id)}
                                    className="absolute top-2 right-2 text-white/40 hover:text-red-400 transition-colors"
                                >
                                    <Trash2 size={14}/>
                                </button>
                                <div className="text-[10px] font-black text-indigo-400 mb-1">{move.phone}</div>
                                <div className="flex items-center justify-between gap-2">
                                    <div className={`flex-1 text-center ${move.direction === 'right-to-left' ? 'order-3' : 'order-1'}`}>
                                        <div className="text-[8px] text-white/40 truncate mb-0.5">Xe Trái</div>
                                        <div className={`rounded py-1 font-bold text-xs ${move.direction === 'left-to-right' ? 'bg-white/10 text-white' : 'bg-yellow-400/10 border border-yellow-400/20 text-yellow-400'}`}>
                                            {move.direction === 'left-to-right' ? move.sourceSeatLabel : move.targetSeatLabel}
                                        </div>
                                    </div>
                                    
                                    <div className="order-2 px-1">
                                        {move.direction === 'left-to-right' ? <ArrowRight size={14} className="text-yellow-400"/> : <ArrowLeft size={14} className="text-yellow-400"/>}
                                    </div>

                                    <div className={`flex-1 text-center ${move.direction === 'right-to-left' ? 'order-1' : 'order-3'}`}>
                                        <div className="text-[8px] text-white/40 truncate mb-0.5">Xe Phải</div>
                                        <div className={`rounded py-1 font-bold text-xs ${move.direction === 'left-to-right' ? 'bg-yellow-400/10 border border-yellow-400/20 text-yellow-400' : 'bg-white/10 text-white'}`}>
                                            {move.direction === 'left-to-right' ? move.targetSeatLabel : move.sourceSeatLabel}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {stagedMoves.length > 0 && (
                    <div className="p-3 bg-indigo-900/50 border-t border-indigo-800">
                        <div className="flex items-start gap-2 text-[10px] text-indigo-300 leading-tight">
                            <Info size={14} className="shrink-0 text-yellow-400"/>
                            <span>Mọi thay đổi chỉ được áp dụng khi bấm Lưu thay đổi ở góc trên.</span>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* Right Trip Column */}
        <div className="flex-1 flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm relative">
           {selectionContext?.side === 'left' && (
               <div className="absolute top-1 left-1 z-10 animate-bounce">
                   <Badge className="bg-green-500 text-white border-white shadow-lg">CHỌN ĐÍCH TẠI ĐÂY</Badge>
               </div>
           )}
           <div className="p-3 bg-slate-50 border-b border-slate-200">
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 tracking-widest">Xe 2 (Phải)</label>
              <select 
                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 outline-none"
                value={rightTripId}
                onChange={e => { setRightTripId(e.target.value); setSelectionContext(null); }}
              >
                <option value="">-- Chọn chuyến xe --</option>
                {dailySleeperTrips.map(t => (
                  <option key={t.id} value={t.id}>{t.departureTime.split(' ')[1]} - {t.route} ({t.licensePlate})</option>
                ))}
              </select>
           </div>
           
           <div className="flex-1 overflow-y-auto p-2">
              {rightTrip ? (
                 <SeatMap 
                    seats={modifiedRightSeats}
                    busType={BusType.SLEEPER}
                    onSeatClick={(s) => handleSeatClick('right', s)}
                    bookings={rightBookings}
                    currentTripId={rightTripId}
                 />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-50 p-12 text-center">
                   <BusIcon size={48} className="mb-4" />
                   <p className="text-sm font-bold">Hãy chọn chuyến xe 2</p>
                </div>
              )}
           </div>
        </div>

      </div>
    </div>
  );
};
