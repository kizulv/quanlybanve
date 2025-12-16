import React, { useState, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/Sheet";
import { Button } from "./ui/Button";
import { History, Phone, Clock, Search, X, Calendar, Ticket, Undo2, AlertTriangle } from "lucide-react";
import { Badge } from "./ui/Badge";
import { Booking, BusTrip, UndoAction } from "../types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/AlertDialog";

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
  // We need to control the sheet open state to close it upon selection
  const [isOpen, setIsOpen] = useState(false);
  const [isUndoAlertOpen, setIsUndoAlertOpen] = useState(false);

  const sortedBookings = useMemo(() => {
    return [...bookings].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [bookings]);

  // Filter Logic
  const filteredList = useMemo(() => {
    if (!searchTerm.trim()) return sortedBookings;

    const lowerTerm = searchTerm.toLowerCase();
    return sortedBookings.filter((booking) => {
      // Check if any item in the booking matches the search
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

  // Group by Date for Display Headers
  const listByDate = useMemo(() => {
     const groups: Record<string, Booking[]> = {};
     filteredList.forEach(item => {
         const date = new Date(item.createdAt);
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

  const getUndoMessage = () => {
      if (!lastUndoAction) return "";
      switch(lastUndoAction.type) {
          case 'CREATED_BOOKING':
              return (
                <div className="space-y-2">
                    <p>Bạn có chắc muốn hủy đơn hàng vừa tạo?</p>
                    <ul className="list-disc pl-5 text-sm text-slate-700 bg-slate-50 p-2 rounded">
                        <li>Khách hàng: <strong>{lastUndoAction.phone}</strong></li>
                        <li>Chuyến: <strong>{new Date(lastUndoAction.tripDate).toLocaleDateString('vi-VN')}</strong></li>
                        <li>Số lượng: <strong>{lastUndoAction.seatCount} vé</strong></li>
                        <li>Ghế: {lastUndoAction.seatLabels.join(", ")}</li>
                    </ul>
                    <p className="text-xs text-red-500 mt-2">* Hành động này sẽ xóa đơn hàng và trả lại ghế trống.</p>
                </div>
              );
          case 'UPDATED_BOOKING':
              return (
                <div className="space-y-2">
                    <p>Bạn có chắc muốn khôi phục trạng thái cũ?</p>
                    <div className="text-sm bg-slate-50 p-2 rounded">
                        Đơn hàng của khách <strong>{lastUndoAction.phone}</strong> sẽ quay về trạng thái trước khi chỉnh sửa.
                    </div>
                    {lastUndoAction.previousBooking.items.length > 0 && (
                        <div className="text-xs text-slate-500 pl-2">
                            Ngày chuyến: {new Date(lastUndoAction.previousBooking.items[0].tripDate).toLocaleDateString('vi-VN')}
                        </div>
                    )}
                    <p className="text-xs text-red-500 mt-2">* Mọi thay đổi vừa thực hiện sẽ bị mất.</p>
                </div>
              );
          case 'SWAPPED_SEATS':
              return (
                <div className="space-y-2">
                    <p>Bạn có chắc muốn hoàn tác việc đổi chỗ?</p>
                    <div className="text-center text-xs font-medium text-slate-500 mb-2">
                        Ngày {new Date(lastUndoAction.tripDate).toLocaleDateString('vi-VN')}
                    </div>
                    <div className="flex items-center gap-3 justify-center bg-slate-50 p-3 rounded">
                        <span className="font-bold text-indigo-600">{lastUndoAction.label2}</span>
                        <Undo2 size={16} className="text-slate-400" />
                        <span className="font-bold text-slate-600">{lastUndoAction.label1}</span>
                    </div>
                    <p className="text-xs text-slate-500 text-center">Ghế sẽ được trả về vị trí ban đầu.</p>
                </div>
              );
      }
  };

  const renderStatusBadge = (status: string, isPaid: boolean) => {
      if (status === 'cancelled') {
          return <Badge variant="destructive" className="bg-red-100 text-red-600 border-red-200">Đã hủy</Badge>;
      }
      if (status === 'modified') {
          return <Badge variant="default" className="bg-blue-100 text-blue-600 border-blue-200">Đã thay đổi</Badge>;
      }
      if (status === 'confirmed' || isPaid) {
          return <Badge variant="success" className="bg-green-100 text-green-600 border-green-200">Đã thanh toán</Badge>;
      }
      return <Badge variant="warning" className="bg-yellow-100 text-yellow-600 border-yellow-200">Tạo mới</Badge>;
  };

  return (
    <>
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="bg-white border-slate-200 text-slate-600 hover:text-primary hover:border-primary/50 shrink-0"
          title="Tra cứu danh sách vé"
        >
          <History size={20} />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex flex-col h-full w-full sm:w-[500px] p-0 gap-0 border-l shadow-2xl">
        <SheetHeader className="px-5 py-4 border-b border-slate-100 shrink-0 bg-white flex flex-row items-center justify-between">
          <div className="flex-1">
            <SheetTitle className="text-lg font-bold flex items-center gap-2">
                <History className="text-primary" size={20}/>
                Lịch sử đơn hàng
                <Badge variant="secondary" className="ml-auto text-xs font-normal">
                    {sortedBookings.length} đơn
                </Badge>
            </SheetTitle>
          </div>
          
          {/* UNDO BUTTON IN HEADER */}
          {onUndo && lastUndoAction && (
              <Button
                  onClick={() => setIsUndoAlertOpen(true)}
                  variant="ghost"
                  size="sm"
                  className="ml-2 text-red-500 hover:bg-red-50 hover:text-red-600 border border-red-100 h-8"
                  title="Hoàn tác tác vụ vừa thực hiện"
              >
                  <Undo2 size={16} className="mr-1.5" /> Hoàn tác
              </Button>
          )}
        </SheetHeader>

        {/* Search Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-100 shrink-0">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={16} className="text-slate-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm SĐT, tên khách, tuyến..."
              className="w-full pl-9 pr-9 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white placeholder-slate-400 shadow-sm"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable List */}
        <div className="flex-1 overflow-y-auto p-0 scrollbar-thin bg-slate-50/50">
          {Object.keys(listByDate).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 text-sm text-center p-8">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                 <Search size={24} className="opacity-30" />
              </div>
              <p>Không tìm thấy kết quả phù hợp.</p>
            </div>
          ) : (
            <div className="pb-4">
              {(Object.entries(listByDate) as [string, Booking[]][]).map(([dateStr, items]) => (
                <div key={dateStr}>
                   <div className="sticky top-0 z-10 px-5 py-2 bg-slate-100/95 backdrop-blur border-y border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider shadow-sm flex items-center gap-2">
                      <Calendar size={12} />
                      {dateStr}
                   </div>
                   <div className="divide-y divide-slate-100 border-b border-slate-100 bg-white">
                      {items.map((booking) => {
                        const paid = (booking.payment?.paidCash || 0) + (booking.payment?.paidTransfer || 0);
                        const isFullyPaid = paid >= booking.totalPrice;

                        return (
                          <div
                            key={booking.id}
                            onClick={() => handleSelect(booking)}
                            className="p-4 hover:bg-blue-50/50 transition-colors group cursor-pointer active:bg-blue-100"
                          >
                            {/* Top Row: Passenger & Time */}
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex flex-col gap-0.5">
                                 <div className="flex items-center gap-2">
                                    <Phone size={14} className="text-slate-400" />
                                    <span className="text-sm font-bold text-slate-900 group-hover:text-primary transition-colors">{booking.passenger.phone}</span>
                                 </div>
                                 <span className="text-xs text-slate-500 pl-6 truncate max-w-[180px]">{booking.passenger.name || 'Khách lẻ'}</span>
                              </div>
                              <div className="text-right">
                                 <div className="flex items-center justify-end gap-1.5 text-xs font-medium text-slate-500">
                                     <Clock size={12} />
                                     {new Date(booking.createdAt).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})}
                                 </div>
                                 <div className="mt-1">
                                     {renderStatusBadge(booking.status, isFullyPaid)}
                                 </div>
                              </div>
                            </div>

                            {/* Booking Items (Trips) */}
                            <div className="space-y-2 mb-3">
                                {booking.items.map((item, idx) => (
                                    <div key={idx} className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-xs group-hover:border-blue-100 group-hover:bg-blue-50 transition-colors">
                                        <div className="flex justify-between font-bold text-slate-700 mb-1">
                                            <span>{item.route}</span>
                                            <span>{new Date(item.tripDate).getDate()}/{new Date(item.tripDate).getMonth()+1}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-slate-500">
                                             <div className="flex items-center gap-1">
                                                <Ticket size={10} />
                                                <span className="font-mono text-[10px]">{item.licensePlate}</span>
                                             </div>
                                             <div className="flex gap-1">
                                                {item.seatIds.map(s => (
                                                    <span key={s} className="bg-white border px-1 rounded shadow-sm text-indigo-600 font-bold">{s}</span>
                                                ))}
                                             </div>
                                        </div>
                                    </div>
                                ))}
                                {booking.items.length === 0 && (
                                    <div className="text-xs text-slate-400 italic text-center py-1">Đã hủy hết ghế</div>
                                )}
                            </div>

                            {/* Footer: Price */}
                            <div className="flex justify-end items-end pt-2 border-t border-slate-100 border-dashed">
                              <div className="text-right">
                                <div className="text-xs text-slate-400 mb-0.5">Tổng tiền ({booking.totalTickets} vé)</div>
                                <div className="text-base font-bold text-slate-900 group-hover:text-primary transition-colors">
                                  {booking.totalPrice.toLocaleString("vi-VN")} <span className="text-xs font-normal text-slate-500">đ</span>
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

    {/* ALERT DIALOG FOR UNDO */}
    <AlertDialog open={isUndoAlertOpen} onOpenChange={setIsUndoAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 flex items-center gap-2">
                <AlertTriangle size={20} />
                Xác nhận hoàn tác
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-slate-600 pt-2">
                {getUndoMessage()}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setIsUndoAlertOpen(false)}>Hủy bỏ</Button>
            <Button variant="destructive" onClick={handleConfirmUndo}>Đồng ý hoàn tác</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
};