import React from 'react';
import { Seat, SeatStatus, BusType } from '../types';
import { Check, User, X } from 'lucide-react';

interface SeatMapProps {
  seats: Seat[];
  busType: BusType;
  onSeatClick: (seat: Seat) => void;
}

const SeatItem: React.FC<{ seat: Seat; onClick: () => void }> = ({ seat, onClick }) => {
  const getStatusColor = (status: SeatStatus) => {
    switch (status) {
      case SeatStatus.AVAILABLE:
        return 'bg-white border-slate-300 text-slate-700 hover:border-primary hover:text-primary cursor-pointer';
      case SeatStatus.SELECTED:
        return 'bg-primary border-primary text-white cursor-pointer';
      case SeatStatus.BOOKED:
        return 'bg-yellow-100 border-yellow-400 text-yellow-700 cursor-not-allowed'; // Pending payment or reserved
      case SeatStatus.SOLD:
        return 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed';
      default:
        return 'bg-white';
    }
  };

  return (
    <div
      onClick={() => {
        if (seat.status === SeatStatus.AVAILABLE || seat.status === SeatStatus.SELECTED) {
          onClick();
        }
      }}
      className={`
        relative w-14 h-20 rounded-lg border-2 flex flex-col items-center justify-center m-1 transition-all duration-200 shadow-sm
        ${getStatusColor(seat.status)}
      `}
    >
      {/* Icon based on status */}
      <div className="mb-1">
        {seat.status === SeatStatus.SOLD ? (
          <User size={18} />
        ) : seat.status === SeatStatus.SELECTED ? (
          <Check size={18} />
        ) : seat.status === SeatStatus.BOOKED ? (
          <User size={18} />
        ) : (
          <div className="w-4 h-4 rounded-sm border border-current opacity-50" />
        )}
      </div>
      <span className="text-xs font-bold">{seat.label}</span>
      
      {/* Visual pillow indicator for realism */}
      <div className="absolute top-1 w-8 h-1 bg-current opacity-20 rounded-full"></div>
    </div>
  );
};

export const SeatMap: React.FC<SeatMapProps> = ({ seats, busType, onSeatClick }) => {
  const floor1Seats = seats.filter((s) => s.floor === 1);
  const floor2Seats = seats.filter((s) => s.floor === 2);

  // Layout configurations
  const getGridCols = () => {
    return busType === BusType.CABIN ? 'grid-cols-2' : 'grid-cols-3';
  };

  const renderDeck = (deckSeats: Seat[], floorName: string) => (
    <div className="flex-1 bg-slate-50 p-4 rounded-xl border border-slate-200">
      <h3 className="text-center font-semibold text-slate-600 mb-4 uppercase tracking-wider text-sm">
        {floorName}
      </h3>
      
      <div className="flex justify-center">
        {/* Driver Cab Area Visual */}
        {floorName === 'Tầng 1' && (
           <div className="absolute -mt-3 text-slate-300">
             <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
               <circle cx="12" cy="12" r="10" />
               <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
               <path d="M2 12h20" />
             </svg>
           </div>
        )}
      </div>

      <div className={`grid ${getGridCols()} gap-4 justify-items-center mt-6`}>
        {deckSeats.map((seat) => (
          <SeatItem key={seat.id} seat={seat} onClick={() => onSeatClick(seat)} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col md:flex-row gap-8 w-full max-w-4xl mx-auto">
      {renderDeck(floor1Seats, 'Tầng 1')}
      {renderDeck(floor2Seats, 'Tầng 2')}
    </div>
  );
};