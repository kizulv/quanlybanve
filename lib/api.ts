
import { Bus, BusTrip, Route, Passenger, Seat } from '../types';

// Dynamically determine the API URL based on current window location
const getApiUrl = () => {
  // Check if we are running in a browser environment
  if (typeof window !== 'undefined' && window.location && window.location.hostname && window.location.hostname.trim() !== '') {
    const apiUrl = `${window.location.protocol}//${window.location.hostname}:5000/api`;
    return apiUrl;
  }
  return 'http://localhost:5000/api';
};

const API_URL = getApiUrl();
console.log("🌐 Configured API URL:", API_URL); // Log for debugging

const fetchJson = async (url: string, options?: RequestInit) => {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      throw new Error(`API Error ${res.status}: ${res.statusText}`);
    }
    return await res.json();
  } catch (error) {
    console.error("❌ Fetch error:", error, "URL:", url);
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

  settings: {
    get: (key: string) => fetchJson(`${API_URL}/settings/${key}`),
    save: (key: string, value: any) => fetchJson(`${API_URL}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value })
    })
  },

  system: {
    exportData: async () => { return {}; },
    importData: async () => { return false; }
  }
};
