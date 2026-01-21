import React from "react";
import { Seat, SeatStatus, BusType, Booking, Bus } from "../../types";
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
  RefreshCw,
} from "lucide-react";
import { formatCurrency } from "../../utils/formatters";
import { generateSeatsFromLayout } from "../../utils/seatUtils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/Collapsible";

interface SeatMapProps {
  seats?: Seat[];
  bus?: Bus;
  busType: BusType;
  onSeatClick: (seat: Seat) => void;
  bookings?: Booking[];
  currentTripId?: string;
  onSeatSwap?: (seat: Seat) => void;
  onSeatRightClick?: (seat: Seat, booking: Booking | null) => void;
  editingBooking?: Booking | null;
  swapSourceSeatId?: string;
}

export const SeatMap: React.FC<SeatMapProps> = ({
  seats: providedSeats,
  bus,
  busType,
  onSeatClick,
  bookings = [],
  currentTripId,
  onSeatSwap,
  onSeatRightClick,
  editingBooking,
  swapSourceSeatId,
}) => {
  // Generate seats if not provided, using bus config
  const seats = React.useMemo(() => {
    if (providedSeats && providedSeats.length > 0) return providedSeats;
    if (bus && bus.layoutConfig) {
      return generateSeatsFromLayout(bus.layoutConfig, 0, bus.type); // Price 0 as visual only
    }
    return [];
  }, [providedSeats, bus]);
  const getSeatStatusClass = (status: SeatStatus, isSwapping: boolean) => {
    if (isSwapping) {
      return "ring-4 ring-indigo-500 ring-offset-1 z-30 bg-indigo-50 border-indigo-500 shadow-xl cursor-pointer animate-pulse";
    }

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
        return "transition-colors bg-purple-50 border-purple-300 text-purple-900 cursor-pointer hover:bg-purple-100 hover:shadow-md";
      default:
        return "transition-colors bg-white border-slate-200";
    }
  };

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(
        7,
      )}`;
    }
    return phone;
  };

  const renderSeat = (
    seat: Seat,
    isBench: boolean = false,
    customWidth?: string,
  ) => {
    const isSwapping = swapSourceSeatId === seat.id;

    // DYNAMIC STATUS CALCULATION
    let currentStatus = SeatStatus.AVAILABLE;
    let currentBooking: Booking | undefined;
    let currentTicket: any;

    // Find if this seat is in any active booking for the current trip
    const activeBooking = bookings.find(
      (b) =>
        b.status !== "cancelled" &&
        b.items.some(
          (item) =>
            item.tripId === currentTripId &&
            item.seatIds.some((sid) => String(sid) === String(seat.id)),
        ),
    );

    if (activeBooking) {
      // Always populate data for display, even if deselected (ghost)
      currentBooking = activeBooking;
      const tripItem = activeBooking.items.find(
        (i) => i.tripId === currentTripId,
      );
      currentTicket = tripItem?.tickets?.find(
        (t) => String(t.seatId) === String(seat.id),
      );

      const isLocallyDeselected =
        editingBooking &&
        activeBooking.id === editingBooking.id &&
        seat.status === SeatStatus.AVAILABLE;

      if (!isLocallyDeselected) {
        // Determine status based on Ticket > Booking priority
        if (currentTicket?.status) {
          if (currentTicket.status === "payment")
            currentStatus = SeatStatus.SOLD;
          else if (currentTicket.status === "hold")
            currentStatus = SeatStatus.HELD;
          else currentStatus = SeatStatus.BOOKED;
        } else {
          // Fallback to booking status
          if (activeBooking.status === "payment")
            currentStatus = SeatStatus.SOLD;
          else if (activeBooking.status === "hold")
            currentStatus = SeatStatus.HELD;
          else currentStatus = SeatStatus.BOOKED;
        }
      }
    }

    // Override if seat is locally selected (client-side state)
    if (seat.status === SeatStatus.SELECTED) {
      currentStatus = SeatStatus.SELECTED;
    }

    const isGhost =
      currentStatus === SeatStatus.AVAILABLE &&
      editingBooking?.items.some(
        (item) =>
          item.tripId === currentTripId &&
          item.seatIds.some((sid) => String(sid) === String(seat.id)),
      );

    let statusClass = getSeatStatusClass(currentStatus, isSwapping);

    if (isGhost) {
      statusClass =
        "transition-all bg-slate-50/50 border-red-300 border-dashed text-slate-400 opacity-60 cursor-pointer hover:opacity-100 hover:bg-white hover:border-red-400 grayscale";
    }

    // Use currentStatus for info check instead of seat.status
    const hasInfo =
      (currentStatus === SeatStatus.BOOKED ||
        currentStatus === SeatStatus.SOLD ||
        currentStatus === SeatStatus.HELD ||
        isGhost) &&
      currentBooking &&
      activeBooking; // Use locally resolved activeBooking

    const booking = currentBooking; // Alias for legacy code below
    const bookingItem = booking
      ? booking.items.find((item) => item.tripId === currentTripId)
      : null;

    let formattedPhone = "";
    let groupIndex = 0;
    let groupTotal = 0;

    let displayPrice = 0;
    let displayPickup = booking?.passenger?.pickupPoint || "";
    let displayDropoff = booking?.passenger?.dropoffPoint || "";
    let displayNote = booking?.passenger?.note || "";
    let displayName = booking?.passenger?.name || "";
    let displayExactBed = false;

    if (hasInfo && booking && bookingItem) {
      const rawPhone = booking.passenger.phone;
      const normalizedPhone = rawPhone.replace(/\D/g, "");
      formattedPhone = formatPhone(normalizedPhone || rawPhone);
      groupTotal = bookingItem.seatIds.length;
      groupIndex =
        bookingItem.seatIds.findIndex(
          (sid) => String(sid) === String(seat.id),
        ) + 1;

      if (bookingItem.tickets && bookingItem.tickets.length > 0) {
        const ticket = bookingItem.tickets.find(
          (t) => String(t.seatId) === String(seat.id),
        );
        if (ticket) {
          displayPrice = ticket.price;
          displayPickup = ticket.pickup || displayPickup;
          displayDropoff = ticket.dropoff || displayDropoff;
          if (ticket.exactBed) displayExactBed = true;
          if (ticket.note !== undefined && ticket.note !== null)
            displayNote = ticket.note;

          if (ticket.name) displayName = ticket.name;
          if (ticket.phone) {
            const tPhone = ticket.phone.replace(/\D/g, "");
            formattedPhone = formatPhone(tPhone || ticket.phone);
          }
        }
      }
    }

    const isFloor = seat.isFloorSeat;

    return (
      <div
        key={seat.id}
        onClick={() => onSeatClick({ ...seat, status: currentStatus })}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (onSeatRightClick) {
            if (hasInfo && booking) {
              onSeatRightClick({ ...seat, status: currentStatus }, booking);
            } else if (currentStatus === SeatStatus.HELD) {
              onSeatRightClick({ ...seat, status: currentStatus }, null);
            }
          }
        }}
        className={`relative flex flex-col border transition-all duration-200 select-none overflow-hidden group ${statusClass} ${
          customWidth
            ? customWidth
            : isBench
              ? "w-1/5 min-h-22.5 md:h-25 rounded-lg"
              : "w-full min-h-22.5 md:h-25 rounded-lg"
        } 
        `}
      >
        <div
          className={`px-2 py-1 text-[10px] font-bold border-b flex justify-between items-center whitespace-nowrap ${
            isSwapping
              ? "bg-indigo-600 text-white border-indigo-700"
              : currentStatus === SeatStatus.SELECTED
                ? "border-primary/50 bg-primary/10"
                : isGhost
                  ? "border-red-200 bg-red-50 text-red-400"
                  : currentStatus === SeatStatus.BOOKED
                    ? "border-yellow-200 bg-yellow-100/50"
                    : currentStatus === SeatStatus.SOLD
                      ? "border-green-200 bg-green-100/50 text-green-900"
                      : currentStatus === SeatStatus.HELD
                        ? "border-purple-200 bg-purple-100/50 text-purple-800"
                        : "border-slate-100 bg-slate-50/50"
          }`}
        >
          <span className={isGhost ? "line-through decoration-red-400" : ""}>
            {seat.label}
          </span>
          {isSwapping && <RefreshCw size={10} className="animate-spin" />}
          {!isSwapping &&
            (currentStatus === SeatStatus.SOLD ||
              currentStatus === SeatStatus.BOOKED) && (
              <div className="mt-auto flex justify-end">
                {displayPrice > 0 ? (
                  <span
                    className={`text-[9px] md:text-[10px] font-bold px-1 rounded border shadow-sm ${
                      currentStatus === SeatStatus.SOLD
                        ? "text-green-700 bg-yellow-300 border-green-200/50"
                        : "text-yellow-800 bg-yellow-200 border-yellow-300/50"
                    }`}
                  >
                    {formatCurrency(displayPrice)}
                  </span>
                ) : (
                  displayExactBed && (
                    <span className="text-[9px] md:text-[10px] font-normal px-1 rounded border shadow-sm text-white bg-amber-300 border-amber-500">
                      Xếp đúng
                    </span>
                  )
                )}
              </div>
            )}
          {!isSwapping && currentStatus === SeatStatus.SELECTED && (
            <Check size={10} strokeWidth={4} />
          )}
          {isGhost && <XCircle size={10} className="text-red-400" />}
        </div>

        {(currentStatus === SeatStatus.BOOKED ||
          currentStatus === SeatStatus.SOLD ||
          currentStatus === SeatStatus.HELD) &&
          !isGhost &&
          onSeatSwap &&
          !isSwapping && (
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
          {isSwapping ? (
            <div className="flex flex-col items-center justify-center h-full text-indigo-700 font-bold gap-1">
              <ArrowRightLeft size={16} />
              <span className="uppercase text-[8px] tracking-tighter">
                Đang đổi chỗ
              </span>
            </div>
          ) : hasInfo ? (
            currentStatus === SeatStatus.HELD ? (
              <div className="flex flex-col h-full text-purple-800/80 items-center justify-center">
                {displayNote ? (
                  <span className="truncate italic text-[10px] block text-center">
                    {displayNote}
                  </span>
                ) : (
                  <div className="flex items-center justify-center">
                    <Lock size={10} className="opacity-60 mr-1" />
                    <span className="font-bold text-[10px]">ĐANG GIỮ</span>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div
                  className={`flex items-center gap-1 font-bold whitespace-nowrap ${
                    isGhost
                      ? "text-slate-400"
                      : currentStatus === SeatStatus.SOLD
                        ? "text-green-800"
                        : "text-yellow-900"
                  }`}
                >
                  <Phone size={9} className="shrink-0 opacity-60" />
                  <div className="flex items-center gap-0.5 min-w-0">
                    <span className="truncate">{formattedPhone}</span>
                    {groupTotal > 1 && (
                      <span className="shrink-0 bg-white/50 px-0.5 rounded text-[8px] ml-0.5 font-normal border opacity-70">
                        {groupIndex}/{groupTotal}
                      </span>
                    )}
                  </div>
                </div>
                {displayName && displayName !== "Khách lẻ" && (
                  <div className="flex items-center gap-1 text-[9px] text-slate-500 font-medium overflow-hidden">
                    <User size={9} className="shrink-0 opacity-60" />
                    <span className="truncate">{displayName}</span>
                  </div>
                )}
                {displayPickup || displayDropoff ? (
                  <div
                    className={`flex gap-1 overflow-hidden whitespace-nowrap ${
                      isGhost
                        ? "text-slate-400"
                        : currentStatus === SeatStatus.SOLD
                          ? "text-green-700"
                          : "text-yellow-800"
                    }`}
                  >
                    <MapPin size={9} className="shrink-0 opacity-60" />
                    <span
                      className="truncate"
                      title={`${displayPickup} - ${displayDropoff}`}
                    >
                      {displayPickup || "---"} - {displayDropoff || "---"}
                    </span>
                  </div>
                ) : (
                  <div className="opacity-50 italic text-[8px]">
                    Chưa có điểm đón
                  </div>
                )}
                {displayNote && (
                  <div className="mt-2 flex items-center gap-1 text-slate-400 italic">
                    <StickyNote size={10} className="text-amber-500" />
                    <span className="w-full text-[10px] truncate">
                      {displayNote}
                    </span>
                  </div>
                )}
              </>
            )
          ) : currentStatus === SeatStatus.SELECTED ? (
            <div className="flex flex-col items-center justify-center h-full text-white/90">
              <span className="font-medium text-[8px]">Đang chọn</span>
            </div>
          ) : currentStatus === SeatStatus.HELD ? (
            <div className="flex flex-col h-full text-purple-800/80 items-center justify-center">
              <div className="flex items-center justify-center">
                <Lock size={10} className="opacity-60 mr-1" />
                <span className="font-bold text-[8px]">ĐANG GIỮ</span>
              </div>
              {(seat.note || displayNote) && (
                <div className="w-full bg-purple-100/80 rounded px-1 py-0.5 mt-1 border border-purple-200">
                  <span className="truncate italic text-[10px] block text-center">
                    {seat.note || displayNote}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-300">
              <span className="text-[8px] uppercase font-bold tracking-tighter">
                Trống
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const orphanSeats = seats.filter((s) => (s.row ?? 0) >= 99);
  const regularSeats = seats.filter((s) => (s.row ?? 0) < 99 && !s.isFloorSeat);
  const floorSeats = seats.filter((s) => s.isFloorSeat);

  const renderCabinColumn = (colIndex: number, label: string) => {
    const colSeats = regularSeats.filter((s) => (s.col ?? 0) === colIndex);
    const rows = Array.from(new Set(colSeats.map((s) => s.row ?? 0))).sort(
      (a: number, b: number) => a - b,
    );

    return (
      <div className="relative overflow-hidden flex flex-col w-full">
        <div className="text-center">
          <span className="text-xs font-black text-slate-500 uppercase tracking-widest">
            {label}
          </span>
        </div>

        <div className="md:p-3 flex flex-col items-center gap-3">
          <div className="flex gap-4 p-1.5 bg-slate-100 text-[9px] font-black text-slate-400 uppercase w-full justify-around rounded-lg">
            <span>Tầng 1</span>
            <span>Tầng 2</span>
          </div>

          {rows.map((rowIndex) => {
            const floor1Seat = colSeats.find(
              (s) => s.row === rowIndex && s.floor === 1,
            );
            const floor2Seat = colSeats.find(
              (s) => s.row === rowIndex && s.floor === 2,
            );

            return (
              <div key={rowIndex} className="flex w-full gap-3">
                <div className="w-1/2">
                  {floor1Seat ? (
                    renderSeat(floor1Seat)
                  ) : (
                    <div className="w-full border border-dashed border-slate-100 rounded-lg" />
                  )}
                </div>
                <div className="w-1/2">
                  {floor2Seat ? (
                    renderSeat(floor2Seat)
                  ) : (
                    <div className="w-full border border-dashed border-slate-100 rounded-lg" />
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
      <div className="relative overflow-hidden flex flex-col w-full">
        <div className="text-center hidden md:block">
          <span className="text-xs font-black text-white uppercase tracking-widest">
            SÀN
          </span>
        </div>
        <div className="bg-slate-50 border border-slate-200 md:border-none md:bg-transparent md:rounded-none rounded p-3 flex flex-col items-center gap-3">
          <div className="flex gap-4 p-1.5 bg-slate-200 md:bg-slate-100 text-[9px] font-black text-slate-400 uppercase w-full justify-around rounded-lg">
            <span>Sàn</span>
          </div>
          {floorSeats
            .sort((a, b) => (a.row ?? 0) - (b.row ?? 0))
            .map((seat) => (
              <div key={seat.id} className="w-full rounded-lg">
                {renderSeat(seat)}
              </div>
            ))}
        </div>
      </div>
    );
  };

  const renderSleeperDeck = (floorNumber: number) => {
    // -- IMPROVED LOGIC --
    // 1. Determine Grid vs Bench Rows based on isBench flag
    // 2. Determine Max Row to ensure we render all rows including empty ones

    const floorSeatsStandard = regularSeats.filter(
      (s) => s.floor === floorNumber,
    );
    const standardCols = 3;

    let maxRow = 0;
    // We can try to use bus config rows if available for perfect spacing
    if (bus?.layoutConfig?.rows) {
      maxRow = bus.layoutConfig.rows - 1; // 0-indexed
    } else {
      // Fallback to max row found in seats
      regularSeats.forEach((s) => {
        if ((s.row ?? 0) > maxRow) maxRow = s.row ?? 0;
      });
    }

    const gridRows: number[] = [];
    let benchRowIndex: number | null = null;

    // Group by row
    const rows: Record<number, Seat[]> = {};
    floorSeatsStandard.forEach((s) => {
      const r = s.row ?? 0;
      if (!rows[r]) rows[r] = [];
      rows[r].push(s);
    });

    // Check for explicit bench row (marked in util)
    Object.keys(rows).forEach((rKey) => {
      const r = Number(rKey);
      if (rows[r].some((s) => s.isBench)) {
        benchRowIndex = r;
      }
    });

    // If bench not found by flag, fallback to logic: row > maxRow (assumed bench at end)
    // Actually seatUtils puts bench at config.rows. Regular rows are 0..config.rows-1.
    // So if we found a row index > config.rows-1, it's a bench.
    // If bench not found by flag, fallback to logic: row > maxRow (assumed bench at end)
    if (benchRowIndex === null) {
      if (
        (bus?.layoutConfig?.benchFloors?.includes(floorNumber) ||
          (bus?.layoutConfig?.hasRearBench &&
            (!bus?.layoutConfig?.benchFloors ||
              bus.layoutConfig.benchFloors.length === 0))) &&
        bus?.layoutConfig?.rows !== undefined
      ) {
        // Explicit detection from Config
        benchRowIndex = bus.layoutConfig.rows;
      } else {
        Object.keys(rows).forEach((rKey) => {
          const r = Number(rKey);
          // Fallback detection: > 3 cols OR row index is the highest and > maxRow calculated from regular
          // Better: seatUtils guarantees bench is at `config.rows`.
          if (
            bus?.layoutConfig &&
            r >= bus.layoutConfig.rows &&
            rows[r].length > 0
          ) {
            benchRowIndex = r;
          } else if (rows[r].length > 3) {
            // Fallback legacy detection
            benchRowIndex = r;
          }
        });
      }
    }

    // Populate grid rows 0..maxRow
    for (let i = 0; i <= maxRow; i++) {
      // Only include if it's NOT the bench row
      if (i !== benchRowIndex) {
        gridRows.push(i);
      }
    }

    return (
      <div className="relative overflow-hidden flex flex-col w-full md:w-1/2">
        <div className="text-center">
          <span className="text-xs font-black text-slate-500 uppercase tracking-widest">
            TẦNG {floorNumber}
          </span>
        </div>

        <div className="md:p-4 flex flex-col items-center flex-1">
          <div
            className="grid gap-2 md:gap-3 w-full"
            style={{ gridTemplateColumns: `repeat(${standardCols}, 1fr)` }}
          >
            {gridRows.map((rowIndex) => {
              // Ensure we have a row entry even if empty
              const currentSeats = rows[rowIndex] || [];

              return [0, 1, 2].map((colIndex) => {
                const seat = currentSeats.find(
                  (s) => (s.col ?? 0) === colIndex,
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
                    className="w-full h-22.5 border border-slate-100 border-dashed rounded-lg bg-slate-50/20"
                  />
                );
              });
            })}
          </div>
          {benchRowIndex !== null && (
            <div className="mt-3 md:mt-4 pt-3 border-t border-slate-100 border-dashed w-full">
              <div className="flex justify-center gap-1.5 md:gap-2">
                {[0, 1, 2, 3, 4].map((colIndex) => {
                  const seat = rows[benchRowIndex!]?.find(
                    (s) => (s.col ?? 0) === colIndex,
                  );
                  if (seat) {
                    return (
                      <React.Fragment key={seat.id}>
                        {renderSeat(seat, true)}
                      </React.Fragment>
                    );
                  }
                  return (
                    <div
                      key={`bench-ghost-${floorNumber}-${colIndex}`}
                      className="w-1/5 min-h-22.5 md:h-25 rounded-lg border border-slate-100 border-dashed bg-slate-50/20"
                    />
                  );
                })}
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
          <h4 className="text-sm font-bold uppercase">
            Ghế lệch sơ đồ (Cần xếp lại)
          </h4>
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
    return (
      <div className="md:p-4 p-2 pt-2 bg-slate-50 rounded md:rounded-none">
        <div className="text-center mb-4 hidden md:block">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            SÀN
          </span>
        </div>
        <div className="flex justify-center">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 w-full">
            {floorSeats
              .sort((a, b) =>
                a.label.localeCompare(b.label, undefined, { numeric: true }),
              )
              .slice(0, 6)
              .map((s) =>
                renderSeat(s, false, "w-full h-[90px] rounded-lg shadow-sm"),
              )}
          </div>
        </div>
      </div>
    );
  };

  if (busType === BusType.CABIN) {
    return (
      <div className="flex flex-col p-3">
        <div className="flex flex-col md:flex-row w-full gap-2 md:gap-4 justify-center items-start">
          <div className="flex flex-col w-full md:w-2/5">
            {renderCabinColumn(0, "DÃY B")}
          </div>

          {/* Mobile: Collapsible Floor */}
          <div className="w-full md:hidden md:px-3 mt-3 md:mt-0">
            <Collapsible defaultOpen={false}>
              <CollapsibleTrigger className="bg-slate-50 hover:bg-indigo-100 p-2 rounded font-bold text-slate-500 text-[10px] uppercase tracking-wider w-full mb-2 flex justify-center border border-slate-200">
                <span>Ghế Sàn (Chạm để xem)</span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                {renderFloorColumn("SÀN")}
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* Desktop: Standard Floor */}
          <div className="hidden md:flex w-full md:w-1/5 justify-center">
            {renderFloorColumn("SÀN")}
          </div>

          <div className="flex flex-col w-full md:w-2/5">
            {renderCabinColumn(1, "DÃY A")}
          </div>
        </div>
        {renderOverflowSection()}
      </div>
    );
  }

  return (
    <div className="flex flex-col md:py-4 p-3 md:px-0">
      <div className="flex flex-col md:flex-row w-full gap-4 md:gap-6 justify-center items-start">
        {renderSleeperDeck(1)}
        {renderSleeperDeck(2)}
      </div>

      {/* Mobile: Collapsible Floor */}
      <div className="w-full md:hidden md:px-3 ">
        <Collapsible defaultOpen={false}>
          <CollapsibleTrigger className="bg-slate-50 hover:bg-indigo-100 p-2 rounded font-bold text-slate-500 text-[10px] uppercase tracking-wider w-full mb-2 flex justify-center border border-slate-200 mt-4">
            <span>Ghế Sàn (Chạm để xem)</span>
          </CollapsibleTrigger>
          <CollapsibleContent>{renderSleeperFloorSection()}</CollapsibleContent>
        </Collapsible>
      </div>

      {/* Desktop: Standard Floor */}
      <div className="hidden md:block">{renderSleeperFloorSection()}</div>

      {renderOverflowSection()}
    </div>
  );
};
