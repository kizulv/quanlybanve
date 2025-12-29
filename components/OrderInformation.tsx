import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Ticket, Calendar, MapPin, Phone, User, Clock, Bus, 
  CheckCircle2, AlertCircle, ArrowLeft, QrCode, FileClock, 
  Loader2, Plus, Trash2, Edit, ArrowRightLeft, Truck, UserCog, 
  Banknote, RotateCcw, Info, Zap, CalendarIcon, ArrowRight, LayoutGrid,
  Locate
} from 'lucide-react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { api } from '../lib/api';
import { Booking, BookingHistory, BusTrip, BusType, Seat } from '../types';
import { formatCurrency } from '../utils/formatters';
import { formatLunarDate } from '../utils/dateUtils';

const SeatMapPreview: React.FC<{ trip: BusTrip; bookedSeatIds: string[] }> = ({ trip, bookedSeatIds }) => {
  const isCabin = trip.type === BusType.CABIN;
  const seats = trip.seats || [];
  
  const renderSeat = (seat: Seat) => {
    const isBooked = bookedSeatIds.includes(seat.id);
    return (
      <div 
        key={seat.id}
        className={`
          relative flex items-center justify-center border transition-all duration-200 rounded-md shadow-sm
          ${isCabin ? "h-11 w-11 sm:w-16 text-[10px]" : "h-9 w-9 sm:w-11 text-[10px]"}
          ${isBooked ? "bg-blue-600 border-blue-700 text-white font-black ring-2 ring-blue-100" : "bg-slate-200 border-slate-300 text-slate-500 font-bold"}
        `}
        title={`${seat.label} ${isBooked ? '(Ghế của bạn)' : ''}`}
      >
        {seat.label}
      </div>
    );
  };

  if (isCabin) {
    // Cabin layout: 22 phòng - Hiển thị theo Tầng 1 và Tầng 2
    const regularSeats = seats.filter(s => !s.isFloorSeat && (s.row ?? 0) < 90);
    const benchSeats = seats.filter(s => !s.isFloorSeat && (s.row ?? 0) >= 90);
    const rows = Array.from(new Set(regularSeats.map(s => s.row ?? 0))).sort((a, b) => a - b);

    return (
      <div className="flex flex-col items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 w-full overflow-hidden shadow-inner">
        <div className="grid grid-cols-2 gap-3 sm:gap-6 w-full">
          {[1, 2].map(f => (
            <div key={`floor-${f}`} className="flex flex-col items-center">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Tầng {f}</div>
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                {rows.map(r => (
                  <React.Fragment key={`row-${f}-${r}`}>
                    {[0, 1].map(c => {
                      const s = regularSeats.find(st => st.row === r && st.col === c && st.floor === f);
                      return s ? renderSeat(s) : <div key={`empty-${f}-${r}-${c}`} className="h-11 w-11 sm:w-16" />;
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}
        </div>

        {benchSeats.length > 0 && (
          <div className="pt-4 border-t border-slate-200 border-dashed w-full flex flex-col items-center gap-2">
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Băng cuối</div>
            <div className="flex gap-2 justify-center">
              {benchSeats.sort((a,b) => (a.col ?? 0) - (b.col ?? 0)).map(s => renderSeat(s))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Sleeper layout: 41 giường - Chia 2 tầng (Tầng 1 bên trái, Tầng 2 bên phải)
  const standardSeats = seats.filter(s => !s.isFloorSeat && (s.row ?? 0) < 6);
  const benchSeats = seats.filter(s => !s.isFloorSeat && (s.row ?? 0) >= 6);
  const rows = [0, 1, 2, 3, 4, 5];

  return (
    <div className="flex flex-col gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200 w-full overflow-hidden shadow-inner">
      <div className="grid grid-cols-2 gap-3 sm:gap-6 w-full">
        {[1, 2].map(f => (
          <div key={`floor-${f}`} className="flex flex-col items-center">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Tầng {f}</div>
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {rows.map(r => (
                <React.Fragment key={`row-${f}-${r}`}>
                  {[0, 1, 2].map(c => {
                    const s = standardSeats.find(st => st.row === r && st.col === c && st.floor === f);
                    return s ? renderSeat(s) : <div key={`empty-${f}-${r}-${c}`} className="h-9 w-9 sm:w-11" />;
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        ))}
      </div>

      {benchSeats.length > 0 && (
        <div className="pt-4 border-t border-slate-200 border-dashed w-full flex flex-col items-center">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Băng 5 cuối xe</div>
          <div className="flex flex-col gap-4 w-full">
            {[1, 2].map(f => {
              const floorBench = benchSeats.filter(s => s.floor === f).sort((a,b) => (a.col ?? 0) - (b.col ?? 0));
              if (floorBench.length === 0) return null;
              return (
                <div key={`bench-row-${f}`} className="flex flex-col items-center gap-1.5">
                   <div className="text-[8px] font-black text-slate-300 uppercase tracking-tighter">Tầng {f}</div>
                  <div className="flex gap-1.5 sm:gap-2 justify-center">
                    {floorBench.map(s => renderSeat(s))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export const OrderInformation: React.FC = () => {
  const [searchId, setSearchId] = useState('');
  const [booking, setBooking] = useState<Booking | null>(null);
  const [history, setHistory] = useState<BookingHistory[]>([]);
  const [trips, setTrips] = useState<BusTrip[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bookingId = params.get('bookingId');
    if (bookingId) {
      handleSearch(bookingId);
    }
  }, []);

  const fetchHistory = async (id: string) => {
    setHistoryLoading(true);
    try {
      const data = await api.bookings.getHistory(id);
      const sorted = [...data].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      setHistory(sorted);
    } catch (error) {
      console.error("Failed to load history", error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSearch = async (id: string = searchId) => {
    const cleanId = id.trim();
    if (!cleanId) return;

    setLoading(true);
    setError(null);
    setHistory([]);
    try {
      const [allBookings, allTrips] = await Promise.all([
        api.bookings.getAll(),
        api.trips.getAll()
      ]);
      
      setTrips(allTrips);
      const found = allBookings.find((b: Booking) => 
        b.id === cleanId || 
        b.id.slice(-6).toUpperCase() === cleanId.toUpperCase() ||
        b.passenger.phone === cleanId
      );

      if (found) {
        setBooking(found);
        await fetchHistory(found.id);
      } else {
        setError('Không tìm thấy thông tin vé. Vui lòng kiểm tra lại mã đơn hoặc số điện thoại.');
        setBooking(null);
      }
    } catch (e) {
      setError('Lỗi hệ thống khi tra cứu dữ liệu.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'payment': return <Badge className="bg-green-500 rounded">Đã thanh toán</Badge>;
      case 'booking': return <Badge className="bg-amber-500 rounded">Đã đặt chỗ</Badge>;
      case 'hold': return <Badge className="bg-purple-500 rounded">Đang giữ chỗ</Badge>;
      case 'cancelled': return <Badge variant="destructive" className="rounded">Đã hủy</Badge>;
      default: return <Badge className="rounded">{status}</Badge>;
    }
  };

  const getActionTheme = (action: string) => {
    switch (action) {
      case "CREATE": return { icon: <Plus size={14} />, color: "emerald", label: "Tạo đơn" };
      case "DELETE":
      case "CANCEL": return { icon: <Trash2 size={14} />, color: "red", label: "Hủy đơn" };
      case "UPDATE": return { icon: <Edit size={14} />, color: "blue", label: "Cập nhật" };
      case "SWAP": return { icon: <ArrowRightLeft size={14} />, color: "purple", label: "Đổi chỗ" };
      case "TRANSFER": return { icon: <Truck size={14} />, color: "indigo", label: "Điều chuyển" };
      case "PASSENGER_UPDATE": return { icon: <UserCog size={14} />, color: "orange", label: "Khách hàng" };
      case "PAY_SEAT": return { icon: <Banknote size={14} />, color: "green", label: "Thu tiền" };
      case "REFUND_SEAT": return { icon: <RotateCcw size={14} />, color: "red", label: "Hoàn vé" };
      default: return { icon: <FileClock size={14} />, color: "slate", label: "Hệ thống" };
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("vi-VN") + " " + date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    } catch (e) { return dateStr; }
  };

  const renderLogDetails = (log: BookingHistory) => {
    const details = log.details || {};
    if ((log.action === "CREATE" || log.action === "DELETE" || log.action === "CANCEL") && details.trips) {
      const isCancelled = log.action === "DELETE" || log.action === "CANCEL";
      return (
        <div className={`space-y-3 mb-2 ${isCancelled ? "opacity-60" : ""}`}>
          {details.trips.map((trip: any, idx: number) => (
            <div key={idx} className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm border-b border-slate-100 border-dashed last:border-b-0 pb-2 last:pb-0">
              <div className="flex items-center gap-2">
                <span className={`flex items-center font-black text-slate-800 ${isCancelled ? "line-through text-slate-400" : ""}`}>
                  <MapPin size={13} className="text-slate-600 mr-1" /> {trip.route}
                </span>
                <span className="bg-yellow-200 border border-yellow-300 rounded flex items-center h-5 px-2 text-[10px] text-slate-900 font-semibold tracking-wider">{trip.licensePlate}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {trip.seats.map((s: string) => (
                  <Badge key={s} className={`${isCancelled ? "bg-red-50 text-red-400 border-red-100 line-through" : "bg-emerald-50 text-emerald-700 border-emerald-200"} text-[10px] font-black px-2 py-0.5 rounded`}>{s}</Badge>
                ))}
              </div>
              <span className="flex items-center text-[11px] text-slate-400 ml-auto"><CalendarIcon size={11} className="mr-1" /> {formatDate(trip.tripDate)}</span>
            </div>
          ))}
        </div>
      );
    }
    if (log.action === "UPDATE" && details.changes) {
      return (
        <div className="space-y-2">
          {details.changes.map((change: any, idx: number) => (
            <div key={idx} className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm border-b border-slate-100 border-dashed last:border-b-0 pb-2 last:pb-0">
              <span className="flex items-center font-black text-slate-800"><MapPin size={12} className="mr-1" />{change.route}</span>
              <div className="flex flex-wrap gap-1.5">
                {change.kept?.map((s: string) => <Badge key={s} className="bg-slate-50 text-slate-600 border-slate-200 font-bold text-[10px] px-2 rounded">{s}</Badge>)}
                {change.removed?.map((s: string) => <Badge key={s} className="bg-red-50 text-red-400 border-red-100 line-through font-bold text-[10px] px-2 rounded">{s}</Badge>)}
                {change.added?.map((s: string) => <Badge key={s} className="bg-emerald-50 text-emerald-700 border-emerald-200 font-black text-[10px] px-2 rounded">{s}</Badge>)}
              </div>
              <span className="flex items-center text-[11px] text-slate-400 ml-auto"><CalendarIcon size={11} className="mr-1" />{formatDate(change.date)}</span>
            </div>
          ))}
        </div>
      );
    }
    if (log.action === "SWAP" && details.from && details.to) {
      return (
        <div className="flex items-center gap-6 text-sm">
          <span className="font-black text-purple-900 min-w-[120px]">{details.route}</span>
          <div className="flex items-center gap-3">
            <span className="text-[9px] font-black text-slate-400 uppercase">Từ</span>
            <span className="font-black text-slate-500 bg-white px-3 py-0.5 rounded border border-slate-200 text-xs">{details.from}</span>
            <ArrowRight size={14} className="text-purple-400" />
            <span className="text-[9px] font-black text-purple-400 uppercase">Sang</span>
            <span className="font-black text-purple-700 bg-white px-3 py-0.5 rounded border border-purple-300 text-xs shadow-sm">{details.to}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20 px-4 md:px-0">
      {/* Search Header */}
      <div className="bg-white p-6 rounded border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-primary/10 rounded text-primary"><QrCode size={24} /></div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Tra cứu thông tin vé</h2>
            <p className="text-sm text-slate-500">Nhập mã đơn hàng hoặc số điện thoại để xem chi tiết</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 group">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" />
            <input 
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all"
              placeholder="Mã đơn (6 số cuối) hoặc Số điện thoại..."
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <Button onClick={() => handleSearch()} disabled={loading} className="rounded px-8 h-[46px]">
            {loading ? <Loader2 size={18} className="animate-spin mr-2" /> : null}
            {loading ? 'Đang kiểm tra...' : 'Tra cứu ngay'}
          </Button>
        </div>
        {error && <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded flex items-center gap-3 text-red-600 text-sm animate-in slide-in-from-top-2"><AlertCircle size={18} />{error}</div>}
      </div>

      {booking && (
        <div className="space-y-8 animate-in zoom-in-95 duration-300">
          {/* Main Content Grid: Summary & Payment */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Booking Summary */}
            <div className="md:col-span-2 bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Ticket className="text-primary" size={20} />
                  <span className="font-bold text-slate-700">Mã đơn: <span className="text-primary">#{booking.id.slice(-6).toUpperCase()}</span></span>
                </div>
                {getStatusBadge(booking.status)}
              </div>
              <div className="p-6">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4"><User size={14} /> Thông tin hành khách</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-4">
                  <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-slate-500">Họ tên:</span><span className="font-bold text-slate-900">{booking.passenger.name || 'Khách lẻ'}</span></div>
                  <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-slate-500">Số điện thoại:</span><span className="font-bold text-slate-900">{booking.passenger.phone}</span></div>
                  <div className="flex justify-between border-b border-slate-50 pb-2 sm:col-span-2"><span className="text-slate-500">Ghi chú hành khách:</span><span className="italic text-slate-600 text-sm text-right">{booking.passenger.note || '---'}</span></div>
                </div>
              </div>
            </div>

            {/* Payment Summary */}
            <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden p-6 flex flex-col justify-between">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4"><CheckCircle2 size={14} /> Thanh toán</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center"><span className="text-slate-600 font-medium">Tổng tiền vé:</span><span className="text-xl font-black text-slate-900">{formatCurrency(booking.totalPrice)} đ</span></div>
                <div className="space-y-2 pt-4 border-t border-slate-100">
                  <div className="flex justify-between items-center text-sm"><span className="text-slate-500">Đã trả (Tiền mặt):</span><span className="font-bold text-emerald-600">{formatCurrency(booking.payment?.paidCash || 0)} đ</span></div>
                  <div className="flex justify-between items-center text-sm"><span className="text-slate-500">Đã trả (Chuyển khoản):</span><span className="font-bold text-blue-600">{formatCurrency(booking.payment?.paidTransfer || 0)} đ</span></div>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-2 text-[10px] text-slate-400">
                <Info size={12}/> Dữ liệu thanh toán được ghi nhận theo thời gian thực
              </div>
            </div>
          </div>

          {/* Trips Detail - Full Width reorganized into 2 columns per trip */}
          <div className="space-y-4">
            <h3 className="font-bold text-slate-800 ml-1 flex items-center gap-2">
              <Bus size={18} className="text-primary"/> Chi tiết hành trình ({booking.items.length})
            </h3>
            <div className="grid grid-cols-1 gap-6">
              {booking.items.map((item, idx) => {
                const tripDate = new Date(item.tripDate);
                const fullTrip = trips.find(t => t.id === item.tripId);
                return (
                  <div key={idx} className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6">
                      <div className="flex flex-col lg:flex-row justify-between gap-10">
                        {/* LEFT COLUMN: Trip Info & Tickets */}
                        <div className="flex-1 space-y-8">
                          {/* Top Part: Trip Details */}
                          <div className="space-y-6">
                            <div className="flex items-center gap-4">
                              <div className="w-14 h-14 bg-primary/5 rounded flex items-center justify-center text-primary border border-primary/10 shadow-sm shrink-0"><Bus size={28} /></div>
                              <div className="min-w-0">
                                <h4 className="text-xl font-black text-slate-900 truncate">{item.route}</h4>
                                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500 mt-1">
                                  <span className="flex items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 font-medium"><Calendar size={14} className="text-slate-400" /> {tripDate.toLocaleDateString('vi-VN')}</span>
                                  <span className="flex items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 font-medium"><Clock size={14} className="text-slate-400" /> {item.tripDate.split(' ')[1]}</span>
                                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 font-bold uppercase tracking-wider text-[10px] rounded">
                                    {item.busType === 'CABIN' ? 'Phòng VIP' : 'Giường nằm'}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded border border-slate-100">
                              <div className="space-y-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Biển số xe</span>
                                <div className="font-black text-slate-700">{item.licensePlate}</div>
                              </div>
                              <div className="space-y-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Điểm đón khách</span>
                                <div className="font-bold text-slate-700 truncate" title={item.tickets[0]?.pickup || 'Văn phòng'}>
                                  <MapPin size={12} className="inline mr-1 text-primary" /> {item.tickets[0]?.pickup || 'Văn phòng'}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Bottom Part: Booked Tickets & Prices */}
                          <div className="space-y-4 pt-6 border-t border-slate-100">
                             <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Danh sách ghế & Giá vé</span>
                                <Badge className="bg-primary/10 text-primary border-transparent font-bold rounded">{item.tickets.length} ghế</Badge>
                             </div>
                             <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                               {item.tickets.map((t) => (
                                 <div key={t.seatId} className="flex flex-col bg-white border border-slate-200 rounded p-3 shadow-sm hover:border-primary/30 transition-colors">
                                   <div className="flex justify-between items-start">
                                      <span className="text-base font-black text-primary">{t.seatId}</span>
                                      <span className="text-[11px] text-slate-900 font-black">{formatCurrency(t.price)} đ</span>
                                   </div>
                                   {t.note && <span className="text-[9px] text-amber-600 italic mt-1 truncate border-t border-amber-50 pt-1">*{t.note}</span>}
                                   <div className="mt-2 pt-1 border-t border-slate-50 flex flex-col gap-1">
                                      <div className="flex items-center gap-1 text-[9px] text-slate-400 truncate"><MapPin size={8}/> {t.pickup || '---'}</div>
                                      <div className="flex items-center gap-1 text-[9px] text-slate-400 truncate"><Locate size={8}/> {t.dropoff || '---'}</div>
                                   </div>
                                 </div>
                               ))}
                             </div>
                             <div className="p-3 bg-blue-50/50 rounded border border-dashed border-blue-200 flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-600">Thanh toán cho hành trình này:</span>
                                <span className="text-lg font-black text-blue-700">{formatCurrency(item.price)} đ</span>
                             </div>
                          </div>
                        </div>

                        {/* RIGHT COLUMN: Seat Map Preview */}
                        <div className="lg:w-[45%] flex flex-col items-center lg:items-start space-y-4 border-t lg:border-t-0 lg:border-l border-slate-100 pt-8 lg:pt-0 lg:pl-10 overflow-hidden">
                          {fullTrip ? (
                            <div className="w-full">
                              <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <LayoutGrid size={14} /> Sơ đồ vị trí giường ({item.busType === 'CABIN' ? '22 phòng' : '41 giường'})
                              </h5>
                              <div className="flex justify-center w-full overflow-hidden">
                                <SeatMapPreview trip={fullTrip} bookedSeatIds={item.seatIds} />
                              </div>
                              <div className="flex gap-4 mt-6 text-[10px] font-bold uppercase text-slate-400 justify-center w-full">
                                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-blue-600 rounded-sm"></div> Ghế của bạn</div>
                                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-slate-300 rounded-sm"></div> Ghế khác</div>
                              </div>
                              <div className="mt-6 p-4 bg-slate-50 rounded border border-slate-100 text-[11px] text-slate-500 leading-relaxed italic">
                                <span className="font-bold text-slate-900 block mb-1">Ghi chú sơ đồ:</span>
                                <Info size={14} className="inline mr-1 text-slate-400 mb-0.5" /> 
                                Sơ đồ hiển thị vị trí tương đối trên xe bao gồm các tầng và băng cuối. Ghế của bạn được đánh dấu màu xanh dương đậm.
                              </div>
                            </div>
                          ) : (
                            <div className="h-full w-full flex flex-col items-center justify-center text-slate-300 py-10">
                              <Bus size={40} className="opacity-20 mb-2"/>
                              <p className="text-xs italic">Đang tải sơ đồ ghế...</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Timeline History Section - Bottom Full Width */}
          <div className="space-y-4 pt-6 border-t border-slate-200">
            <div className="flex items-center justify-between ml-1">
              <h3 className="font-black text-slate-800 flex items-center gap-2 text-lg">
                <FileClock size={22} className="text-primary" /> Nhật ký hoạt động đơn hàng
              </h3>
              <Badge variant="outline" className="text-slate-400 border-slate-200 font-medium rounded">Toàn bộ lịch sử</Badge>
            </div>
            
            <div className="bg-white rounded border border-slate-200 p-8 shadow-sm min-h-[300px]">
              {historyLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <Loader2 className="animate-spin mb-4" size={40} />
                  <p className="text-sm font-bold tracking-wider uppercase">Đang đồng bộ dữ liệu lịch sử...</p>
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-20 text-slate-400">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed border-slate-200 opacity-50">
                    <FileClock size={32} />
                  </div>
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Hệ thống chưa ghi nhận biến động</p>
                </div>
              ) : (
                <div className="relative border-l-2 border-slate-100 ml-4 md:ml-6 space-y-10 py-2">
                  {history.map((log, idx) => {
                    const theme = getActionTheme(log.action);
                    const colorClasses = {
                      emerald: "bg-emerald-500 shadow-emerald-500/20",
                      red: "bg-red-500 shadow-red-500/20",
                      blue: "bg-blue-500 shadow-blue-500/20",
                      purple: "bg-purple-500 shadow-purple-500/20",
                      orange: "bg-orange-500 shadow-orange-500/20",
                      slate: "bg-slate-500 shadow-slate-500/20",
                      green: "bg-green-600 shadow-green-600/20",
                      indigo: "bg-indigo-600 shadow-indigo-600/20",
                    }[theme.color];

                    return (
                      <div key={log.id} className="relative pl-10 animate-in slide-in-from-left duration-500">
                        {/* Timeline Dot */}
                        <div className={`absolute -left-[11px] top-1 w-5 h-5 rounded-full border-4 border-white shadow-lg flex items-center justify-center ${colorClasses} z-10`}>
                          <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                        </div>

                        <div className="flex flex-col gap-3">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border flex items-center gap-2 shadow-sm
                              ${log.action === "CREATE" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                log.action === "DELETE" || log.action === "CANCEL" || log.action === "REFUND_SEAT" ? "bg-red-50 text-red-700 border-red-200" :
                                log.action === "UPDATE" ? "bg-blue-50 text-blue-700 border-blue-200" :
                                log.action === "SWAP" ? "bg-purple-50 text-purple-700 border-purple-200" :
                                log.action === "TRANSFER" ? "bg-indigo-50 text-indigo-700 border-indigo-200" :
                                log.action === "PASSENGER_UPDATE" ? "bg-orange-50 text-orange-700 border-orange-200" :
                                "bg-green-50 text-green-700 border-green-200"}
                            `}>
                              {theme.icon}
                              {theme.label}
                            </span>
                            <span className="text-xs text-slate-400 font-bold bg-slate-50 px-3 py-1 rounded border border-slate-100 flex items-center gap-1.5">
                              <Clock size={12}/> {formatDate(log.timestamp)}
                            </span>
                          </div>

                          <div className="bg-slate-50/50 p-5 rounded border border-slate-100 hover:bg-white hover:shadow-xl hover:border-slate-200 transition-all duration-300">
                            {renderLogDetails(log)}
                            <div className="mt-3 flex items-start gap-3">
                              <div className="p-1.5 bg-white rounded border border-slate-100 text-slate-400 shrink-0"><Info size={14}/></div>
                              <p className="text-[13px] leading-relaxed text-slate-600 font-medium pt-0.5">{log.description}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Decorative end dot */}
                  <div className="absolute -bottom-1 -left-[5px] w-2 h-2 rounded-full bg-slate-200"></div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!booking && !loading && !error && (
        <div className="py-32 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded bg-white/50 backdrop-blur-sm">
          <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-200 shadow-inner opacity-40">
            <Ticket size={48} />
          </div>
          <h3 className="text-lg font-bold text-slate-500 uppercase tracking-widest">Sẵn sàng tra cứu</h3>
          <p className="font-medium text-slate-400 mt-2">Vui lòng quét QR trên vé hoặc nhập thông tin mã đơn/SĐT</p>
        </div>
      )}
    </div>
  );
};