
import React from "react";
import { X, History, Phone, Ticket, Clock, CheckCircle2 } from "lucide-react";
import { Badge } from "./ui/Badge";

export interface ActivityLog {
  id: string;
  phone: string;
  timestamp: Date;
  details: {
    tripInfo: string;
    seats: string[];
    totalPrice: number;
    isPaid: boolean; // true if fully paid, false if booking only
  }[];
}

interface RightSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activities: ActivityLog[];
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  isOpen,
  onClose,
  activities,
}) => {
  return (
    <div
      className={`fixed inset-y-0 right-0 z-[100] w-80 bg-white shadow-2xl transform transition-transform duration-300 border-l border-slate-200 flex flex-col ${
        isOpen ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-2 font-bold text-slate-800">
          <History size={18} />
          <span>Lịch sử phiên làm việc</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400 text-sm text-center">
            <History size={32} className="mb-2 opacity-20" />
            <p>Chưa có hoạt động nào<br/>trong phiên này.</p>
          </div>
        ) : (
          activities.map((log) => (
            <div
              key={log.id}
              className="border border-slate-200 rounded-xl p-3 bg-white shadow-sm relative overflow-hidden group"
            >
              {/* Header */}
              <div className="flex justify-between items-start mb-2 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-1.5 font-bold text-primary">
                  <Phone size={14} />
                  <span>{log.phone}</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                    <Clock size={10} />
                    {log.timestamp.toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              {/* Details List */}
              <div className="space-y-2">
                {log.details.map((detail, idx) => (
                    <div key={idx} className="text-xs">
                        <div className="font-medium text-slate-700 truncate" title={detail.tripInfo}>{detail.tripInfo}</div>
                        <div className="flex justify-between items-start mt-0.5">
                            <div className="flex items-center gap-1">
                                <Badge variant="secondary" className="px-1 py-0 h-4 text-[10px]">
                                    {detail.seats.length} vé
                                </Badge>
                                <span className="text-slate-500 font-medium">{detail.seats.join(", ")}</span>
                            </div>
                            <div className={`font-bold ${detail.isPaid ? 'text-green-600' : 'text-yellow-600'}`}>
                                {detail.isPaid ? detail.totalPrice.toLocaleString("vi-VN") : "Vé đặt"}
                            </div>
                        </div>
                    </div>
                ))}
              </div>
              
              <div className="absolute top-0 left-0 w-1 h-full bg-primary/20"></div>
            </div>
          ))
        )}
      </div>
      
      <div className="p-3 border-t border-slate-100 bg-slate-50 text-[10px] text-slate-400 text-center">
         Danh sách này sẽ được làm mới khi tải lại trang.
      </div>
    </div>
  );
};
