
export enum BusType {
  SLEEPER = "SLEEPER", // Xe Giường đơn
  CABIN = "CABIN", // Xe Phòng
}

export enum SeatStatus {
  AVAILABLE = "available",
  SELECTED = "selected",
  BOOKED = "booked",
  SOLD = "sold",
}

export interface Seat {
  id: string;
  label: string;
  floor: 1 | 2;
  status: SeatStatus;
  price: number;
  row?: number;
  col?: number;
}

export interface Passenger {
  name?: string;
  phone: string;
  email?: string;
  note?: string;
  pickupPoint?: string;
  dropoffPoint?: string;
}

// New Interface for Line Items
export interface BookingItem {
  tripId: string;
  tripDate: string; // Snapshot
  route: string;    // Snapshot
  licensePlate: string; // Snapshot
  seatIds: string[];
  price: number; // Total price for these seats
}

export interface Booking {
  id: string;
  passenger: Passenger;
  items: BookingItem[]; // CHANGED: Array of trips/seats
  status: "pending" | "confirmed" | "cancelled";
  createdAt: string;
  totalPrice: number;
  totalTickets: number; // New field
  payment?: {
    paidCash: number;
    paidTransfer: number;
  };
}

export interface BusTrip {
  id: string;
  routeId: string | number;
  name: string;
  route: string;
  departureTime: string;
  type: BusType;
  licensePlate: string;
  driver: string;
  basePrice: number;
  seats: Seat[];
  direction?: 'outbound' | 'inbound';
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
  origin?: string;
  destination?: string;
  price?: number;
  departureTime?: string;
  returnTime?: string;
  isEnhanced?: boolean;
  status?: 'active' | 'inactive';
}

export interface BusLayoutConfig {
  floors: 1 | 2;
  rows: number;
  cols: number;
  activeSeats: string[];
  seatLabels?: Record<string, string>;
  hasRearBench?: boolean;
  benchFloors?: number[];
}

export interface Bus {
  id: string;
  plate: string;
  phoneNumber?: string;
  type: BusType;
  seats: number;
  status: "Hoạt động" | "Ngưng hoạt động" | "Đã bán" | "Xe thuê/Tăng cường";
  layoutConfig?: BusLayoutConfig;
  defaultRouteId?: string;
}

export interface ActivityLog {
  id: string;
  phone: string;
  timestamp: Date;
  details: {
    tripInfo: string;
    seats: string[];
    totalPrice: number;
    isPaid: boolean;
  }[];
}