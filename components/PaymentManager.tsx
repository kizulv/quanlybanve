
import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { 
  DollarSign, Calendar, Search, Trash2, Edit2, 
  ArrowRight, CreditCard, Banknote, Filter,
  History, Eye, User, Phone, MapPin
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
                             <div className="font-semibold text-blue-700">{group.tripInfo.route}</div>
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

      {/* DETAIL MODAL */}
      <Dialog 
        isOpen={!!selectedGroup} 
        onClose={() => { setSelectedGroup(null); setEditingPaymentId(null); }} 
        title="Lịch sử giao dịch chi tiết"
        className="max-w-4xl"
      >
          {selectedGroup && (
             <div className="space-y-6">
                 {/* Header Info */}
                 <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row justify-between gap-4">
                     <div className="flex items-start gap-3">
                         <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                             <User size={20}/>
                         </div>
                         <div>
                             <h3 className="font-bold text-slate-800">{selectedGroup.passengerName}</h3>
                             <div className="flex items-center gap-3 text-sm text-slate-600 mt-1">
                                 <span className="flex items-center gap-1"><Phone size={12}/> {selectedGroup.passengerPhone}</span>
                                 <span className="text-slate-300">|</span>
                                 <span className="flex items-center gap-1"><MapPin size={12}/> {selectedGroup.tripInfo.route}</span>
                             </div>
                         </div>
                     </div>
                     <div className="text-right">
                         <div className="text-xs text-slate-500 uppercase font-bold">Tổng thực thu</div>
                         <div className={`text-2xl font-bold ${selectedGroup.totalCollected >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                             {selectedGroup.totalCollected.toLocaleString('vi-VN')} đ
                         </div>
                     </div>
                 </div>

                 {/* Transactions Table */}
                 <div className="border border-slate-200 rounded-lg overflow-hidden">
                     <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                            <tr>
                                <th className="px-4 py-3 text-left w-12">#</th>
                                <th className="px-4 py-3 text-left">Thời gian</th>
                                <th className="px-4 py-3 text-left">Loại giao dịch</th>
                                <th className="px-4 py-3 text-left">Hình thức</th>
                                <th className="px-4 py-3 text-left">Ghi chú</th>
                                <th className="px-4 py-3 text-right">Số tiền</th>
                                <th className="px-4 py-3 text-center">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {/* Sort by timestamp ASC for history flow */}
                            {[...selectedGroup.payments].sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).map((p, idx) => (
                                <tr key={p.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 text-slate-400 text-xs">{idx + 1}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col text-xs">
                                            <span className="font-medium text-slate-700">
                                                {new Date(p.timestamp).toLocaleDateString('vi-VN')}
                                            </span>
                                            <span className="text-slate-500">
                                                {new Date(p.timestamp).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <Badge variant="outline" className={p.amount >= 0 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}>
                                            {p.amount >= 0 ? 'Thanh toán' : 'Hoàn tiền'}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1.5 text-slate-600">
                                            {p.method === 'cash' ? <DollarSign size={14}/> : <CreditCard size={14}/>}
                                            <span>
                                                {p.method === 'cash' ? 'Tiền mặt' : p.method === 'transfer' ? 'Chuyển khoản' : 'Hỗn hợp'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 max-w-[200px]">
                                        {editingPaymentId === p.id ? (
                                            <div className="flex gap-1">
                                                <input 
                                                    className="w-full text-xs border border-blue-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                    value={editNote}
                                                    onChange={(e) => setEditNote(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && saveEditNote()}
                                                    autoFocus
                                                />
                                                <Button size="icon" className="h-6 w-6 bg-green-600 hover:bg-green-500" onClick={saveEditNote}>
                                                    <ArrowRight size={12} className="text-white"/>
                                                </Button>
                                            </div>
                                        ) : (
                                            <span className="text-slate-600 italic truncate block cursor-pointer hover:text-blue-600" onClick={() => startEditNote(p)} title="Click để sửa">
                                                {p.note || '--'}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <span className={`font-bold ${p.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {p.amount > 0 ? '+' : ''}{p.amount.toLocaleString('vi-VN')}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex justify-center gap-1">
                                            <button onClick={() => startEditNote(p)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                                                <Edit2 size={14}/>
                                            </button>
                                            <button onClick={() => handleDeletePayment(p.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded">
                                                <Trash2 size={14}/>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                     </table>
                     {selectedGroup.payments.length === 0 && (
                         <div className="p-8 text-center text-slate-400">Không có giao dịch nào.</div>
                     )}
                 </div>
             </div>
          )}
      </Dialog>
    </div>
  );
};
