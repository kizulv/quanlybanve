import express from "express";
import mongoose from "mongoose";
import { defineConfig, loadEnv } from "vite";
import cors from "cors";
import bodyParser from "body-parser";

import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function logDebug(message, data) {
  const logline = `[${new Date().toISOString()}] ${message} ${JSON.stringify(
    data || {}
  )}\n`;
  console.log(message, data);
  try {
    fs.appendFileSync(path.join(__dirname, "server_debug.log"), logline);
  } catch (e) {
    console.error("Failed to write to log file", e);
  }
}

const SECRET_KEY = process.env.SECRET_KEY || "vinabus-secret-key-123";

const app = express();

// Middleware
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

// Request Logger
app.use((req, res, next) => {
  next();
});

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Private-Network", "true");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

app.use(bodyParser.json());

// Tải biến môi trường từ .env
const env = loadEnv(process.env.NODE_ENV || "development", process.cwd(), "");
const MONGO_URI = env.MONGO_URI;
const VITE_API_URL = env.VITE_API_URL || "http://localhost:5001/api";

// Trích xuất port từ VITE_API_URL
const urlPort =
  VITE_API_URL.match(/:(\d+)\//)?.[1] || VITE_API_URL.match(/:(\d+)$/)?.[1];
const PORT = process.env.PORT || urlPort || 5001;

mongoose
  .connect(MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
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
    isEnhanced: { type: Boolean, default: false },
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

const ticketDetailSchema = new mongoose.Schema(
  {
    seatId: String,
    price: Number,
    pickup: String,
    dropoff: String,
    note: String,
    name: String, // NEW
    phone: String,
    status: String, // NEW: Individual ticket status
    exactBed: { type: Boolean, default: false }, // ✅ Xếp đúng giường
  },
  { _id: false }
);

const bookingItemSchema = new mongoose.Schema(
  {
    tripId: String,
    tripDate: String,
    route: String,
    licensePlate: String,
    // seatIds: [String], // REMOVED: Derived from tickets
    tickets: [ticketDetailSchema],

    price: Number,
    isEnhanced: { type: Boolean, default: false },
    busType: String,
  },
  { _id: false }
);

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
    items: [bookingItemSchema],
    // status: String, // REMOVED: Dynamic derivation

    createdAt: String,
    updatedAt: String,
    totalPrice: Number,
    totalTickets: Number,
  },
  { toJSON: { virtuals: true, transform: transformId } }
);

const paymentSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    totalAmount: Number,
    cashAmount: { type: Number, default: 0 },
    transferAmount: { type: Number, default: 0 },
    method: String,
    type: String, // 'payment' | 'refund'
    transactionType: { type: String, default: "snapshot" }, // 'snapshot' | 'incremental'
    note: String,
    timestamp: { type: Date, default: Date.now },
    performedBy: String,
    details: {
      seats: [String],
      labels: [String], // NEW: Store human readable labels
      tripDate: String,
      route: String,
      licensePlate: String,
      trips: [mongoose.Schema.Types.Mixed],
    },
  },
  { toJSON: { virtuals: true, transform: transformId } }
);

const historySchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    action: {
      type: String,
      enum: [
        "CREATE",
        "UPDATE",
        "CANCEL",
        "SWAP",
        "PASSENGER_UPDATE",
        "DELETE",
        "TRANSFER",
        "PAY_SEAT",
        "REFUND_SEAT",
      ],
      required: true,
    },
    description: String,
    details: mongoose.Schema.Types.Mixed,
    timestamp: { type: Date, default: Date.now },
    performedBy: String,
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

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: String,
    role: { type: String, enum: ["admin", "sale", "guest"], default: "guest" },
    permissions: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  { toJSON: { virtuals: true, transform: transformId } }
);

const roleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    permissions: { type: [String], default: [] },
  },
  { toJSON: { virtuals: true, transform: transformId } }
);

const Bus = mongoose.model("Bus", busSchema);
const Route = mongoose.model("Route", routeSchema);
const Trip = mongoose.model("Trip", tripSchema);
const Booking = mongoose.model("Booking", bookingSchema);
const Payment = mongoose.model("Payment", paymentSchema);
const History = mongoose.model("History", historySchema);
const Setting = mongoose.model("Setting", settingSchema);
const User = mongoose.model("User", userSchema);
const Role = mongoose.model("Role", roleSchema);
const QRGeneral = mongoose.model(
  "QRGeneral",
  new mongoose.Schema(
    {
      data: Object,
      status: { type: String, default: "pending" }, // pending, success
      timestamp: { type: Date, default: Date.now },
    },
    { timestamps: true }
  )
);

// --- HELPERS ---

const DEFAULT_PERMISSIONS = {
  admin: [
    "VIEW_SALES",
    "VIEW_SCHEDULE",
    "VIEW_ORDER_INFO",
    "VIEW_FINANCE",
    "MANAGE_USERS",
    "MANAGE_SETTINGS",
    "CREATE_TRIP",
    "UPDATE_TRIP",
    "DELETE_TRIP",
    "BOOK_TICKET",
  ],
  sale: ["VIEW_SALES", "VIEW_SCHEDULE", "VIEW_ORDER_INFO", "BOOK_TICKET"],
  guest: ["VIEW_ORDER_INFO"],
};

// Create default admin if not exists
const seedAdmin = async () => {
  const admin = await User.findOne({ username: "admin" });
  if (!admin) {
    const hashedPassword = await bcrypt.hash("admin123", 10);
    const newAdmin = new User({
      username: "admin",
      password: hashedPassword,
      name: "Administrator",
      role: "admin",
      permissions: [],
    });
    await newAdmin.save();
    console.log("✅ Default admin created");
  }

  // Seed Roles
  for (const [roleName, permissions] of Object.entries(DEFAULT_PERMISSIONS)) {
    const role = await Role.findOne({ name: roleName });
    if (!role) {
      await Role.create({ name: roleName, permissions });
      console.log(`✅ Default role '${roleName}' created`);
    }
  }
};
seedAdmin();

