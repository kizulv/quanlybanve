import React, { useState, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/Sheet";
import { Button } from "./ui/Button";
import { History, Phone, Clock, Search, X, MapPin, Calendar, CheckCircle2 } from "lucide-react";
import { Badge } from "./ui/Badge";
import { Booking, BusTrip } from "../types";

interface RightSheetProps {
  bookings: Booking[];
  trips: BusTrip[];
}

export const RightSheet: React.FC<RightSheetProps> = ({ bookings, trips }) => {
  const [searchTerm, setSearchTerm] = useState("");

  // Group bookings by (Phone + BusId + CreatedAt) to create a "Ticket Order" view
  const groupedBookings = useMemo(() => {
    const groups: Record<
      string,
      {
        id: string;
        phone: string;
        passengerName: string;
        tripId: string;
        createdAt: string;
        seats: string[];
        totalPrice: number;
        paidCash: number;
        paidTransfer: number;
        trip?: BusTrip;
      }
    > = {};

    // Sort bookings by newest first
    const sortedBookings = [...bookings].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    sortedBookings.forEach((b) => {
      // Create a unique key for grouping. 
      // We assume bookings created at the exact same time (iso string) for the same bus & phone are one order.
      const key = `${b.passenger.phone}_${b.busId}_${b.createdAt}`;

      if (!groups[key]) {
        groups[key] = {
          id: key,
          phone: b.passenger.phone,
          passengerName: b.passenger.name || "Khách lẻ",
          tripId: b.busId,
          createdAt: b.createdAt,
          seats: [],
          totalPrice: 0,
          paidCash: 0,
          paidTransfer: 0,
          trip: trips.find((t) => t.id === b.busId),
        };
      }

      groups[key].seats.push(b.seatId);
      groups[key].totalPrice += b.totalPrice;
      // Payments are typically stored per booking in this mock DB, 
      // but usually represented as a total for the group. 
      // We sum them up, assuming the API splits them or creates duplicates.
      groups[key].paidCash += b.payment?.paidCash || 0;
      groups[key].paidTransfer += b.payment?.paidTransfer || 0;
    });

    return Object.values(groups);
  }, [bookings, trips]);

  // Filter Logic
  const filteredList = useMemo(() => {
    if (!searchTerm.trim()) return groupedBookings;

    const lowerTerm = searchTerm.toLowerCase();
    return groupedBookings.filter((group) => {
      const tripDate = group.trip ? new Date(group.trip.departureTime).toLocaleDateString('vi-VN') : '';
      
      return (
        group.phone.includes(lowerTerm) ||
        group.passengerName.toLowerCase().includes(lowerTerm) ||
        group.seats.some(s => s.toLowerCase().includes(lowerTerm)) ||
        tripDate.includes(lowerTerm) || 
        (group.trip && group.trip.route.toLowerCase().includes(lowerTerm))
      );
    });
  }, [groupedBookings, searchTerm]);

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
      <SheetContent side="right" className="flex flex-col h-full w-full sm:w-[400px] p-0 gap-0">
        <SheetHeader className="px-4 py-3 border-b border-slate-100 shrink-0">
          <SheetTitle className="text-base">Danh sách đặt vé ({groupedBookings.length})</SheetTitle>
        </SheetHeader>

        {/* Search Bar */}
        <div className="p-3 bg-slate-50 border-b border-slate-100 shrink-0">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
              <Search size={14} className="text-slate-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm SĐT, ngày đi, tên khách..."
              className="w-full pl-8 pr-8 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white placeholder-slate-400"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable List */}
        <div className="flex-1 overflow-y-auto p-0 scrollbar-thin bg-slate-50/30">
          {filteredList.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400 text-sm text-center">
              <History size={32} className="mb-2 opacity-20" />
              <p>Không tìm thấy kết quả phù hợp.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredList.map((group) => {
                const isFullyPaid = (group.paidCash + group.paidTransfer) >= group.totalPrice;
                const tripDate = group.trip 
                    ? new Date(group.trip.departureTime).toLocaleDateString('vi-VN', {day: '2-digit', month: '2-digit'}) 
                    : '--/--';
                const tripTime = group.trip
                    ? group.trip.departureTime.split(' ')[1]
                    : '--:--';

                return (
                  <div
                    key={group.id}
                    className="p-3 bg-white hover:bg-slate-50 transition-colors group cursor-default"
                  >
                    {/* Top Row: Phone & Booking Time */}
                    <div className="flex justify-between items-start mb-1.5">
                      <div className="flex flex-col">
                         <div className="flex items-center gap-1.5">
                            <Phone size={12} className="text-slate-400" />
                            <span className="text-sm font-bold text-slate-900">{group.phone}</span>
                         </div>
                         <span className="text-[11px] text-slate-500 pl-[18px] truncate max-w-[150px]">{group.passengerName}</span>
                      </div>
                      <div className="flex flex-col items-end">
                         <div className="flex items-center gap-1 text-[10px] text-slate-400">
                             <Clock size={10} />
                             {new Date(group.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit'})} {new Date(group.createdAt).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})}
                         </div>
                         {isFullyPaid ? (
                             <Badge variant="success" className="h-4 px-1 text-[9px] bg-green-50 text-green-700 border-green-100 mt-1">
                                Đã thanh toán
                             </Badge>
                         ) : (
                             <Badge variant="warning" className="h-4 px-1 text-[9px] bg-yellow-50 text-yellow-700 border-yellow-100 mt-1">
                                Chưa thanh toán
                             </Badge>
                         )}
                      </div>
                    </div>

                    {/* Middle Row: Route Info */}
                    <div className="mb-2 bg-slate-50 p-2 rounded border border-slate-100 flex items-center gap-2">
                       <div className="bg-white border border-slate-200 w-8 h-8 rounded flex flex-col items-center justify-center shrink-0">
                           <span className="text-[8px] font-bold text-slate-400">NGÀY</span>
                           <span className="text-xs font-bold text-slate-800 leading-none">{tripDate.split('/')[0]}</span>
                       </div>
                       <div className="flex-1 min-w-0">
                           <div className="text-xs font-bold text-slate-700 truncate">{group.trip?.route || 'Không xác định'}</div>
                           <div className="text-[10px] text-slate-500 flex items-center gap-1">
                              <span className="text-primary font-bold">{tripTime}</span>
                              <span>•</span>
                              <span>{group.trip?.licensePlate}</span>
                           </div>
                       </div>
                    </div>

                    {/* Bottom Row: Seats & Price */}
                    <div className="flex justify-between items-center">
                      <div className="flex flex-wrap gap-1">
                        {group.seats.map((seat) => (
                          <span
                            key={seat}
                            className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100"
                          >
                            {seat}
                          </span>
                        ))}
                      </div>
                      <div className="text-sm font-bold text-slate-900">
                        {group.totalPrice.toLocaleString("vi-VN")} <span className="text-[10px] font-normal text-slate-500">đ</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
