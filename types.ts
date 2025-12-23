
export enum BusType {
  SLEEPER = "SLEEPER", // Xe Giường đơn
  CABIN = "CABIN", // Xe Phòng
}

export enum SeatStatus {
  AVAILABLE = "available",
  SELECTED = "selected",
  BOOKED = "booked",
  SOLD = "sold",
  HELD = "held", // Trạng thái giữ vé
}

export interface Seat {
  id: string;
  label: string;
  floor: 1 | 2;
  status: SeatStatus;
  price: number;
  row?: number;
  col?: number;
  isFloorSeat?: boolean; // NEW: Mark as floor seat
  note?: string; // Added note field
  originalStatus?: SeatStatus; // Track previous status (e.g., HELD) when selected
}

export interface Passenger {
  name?: string;
  phone: string;
  email?: string;
  note?: string;
  pickupPoint?: string;
  dropoffPoint?: string;
}

// Detailed Ticket Info stored in DB
export interface TicketDetail {
  seatId: string;
  price: number;
  pickup: string;
  dropoff: string;
  note?: string; // NEW: Ghi chú riêng cho từng vé
}

// New Interface for Line Items
export interface BookingItem {
  tripId: string;
  tripDate: string; // Snapshot
  route: string;    // Snapshot
  licensePlate: string; // Snapshot
  seatIds: string[]; // Kept for easy indexing
  tickets: TicketDetail[]; // NEW: Detailed info per seat
  price: number; // Total price for these seats
  isEnhanced?: boolean; // NEW: Accurate snapshot for reporting
  busType?: BusType;    // NEW: Accurate snapshot for reporting
}

export interface Booking {
  id: string;
  passenger: Passenger;
  items: BookingItem[]; 
  status: "booking" | "payment" | "hold" | "cancelled"; // UPDATED STATUSES
  createdAt: string;
  updatedAt: string; 
  totalPrice: number;
  totalTickets: number; 
  // Computed property from Payment Collection (Not stored in Booking DB)
  payment?: {
    paidCash: number;
    paidTransfer: number;
  };
}

export interface BookingHistory {
  id: string;
  bookingId: string;
  // Added missing actions 'TRANSFER' | 'PAY_SEAT' | 'REFUND_SEAT' to match backend implementation
  action: 'CREATE' | 'UPDATE' | 'CANCEL' | 'SWAP' | 'PASSENGER_UPDATE' | 'DELETE' | 'TRANSFER' | 'PAY_SEAT' | 'REFUND_SEAT';
  description: string;
  details?: any;
  timestamp: string;
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
  hasFloorSeats?: boolean; // NEW: Enable floor seats
  floorSeatCount?: number; // NEW: Number of floor seats
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

// Undo Action Types Updated for Detail Alerts
export type UndoAction = 
  | { type: 'CREATED_BOOKING'; bookingId: string; phone: string; seatCount: number; seatLabels: string[]; tripDate: string }
  | { type: 'UPDATED_BOOKING'; previousBooking: Booking; phone: string }
  | { type: 'SWAPPED_SEATS'; tripId: string; seat1: string; seat2: string; label1: string; label2: string; tripDate: string };
