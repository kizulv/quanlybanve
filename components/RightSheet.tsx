
import React, { useState, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/Sheet";
import { Button } from "./ui/Button";
import { 
  History, Phone, Clock, Search, X, Calendar, 
  Ticket, Undo2, AlertTriangle, FileClock, 
  MapPin, User, ChevronRight, Hash
} from "lucide-react";
import { Badge } from "./ui/Badge";
import { Booking, BusTrip, UndoAction } from "../types";
import { formatLunarDate } from "../utils/dateUtils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/AlertDialog";
import { BookingHistoryModal } from "./BookingHistoryModal";

interface RightSheetProps {
  bookings: Booking[];
  trips: BusTrip[];
  onSelectBooking: (booking: Booking) => void;
  onUndo?: () => void;
  lastUndoAction?: UndoAction;
}

export const RightSheet: React.FC<RightSheetProps> = ({ 
  bookings, 
  trips, 
  onSelectBooking,
  onUndo,
  lastUndoAction
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isUndoAlertOpen, setIsUndoAlertOpen] = useState(false);
  
  const [viewHistoryBooking, setViewHistoryBooking] = useState<Booking | null>(null);

  // Use updatedAt for sorting (fallback to createdAt for old records)
  const sortedBookings = useMemo(() => {
    return [...bookings].sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.createdAt).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt).getTime();
      return timeB - timeA;
    });
  }, [bookings]);

  const filteredList = useMemo(() => {
    if (!searchTerm.trim()) return sortedBookings;
    const lowerTerm = searchTerm.toLowerCase();
    return sortedBookings.filter((booking) => {
      const itemMatch = booking.items.some(item => 
        item.route.toLowerCase().includes(lowerTerm) ||
        item.licensePlate.toLowerCase().includes(lowerTerm) ||
        item.seatIds.some(s => s.toLowerCase().includes(lowerTerm))
      );
      return (
        booking.passenger.phone.includes(lowerTerm) ||
        (booking.passenger.name || '').toLowerCase().includes(lowerTerm) ||
        itemMatch
      );
    });
  }, [sortedBookings, searchTerm]);

  const listByDate = useMemo(() => {
     const groups: Record<string, Booking[]> = {};
     filteredList.forEach(item => {
         // Group by the date of last modification
         const date = new Date(item.updatedAt || item.createdAt);
         const dateStr = date.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
         if (!groups[dateStr]) groups[dateStr] = [];
         groups[dateStr].push(item);
     });
     return groups;
  }, [filteredList]);

  const handleSelect = (booking: Booking) => {
      onSelectBooking(booking);
      setIsOpen(false);
  }

  const handleConfirmUndo = () => {
      if (onUndo) {
          onUndo();
          setIsUndoAlertOpen(false);
      }
  }

  const handleViewHistory = (e: React.MouseEvent, booking: Booking) => {
      e.stopPropagation();
      setViewHistoryBooking(booking);
  };

  const renderStatusBadge = (status: string, isPaid: boolean) => {
      if (status === 'cancelled') {
          return <Badge className="bg-red-50 text-red-600 border-red-100 text-[10px] px-1.5 h-5">Đã hủy</Badge>;
      }
      if (status === 'modified') {
          return <Badge className="bg-blue-50 text-blue-600 border-blue-100 text-[10px] px-1.5 h-5">Đã đổi</Badge>;
      }
      if (status === 'confirmed' || isPaid) {
          return <Badge className="bg-green-50 text-green-600 border-green-100 text-[10px] px-1.5 h-5">Đã thu</Badge>;
      }
      return <Badge className="bg-amber-50 text-amber-600 border-amber-100 text-[10px] px-1.5 h-5">Chờ thu</Badge>;
  };

  return (
    <>
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="bg-white border-slate-200 text-slate-600 hover:text-primary hover:border-primary/50 shrink-0 shadow-sm transition-all hover:shadow-md">
          <History size={20} />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex flex-col h-full w-full sm:w-[480px] p-0 gap-0 border-l shadow-2xl bg-white">
        <SheetHeader className="px-6 py-5 border-b border-slate-100 shrink-0 bg-white">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    <History size={20}/>
                </div>
                Lịch sử đặt vé
            </SheetTitle>
            
            {onUndo && lastUndoAction && (
                <Button onClick={() => setIsUndoAlertOpen(true)} variant="ghost" size="sm" className="text-red-500 hover:bg-red-50 hover:text-red-600 border border-red-100 h-8 px-3 rounded-full font-bold text-xs animate-pulse">
                    <Undo2 size={14} className="mr-1.5" /> Hoàn tác
                </Button>
            )}
          </div>
        </SheetHeader>

        {/* Improved Search Bar */}
        <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 shrink-0">
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search size={16} className="text-slate-400 group-focus-within:text-primary transition-colors" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo SĐT, tên, tuyến đường..."
              className="w-full pl-10 pr-10 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary bg-white placeholder-slate-400 shadow-sm transition-all"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable List with Card Layout */}
        <div className="flex-1 overflow-y-auto p-0 bg-slate-50/30">
          {Object.keys(listByDate).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-12 text-center">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                 <Search size={32} className="opacity-20" />
              </div>
              <p className="font-bold text-slate-500">Không tìm thấy dữ liệu</p>
              <p className="text-xs mt-1">Hãy thử tìm kiếm với từ khóa khác.</p>
            </div>
          ) : (
            <div className="pb-10">
              {(Object.entries(listByDate) as [string, Booking[]][]).map(([dateStr, items]) => (
                <div key={dateStr} className="mt-4 first:mt-0">
                   <div className="sticky top-0 z-20 px-6 py-2 bg-slate-100/90 backdrop-blur-md border-y border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <Calendar size={12} className="text-slate-400" />
                      {dateStr}
                   </div>
                   <div className="px-4 py-3 space-y-3">
                      {items.map((booking) => {
                        const paid = (booking.payment?.paidCash || 0) + (booking.payment?.paidTransfer || 0);
                        const isFullyPaid = paid >= booking.totalPrice;
                        const displayTime = new Date(booking.updatedAt || booking.createdAt).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'});

                        return (
                          <div
                            key={booking.id}
                            onClick={() => handleSelect(booking)}
                            className="relative bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group active:scale-[0.98]"
                          >
                            {/* Card Top: Identity & Status */}
                            <div className="flex justify-between items-start mb-3">
                               <div className="flex flex-col gap-0.5">
                                  <div className="flex items-center gap-2">
                                     <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                        <User size={14} />
                                     </div>
                                     <span className="text-sm font-black text-slate-900">{booking.passenger.phone}</span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 font-medium ml-9 flex items-center gap-1.5">
                                     <span className="truncate max-w-[150px]">{booking.passenger.name || 'Khách lẻ'}</span>
                                     <span className="text-slate-300">•</span>
                                     <span className="flex items-center gap-1" title="Thời gian chỉnh sửa gần nhất">
                                        <Clock size={10} className="text-amber-500"/>
                                        <span className="text-amber-600/80 font-bold">Chỉnh sửa gần nhất: {displayTime}</span>
                                     </span>
                                  </div>
                               </div>
                               <div className="flex flex-col items-end gap-1.5">
                                   {renderStatusBadge(booking.status, isFullyPaid)}
                                   <div className="text-[10px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">#{booking.id.slice(-5).toUpperCase()}</div>
                               </div>
                            </div>

                            {/* Card Body: Trips */}
                            <div className="ml-9 space-y-2 mb-4">
                                {booking.items.map((item, idx) => (
                                    <div key={idx} className="flex flex-col gap-1.5 p-2.5 rounded-xl bg-slate-50/80 border border-slate-100 group-hover:bg-primary/5 group-hover:border-primary/10 transition-colors">
                                        <div className="flex justify-between items-center text-xs">
                                            <div className="flex items-center gap-1.5 font-bold text-slate-700">
                                                <MapPin size={12} className="text-primary/60" />
                                                {item.route}
                                            </div>
                                            <Badge variant="outline" className="bg-white border-slate-200 text-[10px] px-1.5 font-mono">
                                                <Hash size={10} className="mr-1 text-slate-400" />
                                                {item.licensePlate}
                                            </Badge>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                            {item.seatIds.map(s => (
                                                <Badge key={s} className="bg-indigo-600 text-white border-transparent text-[10px] font-bold px-2 py-0 h-5 shadow-sm">
                                                    {s}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                {booking.items.length === 0 && (
                                    <div className="text-[11px] text-slate-400 italic text-center py-2 bg-red-50/30 rounded-xl border border-dashed border-red-100">Đơn hàng không có giường</div>
                                )}
                            </div>

                            {/* Card Bottom: Summary & Actions */}
                            <div className="flex justify-between items-center pt-3 border-t border-slate-100 border-dashed">
                              <button
                                  onClick={(e) => handleViewHistory(e, booking)}
                                  className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 px-2 py-1 rounded-lg transition-colors border border-transparent hover:border-slate-200"
                              >
                                  <FileClock size={12} /> Lịch sử
                              </button>

                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Tổng {booking.totalTickets} vé</div>
                                    <div className="text-sm font-black text-slate-900">
                                      {booking.totalPrice.toLocaleString("vi-VN")} <span className="text-[10px] font-normal text-slate-500">đ</span>
                                    </div>
                                </div>
                                <div className="p-1.5 bg-slate-100 rounded-full text-slate-300 group-hover:bg-primary group-hover:text-white transition-all transform group-hover:translate-x-1 shadow-sm">
                                    <ChevronRight size={14} />
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                   </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>

    <AlertDialog open={isUndoAlertOpen} onOpenChange={setIsUndoAlertOpen}>
        <AlertDialogContent className="max-w-md rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 flex items-center gap-2">
                <AlertTriangle size={22} />
                Xác nhận hoàn tác
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-slate-600 pt-3 text-sm leading-relaxed">
                 Bạn đang yêu cầu hủy bỏ tác vụ vừa thực hiện và khôi phục lại dữ liệu trước đó. Hành động này không thể rút lại.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 gap-3">
            <Button variant="outline" onClick={() => setIsUndoAlertOpen(false)} className="rounded-xl flex-1">Đóng</Button>
            <Button variant="destructive" onClick={handleConfirmUndo} className="rounded-xl flex-1 shadow-lg shadow-red-500/20 font-bold">Xác nhận</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>

    <BookingHistoryModal 
        isOpen={!!viewHistoryBooking}
        onClose={() => setViewHistoryBooking(null)}
        booking={viewHistoryBooking}
    />
    </>
  );
};
