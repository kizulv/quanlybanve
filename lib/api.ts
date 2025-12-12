import { db } from './db';
import { Bus, BusTrip, Route, Booking, Passenger, Seat, SeatStatus } from '../types';

// Simulate API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const api = {
  buses: {
    getAll: async () => {
      await delay(200);
      return db.buses.find();
    },
    create: async (bus: Bus) => {
      await delay(200);
      return db.buses.insertOne(bus);
    },
    update: async (id: string, updates: Partial<Bus>) => {
      await delay(200);
      return db.buses.updateOne(id, updates);
    },
    delete: async (id: string) => {
      await delay(200);
      return db.buses.deleteOne(id);
    }
  },

  routes: {
    getAll: async () => {
      await delay(150);
      return db.routes.find();
    },
    create: async (route: Route) => {
      await delay(200);
      return db.routes.insertOne(route);
    },
    update: async (id: string | number, updates: Partial<Route>) => {
      await delay(200);
      return db.routes.updateOne(id, updates);
    },
    delete: async (id: string | number) => {
      await delay(200);
      return db.routes.deleteOne(id);
    }
  },

  trips: {
    getAll: async () => {
      await delay(300); // More data
      return db.trips.find();
    },
    create: async (trip: BusTrip) => {
      await delay(200);
      return db.trips.insertOne(trip);
    },
    update: async (id: string, updates: Partial<BusTrip>) => {
      await delay(200);
      return db.trips.updateOne(id, updates);
    },
    delete: async (id: string) => {
      await delay(200);
      return db.trips.deleteOne(id);
    },
    // Specific logic for updating seats status
    updateSeats: async (tripId: string, seats: Seat[]) => {
      await delay(100);
      return db.trips.updateOne(tripId, { seats });
    }
  },

  bookings: {
    getAll: async () => {
      await delay(200);
      return db.bookings.find();
    },
    create: async (tripId: string, seats: Seat[], passenger: Passenger) => {
      await delay(400); // Simulate transaction
      
      const trip = await db.trips.findById(tripId);
      if (!trip) throw new Error("Trip not found");

      const newBookings: Booking[] = [];
      const now = new Date().toISOString();

      // Create booking records
      for (const seat of seats) {
        const booking: Booking = {
          id: `BK-${Date.now()}-${seat.id}`,
          seatId: seat.id,
          busId: tripId,
          passenger,
          status: 'confirmed',
          createdAt: now,
          totalPrice: seat.price
        };
        await db.bookings.insertOne(booking);
        newBookings.push(booking);
      }

      // Update trip seat status
      const updatedSeats = trip.seats.map(s => {
        if (seats.find(selected => selected.id === s.id)) {
          return { ...s, status: SeatStatus.BOOKED };
        }
        return s;
      });

      await db.trips.updateOne(tripId, { seats: updatedSeats });

      return { bookings: newBookings, updatedTrip: { ...trip, seats: updatedSeats } };
    }
  }
};