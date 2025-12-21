
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

const ticketDetailSchema = new mongoose.Schema({
    seatId: String,
    price: Number,
    pickup: String,
    dropoff: String,
    note: String
}, { _id: false });

const bookingItemSchema = new mongoose.Schema({
    tripId: String,
    tripDate: String,
    route: String,
    licensePlate: String,
    seatIds: [String],
    tickets: [ticketDetailSchema], 
    price: Number,
    isEnhanced: { type: Boolean, default: false },
    busType: String
}, { _id: false });

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
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    totalAmount: Number, 
    cashAmount: { type: Number, default: 0 },
    transferAmount: { type: Number, default: 0 },
    method: String, 
    type: String, 
    note: String,
    timestamp: { type: Date, default: Date.now },
    details: mongoose.Schema.Types.Mixed
  },
  { toJSON: { virtuals: true, transform: transformId } }
);

const historySchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    action: { 
      type: String, 
      enum: ['CREATE', 'UPDATE', 'CANCEL', 'SWAP', 'PASSENGER_UPDATE', 'DELETE', 'TRANSFER', 'BULK_TRANSFER'],
      required: true
    },
    description: String,
    details: mongoose.Schema.Types.Mixed, 
    timestamp: { type: Date, default: Date.now }
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

const logBookingAction = async (bookingId, action, description, details = {}) => {
  try {
    await History.create({ bookingId, action, description, details, timestamp: new Date() });
    await Booking.findByIdAndUpdate(bookingId, { updatedAt: new Date().toISOString() });
  } catch (e) { console.error("Failed to log history:", e); }
};

const processPaymentUpdate = async (booking, newPaymentState) => {
    const payments = await Payment.find({ bookingId: booking._id });
    const paidCash = payments.reduce((sum, p) => sum + (p.cashAmount || 0), 0);
    const paidTransfer = payments.reduce((sum, p) => sum + (p.transferAmount || 0), 0);
    
    const cashDelta = (newPaymentState?.paidCash || 0) - paidCash;
    const transferDelta = (newPaymentState?.paidTransfer || 0) - paidTransfer;
    const totalDelta = cashDelta + transferDelta;

    if (totalDelta === 0 && cashDelta === 0 && transferDelta === 0) return;

    const type = totalDelta >= 0 ? 'payment' : 'refund';
    const paymentRecord = new Payment({
        bookingId: booking._id,
        totalAmount: totalDelta,
        cashAmount: cashDelta,
        transferAmount: transferDelta,
        type,
        method: 'mixed',
        note: 'Cập nhật thanh toán',
        timestamp: new Date()
    });
    await paymentRecord.save();
};

