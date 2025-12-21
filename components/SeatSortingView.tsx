
import React, { useState, useMemo } from "react";
import { BusTrip, Seat, SeatStatus, Booking } from "../types";
import { SeatMap } from "./SeatMap";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { 
  ArrowRight, 
  ArrowRightLeft, 
  Bus as BusIcon, 
  ChevronRight, 
  HelpCircle, 
  Info,
  Zap,
  ArrowRightIcon,
  RotateCcw,
  CheckCircle2,
  Loader2
} from "lucide-react";
import { api } from "../lib/api";
import { useToast } from "./ui/Toast";

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
  const [selectedSourceSeat, setSelectedSourceSeat] = useState<Seat | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Lọc chuyến xe theo ngày đã chọn từ Layout
  const dailyTrips = useMemo(() => {
    const dStr = selectedDate.toISOString().split('T')[0];
    return trips.filter(t => t.departureTime.startsWith(dStr));
  }, [trips, selectedDate]);

  const sourceTrip = useMemo(() => dailyTrips.find(t => t.id === sourceTripId), [dailyTrips, sourceTripId]);
  const targetTrip = useMemo(() => dailyTrips.find(t => t.id === targetTripId), [dailyTrips, targetTripId]);

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
      toast({ type: "info", title: "Ghế trống", message: "Vui lòng chọn ghế đã có khách để điều chuyển." });
      return;
    }
    setSelectedSourceSeat(seat);
    toast({ type: "info", title: "Đã chọn khách", message: `Đã chọn ghế ${seat.label}. Bây giờ hãy chọn ghế trống ở chuyến đích.` });
  };

  const handleTargetSeatClick = async (targetSeat: Seat) => {
    if (!selectedSourceSeat) {
      toast({ type: "warning", title: "Chưa chọn nguồn", message: "Hãy chọn khách ở chuyến bên trái trước." });
      return;
    }
    if (targetSeat.status !== SeatStatus.AVAILABLE) {
      toast({ type: "warning", title: "Ghế đã có khách", message: "Vui lòng chọn một ghế trống ở chuyến đích." });
      return;
    }

    if (!sourceTripId || !targetTripId) return;

    setIsProcessing(true);
    try {
      await api.bookings.transfer(sourceTripId, selectedSourceSeat.id, targetTripId, targetSeat.id);
      await onRefresh();
      setSelectedSourceSeat(null);
      toast({ type: "success", title: "Thành công", message: `Đã chuyển khách sang ghế ${targetSeat.label} thành công.` });
    } catch (e) {
      console.error(e);
      toast({ type: "error", title: "Lỗi", message: "Không thể thực hiện điều chuyển." });
    } finally {
      setIsProcessing(false);
    }
  };

  const resetSelection = () => {
    setSelectedSourceSeat(null);
    toast({ type: "info", title: "Đã đặt lại", message: "Đã hủy các lựa chọn hiện tại." });
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 h-[calc(100vh-140px)]">
      {/* Header Info */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <ArrowRightLeft size={24} />
          </div>
          <div>
            <h2 className="font-bold text-slate-800">Chế độ điều chuyển khách trong ngày</h2>
            <p className="text-xs text-slate-500">Chuyển khách từ chuyến xe này sang chuyến xe khác để tối ưu hóa chỗ ngồi.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
           <Button variant="outline" size="sm" onClick={resetSelection} disabled={!selectedSourceSeat} className="h-9">
              <RotateCcw size={14} className="mr-2"/> Hủy chọn
           </Button>
           <div className="px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center gap-2">
              <Info size={16} className="text-indigo-600" />
              <span className="text-xs text-indigo-700 font-medium">Click chọn ghế có khách (Nguồn) ➜ Click chọn ghế trống (Đích)</span>
           </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0">
        
        {/* Source Trip (Left) */}
        <div className="flex-1 flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
           <div className="p-3 bg-slate-50 border-b border-slate-200">
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 tracking-widest">Chuyến xe nguồn (ĐIỀU ĐI)</label>
              <select 
                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 outline-none"
                value={sourceTripId}
                onChange={e => { setSourceTripId(e.target.value); setSelectedSourceSeat(null); }}
              >
                <option value="">-- Chọn chuyến xe nguồn --</option>
                {dailyTrips.map(t => (
                  <option key={t.id} value={t.id}>{t.departureTime.split(' ')[1]} - {t.route} ({t.licensePlate})</option>
                ))}
              </select>
           </div>
           
           <div className="flex-1 overflow-y-auto p-2 relative">
              {sourceTrip ? (
                <div className={selectedSourceSeat ? "ring-2 ring-primary/20 rounded-xl" : ""}>
                   <SeatMap 
                      seats={sourceTrip.seats}
                      busType={sourceTrip.type}
                      onSeatClick={handleSourceSeatClick}
                      bookings={sourceBookings}
                      currentTripId={sourceTripId}
                      swapSourceSeatId={selectedSourceSeat?.id}
                   />
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-50 p-12 text-center">
                   <BusIcon size={48} className="mb-4" />
                   <p className="text-sm font-bold">Hãy chọn chuyến xe cần điều chuyển khách</p>
                </div>
              )}
           </div>
        </div>

        {/* Transfer Indicator (Center) */}
        <div className="hidden lg:flex flex-col items-center justify-center gap-4">
           <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all ${selectedSourceSeat ? 'bg-primary border-primary text-white shadow-lg animate-pulse' : 'bg-slate-100 border-slate-200 text-slate-300'}`}>
              <ChevronRight size={24} />
           </div>
           {selectedSourceSeat && (
              <div className="flex flex-col items-center animate-in zoom-in duration-300">
                 <Badge className="bg-primary text-white text-[10px] font-black h-6 px-3 shadow-md mb-2">ĐANG CHUYỂN</Badge>
                 <span className="text-sm font-black text-slate-700 bg-white border border-slate-200 px-3 py-1 rounded-lg shadow-sm">Ghế {selectedSourceSeat.label}</span>
              </div>
           )}
        </div>

        {/* Target Trip (Right) */}
        <div className="flex-1 flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
           <div className="p-3 bg-slate-50 border-b border-slate-200">
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 tracking-widest">Chuyến xe đích (ĐẾN)</label>
              <select 
                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:ring-2 focus:ring-primary/20 outline-none"
                value={targetTripId}
                onChange={e => setTargetTripId(e.target.value)}
              >
                <option value="">-- Chọn chuyến xe đích --</option>
                {dailyTrips.map(t => (
                  <option key={t.id} value={t.id}>{t.departureTime.split(' ')[1]} - {t.route} ({t.licensePlate})</option>
                ))}
              </select>
           </div>
           
           <div className="flex-1 overflow-y-auto p-2 relative">
              {isProcessing && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-50 flex flex-col items-center justify-center text-primary">
                    <Loader2 className="animate-spin mb-2" size={32} />
                    <span className="font-bold text-sm">Đang chuyển khách...</span>
                </div>
              )}
              {targetTrip ? (
                 <SeatMap 
                    seats={targetTrip.seats}
                    busType={targetTrip.type}
                    onSeatClick={handleTargetSeatClick}
                    bookings={targetBookings}
                    currentTripId={targetTripId}
                 />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-50 p-12 text-center">
                   <BusIcon size={48} className="mb-4" />
                   <p className="text-sm font-bold">Hãy chọn chuyến xe đích để chuyển khách đến</p>
                </div>
              )}
           </div>
        </div>

      </div>
    </div>
  );
};
