
import React, { useState, useMemo } from "react";
import { Users, Search, X, Calculator } from "lucide-react";
import { Booking, BusTrip } from "../types";
import { ManifestPrint } from "./ManifestPrint";

interface ManifestListProps {
  tripBookings: Booking[];
  selectedTrip: BusTrip | null;
  highlightedBookingId: string | null;
  onSelectBooking: (booking: Booking) => void;
}

export const ManifestList: React.FC<ManifestListProps> = ({
  tripBookings,
  selectedTrip,
  highlightedBookingId,
  onSelectBooking,
}) => {
  const [manifestSearch, setManifestSearch] = useState("");

  const filteredManifest = useMemo(() => {
    if (!manifestSearch.trim()) return tripBookings;

    const query = manifestSearch.toLowerCase();
    return tripBookings.filter((b) => {
      const phoneMatch = b.passenger.phone.includes(query);
      const nameMatch = (b.passenger.name || "").toLowerCase().includes(query);
      const seatMatch = b.items.some(
        (item) =>
          item.tripId === selectedTrip?.id &&
          item.seatIds.some((s) => s.toLowerCase().includes(query))
      );
      return phoneMatch || nameMatch || seatMatch;
    });
  }, [tripBookings, manifestSearch, selectedTrip]);

  const totalManifestPrice = useMemo(() => {
    return filteredManifest.reduce((sum, booking) => {
      const tripItem = booking.items.find((i) => i.tripId === selectedTrip?.id);
      return sum + (tripItem?.price || 0);
    }, 0);
  }, [filteredManifest, selectedTrip]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col min-h-[300px] md:flex-1 overflow-hidden">
      <div className="px-3 py-2.5 bg-white border-b border-slate-100 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs">
          <Users size={14} className="text-slate-400" />
          <span>Danh sách khách ({tripBookings.length})</span>
        </div>
        <ManifestPrint 
          selectedTrip={selectedTrip} 
          manifest={filteredManifest}
        />
      </div>

      <div className="p-2 border-b border-slate-100 bg-slate-50/50">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
            <Search size={14} className="text-slate-400" />
          </div>
          <input
            type="text"
            value={manifestSearch}
            onChange={(e) => setManifestSearch(e.target.value)}
            placeholder="Tìm theo SĐT, tên, ghế..."
            className="w-full pl-8 pr-7 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none bg-white placeholder-slate-400"
          />
          {manifestSearch && (
            <button
              title="Xóa tìm kiếm"
              onClick={() => setManifestSearch("")}
              className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="px-3 py-2 bg-indigo-50/50 border-b border-indigo-100 flex justify-between items-center text-xs shadow-inner shrink-0">
        <div className="flex items-center gap-1.5 text-slate-500 font-bold uppercase tracking-tight">
          <Calculator size={14} />
          <span>Tổng thực thu:</span>
        </div>
        <div className="font-black text-red-700 text-sm tracking-tight">
          {totalManifestPrice.toLocaleString("vi-VN")}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-0 scrollbar-thin">
        {filteredManifest.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs italic">
            Không có dữ liệu đặt vé
          </div>
        ) : (
          filteredManifest.map((booking) => {
            const totalPaid =
              (booking.payment?.paidCash || 0) +
              (booking.payment?.paidTransfer || 0);
            const isFullyPaid = totalPaid >= booking.totalPrice;
            const timeStr = new Date(
              booking.createdAt
            ).toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            });

            const tripItem = booking.items.find(
              (i) => i.tripId === selectedTrip?.id
            );
            const seatsToShow = tripItem ? tripItem.seatIds : [];
            const isHighlighted = booking.id === highlightedBookingId;
            const tripSubtotal = tripItem ? tripItem.price : 0;

            return (
              <div
                key={booking.id}
                id={`booking-item-${booking.id}`}
                onClick={() => onSelectBooking(booking)}
                className={`px-3 py-2 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${
                  !isFullyPaid && booking.status !== 'hold' ? "bg-yellow-50/30" : (booking.status === 'hold' ? "bg-purple-50/30" : "")
                } ${
                  isHighlighted
                    ? "bg-indigo-50 ring-2 ring-indigo-500 z-10"
                    : ""
                }`}
              >
                <div className="flex justify-between items-center mb-1.5">
                  <span
                    className={`text-xs font-bold ${
                      isHighlighted
                        ? "text-indigo-600"
                        : "text-slate-800"
                    }`}
                  >
                    {booking.passenger.phone}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {timeStr}
                  </span>
                </div>
                <div className="flex justify-between items-start gap-2">
                  <div className="flex gap-1 text-[11px] text-slate-600 font-medium flex-wrap">
                    {seatsToShow.map((s) => (
                      <span
                        key={s}
                        className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                  <div
                    className={`text-xs font-black whitespace-nowrap ${
                      isFullyPaid ? "text-green-600" : (booking.status === 'hold' ? "text-purple-600" : "text-amber-600")
                    }`}
                  >
                    {booking.status === 'booking' && tripSubtotal === 0 
                        ? "Đã đặt vé" 
                        : tripSubtotal.toLocaleString("vi-VN")
                    }
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
