
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
      // 1. Financial Totals directly from Payments (Cash flow)
      let cashTotal = 0;
      let transferTotal = 0;
      payments.forEach(p => {
          cashTotal += (p.cashAmount || 0);
          transferTotal += (p.transferAmount || 0);
      });

      // 2. Ticket Totals from Bookings (Current State - NO DOUBLE COUNTING)
      let cabinTickets = 0;
      let sleeperTickets = 0;
      let enhancedTickets = 0;
      let totalTickets = 0;

      // Iterate through current active bookings that have at least partial payment
      bookings.forEach(booking => {
          const paid = (booking.payment?.paidCash || 0) + (booking.payment?.paidTransfer || 0);
          
          if (booking.status !== 'cancelled' && paid > 0) {
              booking.items.forEach(item => {
                  const count = (item.seatIds || []).length;
                  
                  // Use priority: ENHANCED > BUS TYPE
                  // logic checks snapshot first, then fallback to string matching
                  const isEnhanced = item.isEnhanced === true || item.route?.toLowerCase().includes('tăng cường');

                  if (isEnhanced) {
                      enhancedTickets += count;
                  } else {
                      // Accurate classification for non-enhanced trips
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
                  if (price === 0 && currT.pricePerTicket) price = currT.pricePerTicket;
              }
              if (status === 'removed' && prevT) {
                   if (prevT.tickets) { const t = prevT.tickets.find((tic: any) => tic.seatId === s); if (t) price = t.price; }
                   if (price === 0 && prevT.pricePerTicket) price = prevT.pricePerTicket;
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
           <p className="text-slate-500 mt-1">Tổng hợp doanh thu và số lượng vé đã thanh toán.</p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">Làm mới</Button>
      </div>

      {/* STATS SUMMARY */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Revenue Box */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
             <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                   <div className="w-10 h-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center">
                      <DollarSign size={20}/>
                   </div>
                   <h3 className="font-bold text-slate-700">Tổng tiền đã thanh toán</h3>
                </div>
                <div className="text-right">
                   <p className="text-2xl font-black text-green-700">{stats.grandTotal.toLocaleString('vi-VN')} đ</p>
                </div>
             </div>
             
             <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                   <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                      <DollarSign size={10}/> Tiền mặt
                   </p>
                   <p className="text-base font-bold text-slate-700">{stats.cashTotal.toLocaleString('vi-VN')} đ</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                   <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                      <CreditCard size={10}/> Chuyển khoản
                   </p>
                   <p className="text-base font-bold text-slate-700">{stats.transferTotal.toLocaleString('vi-VN')} đ</p>
                </div>
             </div>
          </div>

          {/* Tickets Box */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
             <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                   <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Ticket size={20}/>
                   </div>
                   <h3 className="font-bold text-slate-700">Vé hiện tại đã thanh toán</h3>
                </div>
                <div className="text-right">
                   <p className="text-2xl font-black text-blue-700">{stats.totalTickets} vé</p>
                </div>
             </div>

             <div className="grid grid-cols-3 gap-2 mt-2">
                <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 flex flex-col items-center">
                   <p className="text-[10px] font-bold text-indigo-400 uppercase mb-1">Xe Phòng</p>
                   <p className="text-xl font-bold text-indigo-700">{stats.cabinTickets}</p>
                </div>
                <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 flex flex-col items-center">
                   <p className="text-[10px] font-bold text-blue-400 uppercase mb-1">Xe Thường</p>
                   <p className="text-xl font-bold text-blue-700">{stats.sleeperTickets}</p>
                </div>
                <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-100 flex flex-col items-center">
                   <p className="text-[10px] font-bold text-amber-500 uppercase mb-1">Tăng cường</p>
                   <p className="text-xl font-bold text-amber-700">{stats.enhancedTickets}</p>
                </div>
             </div>
          </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
          <div className="relative flex-1">
             <Search size={16} className="absolute left-3 top-2.5 text-slate-400"/>
             <input 
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-md text-sm outline-none focus:border-blue-500"
                placeholder="Tìm kiếm theo SĐT, Tên khách, Mã ghế..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
             />
          </div>
      </div>

      {/* Grouped Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
         <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
               <tr>
                  <th className="px-6 py-4">Khách hàng</th>
                  <th className="px-6 py-4">Chi tiết chuyến (Snapshot)</th>
                  <th className="px-6 py-4 text-center">Số giao dịch</th>
                  <th className="px-6 py-4 text-right">Tổng thực thu</th>
                  <th className="px-6 py-4 text-right">Gần nhất</th>
                  <th className="px-6 py-4 text-center">Thao tác</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
               {filteredGroups.length === 0 ? (
                   <tr><td colSpan={6} className="p-8 text-center text-slate-400">Không có dữ liệu phù hợp.</td></tr>
               ) : filteredGroups.map(group => (
                   <tr key={group.bookingId} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                         <div className="flex flex-col">
                            <span className="font-bold text-slate-800">{group.passengerName}</span>
                            <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                                <Phone size={10}/> {group.passengerPhone}
                            </div>
                            {group.bookingId === 'orphaned' && (
                                <span className="text-[10px] text-red-400 italic">Booking đã xóa</span>
                            )}
                         </div>
                      </td>
                      <td className="px-6 py-4">
                         <div className="flex flex-col gap-1 text-xs">
                             <div className="font-semibold text-blue-700 flex items-center gap-1">
                                {group.tripInfo.route}
                                {(group.tripInfo.route || '').toLowerCase().includes('tăng cường') && (
                                    <Zap size={10} className="text-yellow-600 fill-yellow-600" />
                                )}
                             </div>
                             {group.tripInfo.date && (
                                <div className="text-slate-500">
                                    {new Date(group.tripInfo.date).toLocaleDateString('vi-VN')}
                                </div>
                             )}
                             <div className="flex flex-wrap gap-1 mt-1">
                                 {group.tripInfo.seats.map((s, i) => (
                                     <Badge key={i} variant="outline" className="text-[10px] px-1 h-5 bg-white">
                                         {s}
                                     </Badge>
                                 ))}
                             </div>
                         </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                         <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-200">
                             {group.payments.length} GD
                         </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                          <span className={`font-bold text-base ${group.totalCollected >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                              {group.totalCollected.toLocaleString('vi-VN')} đ
                          </span>
                      </td>
                      <td className="px-6 py-4 text-right text-xs text-slate-500">
                          {group.latestTransaction.toLocaleDateString('vi-VN')} <br/>
                          {group.latestTransaction.toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})}
                      </td>
                      <td className="px-6 py-4 text-center">
                          <Button 
                             onClick={() => setSelectedGroup(group)}
                             className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border-indigo-200 h-8 text-xs"
                          >
                              <Eye size={14} className="mr-1.5"/> Chi tiết
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
        className="max-w-2xl"
      >
          {selectedGroup && (
             <div className="space-y-6 max-h-[70vh] overflow-y-auto px-1">
                 <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between gap-4 sticky top-0 z-10">
                     <div className="flex items-start gap-3">
                         <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 border border-indigo-200">
                             <User size={20}/>
                         </div>
                         <div>
                             <h3 className="font-bold text-slate-800">{selectedGroup.passengerName}</h3>
                             <div className="flex items-center gap-3 text-xs text-slate-600 mt-1">
                                 <span className="flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-200 font-mono"><Phone size={10}/> {selectedGroup.passengerPhone}</span>
                             </div>
                         </div>
                     </div>
                     <div className="text-right">
                         <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Tổng thực thu</div>
                         <div className={`text-2xl font-bold ${selectedGroup.totalCollected >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                             {selectedGroup.totalCollected.toLocaleString('vi-VN')} đ
                         </div>
                     </div>
                 </div>

                 <div className="relative border-l-2 border-slate-200 ml-4 space-y-8 py-2">
                    {selectedGroup.payments.length === 0 ? (
                        <div className="text-center py-8 text-slate-400">Không có giao dịch nào.</div>
                    ) : (
                        [...selectedGroup.payments].sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).map((p, idx, arr) => {
                            const isPositive = p.amount >= 0;
                            const isCash = p.method === 'cash';
                            const prevP = idx > 0 ? arr[idx-1] : null;
                            const currTrips = normalizeTrips(p.details);
                            const prevTrips = prevP ? normalizeTrips(prevP.details) : [];
                            const diffResult = calculateDiff(prevTrips, currTrips);

                            return (
                                <div key={p.id} className="relative pl-6">
                                    <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white shadow-sm flex items-center justify-center ${isPositive ? 'bg-green-100 border-green-300' : 'bg-red-100 border-red-300'}`}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${isPositive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded border ${isPositive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                                {isPositive ? 'Thanh toán' : 'Hoàn tiền'}
                                            </span>
                                            <span className="text-xs text-slate-400 flex items-center gap-1">
                                                <Clock size={10} />
                                                {new Date(p.timestamp).toLocaleString('vi-VN')}
                                            </span>
                                        </div>

                                        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group relative">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-2">
                                                    <div className={`p-1.5 rounded-lg ${isCash ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                                                        {isCash ? <DollarSign size={16} /> : <CreditCard size={16} />}
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-bold text-slate-700">
                                                            {isCash ? 'Tiền mặt' : p.method === 'transfer' ? 'Chuyển khoản' : 'Hỗn hợp'}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400">Hình thức</div>
                                                    </div>
                                                </div>
                                                <div className={`text-lg font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                                    {isPositive ? '+' : ''}{p.amount.toLocaleString('vi-VN')} đ
                                                </div>
                                            </div>

                                            {diffResult.length > 0 ? (
                                                <div className="space-y-2 mb-2">
                                                    {diffResult.map((t: any, tripIdx: number) => {
                                                        const isEnhanced = t.isEnhanced === true || (t.route || '').toLowerCase().includes('tăng cường');
                                                        return (
                                                        <div key={tripIdx} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs">
                                                            <div className="flex items-center gap-2 mb-1.5 pb-1.5 border-b border-slate-100">
                                                                <MapPin size={12} className="text-blue-500"/>
                                                                <span className="font-bold text-slate-700">{t.route || '---'}</span>
                                                                {isEnhanced && (
                                                                    <span className="shrink-0 inline-flex items-center text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200 whitespace-nowrap ml-auto">
                                                                        <Zap size={9} className="mr-0.5 fill-amber-700" />
                                                                        Tăng cường
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex justify-between items-center text-slate-500 mb-1">
                                                                <div className="flex items-center gap-1.5">
                                                                    <Calendar size={12}/> 
                                                                    <span>{t.tripDate ? new Date(t.tripDate).toLocaleDateString('vi-VN') : '---'}</span>
                                                                    {t.tripDate && (
                                                                        <span className="text-[10px] text-slate-400">
                                                                            ({formatLunarDate(new Date(t.tripDate))})
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {t.licensePlate && (
                                                                    <span className="bg-white border px-1.5 rounded text-[10px] shadow-sm">{t.licensePlate}</span>
                                                                )}
                                                            </div>
                                                            <div className="flex flex-wrap gap-1 mt-1">
                                                                {t.diffSeats && t.diffSeats.map((s: any, i: number) => {
                                                                    let badgeClass = "bg-white text-blue-700 border-blue-200";
                                                                    if (s.status === 'added') badgeClass = "bg-green-50 text-green-700 border-green-200 ring-1 ring-green-400 font-bold";
                                                                    if (s.status === 'removed') badgeClass = "bg-red-50 text-red-400 border-red-200 line-through decoration-red-400 opacity-80";
                                                                    return (
                                                                    <Badge key={i} variant="outline" className={`${badgeClass} px-1.5 py-0 text-[10px] flex items-center gap-1`}>
                                                                        {s.id}
                                                                        {s.price > 0 && (
                                                                            <span className={`font-normal border-l pl-1 ml-0.5 ${s.status === 'removed' ? 'border-red-200 text-red-300' : 'border-blue-100 text-slate-400'}`}>
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
                                                <div className="text-center text-xs italic text-slate-400 mb-2">Dữ liệu cũ không đủ thông tin chi tiết.</div>
                                            )}

                                            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-xs text-slate-600 min-h-[30px] flex items-center relative group/note">
                                                {editingPaymentId === p.id ? (
                                                    <div className="flex gap-1 w-full">
                                                        <input 
                                                            className="flex-1 bg-white border border-blue-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                                                            value={editNote}
                                                            onChange={(e) => setEditNote(e.target.value)}
                                                            onKeyDown={(e) => e.key === 'Enter' && saveEditNote()}
                                                            autoFocus
                                                            placeholder="Nhập ghi chú..."
                                                        />
                                                        <button onClick={saveEditNote} className="bg-green-600 text-white p-1 rounded hover:bg-green-700"><Check size={12}/></button>
                                                        <button onClick={() => setEditingPaymentId(null)} className="bg-slate-200 text-slate-600 p-1 rounded hover:bg-slate-300"><X size={12}/></button>
                                                    </div>
                                                ) : (
                                                    <div className="w-full flex justify-between items-start">
                                                        <span className={!p.note ? "italic text-slate-400" : ""}>
                                                            {p.note || "(Không có ghi chú)"}
                                                        </span>
                                                        <button 
                                                            onClick={() => startEditNote(p)} 
                                                            className="opacity-0 group-hover/note:opacity-100 text-blue-500 hover:text-blue-700 transition-opacity p-0.5"
                                                            title="Sửa ghi chú"
                                                        >
                                                            <Edit2 size={10} />
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
