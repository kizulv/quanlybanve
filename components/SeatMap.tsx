import React, { useMemo } from 'react';
import { Seat, SeatStatus, BusType } from '../types';
import { User, Check } from 'lucide-react';

interface SeatMapProps {
  seats: Seat[];
  busType: BusType;
  onSeatClick: (seat: Seat) => void;
}

export const SeatMap: React.FC<SeatMapProps> = ({ seats, busType, onSeatClick }) => {
  
  // Helper to determine visuals based on status
  const getSeatStatusClass = (status: SeatStatus) => {
    switch (status) {
      case SeatStatus.AVAILABLE:
        return 'bg-white border-slate-300 text-slate-400 hover:border-primary hover:text-primary hover:shadow-md cursor-pointer';
      case SeatStatus.SELECTED:
        return 'bg-primary border-primary text-white shadow-md transform scale-105 cursor-pointer z-10';
      case SeatStatus.BOOKED:
        return 'bg-yellow-50 border-yellow-400 text-yellow-700 cursor-not-allowed opacity-90';
      case SeatStatus.SOLD:
        return 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed';
      default:
        return 'bg-white border-slate-200';
    }
  };

  // Helper for shape based on Bus Type & Bench
  const getSeatShapeClass = (isBench: boolean) => {
    if (busType === BusType.CABIN) {
      return isBench ? 'w-10 h-10 rounded-md' : 'w-full h-16 rounded-lg'; // Cabin boxy shape
    }
    // Sleeper
    return isBench ? 'w-8 h-8 rounded-sm' : 'w-10 h-12 rounded-t-xl rounded-b-md'; 
  };

  const renderSeat = (seat: Seat, isBench: boolean = false) => {
    const statusClass = getSeatStatusClass(seat.status);
    const shapeClass = getSeatShapeClass(isBench);
    const isInteractive = seat.status === SeatStatus.AVAILABLE || seat.status === SeatStatus.SELECTED;

    return (
      <div
        key={seat.id}
        onClick={() => isInteractive && onSeatClick(seat)}
        title={`${seat.label} - ${seat.price.toLocaleString()}đ`}
        className={`
          relative flex flex-col items-center justify-center border transition-all duration-200 select-none
          ${statusClass} ${shapeClass}
        `}
      >
        {/* Status Icon / Text */}
        {seat.status === SeatStatus.SOLD ? (
          <User size={14} />
        ) : seat.status === SeatStatus.SELECTED ? (
          <Check size={16} strokeWidth={3} />
        ) : seat.status === SeatStatus.BOOKED ? (
          <User size={14} />
        ) : (
          <>
            <span className={`font-bold ${isBench ? 'text-[10px]' : 'text-xs'}`}>{seat.label}</span>
            {/* Visual Pillow for available/sleeper seats */}
            {!isBench && busType === BusType.SLEEPER && seat.status === SeatStatus.AVAILABLE && (
                 <div className="absolute top-1 w-1/2 h-0.5 bg-slate-200 rounded-full"></div>
            )}
          </>
        )}
      </div>
    );
  };

  // Render a single floor (Deck)
  const renderDeck = (floorNumber: number) => {
    const floorSeats = seats.filter(s => s.floor === floorNumber);
    
    // Calculate Grid Dimensions
    // We group seats by row to detect the grid structure
    const rows = floorSeats.reduce((acc, seat) => {
      const r = seat.row ?? 0;
      if (!acc[r]) acc[r] = [];
      acc[r].push(seat);
      return acc;
    }, {} as Record<number, Seat[]>);

    const rowIndices = Object.keys(rows).map(Number).sort((a, b) => a - b);
    
    // Determine which row is the "Bench" (Rear seats)
    // Heuristic: If Sleeper and row has 5 seats, or if it's the last row and has > cols
    const standardCols = busType === BusType.CABIN ? 2 : 3;
    
    let gridRows: number[] = [];
    let benchRowIndex: number | null = null;

    rowIndices.forEach(r => {
      const seatsInRow = rows[r];
      // Check if this looks like a bench (more seats than standard cols, typically 5 vs 3)
      if (seatsInRow.length > standardCols) {
        benchRowIndex = r;
      } else {
        gridRows.push(r);
      }
    });

    return (
      <div className={`
        bg-white rounded-2xl shadow-sm border border-slate-300 relative overflow-hidden flex flex-col
        ${busType === BusType.CABIN ? 'w-[160px] md:w-[180px]' : 'w-[140px] md:w-[160px]'}
      `}>
        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-100 py-3 text-center">
           <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">TẦNG {floorNumber}</span>
        </div>

        <div className="p-4 flex flex-col items-center flex-1">
            {/* Driver Icon (Only Floor 1) */}
            {floorNumber === 1 ? (
               <div className="mb-4 text-slate-300">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                     <circle cx="12" cy="12" r="10" />
                     <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                     <path d="M2 12h20" />
                  </svg>
               </div>
            ) : (
               <div className="mb-4 h-10 w-10"></div> // Spacer
            )}

            {/* Main Grid */}
            <div 
              className="grid gap-3"
              style={{
                gridTemplateColumns: `repeat(${standardCols}, 1fr)`,
              }}
            >
               {gridRows.map(rowIndex => {
                  const rowSeats = rows[rowIndex].sort((a, b) => (a.col ?? 0) - (b.col ?? 0));
                  return rowSeats.map(seat => (
                     <React.Fragment key={seat.id}>
                        {renderSeat(seat, false)}
                     </React.Fragment>
                  ));
               })}
            </div>

            {/* Bench Row */}
            {benchRowIndex !== null && (
               <div className="mt-4 pt-3 border-t border-slate-100 border-dashed w-full">
                  <div className="flex justify-center gap-1">
                     {rows[benchRowIndex]
                        .sort((a, b) => (a.col ?? 0) - (b.col ?? 0))
                        .map(seat => renderSeat(seat, true))
                     }
                  </div>
               </div>
            )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full flex justify-center py-4">
      <div className="flex gap-4 md:gap-8">
         {renderDeck(1)}
         {renderDeck(2)}
      </div>
    </div>
  );
};
