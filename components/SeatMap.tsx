import React from "react";
import { Seat, SeatStatus, BusType, Booking } from "../types";
import {
  User,
  Check,
  Phone,
  MapPin,
  StickyNote,
  MessageSquare,
} from "lucide-react";

interface SeatMapProps {
  seats: Seat[];
  busType: BusType;
  onSeatClick: (seat: Seat) => void;
  bookings?: Booking[];
}

export const SeatMap: React.FC<SeatMapProps> = ({
  seats,
  busType,
  onSeatClick,
  bookings = [],
}) => {
  // Helper to determine visuals based on status
  const getSeatStatusClass = (status: SeatStatus) => {
    switch (status) {
      case SeatStatus.AVAILABLE:
        return "bg-white border-slate-300 text-slate-400 hover:border-primary hover:text-primary hover:shadow-md cursor-pointer hover:bg-slate-50";
      case SeatStatus.SELECTED:
        return "bg-primary border-primary text-white shadow-md transform scale-105 cursor-pointer z-10";
      case SeatStatus.BOOKED:
        return "bg-yellow-50 border-yellow-300 text-yellow-900 cursor-not-allowed";
      case SeatStatus.SOLD:
        return "bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed";
      default:
        return "bg-white border-slate-200";
    }
  };

  const formatPhone = (phone: string) => {
    // phone is expected to be normalized digits or raw string
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
    }
    return phone;
  };

  const renderSeat = (seat: Seat, isBench: boolean = false) => {
    const statusClass = getSeatStatusClass(seat.status);
    const isInteractive =
      seat.status === SeatStatus.AVAILABLE ||
      seat.status === SeatStatus.SELECTED;

    // Find booking info if booked
    const booking = bookings.find(
      (b) => b.seatId === seat.id && b.status !== "cancelled"
    );
    const isBooked = seat.status === SeatStatus.BOOKED && booking;

    let formattedPhone = "";
    let groupIndex = 0;
    let groupTotal = 0;

    if (isBooked && booking) {
      const rawPhone = booking.passenger.phone;
      const normalizedPhone = rawPhone.replace(/\D/g, "");
      formattedPhone = formatPhone(normalizedPhone || rawPhone);

      // Find siblings (bookings with same phone)
      const siblings = bookings.filter(
        (b) =>
          b.passenger.phone.replace(/\D/g, "") === normalizedPhone &&
          b.status !== "cancelled"
      );

      if (siblings.length > 1) {
        // Sort to find index (using seatId for deterministic order)
        siblings.sort((a, b) => a.seatId.localeCompare(b.seatId));
        const index = siblings.findIndex((b) => b.id === booking.id);
        groupIndex = index + 1;
        groupTotal = siblings.length;
      }
    }

    return (
      <div
        key={seat.id}
        onClick={() => isInteractive && onSeatClick(seat)}
        className={`
          relative flex flex-col border transition-all duration-200 select-none overflow-hidden
          ${statusClass} 
          ${
            isBench
              ? "w-[130px] h-[100px] rounded-lg"
              : "w-full min-w-[130px] h-[100px] rounded-lg"
          }
        `}
      >
        {/* Header: Seat Label */}
        <div
          className={`px-2 py-1 text-xs font-bold border-b flex justify-between items-center ${
            seat.status === SeatStatus.SELECTED
              ? "border-primary/50 bg-primary/10"
              : seat.status === SeatStatus.BOOKED
              ? "border-yellow-200 bg-yellow-100/50"
              : "border-slate-100 bg-slate-50/50"
          }`}
        >
          <span>{seat.label}</span>
          {seat.status === SeatStatus.SELECTED && (
            <Check size={12} strokeWidth={4} />
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 p-2 flex flex-col justify-center text-[10px] leading-tight space-y-1.5">
          {isBooked ? (
            <>
              {/* Passenger Phone */}
              <div
                className="flex items-center gap-1.5 font-bold"
                title={booking.passenger.name}
              >
                <Phone size={10} className="shrink-0 opacity-60" />
                <div className="flex items-center gap-1 min-w-0">
                  <span className="truncate">{formattedPhone}</span>
                  {groupTotal > 1 && (
                    <span className="shrink-0 bg-slate-200 text-slate-600 px-1 rounded text-[8px] font-normal leading-tight">
                      {groupIndex}/{groupTotal}
                    </span>
                  )}
                </div>
              </div>

              {/* Route Info */}
              {booking.passenger.pickupPoint ||
              booking.passenger.dropoffPoint ? (
                <div className="flex items-start gap-1.5 text-slate-600">
                  <MapPin size={10} className="shrink-0 opacity-60 mt-0.5" />
                  <div className="flex flex-col truncate">
                    <span
                      className="truncate"
                      title={booking.passenger.pickupPoint}
                    >
                      {booking.passenger.pickupPoint || "---"}
                    </span>
                    <span
                      className="truncate text-slate-400"
                      title={booking.passenger.dropoffPoint}
                    >
                      {booking.passenger.dropoffPoint || "---"}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-slate-400 italic pl-4">
                  Chưa có điểm đón
                </div>
              )}

              {/* Note */}
              {booking.passenger.note && (
                <div
                  className="flex items-center gap-1.5 text-orange-600 truncate"
                  title={booking.passenger.note}
                >
                  <MessageSquare size={10} className="shrink-0 opacity-60" />
                  <span className="truncate italic">
                    {booking.passenger.note}
                  </span>
                </div>
              )}
            </>
          ) : seat.status === SeatStatus.SELECTED ? (
            <div className="flex flex-col items-center justify-center h-full text-white/90">
              <Check size={24} className="mb-1" />
              <span className="font-medium">Đang chọn</span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-300">
              <span className="text-[10px]">Trống</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render a single floor (Deck)
  const renderDeck = (floorNumber: number) => {
    const floorSeats = seats.filter((s) => s.floor === floorNumber);

    // Group seats by row
    const rows = floorSeats.reduce((acc, seat) => {
      const r = seat.row ?? 0;
      if (!acc[r]) acc[r] = [];
      acc[r].push(seat);
      return acc;
    }, {} as Record<number, Seat[]>);

    const rowIndices = Object.keys(rows)
      .map(Number)
      .sort((a, b) => a - b);

    const standardCols = busType === BusType.CABIN ? 2 : 3;

    let gridRows: number[] = [];
    let benchRowIndex: number | null = null;

    rowIndices.forEach((r) => {
      const seatsInRow = rows[r];
      if (seatsInRow.length > standardCols) {
        benchRowIndex = r;
      } else {
        gridRows.push(r);
      }
    });

    // Determine deck width based on columns + detailed card size
    // 3 cols * 140px + gaps ~= 450px
    const deckWidthClass =
      busType === BusType.CABIN ? "w-full md:w-1/2" : "w-full md:w-1/2";

    return (
      <div
        className={`
        relative overflow-hidden flex flex-col
        ${deckWidthClass}
      `}
      >
        {/* Header */}
        <div className="pt-3 text-center">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            TẦNG {floorNumber}
          </span>
        </div>

        <div className="p-4 flex flex-col items-center flex-1">
          {/* Main Grid */}
          <div
            className="grid gap-3 w-full"
            style={{
              gridTemplateColumns: `repeat(${standardCols}, 1fr)`,
            }}
          >
            {gridRows.map((rowIndex) => {
              const rowSeats = rows[rowIndex].sort(
                (a, b) => (a.col ?? 0) - (b.col ?? 0)
              );
              return rowSeats.map((seat) => (
                <React.Fragment key={seat.id}>
                  {renderSeat(seat, false)}
                </React.Fragment>
              ));
            })}
          </div>

          {/* Bench Row */}
          {benchRowIndex !== null && (
            <div className="mt-4 pt-3 border-t border-slate-100 border-dashed w-full">
              <div className="flex justify-center gap-2 flex-wrap">
                {rows[benchRowIndex]
                  .sort((a, b) => (a.col ?? 0) - (b.col ?? 0))
                  .map((seat) => renderSeat(seat, true))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex overflow-x-auto">
      <div className="w-full flex gap-4 md:gap-8">
        {renderDeck(1)}
        {renderDeck(2)}
      </div>
    </div>
  );
};
