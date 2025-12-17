
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
  AlertCircle,
  MapPin,
  Ticket,
  ArrowRight
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

  const formatDate = (dateStr: string) => {
      try {
          const date = new Date(dateStr);
          return date.toLocaleDateString('vi-VN') + ' ' + date.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});
      } catch (e) {
          return dateStr;
      }
  };

  const renderDetails = (log: BookingHistory) => {
      const details = log.details || {};

      // 1. CREATE ACTION
      if (log.action === 'CREATE' && details.trips) {
          return (
              <div className="flex flex-col gap-2 mt-2">
                  {details.trips.map((trip: any, idx: number) => (
                      <div key={idx} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs">
                          <div className="flex items-center gap-2 mb-1.5 pb-1.5 border-b border-slate-100">
                              <MapPin size={12} className="text-blue-500"/>
                              <span className="font-bold text-slate-700">{trip.route}</span>
                          </div>
                          <div className="flex justify-between items-center text-slate-500 mb-1">
                              <div className="flex items-center gap-1.5">
                                  <Calendar size={12}/> 
                                  <span>{formatDate(trip.tripDate)}</span>
                              </div>
                              <span className="bg-slate-200 px-1.5 rounded text-[10px]">{trip.licensePlate || 'N/A'}</span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                              {trip.seats.map((s: string) => (
                                  <Badge key={s} variant="outline" className="bg-white text-blue-700 border-blue-200 px-1.5 py-0">
                                      {s}
                                  </Badge>
                              ))}
                          </div>
                      </div>
                  ))}
              </div>
          );
      }

      // 2. UPDATE ACTION
      if (log.action === 'UPDATE' && details.changes) {
          return (
              <div className="flex flex-col gap-2 mt-2">
                  {details.changes.map((change: any, idx: number) => (
                      <div key={idx} className="bg-blue-50/50 p-2.5 rounded-lg border border-blue-100 text-xs">
                          <div className="font-bold text-slate-700 mb-1">{change.route}</div>
                          <div className="text-[10px] text-slate-500 mb-2 flex items-center gap-1">
                              <Calendar size={10}/> {formatDate(change.date)}
                          </div>
                          
                          {change.added && change.added.length > 0 && (
                              <div className="flex items-start gap-2 mb-1">
                                  <span className="text-green-600 font-bold min-w-[35px]">Thêm:</span>
                                  <div className="flex flex-wrap gap-1">
                                      {change.added.map((s: string) => (
                                          <span key={s} className="bg-green-100 text-green-700 px-1.5 rounded border border-green-200 font-bold">{s}</span>
                                      ))}
                                  </div>
                              </div>
                          )}
                          
                          {change.removed && change.removed.length > 0 && (
                              <div className="flex items-start gap-2">
                                  <span className="text-red-600 font-bold min-w-[35px]">Bỏ:</span>
                                  <div className="flex flex-wrap gap-1">
                                      {change.removed.map((s: string) => (
                                          <span key={s} className="bg-red-100 text-red-700 px-1.5 rounded border border-red-200 decoration-slice line-through decoration-red-400">{s}</span>
                                      ))}
                                  </div>
                              </div>
                          )}
                      </div>
                  ))}
              </div>
          );
      }

      // 3. SWAP ACTION
      if (log.action === 'SWAP' && details.from && details.to) {
          return (
              <div className="mt-2 bg-purple-50 p-2.5 rounded-lg border border-purple-100 text-xs">
                  <div className="flex flex-col gap-1 mb-2 pb-2 border-b border-purple-100">
                      <div className="font-bold text-purple-900">{details.route}</div>
                      <div className="text-[10px] text-purple-700 flex items-center gap-1">
                          <Calendar size={10}/> {formatDate(details.date)}
                      </div>
                  </div>
                  <div className="flex items-center justify-center gap-3">
                      <span className="font-bold text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">{details.from}</span>
                      <ArrowRight size={14} className="text-purple-500"/>
                      <span className="font-bold text-purple-700 bg-white px-2 py-1 rounded border border-purple-200 shadow-sm">{details.to}</span>
                  </div>
              </div>
          );
      }

      // 4. CANCEL/DELETE ACTION
      if (log.action === 'DELETE' && details.cancelledTrips) {
          return (
              <div className="flex flex-col gap-2 mt-2">
                  {details.cancelledTrips.map((trip: any, idx: number) => (
                      <div key={idx} className="bg-red-50 p-2.5 rounded-lg border border-red-100 text-xs opacity-75">
                          <div className="font-bold text-red-900 mb-1">{trip.route}</div>
                          <div className="text-[10px] text-red-700 mb-1">{formatDate(trip.date)}</div>
                          <div className="flex flex-wrap gap-1">
                              {trip.seats.map((s: string) => (
                                  <span key={s} className="bg-white text-red-500 px-1.5 rounded border border-red-200">{s}</span>
                              ))}
                          </div>
                      </div>
                  ))}
              </div>
          )
      }

      // 5. PASSENGER UPDATE
      if (log.action === 'PASSENGER_UPDATE') {
          return (
              <div className="mt-2 text-xs bg-orange-50 p-2 rounded border border-orange-100">
                  <div className="grid grid-cols-2 gap-2">
                      <div>
                          <div className="text-[10px] text-slate-400">Cũ</div>
                          <div className="font-medium text-slate-600">{details.oldName || '---'}</div>
                          <div className="text-slate-500">{details.oldPhone || '---'}</div>
                      </div>
                      <div className="border-l border-orange-200 pl-2">
                          <div className="text-[10px] text-orange-400 font-bold">Mới</div>
                          <div className="font-bold text-orange-800">{details.newName || '---'}</div>
                          <div className="text-orange-700">{details.newPhone || '---'}</div>
                      </div>
                  </div>
              </div>
          );
      }

      // Fallback for string description only or legacy logs
      return null;
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
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center justify-between shadow-sm">
                <div className="text-sm">
                    <span className="text-slate-500">Mã đơn: </span>
                    <span className="font-bold font-mono text-slate-800">{booking.id.slice(-6).toUpperCase()}</span>
                </div>
                <div className="text-sm flex items-center gap-2">
                    <span className="text-slate-500">Khách: </span>
                    <span className="font-bold text-slate-800">{booking.passenger.name}</span>
                    <span className="text-xs text-slate-400">({booking.passenger.phone})</span>
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
                  
                  {/* Detailed View */}
                  {renderDetails(log)}

                  {/* Fallback Description if Details are missing/legacy */}
                  {(!log.details || Object.keys(log.details).length === 0) && (
                      <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 mt-1 italic">
                         {log.description}
                      </div>
                  )}
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