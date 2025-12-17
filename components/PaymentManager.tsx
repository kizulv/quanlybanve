
import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { 
  DollarSign, Calendar, Search, Trash2, Edit2, 
  ArrowRight, CreditCard, Banknote, Filter 
} from 'lucide-react';
import { useToast } from './ui/Toast';
import { Dialog } from './ui/Dialog';

export const PaymentManager: React.FC = () => {
  const { toast } = useToast();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, payment, refund

  // Edit State
  const [editingPayment, setEditingPayment] = useState<any | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
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

  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      if (filterType !== 'all' && p.type !== filterType) return false;
      
      const search = searchTerm.toLowerCase();
      const noteMatch = (p.note || '').toLowerCase().includes(search);
      const bookingPhone = p.bookingId?.passenger?.phone || '';
      const seatMatch = p.details?.seats?.some((s: string) => s.toLowerCase().includes(search));
      
      return noteMatch || bookingPhone.includes(search) || seatMatch;
    });
  }, [payments, searchTerm, filterType]);

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa bản ghi thanh toán này? Hành động này không ảnh hưởng đến trạng thái vé.')) return;
    try {
      await api.payments.delete(id);
      setPayments(prev => prev.filter(p => p.id !== id));
      toast({ type: 'success', title: 'Đã xóa', message: 'Đã xóa bản ghi thanh toán' });
    } catch (e) {
      toast({ type: 'error', title: 'Lỗi', message: 'Không thể xóa' });
    }
  };

  const handleEdit = (payment: any) => {
      setEditingPayment(payment);
      setEditNote(payment.note || '');
      setIsEditModalOpen(true);
  };

  const saveEdit = async () => {
      if (!editingPayment) return;
      try {
          await api.payments.update(editingPayment.id, { note: editNote });
          setPayments(prev => prev.map(p => p.id === editingPayment.id ? { ...p, note: editNote } : p));
          setIsEditModalOpen(false);
          toast({ type: 'success', title: 'Đã cập nhật', message: 'Đã lưu ghi chú' });
      } catch (e) {
          toast({ type: 'error', title: 'Lỗi', message: 'Không thể cập nhật' });
      }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center border-b border-slate-200 pb-5">
        <div>
           <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <BadgeDollarSign size={28} className="text-green-600"/> Quản lý Tài chính
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
                    {filteredPayments.filter(p => p.amount > 0).reduce((sum, p) => sum + p.amount, 0).toLocaleString('vi-VN')} đ
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
                    {Math.abs(filteredPayments.filter(p => p.amount < 0).reduce((sum, p) => sum + p.amount, 0)).toLocaleString('vi-VN')} đ
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
                    {filteredPayments.length}
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
                placeholder="Tìm kiếm ghi chú, SĐT, ghế..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
             />
          </div>
          <select 
             className="px-3 py-2 border border-slate-200 rounded-md text-sm bg-slate-50 outline-none"
             value={filterType}
             onChange={e => setFilterType(e.target.value)}
          >
             <option value="all">Tất cả loại</option>
             <option value="payment">Thanh toán</option>
             <option value="refund">Hoàn tiền</option>
          </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
         <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
               <tr>
                  <th className="px-6 py-4 w-[140px]">Thời gian</th>
                  <th className="px-6 py-4">Chi tiết giao dịch</th>
                  <th className="px-6 py-4">Thông tin vé (Snapshot)</th>
                  <th className="px-6 py-4 text-right">Số tiền</th>
                  <th className="px-6 py-4 text-right">Thao tác</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
               {loading ? (
                   <tr><td colSpan={5} className="p-8 text-center text-slate-400">Đang tải...</td></tr>
               ) : filteredPayments.length === 0 ? (
                   <tr><td colSpan={5} className="p-8 text-center text-slate-400">Không có dữ liệu.</td></tr>
               ) : filteredPayments.map(payment => (
                   <tr key={payment.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-slate-500">
                         <div className="flex flex-col">
                            <span className="font-medium text-slate-700">
                                {new Date(payment.timestamp).toLocaleDateString('vi-VN')}
                            </span>
                            <span className="text-xs">
                                {new Date(payment.timestamp).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})}
                            </span>
                         </div>
                      </td>
                      <td className="px-6 py-4">
                         <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className={`
                                    ${payment.type === 'payment' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}
                                `}>
                                    {payment.type === 'payment' ? 'Thu tiền' : 'Hoàn tiền'}
                                </Badge>
                                <Badge variant="secondary" className="text-xs font-normal">
                                    {payment.method === 'transfer' ? 'Chuyển khoản' : payment.method === 'cash' ? 'Tiền mặt' : 'Hỗn hợp'}
                                </Badge>
                            </div>
                            {payment.note && <p className="text-xs text-slate-500 italic mt-1">"{payment.note}"</p>}
                            {payment.bookingId?.passenger?.phone && (
                                <div className="text-xs font-medium text-slate-600 mt-1 flex items-center gap-1">
                                   <Search size={10}/> KH: {payment.bookingId.passenger.phone}
                                </div>
                            )}
                         </div>
                      </td>
                      <td className="px-6 py-4">
                         {payment.details ? (
                             <div className="text-xs space-y-1 text-slate-600">
                                 <div className="font-bold text-slate-700">{payment.details.route}</div>
                                 <div>Ngày đi: {new Date(payment.details.tripDate).toLocaleDateString('vi-VN')}</div>
                                 <div className="flex flex-wrap gap-1 mt-1">
                                     {payment.details.seats?.map((s: string) => (
                                         <span key={s} className="bg-slate-100 border border-slate-200 px-1 rounded text-[10px] font-bold">
                                             {s}
                                         </span>
                                     ))}
                                 </div>
                                 {payment.details.pricePerTicket && (
                                     <div className="text-[10px] text-slate-400">
                                         Đơn giá: {payment.details.pricePerTicket.toLocaleString('vi-VN')} đ
                                     </div>
                                 )}
                             </div>
                         ) : (
                             <span className="text-slate-400 text-xs italic">Không có dữ liệu chi tiết</span>
                         )}
                      </td>
                      <td className="px-6 py-4 text-right">
                          <span className={`font-bold text-lg ${payment.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {payment.amount > 0 ? '+' : ''}{payment.amount.toLocaleString('vi-VN')}
                          </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600" onClick={() => handleEdit(payment)}>
                                  <Edit2 size={14}/>
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => handleDelete(payment.id)}>
                                  <Trash2 size={14}/>
                              </Button>
                          </div>
                      </td>
                   </tr>
               ))}
            </tbody>
         </table>
      </div>

      <Dialog isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Sửa ghi chú thanh toán">
          <div className="space-y-4 p-1">
              <label className="block text-sm font-medium text-slate-700">Ghi chú</label>
              <textarea 
                  className="w-full border border-slate-300 rounded-md p-2 text-sm h-24 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={editNote}
                  onChange={e => setEditNote(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Hủy</Button>
                  <Button onClick={saveEdit}>Lưu thay đổi</Button>
              </div>
          </div>
      </Dialog>
    </div>
  );
};

// Add required Icon
import { BadgeDollarSign } from 'lucide-react';
