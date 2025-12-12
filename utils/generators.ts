import { Seat, SeatStatus } from '../types';

// Helper to generate seats for Sleeper (Giường đơn)
// Rule: Row -> Floor -> Col
export const generateSleeperLayout = (basePrice: number): Seat[] => {
  const seats: Seat[] = [];
  let count = 1;
  const rows = 6;
  const cols = 3;
  
  // Logic: Iterate Rows (0..5), then Floors (1..2), then Cols (0..2)
  for (let r = 0; r < rows; r++) {
    for (let f = 1; f <= 2; f++) {
      for (let c = 0; c < cols; c++) {
         seats.push({
          id: `S-${count}`,
          label: `${count}`,
          floor: f as 1 | 2,
          status: SeatStatus.AVAILABLE,
          price: basePrice,
          row: r,
          col: c
        });
        count++;
      }
    }
  }
  return seats;
};

// Helper to generate seats for Cabin (Xe Phòng)
// Rule: Col A/B. Row 0 -> A1 (F1), A2 (F2). Row 1 -> A3 (F1), A4 (F2)...
export const generateCabinLayout = (basePrice: number): Seat[] => {
  const seats: Seat[] = [];
  const rows = 6;
  const cols = 2;

  for (let c = 0; c < cols; c++) {
    const prefix = String.fromCharCode(65 + c); // A, B
    
    for (let r = 0; r < rows; r++) {
       // Floor 1 (Odd)
       const numF1 = (r * 2) + 1;
       seats.push({
          id: `C-${prefix}${numF1}`,
          label: `${prefix}${numF1}`,
          floor: 1,
          status: SeatStatus.AVAILABLE,
          price: basePrice * 1.5,
          row: r,
          col: c
       });

       // Floor 2 (Even)
       const numF2 = (r * 2) + 2;
       seats.push({
          id: `C-${prefix}${numF2}`,
          label: `${prefix}${numF2}`,
          floor: 2,
          status: SeatStatus.AVAILABLE,
          price: basePrice * 1.5,
          row: r,
          col: c
       });
    }
  }

  return seats;
};