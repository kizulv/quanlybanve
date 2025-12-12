import React, { useState } from 'react';
import { Seat, Passenger } from '../types';
import { Button } from './ui/Button';
import { X } from 'lucide-react';

interface BookingFormProps {
  selectedSeats: Seat[];
  onCancel: () => void;
  onSubmit: (passenger: Passenger) => void;
}

export const BookingForm: React.FC<BookingFormProps> = ({ selectedSeats, onCancel, onSubmit }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');

  const totalPrice = selectedSeats.reduce((sum, seat) => sum + seat.price, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) {
      alert("Vui lòng nhập tên và số điện thoại");
      return;
    }
    onSubmit({ name, phone, email, note });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold">Xác nhận đặt vé</h2>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X size={20} />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="bg-slate-50 p-3 rounded-md border text-sm">
            <p className="font-medium text-slate-700">Ghế đã chọn:</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {selectedSeats.map(s => (
                <span key={s.id} className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-bold border border-primary/20">
                  {s.label} ({s.price.toLocaleString('vi-VN')}đ)
                </span>
              ))}
            </div>
            <div className="mt-3 pt-2 border-t flex justify-between font-bold text-slate-900">
              <span>Tổng cộng:</span>
              <span className="text-primary">{totalPrice.toLocaleString('vi-VN')} đ</span>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Họ và tên *</label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm bg-white text-slate-900"
                placeholder="Nguyễn Văn A"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Số điện thoại *</label>
              <input
                type="tel"
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm bg-white text-slate-900"
                placeholder="0912 345 678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email (Tùy chọn)</label>
              <input
                type="email"
                className="w-full px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm bg-white text-slate-900"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            
             <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ghi chú</label>
              <textarea
                className="w-full px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm h-20 resize-none bg-white text-slate-900"
                placeholder="Đón tại ngã tư..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>

          <div className="pt-2 flex gap-3">
            <Button type="button" variant="outline" className="w-full" onClick={onCancel}>
              Hủy
            </Button>
            <Button type="submit" className="w-full">
              Thanh toán & Xuất vé
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};