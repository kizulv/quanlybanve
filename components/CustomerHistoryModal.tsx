
import React from "react";
import { Dialog } from "./ui/Dialog";
import { Button } from "./ui/Button";
import { Booking } from "../types";
import { History, Calendar, MapPin, Clock } from "lucide-react";
import { Badge } from "./ui/Badge";

interface CustomerHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookings: Booking[];
  phoneNumber: string;
}

export const CustomerHistoryModal: React.FC<CustomerHistoryModalProps> = ({
  isOpen,
  onClose,
  bookings,
  phoneNumber,
}) => {
  // Sort bookings: Newest first
  const sortedBookings = [...bookings].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Lịch sử đặt vé: ${phoneNumber}`}
      className="max-w-2xl"
      footer={
        <Button variant="outline" onClick={onClose}>
          Đóng
        </Button>
      }
    >
      <div className="space-y-4 py-2">
        {sortedBookings.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <History size={32} className="mx-auto mb-2 opacity-30" />
            <p>Chưa có lịch sử đặt vé cho số điện thoại này.</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {sortedBookings.map((booking) => {
              const totalPaid =
                (booking.payment?.paidCash || 0) +
                (booking.payment?.paidTransfer || 0);
              const isFullyPaid = totalPaid >= booking.totalPrice;

              return (
                <div
                  key={booking.id}
                  className="bg-white border border-slate-200 rounded-lg p-3 hover:bg-slate-50 transition-colors shadow-sm"
                >
                  {/* Header: Date & Status */}
                  <div className="flex justify-between items-start mb-2 pb-2 border-b border-slate-100 border-dashed">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <Calendar size={14} className="text-slate-400" />
                      {new Date(booking.createdAt).toLocaleDateString("vi-VN")}
                      <span className="text-slate-300">|</span>
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(booking.createdAt).toLocaleTimeString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <Badge
                      className={`text-[10px] h-5 ${
                        isFullyPaid
                          ? "bg-green-100 text-green-700 hover:bg-green-100"
                          : "bg-orange-100 text-orange-700 hover:bg-orange-100"
                      }`}
                    >
                      {isFullyPaid ? "Đã thanh toán" : "Chưa thanh toán"}
                    </Badge>
                  </div>

                  {/* Body: Passenger & Trips */}
                  <div className="space-y-2">
                     <div className="text-sm font-bold text-slate-900">
                        {booking.passenger.name || "Khách lẻ"}
                     </div>
                     
                     <div className="space-y-1.5 bg-slate-50 p-2 rounded border border-slate-100">
                        {booking.items.map((item, idx) => (
                           <div key={idx} className="text-xs">
                              <div className="flex justify-between font-medium text-slate-700">
                                 <span className="flex items-center gap-1">
                                    <MapPin size={10} /> {item.route}
                                 </span>
                                 <span className="font-mono bg-white px-1 border rounded">{item.licensePlate}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-slate-500 pl-3.5">
                                 <span>{new Date(item.tripDate).toLocaleDateString('vi-VN')}</span>
                                 <span>•</span>
                                 <span>Ghế: {item.seatIds.join(", ")}</span>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>

                  {/* Footer: Price */}
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100">
                      <div className="text-xs text-slate-500 italic truncate max-w-[200px]" title={booking.passenger.note}>
                         {booking.passenger.note ? `Note: ${booking.passenger.note}` : ''}
                      </div>
                      <div className="font-bold text-slate-900 text-sm">
                         {booking.totalPrice.toLocaleString('vi-VN')} đ
                      </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Dialog>
  );
};
