
import { Bus, BusTrip, Route, Passenger, Seat, Booking, SeatStatus } from '../types';
import { db } from './db';

// Helper to simulate network delay for realistic UI feedback
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const api = {
  buses: {
    getAll: async () => {
      await delay(300);
      return db.buses.find();
    },
    create: async (bus: Bus) => {
      await delay(300);
      return db.buses.insertOne(bus);
    },
    update: async (id: string, updates: Partial<Bus>) => {
      await delay(300);
      return db.buses.updateOne(id, updates);
    },
    delete: async (id: string) => {
      await delay(300);
      return db.buses.deleteOne(id);
    }
  },

  routes: {
    getAll: async () => {
      await delay(300);
      return db.routes.find();
    },
    create: async (route: Route) => {
      await delay(300);
      return db.routes.insertOne(route);
    },
    update: async (id: string | number, updates: Partial<Route>) => {
      await delay(300);
      return db.routes.updateOne(id, updates);
    },
    delete: async (id: string | number) => {
      await delay(300);
      return db.routes.deleteOne(id);
    }
  },

  trips: {
    getAll: async () => {
      await delay(300);
      return db.trips.find();
    },
    create: async (trip: BusTrip) => {
      await delay(300);
      return db.trips.insertOne(trip);
    },
    update: async (id: string, updates: Partial<BusTrip>) => {
      await delay(300);
      return db.trips.updateOne(id, updates);
    },
    delete: async (id: string) => {
      await delay(300);
      return db.trips.deleteOne(id);
    },
    updateSeats: async (tripId: string, seats: Seat[]) => {
      await delay(300);
      const trip = await db.trips.findById(tripId);
      if (!trip) throw new Error("Trip not found");
      
      const updatedTrip = { ...trip, seats };
      await db.trips.updateOne(tripId, updatedTrip);
      return updatedTrip;
    }
  },

  bookings: {
    getAll: async () => {
      await delay(300);
      return db.bookings.find();
    },
    
    // Transaction: Create Bookings + Update Trip Seats
    create: async (
        tripId: string, 
        seats: Seat[], 
        passenger: Passenger, 
        payment?: { paidCash: number; paidTransfer: number }
    ) => {
      await delay(500);
      const now = new Date().toISOString();

      // 1. Get Trip
      const trip = await db.trips.findById(tripId);
      if (!trip) throw new Error("Trip not found");

      // 2. Determine Target Status (Sold if fully paid, Booked otherwise)
      const totalPrice = seats.reduce((sum, s) => sum + s.price, 0);
      const totalPaid = (payment?.paidCash || 0) + (payment?.paidTransfer || 0);
      
      // Use SeatStatus enum values: "sold" or "booked"
      const targetStatus = totalPaid >= totalPrice ? SeatStatus.SOLD : SeatStatus.BOOKED;

      const newBookings: Booking[] = [];
      const updatedSeats = [...trip.seats];

      // 3. Process each seat
      for (const seat of seats) {
        const booking: Booking = {
          id: `BKG-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
          seatId: seat.id,
          busId: tripId,
          passenger,
          status: 'confirmed', // Booking status
          createdAt: now,
          totalPrice: seat.price,
          payment: payment || { paidCash: 0, paidTransfer: 0 }
        };
        
        await db.bookings.insertOne(booking);
        newBookings.push(booking);

        // Update seat status in the trip
        const seatIndex = updatedSeats.findIndex(s => s.id === seat.id);
        if (seatIndex !== -1) {
          updatedSeats[seatIndex] = { ...updatedSeats[seatIndex], status: targetStatus };
        }
      }

      // 4. Save Trip with updated seats
      const updatedTrip = await db.trips.updateOne(tripId, { seats: updatedSeats });
      
      if (!updatedTrip) throw new Error("Failed to update trip");

      return { bookings: newBookings, updatedTrip };
    },

    // Transaction: Update Payment + Update Trip Seats
    updatePayment: async (
      bookingIds: string[],
      payment: { paidCash: number; paidTransfer: number }
    ) => {
      await delay(500);

      // 1. Fetch relevant bookings
      const allBookings = await db.bookings.find();
      const targetBookings = allBookings.filter(b => bookingIds.includes(b.id));
      
      if (targetBookings.length === 0) throw new Error("Bookings not found");

      // 2. Update payment info for these bookings
      for (const booking of targetBookings) {
          await db.bookings.updateOne(booking.id, { payment });
      }

      // 3. Recalculate Seat Status
      // Assumption: All passed bookingIds belong to the same trip logic (based on App.tsx usage)
      const sampleBooking = targetBookings[0];
      const tripId = sampleBooking.busId;
      const trip = await db.trips.findById(tripId);

      const totalPrice = targetBookings.reduce((sum, b) => sum + b.totalPrice, 0);
      const totalPaid = payment.paidCash + payment.paidTransfer;
      const targetStatus = totalPaid >= totalPrice ? SeatStatus.SOLD : SeatStatus.BOOKED;

      let updatedTrip = trip;

      if (trip) {
        const seatIds = targetBookings.map(b => b.seatId);
        const updatedSeats = trip.seats.map(s => {
            if (seatIds.includes(s.id)) {
                return { ...s, status: targetStatus };
            }
            return s;
        });
        updatedTrip = await db.trips.updateOne(tripId, { seats: updatedSeats });
      }

      // 4. Return fresh data
      const freshBookings = await db.bookings.find();

      return { updatedBookings: freshBookings, updatedTrip: updatedTrip! };
    }
  },

  system: {
    exportData: async () => {
      return db.exportAll();
    },
    importData: async (data: any) => {
      return db.importAll(data);
    }
  }
};