// --- API ROUTES ---
app.get("/api/buses", async (req, res) => { try { const buses = await Bus.find(); res.json(buses); } catch (e) { res.status(500).json({ error: e.message }); } });
app.post("/api/buses", async (req, res) => { try { const bus = new Bus(req.body); await bus.save(); res.json(bus); } catch (e) { res.status(500).json({ error: e.message }); } });
app.put("/api/buses/:id", async (req, res) => { try { const bus = await Bus.findByIdAndUpdate(req.params.id, req.body, { new: true }); res.json(bus); } catch (e) { res.status(500).json({ error: e.message }); } });
app.delete("/api/buses/:id", async (req, res) => { try { await Bus.findByIdAndDelete(req.params.id); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });

app.get("/api/routes", async (req, res) => { try { const routes = await Route.find(); res.json(routes); } catch (e) { res.status(500).json({ error: e.message }); } });
app.post("/api/routes", async (req, res) => { try { const route = new Route(req.body); await route.save(); res.json(route); } catch (e) { res.status(500).json({ error: e.message }); } });
app.put("/api/routes/:id", async (req, res) => { try { const route = await Route.findByIdAndUpdate(req.params.id, req.body, { new: true }); res.json(route); } catch (e) { res.status(500).json({ error: e.message }); } });
app.delete("/api/routes/:id", async (req, res) => { try { await Route.findByIdAndDelete(req.params.id); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });

app.get("/api/trips", async (req, res) => { try { const trips = await Trip.find(); res.json(trips); } catch (e) { res.status(500).json({ error: e.message }); } });
app.post("/api/trips", async (req, res) => { try { const trip = new Trip(req.body); await trip.save(); res.json(trip); } catch (e) { res.status(500).json({ error: e.message }); } });
app.put("/api/trips/:id", async (req, res) => { try { const trip = await Trip.findByIdAndUpdate(req.params.id, req.body, { new: true }); res.json(trip); } catch (e) { res.status(500).json({ error: e.message }); } });
app.delete("/api/trips/:id", async (req, res) => { try { await Trip.findByIdAndDelete(req.params.id); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
app.put("/api/trips/:id/seats", async (req, res) => { try { const trip = await Trip.findByIdAndUpdate(req.params.id, { seats: req.body.seats }, { new: true }); res.json(trip); } catch (e) { res.status(500).json({ error: e.message }); } });

app.get("/api/bookings", async (req, res) => {
  try {
    const bookings = await Booking.aggregate([
      { $lookup: { from: "payments", localField: "_id", foreignField: "bookingId", as: "paymentRecords" } },
      { $addFields: { id: "$_id", payment: { paidCash: { $sum: "$paymentRecords.cashAmount" }, paidTransfer: { $sum: "$paymentRecords.transferAmount" } } } },
      { $project: { paymentRecords: 0, _id: 0, __v: 0 } }
    ]);
    res.json(bookings);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/bookings/:id/history", async (req, res) => {
  try {
    const history = await History.find({ bookingId: req.params.id }).sort({ timestamp: -1 });
    res.json(history);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/bookings", async (req, res) => {
  try {
    const { items, passenger, payment, status: requestedStatus } = req.body; 
    const now = new Date().toISOString();
    let calculatedTotalPrice = 0;
    let calculatedTotalTickets = 0;
    const bookingItems = [];
    const updatedTrips = [];

    for (const item of items) {
        const trip = await Trip.findById(item.tripId);
        if (!trip) continue;
        const tickets = item.tickets || item.seats.map(s => ({ seatId: s.id, price: s.price, pickup: passenger.pickupPoint || '', dropoff: passenger.dropoffPoint || '', note: '' }));
        const seatIds = tickets.map(t => t.seatId);
        const itemPrice = tickets.reduce((sum, t) => sum + t.price, 0);
        calculatedTotalPrice += itemPrice;
        calculatedTotalTickets += seatIds.length;
        bookingItems.push({
            tripId: trip.id, tripDate: trip.departureTime, route: trip.route, licensePlate: trip.licensePlate, seatIds, tickets, price: itemPrice, 
            isEnhanced: trip.name?.toLowerCase().includes('tăng cường'), busType: trip.type
        });
    }

    const totalPaid = (payment?.paidCash || 0) + (payment?.paidTransfer || 0);
    const finalStatus = requestedStatus || (totalPaid >= calculatedTotalPrice ? "payment" : "booking");
    const seatStatusVal = finalStatus === 'payment' ? 'sold' : finalStatus === 'hold' ? 'held' : 'booked';

    for (const item of bookingItems) {
         const trip = await Trip.findById(item.tripId);
         trip.seats = trip.seats.map(s => item.seatIds.includes(s.id) ? { ...s, status: seatStatusVal } : s);
         await trip.save();
         updatedTrips.push(trip);
    }

    const booking = new Booking({ passenger, items: bookingItems, status: finalStatus, createdAt: now, updatedAt: now, totalPrice: calculatedTotalPrice, totalTickets: calculatedTotalTickets });
    await booking.save();
    await logBookingAction(booking._id, 'CREATE', `Tạo mới đơn hàng (${finalStatus})`);
    if (totalPaid > 0) await processPaymentUpdate(booking, payment);

    const fullBooking = await Booking.aggregate([{ $match: { _id: booking._id } }, { $lookup: { from: "payments", localField: "_id", foreignField: "bookingId", as: "pay" } },
        { $addFields: { id: "$_id", payment: { paidCash: { $sum: "$pay.cashAmount" }, paidTransfer: { $sum: "$pay.transferAmount" } } } }, { $project: { pay: 0, _id: 0 } }]);

    res.json({ bookings: fullBooking, updatedTrips }); 
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/bookings/:id", async (req, res) => {
  try {
      const { items, passenger, payment, status: requestedStatus } = req.body;
      const booking = await Booking.findById(req.params.id);
      if (!booking) return res.status(404).json({ error: "Booking not found" });

      for (const oldItem of booking.items) {
          const trip = await Trip.findById(oldItem.tripId);
          if (trip) {
              trip.seats = trip.seats.map(s => oldItem.seatIds.includes(s.id) ? { ...s, status: 'available' } : s);
              await trip.save();
          }
      }

      let calculatedTotalPrice = 0;
      let calculatedTotalTickets = 0;
      const bookingItems = [];
      for (const item of items) {
          const trip = await Trip.findById(item.tripId);
          if (!trip) continue; 
          const tickets = item.tickets || item.seats.map(s => ({ seatId: s.id, price: s.price, pickup: passenger.pickupPoint || '', dropoff: passenger.dropoffPoint || '', note: '' }));
          const seatIds = tickets.map(t => t.seatId);
          const itemPrice = tickets.reduce((sum, t) => sum + t.price, 0);
          calculatedTotalPrice += itemPrice;
          calculatedTotalTickets += seatIds.length;
          bookingItems.push({ tripId: trip.id, tripDate: trip.departureTime, route: trip.route, licensePlate: trip.licensePlate, seatIds, tickets, price: itemPrice, isEnhanced: false, busType: trip.type });
      }

      const totalPaid = (payment?.paidCash || 0) + (payment?.paidTransfer || 0);
      const finalStatus = requestedStatus || (calculatedTotalTickets === 0 ? "cancelled" : (totalPaid >= calculatedTotalPrice ? "payment" : "booking"));
      const seatStatusVal = finalStatus === 'payment' ? 'sold' : finalStatus === 'hold' ? 'held' : 'booked';

      for (const item of bookingItems) {
          const trip = await Trip.findById(item.tripId);
          trip.seats = trip.seats.map(s => item.seatIds.includes(s.id) ? { ...s, status: seatStatusVal } : s);
          await trip.save();
      }

      booking.passenger = passenger;
      booking.items = bookingItems;
      booking.status = finalStatus;
      booking.totalPrice = calculatedTotalPrice;
      booking.totalTickets = calculatedTotalTickets;
      booking.updatedAt = new Date().toISOString();
      await booking.save();

      await logBookingAction(booking._id, 'UPDATE', "Cập nhật vé");
      await processPaymentUpdate(booking, payment);

      const allTrips = await Trip.find();
      const fullBooking = await Booking.aggregate([{ $match: { _id: booking._id } }, { $lookup: { from: "payments", localField: "_id", foreignField: "bookingId", as: "pay" } },
        { $addFields: { id: "$_id", payment: { paidCash: { $sum: "$pay.cashAmount" }, paidTransfer: { $sum: "$pay.transferAmount" } } } }, { $project: { pay: 0, _id: 0 } }]);

      res.json({ booking: fullBooking[0], updatedTrips: allTrips });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/bookings/bulk-transfer", async (req, res) => {
    try {
        const { transfers } = req.body; // Array of { sourceTripId, sourceSeatId, targetTripId, targetSeatId }
        if (!Array.isArray(transfers) || transfers.length === 0) return res.status(400).json({ error: "Invalid transfers" });

        const tripIds = new Set();
        transfers.forEach(t => { tripIds.add(t.sourceTripId); tripIds.add(t.targetTripId); });
        
        const trips = await Trip.find({ _id: { $in: Array.from(tripIds) } });
        const tripMap = new Map(trips.map(t => [t._id.toString(), t]));

        for (const transfer of transfers) {
            const { sourceTripId, sourceSeatId, targetTripId, targetSeatId } = transfer;
            
            const booking = await Booking.findOne({ status: { $ne: 'cancelled' }, "items": { $elemMatch: { tripId: sourceTripId, seatIds: sourceSeatId } } });
            if (!booking) continue;

            const sourceTrip = tripMap.get(sourceTripId);
            const targetTrip = tripMap.get(targetTripId);
            if (!sourceTrip || !targetTrip) continue;

            const seatStatusVal = booking.status === 'payment' ? 'sold' : booking.status === 'hold' ? 'held' : 'booked';

            // Update Booking Items
            let ticketToMove = null;
            booking.items = booking.items.map(item => {
                if (item.tripId === sourceTripId) {
                    const idx = item.seatIds.indexOf(sourceSeatId);
                    if (idx > -1) {
                        if (item.tickets) ticketToMove = item.tickets.find(t => t.seatId === sourceSeatId);
                        item.seatIds.splice(idx, 1);
                        if (item.tickets) item.tickets = item.tickets.filter(t => t.seatId !== sourceSeatId);
                        item.price = (item.tickets || []).reduce((sum, t) => sum + t.price, 0);
                    }
                }
                return item;
            }).filter(item => item.seatIds.length > 0);

            let targetItem = booking.items.find(i => i.tripId === targetTripId);
            const newTicket = { 
                seatId: targetSeatId, 
                price: ticketToMove?.price || targetTrip.basePrice, 
                pickup: ticketToMove?.pickup || booking.passenger.pickupPoint || '', 
                dropoff: ticketToMove?.dropoff || booking.passenger.dropoffPoint || '',
                note: ticketToMove?.note || ''
            };

            if (targetItem) {
                targetItem.seatIds.push(targetSeatId);
                if (!targetItem.tickets) targetItem.tickets = [];
                targetItem.tickets.push(newTicket);
                targetItem.price += newTicket.price;
            } else {
                booking.items.push({
                    tripId: targetTripId, tripDate: targetTrip.departureTime, route: targetTrip.route, licensePlate: targetTrip.licensePlate,
                    seatIds: [targetSeatId], tickets: [newTicket], price: newTicket.price, isEnhanced: false, busType: targetTrip.type
                });
            }

            booking.totalPrice = booking.items.reduce((sum, i) => sum + i.price, 0);
            booking.updatedAt = new Date().toISOString();
            await booking.save();

            // Update Trip Seats
            sourceTrip.seats = sourceTrip.seats.map(s => s.id === sourceSeatId ? { ...s, status: 'available' } : s);
            targetTrip.seats = targetTrip.seats.map(s => s.id === targetSeatId ? { ...s, status: seatStatusVal } : s);
            await sourceTrip.save();
            await targetTrip.save();

            await logBookingAction(booking._id, 'BULK_TRANSFER', `Điều chuyển ghế ${sourceSeatId} (Chuyến nguồn) sang ghế ${targetSeatId} (Chuyến đích)`);
        }

        const allTrips = await Trip.find();
        const allBookings = await Booking.aggregate([{ $lookup: { from: "payments", localField: "_id", foreignField: "bookingId", as: "pay" } },
            { $addFields: { id: "$_id", payment: { paidCash: { $sum: "$pay.cashAmount" }, paidTransfer: { $sum: "$pay.transferAmount" } } } }, { $project: { pay: 0, _id: 0 } }]);
        
        res.json({ bookings: allBookings, trips: allTrips });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/bookings/transfer", async (req, res) => {
    try {
        const { sourceTripId, sourceSeatId, targetTripId, targetSeatId } = req.body;
        
        const booking = await Booking.findOne({ status: { $ne: 'cancelled' }, "items": { $elemMatch: { tripId: sourceTripId, seatIds: sourceSeatId } } });
        if (!booking) return res.status(404).json({ error: "Booking not found for source seat" });

        const sourceTrip = await Trip.findById(sourceTripId);
        const targetTrip = await Trip.findById(targetTripId);
        if (!sourceTrip || !targetTrip) return res.status(404).json({ error: "Trip not found" });

        const sSeat = sourceTrip.seats.find(s => s.id === sourceSeatId);
        const tSeat = targetTrip.seats.find(s => s.id === targetSeatId);
        if (!sSeat || !tSeat || tSeat.status !== 'available') return res.status(400).json({ error: "Target seat invalid or occupied" });

        const seatStatusVal = booking.status === 'payment' ? 'sold' : booking.status === 'hold' ? 'held' : 'booked';

        // 1. Update Booking Items
        let ticketToMove = null;
        booking.items = booking.items.map(item => {
            if (item.tripId === sourceTripId) {
                const idx = item.seatIds.indexOf(sourceSeatId);
                if (idx > -1) {
                    if (item.tickets) ticketToMove = item.tickets.find(t => t.seatId === sourceSeatId);
                    item.seatIds.splice(idx, 1);
                    if (item.tickets) item.tickets = item.tickets.filter(t => t.seatId !== sourceSeatId);
                    item.price = (item.tickets || []).reduce((sum, t) => sum + t.price, 0);
                }
            }
            return item;
        }).filter(item => item.seatIds.length > 0);

        let targetItem = booking.items.find(i => i.tripId === targetTripId);
        const newTicket = { 
            seatId: targetSeatId, 
            price: ticketToMove?.price || targetTrip.basePrice, 
            pickup: ticketToMove?.pickup || booking.passenger.pickupPoint || '', 
            dropoff: ticketToMove?.dropoff || booking.passenger.dropoffPoint || '',
            note: ticketToMove?.note || ''
        };

        if (targetItem) {
            targetItem.seatIds.push(targetSeatId);
            if (!targetItem.tickets) targetItem.tickets = [];
            targetItem.tickets.push(newTicket);
            targetItem.price += newTicket.price;
        } else {
            booking.items.push({
                tripId: targetTripId, tripDate: targetTrip.departureTime, route: targetTrip.route, licensePlate: targetTrip.licensePlate,
                seatIds: [targetSeatId], tickets: [newTicket], price: newTicket.price, isEnhanced: false, busType: targetTrip.type
            });
        }

        booking.totalPrice = booking.items.reduce((sum, i) => sum + i.price, 0);
        booking.updatedAt = new Date().toISOString();
        await booking.save();

        // 2. Update Trip Seats
        sourceTrip.seats = sourceTrip.seats.map(s => s.id === sourceSeatId ? { ...s, status: 'available' } : s);
        targetTrip.seats = targetTrip.seats.map(s => s.id === targetSeatId ? { ...s, status: seatStatusVal } : s);
        await sourceTrip.save();
        await targetTrip.save();

        await logBookingAction(booking._id, 'TRANSFER', `Chuyển khách từ ${sourceTrip.route} (${sSeat.label}) sang ${targetTrip.route} (${tSeat.label})`);

        const allTrips = await Trip.find();
        const allBookings = await Booking.aggregate([{ $lookup: { from: "payments", localField: "_id", foreignField: "bookingId", as: "pay" } },
            { $addFields: { id: "$_id", payment: { paidCash: { $sum: "$pay.cashAmount" }, paidTransfer: { $sum: "$pay.transferAmount" } } } }, { $project: { pay: 0, _id: 0 } }]);
        
        res.json({ bookings: allBookings, trips: allTrips });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, "0.0.0.0", async () => { console.log(`🚀 Server running on http://0.0.0.0:${PORT}`); });
