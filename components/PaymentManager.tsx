
import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { 
  DollarSign, Calendar, Search, Trash2, Edit2, 
  ArrowRight, CreditCard, Banknote, Filter,
  History, Eye, User, Phone, MapPin, Clock,
  Check, X, Zap
} from 'lucide-react';
import { useToast } from './ui/Toast';
import { Dialog } from './ui/Dialog';

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
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Detail Modal State
  const [selectedGroup, setSelectedGroup] = useState<PaymentGroup | null>(null);
  
  // Edit Note State (Inside Detail Modal)
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState('');

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const data = await api.payments.getAll();
      setPayments(data);
    } catch (e) {
      console.error(e);
      toast({ type: 'error', title: 'Lỗi', message: 'Không thể tải lịch sử thanh toán' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  // --- GROUPING LOGIC ---
  const groupedPayments = useMemo(() => {
    const groups: Record<string, PaymentGroup> = {};

    payments.forEach(payment => {
       const booking = payment.bookingId;
       // If booking is deleted (null), group by "orphaned"
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

       // Add payment to group
       groups[bKey].payments.push(payment);
       groups[bKey].totalCollected += payment.amount;
       
       const pDate = new Date(payment.timestamp);
       if (pDate > groups[bKey].latestTransaction) {
           groups[bKey].latestTransaction = pDate;
       }
    });

    // Convert to array and sort by latest transaction desc
    return Object.values(groups).sort((a, b) => b.latestTransaction.getTime() - a.latestTransaction.getTime());
  }, [payments]);

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
  const handleDeletePayment = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa bản ghi thanh toán này?')) return;
    try {
      await api.payments.delete(id);
      
      // Update local state
      const updatedPayments = payments.filter(p => p.id !== id);
      setPayments(updatedPayments);
      
      // Also update selected group if open
      if (selectedGroup) {
          const updatedGroupPayments = selectedGroup.payments.filter(p => p.id !== id);
          if (updatedGroupPayments.length === 0) {
              setSelectedGroup(null);
          } else {
              setSelectedGroup({
                  ...selectedGroup,
                  payments: updatedGroupPayments,
                  totalCollected: updatedGroupPayments.reduce((sum, p) => sum + p.amount, 0)
              });
          }
      }

      toast({ type: 'success', title: 'Đã xóa', message: 'Đã xóa bản ghi thanh toán' });
    } catch (e) {
      toast({ type: 'error', title: 'Lỗi', message: 'Không thể xóa' });
    }
  };

  const startEditNote = (payment: any) => {
      setEditingPaymentId(payment.id);
      setEditNote(payment.note || '');
  };

  const saveEditNote = async () => {
      if (!editingPaymentId) return;
      try {
          await api.payments.update(editingPaymentId, { note: editNote });
          
          // Update local state
          const updatedPayments = payments.map(p => p.id === editingPaymentId ? { ...p, note: editNote } : p);
          setPayments(updatedPayments);
          
          // Update selected group
          if (selectedGroup) {
              const updatedGroupPayments = selectedGroup.payments.map(p => p.id === editingPaymentId ? { ...p, note: editNote } : p);
              setSelectedGroup({
                  ...selectedGroup,
                  payments: updatedGroupPayments
              });
          }

          setEditingPaymentId(null);
          toast({ type: 'success', title: 'Đã cập nhật', message: 'Đã lưu ghi chú' });
      } catch (e) {
          toast({ type: 'error', title: 'Lỗi', message: 'Không thể cập nhật' });
      }
  };

  // Helper to check enhanced
  const isEnhancedRoute = (route: string) => {
      return (route || '').toLowerCase().includes('tăng cường');
  };

  // Calculate Summary Stats
  const totalRevenue = payments.filter(p => p.amount > 0).reduce((sum, p) => sum + p.amount, 0);
  const totalRefund = payments.filter(p => p.amount < 0).reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center border-b border-slate-200 pb-5">
        <div>
           <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Banknote size={28} className="text-green-600"/> Quản lý Tài chính
           </h2>
           <p className="text-slate-500 mt-1">Theo dõi dòng tiền và lịch sử thanh toán chi tiết.</p>
        </div>
        <Button onClick={fetchPayments} variant="outline" size="sm">Làm mới</Button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
             <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center">
                <ArrowRight size={24} className="-rotate-45"/>
             </div>
             <div>
                <p className="text-xs font-bold text-slate-400 uppercase">Tổng thu</p>
                <p className="text-xl font-bold text-green-700">
                    {totalRevenue.toLocaleString('vi-VN')} đ
                </p>
             </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
             <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
                <ArrowRight size={24} className="rotate-135"/>
             </div>
             <div>
                <p className="text-xs font-bold text-slate-400 uppercase">Tổng hoàn tiền</p>
                <p className="text-xl font-bold text-red-700">
                    {Math.abs(totalRefund).toLocaleString('vi-VN')} đ
                </p>
             </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
             <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                <Banknote size={24}/>
             </div>
             <div>
                <p className="text-xs font-bold text-slate-400 uppercase">Giao dịch</p>
                <p className="text-xl font-bold text-slate-800">
                    {payments.length}
                </p>
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
               {loading ? (
                   <tr><td colSpan={6} className="p-8 text-center text-slate-400">Đang tải...</td></tr>
               ) : filteredGroups.length === 0 ? (
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
                                {isEnhancedRoute(group.tripInfo.route) && (
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

      {/* DETAIL MODAL (REFACTORED TO TIMELINE) */}
      <Dialog 
        isOpen={!!selectedGroup} 
        onClose={() => { setSelectedGroup(null); setEditingPaymentId(null); }} 
        title="Lịch sử giao dịch chi tiết"
        className="max-w-2xl"
      >
          {selectedGroup && (
             <div className="space-y-6 max-h-[70vh] overflow-y-auto px-1">
                 {/* Header Info Card */}
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

                 {/* Timeline Container */}
                 <div className="relative border-l-2 border-slate-200 ml-4 space-y-8 py-2">
                    {selectedGroup.payments.length === 0 ? (
                        <div className="text-center py-8 text-slate-400">Không có giao dịch nào.</div>
                    ) : (
                        // Sort by timestamp ASC (Older top) to show flow
                        [...selectedGroup.payments].sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).map((p, idx) => {
                            const isPositive = p.amount >= 0;
                            const isCash = p.method === 'cash';
                            const details = p.details || {};
                            
                            return (
                                <div key={p.id} className="relative pl-6">
                                    {/* Timeline Dot */}
                                    <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white shadow-sm flex items-center justify-center ${isPositive ? 'bg-green-100 border-green-300' : 'bg-red-100 border-red-300'}`}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${isPositive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        {/* Date Header */}
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded border ${isPositive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                                {isPositive ? 'Thanh toán' : 'Hoàn tiền'}
                                            </span>
                                            <span className="text-xs text-slate-400 flex items-center gap-1">
                                                <Clock size={10} />
                                                {new Date(p.timestamp).toLocaleString('vi-VN')}
                                            </span>
                                        </div>

                                        {/* Card Content */}
                                        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group relative">
                                            {/* Top Row: Method & Amount */}
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

                                            {/* Snapshot Details (Multi Trip Support) */}
                                            {details.trips && details.trips.length > 0 ? (
                                                <div className="space-y-2 mb-2">
                                                    {details.trips.map((t: any, idx: number) => {
                                                        const enhanced = isEnhancedRoute(t.route);
                                                        return (
                                                        <div key={idx} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs">
                                                            <div className="flex items-center gap-2 mb-1.5 pb-1.5 border-b border-slate-100">
                                                                <MapPin size={12} className="text-blue-500"/>
                                                                <span className="font-bold text-slate-700">{t.route || '---'}</span>
                                                                {enhanced && (
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
                                                                </div>
                                                                {t.licensePlate && (
                                                                    <span className="bg-white border px-1.5 rounded text-[10px] shadow-sm">{t.licensePlate}</span>
                                                                )}
                                                            </div>
                                                            {t.seats && t.seats.length > 0 && (
                                                                <div className="flex flex-wrap gap-1 mt-1">
                                                                    {t.seats.map((s: string, i: number) => (
                                                                        <Badge key={i} variant="outline" className="bg-white text-blue-700 border-blue-200 px-1.5 py-0 text-[10px] flex items-center gap-1">
                                                                            {s}
                                                                            {details.pricePerTicket > 0 && (
                                                                                <span className="text-slate-400 font-normal border-l border-blue-100 pl-1 ml-0.5">
                                                                                    {details.pricePerTicket.toLocaleString('vi-VN')}
                                                                                </span>
                                                                            )}
                                                                        </Badge>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )})}
                                                </div>
                                            ) : (details.route || details.seats?.length > 0) && (
                                                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs mb-2">
                                                    <div className="flex items-center gap-2 mb-1.5 pb-1.5 border-b border-slate-100">
                                                        <MapPin size={12} className="text-blue-500"/>
                                                        <span className="font-bold text-slate-700">{details.route || '---'}</span>
                                                        {isEnhancedRoute(details.route) && (
                                                            <span className="shrink-0 inline-flex items-center text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200 whitespace-nowrap ml-auto">
                                                                <Zap size={9} className="mr-0.5 fill-amber-700" />
                                                                Tăng cường
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex justify-between items-center text-slate-500 mb-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <Calendar size={12}/> 
                                                            <span>{details.tripDate ? new Date(details.tripDate).toLocaleDateString('vi-VN') : '---'}</span>
                                                        </div>
                                                        {details.licensePlate && (
                                                            <span className="bg-white border px-1.5 rounded text-[10px] shadow-sm">{details.licensePlate}</span>
                                                        )}
                                                    </div>
                                                    {details.seats && details.seats.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {details.seats.map((s: string, i: number) => (
                                                                <Badge key={i} variant="outline" className="bg-white text-blue-700 border-blue-200 px-1.5 py-0 text-[10px] flex items-center gap-1">
                                                                    {s}
                                                                    {details.pricePerTicket > 0 && (
                                                                        <span className="text-slate-400 font-normal border-l border-blue-100 pl-1 ml-0.5">
                                                                            {details.pricePerTicket.toLocaleString('vi-VN')}
                                                                        </span>
                                                                    )}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Note Section (Editable) */}
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

                                            {/* Delete Action (Top Right overlay) */}
                                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => handleDeletePayment(p.id)}
                                                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                    title="Xóa giao dịch"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
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