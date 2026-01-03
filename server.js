import express from "express";
import mongoose from "mongoose";
import { defineConfig, loadEnv } from "vite";
import cors from "cors";
import bodyParser from "body-parser";

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
    phone: String, // NEW
  },
  { _id: false }
);

const bookingItemSchema = new mongoose.Schema(
  {
    tripId: String,
    tripDate: String,
    route: String,
    licensePlate: String,
    seatIds: [String],
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
    status: String,
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

const Bus = mongoose.model("Bus", busSchema);
const Route = mongoose.model("Route", routeSchema);
const Trip = mongoose.model("Trip", tripSchema);
const Booking = mongoose.model("Booking", bookingSchema);
const Payment = mongoose.model("Payment", paymentSchema);
const History = mongoose.model("History", historySchema);
const Setting = mongoose.model("Setting", settingSchema);

// --- HELPERS ---

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
  if (totalDelta === 0 && cashDelta === 0 && transferDelta === 0) return;

  const type = totalDelta >= 0 ? "payment" : "refund";
  let method = "mixed";
  if (transferDelta === 0 && cashDelta !== 0) method = "cash";
  else if (cashDelta === 0 && transferDelta !== 0) method = "transfer";

  // Cải tiến: Luôn đảm bảo trip metadata đầy đủ nhất
  const enrichedTrips = await Promise.all(
    booking.items.map(async (i) => {
      const trip = await Trip.findById(i.tripId);
      const route = trip ? await Route.findById(trip.routeId) : null;

      // Thu thập nhãn ghế cho báo cáo chính xác
      const seatLabels = i.seatIds.map((sid) => {
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
      seats: booking.items.flatMap((i) => i.seatIds),
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
  return await Booking.aggregate([
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
};

// --- ROUTES ---

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

app.get("/api/bookings/:id/history", async (req, res) => {
  try {
    res.json(
      await History.find({ bookingId: req.params.id }).sort({ timestamp: -1 })
    );
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

      const tickets =
        item.tickets ||
        item.seats.map((s) => ({
          seatId: s.id,
          price:
            finalStatus === "payment"
              ? s.price
              : finalStatus === "hold"
              ? 0
              : 0,
          pickup: passenger.pickupPoint || "",
          dropoff: passenger.dropoffPoint || "",
          note: "",
          name: passenger.name || "", // Default from booking passenger
          phone: passenger.phone || "", // Default from booking passenger
        }));

      const seatIds = tickets.map((t) => t.seatId);
      const itemPrice = tickets.reduce((sum, t) => sum + (t.price || 0), 0);
      calculatedTotalPrice +=
        item.price || item.seats.reduce((s, ss) => s + ss.price, 0);
      calculatedTotalTickets += seatIds.length;

      bookingItems.push({
        tripId: trip.id,
        tripDate: trip.departureTime,
        route: trip.route,
        licensePlate: trip.licensePlate,
        seatIds,
        tickets,
        price: itemPrice,
        isEnhanced,
        busType: trip.type,
      });

      logTripDetails.push({
        route: trip.route,
        tripDate: trip.departureTime,
        seats: seatIds,
        licensePlate: trip.licensePlate,
      });
    }

    const targetSeatStatus =
      finalStatus === "payment"
        ? "sold"
        : finalStatus === "hold"
        ? "held"
        : "booked";

    for (const item of bookingItems) {
      const trip = await Trip.findById(item.tripId);
      if (trip) {
        trip.seats = trip.seats.map((s) =>
          item.seatIds.includes(s.id) ? { ...s, status: targetSeatStatus } : s
        );
        trip.markModified("seats");
        await trip.save();
        updatedTrips.push(trip);
      }
    }

    const booking = new Booking({
      passenger,
      items: bookingItems,
      status: finalStatus,
      createdAt: now,
      updatedAt: now,
      totalPrice: calculatedTotalPrice,
      totalTickets: calculatedTotalTickets,
    });
    await booking.save();

    // TẠO DESCRIPTION CHI TIẾT
    const routeSummary = bookingItems.map((i) => i.route).join(", ");
    const createDesc = `Đặt/Mua (${calculatedTotalTickets} vé) - Tuyến: ${routeSummary}`;

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

    // Thu thập danh sách ghế cũ để so sánh
    const oldSeatMap = new Map();
    oldBooking.items.forEach((i) =>
      oldSeatMap.set(i.tripId, {
        seats: new Set(i.seatIds),
        route: i.route,
        date: i.tripDate,
      })
    );

    // Release old seats in trips
    for (const oldItem of oldBooking.items) {
      const trip = await Trip.findById(oldItem.tripId);
      if (trip) {
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

    const totalPaid = (payment?.paidCash || 0) + (payment?.transfer || 0); // Corrected from payment?.paidTransfer
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

      const tickets =
        item.tickets ||
        item.seats.map((s) => ({
          seatId: s.id,
          price:
            finalStatus === "payment"
              ? s.price
              : finalStatus === "hold"
              ? 0
              : 0,
          pickup: passenger.pickupPoint || "",
          dropoff: passenger.dropoffPoint || "",
          note: "",
          name: passenger.name || "", // Default from booking passenger
          phone: passenger.phone || "", // Default from booking passenger
        }));
      const seatIds = tickets.map((t) => t.seatId);
      const itemPrice = tickets.reduce((sum, t) => sum + (t.price || 0), 0);
      calculatedTotalPrice +=
        item.price || item.seats.reduce((s, ss) => s + ss.price, 0);
      calculatedTotalTickets += seatIds.length;

      bookingItems.push({
        tripId: trip.id,
        tripDate: trip.departureTime,
        route: trip.route,
        licensePlate: trip.licensePlate,
        seatIds,
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

      if (removed.length > 0 || added.length > 0) {
        const getLabel = (id) =>
          trip.seats.find((s) => s.id === id)?.label || id;
        changes.push({
          route: trip.route,
          date: trip.departureTime,
          removed: removed.map(getLabel),
          added: added.map(getLabel),
          kept: kept.map(getLabel),
        });
      }
    }

    // Kiểm tra xem có trip nào bị xóa hoàn toàn không
    const currentTripIds = new Set(bookingItems.map((i) => i.tripId));
    for (const [tripId, data] of oldSeatMap.entries()) {
      if (!currentTripIds.has(tripId)) {
        changes.push({
          route: data.route,
          date: data.date,
          removed: [...data.seats],
          added: [],
          kept: [],
        });
      }
    }

    const targetSeatStatus =
      finalStatus === "payment"
        ? "sold"
        : finalStatus === "hold"
        ? "held"
        : "booked";

    for (const item of bookingItems) {
      const trip = await Trip.findById(item.tripId);
      if (trip) {
        trip.seats = trip.seats.map((s) =>
          item.seatIds.includes(String(s.id))
            ? { ...s, status: targetSeatStatus }
            : s
        );
        trip.markModified("seats");
        await trip.save();
      }
    }

    // TẠO MÔ TẢ CHI TIẾT KHI CẬP NHẬT
    let summaryParts = [];
    if (changes.length > 0) {
      const changeStr = changes
        .map((c) => {
          let part = "";
          if (c.added.length > 0) part += `Thêm ${c.added.join(",")}`;
          if (c.removed.length > 0)
            part += `${part ? "; " : ""}Hủy ${c.removed.join(",")}`;
          return `${c.route}: ${part}`;
        })
        .join(" | ");
      summaryParts.push(changeStr);
    }

    if (oldBooking.status !== finalStatus) {
      summaryParts.push(
        `Chuyển trạng thái: ${oldBooking.status.toUpperCase()} -> ${finalStatus.toUpperCase()}`
      );
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

    if (
      changes.length > 0 ||
      oldBooking.status !== finalStatus ||
      passengerChanged
    ) {
      await logBookingAction(oldBooking._id, "UPDATE", summaryText, {
        changes,
      });
    }

    oldBooking.passenger = passenger;
    oldBooking.items = bookingItems;
    oldBooking.status = finalStatus;
    oldBooking.totalPrice = calculatedTotalPrice;
    oldBooking.totalTickets = calculatedTotalTickets;
    oldBooking.updatedAt = new Date().toISOString();
    await oldBooking.save();

    if (finalStatus !== "hold") {
      await processPaymentUpdate(oldBooking, payment);
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
    const { tripId, seatId1, seatId2 } = req.body;
    const trip = await Trip.findById(tripId);
    if (!trip) return res.status(404).json({ error: "Trip not found" });

    const booking1 = await Booking.findOne({
      status: { $ne: "cancelled" },
      items: { $elemMatch: { tripId, seatIds: seatId1 } },
    });
    if (!booking1) {
      const s1 = trip.seats.find((s) => String(s.id) === String(seatId1));
      if (s1 && s1.status !== "available") {
        trip.seats = trip.seats.map((s) =>
          String(s.id) === String(seatId1) ? { ...s, status: "available" } : s
        );
        trip.markModified("seats");
        await trip.save();
      }
      return res
        .status(404)
        .json({ error: "Ghế nguồn không có số điện thoại thực tế" });
    }

    const booking2 = await Booking.findOne({
      status: { $ne: "cancelled" },
      items: { $elemMatch: { tripId, seatIds: seatId2 } },
    });

    if (booking2) {
      if (booking1._id.equals(booking2._id)) {
        booking1.items = booking1.items.map((item) => {
          if (item.tripId === tripId) {
            const newSeatIds = item.seatIds.map((s) =>
              s === seatId1 ? seatId2 : s === seatId2 ? seatId1 : s
            );
            const newTickets = item.tickets.map((t) =>
              t.seatId === seatId1
                ? { ...t, seatId: seatId2 }
                : t.seatId === seatId2
                ? { ...t, seatId: seatId1 }
                : t
            );
            return { ...item, seatIds: newSeatIds, tickets: newTickets };
          }
          return item;
        });
        booking1.markModified("items");
        await booking1.save();
      } else {
        booking1.items = booking1.items.map((item) => {
          if (item.tripId === tripId) {
            const newSeatIds = item.seatIds.map((s) =>
              s === seatId1 ? seatId2 : s
            );
            const newTickets = item.tickets.map((t) =>
              t.seatId === seatId1 ? { ...t, seatId: seatId2 } : t
            );
            return { ...item, seatIds: newSeatIds, tickets: newTickets };
          }
          return item;
        });
        booking2.items = booking2.items.map((item) => {
          if (item.tripId === tripId) {
            const newSeatIds = item.seatIds.map((s) =>
              s === seatId2 ? seatId1 : s
            );
            const newTickets = item.tickets.map((t) =>
              t.seatId === seatId2 ? { ...t, seatId: seatId1 } : t
            );
            return { ...item, seatIds: newSeatIds, tickets: newTickets };
          }
          return item;
        });
        const s1 = trip.seats.find((s) => String(s.id) === String(seatId1));
        const s2 = trip.seats.find((s) => String(s.id) === String(seatId2));
        if (!s1 || !s2)
          return res.status(404).json({ error: "One or both seats not found" });

        trip.seats = trip.seats.map((s) => {
          if (String(s.id) === String(seatId1))
            return { ...s, status: s2.status, label: s2.label };
          if (String(s.id) === String(seatId2))
            return { ...s, status: s1.status, label: s1.label };
          return s;
        });
        booking1.markModified("items");
        booking2.markModified("items");
        trip.markModified("seats");
        await booking1.save();
        await booking2.save();
        await trip.save();
      }
    } else {
      booking1.items = booking1.items.map((item) => {
        if (item.tripId === tripId) {
          const newSeatIds = item.seatIds.map((s) =>
            String(s) === String(seatId1) ? seatId2 : s
          );
          const newTickets = item.tickets.map((t) =>
            String(t.seatId) === String(seatId1) ? { ...t, seatId: seatId2 } : t
          );
          return { ...item, seatIds: newSeatIds, tickets: newTickets };
        }
        return item;
      });
      const s1 = trip.seats.find((s) => String(s.id) === String(seatId1));
      if (!s1) return res.status(404).json({ error: "Seat 1 not found" });
      const status1 = s1.status;
      trip.seats = trip.seats.map((s) =>
        String(s.id) === String(seatId1)
          ? { ...s, status: "available" }
          : String(s.id) === String(seatId2)
          ? { ...s, status: status1 }
          : s
      );
      booking1.markModified("items");
      trip.markModified("seats");
      await booking1.save();
      await trip.save();
    }
    const s1Obj = trip.seats.find((s) => String(s.id) === String(seatId1));
    const s2Obj = trip.seats.find((s) => String(s.id) === String(seatId2));

    const swapDesc = `Đổi chỗ: Ghế ${s1Obj.label} -> Ghế ${s2Obj.label} (Xe ${trip.licensePlate})`;
    await logBookingAction(booking1._id, "SWAP", swapDesc, {
      from: s1Obj.label,
      to: s2Obj.label,
      route: trip.route,
      date: trip.departureTime,
    });

    res.json({
      bookings: await getBookingsWithPayment(),
      trips: await Trip.find(),
    });
  } catch (e) {
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
      booking.status === "payment"
        ? "sold"
        : booking.status === "hold"
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
    const { pickup, dropoff, note, phone, name, action, payment } = req.body;
    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ error: "Booking not found" });

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

      if (refundAmount > 0 && booking.status !== "hold") {
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

      if (booking.totalTickets === 0) booking.status = "cancelled";

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
    const allBookings = await Booking.find({ status: { $ne: "cancelled" } });
    const allTrips = await Trip.find();

    let fixedCount = 0;
    let conflictCount = 0;
    let syncCount = 0;
    const logs = [];

    const bookingOccupancy = new Map();
    allBookings.forEach((b) => {
      b.items.forEach((item) => {
        const tickets = item.tickets || [];

        item.seatIds.forEach((seatId) => {
          const key = `${item.tripId}_${seatId}`;
          const ticketDetail = tickets.find((t) => t.seatId === seatId);

          if (!bookingOccupancy.has(key)) bookingOccupancy.set(key, []);
          bookingOccupancy.get(key).push({
            bookingId: b._id.toString(),
            phone: b.passenger?.phone,
            bookingStatus: b.status,
            ticketPrice: ticketDetail ? ticketDetail.price : 0,
            updatedAt: b.updatedAt,
          });
        });
      });
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
            if (activeBooking.bookingStatus === "hold") {
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
    const allPayments = await Payment.find().populate("bookingId");

    for (const payment of allPayments) {
      if (payment.bookingId && payment.bookingId.status === "hold") {
        await Payment.findByIdAndDelete(payment._id);
        deletedCount++;
        logs.push({
          route: payment.details?.route || "N/A",
          date: payment.timestamp.toLocaleDateString("vi-VN"),
          seat: (payment.details?.seats || []).join(", "),
          action: "Xóa giao dịch lỗi",
          details: `Giao dịch ${payment.totalAmount.toLocaleString()}đ bị xóa vì vé đặt đang ở trạng thái HOLD.`,
        });
      } else if (!payment.bookingId) {
        await Payment.findByIdAndDelete(payment._id);
        deletedCount++;
        logs.push({
          route: payment.details?.route || "N/A",
          date: payment.timestamp.toLocaleDateString("vi-VN"),
          seat: (payment.details?.seats || []).join(", "),
          action: "Xóa giao dịch mồ côi",
          details: `Giao dịch ${payment.totalAmount.toLocaleString()}đ bị xóa vì không tìm thấy vé đặt gốc.`,
        });
      }
    }

    res.json({ success: true, deletedCount, logs });
  } catch (e) {
    console.error("Payment Maintenance Error:", e);
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, "0.0.0.0", async () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});
