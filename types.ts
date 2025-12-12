export enum BusType {
  SLEEPER = "SLEEPER", // Xe Giường đơn (formerly SLEEPER_41)
  CABIN = "CABIN", // Xe Phòng (formerly ROOM_22)
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
  status: "pending" | "confirmed" | "cancelled";
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
  // New fields
  price?: number; // Giá vé niêm yết
  departureTime?: string; // Giờ xuất bến đi
  returnTime?: string; // Giờ xuất bến đến
  isEnhanced?: boolean; // Tuyến tăng cường
  status?: 'active' | 'inactive'; // Tình trạng: Hoạt động / Hủy
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
  phoneNumber?: string; // New field
  type: BusType;
  seats: number;
  status: "Hoạt động" | "Ngưng hoạt động" | "Đã bán";
  layoutConfig?: BusLayoutConfig;
  defaultRouteId?: string; // New field added
}