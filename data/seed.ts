
import { BusType, BusTrip, Route, Bus } from '../types';
import { generateCabinLayout, generateSleeperLayout } from '../utils/generators';

// Generate default mock layout configs
const mockCabinLayout = {
  floors: 2 as const,
  rows: 6,
  cols: 2,
  activeSeats: Array.from({length: 24}, (_, i) => {
    const r = Math.floor(i / 4);
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

export const INITIAL_ROUTES: Route[] = [
  { 
    id: 'ROUTE-01', 
    name: 'Hà Nội - Sapa', 
    distance: '320km', 
    duration: '5h30', 
    stops: 2,
    price: 450000,
    departureTime: '07:00',
    returnTime: '13:30'
  },
  { 
    id: 'ROUTE-02', 
    name: 'Hà Nội - Đà Nẵng', 
    distance: '760km', 
    duration: '14h00', 
    stops: 4,
    price: 350000,
    departureTime: '19:00',
    returnTime: '16:00'
  },
  { 
    id: 'ROUTE-03', 
    name: 'Sài Gòn - Đà Lạt', 
    distance: '300km', 
    duration: '6h00', 
    stops: 1,
    price: 500000,
    departureTime: '22:00',
    returnTime: '14:00'
  },
];

export const INITIAL_BUSES: Bus[] = [
  { 
    id: 'BUS-001', 
    plate: '29B-123.45', 
    type: BusType.CABIN, 
    seats: 24, 
    status: 'Hoạt động',
    layoutConfig: mockCabinLayout
  },
  { 
    id: 'BUS-002', 
    plate: '29B-999.88', 
    type: BusType.SLEEPER, 
    seats: 36, 
    status: 'Bảo trì',
    layoutConfig: mockSleeperLayout 
  },
  { 
    id: 'BUS-003', 
    plate: '51F-555.66', 
    type: BusType.CABIN, 
    seats: 24, 
    status: 'Hoạt động',
    layoutConfig: mockCabinLayout
  },
];

export const INITIAL_TRIPS: BusTrip[] = [
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
