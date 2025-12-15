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

const bookingSchema = new mongoose.Schema(
  {
    seatId: String,
    busId: String,
    passenger: {
      name: String,
      phone: String,
      email: String,
      note: String,
      pickupPoint: String,
      dropoffPoint: String,
    },
    status: String,
    createdAt: String,
    totalPrice: Number,
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
        {
          plate: "29B-999.88",
          phoneNumber: "0912 345 678",
          type: "SLEEPER",
          seats: 36,
          status: "Hoạt động",
          layoutConfig: {
            floors: 2,
            rows: 6,
            cols: 3,
            hasRearBench: false,
            activeSeats: Array.from(
              { length: 36 },
              (_, i) =>
                `${Math.floor(i / 18) + 1}-${Math.floor((i % 18) / 3)}-${i % 3}`
            ),
            seatLabels: {},
          },
        },
      ]);
    }

    const routeCount = await Route.countDocuments();
    if (routeCount === 0) {
      console.log("🌱 Seeding Routes...");
      await Route.insertMany([
        {
          name: "Hà Nội - Sapa",
          origin: "Hà Nội",
          destination: "Sapa",
          price: 450000,
          departureTime: "07:00",
          returnTime: "13:30",
          status: "active",
          isEnhanced: false,
        },
        {
          name: "Hà Nội - Đà Nẵng",
          origin: "Hà Nội",
          destination: "Đà Nẵng",
          price: 350000,
          departureTime: "19:00",
          returnTime: "16:00",
          status: "active",
          isEnhanced: false,
        },
      ]);
    }
  } catch (e) {
    console.error("Seed data failed:", e);
  }
};

// --- ROUTES ---

// 1. Buses
app.get("/api/buses", async (req, res) => {
  try {
    const buses = await Bus.find();
    res.json(buses);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.post("/api/buses", async (req, res) => {
  try {
    const bus = new Bus(req.body);
    await bus.save();
    res.json(bus);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.put("/api/buses/:id", async (req, res) => {
  try {
    const bus = await Bus.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    res.json(bus);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.delete("/api/buses/:id", async (req, res) => {
  try {
    await Bus.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 2. Routes
app.get("/api/routes", async (req, res) => {
  try {
    const routes = await Route.find();
    res.json(routes);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.post("/api/routes", async (req, res) => {
  try {
    const route = new Route(req.body);
    await route.save();
    res.json(route);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.put("/api/routes/:id", async (req, res) => {
  try {
    const route = await Route.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    res.json(route);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.delete("/api/routes/:id", async (req, res) => {
  try {
    await Route.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 3. Trips
app.get("/api/trips", async (req, res) => {
  try {
    const trips = await Trip.find();
    res.json(trips);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.post("/api/trips", async (req, res) => {
  try {
    const trip = new Trip(req.body);
    await trip.save();
    res.json(trip);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.put("/api/trips/:id", async (req, res) => {
  try {
    const trip = await Trip.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    res.json(trip);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.delete("/api/trips/:id", async (req, res) => {
  try {
    await Trip.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.put("/api/trips/:id/seats", async (req, res) => {
  try {
    const trip = await Trip.findByIdAndUpdate(
      req.params.id,
      { seats: req.body.seats },
      { new: true }
    );
    res.json(trip);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
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
    const { tripId, seats, passenger, payment } = req.body;
    const now = new Date().toISOString();

    const trip = await Trip.findById(tripId);
    if (!trip) return res.status(404).json({ error: "Trip not found" });

    const totalPrice = seats.reduce((sum, s) => sum + s.price, 0);
    const totalPaid = (payment?.paidCash || 0) + (payment?.paidTransfer || 0);
    const targetStatus = totalPaid >= totalPrice ? "sold" : "booked";

    const newBookings = [];

    for (const seat of seats) {
      const booking = new Booking({
        seatId: seat.id,
        busId: tripId,
        passenger,
        status: "confirmed",
        createdAt: now,
        totalPrice: seat.price,
        payment: payment,
      });
      await booking.save();
      newBookings.push(booking);
    }

    const updatedSeats = trip.seats.map((s) => {
      if (seats.find((selected) => selected.id === s.id)) {
        return { ...s, status: targetStatus };
      }
      return s;
    });

    trip.seats = updatedSeats;
    await trip.save();

    res.json({ bookings: newBookings, updatedTrip: trip });
  } catch (e) {
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
    if (targetBookings.length === 0)
      return res.status(404).json({ error: "Bookings not found" });

    const sampleBooking = targetBookings[0];
    const tripId = sampleBooking.busId;
    const trip = await Trip.findById(tripId);

    const totalPrice = targetBookings.reduce((sum, b) => sum + b.totalPrice, 0);
    const totalPaid = payment.paidCash + payment.paidTransfer;
    const targetStatus = totalPaid >= totalPrice ? "sold" : "booked";

    if (trip) {
      const seatIdsToUpdate = targetBookings.map((b) => b.seatId);
      const updatedSeats = trip.seats.map((s) => {
        if (seatIdsToUpdate.includes(s.id)) {
          return { ...s, status: targetStatus };
        }
        return s;
      });
      trip.seats = updatedSeats;
      await trip.save();
    }

    const updatedBookings = await Booking.find();

    res.json({ updatedBookings, updatedTrip: trip });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 5. Settings
app.get("/api/settings/:key", async (req, res) => {
  try {
    const setting = await Setting.findOne({ key: req.params.key });
    res.json(setting ? setting.value : null);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/settings", async (req, res) => {
  try {
    const { key, value } = req.body;
    const setting = await Setting.findOneAndUpdate(
      { key },
      { value },
      { upsert: true, new: true }
    );
    res.json(setting.value);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start Server
app.listen(PORT, "0.0.0.0", async () => {
  await seedData();
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});
