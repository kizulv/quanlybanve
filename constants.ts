import { BusType, BusTrip, Seat, SeatStatus, Route, Bus } from './types';

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

// Generate default mock layout configs
// We need activeSeats arrays that match the generator logic relative to grid coordinates
const mockCabinLayout = {
  floors: 2 as const,
  rows: 6,
  cols: 2,
  activeSeats: Array.from({length: 24}, (_, i) => {
    // Fill grid completely
    const r = Math.floor(i / 4); // 6 rows, 4 seats per row (2 cols * 2 floors)
    const rem = i % 4;
    const c = Math.floor(rem / 2);
    const f = (rem % 2) + 1;
    return `${f}-${r}-${c}`;
  })
};

const mockSleeperLayout = {
  floors: 2 as const,
  rows: 6,
  cols: 3,
  activeSeats: Array.from({length: 36}, (_, i) => {
     const f = Math.floor(i / 18) + 1; 
     const rem = i % 18;
     const r = Math.floor(rem / 3);
     const c = rem % 3;
     return `${f}-${r}-${c}`;
  })
};

export const MOCK_TRIPS: BusTrip[] = [
  {
    id: 'TRIP-001',
    name: 'Chuyến Sáng Hà Nội - Sapa',
    route: 'Hà Nội - Sapa',
    departureTime: '2023-10-27 07:00',
    type: BusType.CABIN,
    licensePlate: '29B-123.45',
    driver: 'Nguyễn Văn A',
    basePrice: 450000,
    seats: generateCabinLayout(450000),
  },
  {
    id: 'TRIP-002',
    name: 'Chuyến Đêm Hà Nội - Đà Nẵng',
    route: 'Hà Nội - Đà Nẵng',
    departureTime: '2023-10-27 19:00',
    type: BusType.SLEEPER,
    licensePlate: '29B-999.88',
    driver: 'Trần Văn B',
    basePrice: 350000,
    seats: generateSleeperLayout(350000),
  },
   {
    id: 'TRIP-003',
    name: 'Chuyến Chiều Sài Gòn - Đà Lạt',
    route: 'Sài Gòn - Đà Lạt',
    departureTime: '2023-10-27 13:00',
    type: BusType.CABIN,
    licensePlate: '51F-555.66',
    driver: 'Lê Văn C',
    basePrice: 500000,
    seats: generateCabinLayout(500000),
  },
];

export const MOCK_ROUTES: Route[] = [
  { id: 1, name: 'Hà Nội - Sapa', distance: '320km', duration: '5h30', stops: 2 },
  { id: 2, name: 'Hà Nội - Đà Nẵng', distance: '760km', duration: '14h00', stops: 4 },
  { id: 3, name: 'Sài Gòn - Đà Lạt', distance: '300km', duration: '6h00', stops: 1 },
];

export const MOCK_BUSES: Bus[] = [
  { 
    id: 'BUS001', 
    plate: '29B-123.45', 
    type: BusType.CABIN, 
    seats: 24, 
    status: 'Hoạt động',
    layoutConfig: mockCabinLayout
  },
  { 
    id: 'BUS002', 
    plate: '29B-999.88', 
    type: BusType.SLEEPER, 
    seats: 36, 
    status: 'Bảo trì',
    layoutConfig: mockSleeperLayout 
  },
  { 
    id: 'BUS003', 
    plate: '51F-555.66', 
    type: BusType.CABIN, 
    seats: 24, 
    status: 'Hoạt động',
    layoutConfig: mockCabinLayout
  },
];