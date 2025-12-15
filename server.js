import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import bodyParser from "body-parser";

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Private-Network", "true");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

app.use(bodyParser.json());

// MongoDB Connection
const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://admin:123a456S%40@192.168.31.37:27017/ticketManager?authSource=admin";

mongoose
  .connect(MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    console.log("💡 Tip: Ensure MongoDB is running");
  });

// --- SCHEMAS ---

const transformId = (doc, ret) => {
  ret.id = ret._id;
  delete ret._id;
  delete ret.__v;
};

const busSchema = new mongoose.Schema(
  {
    plate: String,
    phoneNumber: String,
    type: String,
    seats: Number,
    status: String,
    layoutConfig: Object,
    defaultRouteId: String,
  },
  { toJSON: { virtuals: true, transform: transformId } }
);

const routeSchema = new mongoose.Schema(
  {
    name: String,
    origin: String,
    destination: String,
    price: Number,
    departureTime: String,
    returnTime: String,
    status: String,
    isEnhanced: Boolean,
  },
  { toJSON: { virtuals: true, transform: transformId } }
);

const tripSchema = new mongoose.Schema(
  {
    routeId: String,
    name: String,
    route: String,
    departureTime: String,
    type: String,
    licensePlate: String,
    driver: String,
    basePrice: Number,
    seats: Array,
    direction: String,
  },
  { toJSON: { virtuals: true, transform: transformId } }
);

// New Sub-schema for items
const bookingItemSchema = new mongoose.Schema({
    tripId: String,
    tripDate: String,
    route: String,
    licensePlate: String,
    seatIds: [String],
    price: Number
}, { _id: false });

// Updated Booking Schema: One record containing multiple items
const bookingSchema = new mongoose.Schema(
  {
    passenger: {
      name: String,
      phone: String,
      email: String,
      note: String,
      pickupPoint: String,
      dropoffPoint: String,
    },
    items: [bookingItemSchema], // Array of trips
    status: String,
    createdAt: String,
    totalPrice: Number,
    totalTickets: Number,
    payment: {
      paidCash: Number,
      paidTransfer: Number,
    },
  },
  { toJSON: { virtuals: true, transform: transformId } }
);

const settingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: mongoose.Schema.Types.Mixed,
  },
  { toJSON: { virtuals: true, transform: transformId } }
);

const Bus = mongoose.model("Bus", busSchema);
const Route = mongoose.model("Route", routeSchema);
const Trip = mongoose.model("Trip", tripSchema);
const Booking = mongoose.model("Booking", bookingSchema);
const Setting = mongoose.model("Setting", settingSchema);

// --- SEED DATA FUNCTION ---
const seedData = async () => {
  try {
    const busCount = await Bus.countDocuments();
    if (busCount === 0) {
      console.log("🌱 Seeding Buses...");
      await Bus.insertMany([
        {
          plate: "29B-123.45",
          phoneNumber: "0987 654 321",
          type: "CABIN",
          seats: 24,
          status: "Hoạt động",
          layoutConfig: {
            floors: 2,
            rows: 6,
            cols: 2,
            activeSeats: Array.from(
              { length: 24 },
              (_, i) =>
                `${((i % 4) % 2) + 1}-${Math.floor(i / 4)}-${Math.floor(
                  (i % 4) / 2
                )}`
            ),
            seatLabels: {},
          },
        },
      ]);
    }
  } catch (e) {
    console.error("Seed data failed:", e);
  }
};

// --- ROUTES ---

