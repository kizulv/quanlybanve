
import React, { useState, useEffect } from "react";
import { Dialog } from "./ui/Dialog";
import { api } from "../lib/api";
import { Booking, BookingHistory } from "../types";
import { 
  History, 
  Loader2, 
  Plus, 
  Trash2, 
  Edit, 
  ArrowRightLeft, 
  UserCog, 
  FileClock, 
  Calendar,
  AlertCircle
} from "lucide-react";
import { Badge } from "./ui/Badge";

interface BookingHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
}

export const BookingHistoryModal: React.FC<BookingHistoryModalProps> = ({
  isOpen,
  onClose,
  booking,
}) => {
  const [history, setHistory] = useState<BookingHistory[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      if (booking) {
        setLoading(true);
        try {
          const data = await api.bookings.getHistory(booking.id);
          setHistory(data);
        } catch (error) {
          console.error("Failed to load history", error);
        } finally {
          setLoading(false);
        }
      }
    };

    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen, booking]);

  const getIcon = (action: string) => {
    switch (action) {
      case 'CREATE': return <Plus className="text-green-600" size={16} />;
      case 'DELETE': return <Trash2 className="text-red-600" size={16} />;
      case 'UPDATE': return <Edit className="text-blue-600" size={16} />;
      case 'SWAP': return <ArrowRightLeft className="text-purple-600" size={16} />;
      case 'PASSENGER_UPDATE': return <UserCog className="text-orange-600" size={16} />;
      default: return <FileClock className="text-slate-500" size={16} />;
    }
  };

  const getColor = (action: string) => {
    switch (action) {
      case 'CREATE': return 'bg-green-100 border-green-200 text-green-700';
      case 'DELETE': return 'bg-red-100 border-red-200 text-red-700';
      case 'UPDATE': return 'bg-blue-100 border-blue-200 text-blue-700';
      case 'SWAP': return 'bg-purple-100 border-purple-200 text-purple-700';
      case 'PASSENGER_UPDATE': return 'bg-orange-100 border-orange-200 text-orange-700';
      default: return 'bg-slate-100 border-slate-200 text-slate-700';
    }
  };

  const getTitle = (action: string) => {
    switch (action) {
      case 'CREATE': return 'Tạo mới đơn hàng';
      case 'DELETE': return 'Hủy/Xóa đơn hàng';
      case 'UPDATE': return 'Cập nhật vé/ghế';
      case 'SWAP': return 'Đổi vị trí ghế';
      case 'PASSENGER_UPDATE': return 'Cập nhật thông tin khách';
      default: return 'Hoạt động hệ thống';
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Lịch sử hoạt động đơn hàng"
      className="max-w-2xl"
    >
      <div className="space-y-6 max-h-[60vh] overflow-y-auto px-1">
        {booking && (
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center justify-between">
                <div className="text-sm">
                    <span className="text-slate-500">Mã đơn: </span>
                    <span className="font-bold font-mono text-slate-800">{booking.id.slice(-6).toUpperCase()}</span>
                </div>
                <div className="text-sm">
                    <span className="text-slate-500">Khách: </span>
                    <span className="font-bold text-slate-800">{booking.passenger.name}</span>
                </div>
            </div>
        )}

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <History size={48} className="mx-auto mb-2 opacity-20" />
            <p>Chưa có lịch sử ghi nhận cho đơn hàng này.</p>
          </div>
        ) : (
          <div className="relative border-l-2 border-slate-200 ml-4 space-y-8 py-2">
            {history.map((log) => (
              <div key={log.id} className="relative pl-6">
                {/* Timeline Dot */}
                <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white shadow-sm flex items-center justify-center ${getColor(log.action).replace('text-', 'bg-').split(' ')[0]}`}>
                    {/* Inner dot handled by bg */}
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                     <span className={`text-xs font-bold px-2 py-0.5 rounded border ${getColor(log.action)}`}>
                        {log.action}
                     </span>
                     <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Calendar size={10} />
                        {new Date(log.timestamp).toLocaleString('vi-VN')}
                     </span>
                  </div>
                  
                  <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 mt-1">
                     {getIcon(log.action)}
                     {getTitle(log.action)}
                  </h4>
                  
                  <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 mt-1">
                     {log.description}
                  </div>

                  {/* Optional JSON Details View if needed, simplified for now */}
                  {/* <pre className="text-[10px] text-slate-400 mt-1 overflow-x-auto">{JSON.stringify(log.details, null, 2)}</pre> */}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="mt-4 pt-4 border-t border-slate-100 text-[10px] text-slate-400 italic flex items-center gap-1">
         <AlertCircle size={12}/>
         Hệ thống chỉ lưu trữ các tác động thay đổi dữ liệu vé, không bao gồm lịch sử thanh toán chi tiết (xem tab Tài chính).
      </div>
    </Dialog>
  );
};