const verifyToken = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Access denied" });

  try {
    const verified = jwt.verify(token, SECRET_KEY);
    const { id, username, role, name, permissions } = verified;
    req.user = { id, username, role, name, permissions: permissions || [] };
    next();
  } catch (err) {
    res.status(400).json({ error: "Invalid token" });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

const logBookingAction = async (
  bookingId,
  action,
  description,
  details = {}
) => {
  try {
    await History.create({
      bookingId,
      action,
      description,
      details,
      timestamp: new Date(),
    });
    await Booking.findByIdAndUpdate(bookingId, {
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("Failed to log history:", e);
  }
};

const deriveBookingStatus = async (booking) => {
  if (!booking) return "booking";
  if ((booking.totalTickets || 0) === 0) return "cancelled";

  // Calculate totalPaid if not populated
  let paidCash = 0;
  let paidTransfer = 0;

  if (booking.payment) {
    paidCash = booking.payment.paidCash || 0;
    paidTransfer = booking.payment.paidTransfer || 0;
  } else {
    const payments = await Payment.find({ bookingId: booking._id });
    paidCash = payments.reduce((sum, p) => sum + (p.cashAmount || 0), 0);
    paidTransfer = payments.reduce(
      (sum, p) => sum + (p.transferAmount || 0),
      0
    );
  }

  const totalPaid = paidCash + paidTransfer;
  // Use tickets to check hold status
  const hasHoldTickets = booking.items?.some((item) =>
    item.tickets?.some((t) => t.status === "hold")
  );

  if (totalPaid > 0) return "payment";
  if (hasHoldTickets) return "hold";
  return "booking";
};

const getBookingPayments = async (bookingId) => {
  const payments = await Payment.find({ bookingId });
  const paidCash = payments.reduce((sum, p) => sum + (p.cashAmount || 0), 0);
  const paidTransfer = payments.reduce(
    (sum, p) => sum + (p.transferAmount || 0),
    0
  );
  return { paidCash, paidTransfer };
};

const processPaymentUpdate = async (booking, newPaymentState) => {
  const current = await getBookingPayments(booking._id);
  const newCash = newPaymentState?.paidCash || 0;
  const newTransfer = newPaymentState?.paidTransfer || 0;
  const cashDelta = newCash - current.paidCash;
  const transferDelta = newTransfer - current.paidTransfer;
  const totalDelta = cashDelta + transferDelta;
  console.log("[DEBUG_PAYMENT] processPaymentUpdate called:", {
    bookingId: booking._id,
    current,
    newPaymentState,
    deltas: { cashDelta, transferDelta, totalDelta },
  });
  logDebug("[DEBUG_PAYMENT] processPaymentUpdate called:", {
    bookingId: booking._id,
    current,
    newPaymentState,
    deltas: { cashDelta, transferDelta, totalDelta },
  });

  if (totalDelta === 0 && cashDelta === 0 && transferDelta === 0) {
    logDebug("[DEBUG_PAYMENT] No payment changes detected. Skipping.");
    return;
  }

  const type = totalDelta >= 0 ? "payment" : "refund";
  let method = "mixed";
  if (transferDelta === 0 && cashDelta !== 0) method = "cash";
  else if (cashDelta === 0 && transferDelta !== 0) method = "transfer";

  // Cải tiến: Luôn đảm bảo trip metadata đầy đủ nhất
  const enrichedTrips = await Promise.all(
    booking.items.map(async (i) => {
      const trip = await Trip.findById(i.tripId);
      const route = trip ? await Route.findById(trip.routeId) : null;

      // Thu thập nhãn ghế cho báo cáo chính xác (derive from tickets if seatIds is missing)
      const seatIds =
        i.seatIds && i.seatIds.length > 0
          ? i.seatIds
          : i.tickets.map((t) => t.seatId);

      const seatLabels = seatIds.map((sid) => {
        const seat = trip?.seats?.find((s) => s.id === sid);
        return seat ? seat.label : sid;
      });

      return {
        tripId: i.tripId,
        route: i.route,
        tripDate: i.tripDate,
        licensePlate: i.licensePlate,
        seats: i.seatIds,
        labels: seatLabels, // Store labels!
        tickets: i.tickets.map((t) => {
          const seat = trip?.seats?.find((s) => s.id === t.seatId);
          return { ...t.toObject(), label: seat ? seat.label : t.seatId };
        }),
        busType: i.busType || trip?.type || "SLEEPER",
        isEnhanced: i.isEnhanced || route?.isEnhanced || false,
      };
    })
  );

  const paymentRecord = new Payment({
    bookingId: booking._id,
    totalAmount: totalDelta,
    cashAmount: cashDelta,
    transferAmount: transferDelta,
    type,
    transactionType: "snapshot",
    method,
    note: type === "refund" ? "Hoàn tiền" : "Thanh toán/Cập nhật",
    timestamp: new Date(),
    details: {
      seats: booking.items.flatMap((i) => i.tickets.map((t) => t.seatId)), // Derived from tickets
      labels: enrichedTrips.flatMap((et) => et.labels),
      tripDate: booking.items[0]?.tripDate,
      route: booking.items[0]?.route,
      licensePlate: booking.items[0]?.licensePlate,
      trips: enrichedTrips,
    },
  });
  await paymentRecord.save();
};

const getBookingsWithPayment = async (match = {}) => {
  const bookings = await Booking.aggregate([
    { $match: match },
    {
      $lookup: {
        from: "payments",
        localField: "_id",
        foreignField: "bookingId",
        as: "paymentRecords",
      },
    },
    {
      $addFields: {
        id: { $toString: "$_id" },
        payment: {
          paidCash: { $sum: "$paymentRecords.cashAmount" },
          paidTransfer: { $sum: "$paymentRecords.transferAmount" },
        },
      },
    },
    { $project: { paymentRecords: 0, _id: 0, __v: 0 } },
  ]);

  // Derive status and seatIds dynamically
  return bookings.map((b) => {
    // Derive seatIds for each item from tickets
    if (b.items) {
      b.items = b.items.map((item) => ({
        ...item,
        seatIds: item.tickets ? item.tickets.map((t) => t.seatId) : [],
      }));
    }

    const totalPaid =
      (b.payment?.paidCash || 0) + (b.payment?.paidTransfer || 0);
    // Check if any ticket is in 'hold' status
    const hasHoldTickets = b.items?.some((item) =>
      item.tickets?.some((t) => t.status === "hold")
    );

    let status = "booking";
    if (b.totalTickets === 0) {
      status = "cancelled";
    } else if (totalPaid > 0) {
      status = "payment";
    } else if (hasHoldTickets) {
      status = "hold";
    }

    return { ...b, status };
  });
};

// --- ROUTES ---

// AUTH ROUTES
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ error: "User not found" });

    const validPass = await bcrypt.compare(password, user.password);
    if (!validPass) return res.status(400).json({ error: "Invalid password" });

    const token = jwt.sign(
      {
        id: user._id,
        username: user.username,
        role: user.role,
        name: user.name,
        permissions: user.permissions,
      },
      SECRET_KEY,
      { expiresIn: "24h" }
    );
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        name: user.name,
        permissions: user.permissions,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/auth/change-password", verifyToken, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const validPass = await bcrypt.compare(oldPassword, user.password);
    if (!validPass)
      return res.status(400).json({ error: "Mật khẩu cũ không đúng" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();
    res.json({ success: true, message: "Đổi mật khẩu thành công" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// USER MANAGEMENT ROUTES (Admin only)
app.get("/api/users", verifyToken, isAdmin, async (req, res) => {
  try {
    const users = await User.find({}, "-password");
    res.json(users);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// CREATE USER
app.post("/api/users", verifyToken, isAdmin, async (req, res) => {
  try {
    const { username, password, name, role, permissions } = req.body;
    const existing = await User.findOne({ username });
    if (existing)
      return res.status(400).json({ error: "Username already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      username,
      password: hashedPassword,
      name,
      role,
      permissions: permissions || [],
    });
    await user.save();
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/users/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const { password, name, role } = req.body;
    const updateData = { name, role };
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }
    const user = await User.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    });
    res.json({
      id: user._id,
      username: user.username,
      name: user.name,
      role: user.role,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/users/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ROLE MANAGEMENT ROUTES
app.get("/api/roles", async (req, res) => {
  try {
    const roles = await Role.find({});
    res.json(roles);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/roles/:name", verifyToken, isAdmin, async (req, res) => {
  try {
    const { name } = req.params;
    const { permissions } = req.body;

    if (name === "admin") {
      return res.status(403).json({ error: "Cannot modify admin permissions" });
    }

    const role = await Role.findOne({ name });
    if (!role) {
      const newRole = new Role({ name, permissions });
      await newRole.save();
      return res.json(newRole);
    }

    role.permissions = permissions;
    await role.save();
    res.json(role);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/buses", async (req, res) => {
  try {
    res.json(await Bus.find());
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
    res.json(
      await Bus.findByIdAndUpdate(req.params.id, req.body, { new: true })
    );
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

app.get("/api/routes", async (req, res) => {
  try {
    res.json(await Route.find());
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
    res.json(
      await Route.findByIdAndUpdate(req.params.id, req.body, { new: true })
    );
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

app.get("/api/trips", async (req, res) => {
  try {
    res.json(await Trip.find());
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
    res.json(
      await Trip.findByIdAndUpdate(req.params.id, req.body, { new: true })
    );
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
    res.json(
      await Trip.findByIdAndUpdate(
        req.params.id,
        { seats: req.body.seats },
        { new: true }
      )
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/bookings", async (req, res) => {
  try {
    res.json(await getBookingsWithPayment());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET HISTORY
app.get("/api/bookings/:id/history", async (req, res) => {
  try {
    res.json(
      await History.find({ bookingId: req.params.id }).sort({ timestamp: -1 })
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// QR GENERAL ROUTES
app.get("/api/qrgeneral", async (req, res) => {
  try {
    const record = await QRGeneral.findOne().sort({ createdAt: -1 });
    res.json(record || { data: null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/qrgeneral", async (req, res) => {
  try {
    // Delete all previous records to ensure only 1 exists (or just create new and let get pick latest)
    // Requirement says: "Chỉ tồn tại duy nhất 1 bản ghi" -> Delete all first
    await QRGeneral.deleteMany({});

    const newRecord = new QRGeneral({
      data: req.body,
      status: "pending",
    });
    await newRecord.save();
    res.json(newRecord);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/qrgeneral", async (req, res) => {
  try {
    await QRGeneral.deleteMany({});
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/qrgeneral/simulate-success", async (req, res) => {
  try {
    const record = await QRGeneral.findOne().sort({ createdAt: -1 });
    if (!record)
      return res.status(404).json({ error: "No active transaction" });

    record.status = "success";
    // Optional: Update payment info in data object if needed
    // record.data.payment.paidTransfer = record.data.payment.totalAmount;

    await record.save();
    res.json({ success: true, record });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/bookings", async (req, res) => {
  try {
    const { items, passenger, payment, status: requestedStatus } = req.body;
    if (!items || items.length === 0)
      return res.status(400).json({ error: "No items to book" });
    const now = new Date().toISOString();
    let calculatedTotalPrice = 0;
    let calculatedTotalTickets = 0;
    const bookingItems = [];
    const updatedTrips = [];
    const logTripDetails = [];

    const totalPaid = (payment?.paidCash || 0) + (payment?.paidTransfer || 0);
    const finalStatus =
      requestedStatus || (totalPaid > 0 ? "payment" : "booking");

    for (const item of items) {
      const trip = await Trip.findById(item.tripId);
      if (!trip) continue;
      const route = await Route.findById(trip.routeId);
      const isEnhanced =
        route?.isEnhanced ||
        trip.name?.toLowerCase().includes("tăng cường") ||
        trip.route?.toLowerCase().includes("tăng cường");

      // VALIDATION: Đảm bảo có tickets với giá chính thức khi trạng thái là payment
      if (finalStatus === "payment" && !item.tickets) {
        return res.status(400).json({
          error: "Missing ticket details",
          message:
            "Khi thanh toán, phải cung cấp thông tin vé chi tiết (tickets) với giá chính thức.",
        });
      }

      const tickets =
        item.tickets ||
        item.seats.map((s) => ({
          seatId: s.id,
          price:
            finalStatus === "payment"
              ? s.price // Chỉ dùng làm fallback nếu không có tickets (đã validate ở trên)
              : finalStatus === "hold"
              ? 0
              : 0,
          status:
            finalStatus === "payment"
              ? "payment"
              : finalStatus === "hold"
              ? "hold"
              : "booking",
          pickup: passenger.pickupPoint || "",
          dropoff: passenger.dropoffPoint || "",
          note: "",
          name: passenger.name || "",
          phone: passenger.phone || "",
        }));

      const seatIds = tickets.map((t) => t.seatId);
      const itemPrice = tickets.reduce((sum, t) => sum + (t.price || 0), 0);
      calculatedTotalPrice += itemPrice; // Sử dụng itemPrice thay vì fallback
      calculatedTotalTickets += seatIds.length;

      bookingItems.push({
        tripId: trip.id,
        tripDate: trip.departureTime,
        route: trip.route,
        licensePlate: trip.licensePlate,
        // seatIds, // REMOVED
        tickets,
        price: itemPrice,
        isEnhanced,
        busType: trip.type,
      });

      const seatLogDetails = tickets.map((t) => {
        const seat = trip.seats.find((s) => String(s.id) === String(t.seatId));
        return {
          id: t.seatId,
          label: seat ? seat.label : t.seatId,
          status: t.status,
        };
      });

      logTripDetails.push({
        route: trip.route,
        tripDate: trip.departureTime,
        seats: seatLogDetails, // Changed from seatIds to objects with status
        licensePlate: trip.licensePlate,
      });
    }

    for (const item of bookingItems) {
      const trip = await Trip.findById(item.tripId);
      if (trip) {
        trip.seats = trip.seats.map((s) => {
          const ticket = item.tickets.find(
            (t) => String(t.seatId) === String(s.id)
          );
          if (ticket) {
            const targetStatus =
              ticket.status === "payment"
                ? "sold"
                : ticket.status === "hold"
                ? "held"
                : "booked";
            return { ...s, status: targetStatus };
          }
          return s;
        });
        trip.markModified("seats");
        await trip.save();
        updatedTrips.push(trip);
      }
    }

    const booking = new Booking({
      passenger,
      items: bookingItems,
      // status: finalStatus, // REMOVED

      createdAt: now,
      updatedAt: now,
      totalPrice: calculatedTotalPrice,
      totalTickets: calculatedTotalTickets,
    });
    await booking.save();

    // TẠO DESCRIPTION CHI TIẾT
    const createDesc = logTripDetails
      .map((tripLog, idx) => {
        const item = bookingItems[idx];
        const action = finalStatus === "payment" ? "Mua" : "Đặt";
        const count = tripLog.seats.length;

        const seatDetails = tripLog.seats
          .map((s) => {
            const ticket = item.tickets.find(
              (t) => String(t.seatId) === String(s.id)
            );
            const price = ticket ? ticket.price || item.price || 0 : 0;
            return finalStatus === "payment"
              ? `${s.label} (${price.toLocaleString("vi-VN")})`
              : s.label;
          })
          .join(" ");

        return `${tripLog.route}: ${action} (${count} vé) ${seatDetails}`;
      })
      .join(" | ");

    await logBookingAction(booking._id, "CREATE", createDesc, {
      trips: logTripDetails,
      totalTickets: calculatedTotalTickets,
    });

    if (finalStatus !== "hold" && (totalPaid > 0 || payment)) {
      await processPaymentUpdate(booking, payment);
    }

    const result = await getBookingsWithPayment({ _id: booking._id });
    res.json({ bookings: result, updatedTrips });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/bookings/:id", async (req, res) => {
  try {
    const { items, passenger, payment, status: requestedStatus } = req.body;
    const bookingId = req.params.id;
    const oldBooking = await Booking.findById(bookingId);
    if (!oldBooking)
      return res.status(404).json({ error: "Booking not found" });

    // Derive old status
    const oldStatus = await deriveBookingStatus(oldBooking);

    // Thu thập danh sách ghế cũ để so sánh (Populate seatIds from tickets)
    oldBooking.items.forEach((item) => {
      if ((!item.seatIds || item.seatIds.length === 0) && item.tickets) {
        item.seatIds = item.tickets.map((t) => t.seatId);
      }
    });

    const oldSeatMap = new Map();
    oldBooking.items.forEach((i) =>
      oldSeatMap.set(i.tripId, {
        seats: new Set(i.seatIds),
        route: i.route,
        date: i.tripDate,
      })
    );

    // Release old seats in trips and populate label map
    for (const oldItem of oldBooking.items) {
      const trip = await Trip.findById(oldItem.tripId);
      if (trip) {
        // Populate label map for history logging
        const tripData = oldSeatMap.get(String(trip._id));
        if (tripData) {
          tripData.labelMap = new Map();
          trip.seats.forEach((s) => {
            tripData.labelMap.set(String(s.id), s.label);
          });
        }

        trip.seats = trip.seats.map((s) =>
          oldItem.seatIds.includes(String(s.id))
            ? { ...s, status: "available" }
            : s
        );
        trip.markModified("seats");
        await trip.save();
      }
    }

    let calculatedTotalPrice = 0;
    let calculatedTotalTickets = 0;
    const bookingItems = [];
    const changes = [];

    const totalPaid = (payment?.paidCash || 0) + (payment?.paidTransfer || 0);
    const finalStatus =
      requestedStatus || (totalPaid > 0 ? "payment" : "booking");

    for (const item of items) {
      const trip = await Trip.findById(item.tripId);
      if (!trip) continue;

      const route = await Route.findById(trip.routeId);
      const isEnhanced =
        route?.isEnhanced ||
        trip.name?.toLowerCase().includes("tăng cường") ||
        trip.route?.toLowerCase().includes("tăng cường");

      // VALIDATION: Đảm bảo có tickets với giá chính thức khi trạng thái là payment
      if (finalStatus === "payment" && !item.tickets) {
        return res.status(400).json({
          error: "Missing ticket details",
          message:
            "Khi thanh toán, phải cung cấp thông tin vé chi tiết (tickets) với giá chính thức.",
        });
      }

      const tickets =
        item.tickets ||
        item.seats.map((s) => ({
          seatId: s.id,
          price:
            finalStatus === "payment"
              ? s.price // Chỉ dùng làm fallback nếu không có tickets (đã validate ở trên)
              : finalStatus === "hold"
              ? 0
              : 0,
          status:
            finalStatus === "payment"
              ? "payment"
              : finalStatus === "hold"
              ? "hold"
              : "booking",
          pickup: passenger.pickupPoint || "",
          dropoff: passenger.dropoffPoint || "",
          note: "",
          name: passenger.name || "",
          phone: passenger.phone || "",
        }));

      const seatIds = tickets.map((t) => t.seatId);
      const itemPrice = tickets.reduce((sum, t) => sum + (t.price || 0), 0);
      calculatedTotalPrice += itemPrice; // Sử dụng itemPrice thay vì fallback
      calculatedTotalTickets += seatIds.length;

      bookingItems.push({
        tripId: trip.id,
        tripDate: trip.departureTime,
        route: trip.route,
        licensePlate: trip.licensePlate,
        // seatIds, // REMOVED
        tickets,
        price: itemPrice,
        busType: trip.type,
        isEnhanced: isEnhanced,
      });

      // So sánh ghế thêm/bớt cho trip này
      const oldTripData = oldSeatMap.get(trip.id);
      const oldSeats = oldTripData ? oldTripData.seats : new Set();
      const currentSeats = new Set(seatIds);
      const removed = [...oldSeats].filter((s) => !currentSeats.has(s));
      const added = [...currentSeats].filter((s) => !oldSeats.has(s));
      const kept = [...oldSeats].filter((s) => currentSeats.has(s));

      if (removed.length > 0 || added.length > 0 || kept.length > 0) {
        const getDetailedSeat = (id) => {
          const sObj = trip.seats.find((s) => String(s.id) === String(id));
          const ticket = tickets.find((t) => String(t.seatId) === String(id));
          return {
            id: id,
            label: sObj ? sObj.label : id,
            status: ticket
              ? ticket.status === "payment"
                ? "payment"
                : "booking"
              : "booking", // Default for added/kept
          };
        };

        const getOldDetailedSeat = (id) => {
          const label =
            oldTripData && oldTripData.labelMap
              ? oldTripData.labelMap.get(String(id)) || id
              : id;
          return { id, label, status: "removed" }; // Removed seats don't need active status
        };

        changes.push({
          route: trip.route,
          date: trip.departureTime,
          removed: removed.map(getOldDetailedSeat),
          added: added.map(getDetailedSeat),
          kept: kept.map(getDetailedSeat),
        });
      }
    }

    // Kiểm tra xem có trip nào bị xóa hoàn toàn không
    const currentTripIds = new Set(bookingItems.map((i) => i.tripId));
    for (const [tripId, data] of oldSeatMap.entries()) {
      if (!currentTripIds.has(tripId)) {
        const getOldDetailedSeat = (id) => {
          const label = data.labelMap ? data.labelMap.get(id) || id : id;
          return { id, label, status: "removed" };
        };
        changes.push({
          route: data.route,
          date: data.date,
          removed: [...data.seats].map(getOldDetailedSeat),
          added: [],
          kept: [],
        });
      }
    }

    for (const item of bookingItems) {
      const trip = await Trip.findById(item.tripId);
      if (trip) {
        trip.seats = trip.seats.map((s) => {
          const ticket = item.tickets.find(
            (t) => String(t.seatId) === String(s.id)
          );
          if (ticket) {
            const targetStatus =
              ticket.status === "payment"
                ? "sold"
                : ticket.status === "hold"
                ? "held"
                : "booked";
            return { ...s, status: targetStatus };
          }
          return s;
        });
        trip.markModified("seats");
        await trip.save();
      }
    }

    // DETECT OLD PAID SEATS & PRICE HELPER
    const oldPaidSeatIds = new Set();
    if (oldBooking.status === "payment") {
      oldBooking.items.forEach((i) =>
        i.seatIds.forEach((id) => oldPaidSeatIds.add(String(id)))
      );
    } else {
      oldBooking.items.forEach((i) => {
        if (i.tickets) {
          i.tickets.forEach((t) => {
            if (t.status === "payment") oldPaidSeatIds.add(String(t.seatId));
          });
        }
      });
    }

    const getSeatPrice = (sid) => {
      for (const item of bookingItems) {
        if (item.tickets) {
          const t = item.tickets.find(
            (tk) => String(tk.seatId) === String(sid)
          );
          if (t) return t.price || 0;
        }
      }
      return 0;
    };

    // GENERATE SMART DESCRIPTION
    let summaryParts = [];
    let hasSmartAction = false;

    if (changes.length > 0) {
      const changeStrings = changes
        .map((c) => {
          const parts = [];

          // 1. Mua thêm (Added + Payment)
          const addedPaid = c.added.filter((s) => s.status === "payment");
          if (addedPaid.length > 0) {
            const str = addedPaid
              .map(
                (s) =>
                  `${s.label} (${getSeatPrice(s.id).toLocaleString("vi-VN")})`
              )
              .join(" ");
            parts.push(`Mua thêm ${str}`);
            hasSmartAction = true;
          }

          // 2. Đặt thêm (Added + !Payment)
          const addedBooked = c.added.filter((s) => s.status !== "payment");
          if (addedBooked.length > 0) {
            parts.push(`Đặt thêm ${addedBooked.map((s) => s.label).join(",")}`);
            hasSmartAction = true;
          }

          // 3. Thanh toán (Kept + Payment + NotInOldPaid)
          const keptPaid = c.kept.filter(
            (s) => s.status === "payment" && !oldPaidSeatIds.has(String(s.id))
          );
          if (keptPaid.length > 0) {
            const str = keptPaid
              .map(
                (s) =>
                  `${s.label} (${getSeatPrice(s.id).toLocaleString("vi-VN")})`
              )
              .join(" ");
            parts.push(`Thanh toán ${str}`);
            hasSmartAction = true;
          }

          // 4. Hủy (Removed)
          if (c.removed.length > 0) {
            const getOldSeatPrice = (sid) => {
              for (const item of oldBooking.items) {
                if (item.tickets) {
                  const t = item.tickets.find(
                    (tk) => String(tk.seatId) === String(sid)
                  );
                  if (t) return t.price || item.price || 0;
                } else if (
                  item.seatIds &&
                  item.seatIds.map(String).includes(String(sid))
                ) {
                  return item.price || 0;
                }
              }
              return 0;
            };

            const removedStr = c.removed
              .map((s) => {
                if (oldPaidSeatIds.has(String(s.id))) {
                  const price = getOldSeatPrice(s.id);
                  return `${s.label} (-${price.toLocaleString("vi-VN")})`;
                }
                return s.label;
              })
              .join(" "); // Use space separator for consistency if mixed? Or comma? User used space in example "A1 (...) B6 (...)". But for Hủy? "Hủy A5 (-...)". Just one seat? If multiple: "Hủy A5 (-...) A6 (-...)". Space is better for consistency with "Mua".

            parts.push(`Hủy ${removedStr}`);
          }

          if (parts.length === 0) return "";
          return `${c.route}: ${parts.join(" | ")}`;
        })
        .filter((s) => s);

      if (changeStrings.length > 0)
        summaryParts.push(changeStrings.join(" | "));
    }

    if (oldStatus !== finalStatus) {
      // Suppress generic status change if smart actions cover it
      // AND we are not cancelling
      if (
        !(
          hasSmartAction &&
          finalStatus !== "cancelled" &&
          finalStatus !== "deleted"
        )
      ) {
        summaryParts.push(
          `Chuyển trạng thái: ${oldStatus.toUpperCase()} -> ${finalStatus.toUpperCase()}`
        );
      }
    }

    const updates = [];
    if (oldBooking.passenger.phone !== passenger.phone) {
      updates.push(`SĐT: ${oldBooking.passenger.phone} -> ${passenger.phone}`);
    }
    if (oldBooking.passenger.pickupPoint !== passenger.pickupPoint) {
      updates.push(
        `Điểm đón: ${oldBooking.passenger.pickupPoint || "(Trống)"} -> ${
          passenger.pickupPoint || "(Trống)"
        }`
      );
    }
    if (oldBooking.passenger.dropoffPoint !== passenger.dropoffPoint) {
      updates.push(
        `Điểm trả: ${oldBooking.passenger.dropoffPoint || "(Trống)"} -> ${
          passenger.dropoffPoint || "(Trống)"
        }`
      );
    }

    const cleanOldNote = (oldBooking.passenger.note || "")
      .replace(/\s*\(Chuyển sang [^\)]+\)/g, "")
      .replace(/\s*\(Cần thu thêm: [^\)]+\)/g, "")
      .replace(/\s*\(Cần hoàn lại: [^\)]+\)/g, "")
      .trim();
    const cleanNewNote = (passenger.note || "")
      .replace(/\s*\(Chuyển sang [^\)]+\)/g, "")
      .replace(/\s*\(Cần thu thêm: [^\)]+\)/g, "")
      .replace(/\s*\(Cần hoàn lại: [^\)]+\)/g, "")
      .trim();

    if (cleanOldNote !== cleanNewNote) {
      updates.push(`Ghi chú: ${cleanOldNote || "(Trống)"} -> ${cleanNewNote}`);
    }

    if (updates.length > 0) {
      summaryParts.push(updates.join("; "));
    }

    // Check meaningful changes for logging condition
    const passengerChanged = updates.length > 0;

    const summaryText =
      summaryParts.length > 0
        ? summaryParts.join(" | ")
        : "Cập nhật thông tin đặt vé";

    if (changes.length > 0 || oldStatus !== finalStatus || passengerChanged) {
      await logBookingAction(oldBooking._id, "UPDATE", summaryText, {
        changes,
      });
    }

    oldBooking.passenger = passenger;
    oldBooking.items = bookingItems;
    // oldBooking.status = finalStatus; // REMOVED

    oldBooking.totalPrice = calculatedTotalPrice;
    oldBooking.totalTickets = calculatedTotalTickets;
    oldBooking.updatedAt = new Date().toISOString();
    await oldBooking.save();

    logDebug("[DEBUG_PAYMENT] PUT Handler - Before processPaymentUpdate:", {
      bookingId: oldBooking._id,
      finalStatus,
      payment,
    });
    if (finalStatus !== "hold") {
      await processPaymentUpdate(oldBooking, payment);
    } else {
      logDebug(
        "[DEBUG_PAYMENT] processPaymentUpdate SKIPPED (finalStatus is hold)"
      );
    }

    const allTrips = await Trip.find();
    const result = await getBookingsWithPayment({ _id: oldBooking._id });
    res.json({ booking: result[0], updatedTrips: allTrips });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/bookings/swap", async (req, res) => {
  try {
    const { tripId1, seatId1, tripId2, seatId2 } = req.body;

    // Validate input
    if (!tripId1 || !seatId1 || !tripId2 || !seatId2) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    // Fetch trips
    const trip1 = await Trip.findById(tripId1);
    const trip2 = await Trip.findById(tripId2);

    if (!trip1 || !trip2) {
      return res.status(404).json({ error: "One or more trips not found" });
    }

    // CRITICAL: Validate trip compatibility - only allow swapping within same trip
    if (String(tripId1) !== String(tripId2)) {
      return res.status(400).json({
        error: `Chỉ có thể đổi chỗ trong cùng một chuyến xe.`,
      });
    }

    // Find seat objects
    const s1Obj = trip1.seats.find((s) => String(s.id) === String(seatId1));
    const s2Obj = trip2.seats.find((s) => String(s.id) === String(seatId2));

    if (!s1Obj || !s2Obj) {
      return res.status(404).json({ error: "One or more seats not found" });
    }

    // Helper to find booking containing a specific seat in a trip
    const findBookingForSeat = async (tripId, seatId) => {
      const booking = await Booking.findOne({
        totalTickets: { $gt: 0 },
        items: {
          $elemMatch: {
            tripId: tripId,
            $or: [
              { seatIds: String(seatId) },
              { "tickets.seatId": String(seatId) },
            ],
          },
        },
      });
      return booking;
    };

    // Find bookings for both seats
    const booking1 = await findBookingForSeat(tripId1, seatId1);
    const booking2 = await findBookingForSeat(tripId2, seatId2);

    // At least one seat must be occupied for a swap to make sense
    if (!booking1 && !booking2) {
      return res
        .status(400)
        .json({ error: "Both seats are empty, nothing to swap" });
    }

    // Find tickets and perform direct swap using temp variable
    let ticket1 = null;
    let ticket2 = null;
    let ticket1Index = -1;
    let ticket2Index = -1;
    let item1 = null;
    let item2 = null;

    // Find ticket1 in booking1
    if (booking1) {
      for (const item of booking1.items) {
        if (String(item.tripId) === String(tripId1)) {
          const ticketIndex = item.tickets?.findIndex(
            (t) => String(t.seatId) === String(seatId1)
          );
          if (ticketIndex !== undefined && ticketIndex >= 0) {
            // CRITICAL: Clone the ticket to avoid modifying the original
            ticket1 = JSON.parse(JSON.stringify(item.tickets[ticketIndex]));
            ticket1Index = ticketIndex;
            item1 = item;
            break;
          }
        }
      }
    }

    // Find ticket2 in booking2 (or booking1 if same booking)
    if (booking2) {
      const searchBooking =
        booking1 && String(booking1._id) === String(booking2._id)
          ? booking1
          : booking2;
      for (const item of searchBooking.items) {
        if (String(item.tripId) === String(tripId2)) {
          const ticketIndex = item.tickets?.findIndex(
            (t) => String(t.seatId) === String(seatId2)
          );
          if (ticketIndex !== undefined && ticketIndex >= 0) {
            // CRITICAL: Clone the ticket to avoid modifying the original
            ticket2 = JSON.parse(JSON.stringify(item.tickets[ticketIndex]));
            ticket2Index = ticketIndex;
            item2 = item;
            break;
          }
        }
      }
    }

    if (!ticket1 && !ticket2) {
      return res
        .status(400)
        .json({ error: "Both seats are empty, nothing to swap" });
    }

    console.log("[SWAP_DEBUG] Found tickets:", {
      ticket1: ticket1
        ? { seatId: ticket1.seatId, status: ticket1.status, name: ticket1.name }
        : null,
      ticket2: ticket2
        ? { seatId: ticket2.seatId, status: ticket2.status, name: ticket2.name }
        : null,
      item1_tripId: item1?.tripId,
      item2_tripId: item2?.tripId,
      item1_seatIds: item1?.seatIds,
      item2_seatIds: item2?.seatIds,
      sameItem: item1 === item2,
    });

    // Store original statuses for payment transfer calculation
    const ticket1Status = ticket1?.status || null;
    const ticket2Status = ticket2?.status || null;
    const ticket1Price = ticket1?.price || 0;
    const ticket2Price = ticket2?.price || 0;

    // Perform swap: ONLY swap seatId, keep all other properties
    if (ticket1 && ticket2) {
      // Both tickets exist - swap seatId in place
      const tempSeatId = ticket1.seatId;

      // Get tickets from arrays (direct references)
      const t1 = item1.tickets[ticket1Index];
      const t2 = item2.tickets[ticket2Index];

      // Swap seatId
      t1.seatId = ticket2.seatId;
      t2.seatId = tempSeatId;

      // Rebuild seatIds and mark modified
      item1.seatIds = item1.tickets.map((t) => t.seatId);
      item1.markModified("tickets");
      item1.markModified("seatIds");

      if (item2 && item1 !== item2) {
        item2.seatIds = item2.tickets.map((t) => t.seatId);
        item2.markModified("tickets");
        item2.markModified("seatIds");
      }

      console.log("[SWAP_DEBUG] Same-trip swap:", {
        t1: { seatId: t1.seatId, name: t1.name },
        t2: { seatId: t2.seatId, name: t2.name },
      });

      // No price changes needed
    } else if (ticket1 && !ticket2) {
      // Only ticket1 exists - move it to position 2 (empty seat) within SAME TRIP
      const newTicket = { ...ticket1, seatId: seatId2 };

      // If same item (likely, since same Trip)
      if (item1 === item2) {
        // Just update seatId in place? No, ticket2 position is empty, so we just change seatId of ticket1
        // But wait, ticket2 is null, meaning seat2 is empty. item2 might be same as item1 or potentially undefined if we logic-ed it weirdly, but since same trip, it should be same item usually.
        // Actually, findTicketForSeat logic might return different items if booking structure is fragmented, but for same trip usually 1 item per booking.
        // Let's stick to moving logic.

        // Add to item2 (target)
        item2.tickets = item2.tickets || [];
        item2.tickets.push(newTicket);
        item2.seatIds = item2.tickets.map((t) => t.seatId);
        item2.markModified("tickets");
        item2.markModified("seatIds");

        // Remove from item1
        item1.tickets = item1.tickets.filter((t, i) => i !== ticket1Index);
        item1.seatIds = item1.tickets.map((t) => t.seatId);
        item1.markModified("tickets");
        item1.markModified("seatIds");
      } else {
        // Different items (different bookings on same trip)
        // Add to item2
        item2.tickets = item2.tickets || [];
        item2.tickets.push(newTicket);
        item2.seatIds = item2.tickets.map((t) => t.seatId);
        item2.price = (item2.price || 0) + (newTicket.price || 0);
        // Mark parent booking
        booking2.markModified("items");

        // Remove from item1
        item1.tickets = item1.tickets.filter((t, i) => i !== ticket1Index);
        item1.seatIds = item1.tickets.map((t) => t.seatId);
        item1.price = (item1.price || 0) - (ticket1Price || 0);
        booking1.markModified("items");
      }
    } else if (!ticket1 && ticket2) {
      // Only ticket2 exists - move it to position 1 (empty seat) within SAME TRIP
      const newTicket = { ...ticket2, seatId: seatId1 };

      if (item1 === item2) {
        // Add to item1
        item1.tickets = item1.tickets || [];
        item1.tickets.push(newTicket);
        item1.seatIds = item1.tickets.map((t) => t.seatId);
        item1.markModified("tickets");
        item1.markModified("seatIds");

        // Remove from item2
        item2.tickets = item2.tickets.filter((t, i) => i !== ticket2Index);
        item2.seatIds = item2.tickets.map((t) => t.seatId);
        item2.markModified("tickets");
        item2.markModified("seatIds");
      } else {
        // Different items (different bookings)
        // Add to item1
        item1.tickets = item1.tickets || [];
        item1.tickets.push(newTicket);
        item1.seatIds = item1.tickets.map((t) => t.seatId);
        item1.price = (item1.price || 0) + (newTicket.price || 0);
        booking1.markModified("items");

        // Remove from item2
        item2.tickets = item2.tickets.filter((t, i) => i !== ticket2Index);
        item2.seatIds = item2.tickets.map((t) => t.seatId);
        item2.price = (item2.price || 0) - (ticket2Price || 0);
        booking2.markModified("items");
      }
    }

    // Remove empty items and save bookings
    const saveList = [];

    console.log(
      "[SWAP_DEBUG] Before save - booking1 items:",
      booking1?.items.map((i) => ({
        tripId: i.tripId,
        seatIds: i.seatIds,
        ticketCount: i.tickets?.length,
      }))
    );
    if (booking2 && String(booking1?._id) !== String(booking2._id)) {
      console.log(
        "[SWAP_DEBUG] Before save - booking2 items:",
        booking2.items.map((i) => ({
          tripId: i.tripId,
          seatIds: i.seatIds,
          ticketCount: i.tickets?.length,
        }))
      );
    }

    if (booking1) {
      booking1.items = booking1.items.filter(
        (i) => i.seatIds && i.seatIds.length > 0
      );

      // Recalculate totals
      booking1.totalPrice = booking1.items.reduce(
        (sum, item) => sum + (item.price || 0),
        0
      );
      booking1.totalTickets = booking1.items.reduce(
        (sum, item) => sum + (item.seatIds?.length || 0),
        0
      );

      booking1.markModified("items");
      saveList.push(booking1.save());
    }

    if (
      booking2 &&
      (!booking1 || String(booking1._id) !== String(booking2._id))
    ) {
      booking2.items = booking2.items.filter(
        (i) => i.seatIds && i.seatIds.length > 0
      );

      // Recalculate totals
      booking2.totalPrice = booking2.items.reduce(
        (sum, item) => sum + (item.price || 0),
        0
      );
      booking2.totalTickets = booking2.items.reduce(
        (sum, item) => sum + (item.seatIds?.length || 0),
        0
      );

      booking2.markModified("items");
      saveList.push(booking2.save());
    }

    await Promise.all(saveList);

    // Transfer payments logic REMOVED as requested.

    // Update trip seat statuses (swap the statuses)
    let freshTrip1 = await Trip.findById(tripId1);
    let freshTrip2 = null;

    if (String(tripId1) === String(tripId2)) {
      freshTrip2 = freshTrip1;
    } else {
      freshTrip2 = await Trip.findById(tripId2);
    }

    if (!freshTrip1 || !freshTrip2) {
      throw new Error("Trip disappeared during swap operation");
    }

    const freshS1 = freshTrip1.seats.find(
      (s) => String(s.id) === String(seatId1)
    );
    const freshS2 = freshTrip2.seats.find(
      (s) => String(s.id) === String(seatId2)
    );

    if (freshS1 && freshS2) {
      // Map ticket status to seat status
      const mapTicketStatusToSeatStatus = (ticketStatus) => {
        if (!ticketStatus) return "available";
        if (ticketStatus === "payment") return "sold";
        if (ticketStatus === "hold") return "held";
        return "booked"; // booking or default
      };

      // Use ticket statuses to determine new seat statuses
      const newStatus1 = ticket2Status
        ? mapTicketStatusToSeatStatus(ticket2Status)
        : "available";
      const newStatus2 = ticket1Status
        ? mapTicketStatusToSeatStatus(ticket1Status)
        : "available";

      // Update seats with correct statuses
      freshTrip1.seats = freshTrip1.seats.map((s) => {
        if (String(s.id) === String(seatId1)) {
          return { ...s, status: newStatus1 };
        }
        return s;
      });

      freshTrip2.seats = freshTrip2.seats.map((s) => {
        if (String(s.id) === String(seatId2)) {
          return { ...s, status: newStatus2 };
        }
        return s;
      });

      freshTrip1.markModified("seats");
      if (String(tripId1) !== String(tripId2)) {
        freshTrip2.markModified("seats");
        await Promise.all([freshTrip1.save(), freshTrip2.save()]);
      } else {
        await freshTrip1.save();
      }
    }

    // Log the swap action
    if (booking1) {
      const swapDesc = `Đổi chỗ: ${s1Obj.label} (${trip1.route}) → ${s2Obj.label} (${trip2.route})`;
      await logBookingAction(booking1._id, "SWAP", swapDesc, {
        from: s1Obj.label,
        to: s2Obj.label,
        fromTrip: trip1.route,
        toTrip: trip2.route,
      });
    }

    if (
      booking2 &&
      (!booking1 || String(booking1._id) !== String(booking2._id))
    ) {
      const swapDesc = `Đổi chỗ: ${s2Obj.label} (${trip2.route}) → ${s1Obj.label} (${trip1.route})`;
      await logBookingAction(booking2._id, "SWAP", swapDesc, {
        from: s2Obj.label,
        to: s1Obj.label,
        fromTrip: trip2.route,
        toTrip: trip1.route,
      });
    }

    res.json({
      bookings: await getBookingsWithPayment(),
      trips: await Trip.find(),
    });
  } catch (e) {
    logDebug("[SWAP_ERROR] Exception caught", {
      message: e.message,
      stack: e.stack,
    });
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/bookings/transfer", async (req, res) => {
  try {
    const { bookingId, fromTripId, toTripId, seatTransfers } = req.body;
    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    const fromTrip = await Trip.findById(fromTripId);
    const toTrip = await Trip.findById(toTripId);
    if (!fromTrip || !toTrip)
      return res.status(404).json({ error: "Trips not found" });

    const sourceSeatIds = seatTransfers.map((st) => String(st.sourceSeatId));
    const targetSeatIds = seatTransfers.map((st) => String(st.targetSeatId));

    // Populate seatIds for logic if missing
    booking.items.forEach((item) => {
      if ((!item.seatIds || item.seatIds.length === 0) && item.tickets) {
        item.seatIds = item.tickets.map((t) => t.seatId);
      }
    });

    const sourceItem = booking.items.find((i) => i.tripId === fromTripId);

    if (!sourceItem)
      return res
        .status(404)
        .json({ error: "Source trip item not found in booking" });

    const ticketsToMove = sourceItem.tickets.filter((t) =>
      sourceSeatIds.includes(String(t.seatId))
    );
    const movedTickets = ticketsToMove.map((t) => {
      const transfer = seatTransfers.find(
        (st) => String(st.sourceSeatId) === String(t.seatId)
      );
      const tObj = t.toObject ? t.toObject() : t;
      return { ...tObj, seatId: transfer.targetSeatId };
    });

    fromTrip.seats = fromTrip.seats.map((s) =>
      sourceSeatIds.includes(String(s.id)) ? { ...s, status: "available" } : s
    );
    fromTrip.markModified("seats");
    await fromTrip.save();

    const targetSeatStatus =
      currentStatus === "payment"
        ? "sold"
        : currentStatus === "hold"
        ? "held"
        : "booked";

    toTrip.seats = toTrip.seats.map((s) =>
      targetSeatIds.includes(s.id) ? { ...s, status: targetSeatStatus } : s
    );
    toTrip.markModified("seats");
    await toTrip.save();

    booking.items = booking.items
      .map((item) => {
        if (item.tripId === fromTripId) {
          item.seatIds = item.seatIds.filter(
            (sid) => !sourceSeatIds.includes(sid)
          );
          item.tickets = item.tickets.filter(
            (t) => !sourceSeatIds.includes(t.seatId)
          );
          item.price = item.tickets.reduce((sum, t) => sum + t.price, 0);
        }
        return item;
      })
      .filter((item) => item.seatIds.length > 0);

    let targetItem = booking.items.find((i) => i.tripId === toTripId);
    if (targetItem) {
      targetItem.seatIds.push(...targetSeatIds);
      targetItem.tickets.push(...movedTickets);
      targetItem.price = targetItem.tickets.reduce(
        (sum, t) => sum + t.price,
        0
      );
    } else {
      const route = await Route.findById(toTrip.routeId);
      booking.items.push({
        tripId: toTripId,
        tripDate: toTrip.departureTime,
        route: toTrip.route,
        licensePlate: toTrip.licensePlate,
        seatIds: targetSeatIds,
        tickets: movedTickets,
        price: movedTickets.reduce((sum, t) => sum + t.price, 0),
        isEnhanced: route?.isEnhanced || false,
        busType: toTrip.type,
      });
    }

    booking.updatedAt = new Date().toISOString();
    booking.markModified("items");
    await booking.save();

    const getLabelFromTrip = (trip, id) =>
      trip.seats.find((s) => s.id === id)?.label || id;
    const seatLabels = targetSeatIds.map((sid) =>
      getLabelFromTrip(toTrip, sid)
    );

    const transferDesc = `Điều chuyển ${targetSeatIds.length} vé sang xe ${toTrip.licensePlate} (${toTrip.route})`;
    await logBookingAction(booking._id, "TRANSFER", transferDesc, {
      fromPlate: fromTrip.licensePlate,
      toPlate: toTrip.licensePlate,
      fromRoute: fromTrip.route,
      toRoute: toTrip.route,
      seats: seatLabels,
    });

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch("/api/bookings/:id/tickets/:seatId", async (req, res) => {
  try {
    const { id, seatId } = req.params;
    const { pickup, dropoff, note, phone, name, exactBed, action, payment } =
      req.body;
    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    const currentStatus = await deriveBookingStatus(booking);

    // Populate seatIds for logic if missing
    booking.items.forEach((item) => {
      if ((!item.seatIds || item.seatIds.length === 0) && item.tickets) {
        item.seatIds = item.tickets.map((t) => t.seatId);
      }
    });

    let targetTicket = null;

    let targetItem = null;

    let changes = [];

    const totalSeats = booking.items.reduce(
      (sum, i) => sum + i.seatIds.length,
      0
    );
    const isSingleSeatObj = totalSeats === 1;

    booking.items.forEach((item) => {
      if (item.tickets) {
        const ticket = item.tickets.find((t) => t.seatId === seatId);
        if (ticket) {
          targetTicket = ticket;
          targetItem = item;

          if (pickup !== undefined && ticket.pickup !== pickup) {
            changes.push(
              `Điểm đón: ${ticket.pickup || "(Trống)"} -> ${
                pickup || "(Trống)"
              }`
            );
            ticket.pickup = pickup;
            if (isSingleSeatObj) booking.passenger.pickupPoint = pickup;
          }
          if (dropoff !== undefined && ticket.dropoff !== dropoff) {
            changes.push(
              `Điểm trả: ${ticket.dropoff || "(Trống)"} -> ${
                dropoff || "(Trống)"
              }`
            );
            ticket.dropoff = dropoff;
            if (isSingleSeatObj) booking.passenger.dropoffPoint = dropoff;
          }
          if (note !== undefined && ticket.note !== note) {
            changes.push(
              `Ghi chú: ${ticket.note || "(Trống)"} -> ${note || "(Trống)"}`
            );
            ticket.note = note;
            if (isSingleSeatObj) booking.passenger.note = note;
          }
        }
      }
    });

    if (!targetTicket)
      return res.status(404).json({ error: "Ticket not found" });

    const trip = await Trip.findById(targetItem.tripId);
    const targetSeat = trip?.seats?.find((s) => s.id === seatId);
    const label = targetSeat ? targetSeat.label : seatId;

    if (phone !== undefined && targetTicket.phone !== phone) {
      const oldPhone = targetTicket.phone || booking.passenger.phone;
      if (oldPhone !== phone) {
        changes.push(`SĐT: ${oldPhone} -> ${phone}`);
      }
      targetTicket.phone = phone;

      if (isSingleSeatObj) {
        booking.passenger.phone = phone;
      }
    }
    if (name !== undefined && targetTicket.name !== name) {
      const oldName = targetTicket.name || booking.passenger.name;
      if (oldName !== name) {
        changes.push(`Tên: ${oldName} -> ${name}`);
      }
      targetTicket.name = name;

      if (isSingleSeatObj) {
        booking.passenger.name = name;
      }
    }
    if (exactBed !== undefined && targetTicket.exactBed !== exactBed) {
      const oldState = targetTicket.exactBed ? "Có" : "Không";
      const newState = exactBed ? "Có" : "Không";
      changes.push(`Xếp đúng giường: ${oldState} -> ${newState}`);
      targetTicket.exactBed = exactBed;
    }

    if (changes.length > 0) {
      await logBookingAction(
        booking._id,
        "PASSENGER_UPDATE",
        `Giường ${label} thay đổi thông tin: ${changes.join("; ")}`,
        { seat: label, changes }
      );
    }

    if (action === "PAY" && payment) {
      if (trip) {
        trip.seats = trip.seats.map((s) =>
          String(s.id) === String(seatId) ? { ...s, status: "sold" } : s
        );
        trip.markModified("seats");
        await trip.save();
      }

      const paidAmount = (payment.paidCash || 0) + (payment.paidTransfer || 0);
      targetTicket.price = paidAmount;
      targetTicket.status = "payment"; // ✅ Cập nhật trạng thái ghế sang payment

      const paymentRec = new Payment({
        bookingId: booking._id,
        totalAmount: paidAmount,
        cashAmount: payment.paidCash || 0,
        transferAmount: payment.paidTransfer || 0,
        type: "payment",
        transactionType: "incremental",
        method:
          payment.paidCash && payment.paidTransfer
            ? "mixed"
            : payment.paidCash
            ? "cash"
            : "transfer",
        note: `Thanh toán lẻ ghế ${label}`,
        timestamp: new Date(),
        details: {
          seats: [seatId],
          labels: [label],
          tripDate: targetItem.tripDate,
          route: targetItem.route,
          licensePlate: targetItem.licensePlate,
          trips: [
            {
              tripId: targetItem.tripId,
              route: targetItem.route,
              tripDate: targetItem.tripDate,
              licensePlate: targetItem.licensePlate,
              seats: [seatId],
              labels: [label],
              tickets: [{ ...targetTicket.toObject(), label }],
              busType: targetItem.busType,
              isEnhanced: targetItem.isEnhanced,
            },
          ],
        },
      });
      await paymentRec.save();

      targetItem.price = targetItem.tickets.reduce(
        (sum, t) => sum + (t.price || 0),
        0
      );

      await logBookingAction(
        booking._id,
        "PAY_SEAT",
        `Thu tiền lẻ cho ghế ${label} (${paidAmount.toLocaleString()}đ)`,
        { seat: label, amount: paymentRec.totalAmount }
      );
    }

    if (action === "REFUND") {
      if (trip) {
        trip.seats = trip.seats.map((s) =>
          String(s.id) === String(seatId) ? { ...s, status: "available" } : s
        );
        trip.markModified("seats");
        await trip.save();
      }

      const refundAmount = targetTicket.price || 0;

      if (refundAmount > 0 && currentStatus !== "hold") {
        const paymentRec = new Payment({
          bookingId: booking._id,
          totalAmount: -refundAmount,
          cashAmount: -refundAmount,
          transferAmount: 0,
          type: "refund",
          transactionType: "incremental",
          method: "cash",
          note: `Hoàn tiền & Hủy lẻ ghế ${label}`,
          timestamp: new Date(),
          details: {
            seats: [seatId],
            labels: [label],
            tripDate: targetItem.tripDate,
            route: targetItem.route,
            licensePlate: targetItem.licensePlate,
            trips: [
              {
                tripId: targetItem.tripId,
                route: targetItem.route,
                tripDate: targetItem.tripDate,
                licensePlate: targetItem.licensePlate,
                seats: [seatId],
                labels: [label],
                tickets: [{ ...targetTicket.toObject(), label }],
                busType: targetItem.busType,
                isEnhanced: targetItem.isEnhanced,
              },
            ],
          },
        });
        await paymentRec.save();
      }

      targetItem.seatIds = targetItem.seatIds.filter((sid) => sid !== seatId);
      targetItem.tickets = targetItem.tickets.filter(
        (t) => t.seatId !== seatId
      );
      targetItem.price = targetItem.tickets.reduce(
        (sum, t) => sum + (t.price || 0),
        0
      );

      booking.items = booking.items.filter((item) => item.seatIds.length > 0);
      booking.totalTickets = booking.items.reduce(
        (sum, item) => sum + item.seatIds.length,
        0
      );

      // if (booking.totalTickets === 0) booking.status = "cancelled"; // REMOVED

      await logBookingAction(
        booking._id,
        "REFUND_SEAT",
        `Hoàn vé và hủy lẻ ghế ${label}`,
        { seat: label, amount: refundAmount }
      );
    }

    booking.markModified("items");
    booking.updatedAt = new Date().toISOString();
    await booking.save();

    res.json({
      booking: (
        await getBookingsWithPayment({ _id: new mongoose.Types.ObjectId(id) })
      )[0],
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/bookings/:id", async (req, res) => {
  try {
    const bookingId = req.params.id;
    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    // DESCRIPTION CHI TIẾT KHI XÓA
    const delDesc = `Hủy toàn bộ vé đặt (${booking.totalTickets} vé) - SĐT: ${booking.passenger.phone}`;

    await logBookingAction(booking._id, "DELETE", delDesc, {
      trips: booking.items.map((i) => ({
        route: i.route,
        tripDate: i.tripDate,
        seats: i.seatIds,
        licensePlate: i.licensePlate,
      })),
      totalTickets: booking.totalTickets,
    });

    for (const item of booking.items) {
      const trip = await Trip.findById(item.tripId);
      if (trip) {
        trip.seats = trip.seats.map((s) =>
          item.seatIds.includes(String(s.id))
            ? { ...s, status: "available" }
            : s
        );
        trip.markModified("seats");
        await trip.save();
      }
    }
    await Payment.deleteMany({ bookingId: booking._id });
    await Booking.findByIdAndDelete(bookingId);
    res.json({
      success: true,
      trips: await Trip.find(),
      bookings: await getBookingsWithPayment(),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/payments", async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate("bookingId")
      .sort({ timestamp: -1 });
    res.json(
      payments.map((p) => {
        const doc = p.toJSON();
        doc.amount = doc.totalAmount;
        return doc;
      })
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/payments", async (req, res) => {
  try {
    const payment = new Payment(req.body);
    await payment.save();
    res.json(payment);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/payments/:id", async (req, res) => {
  try {
    res.json(
      await Payment.findByIdAndUpdate(req.params.id, req.body, { new: true })
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/settings/:key", async (req, res) => {
  try {
    const setting = await Setting.findOne({ key: req.params.key });
    res.json(setting ? setting.value : null);
  } catch (e) {
    res.status(500).json({ error: e.message });
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
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/maintenance/fix-seats", async (req, res) => {
  try {
    const allBookings = await Booking.find({ totalTickets: { $gt: 0 } });
    const allTrips = await Trip.find();

    let fixedCount = 0;
    let conflictCount = 0;
    let syncCount = 0;
    const logs = [];

    const bookingOccupancy = new Map();
    allBookings.forEach((b) => {
      if (b.items && Array.isArray(b.items)) {
        b.items.forEach((item) => {
          const tickets = item.tickets || [];
          // Fix: Derive seatIds from tickets if not present (as schema removed seatIds)
          const seatIds =
            item.seatIds && item.seatIds.length > 0
              ? item.seatIds
              : tickets.map((t) => t.seatId);

          seatIds.forEach((seatId) => {
            if (!seatId) return;
            const key = `${item.tripId}_${seatId}`;
            const ticketDetail = tickets.find((t) => t.seatId === seatId);

            if (!bookingOccupancy.has(key)) bookingOccupancy.set(key, []);
            bookingOccupancy.get(key).push({
              bookingId: b._id.toString(),
              phone: b.passenger?.phone,
              ticketStatus: ticketDetail ? ticketDetail.status : "booking", // NEW: Use ticket status
              ticketPrice: ticketDetail ? ticketDetail.price : 0,
              updatedAt: b.updatedAt,
            });
          });
        });
      }
    });

    for (const trip of allTrips) {
      let isModified = false;
      const tripId = trip._id.toString();
      const tripDate = trip.departureTime.split(" ")[0];

      trip.seats = await Promise.all(
        trip.seats.map(async (s) => {
          const key = `${tripId}_${s.id}`;
          const bookingsInSeat = bookingOccupancy.get(key) || [];

          if (bookingsInSeat.length > 1) {
            conflictCount++;
            bookingsInSeat.sort((a, b) => {
              return (
                b.ticketPrice - a.ticketPrice ||
                new Date(b.updatedAt) - new Date(a.updatedAt)
              );
            });

            const winner = bookingsInSeat[0];
            const losers = bookingsInSeat.slice(1);

            for (const loser of losers) {
              const bDoc = await Booking.findById(loser.bookingId);
              if (bDoc) {
                bDoc.items = bDoc.items
                  .map((item) => {
                    if (item.tripId === tripId) {
                      item.seatIds = item.seatIds.filter((sid) => sid !== s.id);
                      item.tickets = item.tickets.filter(
                        (tic) => tic.seatId !== s.id
                      );
                    }
                    return item;
                  })
                  .filter((item) => item.seatIds.length > 0);

                bDoc.totalTickets = bDoc.items.reduce(
                  (sum, i) => sum + i.seatIds.length,
                  0
                );
                if (bDoc.totalTickets === 0) bDoc.status = "cancelled";
                bDoc.markModified("items");
                await bDoc.save();
              }
            }
            logs.push({
              route: trip.route,
              date: tripDate,
              seat: s.label,
              action: "Xử lý trùng ghế",
              details: `Giữ lại vé: ${winner.phone}, Loại bỏ ${losers.length} vé trùng.`,
            });
          }

          const activeBooking = bookingsInSeat[0];

          if (activeBooking) {
            let targetStatus = "booked";
            if (activeBooking.ticketStatus === "hold") {
              targetStatus = "held";
            } else {
              targetStatus = activeBooking.ticketPrice > 0 ? "sold" : "booked";
            }

            if (s.status !== targetStatus) {
              isModified = true;
              syncCount++;
              logs.push({
                route: trip.route,
                date: tripDate,
                seat: s.label,
                action: "Đồng bộ màu sắc",
                details: `Chuyển từ ${s.status} sang ${targetStatus} (Giá thu: ${activeBooking.ticketPrice}).`,
              });
              return { ...s, status: targetStatus };
            }
          } else {
            if (s.status !== "available") {
              isModified = true;
              fixedCount++;
              logs.push({
                route: trip.route,
                date: tripDate,
                seat: s.label,
                action: "Giải phóng ghế lỗi",
                details: "Đưa ghế về trạng thái Trống.",
              });
              return { ...s, status: "available" };
            }
          }
          return s;
        })
      );

      if (isModified) {
        trip.markModified("seats");
        await trip.save();
      }
    }

    res.json({ success: true, fixedCount, conflictCount, syncCount, logs });
  } catch (e) {
    console.error("Maintenance Error:", e);
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/maintenance/fix-payments", async (req, res) => {
  try {
    const logs = [];
    let deletedCount = 0;
    let fixedCount = 0;
    let mismatchCount = 0;

    // 1. Lấy tất cả bookings và payments
    const allBookings = await Booking.find({ status: { $ne: "cancelled" } });
    const allPayments = await Payment.find().populate("bookingId");

    // 2. Xóa payments mồ côi (không có bookingId hoặc booking không tồn tại)
    const orphanPayments = allPayments.filter((p) => !p.bookingId);
    for (const payment of orphanPayments) {
      await Payment.findByIdAndDelete(payment._id);
      deletedCount++;
      logs.push({
        route: payment.details?.route || "N/A",
        date: payment.timestamp.toLocaleDateString("vi-VN"),
        seat: (payment.details?.labels || []).join(", ") || "N/A",
        action: "Xóa payment mồ côi",
        details: `Xóa payment ${payment.totalAmount.toLocaleString()}đ không có booking gốc.`,
      });
    }

    // 3. Xóa payments của booking HOLD (đơn HOLD không được phép có thanh toán)
    const holdPayments = allPayments.filter(
      (p) => p.bookingId && p.bookingId.status === "hold"
    );
    for (const payment of holdPayments) {
      await Payment.findByIdAndDelete(payment._id);
      deletedCount++;
      logs.push({
        route:
          payment.details?.route || payment.bookingId.items[0]?.route || "N/A",
        date: payment.timestamp.toLocaleDateString("vi-VN"),
        seat: (payment.details?.labels || []).join(", ") || "N/A",
        action: "Xóa payment HOLD",
        details: `Xóa payment ${payment.totalAmount.toLocaleString()}đ vì booking đang ở trạng thái HOLD (SĐT: ${
          payment.bookingId.passenger?.phone || "N/A"
        }).`,
      });
    }

    // 4. Phát hiện chênh lệch số tiền và sửa lỗi cho từng booking
    for (const booking of allBookings) {
      // Tính tổng tiền payment thực tế
      const payments = await Payment.find({ bookingId: booking._id });
      const totalPaid = payments.reduce(
        (sum, p) => sum + (p.totalAmount || 0),
        0
      );

      // Tính tổng giá vé thực tế từ booking (từ tickets)
      const actualBookingPrice = booking.items.reduce((sum, item) => {
        const itemPrice = (item.tickets || []).reduce(
          (s, t) => s + (t.price || 0),
          0
        );
        return sum + itemPrice;
      }, 0);

      // So sánh và phát hiện chênh lệch giữa payment và booking
      const difference = totalPaid - actualBookingPrice;

      if (Math.abs(difference) > 1) {
        mismatchCount++;
        const diffStr =
          difference > 0
            ? `Thừa ${Math.abs(difference).toLocaleString()}đ`
            : `Thiếu ${Math.abs(difference).toLocaleString()}đ`;

        // Lấy labels thực tế của ghế
        const seatLabels = [];
        for (const item of booking.items) {
          const trip = await Trip.findById(item.tripId);
          for (const ticket of item.tickets || []) {
            const seat = trip?.seats?.find((s) => s.id === ticket.seatId);
            seatLabels.push(seat?.label || ticket.seatId);
          }
        }

        logs.push({
          route: booking.items[0]?.route || "N/A",
          date: booking.createdAt.split("T")[0],
          seat: seatLabels.join(", ") || "N/A",
          action: "Chênh lệch thanh toán",
          details: `Giá vé: ${actualBookingPrice.toLocaleString()}đ, Đã thu: ${totalPaid.toLocaleString()}đ. ${diffStr}. SĐT: ${
            booking.passenger?.phone || "N/A"
          }`,
          bookingId: booking._id.toString(),
          actualPrice: actualBookingPrice,
          paidAmount: totalPaid,
        });
      }

      // 5. Sửa lỗi tổng tiền booking nếu totalPrice không khớp với tổng tickets
      if (Math.abs(booking.totalPrice - actualBookingPrice) > 1) {
        const oldPrice = booking.totalPrice;
        booking.totalPrice = actualBookingPrice;
        await booking.save();
        fixedCount++;

        logs.push({
          route: booking.items[0]?.route || "N/A",
          date: booking.createdAt.split("T")[0],
          seat: "Tổng đơn",
          action: "Sửa tổng tiền",
          details: `Sửa totalPrice: ${oldPrice.toLocaleString()}đ → ${actualBookingPrice.toLocaleString()}đ`,
        });
      }
    }

    res.json({
      success: true,
      deletedCount,
      fixedCount,
      mismatchCount,
      logs,
    });
  } catch (e) {
    console.error("Payment Maintenance Error:", e);
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/maintenance/fix-floor-seats", async (req, res) => {
  try {
    const logs = [];
    let busUpdateCount = 0;
    let tripUpdateCount = 0;

    // 1. Fix Bus Configurations
    const sleeperBuses = await Bus.find({ type: "SLEEPER" });
    for (const bus of sleeperBuses) {
      let isModified = false;

      // Ensure config exists
      if (!bus.layoutConfig) continue;

      // Fix count
      if (
        bus.layoutConfig.floorSeatCount > 6 ||
        bus.layoutConfig.floorSeatCount === undefined
      ) {
        if (bus.layoutConfig.hasFloorSeats) {
          bus.layoutConfig.floorSeatCount = 6;
          isModified = true;
        }
      }

      // Fix activeSeats (remove 1-floor-6 to 1-floor-11)
      const invalidSeats = [
        "1-floor-6",
        "1-floor-7",
        "1-floor-8",
        "1-floor-9",
        "1-floor-10",
        "1-floor-11",
      ];
      const originalCount = bus.layoutConfig.activeSeats.length;
      bus.layoutConfig.activeSeats = bus.layoutConfig.activeSeats.filter(
        (s) => !invalidSeats.includes(s)
      );

      if (bus.layoutConfig.activeSeats.length !== originalCount) {
        isModified = true;
      }

      if (isModified) {
        bus.markModified("layoutConfig");
        await bus.save();
        busUpdateCount++;
        logs.push({
          route: "N/A",
          date: new Date().toLocaleDateString("vi-VN"),
          seat: "Cấu hình xe",
          action: "Sửa cấu hình Bus",
          details: `Cập nhật xe ${bus.plate}: Giới hạn 6 ghế sàn.`,
        });
      }
    }

    // 2. Fix Existing Trips
    const sleeperTrips = await Trip.find({ type: "SLEEPER" });
    for (const trip of sleeperTrips) {
      if (!trip.seats) continue;

      const initialLength = trip.seats.length;

      // Filter out seats that are floor seats AND (have high IDs OR high labels)
      trip.seats = trip.seats.filter((s) => {
        if (!s.isFloorSeat) return true;

        // Helper to extract number from "Sàn X" or "1-floor-X"
        const isHighIndex = (() => {
          if (s.id.includes("1-floor-")) {
            const part = parseInt(s.id.split("1-floor-")[1]);
            if (!isNaN(part) && part >= 6) return true;
          }
          if (s.label.includes("Sàn")) {
            const part = parseInt(s.label.split("Sàn")[1].trim());
            if (!isNaN(part) && part > 6) return true;
          }
          return false;
        })();

        return !isHighIndex;
      });

      if (trip.seats.length !== initialLength) {
        trip.markModified("seats");
        await trip.save();
        tripUpdateCount++;
        logs.push({
          route: trip.route,
          date: trip.departureTime.split(" ")[0],
          seat: "Sơ đồ ghế",
          action: "Xóa ghế thừa",
          details: `Chuyến ${trip.licensePlate} (${trip.departureTime}): Xóa ${
            initialLength - trip.seats.length
          } ghế sàn thừa (Sàn 7-12).`,
        });
      }
    }

    res.json({ success: true, busUpdateCount, tripUpdateCount, logs });
  } catch (e) {
    console.error("Floor Seat Fix Error:", e);
    res.status(500).json({ error: e.message });
  }
});

// Reset Bus Configs to Standard Defaults
app.post("/api/maintenance/reset-bus-configs", async (req, res) => {
  try {
    const logs = [];
    let cabinCount = 0;
    let sleeperCount = 0;

    const buses = await Bus.find();

    for (const bus of buses) {
      const isCabin = bus.type === "CABIN";
      let defaultConfig;

      if (isCabin) {
        // CABIN: 24 phòng + 6 sàn = 30 chỗ
        const active = [];
        for (let f = 1; f <= 2; f++) {
          for (let r = 0; r < 6; r++) {
            for (let c = 0; c < 2; c++) {
              active.push(`${f}-${r}-${c}`);
            }
          }
        }
        for (let i = 0; i < 6; i++) {
          active.push(`1-floor-${i}`);
        }

        const labels = {};
        for (let i = 0; i < 6; i++) {
          labels[`1-floor-${i}`] = `Sàn ${i + 1}`;
        }
        for (let c = 0; c < 2; c++) {
          const prefix = c === 0 ? "B" : "A";
          for (let f = 1; f <= 2; f++) {
            for (let r = 0; r < 6; r++) {
              const key = `${f}-${r}-${c}`;
              const num = r * 2 + f;
              labels[key] = `${prefix}${num}`;
            }
          }
        }

        defaultConfig = {
          floors: 2,
          rows: 6,
          cols: 2,
          activeSeats: active,
          seatLabels: labels,
          hasRearBench: false,
          benchFloors: [],
          hasFloorSeats: true,
          floorSeatCount: 6,
        };
        cabinCount++;
      } else {
        // SLEEPER: 36 giường + băng tầng 2 = 41 chỗ
        const active = [];
        for (let f = 1; f <= 2; f++) {
          for (let r = 0; r < 6; r++) {
            for (let c = 0; c < 3; c++) {
              active.push(`${f}-${r}-${c}`);
            }
          }
        }
        for (let i = 0; i < 5; i++) {
          active.push(`2-bench-${i}`);
        }

        const labels = {};
        const regularSeats = active.filter((k) => !k.includes("bench"));
        regularSeats.sort((a, b) => {
          const [af, ar, ac] = a.split("-").map(Number);
          const [bf, br, bc] = b.split("-").map(Number);
          if (ar !== br) return ar - br;
          if (af !== bf) return af - bf;
          return ac - bc;
        });
        regularSeats.forEach((key, idx) => {
          labels[key] = (idx + 1).toString();
        });

        defaultConfig = {
          floors: 2,
          rows: 6,
          cols: 3,
          activeSeats: active,
          seatLabels: labels,
          hasRearBench: false,
          benchFloors: [2],
          hasFloorSeats: false,
          floorSeatCount: 0,
        };
        sleeperCount++;
      }

      bus.layoutConfig = defaultConfig;
      bus.markModified("layoutConfig");
      await bus.save();

      logs.push({
        route: "N/A",
        date: new Date().toLocaleDateString("vi-VN"),
        seat: "Bus Config",
        action: `Reset ${bus.type}`,
        details: `Reset xe ${bus.plate}: ${defaultConfig.activeSeats.length} ghế`,
      });
    }

    res.json({
      logs,
      cabinCount,
      sleeperCount,
      totalCount: buses.length,
    });
  } catch (e) {
    console.error("Reset bus configs error:", e);
    res.status(500).json({ error: e.message });
  }
});

// Sync Trip Seatmaps from Bus Configs (NO bus config changes)
app.post("/api/maintenance/sync-bus-layouts", async (req, res) => {
  try {
    const logs = [];
    let tripUpdateCount = 0;

    const buses = await Bus.find();

    for (const bus of buses) {
      // KHÔNG thay đổi bus.layoutConfig - chỉ đọc config hiện tại
      const config = bus.layoutConfig;
      if (!config || !config.activeSeats) {
        logs.push({
          route: "N/A",
          date: new Date().toLocaleDateString("vi-VN"),
          seat: "Skip",
          action: "No Config",
          details: `Bỏ qua xe ${bus.plate}: không có layoutConfig`,
        });
        continue;
      }

      // Sync trips với bus này
      const trips = await Trip.find({ licensePlate: bus.plate });

      console.log(
        `[DEBUG] Syncing bus ${bus.plate} (${bus.type}): ${config.activeSeats.length} seats in config, ${trips.length} trips found`
      );

      for (const trip of trips) {
        // Generate seats từ bus config HIỆN TẠI
        const newSeats = config.activeSeats.map((key) => {
          const parts = key.split("-");
          const floor = parseInt(parts[0]);
          const label = config.seatLabels[key] || key;

          // Parse row, col từ seat ID
          let row = 0;
          let col = 0;
          let isFloorSeat = false;
          let isBench = false;

          if (key.includes("floor")) {
            // Floor seat: "1-floor-0"
            isFloorSeat = true;
            row = parseInt(parts[2]);
          } else if (key.includes("bench")) {
            // Bench seat: "2-bench-0"
            isBench = true;
            row = 6; // Row 6 - sau các regular seats (0-5)
            col = parseInt(parts[2]);
          } else {
            // Regular seat: "1-0-0" (floor-row-col)
            row = parseInt(parts[1]);
            col = parseInt(parts[2]);
          }

          return {
            id: key, // ✅ Dùng position-based ID cho TẤT CẢ: stable khi đổi label
            label: label, // Label chỉ là display name, có thể đổi tùy ý
            status: "available",
            floor: floor,
            row: row,
            col: col,
            isFloorSeat: isFloorSeat,
            isBench: isBench,
          };
        });

        // Preserve booking status for matching seats only
        if (trip.seats && trip.seats.length > 0) {
          let preservedCount = 0;

          trip.seats.forEach((oldSeat) => {
            const newSeat = newSeats.find(
              (s) => String(s.id) === String(oldSeat.id)
            );
            if (newSeat && oldSeat.status !== "available") {
              // Match found - preserve status
              newSeat.status = oldSeat.status;
              preservedCount++;
            }
            // No else - seats không match sẽ bị bỏ qua
          });

          if (preservedCount > 0) {
            console.log(
              `[DEBUG] Preserved ${preservedCount} booking statuses for trip ${trip.id}`
            );
          }
        }

        console.log(
          `[DEBUG] Trip ${trip.id} (${trip.type || "NO TYPE"}): Old seats: ${
            trip.seats?.length || 0
          }, New seats: ${newSeats.length}`
        );

        trip.seats = newSeats;
        trip.markModified("seats");
        await trip.save();
        tripUpdateCount++;

        logs.push({
          route: trip.route || "N/A",
          date: trip.departureTime || new Date().toLocaleDateString("vi-VN"),
          seat: "Trip Seats",
          action: "Sync từ Bus",
          details: `Sync chuyến ${trip.licensePlate}: ${newSeats.length} ghế (${bus.type})`,
        });
      }
    }

    res.json({
      logs,
      tripUpdateCount,
      totalCount: buses.length,
    });
  } catch (e) {
    console.error("Sync trip seatmaps error:", e);
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, "0.0.0.0", async () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});
