
import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Popover } from './ui/Popover';
import { Calendar } from './ui/Calendar';
import { 
  DollarSign, Calendar as CalendarIcon, Search, Edit2, 
  ArrowRight, CreditCard, Banknote, 
  Eye, User, Phone, MapPin, Clock,
  Check, X, Zap, Ticket, Loader2,
  Filter, CalendarDays, RefreshCw, AlertCircle,
  TrendingUp, ArrowDownRight, ArrowUpRight,
  ChevronDown,
  Calculator,
  Wallet
} from 'lucide-react';
import { useToast } from './ui/Toast';
import { Dialog } from './ui/Dialog';
import { Booking } from '../types';

interface PaymentGroup {
  bookingId: string;
  bookingDisplayId: string;
  passengerName: string;
  passengerPhone: string;
  bookingStatus: string;
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
  
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  
  const [selectedGroup, setSelectedGroup] = useState<PaymentGroup | null>(null);
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

  const groupedPayments = useMemo(() => {
    const groups: Record<string, PaymentGroup> = {};

    payments.forEach(payment => {
       const booking = payment.bookingId;
       const bKey = booking ? booking.id : 'orphaned'; 
       
       if (!groups[bKey]) {
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

  const filteredGroups = useMemo(() => {
      return groupedPayments.filter(g => {
         const lower = searchTerm.toLowerCase();
         const matchesSearch = !searchTerm.trim() || (
            g.passengerPhone.includes(lower) || 
            g.passengerName.toLowerCase().includes(lower) ||
            g.bookingDisplayId.toLowerCase().includes(lower) ||
            g.tripInfo.seats.some(s => s.toLowerCase().includes(lower))
         );

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

  const stats = useMemo(() => {
      let cashTotal = 0;
      let transferTotal = 0;
      let totalTickets = 0;

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

  const resetFilters = () => {
      setSearchTerm('');
      setStartDate(undefined);
      setEndDate(undefined);
  };

  const saveEditNote = async () => {
      if (!editingPaymentId) return;
      try {
          await api.payments.update(editingPaymentId, { note: editNote });
          fetchData();
          setEditingPaymentId(null);
          toast({ type: 'success', title: 'Đã cập nhật', message: 'Đã lưu ghi chú' });
      } catch (e) {
          toast({ type: 'error', title: 'Lỗi', message: 'Không thể cập nhật' });
      }
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return "Chọn ngày...";
    return date.toLocaleDateString("vi-VN");
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
    <div className="max-w-7xl mx-auto space-y-4 animate-in fade-in duration-500">
      
      {/* 1. COMPACT HEADER & STATS */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="bg-indigo-950 p-4 rounded-lg border border-indigo-900 shadow-sm flex flex-col justify-center text-white">
             <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-yellow-500 rounded text-indigo-950">
                    <Banknote size={18}/>
                </div>
                <h2 className="font-bold text-sm uppercase tracking-wider">Tài chính</h2>
             </div>
             <p className="text-indigo-300 text-[10px] italic">Dòng tiền thực tế toàn hệ thống</p>
             <Button onClick={fetchData} variant="ghost" className="mt-4 h-8 text-[10px] font-bold text-indigo-300 hover:text-white hover:bg-indigo-900 border border-indigo-800 self-start">
                <RefreshCw size={12} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                Cập nhật dữ liệu
             </Button>
          </div>

          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex items-center gap-4">
             <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                <TrendingUp size={20}/>
             </div>
             <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tổng thực thu</div>
                <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black text-slate-900">
                        {stats.grandTotal.toLocaleString('vi-VN')}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">đ</span>
                </div>
             </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex items-center gap-4">
             <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                <Ticket size={20}/>
             </div>
             <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vé hoàn thành</div>
                <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black text-slate-900">{stats.totalTickets}</span>
                    <span className="text-[10px] font-bold text-slate-400">giường</span>
                </div>
             </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-center gap-2">
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                   <span className="text-slate-400">Tiền mặt</span>
                   <span className="text-emerald-600">{stats.cashTotal.toLocaleString('vi-VN')} đ</span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div 
                        className="bg-emerald-500 h-full rounded-full transition-all duration-1000" 
                        style={{ width: `${stats.grandTotal > 0 ? (stats.cashTotal / stats.grandTotal) * 100 : 0}%` }}
                    />
                </div>
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                   <span className="text-slate-400">Chuyển khoản</span>
                   <span className="text-blue-600">{stats.transferTotal.toLocaleString('vi-VN')} đ</span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div 
                        className="bg-blue-500 h-full rounded-full transition-all duration-1000" 
                        style={{ width: `${stats.grandTotal > 0 ? (stats.transferTotal / stats.grandTotal) * 100 : 0}%` }}
                    />
                </div>
          </div>
      </div>

      {/* 2. COMPACT TOOLBAR */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center">
          <div className="relative flex-1 w-full group">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400 group-focus-within:text-primary transition-colors"/>
            <input 
                className="w-full pl-9 pr-4 h-9 border border-slate-200 rounded text-xs outline-none focus:ring-2 focus:ring-primary/5 focus:border-primary placeholder-slate-400 transition-all bg-slate-50/50"
                placeholder="Tìm SĐT, Tên khách, Mã ghế..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 bg-slate-100/50 p-1 rounded border border-slate-200">
              <Popover
                trigger={
                  <div className="flex items-center gap-2 px-2.5 h-7 bg-white border border-slate-200 rounded hover:border-primary/30 transition-all cursor-pointer min-w-[120px]">
                    <CalendarIcon size={12} className="text-slate-400" />
                    <span className="text-[11px] font-bold text-slate-700">{formatDate(startDate)}</span>
                  </div>
                }
                content={(close) => (
                  <Calendar 
                    selected={startDate} 
                    onSelect={(d) => { setStartDate(d); close(); }} 
                  />
                )}
              />
              <ArrowRight size={12} className="text-slate-300"/>
              <Popover
                trigger={
                  <div className="flex items-center gap-2 px-2.5 h-7 bg-white border border-slate-200 rounded hover:border-primary/30 transition-all cursor-pointer min-w-[120px]">
                    <CalendarIcon size={12} className="text-slate-400" />
                    <span className="text-[11px] font-bold text-slate-700">{formatDate(endDate)}</span>
                  </div>
                }
                content={(close) => (
                  <Calendar 
                    selected={endDate} 
                    onSelect={(d) => { setEndDate(d); close(); }} 
                  />
                )}
              />
          </div>

          <Button 
            variant="ghost" 
            onClick={resetFilters}
            className="h-9 px-3 text-slate-500 hover:text-red-600 hover:bg-red-50 font-bold text-[11px]"
          >
            <X size={14} className="mr-1.5"/> Xóa lọc
          </Button>
      </div>

      {/* 3. COMPACT DATA TABLE */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
         <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-50 text-slate-500 font-bold text-[10px] uppercase tracking-wider border-b border-slate-200">
                <tr>
                    <th className="px-4 py-3">Khách hàng</th>
                    <th className="px-4 py-3">Lịch trình & Ghế</th>
                    <th className="px-4 py-3 text-center">Trạng thái</th>
                    <th className="px-4 py-3 text-right">Tổng thực thu</th>
                    <th className="px-4 py-3 text-right">Ngày GD</th>
                    <th className="px-4 py-3 text-center w-16">Xem</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                {filteredGroups.length === 0 ? (
                    <tr>
                        <td colSpan={6} className="p-12 text-center">
                            <div className="flex flex-col items-center gap-2 text-slate-300">
                                <Search size={32} />
                                <p className="text-[11px] font-bold italic">Không có dữ liệu phù hợp.</p>
                            </div>
                        </td>
                    </tr>
                ) : filteredGroups.map(group => {
                    const isCancelled = group.bookingStatus === 'cancelled';
                    return (
                    <tr key={group.bookingId} className={`hover:bg-slate-50 transition-colors group ${isCancelled ? 'bg-red-50/30' : ''}`}>
                        <td className="px-4 py-2.5">
                            <div className={`flex flex-col ${isCancelled ? 'line-through decoration-red-400/50' : ''}`}>
                                <span className={`font-bold text-sm ${isCancelled ? 'text-slate-400' : 'text-slate-900'} transition-colors`}>
                                    {group.passengerName}
                                </span>
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                                    <Phone size={10} className="text-slate-300"/>
                                    {group.passengerPhone}
                                </div>
                            </div>
                        </td>
                        <td className="px-4 py-2.5">
                            <div className={`flex flex-col gap-0.5 ${isCancelled ? 'line-through decoration-red-400/50' : ''}`}>
                                <div className={`font-bold text-[11px] ${isCancelled ? 'text-slate-400' : 'text-indigo-700'}`}>
                                    {group.tripInfo.route}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] text-slate-400 font-medium flex items-center gap-1">
                                        <CalendarIcon size={9}/>
                                        {group.tripInfo.date ? new Date(group.tripInfo.date).toLocaleDateString('vi-VN') : 'N/A'}
                                    </span>
                                    <div className="flex flex-wrap gap-1">
                                        {group.tripInfo.seats.map((s, i) => (
                                            <span key={i} className={`text-[8px] font-bold px-1 py-0.5 bg-slate-100 text-slate-600 rounded border border-slate-200 ${isCancelled ? 'opacity-50' : ''}`}>
                                                {s}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                            {isCancelled ? (
                                <Badge className="bg-red-100 text-red-700 border-red-200 text-[8px] font-black px-1.5 h-4">HỦY</Badge>
                            ) : group.bookingStatus === 'payment' ? (
                                <Badge className="bg-green-100 text-green-700 border-green-200 text-[8px] font-black px-1.5 h-4">MUA</Badge>
                            ) : (
                                <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[8px] font-black px-1.5 h-4">ĐẶT</Badge>
                            )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                            <span className={`text-sm font-black ${isCancelled ? 'text-slate-300 line-through' : (group.totalCollected >= 0 ? 'text-emerald-700' : 'text-red-700')}`}>
                                {group.totalCollected.toLocaleString('vi-VN')} <span className="text-[9px] font-bold">đ</span>
                            </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                            <div className={`text-[10px] font-bold ${isCancelled ? 'text-slate-400' : 'text-slate-600'}`}>
                                {group.latestTransaction.toLocaleDateString('vi-VN')}
                            </div>
                            <div className="text-[8px] text-slate-400 font-medium mt-0.5">
                                {group.latestTransaction.toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})}
                            </div>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                            <Button 
                                onClick={() => setSelectedGroup(group)}
                                variant="ghost"
                                className="h-7 w-7 p-0 rounded text-primary hover:bg-primary/10"
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

      {/* 4. DETAIL MODAL REDESIGN (Indigo Theme) */}
      <Dialog 
        isOpen={!!selectedGroup} 
        onClose={() => { setSelectedGroup(null); setEditingPaymentId(null); }} 
        title="Lịch sử giao dịch"
        className="max-w-2xl bg-white border-slate-200 rounded-lg"
      >
          {selectedGroup && (
             <div className="space-y-4 max-h-[75vh] overflow-y-auto px-4 py-4 custom-scrollbar">
                 <div className="bg-indigo-950 p-4 rounded-lg text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sticky top-0 z-20 shadow-md">
                     <div className="flex items-center gap-3">
                         <div className="w-10 h-10 bg-white/10 rounded flex items-center justify-center text-white border border-white/20">
                             <User size={20}/>
                         </div>
                         <div>
                             <h3 className="font-bold text-base leading-none">{selectedGroup.passengerName}</h3>
                             <div className="flex items-center gap-2 text-[10px] text-white/60 font-bold mt-1">
                                 <span>{selectedGroup.passengerPhone}</span>
                                 <span className="opacity-30">•</span>
                                 <span>Mã đơn: #{selectedGroup.bookingId.slice(-6).toUpperCase()}</span>
                             </div>
                         </div>
                     </div>
                     <div className="text-right">
                         <div className="text-[8px] text-white/40 uppercase font-bold tracking-widest mb-0.5">Tổng thực thu</div>
                         <div className={`text-lg font-black ${selectedGroup.totalCollected >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                             {selectedGroup.totalCollected.toLocaleString('vi-VN')} đ
                         </div>
                     </div>
                 </div>

                 <div className="relative border-l-2 border-slate-100 ml-4 space-y-6 py-2">
                    {selectedGroup.payments.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 italic text-xs">Không có dữ liệu giao dịch.</div>
                    ) : (
                        [...selectedGroup.payments].sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).map((p) => {
                            const isPositive = p.amount >= 0;
                            const isCash = p.method === 'cash';
                            
                            return (
                                <div key={p.id} className="relative pl-6 animate-in slide-in-from-left duration-200">
                                    <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white shadow flex items-center justify-center ${isPositive ? 'bg-emerald-500' : 'bg-red-500'}`}>
                                        <div className="w-1 h-1 rounded-full bg-white"></div>
                                    </div>

                                    <div className="bg-slate-50 p-3 rounded border border-slate-200 hover:border-indigo-200 transition-colors">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <Badge className={`text-[8px] font-black px-1.5 h-4 border ${isPositive ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                                                    {isPositive ? 'THU' : 'CHI'}
                                                </Badge>
                                                <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                                                    <Clock size={10} />
                                                    {new Date(p.timestamp).toLocaleString('vi-VN')}
                                                </span>
                                            </div>
                                            <div className={`text-sm font-black ${isPositive ? 'text-emerald-700' : 'text-red-700'}`}>
                                                {isPositive ? '+' : ''}{p.amount.toLocaleString('vi-VN')} đ
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 mb-3">
                                            <div className={`p-1.5 rounded ${isCash ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {isCash ? <DollarSign size={12} /> : <CreditCard size={12} />}
                                            </div>
                                            <div className="text-[11px] font-bold text-slate-700">
                                                {isCash ? 'Tiền mặt' : p.method === 'transfer' ? 'Chuyển khoản' : 'Hỗn hợp'}
                                            </div>
                                        </div>

                                        <div className="bg-white p-2 rounded border border-slate-200 text-[11px] text-slate-600 relative group/note">
                                            {editingPaymentId === p.id ? (
                                                <div className="flex gap-2 w-full">
                                                    <input 
                                                        className="flex-1 bg-white border border-primary/40 rounded px-2 py-1 outline-none text-[11px]"
                                                        value={editNote}
                                                        onChange={(e) => setEditNote(e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && saveEditNote()}
                                                        autoFocus
                                                    />
                                                    <Button onClick={saveEditNote} size="sm" className="h-7 px-2 bg-emerald-600"><Check size={14}/></Button>
                                                    <Button onClick={() => setEditingPaymentId(null)} variant="outline" size="sm" className="h-7 px-2"><X size={14}/></Button>
                                                </div>
                                            ) : (
                                                <div className="w-full flex justify-between items-center gap-4">
                                                    <span className={`${!p.note ? "italic text-slate-400" : "font-medium text-slate-700"}`}>
                                                        {p.note || "Không có ghi chú"}
                                                    </span>
                                                    <button 
                                                        onClick={() => { setEditingPaymentId(p.id); setEditNote(p.note || ''); }} 
                                                        className="opacity-0 group-hover/note:opacity-100 p-1 text-primary hover:bg-slate-100 rounded transition-all"
                                                    >
                                                        <Edit2 size={12} />
                                                    </button>
                                                </div>
                                            )}
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
