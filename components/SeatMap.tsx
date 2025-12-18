
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
  AlertTriangle,
  ArrowRightLeft,
  XCircle,
} from "lucide-react";

interface SeatMapProps {
  seats: Seat[];
  busType: BusType;
  onSeatClick: (seat: Seat) => void;
  bookings?: Booking[];
  currentTripId?: string; // New prop to identify context
  onSeatSwap?: (seat: Seat) => void; // New prop for direct swap trigger
  onSeatRightClick?: (seat: Seat, booking: Booking | null) => void; // UPDATED: allow null booking
  editingBooking?: Booking | null; // New prop to detect removed seats
}

export const SeatMap: React.FC<SeatMapProps> = ({
  seats,
  busType,
  onSeatClick,
  bookings = [],
  currentTripId,
  onSeatSwap,
  onSeatRightClick,
  editingBooking,
}) => {
  // Helper to determine visuals based on status
  const getSeatStatusClass = (status: SeatStatus) => {
    switch (status) {
      case SeatStatus.AVAILABLE:
        return "transition-colors bg-white border-slate-300 text-slate-400 hover:border-primary hover:text-primary hover:shadow-md cursor-pointer hover:bg-slate-50";
      case SeatStatus.SELECTED:
        return "transition-colors bg-primary border-primary text-white shadow-md cursor-pointer";
      case SeatStatus.BOOKED:
        return "transition-colors bg-yellow-50 border-yellow-300 text-yellow-900 cursor-pointer hover:bg-yellow-100";
      case SeatStatus.SOLD:
        return "transition-colors bg-green-50 border-green-300 text-green-900 cursor-pointer hover:bg-green-100";
      case SeatStatus.HELD:
        return "transition-colors bg-purple-50 border-purple-300 text-purple-900 cursor-pointer hover:bg-purple-100 hover:shadow-md"; // Added hover effects
      default:
        return "transition-colors bg-white border-slate-200";
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

  const renderSeat = (seat: Seat, isBench: boolean = false, customWidth?: string) => {
    // 1. Detect if this seat is a "Ghost" (Deselected during edit)
    const isGhost =
      seat.status === SeatStatus.AVAILABLE &&
      editingBooking?.items.some(
        (item) =>
          item.tripId === currentTripId && item.seatIds.includes(seat.id)
      );

    let statusClass = getSeatStatusClass(seat.status);

    if (isGhost) {
      statusClass =
        "transition-all bg-slate-50/50 border-red-300 border-dashed text-slate-400 opacity-60 cursor-pointer hover:opacity-100 hover:bg-white hover:border-red-400 grayscale";
    }

    const isInteractive = true;

    const booking = bookings.find(
      (b) =>
        b.items.some(
          (item) =>
            item.tripId === currentTripId && item.seatIds.includes(seat.id)
        ) && b.status !== "cancelled"
    );

    const bookingItem = booking
      ? booking.items.find((item) => item.tripId === currentTripId)
      : null;

    const hasInfo =
      (seat.status === SeatStatus.BOOKED ||
        seat.status === SeatStatus.SOLD ||
        isGhost) &&
      booking &&
      bookingItem;

    let formattedPhone = "";
    let groupIndex = 0;
    let groupTotal = 0;

    let displayPrice = seat.price;
    let displayPickup = booking?.passenger?.pickupPoint || "";
    let displayDropoff = booking?.passenger?.dropoffPoint || "";

    if (hasInfo && booking && bookingItem) {
      const rawPhone = booking.passenger.phone;
      const normalizedPhone = rawPhone.replace(/\D/g, "");
      formattedPhone = formatPhone(normalizedPhone || rawPhone);
      groupTotal = bookingItem.seatIds.length;
      groupIndex = bookingItem.seatIds.indexOf(seat.id) + 1;

      if (bookingItem.tickets && bookingItem.tickets.length > 0) {
        const ticket = bookingItem.tickets.find((t) => t.seatId === seat.id);
        if (ticket) {
          displayPrice = ticket.price;
          displayPickup = ticket.pickup || displayPickup;
          displayDropoff = ticket.dropoff || displayDropoff;
        }
      } else if (bookingItem.price > 0 && bookingItem.seatIds.length > 0) {
        displayPrice = bookingItem.price / bookingItem.seatIds.length;
      }
    }

    const isFloor = seat.isFloorSeat;

    return (
      <div
        key={seat.id}
        onClick={() => isInteractive && onSeatClick(seat)}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (onSeatRightClick) {
            if (hasInfo && booking) {
              onSeatRightClick(seat, booking);
            } else if (seat.status === SeatStatus.HELD) {
              onSeatRightClick(seat, null);
            }
          }
        }}
        className={`relative flex flex-col border transition-all duration-200 select-none overflow-hidden group ${statusClass} ${
          customWidth ? customWidth : (isBench ? "w-1/5 min-h-[90px] md:h-[100px] rounded-lg" : "w-full min-h-[90px] md:h-[100px] rounded-lg")
        } ${isFloor ? 'border-dashed border-2' : ''}
        `}
      >
        <div
          className={`px-2 py-1 text-[10px] font-bold border-b flex justify-between items-center whitespace-nowrap ${
            seat.status === SeatStatus.SELECTED
              ? "border-primary/50 bg-primary/10"
              : isGhost
              ? "border-red-200 bg-red-50 text-red-400"
              : seat.status === SeatStatus.BOOKED
              ? "border-yellow-200 bg-yellow-100/50"
              : seat.status === SeatStatus.SOLD
              ? "border-green-200 bg-green-100/50 text-green-900"
              : seat.status === SeatStatus.HELD
              ? "border-purple-200 bg-purple-100/50 text-purple-800"
              : "border-slate-100 bg-slate-50/50"
          }`}
        >
          <span className={isGhost ? "line-through decoration-red-400" : ""}>
            {seat.label}
          </span>
          {seat.status === SeatStatus.SOLD && displayPrice > 0 && (
            <div className="mt-auto flex justify-end">
              <span className="text-[9px] md:text-[10px] font-bold px-1 rounded border shadow-sm text-green-700 bg-yellow-300 border-green-200/50">
                {displayPrice.toLocaleString("vi-VN")}
              </span>
            </div>
          )}
          {seat.status === SeatStatus.SELECTED && (
            <Check size={10} strokeWidth={4} />
          )}
          {isGhost && <XCircle size={10} className="text-red-400" />}
        </div>

        {(seat.status === SeatStatus.BOOKED ||
          seat.status === SeatStatus.SOLD ||
          seat.status === SeatStatus.HELD) &&
          !isGhost &&
          onSeatSwap && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSeatSwap(seat);
              }}
              className="absolute top-7 right-1 z-20 p-1 bg-white/80 hover:bg-indigo-600 hover:text-white text-indigo-600 rounded-full shadow-sm border border-indigo-100 md:opacity-0 group-hover:opacity-100 transition-all duration-200 transform scale-75 hover:scale-100"
              title="Đổi ghế này"
            >
              <ArrowRightLeft size={12} />
            </button>
          )}

        <div className="flex-1 p-1 flex flex-col text-[9px] md:text-[10px] leading-tight space-y-1">
          {hasInfo ? (
            <>
              <div
                className={`flex items-center gap-1 font-bold whitespace-nowrap ${
                  isGhost
                    ? "text-slate-400"
                    : seat.status === SeatStatus.SOLD
                    ? "text-green-800"
                    : "text-yellow-900"
                }`}
              >
                <Phone size={9} className="shrink-0 opacity-60" />
                <div className="flex items-center gap-0.5 min-w-0">
                  <span className="truncate">{formattedPhone}</span>
                  {groupTotal > 1 && (
                    <span className="shrink-0 bg-white/50 px-0.5 rounded text-[7px] font-normal border opacity-70">
                      {groupIndex}/{groupTotal}
                    </span>
                  )}
                </div>
              </div>

              {displayPickup || displayDropoff ? (
                <div
                  className={`flex gap-1 overflow-hidden whitespace-nowrap ${
                    isGhost
                      ? "text-slate-400"
                      : seat.status === SeatStatus.SOLD
                      ? "text-green-700"
                      : "text-yellow-800"
                  }`}
                >
                  <MapPin size={9} className="shrink-0 opacity-60" />
                  <span className="truncate" title={`${displayPickup} - ${displayDropoff}`}>
                    {displayPickup || "---"} - {displayDropoff || "---"}
                  </span>
                </div>
              ) : (
                <div className="opacity-50 italic text-[8px]">Chưa có điểm đón</div>
              )}
            </>
          ) : seat.status === SeatStatus.SELECTED ? (
            <div className="flex flex-col items-center justify-center h-full text-white/90">
              <Check size={18} />
              <span className="font-medium text-[8px]">Đang chọn</span>
            </div>
          ) : seat.status === SeatStatus.HELD ? (
            <div className="flex flex-col h-full text-purple-800/80 items-center justify-center">
              <div className="flex items-center justify-center">
                <Lock size={10} className="opacity-60 mr-1" />
                <span className="font-bold text-[8px]">ĐANG GIỮ</span>
              </div>
              {seat.note && (
                <div className="w-full bg-purple-100/80 rounded px-1 py-0.5 mt-1 border border-purple-200">
                    <span className="truncate italic text-[8px] block">{seat.note}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-300">
              <span className="text-[8px] uppercase font-bold tracking-tighter">{isFloor ? 'SÀN' : 'Trống'}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const orphanSeats = seats.filter((s) => (s.row ?? 0) >= 99);
  const regularSeats = seats.filter((s) => (s.row ?? 0) < 99 && !s.isFloorSeat);
  const floorSeats = seats.filter((s) => s.isFloorSeat);

  // --- CABIN LOGIC ---
  const renderCabinColumn = (colIndex: number, label: string) => {
    const colSeats = regularSeats.filter((s) => (s.col ?? 0) === colIndex);
    const rows = Array.from(new Set(colSeats.map((s) => s.row ?? 0))).sort(
      (a: number, b: number) => a - b
    );

    return (
      <div className="relative overflow-hidden flex flex-col w-full md:w-[300px] bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="py-2 text-center bg-slate-50 border-b">
          <span className="text-xs font-black text-slate-500 uppercase tracking-widest">
            {label}
          </span>
        </div>

        <div className="p-3 flex flex-col items-center gap-3">
          <div className="flex gap-4 p-1.5 bg-slate-100 text-[9px] font-black text-slate-400 uppercase w-full justify-around rounded-lg">
            <span>Dãy ngoài</span>
            <span>Dãy trong</span>
          </div>

          {rows.map((rowIndex) => {
            const floor1Seat = colSeats.find(
              (s) => s.row === rowIndex && s.floor === 1
            );
            const floor2Seat = colSeats.find(
              (s) => s.row === rowIndex && s.floor === 2
            );

            return (
              <div key={rowIndex} className="flex w-full gap-3">
                <div className="w-1/2">
                  {floor1Seat ? (
                    renderSeat(floor1Seat)
                  ) : (
                    <div className="w-full h-[90px] border border-dashed border-slate-100 rounded-lg" />
                  )}
                </div>
                <div className="w-1/2">
                  {floor2Seat ? (
                    renderSeat(floor2Seat)
                  ) : (
                    <div className="w-full h-[90px] border border-dashed border-slate-100 rounded-lg" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderFloorColumn = (title: string = "DÃY SÀN") => {
    return (
        <div className="relative overflow-hidden flex flex-col w-full md:w-[120px] bg-slate-100/50 rounded-xl border-2 border-dashed border-slate-300">
             <div className="py-2 text-center bg-slate-200/50 border-b border-dashed border-slate-300">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</span>
             </div>
             <div className="p-3 flex flex-col items-center gap-3">
                {floorSeats.sort((a,b) => (a.row ?? 0) - (b.row ?? 0)).map(seat => (
                    <div key={seat.id} className="w-full h-[90px] flex justify-center">
                        {renderSeat(seat)}
                    </div>
                ))}
                {floorSeats.length === 0 && <div className="py-20 text-[9px] text-slate-300 font-bold uppercase -rotate-90 whitespace-nowrap">Lối đi</div>}
             </div>
        </div>
    );
  };

  // --- SLEEPER LOGIC ---
  const renderSleeperDeck = (floorNumber: number) => {
    const floorSeatsStandard = regularSeats.filter((s) => s.floor === floorNumber);
    const rows = floorSeatsStandard.reduce((acc, seat) => {
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
      <div className="relative overflow-hidden flex flex-col w-full md:w-1/2 bg-white rounded-xl border border-slate-200 shadow-sm mb-4 md:mb-0">
        <div className="py-2 text-center bg-slate-50 border-b">
          <span className="text-xs font-black text-slate-500 uppercase tracking-widest">
            TẦNG {floorNumber}
          </span>
        </div>

        <div className="p-3 md:p-4 flex flex-col items-center flex-1">
          <div
            className="grid gap-2 md:gap-3 w-full"
            style={{ gridTemplateColumns: `repeat(${standardCols}, 1fr)` }}
          >
            {gridRows.map((rowIndex) => {
              return [0, 1, 2].map((colIndex) => {
                const seat = rows[rowIndex].find(
                  (s) => (s.col ?? 0) === colIndex
                );

                if (seat) {
                  return (
                    <React.Fragment key={seat.id}>
                      {renderSeat(seat, false)}
                    </React.Fragment>
                  );
                }

                return (
                  <div
                    key={`ghost-${floorNumber}-${rowIndex}-${colIndex}`}
                    className="w-full h-[90px] border border-slate-100 border-dashed rounded-lg bg-slate-50/20"
                  />
                );
              });
            })}
          </div>
          {benchRowIndex !== null && (
            <div className="mt-3 md:mt-4 pt-3 border-t border-slate-100 border-dashed w-full">
              <div className="flex justify-center gap-1.5 md:gap-2">
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

  const renderOverflowSection = () => {
    if (orphanSeats.length === 0) return null;
    return (
      <div className="mt-6 mx-2 md:mx-4 p-4 bg-amber-50 rounded-xl border border-amber-200 border-dashed animate-in fade-in slide-in-from-top-2">
        <div className="flex items-center gap-2 mb-3 text-amber-700">
          <AlertTriangle size={16} />
          <h4 className="text-sm font-bold uppercase">Ghế lệch sơ đồ (Cần xếp lại)</h4>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {orphanSeats.map((seat) => (
            <div key={seat.id} className="w-full">
              {renderSeat(seat)}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderSleeperFloorSection = () => {
    if (floorSeats.length === 0) return null;
    return (
        <div className="mt-6 p-4 bg-slate-100/50 rounded-xl border-2 border-dashed border-slate-300">
            <div className="text-center mb-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">DÃY VÉ SÀN NẰM (GIỮA LỐI ĐI)</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 justify-items-center">
                {floorSeats.sort((a,b) => a.label.localeCompare(b.label, undefined, {numeric: true})).map(s => (
                    <div key={s.id} className="w-full max-w-[100px]">
                        {renderSeat(s, false, "w-full h-[85px] rounded-lg shadow-sm")}
                    </div>
                ))}
            </div>
        </div>
    );
  };

  if (busType === BusType.CABIN) {
    return (
      <div className="flex flex-col py-4 px-2 md:px-0">
        <div className="flex flex-col md:flex-row w-full gap-4 md:gap-8 justify-center items-start">
          {renderCabinColumn(0, "DÃY B (PHÒNG LẺ)")}
          {renderFloorColumn("6 VÉ SÀN")}
          {renderCabinColumn(1, "DÃY A (PHÒNG CHẴN)")}
        </div>
        {renderOverflowSection()}
      </div>
    );
  }

  return (
    <div className="flex flex-col py-4 px-2 md:px-0">
      <div className="flex flex-col md:flex-row w-full gap-4 md:gap-6 justify-center items-start">
        {renderSleeperDeck(1)}
        {renderSleeperDeck(2)}
      </div>
      {renderSleeperFloorSection()}
      {renderOverflowSection()}
    </div>
  );
};
