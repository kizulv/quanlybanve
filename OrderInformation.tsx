
import React, { useState, useEffect } from 'react';
import { Search, Ticket, Calendar, MapPin, Phone, User, Clock, Bus, CheckCircle2, AlertCircle, ArrowLeft, QrCode } from 'lucide-react';
import { Button } from './components/ui/Button';
import { Badge } from './components/ui/Badge';
import { api } from './lib/api';
import { Booking } from './types';
import { formatCurrency } from './utils/formatters';
import { formatLunarDate } from './utils/dateUtils';

export const OrderInformation: React.FC = () => {
  const [searchId, setSearchId] = useState('');
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Xử lý khi quét QR code có tham số ?bookingId=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bookingId = params.get('bookingId');
    if (bookingId) {
      handleSearch(bookingId);
    }
  }, []);

  const handleSearch = async (id: string = searchId) => {
    const cleanId = id.trim();
    if (!cleanId) return;

    setLoading(true);
    setError(null);
    try {
      const allBookings = await api.bookings.getAll();
      // Tìm kiếm theo ID hoặc 6 ký tự cuối của ID hoặc Số điện thoại
      const found = allBookings.find((b: Booking) => 
        b.id === cleanId || 
        b.id.slice(-6).toUpperCase() === cleanId.toUpperCase() ||
        b.passenger.phone === cleanId
      );

      if (found) {
        setBooking(found);
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
      case 'payment': return <Badge className="bg-green-500">Đã thanh toán</Badge>;
      case 'booking': return <Badge className="bg-amber-500">Đã đặt chỗ</Badge>;
      case 'hold': return <Badge className="bg-purple-500">Đang giữ chỗ</Badge>;
      case 'cancelled': return <Badge variant="destructive">Đã hủy</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <QrCode size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Tra cứu thông tin vé</h2>
            <p className="text-sm text-slate-500">Nhập mã đơn hàng hoặc số điện thoại để xem chi tiết</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 group">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" />
            <input 
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all"
              placeholder="Mã đơn (6 số cuối) hoặc Số điện thoại..."
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <Button 
            onClick={() => handleSearch()} 
            disabled={loading}
            className="rounded-xl px-8 h-[46px]"
          >
            {loading ? 'Đang kiểm tra...' : 'Tra cứu ngay'}
          </Button>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-sm animate-in slide-in-from-top-2">
            <AlertCircle size={18} />
            {error}
          </div>
        )}
      </div>

      {booking && (
        <div className="space-y-6 animate-in zoom-in-95 duration-300">
          {/* Header Thông tin chung */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Ticket className="text-primary" size={20} />
                <span className="font-bold text-slate-700">Mã đơn: <span className="text-primary">#{booking.id.slice(-6).toUpperCase()}</span></span>
              </div>
              {getStatusBadge(booking.status)}
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <User size={14} /> Thông tin hành khách
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-slate-500">Họ tên:</span>
                    <span className="font-bold text-slate-900">{booking.passenger.name || 'Khách lẻ'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-slate-500">Số điện thoại:</span>
                    <span className="font-bold text-slate-900">{booking.passenger.phone}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-slate-500">Ghi chú:</span>
                    <span className="italic text-slate-600">{booking.passenger.note || '---'}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <CheckCircle2 size={14} /> Thanh toán
                </h3>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Tổng tiền vé:</span>
                    <span className="text-lg font-bold text-slate-900">{formatCurrency(booking.totalPrice)} đ</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Đã trả (TM):</span>
                    <span className="font-medium text-emerald-600">{formatCurrency(booking.payment?.paidCash || 0)} đ</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Đã trả (CK):</span>
                    <span className="font-medium text-blue-600">{formatCurrency(booking.payment?.paidTransfer || 0)} đ</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Danh sách các chuyến */}
          <div className="space-y-4">
            <h3 className="font-bold text-slate-800 ml-1">Chi tiết hành trình ({booking.items.length})</h3>
            {booking.items.map((item, idx) => {
              const tripDate = new Date(item.tripDate);
              return (
                <div key={idx} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden group">
                  <div className="p-6">
                    <div className="flex flex-col md:flex-row justify-between gap-6">
                      <div className="space-y-4 flex-1">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-primary/5 rounded-xl flex items-center justify-center text-primary border border-primary/10">
                            <Bus size={24} />
                          </div>
                          <div>
                            <h4 className="text-lg font-bold text-slate-900">{item.route}</h4>
                            <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
                              <span className="flex items-center gap-1.5"><Calendar size={14} /> {tripDate.toLocaleDateString('vi-VN')}</span>
                              <span className="flex items-center gap-1.5"><Clock size={14} /> {item.tripDate.split(' ')[1]}</span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl">
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Biển số xe</span>
                            <div className="font-bold text-slate-700">{item.licensePlate}</div>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Loại xe</span>
                            <div className="font-bold text-slate-700">{item.busType === 'CABIN' ? 'Phòng VIP' : 'Giường nằm'}</div>
                          </div>
                        </div>
                      </div>

                      <div className="md:w-64 space-y-3 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6">
                         <span className="text-[10px] font-bold text-slate-400 uppercase">Vị trí ghế đã chọn</span>
                         <div className="flex flex-wrap gap-2">
                           {item.tickets.map((t) => (
                             <div key={t.seatId} className="flex flex-col items-center bg-white border border-slate-200 rounded-lg p-2 min-w-[80px] shadow-sm">
                               <span className="text-sm font-black text-primary">{t.seatId}</span>
                               <span className="text-[10px] text-slate-500 font-bold">{formatCurrency(t.price)} đ</span>
                             </div>
                           ))}
                         </div>
                         <div className="pt-2 text-[11px] text-slate-500 flex flex-col gap-1">
                            <div className="flex items-center gap-1.5"><MapPin size={12} className="text-primary" /> {item.tickets[0]?.pickup || 'Đón tại văn phòng'}</div>
                            <div className="flex items-center gap-1.5"><Clock size={12} className="text-slate-400" /> Vui lòng có mặt trước 15p</div>
                         </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!booking && !loading && !error && (
        <div className="py-20 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl bg-white/50">
          <Ticket size={48} className="mx-auto mb-4 opacity-10" />
          <p className="font-medium">Vui lòng quét QR trên vé hoặc nhập thông tin tra cứu</p>
        </div>
      )}
    </div>
  );
};
