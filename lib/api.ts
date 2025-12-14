
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
    create: async (
        tripId: string, 
        seats: Seat[], 
        passenger: Passenger, 
        payment?: { paidCash: number; paidTransfer: number }
    ) => {
      await delay(400); // Simulate transaction
      
      const trip = await db.trips.findById(tripId);
      if (!trip) throw new Error("Trip not found");

      const newBookings: Booking[] = [];
      const now = new Date().toISOString();

      // Determine Status based on Payment
      const totalPrice = seats.reduce((sum, s) => sum + s.price, 0);
      const totalPaid = (payment?.paidCash || 0) + (payment?.paidTransfer || 0);
      
      // Logic: If fully paid -> SOLD (Gray), Else -> BOOKED (Yellow)
      const isFullyPaid = totalPaid >= totalPrice;
      const targetStatus = isFullyPaid ? SeatStatus.SOLD : SeatStatus.BOOKED;

      // Create booking records
      for (const seat of seats) {
        // Calculate proportional payment or assign to first seat? 
        // For simplicity, we attach the full payment info to the booking metadata, 
        // but in a real app we might split it. Here we just store what was passed.
        
        const booking: Booking = {
          id: `BK-${Date.now()}-${seat.id}`,
          seatId: seat.id,
          busId: tripId,
          passenger,
          status: 'confirmed',
          createdAt: now,
          totalPrice: seat.price,
          payment: payment // Attach payment info
        };
        await db.bookings.insertOne(booking);
        newBookings.push(booking);
      }

      // Update trip seat status
      const updatedSeats = trip.seats.map(s => {
        if (seats.find(selected => selected.id === s.id)) {
          return { ...s, status: targetStatus };
        }
        return s;
      });

      await db.trips.updateOne(tripId, { seats: updatedSeats });

      return { bookings: newBookings, updatedTrip: { ...trip, seats: updatedSeats } };
    },

    updatePayment: async (
      bookingIds: string[],
      payment: { paidCash: number; paidTransfer: number }
    ) => {
      await delay(300);
      const allBookings = await db.bookings.find();
      const targetBookings = allBookings.filter(b => bookingIds.includes(b.id));
      
      if (targetBookings.length === 0) throw new Error("No bookings found");
      
      const tripId = targetBookings[0].busId;
      const trip = await db.trips.findById(tripId);
      if (!trip) throw new Error("Trip not found");

      const totalPrice = targetBookings.reduce((sum, b) => sum + b.totalPrice, 0);
      const totalPaid = payment.paidCash + payment.paidTransfer;
      const isFullyPaid = totalPaid >= totalPrice;
      const targetStatus = isFullyPaid ? SeatStatus.SOLD : SeatStatus.BOOKED;

      // Update bookings
      for (const booking of targetBookings) {
        // In a real app, split payment proportionally. Here we just update metadata
        // Assuming the payment passed is the TOTAL for these specific bookings
        await db.bookings.updateOne(booking.id, { 
          payment: payment 
        });
      }

      // Update Trip Seats
      const updatedSeats = trip.seats.map(s => {
        const matchingBooking = targetBookings.find(b => b.seatId === s.id);
        if (matchingBooking) {
          return { ...s, status: targetStatus };
        }
        return s;
      });

      await db.trips.updateOne(tripId, { seats: updatedSeats });
      
      return { 
        updatedBookings: await db.bookings.find(), // return all for refresh
        updatedTrip: { ...trip, seats: updatedSeats } 
      };
    }
  },

  system: {
    exportData: async () => {
      await delay(500); // Simulate large data processing
      return db.exportAll();
    },
    importData: async (data: any) => {
      await delay(500);
      return db.importAll(data);
    }
  }
};
