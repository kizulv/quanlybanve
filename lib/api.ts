
import { Bus, BusTrip, Route, Passenger, Seat, Booking } from "../types";

const getApiUrl = () => {
  if (typeof window !== "undefined" && window.location && window.location.hostname && window.location.hostname.trim() !== "") {
    return `${window.location.protocol}//${window.location.hostname}:5001/api`;
  }
  return "http://localhost:5001/api";
};

const API_URL = getApiUrl();

const fetchJson = async (url: string, options?: RequestInit) => {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(`API Error ${res.status}: ${errorData.error || res.statusText}`);
    }
    return await res.json();
  } catch (error) { throw error; }
};

export const api = {
  buses: {
    getAll: () => fetchJson(`${API_URL}/buses`),
    create: (bus: Omit<Bus, "id">) => fetchJson(`${API_URL}/buses`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bus) }),
    update: (id: string, updates: Partial<Bus>) => fetchJson(`${API_URL}/buses/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) }),
    delete: (id: string) => fetchJson(`${API_URL}/buses/${id}`, { method: "DELETE" }),
  },
  routes: {
    getAll: () => fetchJson(`${API_URL}/routes`),
    create: (route: Omit<Route, "id">) => fetchJson(`${API_URL}/routes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(route) }),
    update: (id: string, updates: Partial<Route>) => fetchJson(`${API_URL}/routes/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) }),
    delete: (id: string) => fetchJson(`${API_URL}/routes/${id}`, { method: "DELETE" }),
  },
  trips: {
    getAll: () => fetchJson(`${API_URL}/trips`),
    create: (trip: Omit<BusTrip, "id">) => fetchJson(`${API_URL}/trips`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(trip) }),
    update: (id: string, updates: Partial<BusTrip>) => fetchJson(`${API_URL}/trips/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) }),
    updateSeats: (id: string, seats: Seat[]) => fetchJson(`${API_URL}/trips/${id}/seats`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seats }) }),
    delete: (id: string) => fetchJson(`${API_URL}/trips/${id}`, { method: "DELETE" }),
  },
  bookings: {
    getAll: () => fetchJson(`${API_URL}/bookings`),
    create: (items: any[], passenger: Passenger, payment?: any, status?: string) => 
      fetchJson(`${API_URL}/bookings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items, passenger, payment, status }) }),
    update: (id: string, items: any[], passenger: Passenger, payment?: any, status?: string) => 
      fetchJson(`${API_URL}/bookings/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items, passenger, payment, status }) }),
    transfer: (sourceTripId: string, sourceSeatId: string, targetTripId: string, targetSeatId: string) =>
      fetchJson(`${API_URL}/bookings/transfer`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceTripId, sourceSeatId, targetTripId, targetSeatId }) }),
    delete: (id: string) => fetchJson(`${API_URL}/bookings/${id}`, { method: "DELETE" }),
    getHistory: (id: string) => fetchJson(`${API_URL}/bookings/${id}/history`),
  },
  payments: {
    getAll: () => fetchJson(`${API_URL}/payments`),
    update: (id: string, updates: any) => fetchJson(`${API_URL}/payments/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) }),
    delete: (id: string) => fetchJson(`${API_URL}/payments/${id}`, { method: "DELETE" }),
  },
  settings: {
    get: (key: string) => fetchJson(`${API_URL}/settings/${key}`),
    set: (key: string, value: any) => fetchJson(`${API_URL}/settings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, value }) }),
  },
  maintenance: {
    fixSeats: () => fetchJson(`${API_URL}/maintenance/fix-seats`, { method: "POST" }),
  }
};
