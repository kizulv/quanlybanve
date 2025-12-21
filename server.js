
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
    transactionType: { type: String, default: 'snapshot' }, // 'snapshot' | 'incremental'
    note: String,
    timestamp: { type: Date, default: Date.now },
    performedBy: String,
    details: {
      seats: [String],
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
      enum: ["CREATE", "UPDATE", "CANCEL", "SWAP", "PASSENGER_UPDATE", "DELETE", "TRANSFER", "PAY_SEAT", "REFUND_SEAT"],
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

const logBookingAction = async (bookingId, action, description, details = {}) => {
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
  const paidTransfer = payments.reduce((sum, p) => sum + (p.transferAmount || 0), 0);
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

  const paymentRecord = new Payment({
    bookingId: booking._id,
    totalAmount: totalDelta,
    cashAmount: cashDelta,
    transferAmount: transferDelta,
    type,
    transactionType: 'snapshot', 
    method,
    note: type === "refund" ? "Hoàn tiền" : "Thanh toán/Cập nhật",
    timestamp: new Date(),
    details: {
      seats: booking.items.flatMap(i => i.seatIds),
      tripDate: booking.items[0]?.tripDate,
      route: booking.items[0]?.route,
      licensePlate: booking.items[0]?.licensePlate,
      trips: booking.items.map(i => ({
        tripId: i.tripId,
        route: i.route,
        tripDate: i.tripDate,
        licensePlate: i.licensePlate,
        seats: i.seatIds,
        tickets: i.tickets
      }))
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
  try { res.json(await Bus.find()); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post("/api/buses", async (req, res) => {
  try { const bus = new Bus(req.body); await bus.save(); res.json(bus); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put("/api/buses/:id", async (req, res) => {
  try { res.json(await Bus.findByIdAndUpdate(req.params.id, req.body, { new: true })); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete("/api/buses/:id", async (req, res) => {
  try { await Bus.findByIdAndDelete(req.params.id); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/routes", async (req, res) => {
  try { res.json(await Route.find()); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post("/api/routes", async (req, res) => {
  try { const route = new Route(req.body); await route.save(); res.json(route); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put("/api/routes/:id", async (req, res) => {
  try { res.json(await Route.findByIdAndUpdate(req.params.id, req.body, { new: true })); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete("/api/routes/:id", async (req, res) => {
  try { await Route.findByIdAndDelete(req.params.id); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/trips", async (req, res) => {
  try { res.json(await Trip.find()); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post("/api/trips", async (req, res) => {
  try { const trip = new Trip(req.body); await trip.save(); res.json(trip); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put("/api/trips/:id", async (req, res) => {
  try { res.json(await Trip.findByIdAndUpdate(req.params.id, req.body, { new: true })); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete("/api/trips/:id", async (req, res) => {
  try { await Trip.findByIdAndDelete(req.params.id); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put("/api/trips/:id/seats", async (req, res) => {
  try { res.json(await Trip.findByIdAndUpdate(req.params.id, { seats: req.body.seats }, { new: true })); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/bookings", async (req, res) => {
  try { res.json(await getBookingsWithPayment()); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/bookings/:id/history", async (req, res) => {
  try { res.json(await History.find({ bookingId: req.params.id }).sort({ timestamp: -1 })); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/bookings", async (req, res) => {
  try {
    const { items, passenger, payment, status: requestedStatus } = req.body;
    if (!items || items.length === 0) return res.status(400).json({ error: "No items to book" });
    const now = new Date().toISOString();
    let calculatedTotalPrice = 0;
    let calculatedTotalTickets = 0;
    const bookingItems = [];
    const updatedTrips = [];
    const logTripDetails = [];

    const totalPaid = (payment?.paidCash || 0) + (payment?.paidTransfer || 0);
    const finalStatus = requestedStatus || (totalPaid > 0 ? "payment" : "booking");

    for (const item of items) {
      const trip = await Trip.findById(item.tripId);
      if (!trip) continue;
      const route = await Route.findById(trip.routeId);
      const isEnhanced = route?.isEnhanced || trip.name?.toLowerCase().includes("tăng cường") || trip.route?.toLowerCase().includes("tăng cường");
      
      const tickets = item.tickets || item.seats.map((s) => ({
        seatId: s.id,
        price: finalStatus === 'payment' ? s.price : 0,
        pickup: passenger.pickupPoint || "",
        dropoff: passenger.dropoffPoint || "",
        note: "",
      }));
      
      const seatIds = tickets.map((t) => t.seatId);
      const itemPrice = tickets.reduce((sum, t) => sum + (t.price || 0), 0);
      calculatedTotalPrice += (item.price || item.seats.reduce((s,ss) => s + ss.price, 0)); 
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

      logTripDetails.push({ route: trip.route, tripDate: trip.departureTime, seats: seatIds, licensePlate: trip.licensePlate });
    }

    const targetSeatStatus = finalStatus === "payment" ? "sold" : finalStatus === "hold" ? "held" : "booked";

    for (const item of bookingItems) {
      const trip = await Trip.findById(item.tripId);
      if (trip) {
        trip.seats = trip.seats.map((s) => item.seatIds.includes(s.id) ? { ...s, status: targetSeatStatus } : s);
        trip.markModified("seats");
        await trip.save();
        updatedTrips.push(trip);
      }
    }

    const booking = new Booking({ passenger, items: bookingItems, status: finalStatus, createdAt: now, updatedAt: now, totalPrice: calculatedTotalPrice, totalTickets: calculatedTotalTickets });
    await booking.save();
    
    await logBookingAction(booking._id, "CREATE", `Tạo đơn hàng`, { trips: logTripDetails, totalTickets: calculatedTotalTickets });
    if (totalPaid > 0 || payment) await processPaymentUpdate(booking, payment);

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
    if (!oldBooking) return res.status(404).json({ error: "Booking not found" });

    // Release old seats
    for (const oldItem of oldBooking.items) {
      const trip = await Trip.findById(oldItem.tripId);
      if (trip) {
        trip.seats = trip.seats.map((s) => oldItem.seatIds.includes(s.id) ? { ...s, status: "available" } : s);
        trip.markModified("seats");
        await trip.save();
      }
    }

    let calculatedTotalPrice = 0;
    let calculatedTotalTickets = 0;
    const bookingItems = [];

    const totalPaid = (payment?.paidCash || 0) + (payment?.paidTransfer || 0);
    const finalStatus = requestedStatus || (totalPaid > 0 ? "payment" : "booking");

    for (const item of items) {
      const trip = await Trip.findById(item.tripId);
      if (!trip) continue;
      const tickets = item.tickets || item.seats.map((s) => ({
        seatId: s.id, 
        price: finalStatus === 'payment' ? s.price : 0, 
        pickup: passenger.pickupPoint || "", 
        dropoff: passenger.dropoffPoint || "", 
        note: ""
      }));
      const seatIds = tickets.map((t) => t.seatId);
      const itemPrice = tickets.reduce((sum, t) => sum + (t.price || 0), 0);
      calculatedTotalPrice += (item.price || item.seats.reduce((s,ss) => s + ss.price, 0));
      calculatedTotalTickets += seatIds.length;

      bookingItems.push({
        tripId: trip.id, tripDate: trip.departureTime, route: trip.route, licensePlate: trip.licensePlate, seatIds, tickets, price: itemPrice, busType: trip.type
      });
    }

    const targetSeatStatus = finalStatus === "payment" ? "sold" : finalStatus === "hold" ? "held" : "booked";

    for (const item of bookingItems) {
      const trip = await Trip.findById(item.tripId);
      if (trip) {
        trip.seats = trip.seats.map((s) => item.seatIds.includes(s.id) ? { ...s, status: targetSeatStatus } : s);
        trip.markModified("seats");
        await trip.save();
      }
    }

    oldBooking.passenger = passenger;
    oldBooking.items = bookingItems;
    oldBooking.status = finalStatus;
    oldBooking.totalPrice = calculatedTotalPrice;
    oldBooking.totalTickets = calculatedTotalTickets;
    oldBooking.updatedAt = new Date().toISOString();
    await oldBooking.save();
    await processPaymentUpdate(oldBooking, payment);

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

    const booking1 = await Booking.findOne({ status: { $ne: "cancelled" }, items: { $elemMatch: { tripId, seatIds: seatId1 } } });
    if (!booking1) {
      const s1 = trip.seats.find(s => s.id === seatId1);
      if (s1 && (s1.status !== 'available')) {
         trip.seats = trip.seats.map(s => s.id === seatId1 ? { ...s, status: 'available' } : s);
         trip.markModified("seats");
         await trip.save();
      }
      return res.status(404).json({ error: "Ghế nguồn không có đơn hàng thực tế" });
    }

    const booking2 = await Booking.findOne({ status: { $ne: "cancelled" }, items: { $elemMatch: { tripId, seatIds: seatId2 } } });

    if (booking2) {
      if (booking1._id.equals(booking2._id)) {
        booking1.items = booking1.items.map((item) => {
          if (item.tripId === tripId) {
            const newSeatIds = item.seatIds.map(s => s === seatId1 ? seatId2 : s === seatId2 ? seatId1 : s);
            const newTickets = item.tickets.map(t => 
                t.seatId === seatId1 ? { ...t, seatId: seatId2 } : (t.seatId === seatId2 ? { ...t, seatId: seatId1 } : t)
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
            const newSeatIds = item.seatIds.map(s => s === seatId1 ? seatId2 : s);
            const newTickets = item.tickets.map(t => t.seatId === seatId1 ? { ...t, seatId: seatId2 } : t);
            return { ...item, seatIds: newSeatIds, tickets: newTickets };
          }
          return item;
        });
        booking2.items = booking2.items.map((item) => {
          if (item.tripId === tripId) {
            const newSeatIds = item.seatIds.map(s => s === seatId2 ? seatId1 : s);
            const newTickets = item.tickets.map(t => t.seatId === seatId2 ? { ...t, seatId: seatId1 } : t);
            return { ...item, seatIds: newSeatIds, tickets: newTickets };
          }
          return item;
        });
        const s1 = trip.seats.find(s => s.id === seatId1);
        const s2 = trip.seats.find(s => s.id === seatId2);
        const status1 = s1.status;
        const status2 = s2.status;
        trip.seats = trip.seats.map(s => s.id === seatId1 ? { ...s, status: status2 } : (s.id === seatId2 ? { ...s, status: status1 } : s));
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
          const newSeatIds = item.seatIds.map(s => s === seatId1 ? seatId2 : s);
          const newTickets = item.tickets.map(t => t.seatId === seatId1 ? { ...t, seatId: seatId2 } : t);
          return { ...item, seatIds: newSeatIds, tickets: newTickets };
        }
        return item;
      });
      const s1 = trip.seats.find(s => s.id === seatId1);
      const status1 = s1.status;
      trip.seats = trip.seats.map(s => s.id === seatId1 ? { ...s, status: "available" } : (s.id === seatId2 ? { ...s, status: status1 } : s));
      booking1.markModified("items");
      trip.markModified("seats");
      await booking1.save();
      await trip.save();
    }
    const s1Obj = trip.seats.find(s => s.id === seatId1);
    const s2Obj = trip.seats.find(s => s.id === seatId2);
    await logBookingAction(booking1._id, "SWAP", `Đổi ghế từ ${s1Obj.label} sang ${s2Obj.label}`, { from: s1Obj.label, to: s2Obj.label, route: trip.route, date: trip.departureTime });
    res.json({ bookings: await getBookingsWithPayment(), trips: await Trip.find() });
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
    if (!fromTrip || !toTrip) return res.status(404).json({ error: "Trips not found" });

    const sourceSeatIds = seatTransfers.map(st => st.sourceSeatId);
    const targetSeatIds = seatTransfers.map(st => st.targetSeatId);

    const sourceItem = booking.items.find(i => i.tripId === fromTripId);
    if (!sourceItem) return res.status(404).json({ error: "Source trip item not found in booking" });

    const ticketsToMove = sourceItem.tickets.filter(t => sourceSeatIds.includes(t.seatId));
    const movedTickets = ticketsToMove.map(t => {
      const transfer = seatTransfers.find(st => st.sourceSeatId === t.seatId);
      const tObj = t.toObject ? t.toObject() : t; 
      return { ...tObj, seatId: transfer.targetSeatId };
    });

    fromTrip.seats = fromTrip.seats.map(s => sourceSeatIds.includes(s.id) ? { ...s, status: "available" } : s);
    fromTrip.markModified("seats");
    await fromTrip.save();

    const targetSeatStatus = booking.status === "payment" ? "sold" : booking.status === "hold" ? "held" : "booked";
    toTrip.seats = toTrip.seats.map(s => targetSeatIds.includes(s.id) ? { ...s, status: targetSeatStatus } : s);
    toTrip.markModified("seats");
    await toTrip.save();

    booking.items = booking.items.map(item => {
      if (item.tripId === fromTripId) {
        item.seatIds = item.seatIds.filter(sid => !sourceSeatIds.includes(sid));
        item.tickets = item.tickets.filter(t => !sourceSeatIds.includes(t.seatId));
        item.price = item.tickets.reduce((sum, t) => sum + t.price, 0);
      }
      return item;
    }).filter(item => item.seatIds.length > 0);

    let targetItem = booking.items.find(i => i.tripId === toTripId);
    if (targetItem) {
      targetItem.seatIds.push(...targetSeatIds);
      targetItem.tickets.push(...movedTickets);
      targetItem.price = targetItem.tickets.reduce((sum, t) => sum + t.price, 0);
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
        busType: toTrip.type
      });
    }

    booking.updatedAt = new Date().toISOString();
    booking.markModified("items");
    await booking.save();

    await logBookingAction(booking._id, "TRANSFER", `Điều phối ${targetSeatIds.length} ghế từ ${fromTrip.licensePlate} sang ${toTrip.licensePlate}`, {
      from: fromTrip.licensePlate,
      to: toTrip.licensePlate,
      seats: targetSeatIds
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
    
    booking.items.forEach((item) => {
      if (item.tickets) {
        const ticket = item.tickets.find((t) => t.seatId === seatId);
        if (ticket) {
          targetTicket = ticket;
          targetItem = item;
          if (pickup !== undefined) ticket.pickup = pickup;
          if (dropoff !== undefined) ticket.dropoff = dropoff;
          if (note !== undefined) ticket.note = note;
        }
      }
    });

    if (!targetTicket) return res.status(404).json({ error: "Ticket not found" });
    
    if (phone) booking.passenger.phone = phone;
    if (name) booking.passenger.name = name;

    if (action === 'PAY' && payment) {
        const trip = await Trip.findById(targetItem.tripId);
        if (trip) {
            trip.seats = trip.seats.map(s => s.id === seatId ? { ...s, status: 'sold' } : s);
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
            type: 'payment',
            transactionType: 'incremental', 
            method: (payment.paidCash && payment.paidTransfer) ? 'mixed' : (payment.paidCash ? 'cash' : 'transfer'),
            note: `Thanh toán lẻ ghế ${seatId}`,
            timestamp: new Date(),
            details: {
                seats: [seatId],
                tripDate: targetItem.tripDate,
                route: targetItem.route,
                licensePlate: targetItem.licensePlate,
                trips: [{
                    tripId: targetItem.tripId,
                    route: targetItem.route,
                    tripDate: targetItem.tripDate,
                    licensePlate: targetItem.licensePlate,
                    seats: [seatId],
                    tickets: [targetTicket]
                }]
            }
        });
        await paymentRec.save();
        
        targetItem.price = targetItem.tickets.reduce((sum, t) => sum + (t.price || 0), 0);

        await logBookingAction(booking._id, "PAY_SEAT", `Thanh toán riêng cho ghế ${seatId}`, { seat: seatId, amount: paymentRec.totalAmount });
    }

    if (action === 'REFUND') {
        const trip = await Trip.findById(targetItem.tripId);
        if (trip) {
            trip.seats = trip.seats.map(s => s.id === seatId ? { ...s, status: 'available' } : s);
            trip.markModified("seats");
            await trip.save();
        }

        const refundAmount = targetTicket.price || 0;
        const paymentRec = new Payment({
            bookingId: booking._id,
            totalAmount: -refundAmount,
            cashAmount: -refundAmount, 
            transferAmount: 0,
            type: 'refund',
            transactionType: 'incremental',
            method: 'cash',
            note: `Hoàn tiền & Hủy lẻ ghế ${seatId}`,
            timestamp: new Date(),
            details: {
                seats: [seatId],
                tripDate: targetItem.tripDate,
                route: targetItem.route,
                licensePlate: targetItem.licensePlate,
                trips: [{
                    tripId: targetItem.tripId,
                    route: targetItem.route,
                    tripDate: targetItem.tripDate,
                    licensePlate: targetItem.licensePlate,
                    seats: [seatId],
                    tickets: [targetTicket]
                }]
            }
        });
        await paymentRec.save();

        targetItem.seatIds = targetItem.seatIds.filter(sid => sid !== seatId);
        targetItem.tickets = targetItem.tickets.filter(t => t.seatId !== seatId);
        targetItem.price = targetItem.tickets.reduce((sum, t) => sum + (t.price || 0), 0);
        
        booking.items = booking.items.filter(item => item.seatIds.length > 0);
        booking.totalTickets = booking.items.reduce((sum, item) => sum + item.seatIds.length, 0);
        
        if (booking.totalTickets === 0) booking.status = 'cancelled';

        await logBookingAction(booking._id, "REFUND_SEAT", `Hoàn vé lẻ ghế ${seatId}`, { seat: seatId, amount: refundAmount });
    }

    booking.markModified("items");
    booking.updatedAt = new Date().toISOString();
    await booking.save();
    
    res.json({ booking: (await getBookingsWithPayment({ _id: new mongoose.Types.ObjectId(id) }))[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/bookings/:id", async (req, res) => {
  try {
    const bookingId = req.params.id;
    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    for (const item of booking.items) {
      const trip = await Trip.findById(item.tripId);
      if (trip) {
        trip.seats = trip.seats.map((s) => item.seatIds.includes(s.id) ? { ...s, status: "available" } : s);
        trip.markModified("seats");
        await trip.save();
      }
    }
    await Payment.deleteMany({ bookingId: booking._id });
    await Booking.findByIdAndDelete(bookingId);
    res.json({ success: true, trips: await Trip.find(), bookings: await getBookingsWithPayment() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/payments", async (req, res) => {
  try {
    const payments = await Payment.find().populate("bookingId").sort({ timestamp: -1 });
    res.json(payments.map(p => { const doc = p.toJSON(); doc.amount = doc.totalAmount; return doc; }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/payments/:id", async (req, res) => {
  try { res.json(await Payment.findByIdAndUpdate(req.params.id, req.body, { new: true })); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/settings/:key", async (req, res) => {
  try { const setting = await Setting.findOne({ key: req.params.key }); res.json(setting ? setting.value : null); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/settings", async (req, res) => {
  try { const { key, value } = req.body; const setting = await Setting.findOneAndUpdate({ key }, { value }, { upsert: true, new: true }); res.json(setting.value); } catch (e) { res.status(500).json({ error: e.message }); }
});

/**
 * THUẬT TOÁN BẢO TRÌ NÂNG CẤP: LẤY BOOKING LÀM GỐC
 * Bổ sung ghi chú chi tiết từng thay đổi
 * CẬP NHẬT: Đối soát chi tiết từng ghế (Granular seat status check)
 */
app.post("/api/maintenance/fix-seats", async (req, res) => {
  try {
    const allBookings = await Booking.find({ status: { $ne: 'cancelled' } });
    const allTrips = await Trip.find();
    
    let fixedCount = 0;
    let conflictCount = 0;
    let syncCount = 0;
    const logs = []; // Danh sách chi tiết các ghế được sửa

    // 1. Map Booking Occupancy (Nguồn dữ liệu thật cho sơ đồ ghế)
    // Map key: tripId_seatId -> Thông tin vé lẻ
    const bookingOccupancy = new Map();
    allBookings.forEach(b => {
        b.items.forEach(item => {
            // b.items[x].tickets chứa thông tin chi tiết từng ghế trong booking đó
            const tickets = item.tickets || [];
            
            item.seatIds.forEach(seatId => {
                const key = `${item.tripId}_${seatId}`;
                const ticketDetail = tickets.find(t => t.seatId === seatId);
                
                if (!bookingOccupancy.has(key)) bookingOccupancy.set(key, []);
                bookingOccupancy.get(key).push({
                    bookingId: b._id.toString(),
                    phone: b.passenger?.phone,
                    bookingStatus: b.status,
                    ticketPrice: ticketDetail ? ticketDetail.price : 0,
                    updatedAt: b.updatedAt
                });
            });
        });
    });

    // 2. Thực hiện sửa lỗi từng Chuyến xe
    for (const trip of allTrips) {
        let isModified = false;
        const tripId = trip._id.toString();
        const tripDate = trip.departureTime.split(" ")[0];

        trip.seats = await Promise.all(trip.seats.map(async (s) => {
            const key = `${tripId}_${s.id}`;
            const bookingsInSeat = bookingOccupancy.get(key) || [];
            
            // LỖI 1: NHIỀU ĐƠN HÀNG TRÙNG GHẾ (CONFLICT)
            if (bookingsInSeat.length > 1) {
                conflictCount++;
                // Ưu tiên đơn có giá vé cao hơn hoặc cập nhật mới nhất
                bookingsInSeat.sort((a, b) => {
                    return (b.ticketPrice - a.ticketPrice) || (new Date(b.updatedAt) - new Date(a.updatedAt));
                });

                const winner = bookingsInSeat[0];
                const losers = bookingsInSeat.slice(1);

                for (const loser of losers) {
                    const bDoc = await Booking.findById(loser.bookingId);
                    if (bDoc) {
                        bDoc.items = bDoc.items.map(item => {
                            if (item.tripId === tripId) {
                                item.seatIds = item.seatIds.filter(sid => sid !== s.id);
                                item.tickets = item.tickets.filter(tic => tic.seatId !== s.id);
                            }
                            return item;
                        }).filter(item => item.seatIds.length > 0);
                        
                        bDoc.totalTickets = bDoc.items.reduce((sum, i) => sum + i.seatIds.length, 0);
                        if (bDoc.totalTickets === 0) bDoc.status = 'cancelled';
                        bDoc.markModified("items");
                        await bDoc.save();
                    }
                }
                logs.push({ 
                  route: trip.route, 
                  date: tripDate, 
                  seat: s.label, 
                  action: 'Xử lý trùng ghế', 
                  details: `Giữ lại đơn: ${winner.phone}, Loại bỏ ${losers.length} đơn trùng.`
                });
            }

            // LỖI 2: ĐỒNG BỘ TRẠNG THÁI GHẾ TRÊN SƠ ĐỒ
            const activeBooking = bookingsInSeat[0];

            if (activeBooking) {
                // QUY TẮC PHÂN LOẠI MÀU (Trạng thái ghế):
                // 1. Đơn hàng tổng thể là 'payment' -> Tất cả là 'sold' (Xanh)
                // 2. Đơn hàng là 'hold' -> Tất cả là 'held' (Tím)
                // 3. Đơn hàng là 'booking' -> Kiểm tra GIÁ VÉ LẺ (ticketPrice):
                //    - price > 0: 'sold' (Xanh)
                //    - price === 0: 'booked' (Vàng)
                
                let targetStatus = 'booked';
                
                if (activeBooking.bookingStatus === 'payment') {
                    targetStatus = 'sold';
                } else if (activeBooking.bookingStatus === 'hold') {
                    targetStatus = 'held';
                } else if (activeBooking.bookingStatus === 'booking') {
                    // Đối soát chi tiết từng vé trong đơn hàng đặt chỗ
                    targetStatus = activeBooking.ticketPrice > 0 ? 'sold' : 'booked';
                }

                if (s.status !== targetStatus) {
                    isModified = true;
                    syncCount++;
                    logs.push({ 
                      route: trip.route, 
                      date: tripDate, 
                      seat: s.label, 
                      action: 'Đồng bộ màu sắc', 
                      details: `Chuyển từ ${s.status} sang ${targetStatus} (Giá thu: ${activeBooking.ticketPrice}).`
                    });
                    return { ...s, status: targetStatus };
                }
            } else {
                // GIẢI PHÓNG GHẾ MA
                if (s.status !== 'available') {
                    isModified = true;
                    fixedCount++;
                    logs.push({ 
                      route: trip.route, 
                      date: tripDate, 
                      seat: s.label, 
                      action: 'Giải phóng ghế ma', 
                      details: 'Đưa ghế về trạng thái Trống (không có đơn hàng thực).'
                    });
                    return { ...s, status: 'available' };
                }
            }
            return s;
        }));

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

app.listen(PORT, "0.0.0.0", async () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});
