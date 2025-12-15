
import React from "react";
import { Seat, SeatStatus, BusType, Booking } from "../types";
import {
  User,
  Check,
  Phone,
  MapPin,
  StickyNote,
  MessageSquare,
  Lock,
} from "lucide-react";

interface SeatMapProps {
  seats: Seat[];
  busType: BusType;
  onSeatClick: (seat: Seat) => void;
  bookings?: Booking[];
  currentTripId?: string; // New prop to identify context
}

export const SeatMap: React.FC<SeatMapProps> = ({
  seats,
  busType,
  onSeatClick,
  bookings = [],
  currentTripId
}) => {
  // Helper to determine visuals based on status
  const getSeatStatusClass = (status: SeatStatus) => {
    switch (status) {
      case SeatStatus.AVAILABLE:
        return "bg-white border-slate-300 text-slate-400 hover:border-primary hover:text-primary hover:shadow-md cursor-pointer hover:bg-slate-50";
      case SeatStatus.SELECTED:
        return "bg-primary border-primary text-white shadow-md transform scale-105 cursor-pointer z-10";
      case SeatStatus.BOOKED:
        return "bg-yellow-50 border-yellow-300 text-yellow-900 cursor-pointer hover:bg-yellow-100"; 
      case SeatStatus.SOLD:
        return "bg-slate-100 border-slate-300 text-slate-600 cursor-not-allowed";
      case SeatStatus.HELD:
        return "bg-purple-50 border-purple-300 text-purple-900 cursor-pointer hover:bg-purple-100";
      default:
        return "bg-white border-slate-200";
    }
  };

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(
        7
      )}`;
    }
    return phone;
  };

  const renderSeat = (seat: Seat, isBench: boolean = false) => {
    const statusClass = getSeatStatusClass(seat.status);
    
    // HELD seats are also interactive to potentially unlock them
    const isInteractive =
      seat.status === SeatStatus.AVAILABLE ||
      seat.status === SeatStatus.SELECTED ||
      seat.status === SeatStatus.BOOKED ||
      seat.status === SeatStatus.HELD;

    // FIND BOOKING INFO
    // Iterate through bookings, check nested items for currentTripId AND seatId
    const booking = bookings.find((b) => 
        b.items.some(item => item.tripId === currentTripId && item.seatIds.includes(seat.id)) 
        && b.status !== "cancelled"
    );
    
    // Find specific item info for grouping logic
    const bookingItem = booking ? booking.items.find(item => item.tripId === currentTripId) : null;

    const hasInfo = (seat.status === SeatStatus.BOOKED || seat.status === SeatStatus.SOLD) && booking && bookingItem;

    let formattedPhone = "";
    let groupIndex = 0;
    let groupTotal = 0;

    if (hasInfo && booking && bookingItem) {
      const rawPhone = booking.passenger.phone;
      const normalizedPhone = rawPhone.replace(/\D/g, "");
      formattedPhone = formatPhone(normalizedPhone || rawPhone);

      // Sibling logic based on current trip item
      groupTotal = bookingItem.seatIds.length;
      groupIndex = bookingItem.seatIds.indexOf(seat.id) + 1;
    }

    return (
      <div
        key={seat.id}
        onClick={() => isInteractive && onSeatClick(seat)}
        className={`relative flex flex-col border transition-all duration-200 select-none overflow-hidden ${statusClass} ${
          isBench ? "w-1/5 h-[100px] rounded-lg" : "w-full h-[100px] rounded-lg"
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
              : seat.status === SeatStatus.SOLD
              ? "border-slate-200 bg-slate-200/50"
              : seat.status === SeatStatus.HELD
              ? "border-purple-200 bg-purple-100/50"
              : "border-slate-100 bg-slate-50/50"
          }`}
        >
          <span>{seat.label}</span>
          {seat.status === SeatStatus.SELECTED && (
            <Check size={12} strokeWidth={4} />
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 p-2 flex flex-col text-[10px] leading-tight space-y-1.5">
          {hasInfo ? (
            <>
              {/* Passenger Phone */}
              <div
                className={`flex items-center gap-1.5 font-bold ${seat.status === SeatStatus.SOLD ? 'text-slate-700' : 'text-yellow-900'}`}
                title={booking.passenger.name}
              >
                <Phone size={10} className="shrink-0 opacity-60" />
                <div className="flex items-center gap-1 min-w-0">
                  <span className="truncate">{formattedPhone}</span>
                  {groupTotal > 1 && (
                    <span className="shrink-0 bg-white/50 text-inherit px-1 rounded text-[8px] font-normal leading-tight border border-current opacity-70">
                      {groupIndex}/{groupTotal}
                    </span>
                  )}
                </div>
              </div>

              {/* Route Info */}
              {booking.passenger.pickupPoint ||
              booking.passenger.dropoffPoint ? (
                <div className={`flex gap-1.5 ${seat.status === SeatStatus.SOLD ? 'text-slate-500' : 'text-yellow-800'}`}>
                  <MapPin size={10} className="shrink-0 opacity-60 mt-0.5" />
                  <div className="text-wrap">
                    <span
                      className="truncate text-wrap"
                      title={`${booking.passenger.pickupPoint} - ${booking.passenger.dropoffPoint}`}
                    >
                      {booking.passenger.pickupPoint || "---"} -{" "}
                      {booking.passenger.dropoffPoint || "---"}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="opacity-50 italic pl-4">
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
          ) : seat.status === SeatStatus.HELD ? (
            <div className="flex flex-col items-center justify-center h-full text-purple-800/80">
              <Lock size={16} className="mb-1 opacity-60" />
              <span className="font-medium text-[9px] text-center">Vé đang giữ</span>
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

  // --- CABIN LOGIC: RENDER BY COLUMN (DÃY) ---
  const renderCabinColumn = (colIndex: number, label: string) => {
    const colSeats = seats.filter((s) => (s.col ?? 0) === colIndex);
    const rows = Array.from(new Set(colSeats.map((s) => s.row ?? 0))).sort((a: number, b: number) => a - b);

    return (
      <div className="relative overflow-hidden flex flex-col w-full md:w-1/2 rounded-xl">
        <div className="pt-3 text-center">
          <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">{label}</span>
        </div>

        <div className="px-4 flex flex-col items-center gap-3">
          <div className="flex gap-4 md:gap-8 px-2 text-[10px] font-bold text-slate-400 uppercase w-full justify-center">
            <span className="w-full md:w-1/2 text-center">Tầng 1</span>
            <span className="w-full md:w-1/2 text-center">Tầng 2</span>
          </div>

          {rows.map((rowIndex) => {
            const floor1Seat = colSeats.find((s) => s.row === rowIndex && s.floor === 1);
            const floor2Seat = colSeats.find((s) => s.row === rowIndex && s.floor === 2);

            return (
              <div key={rowIndex} className="flex w-full gap-4">
                <div className="w-full md:w-1/2">
                  {floor1Seat ? renderSeat(floor1Seat) : <div className="w-full border border-dashed border-slate-100 rounded-lg" />}
                </div>
                <div className="w-full md:w-1/2">
                  {floor2Seat ? renderSeat(floor2Seat) : <div className="w-full h-[100px] border border-dashed border-slate-100 rounded-lg" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // --- SLEEPER LOGIC ---
  const renderSleeperDeck = (floorNumber: number) => {
    const floorSeats = seats.filter((s) => s.floor === floorNumber);
    const rows = floorSeats.reduce((acc, seat) => {
      const r = seat.row ?? 0;
      if (!acc[r]) acc[r] = [];
      acc[r].push(seat);
      return acc;
    }, {} as Record<number, Seat[]>);

    const rowIndices = Object.keys(rows).map(Number).sort((a, b) => a - b);
    const standardCols = 3;
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

    return (
      <div className="relative overflow-hidden flex flex-col w-full md:w-1/2">
        <div className="text-center">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">TẦNG {floorNumber}</span>
        </div>

        <div className="p-4 flex flex-col items-center flex-1">
          <div className="grid gap-3 w-full" style={{ gridTemplateColumns: `repeat(${standardCols}, 1fr)` }}>
            {gridRows.map((rowIndex) => {
              const rowSeats = rows[rowIndex].sort((a, b) => (a.col ?? 0) - (b.col ?? 0));
              return rowSeats.map((seat) => <React.Fragment key={seat.id}>{renderSeat(seat, false)}</React.Fragment>);
            })}
          </div>
          {benchRowIndex !== null && (
            <div className="mt-4 pt-3 border-t border-slate-100 border-dashed w-full">
              <div className="flex justify-center gap-2">
                {rows[benchRowIndex].sort((a, b) => (a.col ?? 0) - (b.col ?? 0)).map((seat) => renderSeat(seat, true))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (busType === BusType.CABIN) {
    return (
      <div className="flex overflow-x-auto py-2">
        <div className="w-full flex gap-4 justify-center">
          {renderCabinColumn(0, "DÃY B")}
          {renderCabinColumn(1, "DÃY A")}
        </div>
      </div>
    );
  }

  return (
    <div className="flex overflow-x-auto py-4">
      <div className="w-full flex gap-4">
        {renderSleeperDeck(1)}
        {renderSleeperDeck(2)}
      </div>
    </div>
  );
};