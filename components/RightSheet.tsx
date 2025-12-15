import React, { useState, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/Sheet";
import { Button } from "./ui/Button";
import { History, Phone, Clock, Search, X, Calendar } from "lucide-react";
import { Badge } from "./ui/Badge";
import { Booking, BusTrip } from "../types";

interface RightSheetProps {
  bookings: Booking[];
  trips: BusTrip[];
}

export const RightSheet: React.FC<RightSheetProps> = ({ bookings, trips }) => {
  const [searchTerm, setSearchTerm] = useState("");

  // Since backend now groups seats into one booking record, we can use bookings directly
  // Sort bookings by newest first
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
      const trip = trips.find(t => t.id === booking.busId);
      const tripDate = trip ? new Date(trip.departureTime).toLocaleDateString('vi-VN') : '';
      const seatStr = booking.seatIds ? booking.seatIds.join(',') : '';
      
      return (
        booking.passenger.phone.includes(lowerTerm) ||
        (booking.passenger.name || '').toLowerCase().includes(lowerTerm) ||
        seatStr.toLowerCase().includes(lowerTerm) ||
        tripDate.includes(lowerTerm) || 
        (trip && trip.route.toLowerCase().includes(lowerTerm))
      );
    });
  }, [sortedBookings, searchTerm, trips]);

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

  return (
    <Sheet>
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
      <SheetContent side="right" className="flex flex-col h-full w-full sm:w-[450px] p-0 gap-0 border-l shadow-2xl">
        <SheetHeader className="px-5 py-4 border-b border-slate-100 shrink-0 bg-white">
          <SheetTitle className="text-lg font-bold flex items-center gap-2">
             <History className="text-primary" size={20}/>
             Lịch sử đặt vé
             <Badge variant="secondary" className="ml-auto text-xs font-normal">
                {sortedBookings.length} đơn
             </Badge>
          </SheetTitle>
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
              placeholder="Tìm SĐT, tên khách, ngày đi..."
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
                        
                        const trip = trips.find(t => t.id === booking.busId);
                        
                        const tripDate = trip 
                            ? new Date(trip.departureTime).toLocaleDateString('vi-VN', {day: '2-digit', month: '2-digit'}) 
                            : '--/--';
                        const tripTime = trip
                            ? trip.departureTime.split(' ')[1]
                            : '--:--';

                        return (
                          <div
                            key={booking.id}
                            className="p-4 hover:bg-blue-50/50 transition-colors group cursor-default"
                          >
                            {/* Top Row: Passenger & Time */}
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex flex-col gap-0.5">
                                 <div className="flex items-center gap-2">
                                    <Phone size={14} className="text-slate-400" />
                                    <span className="text-sm font-bold text-slate-900">{booking.passenger.phone}</span>
                                 </div>
                                 <span className="text-xs text-slate-500 pl-6 truncate max-w-[180px]">{booking.passenger.name || 'Khách lẻ'}</span>
                              </div>
                              <div className="text-right">
                                 <div className="flex items-center justify-end gap-1.5 text-xs font-medium text-slate-500">
                                     <Clock size={12} />
                                     {new Date(booking.createdAt).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})}
                                 </div>
                                 <div className={`text-[10px] font-bold mt-1 ${isFullyPaid ? 'text-green-600' : 'text-orange-600'}`}>
                                     {isFullyPaid ? 'Đã thanh toán' : 'Chưa thanh toán'}
                                 </div>
                              </div>
                            </div>

                            {/* Trip Info Card */}
                            <div className="mb-3 bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-center gap-3">
                               <div className="bg-white border border-slate-200 w-10 h-10 rounded-lg flex flex-col items-center justify-center shrink-0 shadow-sm">
                                   <span className="text-[9px] font-bold text-slate-400 uppercase">Ngày</span>
                                   <span className="text-sm font-bold text-slate-800 leading-none">{tripDate.split('/')[0]}</span>
                               </div>
                               <div className="flex-1 min-w-0">
                                   <div className="text-sm font-bold text-slate-700 truncate" title={trip?.route}>
                                       {trip?.route || 'Không xác định'}
                                   </div>
                                   <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                                      <span className="font-medium text-primary bg-primary/5 px-1 rounded">{tripTime}</span>
                                      <span className="text-slate-300">|</span>
                                      <span>{trip?.licensePlate}</span>
                                   </div>
                               </div>
                            </div>

                            {/* Footer: Seats & Price */}
                            <div className="flex justify-between items-end">
                              <div className="flex flex-wrap gap-1.5 max-w-[60%]">
                                {(booking.seatIds || []).map((seat) => (
                                  <span
                                    key={seat}
                                    className="inline-flex items-center justify-center px-2 py-1 rounded-md text-[11px] font-bold bg-white border border-slate-200 text-slate-700 shadow-sm"
                                  >
                                    {seat}
                                  </span>
                                ))}
                              </div>
                              <div className="text-right">
                                <div className="text-xs text-slate-400 mb-0.5">Tổng tiền</div>
                                <div className="text-base font-bold text-slate-900">
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
  );
};