
import { Bus, BusTrip, Route, Passenger, Seat, Booking } from "../types";

// Dynamically determine the API URL based on current window location
const getApiUrl = () => {
  if (
    typeof window !== "undefined" &&
    window.location &&
    window.location.hostname &&
    window.location.hostname.trim() !== ""
  ) {
    const apiUrl = `${window.location.protocol}//${window.location.hostname}:5001/api`;
    return apiUrl;
  }
  return "http://localhost:5001/api";
};

const API_URL = getApiUrl();

const fetchJson = async (url: string, options?: RequestInit) => {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      const errorData = await res
        .json()
        .catch(() => ({ error: res.statusText }));
      throw new Error(
        `API Error ${res.status}: ${errorData.error || res.statusText}`
      );
    }
    return await res.json();
  } catch (error) {
    throw error;
  }
};

export const api = {
  buses: {
    getAll: () => fetchJson(`${API_URL}/buses`),
    create: (bus: Omit<Bus, "id">) =>
      fetchJson(`${API_URL}/buses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bus),
      }),
    update: (id: string, updates: Partial<Bus>) =>
      fetchJson(`${API_URL}/buses/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      }),
    delete: (id: string) =>
      fetchJson(`${API_URL}/buses/${id}`, {
        method: "DELETE",
      }),
  },

  routes: {
    getAll: () => fetchJson(`${API_URL}/routes`),
    create: (route: Omit<Route, "id">) =>
      fetchJson(`${API_URL}/routes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(route),
      }),
    update: (id: string, updates: Partial<Route>) =>
      fetchJson(`${API_URL}/routes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      }),
    delete: (id: string) =>
      fetchJson(`${API_URL}/routes/${id}`, {
        method: "DELETE",
      }),
  },

  trips: {
    getAll: () => fetchJson(`${API_URL}/trips`),
    create: (trip: Omit<BusTrip, "id">) =>
      fetchJson(`${API_URL}/trips`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(trip),
      }),
    update: (id: string, updates: Partial<BusTrip>) =>
      fetchJson(`${API_URL}/trips/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      }),
    updateSeats: (id: string, seats: Seat[]) =>
      fetchJson(`${API_URL}/trips/${id}/seats`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seats }),
      }),
    delete: (id: string) =>
      fetchJson(`${API_URL}/trips/${id}`, {
        method: "DELETE",
      }),
  },

  bookings: {
    getAll: () => fetchJson(`${API_URL}/bookings`),
    create: (
      items: { tripId: string; seats: Seat[] }[],
      passenger: Passenger,
      payment?: { paidCash: number; paidTransfer: number },
      status?: string
    ) =>
      fetchJson(`${API_URL}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, passenger, payment, status }),
      }),
    update: (
      id: string,
      items: { tripId: string; seats: Seat[] }[],
      passenger: Passenger,
      payment?: { paidCash: number; paidTransfer: number },
      status?: string
    ) =>
      fetchJson(`${API_URL}/bookings/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, passenger, payment, status }),
      }),
    updatePassenger: (id: string, passenger: Passenger) => 
      fetchJson(`${API_URL}/bookings/${id}/passenger`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passenger }),
      }),
    updateTicket: (id: string, seatId: string, details: { pickup?: string, dropoff?: string, note?: string, phone?: string, name?: string, action?: string, payment?: any }) =>
      fetchJson(`${API_URL}/bookings/${id}/tickets/${seatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(details),
      }),
    delete: (id: string) => 
        fetchJson(`${API_URL}/bookings/${id}`, {
            method: "DELETE"
        }),
    updatePayment: (
      bookingIds: string[],
      payment: { paidCash: number; paidTransfer: number }
    ) =>
      fetchJson(`${API_URL}/bookings/payment`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingIds, payment }),
      }),
    swapSeats: (tripId: string, seatId1: string, seatId2: string) =>
        fetchJson(`${API_URL}/bookings/swap`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tripId, seatId1, seatId2 }),
        }),
    transferSeat: (bookingId: string, fromTripId: string, toTripId: string, seatTransfers: { sourceSeatId: string, targetSeatId: string }[]) =>
        fetchJson(`${API_URL}/bookings/transfer`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bookingId, fromTripId, toTripId, seatTransfers }),
        }),
    getHistory: (id: string) => fetchJson(`${API_URL}/bookings/${id}/history`),
  },

  payments: {
    getAll: () => fetchJson(`${API_URL}/payments`),
    update: (id: string, updates: any) =>
      fetchJson(`${API_URL}/payments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      }),
    delete: (id: string) =>
      fetchJson(`${API_URL}/payments/${id}`, {
        method: "DELETE",
      }),
  },

  settings: {
    get: (key: string) => fetchJson(`${API_URL}/settings/${key}`),
    set: (key: string, value: any) =>
      fetchJson(`${API_URL}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      }),
  },

  maintenance: {
    fixSeats: () => fetchJson(`${API_URL}/maintenance/fix-seats`, { method: "POST" }),
    fixPayments: () => fetchJson(`${API_URL}/maintenance/fix-payments`, { method: "POST" }),
  }
};
