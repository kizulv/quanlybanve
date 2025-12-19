
import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { 
  DollarSign, Calendar, Search, Edit2, 
  ArrowRight, CreditCard, Banknote, 
  Eye, User, Phone, MapPin, Clock,
  Check, X, Zap, Ticket, Loader2,
  Filter, CalendarDays, RefreshCw, AlertCircle,
  TrendingUp, ArrowDownRight, ArrowUpRight
} from 'lucide-react';
import { useToast } from './ui/Toast';
import { Dialog } from './ui/Dialog';
import { formatLunarDate } from '../utils/dateUtils';
import { Booking, BusTrip, BusType } from '../types';

interface PaymentGroup {
  bookingId: string;
  bookingDisplayId: string;
  passengerName: string;
  passengerPhone: string;
  bookingStatus: string; // Thêm trạng thái để xử lý gạch ngang
  tripInfo: {
    route: string;
    date: string;
    seats: string[];
  };
  payments: any[];
  totalCollected: number;
  latestTransaction: Date;
}

export const PaymentManager: React.FC = () => {
  const { toast } = useToast();
  const [payments, setPayments] = useState<any[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Date filter state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Detail Modal State
  const [selectedGroup, setSelectedGroup] = useState<PaymentGroup | null>(null);
  
  // Edit Note State
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [paymentsData, bookingsData] = await Promise.all([
        api.payments.getAll(),
        api.bookings.getAll()
      ]);
      setPayments(paymentsData);
      setBookings(bookingsData);
    } catch (e) {
      console.error(e);
      toast({ type: 'error', title: 'Lỗi', message: 'Không thể tải dữ liệu tài chính' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- GROUPING LOGIC ---
  const groupedPayments = useMemo(() => {
    const groups: Record<string, PaymentGroup> = {};

    payments.forEach(payment => {
       const booking = payment.bookingId;
       const bKey = booking ? booking.id : 'orphaned'; 
       
       if (!groups[bKey]) {
          // Tìm trạng thái đơn hàng thật từ danh sách bookings
          const originalBooking = bookings.find(b => b.id === bKey);
          
          groups[bKey] = {
             bookingId: bKey,
             bookingDisplayId: bKey === 'orphaned' ? 'N/A' : bKey.slice(-6).toUpperCase(),
             passengerName: booking?.passenger?.name || 'Khách lẻ / Đã xóa',
             passengerPhone: booking?.passenger?.phone || 'N/A',
             bookingStatus: originalBooking?.status || (booking?.status) || 'active',
             tripInfo: {
                route: payment.details?.route || 'N/A',
                date: payment.details?.tripDate || '',
                seats: payment.details?.seats || []
             },
             payments: [],
             totalCollected: 0,
             latestTransaction: new Date(0)
          };
       }

       groups[bKey].payments.push(payment);
       groups[bKey].totalCollected += payment.amount;
       
       const pDate = new Date(payment.timestamp);
       if (pDate > groups[bKey].latestTransaction) {
           groups[bKey].latestTransaction = pDate;
       }
    });

    return Object.values(groups).sort((a, b) => b.latestTransaction.getTime() - a.latestTransaction.getTime());
  }, [payments, bookings]);

  // --- FILTER LOGIC (SEARCH + DATE) ---
  const filteredGroups = useMemo(() => {
      return groupedPayments.filter(g => {
         // 1. Search filter
         const lower = searchTerm.toLowerCase();
         const matchesSearch = !searchTerm.trim() || (
            g.passengerPhone.includes(lower) || 
            g.passengerName.toLowerCase().includes(lower) ||
            g.bookingDisplayId.toLowerCase().includes(lower) ||
            g.tripInfo.seats.some(s => s.toLowerCase().includes(lower))
         );

         // 2. Date range filter
         let matchesDate = true;
         const txDate = new Date(g.latestTransaction);
         txDate.setHours(0, 0, 0, 0);

         if (startDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            if (txDate < start) matchesDate = false;
         }
         if (endDate) {
            const end = new Date(endDate);
            end.setHours(0, 0, 0, 0);
            if (txDate > end) matchesDate = false;
         }

         return matchesSearch && matchesDate;
      });
  }, [groupedPayments, searchTerm, startDate, endDate]);

  // --- STATS ON FILTERED DATA ---
  const stats = useMemo(() => {
      let cashTotal = 0;
      let transferTotal = 0;
      let totalTickets = 0;

      // Tính toán dựa trên danh sách đã lọc để thống kê phản ứng theo bộ lọc ngày
      filteredGroups.forEach(group => {
          if (group.bookingStatus !== 'cancelled') {
              group.payments.forEach(p => {
                  cashTotal += (p.cashAmount || 0);
                  transferTotal += (p.transferAmount || 0);
              });
              totalTickets += group.tripInfo.seats.length;
          }
      });

      return {
          cashTotal,
          transferTotal,
          grandTotal: cashTotal + transferTotal,
          totalTickets
      };
  }, [filteredGroups]);

  // --- HANDLERS ---
  const resetFilters = () => {
      setSearchTerm('');
      setStartDate('');
      setEndDate('');
  };

  const startEditNote = (payment: any) => {
      setEditingPaymentId(payment.id);
      setEditNote(payment.note || '');
  };

  const saveEditNote = async () => {
      if (!editingPaymentId) return;
      try {
          await api.payments.update(editingPaymentId, { note: editNote });
          fetchData(); // Reload to sync
          setEditingPaymentId(null);
          toast({ type: 'success', title: 'Đã cập nhật', message: 'Đã lưu ghi chú' });
      } catch (e) {
          toast({ type: 'error', title: 'Lỗi', message: 'Không thể cập nhật' });
      }
  };

  if (loading && payments.length === 0) {
      return (
          <div className="flex flex-col items-center justify-center h-[400px] text-slate-400">
              <Loader2 className="animate-spin mb-4" size={48} />
              <p className="font-medium">Đang tải dữ liệu tài chính...</p>
          </div>
      );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      
      {/* 1. HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <div className="p-2 bg-emerald-500 rounded-xl text-white shadow-lg shadow-emerald-500/20">
                <Banknote size={28}/>
              </div>
              Quản lý Tài chính
           </h2>
           <p className="text-slate-500 mt-1.5 text-sm font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Theo dõi dòng tiền thực tế và doanh thu bán vé
           </p>
        </div>
        <div className="flex items-center gap-2">
            <Button onClick={fetchData} variant="outline" className="bg-white border-slate-200 hover:bg-slate-50 shadow-sm h-11 px-5 rounded-xl font-bold text-slate-700">
                <RefreshCw size={18} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
                Làm mới
            </Button>
        </div>
      </div>

      {/* 2. STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-emerald-500/30 transition-all">
             <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform">
                <TrendingUp size={80} className="text-emerald-600"/>
             </div>
             <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <DollarSign size={20}/>
                </div>
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Tổng thực thu</span>
             </div>
             <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-slate-900 tracking-tight">
                    {stats.grandTotal.toLocaleString('vi-VN')}
                </span>
                <span className="text-sm font-bold text-slate-400">đ</span>
             </div>
             <div className="mt-4 pt-4 border-t border-slate-50 flex items-center gap-2 text-xs font-bold text-emerald-600">
                <ArrowUpRight size={14}/>
                Bao gồm TM & Chuyển khoản
             </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-blue-500/30 transition-all">
             <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform">
                <Ticket size={80} className="text-blue-600"/>
             </div>
             <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                    <Ticket size={20}/>
                </div>
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Vé hoàn thành</span>
             </div>
             <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-slate-900 tracking-tight">{stats.totalTickets}</span>
                <span className="text-sm font-bold text-slate-400">giường</span>
             </div>
             <div className="mt-4 pt-4 border-t border-slate-50 flex items-center gap-2 text-xs font-bold text-blue-600">
                <Check size={14}/>
                Không tính đơn đã hủy
             </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
             <div className="space-y-4">
                <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest text-slate-400">
                   <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Tiền mặt</span>
                   <span className="text-slate-900">{stats.cashTotal.toLocaleString('vi-VN')} đ</span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div 
                        className="bg-emerald-500 h-full rounded-full transition-all duration-1000" 
                        style={{ width: `${stats.grandTotal > 0 ? (stats.cashTotal / stats.grandTotal) * 100 : 0}%` }}
                    />
                </div>
                
                <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest text-slate-400">
                   <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Chuyển khoản</span>
                   <span className="text-slate-900">{stats.transferTotal.toLocaleString('vi-VN')} đ</span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div 
                        className="bg-blue-500 h-full rounded-full transition-all duration-1000" 
                        style={{ width: `${stats.grandTotal > 0 ? (stats.transferTotal / stats.grandTotal) * 100 : 0}%` }}
                    />
                </div>
             </div>
          </div>
      </div>

      {/* 3. TOOLBAR SECTION */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col lg:flex-row gap-4 items-end">
              
              {/* Search */}
              <div className="flex-1 w-full space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tìm kiếm thông tin</label>
                  <div className="relative group">
                    <Search size={18} className="absolute left-4 top-3 text-slate-400 group-focus-within:text-primary transition-colors"/>
                    <input 
                        className="w-full pl-11 pr-4 h-12 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary placeholder-slate-400 transition-all bg-slate-50/50"
                        placeholder="SĐT, Tên khách, Mã ghế hoặc Mã đơn..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
              </div>

              {/* Date Filter */}
              <div className="w-full lg:w-auto space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Khoảng ngày bán</label>
                  <div className="flex items-center gap-2 bg-slate-50/50 p-1 border border-slate-200 rounded-2xl h-12">
                      <div className="relative flex items-center">
                          <Calendar size={14} className="absolute left-3 text-slate-400 pointer-events-none"/>
                          <input 
                             type="date"
                             value={startDate}
                             onChange={e => setStartDate(e.target.value)}
                             className="pl-9 pr-3 py-1.5 bg-transparent border-0 text-xs font-bold text-slate-700 focus:ring-0 outline-none w-[140px]"
                          />
                      </div>
                      <ArrowRight size={14} className="text-slate-300"/>
                      <div className="relative flex items-center">
                          <Calendar size={14} className="absolute left-3 text-slate-400 pointer-events-none"/>
                          <input 
                             type="date"
                             value={endDate}
                             onChange={e => setEndDate(e.target.value)}
                             className="pl-9 pr-3 py-1.5 bg-transparent border-0 text-xs font-bold text-slate-700 focus:ring-0 outline-none w-[140px]"
                          />
                      </div>
                  </div>
              </div>

              {/* Reset Button */}
              <Button 
                variant="ghost" 
                onClick={resetFilters}
                className="h-12 px-5 rounded-2xl text-slate-500 hover:text-red-600 hover:bg-red-50 font-bold text-xs"
              >
                <X size={16} className="mr-2"/> Xóa lọc
              </Button>
          </div>
      </div>

      {/* 4. DATA TABLE */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
         <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-slate-50/80 text-slate-500 font-bold text-[10px] uppercase tracking-[0.15em] border-b border-slate-200">
                <tr>
                    <th className="px-6 py-5">Khách hàng</th>
                    <th className="px-6 py-5">Lịch trình & Ghế</th>
                    <th className="px-6 py-5 text-center">Trạng thái</th>
                    <th className="px-6 py-5 text-right">Tổng thực thu</th>
                    <th className="px-6 py-5 text-right">Ngày GD</th>
                    <th className="px-6 py-5 text-center w-24">Chi tiết</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                {filteredGroups.length === 0 ? (
                    <tr>
                        <td colSpan={6} className="p-20 text-center">
                            <div className="flex flex-col items-center gap-3">
                                <div className="p-4 bg-slate-50 rounded-full text-slate-300">
                                    <Search size={40} />
                                </div>
                                <p className="text-slate-400 font-bold italic">Không tìm thấy dữ liệu phù hợp trong khoảng này.</p>
                            </div>
                        </td>
                    </tr>
                ) : filteredGroups.map(group => {
                    const isCancelled = group.bookingStatus === 'cancelled';
                    return (
                    <tr key={group.bookingId} className={`hover:bg-slate-50/80 transition-colors group ${isCancelled ? 'opacity-60 bg-slate-50/30' : ''}`}>
                        <td className="px-6 py-5">
                            <div className={`flex flex-col ${isCancelled ? 'line-through decoration-slate-400' : ''}`}>
                                <span className={`font-black text-base ${isCancelled ? 'text-slate-400' : 'text-slate-900 group-hover:text-primary'} transition-colors`}>
                                    {group.passengerName}
                                </span>
                                <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1.5 font-bold">
                                    <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                                        <Phone size={10}/>
                                    </div>
                                    {group.passengerPhone}
                                </div>
                            </div>
                        </td>
                        <td className="px-6 py-5">
                            <div className={`flex flex-col gap-1.5 ${isCancelled ? 'line-through decoration-slate-400' : ''}`}>
                                <div className="font-bold text-blue-700 flex items-center gap-2">
                                    <MapPin size={13} className="text-blue-400"/>
                                    {group.tripInfo.route}
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="text-[11px] text-slate-400 font-bold flex items-center gap-1.5">
                                        <Calendar size={11}/>
                                        {group.tripInfo.date ? new Date(group.tripInfo.date).toLocaleDateString('vi-VN') : 'N/A'}
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {group.tripInfo.seats.map((s, i) => (
                                            <Badge key={i} className={`text-[9px] font-black px-1.5 h-4 bg-slate-100 text-slate-600 border-slate-200 ${isCancelled ? 'opacity-50' : ''}`}>
                                                {s}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </td>
                        <td className="px-6 py-5 text-center">
                            {isCancelled ? (
                                <Badge variant="destructive" className="bg-red-50 text-red-600 border-red-200 text-[9px] font-black uppercase tracking-wider px-2">
                                    Đã hủy vé
                                </Badge>
                            ) : group.bookingStatus === 'payment' ? (
                                <Badge variant="success" className="bg-emerald-50 text-emerald-600 border-emerald-200 text-[9px] font-black uppercase tracking-wider px-2">
                                    Đã thanh toán
                                </Badge>
                            ) : (
                                <Badge variant="warning" className="bg-amber-50 text-amber-600 border-amber-200 text-[9px] font-black uppercase tracking-wider px-2">
                                    Đang đặt chỗ
                                </Badge>
                            )}
                        </td>
                        <td className="px-6 py-5 text-right">
                            <span className={`text-base font-black tracking-tight ${isCancelled ? 'text-slate-400' : (group.totalCollected >= 0 ? 'text-emerald-700' : 'text-red-700')}`}>
                                {group.totalCollected.toLocaleString('vi-VN')} <span className="text-[10px] font-bold">đ</span>
                            </span>
                        </td>
                        <td className="px-6 py-5 text-right">
                            <div className="text-[11px] font-black text-slate-600">
                                {group.latestTransaction.toLocaleDateString('vi-VN')}
                            </div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                                {group.latestTransaction.toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})}
                            </div>
                        </td>
                        <td className="px-6 py-5 text-center">
                            <Button 
                                onClick={() => setSelectedGroup(group)}
                                className="bg-primary/5 text-primary hover:bg-primary hover:text-white border-primary/20 h-9 px-4 rounded-xl text-xs font-black transition-all shadow-sm active:scale-95"
                            >
                                <Eye size={14}/>
                            </Button>
                        </td>
                    </tr>
                    );
                })}
                </tbody>
            </table>
         </div>
      </div>

      {/* 5. DETAIL MODAL */}
      <Dialog 
        isOpen={!!selectedGroup} 
        onClose={() => { setSelectedGroup(null); setEditingPaymentId(null); }} 
        title="Chi tiết lịch sử thanh toán"
        className="max-w-2xl rounded-3xl"
      >
          {selectedGroup && (
             <div className="space-y-6 max-h-[75vh] overflow-y-auto px-4 py-2 custom-scrollbar">
                 <div className="bg-slate-900 p-6 rounded-3xl text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-6 sticky top-0 z-20 shadow-xl shadow-slate-200">
                     <div className="flex items-center gap-4">
                         <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-white border border-white/20">
                             <User size={28}/>
                         </div>
                         <div className="space-y-1">
                             <h3 className="font-black text-xl leading-none">{selectedGroup.passengerName}</h3>
                             <div className="flex items-center gap-3 text-xs text-white/60 font-bold">
                                 <span className="flex items-center gap-1.5"><Phone size={12}/> {selectedGroup.passengerPhone}</span>
                                 <span className="opacity-30">•</span>
                                 <span>Mã đơn: #{selectedGroup.bookingId.slice(-6).toUpperCase()}</span>
                             </div>
                         </div>
                     </div>
                     <div className="bg-white/10 p-3 rounded-2xl border border-white/10 self-stretch md:self-auto flex flex-col justify-center min-w-[150px] text-right">
                         <div className="text-[10px] text-white/40 uppercase font-black tracking-widest mb-1">Thực thu nhóm</div>
                         <div className={`text-2xl font-black ${selectedGroup.totalCollected >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                             {selectedGroup.totalCollected.toLocaleString('vi-VN')} đ
                         </div>
                     </div>
                 </div>

                 <div className="relative border-l-2 border-slate-100 ml-6 space-y-10 py-4">
                    {selectedGroup.payments.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 italic">Không có dữ liệu lịch sử giao dịch.</div>
                    ) : (
                        [...selectedGroup.payments].sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).map((p, idx, arr) => {
                            const isPositive = p.amount >= 0;
                            const isCash = p.method === 'cash';
                            
                            return (
                                <div key={p.id} className="relative pl-10 animate-in slide-in-from-left duration-300">
                                    {/* Timeline Marker */}
                                    <div className={`absolute -left-[11px] top-1 w-5 h-5 rounded-full border-4 border-white shadow-md flex items-center justify-center ${isPositive ? 'bg-emerald-500' : 'bg-red-500'}`}>
                                        <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                                    </div>

                                    <div className="flex flex-col gap-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Badge className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shadow-sm border ${isPositive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                                    {isPositive ? 'Thu tiền' : 'Hoàn tiền'}
                                                </Badge>
                                                <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1.5">
                                                    <Clock size={11} />
                                                    {new Date(p.timestamp).toLocaleString('vi-VN')}
                                                </span>
                                            </div>
                                            <div className={`text-xl font-black ${isPositive ? 'text-emerald-600' : 'text-red-600'} tracking-tight`}>
                                                {isPositive ? '+' : ''}{p.amount.toLocaleString('vi-VN')} đ
                                            </div>
                                        </div>

                                        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
                                            <div className="flex items-center gap-4 mb-5 pb-4 border-b border-slate-50">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${isCash ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                                                    {isCash ? <DollarSign size={20} /> : <CreditCard size={20} />}
                                                </div>
                                                <div>
                                                    <div className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-0.5">Phương thức GD</div>
                                                    <div className="text-sm font-black text-slate-800">
                                                        {isCash ? 'Tiền mặt' : p.method === 'transfer' ? 'Chuyển khoản' : 'Hỗn hợp'}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Note editing field */}
                                            <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100 text-xs text-slate-600 min-h-[48px] flex items-center relative group/note">
                                                {editingPaymentId === p.id ? (
                                                    <div className="flex gap-2 w-full">
                                                        <input 
                                                            className="flex-1 bg-white border border-primary/50 rounded-xl px-4 py-2 outline-none focus:ring-4 focus:ring-primary/5 text-xs font-bold"
                                                            value={editNote}
                                                            onChange={(e) => setEditNote(e.target.value)}
                                                            onKeyDown={(e) => e.key === 'Enter' && saveEditNote()}
                                                            autoFocus
                                                        />
                                                        <button onClick={saveEditNote} className="bg-emerald-500 text-white p-2 rounded-xl hover:bg-emerald-600 transition-all"><Check size={16}/></button>
                                                        <button onClick={() => setEditingPaymentId(null)} className="bg-slate-200 text-slate-600 p-2 rounded-xl hover:bg-slate-300 transition-all"><X size={16}/></button>
                                                    </div>
                                                ) : (
                                                    <div className="w-full flex justify-between items-center gap-4">
                                                        <span className={`flex-1 font-bold ${!p.note ? "italic text-slate-400" : "text-slate-700"}`}>
                                                            {p.note || "Không có ghi chú"}
                                                        </span>
                                                        <button 
                                                            onClick={() => startEditNote(p)} 
                                                            className="opacity-0 group-hover/note:opacity-100 p-2 text-primary hover:bg-white rounded-xl transition-all shadow-sm"
                                                        >
                                                            <Edit2 size={14} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                 </div>
             </div>
          )}
      </Dialog>
    </div>
  );
};
