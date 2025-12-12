
export enum BusType {
  SLEEPER = 'SLEEPER', // Xe Giường đơn (formerly SLEEPER_41)
  CABIN = 'CABIN',     // Xe Phòng (formerly ROOM_22)
}

export enum SeatStatus {
  AVAILABLE = 'available',
  SELECTED = 'selected',
  BOOKED = 'booked',
  SOLD = 'sold',
}

export interface Seat {
  id: string;
  label: string;
  floor: 1 | 2; // 1 = Lower, 2 = Upper
  status: SeatStatus;
  price: number;
  row?: number;
  col?: number;
}

export interface Passenger {
  name: string;
  phone: string;
  email?: string;
  note?: string;
}

export interface Booking {
  id: string;
  seatId: string;
  busId: string;
  passenger: Passenger;
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: string;
  totalPrice: number;
}

export interface BusTrip {
  id: string;
  name: string;
  route: string;
  departureTime: string;
  type: BusType;
  licensePlate: string;
  driver: string;
  basePrice: number;
  seats: Seat[];
}

export interface RouteStats {
  total: number;
  booked: number;
  available: number;
  revenue: number;
}

export interface Route {
  id: number | string;
  name: string;
  distance: string;
  duration: string;
  stops: number;
}

export interface BusLayoutConfig {
  floors: 1 | 2;
  rows: number;
  cols: number;
  activeSeats: string[]; // Format: "floor-row-col" (e.g., "1-0-0") OR "floor-bench-index"
  seatLabels?: Record<string, string>; // Map coordinate key to custom label "1-0-0": "A01"
  hasRearBench?: boolean; // Option for 5 seats at the back
  benchFloors?: number[]; // [1, 2] means both floors have bench
}

export interface Bus {
  id: string;
  plate: string;
  type: BusType;
  seats: number;
  status: 'Hoạt động' | 'Bảo trì' | 'Ngưng hoạt động';
  layoutConfig?: BusLayoutConfig;
}