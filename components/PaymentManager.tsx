
import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { 
  DollarSign, Calendar, Search, Edit2, 
  ArrowRight, CreditCard, Banknote, 
  Eye, User, Phone, MapPin, Clock,
  Check, X, Zap, Ticket, Loader2
} from 'lucide-react';
import { useToast } from './ui/Toast';
import { Dialog } from './ui/Dialog';
import { formatLunarDate } from '../utils/dateUtils';
import { Booking, BusTrip, BusType } from '../types';

// Define Interface for Payment Group
interface PaymentGroup {
  bookingId: string;
  bookingDisplayId: string;
  passengerName: string;
  passengerPhone: string;
  tripInfo: {
    route: string;
    date: string;
    seats: string[];
  };
  payments: any[];
  totalCollected: number; // Sum of amounts (positive and negative)
  latestTransaction: Date;
}

export const PaymentManager: React.FC = () => {
  const { toast } = useToast();
  const [payments, setPayments] = useState<any[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Detail Modal State
  const [selectedGroup, setSelectedGroup] = useState<PaymentGroup | null>(null);
  
  // Edit Note State (Inside Detail Modal)
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
          groups[bKey] = {
             bookingId: bKey,
             bookingDisplayId: bKey === 'orphaned' ? 'N/A' : bKey.slice(-6).toUpperCase(),
             passengerName: booking?.passenger?.name || 'Khách lẻ / Đã xóa',
             passengerPhone: booking?.passenger?.phone || 'N/A',
             tripInfo: {
                route: payment.details?.route || 'N/A',
                date: payment.details?.tripDate || '',
                seats: payment.details?.seats || []
             },
             payments: [],
             totalCollected: 0,
             latestTransaction: new Date(0) // Epoch
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
  }, [payments]);

  // --- ACCURATE STATS CALCULATION ---
  const stats = useMemo(() => {
      // 1. Financial Totals directly from Payments (Cash flow history)
      let cashTotal = 0;
      let transferTotal = 0;
      payments.forEach(p => {
          cashTotal += (p.cashAmount || 0);
          transferTotal += (p.transferAmount || 0);
      });

      // 2. Ticket Totals from current active Bookings (Snapshot state)
      let cabinTickets = 0;
      let sleeperTickets = 0;
      let enhancedTickets = 0;
      let totalTickets = 0;

      bookings.forEach(booking => {
          const paid = (booking.payment?.paidCash || 0) + (booking.payment?.paidTransfer || 0);
          
          if (booking.status !== 'cancelled' && paid > 0) {
              booking.items.forEach(item => {
                  const count = (item.seatIds || []).length;
                  if (count === 0) return;

                  if (item.isEnhanced === true) {
                      enhancedTickets += count;
                  } else {
                      const isCabin = item.busType === BusType.CABIN || (item.route || '').toLowerCase().includes('cabin');
                      if (isCabin) {
                          cabinTickets += count;
                      } else {
                          sleeperTickets += count;
                      }
                  }
                  
                  totalTickets += count;
              });
          }
      });

      return {
          cashTotal,
          transferTotal,
          grandTotal: cashTotal + transferTotal,
          cabinTickets,
          sleeperTickets,
          enhancedTickets,
          totalTickets
      };
  }, [payments, bookings]);

  // --- FILTER LOGIC ---
  const filteredGroups = useMemo(() => {
      if (!searchTerm.trim()) return groupedPayments;
      const lower = searchTerm.toLowerCase();
      
      return groupedPayments.filter(g => 
         g.passengerPhone.includes(lower) || 
         g.passengerName.toLowerCase().includes(lower) ||
         g.bookingDisplayId.toLowerCase().includes(lower) ||
         g.tripInfo.seats.some(s => s.toLowerCase().includes(lower)) ||
         g.payments.some(p => (p.note || '').toLowerCase().includes(lower))
      );
  }, [groupedPayments, searchTerm]);

  // --- HANDLERS ---
  const startEditNote = (payment: any) => {
      setEditingPaymentId(payment.id);
      setEditNote(payment.note || '');
  };

  const saveEditNote = async () => {
      if (!editingPaymentId) return;
      try {
          await api.payments.update(editingPaymentId, { note: editNote });
          const updatedPayments = payments.map(p => p.id === editingPaymentId ? { ...p, note: editNote } : p);
          setPayments(updatedPayments);
          if (selectedGroup) {
              const updatedGroupPayments = selectedGroup.payments.map(p => p.id === editingPaymentId ? { ...p, note: editNote } : p);
              setSelectedGroup({ ...selectedGroup, payments: updatedGroupPayments });
          }
          setEditingPaymentId(null);
          toast({ type: 'success', title: 'Đã cập nhật', message: 'Đã lưu ghi chú' });
      } catch (e) {
          toast({ type: 'error', title: 'Lỗi', message: 'Không thể cập nhật' });
      }
  };

  function normalizeTrips(details: any) {
      if (details.trips && Array.isArray(details.trips)) return details.trips;
      if (details.route || (details.seats && details.seats.length > 0)) {
          return [{
              route: details.route || 'Unknown',
              tripDate: details.tripDate,
              licensePlate: details.licensePlate,
              seats: details.seats || [],
          }];
      }
      return [];
  };

  function calculateDiff(prevTrips: any[], currTrips: any[]) {
      const getTripKey = (t: any) => `${t.route}-${t.tripDate}`;
      const prevMap = new Map();
      prevTrips.forEach(t => prevMap.set(getTripKey(t), t));
      const currMap = new Map();
      currTrips.forEach(t => currMap.set(getTripKey(t), t));
      const allKeys = new Set([...prevMap.keys(), ...currMap.keys()]);
      const results: any[] = [];
      allKeys.forEach(key => {
          const prevT = prevMap.get(key);
          const currT = currMap.get(key);
          const pSeats = new Set(prevT ? (prevT.seats || []) : []);
          const cSeats = new Set(currT ? (currT.seats || []) : []);
          const meta = currT || prevT || {};
          const seatDiffs: any[] = [];
          const allSeats = new Set([...pSeats, ...cSeats]);
          allSeats.forEach(s => {
              const inPrev = pSeats.has(s);
              const inCurr = cSeats.has(s);
              let status = 'kept';
              if (inCurr && !inPrev) status = 'added';
              if (!inCurr && inPrev) status = 'removed';
              let price = 0;
              if (status !== 'removed' && currT) {
                  if (currT.tickets) { const t = currT.tickets.find((tic: any) => tic.seatId === s); if (t) price = t.price; }
              }
              if (status === 'removed' && prevT) {
                   if (prevT.tickets) { const t = prevT.tickets.find((tic: any) => tic.seatId === s); if (t) price = t.price; }
              }
              seatDiffs.push({ id: s, status, price });
          });
          seatDiffs.sort((a,b) => a.id.localeCompare(b.id, undefined, {numeric: true}));
          results.push({ ...meta, diffSeats: seatDiffs });
      });
      return results;
  };

  if (loading) {
      return (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <Loader2 className="animate-spin mb-4" size={48} />
              <p>Đang tải dữ liệu tài chính...</p>
          </div>
      );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center border-b border-slate-200 pb-5">
        <div>
           <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Banknote size={28} className="text-green-600"/> Quản lý Tài chính
           </h2>
           <p className="text-slate-500 mt-1 text-sm font-medium">Thống kê doanh thu và số lượng vé thực tế đã thu tiền.</p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm" className="rounded-lg">Làm mới</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
             <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                   <div className="w-12 h-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center shadow-sm">
                      <DollarSign size={24}/>
                   </div>
                   <div>
                      <h3 className="font-bold text-slate-800">Tổng thu thanh toán</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Thực thu dòng tiền</p>
                   </div>
                </div>
                <div className="text-right">
                   <p className="text-3xl font-black text-green-700 tracking-tight">{stats.grandTotal.toLocaleString('vi-VN')} đ</p>
                </div>
             </div>
             
             <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-100">
                   <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Tiền mặt
                   </p>
                   <p className="text-lg font-black text-slate-800 tracking-tight">{stats.cashTotal.toLocaleString('vi-VN')} đ</p>
                </div>
                <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-100">
                   <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> Chuyển khoản
                   </p>
                   <p className="text-lg font-black text-slate-800 tracking-tight">{stats.transferTotal.toLocaleString('vi-VN')} đ</p>
                </div>
             </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
             <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                   <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-sm">
                      <Ticket size={24}/>
                   </div>
                   <div>
                      <h3 className="font-bold text-slate-800">Vé đã thanh toán</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Trạng thái hiện tại</p>
                   </div>
                </div>
                <div className="text-right">
                   <p className="text-3xl font-black text-blue-700 tracking-tight">{stats.totalTickets} <span className="text-base font-bold">vé</span></p>
                </div>
             </div>

             <div className="grid grid-cols-3 gap-3">
                <div className="bg-indigo-50/40 p-3 rounded-xl border border-indigo-100 flex flex-col items-center shadow-sm">
                   <p className="text-[10px] font-bold text-indigo-400 uppercase mb-1.5">Xe Phòng</p>
                   <p className="text-2xl font-black text-indigo-700">{stats.cabinTickets}</p>
                </div>
                <div className="bg-sky-50/40 p-3 rounded-xl border border-sky-100 flex flex-col items-center shadow-sm">
                   <p className="text-[10px] font-bold text-sky-500 uppercase mb-1.5">Xe Thường</p>
                   <p className="text-2xl font-black text-sky-700">{stats.sleeperTickets}</p>
                </div>
                <div className="bg-amber-50/40 p-3 rounded-xl border border-amber-100 flex flex-col items-center shadow-sm">
                   <p className="text-[10px] font-bold text-amber-500 uppercase mb-1.5">Tăng cường</p>
                   <p className="text-2xl font-black text-amber-700">{stats.enhancedTickets}</p>
                </div>
             </div>
          </div>
      </div>

      <div className="flex gap-4 items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
          <div className="relative flex-1 group">
             <Search size={18} className="absolute left-3.5 top-2.5 text-slate-400 group-focus-within:text-primary transition-colors"/>
             <input 
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary placeholder-slate-400 transition-all"
                placeholder="Tìm kiếm theo SĐT, Tên khách, Mã ghế hoặc nội dung ghi chú..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
             />
          </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
         <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase tracking-widest border-b border-slate-200">
               <tr>
                  <th className="px-6 py-4">Khách hàng</th>
                  <th className="px-6 py-4">Lịch trình chuyến</th>
                  <th className="px-6 py-4 text-center">Giao dịch</th>
                  <th className="px-6 py-4 text-right">Tổng thực thu</th>
                  <th className="px-6 py-4 text-right">Cập nhật</th>
                  <th className="px-6 py-4 text-center">Chi tiết</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
               {filteredGroups.length === 0 ? (
                   <tr><td colSpan={6} className="p-16 text-center text-slate-400 font-medium italic">Không có dữ liệu thanh toán phù hợp.</td></tr>
               ) : filteredGroups.map(group => (
                   <tr key={group.bookingId} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4">
                         <div className="flex flex-col">
                            <span className="font-black text-slate-900 group-hover:text-primary transition-colors">{group.passengerName}</span>
                            <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-1 font-bold">
                                <Phone size={10} className="text-slate-400"/> {group.passengerPhone}
                            </div>
                            {group.bookingId === 'orphaned' && (
                                <span className="text-[10px] text-red-500 font-bold italic mt-1 bg-red-50 px-1.5 rounded self-start">Đơn hàng đã xóa</span>
                            )}
                         </div>
                      </td>
                      <td className="px-6 py-4">
                         <div className="flex flex-col gap-1">
                             <div className="font-bold text-blue-700 flex items-center gap-1.5">
                                {group.tripInfo.route}
                                {(group.tripInfo.route || '').toLowerCase().includes('tăng cường') && (
                                    <Zap size={12} className="text-yellow-600 fill-yellow-600 animate-pulse" />
                                )}
                             </div>
                             <div className="text-[11px] text-slate-500 flex items-center gap-1.5 font-medium">
                                <Calendar size={11} className="text-slate-400" />
                                {group.tripInfo.date ? new Date(group.tripInfo.date).toLocaleDateString('vi-VN') : 'N/A'}
                             </div>
                             <div className="flex flex-wrap gap-1 mt-1.5">
                                 {group.tripInfo.seats.map((s, i) => (
                                     <Badge key={i} className="text-[10px] font-black px-1.5 h-5 bg-slate-100 text-slate-600 border-slate-200">
                                         {s}
                                     </Badge>
                                 ))}
                             </div>
                         </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                         <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px] px-2 font-black">
                             {group.payments.length} GD
                         </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                          <span className={`text-base font-black tracking-tight ${group.totalCollected >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                              {group.totalCollected.toLocaleString('vi-VN')} đ
                          </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                          <div className="text-[11px] font-bold text-slate-600">
                             {group.latestTransaction.toLocaleDateString('vi-VN')}
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium">
                             {group.latestTransaction.toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})}
                          </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                          <Button 
                             onClick={() => setSelectedGroup(group)}
                             className="bg-primary/5 text-primary hover:bg-primary hover:text-white border-primary/20 h-8 px-3 rounded-lg text-xs font-bold transition-all shadow-sm"
                          >
                              <Eye size={14} className="mr-1.5"/> Xem
                          </Button>
                      </td>
                   </tr>
               ))}
            </tbody>
         </table>
      </div>

      {/* DETAIL MODAL (TIMELINE) */}
      <Dialog 
        isOpen={!!selectedGroup} 
        onClose={() => { setSelectedGroup(null); setEditingPaymentId(null); }} 
        title="Lịch sử giao dịch chi tiết"
        className="max-w-2xl rounded-2xl"
      >
          {selectedGroup && (
             <div className="space-y-6 max-h-[75vh] overflow-y-auto px-4 py-2">
                 <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sticky top-0 z-20 shadow-sm">
                     <div className="flex items-center gap-4">
                         <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary border border-primary/20 shadow-sm">
                             <User size={24}/>
                         </div>
                         <div>
                             <h3 className="font-black text-slate-900 text-lg leading-tight">{selectedGroup.passengerName}</h3>
                             <div className="flex items-center gap-3 text-xs text-slate-500 mt-1.5 font-bold">
                                 <span className="flex items-center gap-1.5 bg-white px-2 py-0.5 rounded-lg border border-slate-200"><Phone size={12} className="text-primary"/> {selectedGroup.passengerPhone}</span>
                                 <span className="text-slate-300">|</span>
                                 <span className="bg-white px-2 py-0.5 rounded-lg border border-slate-200">#{selectedGroup.bookingId.slice(-6).toUpperCase()}</span>
                             </div>
                         </div>
                     </div>
                     <div className="text-right bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm self-stretch md:self-auto flex flex-col justify-center min-w-[140px]">
                         <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-0.5">Tổng thực thu</div>
                         <div className={`text-xl font-black ${selectedGroup.totalCollected >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                             {selectedGroup.totalCollected.toLocaleString('vi-VN')} đ
                         </div>
                     </div>
                 </div>

                 <div className="relative border-l-2 border-slate-200 ml-6 space-y-10 py-4">
                    {selectedGroup.payments.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 italic">Không có dữ liệu lịch sử giao dịch.</div>
                    ) : (
                        [...selectedGroup.payments].sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).map((p, idx, arr) => {
                            const isPositive = p.amount >= 0;
                            const isCash = p.method === 'cash';
                            const prevP = idx > 0 ? arr[idx-1] : null;
                            const currTrips = normalizeTrips(p.details);
                            const prevTrips = prevP ? normalizeTrips(prevP.details) : [];
                            const diffResult = calculateDiff(prevTrips, currTrips);

                            return (
                                <div key={p.id} className="relative pl-8 animate-in slide-in-from-left duration-300">
                                    <div className={`absolute -left-[11px] top-1 w-5 h-5 rounded-full border-4 border-white shadow-md flex items-center justify-center ${isPositive ? 'bg-emerald-500' : 'bg-red-500'} ${idx === arr.length - 1 ? 'ring-4 ring-primary/10' : ''}`}>
                                        <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                                    </div>

                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border shadow-sm ${isPositive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                                    {isPositive ? 'Thanh toán' : 'Hoàn tiền'}
                                                </span>
                                                <span className="text-[11px] text-slate-400 font-bold flex items-center gap-1">
                                                    <Clock size={11} />
                                                    {new Date(p.timestamp).toLocaleString('vi-VN')}
                                                </span>
                                            </div>
                                            <div className={`text-xl font-black ${isPositive ? 'text-emerald-600' : 'text-red-600'} tracking-tight`}>
                                                {isPositive ? '+' : ''}{p.amount.toLocaleString('vi-VN')} đ
                                            </div>
                                        </div>

                                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group/card relative overflow-hidden">
                                            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm ${isCash ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                                                        {isCash ? <DollarSign size={18} /> : <CreditCard size={18} />}
                                                    </div>
                                                    <div>
                                                        <div className="text-[10px] text-slate-400 font-black uppercase tracking-wider leading-none mb-1">Phương thức</div>
                                                        <div className="text-xs font-black text-slate-700">
                                                            {isCash ? 'Tiền mặt' : p.method === 'transfer' ? 'Chuyển khoản' : 'Hỗn hợp'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {diffResult.length > 0 ? (
                                                <div className="space-y-3 mb-4">
                                                    {diffResult.map((t: any, tripIdx: number) => {
                                                        const isEnhanced = t.isEnhanced === true || (t.route || '').toLowerCase().includes('tăng cường');
                                                        return (
                                                        <div key={tripIdx} className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 text-xs transition-colors hover:bg-slate-50">
                                                            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100/50">
                                                                <MapPin size={13} className="text-primary"/>
                                                                <span className="font-black text-slate-800 tracking-tight">{t.route || '---'}</span>
                                                                {isEnhanced && (
                                                                    <Badge className="ml-auto bg-amber-50 text-amber-700 border-amber-200 text-[9px] font-black uppercase px-1.5 h-4">
                                                                        <Zap size={9} className="mr-0.5 fill-amber-700" /> Tăng cường
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold mb-2 uppercase tracking-wide">
                                                                <div className="flex items-center gap-1.5">
                                                                    <Calendar size={12} className="text-slate-400"/> 
                                                                    <span>{t.tripDate ? new Date(t.tripDate).toLocaleDateString('vi-VN') : '---'}</span>
                                                                    {t.tripDate && (
                                                                        <span className="text-slate-400 font-medium">({formatLunarDate(new Date(t.tripDate)).replace(' Âm Lịch', '')})</span>
                                                                    )}
                                                                </div>
                                                                {t.licensePlate && (
                                                                    <span className="bg-white border px-1.5 rounded-lg text-slate-400 shadow-sm py-0.5 font-mono">{t.licensePlate}</span>
                                                                )}
                                                            </div>
                                                            <div className="flex flex-wrap gap-2">
                                                                {t.diffSeats && t.diffSeats.map((s: any, i: number) => {
                                                                    let badgeClass = "bg-white text-slate-600 border-slate-200";
                                                                    if (s.status === 'added') badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-300 ring-2 ring-emerald-500/10 font-black";
                                                                    if (s.status === 'removed') badgeClass = "bg-red-50 text-red-400 border-red-200 line-through decoration-red-300 opacity-60";
                                                                    return (
                                                                    <Badge key={i} variant="outline" className={`${badgeClass} px-2 py-0.5 text-[10px] flex items-center gap-1.5 rounded-lg shadow-xs`}>
                                                                        {s.id}
                                                                        {s.price > 0 && (
                                                                            <span className={`font-bold border-l pl-1.5 ml-0.5 ${s.status === 'removed' ? 'border-red-200 text-red-300' : 'border-slate-100 text-slate-400'}`}>
                                                                                {s.price.toLocaleString('vi-VN')}
                                                                            </span>
                                                                        )}
                                                                    </Badge>
                                                                )})}
                                                            </div>
                                                        </div>
                                                    )})}
                                                </div>
                                            ) : (
                                                <div className="text-center py-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 text-[11px] italic text-slate-400 mb-4">Snapshot giao dịch không có thông tin chi tiết.</div>
                                            )}

                                            <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100 text-xs text-slate-600 min-h-[40px] flex items-center relative group/note transition-all hover:bg-white hover:border-primary/20 hover:shadow-sm">
                                                {editingPaymentId === p.id ? (
                                                    <div className="flex gap-2 w-full animate-in fade-in zoom-in-95 duration-200">
                                                        <input 
                                                            className="flex-1 bg-white border border-primary/50 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-4 focus:ring-primary/10 text-xs font-medium"
                                                            value={editNote}
                                                            onChange={(e) => setEditNote(e.target.value)}
                                                            onKeyDown={(e) => e.key === 'Enter' && saveEditNote()}
                                                            autoFocus
                                                            placeholder="Nhập nội dung ghi chú..."
                                                        />
                                                        <button onClick={saveEditNote} className="bg-emerald-600 text-white p-2 rounded-xl hover:bg-emerald-700 shadow-md shadow-emerald-500/20 transition-all active:scale-90"><Check size={14}/></button>
                                                        <button onClick={() => setEditingPaymentId(null)} className="bg-slate-200 text-slate-600 p-2 rounded-xl hover:bg-slate-300 transition-all active:scale-90"><X size={14}/></button>
                                                    </div>
                                                ) : (
                                                    <div className="w-full flex justify-between items-start gap-4">
                                                        <span className={`flex-1 ${!p.note ? "italic text-slate-400 font-medium" : "font-semibold text-slate-700"}`}>
                                                            {p.note || "(Không có ghi chú cho giao dịch này)"}
                                                        </span>
                                                        <button 
                                                            onClick={() => startEditNote(p)} 
                                                            className="opacity-0 group-hover/note:opacity-100 p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-all duration-200 shadow-sm bg-white border border-primary/10"
                                                            title="Chỉnh sửa ghi chú"
                                                        >
                                                            <Edit2 size={12} />
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
