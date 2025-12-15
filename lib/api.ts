
import { Bus, BusTrip, Route, Passenger, Seat } from '../types';

// Tự động xác định URL API dựa trên địa chỉ trình duyệt đang chạy
// Giúp sửa lỗi CORS khi truy cập qua IP mạng LAN (ví dụ: 192.168.1.x)
const getApiUrl = () => {
  // Kiểm tra nếu window tồn tại và hostname có giá trị (không rỗng)
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    return `http://${window.location.hostname}:5000/api`;
  }
  // Fallback về localhost nếu không xác định được hostname
  return 'http://localhost:5000/api';
};

const API_URL = getApiUrl();

const fetchJson = async (url: string, options?: RequestInit) => {
  try {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
    return await res.json();
  } catch (error) {
    console.error("Fetch error:", error);
    throw error;
  }
};

export const api = {
  buses: {
    getAll: () => fetchJson(`${API_URL}/buses`),
    create: (bus: Bus) => fetchJson(`${API_URL}/buses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bus)
    }),
    update: (id: string, updates: Partial<Bus>) => fetchJson(`${API_URL}/buses/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    }),
    delete: (id: string) => fetchJson(`${API_URL}/buses/${id}`, {
      method: 'DELETE'
    })
  },

  routes: {
    getAll: () => fetchJson(`${API_URL}/routes`),
    create: (route: Route) => fetchJson(`${API_URL}/routes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(route)
    }),
    update: (id: string | number, updates: Partial<Route>) => fetchJson(`${API_URL}/routes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    }),
    delete: (id: string | number) => fetchJson(`${API_URL}/routes/${id}`, {
      method: 'DELETE'
    })
  },

  trips: {
    getAll: () => fetchJson(`${API_URL}/trips`),
    create: (trip: BusTrip) => fetchJson(`${API_URL}/trips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trip)
    }),
    update: (id: string, updates: Partial<BusTrip>) => fetchJson(`${API_URL}/trips/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    }),
    delete: (id: string) => fetchJson(`${API_URL}/trips/${id}`, {
      method: 'DELETE'
    }),
    updateSeats: (tripId: string, seats: Seat[]) => fetchJson(`${API_URL}/trips/${tripId}/seats`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seats })
    })
  },

  bookings: {
    getAll: () => fetchJson(`${API_URL}/bookings`),
    
    create: (
        tripId: string, 
        seats: Seat[], 
        passenger: Passenger, 
        payment?: { paidCash: number; paidTransfer: number }
    ) => fetchJson(`${API_URL}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripId, seats, passenger, payment })
    }),

    updatePayment: (
      bookingIds: string[],
      payment: { paidCash: number; paidTransfer: number }
    ) => fetchJson(`${API_URL}/bookings/payment`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingIds, payment })
    })
  },

  system: {
    exportData: async () => {
      return {}; 
    },
    importData: async (data: any) => {
      return false;
    }
  }
};
