
import { Bus, BusTrip, Route, Booking } from '../types';
import { INITIAL_BUSES, INITIAL_ROUTES, INITIAL_TRIPS } from '../data/seed';

// Storage Keys
const DB_KEYS = {
  BUSES: 'vinabus_db_buses',
  ROUTES: 'vinabus_db_routes',
  TRIPS: 'vinabus_db_trips',
  BOOKINGS: 'vinabus_db_bookings',
};

// Generic Collection Class to simulate MongoDB Collection
class Collection<T extends { id: string | number }> {
  private key: string;
  private initialData: T[];

  constructor(key: string, initialData: T[] = []) {
    this.key = key;
    this.initialData = initialData;
    this.init();
  }

  private init() {
    if (!localStorage.getItem(this.key)) {
      localStorage.setItem(this.key, JSON.stringify(this.initialData));
    }
  }

  private load(): T[] {
    try {
      const data = localStorage.getItem(this.key);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error(`Error loading DB ${this.key}`, e);
      return [];
    }
  }

  private save(data: T[]) {
    localStorage.setItem(this.key, JSON.stringify(data));
  }

  // --- CRUD Operations simulating MongoDB Async behavior ---

  async find(filter?: (item: T) => boolean): Promise<T[]> {
    const data = this.load();
    if (!filter) return data;
    return data.filter(filter);
  }

  async findOne(filter: (item: T) => boolean): Promise<T | null> {
    const data = this.load();
    return data.find(filter) || null;
  }

  async findById(id: string | number): Promise<T | null> {
    const data = this.load();
    return data.find(item => item.id === id) || null;
  }

  async insertOne(item: T): Promise<T> {
    const data = this.load();
    // Simulate Duplicate Key Error if ID exists
    if (data.find(d => d.id === item.id)) {
       // In a real DB this throws, but for now we might overwrite or auto-increment
       // Let's assume the caller handles ID generation
    }
    const newData = [...data, item];
    this.save(newData);
    return item;
  }

  async updateOne(id: string | number, update: Partial<T>): Promise<T | null> {
    const data = this.load();
    const index = data.findIndex(item => item.id === id);
    if (index === -1) return null;

    const updatedItem = { ...data[index], ...update };
    data[index] = updatedItem;
    this.save(data);
    return updatedItem;
  }

  async deleteOne(id: string | number): Promise<boolean> {
    const data = this.load();
    const filtered = data.filter(item => item.id !== id);
    if (filtered.length === data.length) return false;
    
    this.save(filtered);
    return true;
  }
}

// Initialize "Database"
export const db = {
  buses: new Collection<Bus>(DB_KEYS.BUSES, INITIAL_BUSES),
  routes: new Collection<Route>(DB_KEYS.ROUTES, INITIAL_ROUTES),
  trips: new Collection<BusTrip>(DB_KEYS.TRIPS, INITIAL_TRIPS),
  bookings: new Collection<Booking>(DB_KEYS.BOOKINGS, []),

  // System Utilities
  exportAll: () => {
    return {
      buses: JSON.parse(localStorage.getItem(DB_KEYS.BUSES) || '[]'),
      routes: JSON.parse(localStorage.getItem(DB_KEYS.ROUTES) || '[]'),
      trips: JSON.parse(localStorage.getItem(DB_KEYS.TRIPS) || '[]'),
      bookings: JSON.parse(localStorage.getItem(DB_KEYS.BOOKINGS) || '[]'),
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };
  },

  importAll: (data: any) => {
    try {
      if (data.buses) localStorage.setItem(DB_KEYS.BUSES, JSON.stringify(data.buses));
      if (data.routes) localStorage.setItem(DB_KEYS.ROUTES, JSON.stringify(data.routes));
      if (data.trips) localStorage.setItem(DB_KEYS.TRIPS, JSON.stringify(data.trips));
      if (data.bookings) localStorage.setItem(DB_KEYS.BOOKINGS, JSON.stringify(data.bookings));
      return true;
    } catch (e) {
      console.error("Import failed", e);
      return false;
    }
  }
};
