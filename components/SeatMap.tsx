import React from "react";
import { Seat, SeatStatus, BusType, Booking } from "../types";
import {
  Check,
  Phone,
  MapPin,
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
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
    }
    return phone;
  };

  const renderSeat = (seat: Seat, widthClass: string = "w-full min-w-[130px]") => {
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
          ${widthClass}
          h-[100px] rounded-lg
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
                    <span className="shrink-0 bg-slate-200 text-slate-600 px-1 rounded text-[8px] font-normal leading-tight ml-1">
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

  // --- LAYOUT FOR SLEEPER (Xe Giường: Xếp theo Tầng) ---
  const renderSleeperLayout = () => {
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
        <div className="bg-white rounded-2xl shadow-sm border border-slate-300 relative overflow-hidden flex flex-col w-full md:w-[460px]">
          {/* Header */}
          <div className="bg-slate-50 border-b border-slate-100 py-3 text-center">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              TẦNG {floorNumber}
            </span>
          </div>

          <div className="p-4 flex flex-col items-center flex-1">
             {/* Driver Icon Placeholder for Floor 1 */}
             {floorNumber === 1 && (
               <div className="mb-4 text-slate-300 opacity-50">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                     <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
                     <circle cx="7" cy="17" r="2" />
                     <path d="M9 17h6" />
                     <circle cx="17" cy="17" r="2" />
                  </svg>
               </div>
            )}
             
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
                    {renderSeat(seat)}
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
                    .map((seat) => renderSeat(seat, "w-[130px]"))}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    };

    return (
      <div className="flex overflow-x-auto justify-center">
        <div className="flex gap-4 md:gap-8 px-4">
          {renderDeck(1)}
          {renderDeck(2)}
        </div>
      </div>
    );
  };

  // --- LAYOUT FOR CABIN (Xe Phòng: Xếp theo Dãy B/A) ---
  const renderCabinLayout = () => {
    // Identify dimensions
    const maxCol = Math.max(...seats.map((s) => s.col ?? 0));
    const maxRow = Math.max(...seats.map((s) => s.row ?? 0));
    const cols = maxCol + 1; 
    const rows = maxRow + 1;

    // Helper to find seat
    const findSeat = (col: number, row: number, floor: number) => {
      return seats.find(
        (s) => (s.col ?? 0) === col && (s.row ?? 0) === row && s.floor === floor
      );
    };

    // Determine columns to render (e.g. 0 and 1)
    const columnsToRender = Array.from({ length: cols }, (_, i) => i);

    return (
      <div className="flex overflow-x-auto justify-center">
        <div className="flex gap-4 md:gap-8 px-4">
          {columnsToRender.map((colIndex) => {
            // Labeling: Col 0 -> Dãy B, Col 1 -> Dãy A (Standard Vietnamese bus layout)
            const colName =
              colIndex === 0
                ? "Dãy B"
                : colIndex === 1
                ? "Dãy A"
                : `Dãy ${String.fromCharCode(65 + colIndex)}`;

            return (
              <div
                key={colIndex}
                className="bg-white rounded-2xl shadow-sm border border-slate-300 relative overflow-hidden flex flex-col w-[300px] md:w-[340px]"
              >
                {/* Header */}
                <div className="bg-slate-50 border-b border-slate-100 py-3 text-center">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {colName}
                  </span>
                </div>

                {/* Sub Header for Floor */}
                <div className="grid grid-cols-2 text-[10px] font-bold text-slate-400 uppercase border-b border-slate-100 bg-slate-50/50">
                    <div className="text-center py-1.5 border-r border-slate-100">Dưới</div>
                    <div className="text-center py-1.5">Trên</div>
                </div>

                <div className="p-4 flex flex-col gap-3 flex-1">
                  {/* Rows */}
                  {Array.from({ length: rows }, (_, r) => {
                    const seatLower = findSeat(colIndex, r, 1);
                    const seatUpper = findSeat(colIndex, r, 2);

                    // Skip row if no seats exist in this row for this column
                    if (!seatLower && !seatUpper) return null;

                    return (
                      <div key={r} className="grid grid-cols-2 gap-3">
                         <div className="flex justify-center">
                            {seatLower ? renderSeat(seatLower, "w-full") : <div className="w-full h-[100px] border border-dashed border-slate-200 rounded-lg bg-slate-50/50"></div>}
                         </div>
                         <div className="flex justify-center">
                            {seatUpper ? renderSeat(seatUpper, "w-full") : <div className="w-full h-[100px] border border-dashed border-slate-200 rounded-lg bg-slate-50/50"></div>}
                         </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Decoration: Driver Wheel for Dãy B (Col 0) */}
                {colIndex === 0 && (
                   <div className="h-10 bg-slate-50 border-t border-slate-100 mt-auto flex justify-center items-center">
                       <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-300">
                         <circle cx="12" cy="12" r="10" />
                         <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                         <path d="M2 12h20" />
                       </svg>
                   </div>
                )}
                 {/* Empty footer for Dãy A to align heights if needed */}
                 {colIndex !== 0 && (
                   <div className="h-10 bg-slate-50 border-t border-slate-100 mt-auto"></div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full py-4">
      {busType === BusType.CABIN ? renderCabinLayout() : renderSleeperLayout()}
    </div>
  );
};
