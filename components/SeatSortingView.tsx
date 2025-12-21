
import React, { useState, useMemo } from "react";
import { BusTrip, Seat, SeatStatus, Booking, BusType } from "../types";
import { SeatMap } from "./SeatMap";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { 
  ArrowRight, 
  ArrowRightLeft, 
  Bus as BusIcon, 
  ChevronRight, 
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
  const [sourceTripId, setSourceTripId] = useState<string>("");
  const [targetTripId, setTargetTripId] = useState<string>("");
  const [selectedSourceSeats, setSelectedSourceSeats] = useState<Seat[]>([]);
  const [selectedTargetSeats, setSelectedTargetSeats] = useState<Seat[]>([]);
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

  const sourceTrip = useMemo(() => dailySleeperTrips.find(t => t.id === sourceTripId), [dailySleeperTrips, sourceTripId]);
  const targetTrip = useMemo(() => dailySleeperTrips.find(t => t.id === targetTripId), [dailySleeperTrips, targetTripId]);

  // Danh sách các ID ghế đang trong trạng thái "chờ chuyển" để làm mờ trên sơ đồ
  const stagedSourceSeatIds = useMemo(() => stagedMoves.filter(m => m.sourceTripId === sourceTripId).map(m => m.sourceSeatId), [stagedMoves, sourceTripId]);
  const stagedTargetSeatIds = useMemo(() => stagedMoves.filter(m => m.targetTripId === targetTripId).map(m => m.targetSeatId), [stagedMoves, targetTripId]);

  const sourceBookings = useMemo(() => {
    if (!sourceTripId) return [];
    return bookings.filter(b => b.status !== 'cancelled' && b.items.some(i => i.tripId === sourceTripId));
  }, [bookings, sourceTripId]);

  const targetBookings = useMemo(() => {
    if (!targetTripId) return [];
    return bookings.filter(b => b.status !== 'cancelled' && b.items.some(i => i.tripId === targetTripId));
  }, [bookings, targetTripId]);

  const handleSourceSeatClick = (seat: Seat) => {
    if (seat.status === SeatStatus.AVAILABLE) {
      toast({ type: "info", title: "Ghế trống", message: "Hãy chọn ghế có khách." });
      return;
    }
    
    if (stagedSourceSeatIds.includes(seat.id)) {
        toast({ type: "warning", title: "Đã chọn", message: "Ghế này đã nằm trong danh sách điều chuyển tạm thời." });
        return;
    }

    // Tìm booking chứa ghế này
    const booking = sourceBookings.find(b => b.items.some(i => i.tripId === sourceTripId && i.seatIds.includes(seat.id)));
    if (!booking) return;

    // Chọn TOÀN BỘ ghế của booking này trong chuyến nguồn
    const bookingItem = booking.items.find(i => i.tripId === sourceTripId);
    if (!bookingItem) return;

    const allSeatsInGroup = sourceTrip?.seats.filter(s => bookingItem.seatIds.includes(s.id)) || [];
    
    setSelectedSourceSeats(allSeatsInGroup);
    setSelectedTargetSeats([]); // Reset target khi chọn nguồn mới
    toast({ type: "info", title: "Đã chọn nhóm", message: `Đã chọn ${allSeatsInGroup.length} ghế của khách ${booking.passenger.phone}. Hãy chọn ${allSeatsInGroup.length} ghế trống ở đích.` });
  };

  const handleTargetSeatClick = (targetSeat: Seat) => {
    if (selectedSourceSeats.length === 0) {
      toast({ type: "warning", title: "Chưa chọn nguồn", message: "Hãy chọn nhóm khách cần chuyển trước." });
      return;
    }

    if (targetSeat.status !== SeatStatus.AVAILABLE || stagedTargetSeatIds.includes(targetSeat.id)) {
      toast({ type: "warning", title: "Ghế không trống", message: "Vui lòng chọn ghế đang trống ở chuyến đích." });
      return;
    }

    // Nếu ghế này đã được chọn trong list target hiện tại thì bỏ chọn
    if (selectedTargetSeats.some(s => s.id === targetSeat.id)) {
        setSelectedTargetSeats(prev => prev.filter(s => s.id !== targetSeat.id));
        return;
    }

    if (selectedTargetSeats.length >= selectedSourceSeats.length) {
        toast({ type: "warning", title: "Đủ số lượng", message: `Bạn chỉ cần chọn ${selectedSourceSeats.length} ghế.` });
        return;
    }

    const newTargets = [...selectedTargetSeats, targetSeat];
    setSelectedTargetSeats(newTargets);

    // Nếu đã chọn đủ số lượng ghế đích
    if (newTargets.length === selectedSourceSeats.length) {
        // Tạo các staged moves
        const newMoves: StagedMove[] = selectedSourceSeats.map((src, idx) => ({
            id: Math.random().toString(36).substr(2, 9),
            sourceTripId: sourceTripId,
            sourceTripName: `${sourceTrip?.departureTime.split(' ')[1]} - ${sourceTrip?.route}`,
            sourceSeatId: src.id,
            sourceSeatLabel: src.label,
            targetTripId: targetTripId,
            targetTripName: `${targetTrip?.departureTime.split(' ')[1]} - ${targetTrip?.route}`,
            targetSeatId: newTargets[idx].id,
            targetSeatLabel: newTargets[idx].label,
            phone: sourceBookings.find(b => b.items.some(i => i.tripId === sourceTripId && i.seatIds.includes(src.id)))?.passenger.phone || "N/A"
        }));

        setStagedMoves(prev => [...prev, ...newMoves]);
        setSelectedSourceSeats([]);
        setSelectedTargetSeats([]);
        toast({ type: "success", title: "Đã tạm lưu", message: `Đã thêm ${newMoves.length} ghế vào danh sách chờ xác nhận.` });
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
      toast({ type: "success", title: "Thành công", message: "Đã cập nhật toàn bộ thay đổi lên hệ thống." });
    } catch (e) {
      console.error(e);
      toast({ type: "error", title: "Lỗi", message: "Không thể lưu thay đổi." });
    } finally {
      setIsProcessing(false);
    }
  };

  const removeStagedMove = (moveId: string) => {
      setStagedMoves(prev => prev.filter(m => m.id !== moveId));
  };

  const clearAllStaged = () => {
      setStagedMoves([]);
      setSelectedSourceSeats([]);
      setSelectedTargetSeats([]);
  };

  // Mock seats for maps to show staged status
  const modifiedSourceSeats = useMemo(() => {
      if (!sourceTrip) return [];
      return sourceTrip.seats.map(s => {
          if (stagedSourceSeatIds.includes(s.id)) return { ...s, status: SeatStatus.AVAILABLE }; // Giả lập đã trống
          if (selectedSourceSeats.some(sel => sel.id === s.id)) return { ...s, status: SeatStatus.SELECTED };
          return s;
      });
  }, [sourceTrip, stagedSourceSeatIds, selectedSourceSeats]);

  const modifiedTargetSeats = useMemo(() => {
      if (!targetTrip) return [];
      return targetTrip.seats.map(s => {
          if (stagedTargetSeatIds.includes(s.id)) return { ...s, status: SeatStatus.SOLD }; // Giả lập đã chiếm
          if (selectedTargetSeats.some(sel => sel.id === s.id)) return { ...s, status: SeatStatus.SELECTED };
          return s;
      });
  }, [targetTrip, stagedTargetSeatIds, selectedTargetSeats]);

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
                <h2 className="font-bold text-slate-800">Điều chuyển khách (Xe Giường Đơn)</h2>
                <Badge className="bg-blue-100 text-blue-700 border-blue-200">Chỉ xe giường</Badge>
            </div>
            <p className="text-xs text-slate-500">Chuyển theo nhóm khách. Thay đổi chỉ có hiệu lực khi bấm <b>Lưu thay đổi</b>.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
           {stagedMoves.length > 0 && (
               <Button variant="outline" size="sm" onClick={clearAllStaged} className="text-red-600 border-red-200 hover:bg-red-50 h-9">
                  <RotateCcw size={14} className="mr-2"/> Hủy tất cả tạm tính
               </Button>
           )}
           <Button 
            disabled={stagedMoves.length === 0 || isProcessing} 
            onClick={saveAllChanges}
            className="bg-green-600 hover:bg-green-700 shadow-lg shadow-green-200 h-10 px-6 font-bold"
           >
              {isProcessing ? <Loader2 size={18} className="animate-spin mr-2"/> : <Save size={18} className="mr-2"/>}
              Lưu thay đổi ({stagedMoves.length} ghế)
           </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0">
        
        {/* Source Trip (Left) */}
        <div className="flex-1 flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
           <div className="p-3 bg-slate-50 border-b border-slate-200">
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 tracking-widest">Chuyến xe nguồn</label>
              <select 
                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 outline-none"
                value={sourceTripId}
                onChange={e => { setSourceTripId(e.target.value); setSelectedSourceSeats([]); }}
              >
                <option value="">-- Chọn chuyến đi --</option>
                {dailySleeperTrips.map(t => (
                  <option key={t.id} value={t.id}>{t.departureTime.split(' ')[1]} - {t.route} ({t.licensePlate})</option>
                ))}
              </select>
           </div>
           
           <div className="flex-1 overflow-y-auto p-2 relative">
              {sourceTrip ? (
                <SeatMap 
                   seats={modifiedSourceSeats}
                   busType={BusType.SLEEPER}
                   onSeatClick={handleSourceSeatClick}
                   bookings={sourceBookings}
                   currentTripId={sourceTripId}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-50 p-12 text-center">
                   <BusIcon size={48} className="mb-4" />
                   <p className="text-sm font-bold">Chọn chuyến nguồn</p>
                </div>
              )}
           </div>
        </div>

        {/* Staging Area (Center or List) */}
        <div className="w-full md:w-80 flex flex-col gap-4">
            <div className="bg-indigo-950 rounded-xl shadow-xl flex flex-col h-full overflow-hidden border border-indigo-900">
                <div className="px-4 py-3 bg-indigo-900/50 border-b border-indigo-800 flex justify-between items-center shrink-0">
                    <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <AlertTriangle size={14} className="text-yellow-400"/> Danh sách chờ lưu
                    </span>
                    <Badge className="bg-yellow-400 text-indigo-950 font-black">{stagedMoves.length}</Badge>
                </div>
                
                <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-indigo-950/30">
                    {stagedMoves.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-indigo-300/30 text-center p-6">
                            <Info size={32} className="mb-3"/>
                            <p className="text-xs font-bold uppercase tracking-tighter leading-tight">Chưa có thay đổi nào được thực hiện</p>
                        </div>
                    ) : (
                        stagedMoves.map(move => (
                            <div key={move.id} className="bg-white/5 border border-white/10 rounded-lg p-2.5 relative group animate-in slide-in-from-right-4">
                                <button 
                                    onClick={() => removeStagedMove(move.id)}
                                    className="absolute top-2 right-2 text-white/40 hover:text-red-400 transition-colors"
                                >
                                    <Trash2 size={14}/>
                                </button>
                                <div className="text-[10px] font-black text-indigo-400 mb-1">{move.phone}</div>
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex-1 text-center">
                                        <div className="text-[9px] text-white/50 truncate mb-0.5">{move.sourceTripName}</div>
                                        <div className="bg-white/10 rounded py-1 font-bold text-white text-xs">{move.sourceSeatLabel}</div>
                                    </div>
                                    <ArrowRight size={14} className="text-yellow-400 shrink-0"/>
                                    <div className="flex-1 text-center">
                                        <div className="text-[9px] text-white/50 truncate mb-0.5">{move.targetTripName}</div>
                                        <div className="bg-yellow-400/10 border border-yellow-400/20 rounded py-1 font-bold text-yellow-400 text-xs">{move.targetSeatLabel}</div>
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
                            <span>Bấm "Lưu thay đổi" phía trên để cập nhật sơ đồ thật.</span>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* Target Trip (Right) */}
        <div className="flex-1 flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
           <div className="p-3 bg-slate-50 border-b border-slate-200">
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 tracking-widest">Chuyến xe đích</label>
              <select 
                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 outline-none"
                value={targetTripId}
                onChange={e => { setTargetTripId(e.target.value); setSelectedTargetSeats([]); }}
              >
                <option value="">-- Chọn chuyến đến --</option>
                {dailySleeperTrips.map(t => (
                  <option key={t.id} value={t.id}>{t.departureTime.split(' ')[1]} - {t.route} ({t.licensePlate})</option>
                ))}
              </select>
           </div>
           
           <div className="flex-1 overflow-y-auto p-2 relative">
              {targetTrip ? (
                 <SeatMap 
                    seats={modifiedTargetSeats}
                    busType={BusType.SLEEPER}
                    onSeatClick={handleTargetSeatClick}
                    bookings={targetBookings}
                    currentTripId={targetTripId}
                 />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-50 p-12 text-center">
                   <BusIcon size={48} className="mb-4" />
                   <p className="text-sm font-bold">Chọn chuyến đích</p>
                </div>
              )}
           </div>
        </div>

      </div>
    </div>
  );
};