// 1. Buses (Unchanged)
app.get("/api/buses", async (req, res) => {
  try { const buses = await Bus.find(); res.json(buses); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post("/api/buses", async (req, res) => {
  try { const bus = new Bus(req.body); await bus.save(); res.json(bus); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put("/api/buses/:id", async (req, res) => {
  try { const bus = await Bus.findByIdAndUpdate(req.params.id, req.body, { new: true }); res.json(bus); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete("/api/buses/:id", async (req, res) => {
  try { await Bus.findByIdAndDelete(req.params.id); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

// 2. Routes (Unchanged)
app.get("/api/routes", async (req, res) => {
  try { const routes = await Route.find(); res.json(routes); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post("/api/routes", async (req, res) => {
  try { const route = new Route(req.body); await route.save(); res.json(route); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put("/api/routes/:id", async (req, res) => {
  try { const route = await Route.findByIdAndUpdate(req.params.id, req.body, { new: true }); res.json(route); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete("/api/routes/:id", async (req, res) => {
  try { await Route.findByIdAndDelete(req.params.id); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

// 3. Trips (Unchanged)
app.get("/api/trips", async (req, res) => {
  try { const trips = await Trip.find(); res.json(trips); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post("/api/trips", async (req, res) => {
  try { const trip = new Trip(req.body); await trip.save(); res.json(trip); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put("/api/trips/:id", async (req, res) => {
  try { const trip = await Trip.findByIdAndUpdate(req.params.id, req.body, { new: true }); res.json(trip); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete("/api/trips/:id", async (req, res) => {
  try { await Trip.findByIdAndDelete(req.params.id); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put("/api/trips/:id/seats", async (req, res) => {
  try { const trip = await Trip.findByIdAndUpdate(req.params.id, { seats: req.body.seats }, { new: true }); res.json(trip); } catch (e) { res.status(500).json({ error: e.message }); }
});

// 4. Bookings
app.get("/api/bookings", async (req, res) => {
  try {
    const bookings = await Booking.find();
    res.json(bookings);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/bookings", async (req, res) => {
  try {
    const { items, passenger, payment } = req.body; 
    
    if (!items || items.length === 0) {
        return res.status(400).json({ error: "No items to book" });
    }

    const now = new Date().toISOString();
    let calculatedTotalPrice = 0;
    let calculatedTotalTickets = 0;
    const bookingItems = [];
    const updatedTrips = [];

    for (const item of items) {
        const trip = await Trip.findById(item.tripId);
        if (!trip) continue;

        const seatIds = item.seats.map(s => s.id);
        const itemPrice = item.seats.reduce((sum, s) => sum + s.price, 0);
        
        calculatedTotalPrice += itemPrice;
        calculatedTotalTickets += seatIds.length;

        bookingItems.push({
            tripId: trip.id,
            tripDate: trip.departureTime,
            route: trip.route,
            licensePlate: trip.licensePlate,
            seatIds: seatIds,
            price: itemPrice
        });

        // Determine status: "sold" if fully paid, else "booked"
        const totalPaid = (payment?.paidCash || 0) + (payment?.paidTransfer || 0);
        // We will confirm final status logic later, but seat status needs to be set now
        // For new bookings, we treat seat status based on payment of THIS booking
        // BUT, we need to know the total price first to know if it's fully paid.
        // So we will assume 'booked' first, and if fully paid, 'sold'.
        
        // However, calculating fully paid inside the loop is hard if total price isn't known.
        // We just calculated calculatedTotalPrice inside loop. 
        // Let's defer trip updates slightly or assume booked.
        // Actually, for simplicity:
        // 1. Calculate everything.
        // 2. Determine if fully paid.
        // 3. Update trips.
    }

    // Re-loop to update trips with correct status
    const totalPaid = (payment?.paidCash || 0) + (payment?.paidTransfer || 0);
    const isFullyPaid = totalPaid >= calculatedTotalPrice;
    const finalStatus = isFullyPaid ? "confirmed" : "pending";
    const seatStatus = isFullyPaid ? "sold" : "booked";

    for (const item of items) {
         const trip = await Trip.findById(item.tripId);
         if (!trip) continue;
         
         const seatIds = item.seats.map(s => s.id);
         
         trip.seats = trip.seats.map(s => {
             if (seatIds.includes(s.id)) return { ...s, status: seatStatus };
             return s;
         });
         
         await trip.save();
         updatedTrips.push(trip);
    }

    const booking = new Booking({
      passenger,
      items: bookingItems,
      status: finalStatus,
      createdAt: now,
      totalPrice: calculatedTotalPrice,
      totalTickets: calculatedTotalTickets,
      payment: payment,
    });
    
    await booking.save();

    res.json({ bookings: [booking], updatedTrips: updatedTrips }); 
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// UPDATE BOOKING (Seats & Info)
app.put("/api/bookings/:id", async (req, res) => {
  try {
      const { items, passenger, payment } = req.body;
      const bookingId = req.params.id;

      const oldBooking = await Booking.findById(bookingId);
      if (!oldBooking) return res.status(404).json({ error: "Booking not found" });

      // 1. Revert Old Seats to AVAILABLE
      for (const oldItem of oldBooking.items) {
          const trip = await Trip.findById(oldItem.tripId);
          if (trip) {
              trip.seats = trip.seats.map(s => {
                  if (oldItem.seatIds.includes(s.id)) {
                      return { ...s, status: 'available' };
                  }
                  return s;
              });
              await trip.save();
          }
      }

      // 2. Process New Items & Calculate Price
      let calculatedTotalPrice = 0;
      let calculatedTotalTickets = 0;
      const bookingItems = [];
      const updatedTrips = [];

      for (const item of items) {
          const trip = await Trip.findById(item.tripId);
          if (!trip) continue; // Should handle error
          
          const seatIds = item.seats.map(s => s.id);
          const itemPrice = item.seats.reduce((sum, s) => sum + s.price, 0);
          
          calculatedTotalPrice += itemPrice;
          calculatedTotalTickets += seatIds.length;
          
          bookingItems.push({
              tripId: trip.id,
              tripDate: trip.departureTime,
              route: trip.route,
              licensePlate: trip.licensePlate,
              seatIds: seatIds,
              price: itemPrice
          });
      }

      // 3. Update Payment and Determine Status
      const totalPaid = (payment?.paidCash || 0) + (payment?.paidTransfer || 0);
      const isFullyPaid = totalPaid >= calculatedTotalPrice;
      const finalStatus = isFullyPaid ? "confirmed" : "pending";
      const seatStatus = isFullyPaid ? "sold" : "booked";

      // 4. Update Trips with New Seats Status
      for (const item of items) {
          const trip = await Trip.findById(item.tripId);
          if (!trip) continue;

          const seatIds = item.seats.map(s => s.id);
          trip.seats = trip.seats.map(s => {
              if (seatIds.includes(s.id)) return { ...s, status: seatStatus };
              return s;
          });
          
          await trip.save();
          // Avoid duplicates in updatedTrips list if multiple items refer to same trip (unlikely for single booking but safe)
          if (!updatedTrips.find(t => t.id === trip.id)) {
              updatedTrips.push(trip);
          }
      }

      // 5. Update Booking Record
      oldBooking.passenger = passenger;
      oldBooking.items = bookingItems;
      oldBooking.payment = payment;
      oldBooking.status = finalStatus;
      oldBooking.totalPrice = calculatedTotalPrice;
      oldBooking.totalTickets = calculatedTotalTickets;
      
      await oldBooking.save();

      // Return *all* trips to ensure UI syncs fully (since we modified trips that might not be in the new list anymore)
      const allTrips = await Trip.find();

      res.json({ booking: oldBooking, updatedTrips: allTrips });

  } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
  }
});

app.put("/api/bookings/payment", async (req, res) => {
  try {
    const { bookingIds, payment } = req.body;

    await Booking.updateMany(
      { _id: { $in: bookingIds } },
      { $set: { payment: payment } }
    );

    const targetBookings = await Booking.find({ _id: { $in: bookingIds } });
    
    // Sync Trips Logic (same as before)
    const tripIdsToUpdate = new Set();
    targetBookings.forEach(b => {
        b.items.forEach(i => tripIdsToUpdate.add(i.tripId));
    });

    for (const tripId of tripIdsToUpdate) {
        const trip = await Trip.findById(tripId);
        if (!trip) continue;
        
        // This relies on simple status check, good enough for now
        targetBookings.forEach(b => {
            const item = b.items.find(i => i.tripId === trip.id);
            if (!item) return;

            const bTotalPaid = (b.payment.paidCash || 0) + (b.payment.paidTransfer || 0);
            const bStatus = bTotalPaid >= b.totalPrice ? "sold" : "booked";

            trip.seats = trip.seats.map(s => {
                if (item.seatIds.includes(s.id)) {
                    return { ...s, status: bStatus };
                }
                return s;
            });
        });
        await trip.save();
    }

    const updatedBookings = await Booking.find();
    const allTrips = await Trip.find();
    
    res.json({ updatedBookings, updatedTrips: allTrips });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 5. Settings (Unchanged)
app.get("/api/settings/:key", async (req, res) => {
  try { const setting = await Setting.findOne({ key: req.params.key }); res.json(setting ? setting.value : null); } catch (error) { res.status(500).json({ error: error.message }); }
});
app.post("/api/settings", async (req, res) => {
  try { const { key, value } = req.body; const setting = await Setting.findOneAndUpdate({ key }, { value }, { upsert: true, new: true }); res.json(setting.value); } catch (error) { res.status(500).json({ error: error.message }); }
});

// Start Server
app.listen(PORT, "0.0.0.0", async () => {
  await seedData();
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});
