
import React, { useState, useEffect } from 'react';
import { 
  Search, Ticket, Calendar, MapPin, Phone, User, Clock, Bus, 
  CheckCircle2, AlertCircle, QrCode, FileClock, 
  Loader2, Plus, Trash2, Edit, ArrowRightLeft, Truck, UserCog, 
  Banknote, RotateCcw, Info, CalendarIcon, ArrowRight
} from 'lucide-react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { api } from '../lib/api';
import { Booking, BookingHistory } from '../types';
import { formatCurrency } from '../utils/formatters';

export const OrderInformation: React.FC = () => {
  const [searchId, setSearchId] = useState('');
  const [booking, setBooking] = useState<Booking | null>(null);
  const [history, setHistory] = useState<BookingHistory[]>([]);
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
      const allBookings = await api.bookings.getAll();
      const found = allBookings.find((b: Booking) => 
        b.id === cleanId || 
        b.id.slice(-6).toUpperCase() === cleanId.toUpperCase() ||
        b.passenger.phone === cleanId
      );

      if (found) {
        setBooking(found);
        await fetchHistory(found.id);
      } else {
        setError('KHÔNG TÌM THẤY THÔNG TIN VÉ. VUI LÒNG KIỂM TRA LẠI MÃ ĐƠN HOẶC SỐ ĐIỆN THOẠI.');
        setBooking(null);
      }
    } catch (e) {
      setError('LỖI HỆ THỐNG KHI TRUY XUẤT DỮ LIỆU.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClass = "rounded-none border-2 px-3 py-1 font-black uppercase text-[10px] tracking-widest";
    switch (status) {
      case 'payment': return <span className={`${baseClass} border-black bg-black text-white`}>Đã thanh toán</span>;
      case 'booking': return <span className={`${baseClass} border-black text-black`}>Đã đặt chỗ</span>;
      case 'hold': return <span className={`${baseClass} border-slate-400 text-slate-500 border-dashed`}>Đang giữ chỗ</span>;
      case 'cancelled': return <span className={`${baseClass} border-slate-300 text-slate-300 line-through`}>Đã hủy</span>;
      default: return <span className={baseClass}>{status}</span>;
    }
  };

  const getActionTheme = (action: string) => {
    const baseIconSize = 14;
    switch (action) {
      case "CREATE": return { icon: <Plus size={baseIconSize} />, label: "TẠO ĐƠN" };
      case "DELETE":
      case "CANCEL": return { icon: <Trash2 size={baseIconSize} />, label: "HỦY ĐƠN" };
      case "UPDATE": return { icon: <Edit size={baseIconSize} />, label: "CẬP NHẬT" };
      case "SWAP": return { icon: <ArrowRightLeft size={baseIconSize} />, label: "ĐỔI CHỖ" };
      case "TRANSFER": return { icon: <Truck size={baseIconSize} />, label: "ĐIỀU CHUYỂN" };
      case "PASSENGER_UPDATE": return { icon: <UserCog size={baseIconSize} />, label: "KHÁCH HÀNG" };
      case "PAY_SEAT": return { icon: <Banknote size={baseIconSize} />, label: "THU TIỀN" };
      case "REFUND_SEAT": return { icon: <RotateCcw size={baseIconSize} />, label: "HOÀN VÉ" };
      default: return { icon: <FileClock size={baseIconSize} />, label: "HỆ THỐNG" };
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
    const badgeClass = "rounded-none border border-black bg-white text-black text-[10px] font-black px-2 py-0.5";
    
    if ((log.action === "CREATE" || log.action === "DELETE" || log.action === "CANCEL") && details.trips) {
      const isCancelled = log.action === "DELETE" || log.action === "CANCEL";
      return (
        <div className={`space-y-2 mb-1 ${isCancelled ? "opacity-40" : ""}`}>
          {details.trips.map((trip: any, idx: number) => (
            <div key={idx} className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs border-b border-slate-200 border-dashed last:border-b-0 pb-2 last:pb-0">
              <div className="flex items-center gap-2">
                <span className={`font-black text-black uppercase ${isCancelled ? "line-through" : ""}`}>
                  {trip.route}
                </span>
                <span className="border border-black px-2 text-[9px] font-bold tracking-tighter">{trip.licensePlate}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {trip.seats.map((s: string) => (
                  <span key={s} className={badgeClass}>{s}</span>
                ))}
              </div>
              <span className="text-[10px] text-slate-500 ml-auto font-mono">[{formatDate(trip.tripDate)}]</span>
            </div>
          ))}
        </div>
      );
    }
    if (log.action === "UPDATE" && details.changes) {
      return (
        <div className="space-y-1">
          {details.changes.map((change: any, idx: number) => (
            <div key={idx} className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs border-b border-slate-200 border-dashed last:border-b-0 pb-2 last:pb-0">
              <span className="font-black text-black uppercase">{change.route}</span>
              <div className="flex flex-wrap gap-1">
                {change.kept?.map((s: string) => <span key={s} className="rounded-none border border-slate-300 text-slate-400 text-[10px] font-bold px-2 py-0.5">{s}</span>)}
                {change.removed?.map((s: string) => <span key={s} className="rounded-none border border-slate-200 text-slate-300 line-through text-[10px] font-bold px-2 py-0.5">{s}</span>)}
                {change.added?.map((s: string) => <span key={s} className={badgeClass}>{s}</span>)}
              </div>
              <span className="text-[10px] text-slate-500 ml-auto font-mono">[{formatDate(change.date)}]</span>
            </div>
          ))}
        </div>
      );
    }
    if (log.action === "SWAP" && details.from && details.to) {
      return (
        <div className="flex items-center gap-6 text-xs py-1">
          <span className="font-black uppercase text-black min-w-[120px]">{details.route}</span>
          <div className="flex items-center gap-3">
            <span className="text-[9px] font-bold text-slate-400 uppercase">GỐC</span>
            <span className="font-black border border-slate-300 px-3 py-0.5 text-[11px]">{details.from}</span>
            <ArrowRight size={14} className="text-black" />
            <span className="text-[9px] font-bold text-black uppercase">MỚI</span>
            <span className="font-black border-2 border-black px-3 py-0.5 text-[11px]">{details.to}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20 px-4 md:px-0">
      {/* Search Header - Monochrome Style */}
      <div className="bg-white p-8 rounded-none border-2 border-black shadow-none">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-black text-white rounded-none"><QrCode size={32} /></div>
          <div>
            <h2 className="text-2xl font-black text-black uppercase tracking-tighter">TRA CỨU THÔNG TIN VÉ</h2>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">NHẬP MÃ ĐƠN HÀNG HOẶC SỐ ĐIỆN THOẠI HÀNH KHÁCH</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-0">
          <div className="relative flex-1 group">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-black" />
            <input 
              className="w-full pl-12 pr-4 py-4 border-2 border-black border-r-0 rounded-none outline-none focus:bg-slate-50 transition-all font-bold placeholder-slate-300"
              placeholder="MÃ ĐƠN (6 SỐ CUỐI) HOẶC SĐT..."
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <Button onClick={() => handleSearch()} disabled={loading} className="rounded-none px-10 h-[60px] bg-black text-white font-black uppercase tracking-widest hover:bg-slate-800">
            {loading ? <Loader2 size={20} className="animate-spin mr-2" /> : null}
            {loading ? 'ĐANG TRA...' : 'TRA CỨU'}
          </Button>
        </div>
        {error && <div className="mt-6 p-4 border-2 border-dashed border-black flex items-center gap-3 text-black text-xs font-black uppercase tracking-tight animate-pulse"><AlertCircle size={20} />{error}</div>}
      </div>

      {booking && (
        <div className="space-y-8 animate-in zoom-in-95 duration-300">
          {/* Main Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border-2 border-black divide-x-2 divide-black">
            {/* Booking Summary */}
            <div className="md:col-span-2 bg-white overflow-hidden">
              <div className="bg-slate-50 px-6 py-4 border-b-2 border-black flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Ticket className="text-black" size={24} />
                  <span className="font-black text-black text-lg uppercase tracking-tighter">MÃ ĐƠN: <span className="underline italic">#{booking.id.slice(-6).toUpperCase()}</span></span>
                </div>
                {getStatusBadge(booking.status)}
              </div>
              <div className="p-6">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 border-b border-slate-100 pb-2 flex items-center gap-2"><User size={14} /> THÔNG TIN HÀNH KHÁCH</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-6">
                  <div className="flex flex-col border-b border-slate-100 pb-2"><span className="text-[9px] font-bold text-slate-400 uppercase">Họ và tên:</span><span className="font-black text-black text-lg">{booking.passenger.name || 'KHÁCH LẺ'}</span></div>
                  <div className="flex flex-col border-b border-slate-100 pb-2"><span className="text-[9px] font-bold text-slate-400 uppercase">Số điện thoại:</span><span className="font-black text-black text-lg">{booking.passenger.phone}</span></div>
                  <div className="flex flex-col sm:col-span-2"><span className="text-[9px] font-bold text-slate-400 uppercase mb-1">Ghi chú:</span><span className="italic text-slate-600 font-medium text-sm border border-dashed border-slate-200 p-2">{booking.passenger.note || '---'}</span></div>
                </div>
              </div>
            </div>

            {/* Payment Summary */}
            <div className="bg-white p-6 flex flex-col">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 border-b border-slate-100 pb-2 flex items-center gap-2"><CheckCircle2 size={14} /> TỔNG THANH TOÁN</h3>
              <div className="space-y-6 flex-1">
                <div className="flex flex-col"><span className="text-[9px] font-bold text-slate-400 uppercase">Tổng cộng:</span><span className="text-3xl font-black text-black tracking-tighter">{formatCurrency(booking.totalPrice)} đ</span></div>
                <div className="space-y-3 pt-6 border-t-2 border-black border-dotted">
                  <div className="flex justify-between items-center text-xs font-bold uppercase"><span className="text-slate-500">Tiền mặt:</span><span className="text-black">{formatCurrency(booking.payment?.paidCash || 0)} đ</span></div>
                  <div className="flex justify-between items-center text-xs font-bold uppercase"><span className="text-slate-500">Chuyển khoản:</span><span className="text-black">{formatCurrency(booking.payment?.paidTransfer || 0)} đ</span></div>
                </div>
              </div>
              <div className="mt-8 pt-4 border-t border-slate-100 flex items-start gap-2 text-[9px] font-bold text-slate-400 uppercase leading-relaxed">
                <Info size={12} className="shrink-0"/> CHỨNG TỪ ĐIỆN TỬ ĐƯỢC XÁC THỰC BỞI VINABUS MANAGER
              </div>
            </div>
          </div>

          {/* Trips Detail - Ticket Style */}
          <div className="space-y-4">
            <h3 className="font-black text-black text-lg uppercase tracking-tight ml-1 flex items-center gap-2">
              <Bus size={22} className="text-black"/> CHI TIẾT HÀNH TRÌNH ({booking.items.length})
            </h3>
            <div className="space-y-0 border-2 border-black divide-y-2 divide-black">
              {booking.items.map((item, idx) => {
                const tripDate = new Date(item.tripDate);
                return (
                  <div key={idx} className="bg-white p-6">
                    <div className="flex flex-col lg:flex-row justify-between gap-10">
                      <div className="space-y-8 flex-1">
                        <div className="flex items-start gap-6">
                          <div className="w-16 h-16 border-2 border-black rounded-none flex items-center justify-center text-black shrink-0 font-black text-2xl tracking-tighter">#{idx + 1}</div>
                          <div className="min-w-0">
                            <h4 className="text-2xl font-black text-black uppercase tracking-tight mb-2">{item.route}</h4>
                            <div className="flex flex-wrap items-center gap-3">
                              <span className="font-black text-xs border border-black px-2 py-0.5 uppercase">{tripDate.toLocaleDateString('vi-VN')}</span>
                              <span className="font-black text-xs border border-black px-2 py-0.5 uppercase">{item.tripDate.split(' ')[1]}</span>
                              <span className="font-bold text-[10px] bg-black text-white px-2 py-1 uppercase tracking-widest">{item.busType === 'CABIN' ? 'PHÒNG VIP' : 'GIƯỜNG NẰM'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-0 border-2 border-black divide-x-2 divide-black">
                          <div className="p-4 bg-slate-50"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">BIỂN SỐ XE</span><div className="font-black text-black text-xl">{item.licensePlate}</div></div>
                          <div className="p-4"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">ĐIỂM ĐÓN</span><div className="font-black text-black truncate uppercase">{item.tickets[0]?.pickup || 'VĂN PHÒNG'}</div></div>
                        </div>
                      </div>

                      <div className="lg:w-[35%] space-y-6 lg:border-l-2 lg:border-black lg:pl-10 lg:border-dashed">
                         <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-black uppercase tracking-widest border-b-2 border-black">VỊ TRÍ GHẾ & GIÁ VÉ</span>
                            <span className="font-black text-xs underline">{item.tickets.length} GHẾ</span>
                         </div>
                         <div className="grid grid-cols-1 gap-2">
                           {item.tickets.map((t) => (
                             <div key={t.seatId} className="flex justify-between items-center border border-slate-200 p-3 rounded-none group hover:border-black transition-colors">
                               <div className="flex items-center gap-3">
                                 <span className="text-lg font-black text-black">{t.seatId}</span>
                                 {t.note && <span className="text-[9px] font-bold text-slate-400 uppercase">({t.note})</span>}
                               </div>
                               <span className="text-sm font-black text-black">{formatCurrency(t.price)} đ</span>
                             </div>
                           ))}
                         </div>
                         <div className="p-4 border border-dashed border-slate-300 text-[10px] font-bold text-slate-500 flex flex-col gap-3 uppercase">
                            <div className="flex items-center gap-3"><MapPin size={14} className="text-black" /> {item.tickets[0]?.pickup || 'XÁC NHẬN ĐIỂM ĐÓN VỚI NHÀ XE'}</div>
                            <div className="flex items-center gap-3"><Clock size={14} className="text-black" /> CÓ MẶT TRƯỚC GIỜ KHỞI HÀNH 15 PHÚT</div>
                         </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Timeline History Section - Document Log Style */}
          <div className="pt-10 border-t-4 border-black">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-black text-black flex items-center gap-3 text-xl uppercase tracking-tighter">
                <FileClock size={28} className="text-black" /> NHẬT KÝ BIẾN ĐỘNG ĐƠN HÀNG
              </h3>
              <span className="text-[10px] font-black border-2 border-black px-3 py-1 uppercase tracking-widest">LOG_DATA_SYNCED</span>
            </div>
            
            <div className="bg-white border-2 border-black p-8 rounded-none">
              {historyLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="animate-spin mb-4 text-black" size={48} />
                  <p className="text-[11px] font-black uppercase tracking-widest">ĐANG TRUY XUẤT NHẬT KÝ HỆ THỐNG...</p>
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed border-slate-200">
                  <p className="text-xs font-black text-slate-300 uppercase tracking-[0.3em]">CHƯA CÓ DỮ LIỆU NHẬT KÝ</p>
                </div>
              ) : (
                <div className="relative border-l-4 border-black ml-4 md:ml-6 space-y-12 py-2">
                  {history.map((log, idx) => {
                    const theme = getActionTheme(log.action);
                    return (
                      <div key={log.id} className="relative pl-12 animate-in slide-in-from-left duration-500">
                        {/* Dot */}
                        <div className="absolute -left-[14px] top-1 w-6 h-6 bg-black border-4 border-white flex items-center justify-center z-10">
                          <div className="w-1.5 h-1.5 bg-white"></div>
                        </div>

                        <div className="flex flex-col gap-4">
                          <div className="flex items-center justify-between flex-wrap gap-4 border-b border-black pb-2">
                            <div className="flex items-center gap-3">
                              <span className="font-black text-xs uppercase tracking-tighter flex items-center gap-2">
                                {theme.icon}
                                {theme.label}
                              </span>
                              <span className="h-4 w-[1px] bg-slate-200"></span>
                              <span className="text-[11px] font-black text-slate-500 font-mono flex items-center gap-1.5">
                                <Clock size={12}/> {formatDate(log.timestamp)}
                              </span>
                            </div>
                            <span className="text-[9px] font-bold text-slate-400 font-mono tracking-widest uppercase">ID_{log.id.slice(-6)}</span>
                          </div>

                          <div className="p-5 border border-slate-100 hover:bg-slate-50 transition-colors">
                            {renderLogDetails(log)}
                            <div className="mt-4 flex items-start gap-4">
                              <div className="p-2 bg-black text-white font-black text-[10px] uppercase shrink-0">GHI CHÚ</div>
                              <p className="text-[13px] leading-relaxed text-black font-bold pt-1 uppercase tracking-tight">{log.description}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Footer dot */}
                  <div className="absolute -bottom-2 -left-[6px] w-3 h-3 bg-black"></div>
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
               KẾT THÚC NHẬT KÝ ĐƠN HÀNG
            </div>
          </div>
        </div>
      )}

      {!booking && !loading && !error && (
        <div className="py-40 text-center border-4 border-dashed border-slate-200 bg-white">
          <div className="w-32 h-32 border-4 border-slate-100 flex items-center justify-center mx-auto mb-8 grayscale opacity-20">
            <Ticket size={64} />
          </div>
          <h3 className="text-xl font-black text-slate-300 uppercase tracking-[0.4em]">SẴN SÀNG TRA CỨU</h3>
          <p className="font-bold text-slate-300 mt-4 uppercase text-[11px] tracking-widest">VUI LÒNG QUÉT QR TRÊN VÉ HOẶC NHẬP THÔNG TIN CẦN TÌM</p>
        </div>
      )}
    </div>
  );
};
