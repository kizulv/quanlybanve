
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
        return "transition-colors bg-primary border-primary text-white shadow-md cursor-pointer z-10";
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

  const renderSeat = (seat: Seat, isBench: boolean = false) => {
    // 1. Detect if this seat is a "Ghost" (Deselected during edit)
    // It is AVAILABLE now, but was originally in the editingBooking for this trip
    const isGhost =
      seat.status === SeatStatus.AVAILABLE &&
      editingBooking?.items.some(
        (item) =>
          item.tripId === currentTripId && item.seatIds.includes(seat.id)
      );

    let statusClass = getSeatStatusClass(seat.status);

    // Override visual for Ghost seats
    if (isGhost) {
      statusClass =
        "transition-all bg-slate-50/50 border-red-300 border-dashed text-slate-400 opacity-60 cursor-pointer hover:opacity-100 hover:bg-white hover:border-red-400 grayscale";
    }

    // HELD and SOLD seats are also interactive now
    const isInteractive =
      seat.status === SeatStatus.AVAILABLE ||
      seat.status === SeatStatus.SELECTED ||
      seat.status === SeatStatus.BOOKED ||
      seat.status === SeatStatus.HELD ||
      seat.status === SeatStatus.SOLD;

    // FIND BOOKING INFO
    // Iterate through bookings, check nested items for currentTripId AND seatId
    const booking = bookings.find(
      (b) =>
        b.items.some(
          (item) =>
            item.tripId === currentTripId && item.seatIds.includes(seat.id)
        ) && b.status !== "cancelled"
    );

    // Find specific item info for grouping logic
    const bookingItem = booking
      ? booking.items.find((item) => item.tripId === currentTripId)
      : null;

    // If it's a ghost seat, we still want to show the original info (which exists in `booking` since we haven't saved yet)
    const hasInfo =
      (seat.status === SeatStatus.BOOKED ||
        seat.status === SeatStatus.SOLD ||
        isGhost) &&
      booking &&
      bookingItem;

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
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (onSeatRightClick) {
             if (hasInfo && booking) {
                onSeatRightClick(seat, booking);
             } else if (seat.status === SeatStatus.HELD) {
                // Allow right clicking on HELD seats (no booking)
                onSeatRightClick(seat, null);
             }
          }
        }}
        className={`relative flex flex-col border transition-all duration-200 select-none overflow-hidden group ${statusClass} ${
          isBench ? "w-1/5 h-[100px] rounded-lg" : "w-full h-[100px] rounded-lg"
        }
        `}
      >
        {/* Header: Seat Label */}
        <div
          className={`px-2 py-1 text-xs font-bold border-b flex justify-between items-center ${
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
          {/* PRICE DISPLAY FOR SOLD SEATS */}
          {(seat.status === SeatStatus.SOLD || isGhost) && (
            <div className="mt-auto flex justify-end">
              <span className="text-[10px] font-bold text-green-700 bg-yellow-300 px-1 rounded border border-green-200/50 shadow-sm">
                {seat.price.toLocaleString("vi-VN")}
              </span>
            </div>
          )}
          {seat.status === SeatStatus.SELECTED && (
            <Check size={12} strokeWidth={4} />
          )}
          {isGhost && <XCircle size={12} className="text-red-400" />}
        </div>

        {/* SWAP ICON OVERLAY (Only for Booked/Sold/Held and NOT Ghost) */}
        {(seat.status === SeatStatus.BOOKED ||
          seat.status === SeatStatus.SOLD ||
          seat.status === SeatStatus.HELD) &&
          !isGhost &&
          onSeatSwap && (
            <button
              onClick={(e) => {
                e.stopPropagation(); // Prevent opening booking details
                onSeatSwap(seat);
              }}
              className="absolute top-8 right-1 z-20 p-1.5 bg-white/80 hover:bg-indigo-600 hover:text-white text-indigo-600 rounded-full shadow-sm border border-indigo-100 opacity-0 group-hover:opacity-100 transition-all duration-200 transform scale-75 hover:scale-100"
              title="Đổi ghế này"
            >
              <ArrowRightLeft size={14} />
            </button>
          )}

        {/* Content Body */}
        <div className="flex-1 p-2 flex flex-col text-[10px] leading-tight space-y-1.5">
          {hasInfo ? (
            <>
              {/* Passenger Phone */}
              <div
                className={`flex items-center gap-1.5 font-bold ${
                  isGhost
                    ? "text-slate-400"
                    : seat.status === SeatStatus.SOLD
                    ? "text-green-800"
                    : "text-yellow-900"
                }`}
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
                <div
                  className={`flex gap-1.5 ${
                    isGhost
                      ? "text-slate-400"
                      : seat.status === SeatStatus.SOLD
                      ? "text-green-700"
                      : "text-yellow-800"
                  }`}
                >
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
                <div className="opacity-50 italic pl-4">Chưa có điểm đón</div>
              )}

              {/* Note */}
              {booking.passenger.note && (
                <div
                  className={`flex items-center gap-1.5 truncate ${
                    isGhost ? "text-slate-400" : "text-orange-600"
                  }`}
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
            <div className="flex flex-col h-full text-purple-800/80 items-center justify-center">
              <div className="flex items-center justify-center mb-1">
                 <Lock size={14} className="opacity-60 mr-1" />
                 <span className="font-bold text-[10px]">ĐANG GIỮ</span>
              </div>
              {seat.note ? (
                 <div className="w-full bg-purple-100/80 rounded px-1 py-1 mt-1 border border-purple-200">
                    <div className="flex items-start gap-1 text-[9px]">
                        <StickyNote size={8} className="shrink-0 mt-0.5 opacity-70"/>
                        <span className="truncate-2-lines leading-tight italic" title={seat.note}>
                           {seat.note}
                        </span>
                    </div>
                 </div>
              ) : (
                <span className="font-medium text-[9px] text-center opacity-50">
                    (Không có ghi chú)
                </span>
              )}
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

  // Identify "Orphaned" seats (seats with row 99 from changing buses)
  const orphanSeats = seats.filter((s) => (s.row ?? 0) >= 99);
  // Filter regular seats
  const regularSeats = seats.filter((s) => (s.row ?? 0) < 99);

  // --- CABIN LOGIC: RENDER BY COLUMN (DÃY) ---
  const renderCabinColumn = (colIndex: number, label: string) => {
    const colSeats = regularSeats.filter((s) => (s.col ?? 0) === colIndex);
    const rows = Array.from(new Set(colSeats.map((s) => s.row ?? 0))).sort(
      (a: number, b: number) => a - b
    );

    return (
      <div className="relative overflow-hidden flex flex-col w-full md:w-1/2 rounded-xl">
        <div className="pt-3 text-center">
          <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">
            {label}
          </span>
        </div>

        <div className="px-4 flex flex-col items-center gap-3">
          <div className="flex gap-4 md:gap-8 px-2 text-[10px] font-bold text-slate-400 uppercase w-full justify-center">
            <span className="w-full md:w-1/2 text-center">Tầng 1</span>
            <span className="w-full md:w-1/2 text-center">Tầng 2</span>
          </div>

          {rows.map((rowIndex) => {
            const floor1Seat = colSeats.find(
              (s) => s.row === rowIndex && s.floor === 1
            );
            const floor2Seat = colSeats.find(
              (s) => s.row === rowIndex && s.floor === 2
            );

            return (
              <div key={rowIndex} className="flex w-full gap-4">
                <div className="w-full md:w-1/2">
                  {floor1Seat ? (
                    renderSeat(floor1Seat)
                  ) : (
                    <div className="w-full border border-dashed border-slate-100 rounded-lg" />
                  )}
                </div>
                <div className="w-full md:w-1/2">
                  {floor2Seat ? (
                    renderSeat(floor2Seat)
                  ) : (
                    <div className="w-full h-[100px] border border-dashed border-slate-100 rounded-lg" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // --- SLEEPER LOGIC (UPDATED) ---
  const renderSleeperDeck = (floorNumber: number) => {
    const floorSeats = regularSeats.filter((s) => s.floor === floorNumber);
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
      <div className="relative overflow-hidden flex flex-col w-full md:w-1/2">
        <div className="text-center">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            TẦNG {floorNumber}
          </span>
        </div>

        <div className="p-4 flex flex-col items-center flex-1">
          <div
            className="grid gap-3 w-full"
            style={{ gridTemplateColumns: `repeat(${standardCols}, 1fr)` }}
          >
            {gridRows.map((rowIndex) => {
              // FORCE 3 COLUMNS: Iterate 0, 1, 2 to ensure alignment even if seat is missing
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

                // Render GHOST/PLACEHOLDER SEAT for proper grid alignment
                return (
                  <div
                    key={`ghost-${floorNumber}-${rowIndex}-${colIndex}`}
                    className="w-full h-[100px] border border-slate-100 border-dashed rounded-lg bg-slate-50/20"
                  />
                );
              });
            })}
          </div>
          {benchRowIndex !== null && (
            <div className="mt-4 pt-3 border-t border-slate-100 border-dashed w-full">
              <div className="flex justify-center gap-2">
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
      <div className="mt-6 mx-4 p-4 bg-amber-50 rounded-xl border border-amber-200 border-dashed animate-in fade-in slide-in-from-top-2">
        <div className="flex items-center gap-2 mb-3 text-amber-700">
          <AlertTriangle size={16} />
          <h4 className="text-sm font-bold uppercase">
            Ghế lệch sơ đồ (Do đổi xe) - Cần xếp lại
          </h4>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {orphanSeats.map((seat) => (
            <div key={seat.id} className="w-full">
              {renderSeat(seat)}
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (busType === BusType.CABIN) {
    return (
      <div className="flex flex-col py-2">
        <div className="flex overflow-x-auto w-full gap-4 justify-center">
          {renderCabinColumn(0, "DÃY B")}
          {renderCabinColumn(1, "DÃY A")}
        </div>
        {renderOverflowSection()}
      </div>
    );
  }

  return (
    <div className="flex flex-col py-4">
      <div className="flex overflow-x-auto w-full gap-4">
        {renderSleeperDeck(1)}
        {renderSleeperDeck(2)}
      </div>
      {renderOverflowSection()}
    </div>
  );
};
