import { Bus, BusTrip, Route, Passenger, Seat, Booking } from "../types";

// Dynamically determine the API URL based on current window location
const getApiUrl = () => {
  let url = "";
  // Ưu tiên biến môi trường từ .env.local
  if (import.meta.env.VITE_API_URL) {
    url = import.meta.env.VITE_API_URL;
  } else if (
    typeof window !== "undefined" &&
    window.location &&
    window.location.hostname &&
    window.location.hostname.trim() !== ""
  ) {
    url = `${window.location.protocol}//${window.location.hostname}:5001/api`;
  } else {
    url = "http://localhost:5001/api";
  }

  // Chuẩn hóa: Loại bỏ tất cả dấu gạch chéo dư thừa ở cuối
  url = url.replace(/\/+$/, "");

  // Đảm bảo URL kết thúc bằng /api (không có dấu gạch chéo cuối ở đây để tránh // khi nối chuỗi)
  if (!url.endsWith("/api")) {
    url += "/api";
  }

  return url;
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
    getAll: () => fetchJson(`${API_URL}/buses/`),
    create: (bus: Omit<Bus, "id">) =>
      fetchJson(`${API_URL}/buses/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bus),
      }),
    update: (id: string, updates: Partial<Bus>) =>
      fetchJson(`${API_URL}/buses/${encodeURIComponent(id)}/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      }),
    delete: (id: string) =>
      fetchJson(`${API_URL}/buses/${encodeURIComponent(id)}/`, {
        method: "DELETE",
      }),
  },

  routes: {
    getAll: () => fetchJson(`${API_URL}/routes/`),
    create: (route: Omit<Route, "id">) =>
      fetchJson(`${API_URL}/routes/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(route),
      }),
    update: (id: string, updates: Partial<Route>) =>
      fetchJson(`${API_URL}/routes/${encodeURIComponent(id)}/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      }),
    delete: (id: string) =>
      fetchJson(`${API_URL}/routes/${encodeURIComponent(id)}/`, {
        method: "DELETE",
      }),
  },

  trips: {
    getAll: () => fetchJson(`${API_URL}/trips/`),
    create: (trip: Omit<BusTrip, "id">) =>
      fetchJson(`${API_URL}/trips/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(trip),
      }),
    update: (id: string, updates: Partial<BusTrip>) =>
      fetchJson(`${API_URL}/trips/${encodeURIComponent(id)}/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      }),
    updateSeats: (id: string, seats: Seat[]) =>
      fetchJson(`${API_URL}/trips/${encodeURIComponent(id)}/seats/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seats }),
      }),
    delete: (id: string) =>
      fetchJson(`${API_URL}/trips/${encodeURIComponent(id)}/`, {
        method: "DELETE",
      }),
  },

  bookings: {
    getAll: () => fetchJson(`${API_URL}/bookings/`),
    create: (
      items: { tripId: string; seats: Seat[] }[],
      passenger: Passenger,
      payment?: { paidCash: number; paidTransfer: number },
      status?: string
    ) =>
      fetchJson(`${API_URL}/bookings/`, {
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
      fetchJson(`${API_URL}/bookings/${encodeURIComponent(id)}/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, passenger, payment, status }),
      }),
    updatePassenger: (id: string, passenger: Passenger) =>
      fetchJson(`${API_URL}/bookings/${encodeURIComponent(id)}/passenger/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passenger }),
      }),
    updateTicket: (
      id: string,
      seatId: string,
      details: {
        pickup?: string;
        dropoff?: string;
        note?: string;
        phone?: string;
        name?: string;
        exactBed?: boolean; // ✅ Xếp đúng giường
        action?: string;
        payment?: any;
      }
    ) =>
      fetchJson(
        `${API_URL}/bookings/${encodeURIComponent(
          id
        )}/tickets/${encodeURIComponent(seatId)}/`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(details),
        }
      ),
    delete: (id: string) =>
      fetchJson(`${API_URL}/bookings/${encodeURIComponent(id)}/`, {
        method: "DELETE",
      }),
    updatePayment: (
      bookingIds: string[],
      payment: { paidCash: number; paidTransfer: number }
    ) =>
      fetchJson(`${API_URL}/bookings/payment/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingIds, payment }),
      }),
    swapSeats: (
      tripId1: string,
      seatId1: string,
      tripId2: string,
      seatId2: string
    ) =>
      fetchJson(`${API_URL}/bookings/swap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId1, seatId1, tripId2, seatId2 }),
      }),
    transferSeat: (
      bookingId: string,
      fromTripId: string,
      toTripId: string,
      seatTransfers: { sourceSeatId: string; targetSeatId: string }[]
    ) =>
      fetchJson(`${API_URL}/bookings/transfer/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          fromTripId,
          toTripId,
          seatTransfers,
        }),
      }),
    getHistory: (id: string) =>
      fetchJson(`${API_URL}/bookings/${encodeURIComponent(id)}/history/`),
  },

  payments: {
    getAll: () => fetchJson(`${API_URL}/payments/`),
    create: (data: any) =>
      fetchJson(`${API_URL}/payments/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    update: (id: string, updates: any) =>
      fetchJson(`${API_URL}/payments/${encodeURIComponent(id)}/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      }),
    delete: (id: string) =>
      fetchJson(`${API_URL}/payments/${encodeURIComponent(id)}/`, {
        method: "DELETE",
      }),
  },

  settings: {
    get: (key: string) =>
      fetchJson(`${API_URL}/settings/${encodeURIComponent(key)}/`),
    set: (key: string, value: any) =>
      fetchJson(`${API_URL}/settings/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      }),
  },

  qrgeneral: {
    get: () => fetchJson(`${API_URL}/qrgeneral/`),
    create: (data: any) =>
      fetchJson(`${API_URL}/qrgeneral/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    simulateSuccess: () =>
      fetchJson(`${API_URL}/qrgeneral/simulate-success`, { method: "POST" }),
    delete: () => fetchJson(`${API_URL}/qrgeneral/`, { method: "DELETE" }),
  },

  maintenance: {
    fixSeats: () =>
      fetchJson(`${API_URL}/maintenance/fix-seats/`, { method: "POST" }),
    fixPayments: () =>
      fetchJson(`${API_URL}/maintenance/fix-payments/`, { method: "POST" }),
    fixFloorSeats: () =>
      fetchJson(`${API_URL}/maintenance/fix-floor-seats/`, { method: "POST" }),
    resetBusConfigs: () =>
      fetchJson(`${API_URL}/maintenance/reset-bus-configs/`, {
        method: "POST",
      }),
    syncBusLayouts: () =>
      fetchJson(`${API_URL}/maintenance/sync-bus-layouts/`, { method: "POST" }),
  },

  roles: {
    getAll: () => fetchJson(`${API_URL}/roles/`),
    update: (name: string, permissions: string[]) =>
      fetchJson(`${API_URL}/roles/${encodeURIComponent(name)}/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions }),
      }),
  },
};
