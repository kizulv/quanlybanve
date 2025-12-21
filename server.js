
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
    isEnhanced: { type: Boolean, default: false },
  },
  { toJSON: { virtuals: true, transform: transformId } }
);

// Trip Schema
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
    status: String, // booking, payment, hold, cancelled
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
    performedBy: String,
    details: {
       seats: [String],
       tripDate: String,
       route: String,
       licensePlate: String,
       trips: [mongoose.Schema.Types.Mixed] 
    }
  },
  { toJSON: { virtuals: true, transform: transformId } }
);

const historySchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    action: { 
      type: String, 
      enum: ['CREATE', 'UPDATE', 'CANCEL', 'SWAP', 'PASSENGER_UPDATE', 'DELETE', 'TRANSFER'],
      required: true
    },
    description: String,
    details: mongoose.Schema.Types.Mixed, 
    timestamp: { type: Date, default: Date.now },
    performedBy: String
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

const seedData = async () => {
  try {
    const busCount = await Bus.countDocuments();
    if (busCount === 0) {
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
            activeSeats: Array.from({ length: 24 }, (_, i) => `${((i % 4) % 2) + 1}-${Math.floor(i / 4)}-${Math.floor((i % 4) / 2)}`),
            seatLabels: {},
          },
        },
      ]);
    }
  } catch (e) {
    console.error("Seed data failed:", e);
  }
};

const logBookingAction = async (bookingId, action, description, details = {}) => {
  try {
    await History.create({
      bookingId,
      action,
      description,
      details,
      timestamp: new Date()
    });
    await Booking.findByIdAndUpdate(bookingId, { updatedAt: new Date().toISOString() });
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
    const type = totalDelta >= 0 ? 'payment' : 'refund';
    let method = 'mixed';
    if (transferDelta === 0 && cashDelta !== 0) method = 'cash';
    else if (cashDelta === 0 && transferDelta !== 0) method = 'transfer';
    const tripDetails = booking.items[0] || {};
    const allSeats = booking.items.flatMap(i => i.seatIds);
    const tripsSnapshot = [];
    for (const item of booking.items) {
        tripsSnapshot.push({ route: item.route, tripDate: item.tripDate, licensePlate: item.licensePlate, seats: item.seatIds, tickets: item.tickets, isEnhanced: item.isEnhanced });
    }
    const paymentRecord = new Payment({ bookingId: booking._id, totalAmount: totalDelta, cashAmount: cashDelta, transferAmount: transferDelta, type, method, note: type === 'refund' ? 'Hoàn tiền' : 'Thanh toán/Cập nhật', timestamp: new Date(), details: { seats: allSeats, tripDate: tripDetails.tripDate, route: tripDetails.route, licensePlate: tripDetails.licensePlate, trips: tripsSnapshot } });
    await paymentRecord.save();
    await Booking.findByIdAndUpdate(booking._id, { updatedAt: new Date().toISOString() });
};

// --- HELPERS ---

const ensureItemForTrip = (booking, trip) => {
    let item = booking.items.find(i => i.tripId === trip.id || i.tripId === trip._id.toString());
    if (!item) {
        item = {
            tripId: trip.id || trip._id.toString(),
            tripDate: trip.departureTime,
            route: trip.route,
            licensePlate: trip.licensePlate,
            seatIds: [],
            tickets: [],
            price: 0,
            busType: trip.type
        };
        booking.items.push(item);
    }
    return item;
};

// --- ROUTES ---

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
    if (!items || items.length === 0) return res.status(400).json({ error: "No items to book" });
    const now = new Date().toISOString();
    let calculatedTotalPrice = 0;
    let calculatedTotalTickets = 0;
    const bookingItems = [];
    const updatedTrips = [];
    const logTripDetails = [];
    for (const item of items) {
        const trip = await Trip.findById(item.tripId);
        if (!trip) continue;
        const route = await Route.findById(trip.routeId);
        const isEnhanced = route?.isEnhanced || trip.name?.toLowerCase().includes('tăng cường') || trip.route?.toLowerCase().includes('tăng cường');
        const tickets = item.tickets || item.seats.map(s => ({ seatId: s.id, price: s.price, pickup: passenger.pickupPoint || '', dropoff: passenger.dropoffPoint || '', note: '' }));
        const seatIds = tickets.map(t => t.seatId);
        const itemPrice = tickets.reduce((sum, t) => sum + t.price, 0);
        calculatedTotalPrice += itemPrice;
        calculatedTotalTickets += seatIds.length;
        const seatLabels = seatIds.map(sid => { const s = trip.seats.find(ts => ts.id === sid); return s ? s.label : sid; });
        logTripDetails.push({ route: trip.route, tripDate: trip.departureTime, seats: seatLabels, licensePlate: trip.licensePlate });
        bookingItems.push({ tripId: trip.id, tripDate: trip.departureTime, route: trip.route, licensePlate: trip.licensePlate, seatIds: seatIds, tickets: tickets, price: itemPrice, isEnhanced: isEnhanced, busType: trip.type });
    }
    const totalPaid = (payment?.paidCash || 0) + (payment?.paidTransfer || 0);
    const isFullyPaid = totalPaid >= calculatedTotalPrice;
    let finalStatus = requestedStatus || (isFullyPaid ? "payment" : "booking");
    const targetSeatStatus = finalStatus === 'payment' ? 'sold' : finalStatus === 'hold' ? 'held' : 'booked';
    for (const item of bookingItems) {
         const trip = await Trip.findById(item.tripId);
         if (!trip) continue;
         trip.seats = trip.seats.map(s => item.seatIds.includes(s.id) ? { ...s, status: targetSeatStatus } : s);
         trip.markModified('seats');
         await trip.save();
         updatedTrips.push(trip);
    }
    const booking = new Booking({ passenger, items: bookingItems, status: finalStatus, createdAt: now, updatedAt: now, totalPrice: calculatedTotalPrice, totalTickets: calculatedTotalTickets });
    await booking.save();
    await logBookingAction(booking._id, 'CREATE', `Tạo đơn hàng`, { trips: logTripDetails, totalTickets: calculatedTotalTickets });
    if (totalPaid > 0 || payment) await processPaymentUpdate(booking, payment);
    const result = await Booking.aggregate([{ $match: { _id: booking._id } }, { $lookup: { from: "payments", localField: "_id", foreignField: "bookingId", as: "paymentRecords" } }, { $addFields: { id: "$_id", payment: { paidCash: { $sum: "$paymentRecords.cashAmount" }, paidTransfer: { $sum: "$paymentRecords.transferAmount" } } } }, { $project: { paymentRecords: 0, _id: 0, __v: 0 } }]);
    res.json({ bookings: result, updatedTrips: updatedTrips }); 
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/bookings/:id", async (req, res) => {
  try {
      const { items, passenger, payment, status: requestedStatus } = req.body;
      const bookingId = req.params.id;
      const oldBooking = await Booking.findById(bookingId);
      if (!oldBooking) return res.status(404).json({ error: "Booking not found" });
      for (const oldItem of oldBooking.items) {
          const trip = await Trip.findById(oldItem.tripId);
          if (trip) {
              trip.seats = trip.seats.map(s => oldItem.seatIds.includes(s.id) ? { ...s, status: 'available' } : s);
              trip.markModified('seats');
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
          bookingItems.push({ tripId: trip.id, tripDate: trip.departureTime, route: trip.route, licensePlate: trip.licensePlate, seatIds, tickets, price: itemPrice, busType: trip.type });
      }
      const totalPaid = (payment?.paidCash || 0) + (payment?.paidTransfer || 0);
      let finalStatus = requestedStatus || (totalPaid >= calculatedTotalPrice ? "payment" : "booking");
      const targetSeatStatus = finalStatus === 'payment' ? 'sold' : finalStatus === 'hold' ? 'held' : 'booked';
      for (const item of bookingItems) {
          const trip = await Trip.findById(item.tripId);
          if (trip) {
              trip.seats = trip.seats.map(s => item.seatIds.includes(s.id) ? { ...s, status: targetSeatStatus } : s);
              trip.markModified('seats');
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
      const result = await Booking.aggregate([{ $match: { _id: oldBooking._id } }, { $lookup: { from: "payments", localField: "_id", foreignField: "bookingId", as: "paymentRecords" } }, { $addFields: { id: "$_id", payment: { paidCash: { $sum: "$paymentRecords.cashAmount" }, paidTransfer: { $sum: "$paymentRecords.transferAmount" } } } }, { $project: { paymentRecords: 0, _id: 0, __v: 0 } }]);
      res.json({ booking: result[0], updatedTrips: allTrips });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/bookings/transfer", async (req, res) => {
  try {
    const { bookingId, sourceTripId, targetTripId, seatTransfers } = req.body;
    const booking = await Booking.findById(bookingId);
    const sourceTrip = await Trip.findById(sourceTripId);
    const targetTrip = await Trip.findById(targetTripId);
    
    if (!booking || !sourceTrip || !targetTrip) {
        return res.status(404).json({ error: "Dữ liệu không tồn tại (Booking/Trip)" });
    }

    const modifiedBookings = new Map();
    modifiedBookings.set(bookingId, booking);

    for (const transfer of seatTransfers) {
        const { sourceSeatId, targetSeatId } = transfer;
        
        // 1. Kiểm tra đối tượng đang chiếm giữ ghế đích (nếu có)
        const targetOccupant = await Booking.findOne({ 
            status: { $ne: 'cancelled' },
            "items": { $elemMatch: { tripId: targetTripId, seatIds: targetSeatId } }
        });

        // Lấy Item chứa ghế nguồn của booking hiện tại
        const sourceItem = booking.items.find(i => i.tripId === sourceTripId);
        if (!sourceItem) continue;
        
        const sourceTicketIndex = sourceItem.tickets.findIndex(t => t.seatId === sourceSeatId);
        if (sourceTicketIndex === -1) continue;
        
        // Clone đối tượng ticket để di chuyển an toàn
        const sourceTicket = JSON.parse(JSON.stringify(sourceItem.tickets[sourceTicketIndex]));

        if (targetOccupant) {
            // --- TRƯỜNG HỢP ĐỔI CHÉO (SWAP) ---
            const tOccId = targetOccupant._id.toString();
            const tBooking = modifiedBookings.get(tOccId) || targetOccupant;
            modifiedBookings.set(tOccId, tBooking);

            const tItem = tBooking.items.find(i => i.tripId === targetTripId);
            const tTicketIndex = tItem.tickets.findIndex(t => t.seatId === targetSeatId);
            const tTicket = JSON.parse(JSON.stringify(tItem.tickets[tTicketIndex]));

            // Hoán đổi trạng thái trên sơ đồ Trip
            const sIdx = sourceTrip.seats.findIndex(s => s.id === sourceSeatId);
            const tIdx = targetTrip.seats.findIndex(s => s.id === targetSeatId);
            const sStatus = sourceTrip.seats[sIdx].status;
            const tStatus = targetTrip.seats[tIdx].status;
            
            sourceTrip.seats[sIdx].status = tStatus;
            targetTrip.seats[tIdx].status = sStatus;

            // Di chuyển vé của đối phương: Đích -> Nguồn
            tItem.seatIds = tItem.seatIds.filter(sid => sid !== targetSeatId);
            tItem.tickets.splice(tTicketIndex, 1);
            
            const targetMovedToItem = ensureItemForTrip(tBooking, sourceTrip);
            targetMovedToItem.seatIds.push(sourceSeatId);
            tTicket.seatId = sourceSeatId; // CẬP NHẬT ID GHẾ MỚI VÀO TICKET DETAIL
            targetMovedToItem.tickets.push(tTicket);

            // Di chuyển vé của mình: Nguồn -> Đích
            sourceItem.seatIds = sourceItem.seatIds.filter(sid => sid !== sourceSeatId);
            sourceItem.tickets.splice(sourceTicketIndex, 1);
            
            const sourceMovedToItem = ensureItemForTrip(booking, targetTrip);
            sourceMovedToItem.seatIds.push(targetSeatId);
            sourceTicket.seatId = targetSeatId; // CẬP NHẬT ID GHẾ MỚI VÀO TICKET DETAIL
            sourceMovedToItem.tickets.push(sourceTicket);

        } else {
            // --- TRƯỜNG HỢP CHUYỂN ĐƠN THUẦN (MOVE) ---
            const sIdx = sourceTrip.seats.findIndex(s => s.id === sourceSeatId);
            const tIdx = targetTrip.seats.findIndex(s => s.id === targetSeatId);
            const sStatus = sourceTrip.seats[sIdx].status;
            
            sourceTrip.seats[sIdx].status = 'available';
            targetTrip.seats[tIdx].status = sStatus;

            // Di chuyển vé của mình: Nguồn -> Đích
            sourceItem.seatIds = sourceItem.seatIds.filter(sid => sid !== sourceSeatId);
            sourceItem.tickets.splice(sourceTicketIndex, 1);

            const sourceMovedToItem = ensureItemForTrip(booking, targetTrip);
            sourceMovedToItem.seatIds.push(targetSeatId);
            sourceTicket.seatId = targetSeatId; // QUAN TRỌNG: Cập nhật link ghế mới
            sourceMovedToItem.tickets.push(sourceTicket);
        }
    }

    // 2. Cập nhật lại giá và làm sạch BookingItems cho tất cả booking bị ảnh hưởng
    for (const b of modifiedBookings.values()) {
        b.items.forEach(item => {
            if (item.tickets) {
                item.price = item.tickets.reduce((sum, t) => sum + (t.price || 0), 0);
            }
        });
        b.items = b.items.filter(i => i.seatIds.length > 0);
        b.totalPrice = b.items.reduce((sum, i) => sum + (i.price || 0), 0);
        b.totalTickets = b.items.reduce((sum, i) => sum + i.seatIds.length, 0);
        b.markModified('items');
        await b.save();
    }

    sourceTrip.markModified('seats');
    targetTrip.markModified('seats');
    await sourceTrip.save();
    await targetTrip.save();

    await logBookingAction(bookingId, 'TRANSFER', `Điều phối khách sang xe ${targetTrip.licensePlate}`);

    const allTrips = await Trip.find();
    const allBookings = await Booking.aggregate([{ $lookup: { from: "payments", localField: "_id", foreignField: "bookingId", as: "paymentRecords" } }, { $addFields: { id: "$_id", payment: { paidCash: { $sum: "$paymentRecords.cashAmount" }, paidTransfer: { $sum: "$paymentRecords.transferAmount" } } } }, { $project: { paymentRecords: 0, _id: 0, __v: 0 } }]);
    res.json({ success: true, trips: allTrips, bookings: allBookings });
  } catch (e) { 
    console.error("Transfer error:", e);
    res.status(500).json({ error: e.message }); 
  }
});

app.patch("/api/bookings/:id/tickets/:seatId", async (req, res) => {
    try {
        const { id, seatId } = req.params;
        const { pickup, dropoff, note, phone, name } = req.body;
        const booking = await Booking.findById(id);
        if (!booking) return res.status(404).json({ error: "Booking not found" });
        let updated = false;
        booking.items.forEach(item => {
            if (item.tickets) {
                const ticket = item.tickets.find(t => t.seatId === seatId);
                if (ticket) {
                    if (pickup !== undefined) ticket.pickup = pickup;
                    if (dropoff !== undefined) ticket.dropoff = dropoff;
                    if (note !== undefined) ticket.note = note;
                    updated = true;
                }
            }
        });
        if (!updated) return res.status(404).json({ error: "Ticket not found" });
        if (phone) booking.passenger.phone = phone;
        if (name) booking.passenger.name = name;
        booking.markModified('items');
        await booking.save();
        const result = await Booking.aggregate([{ $match: { _id: new mongoose.Types.ObjectId(id) } }, { $lookup: { from: "payments", localField: "_id", foreignField: "bookingId", as: "paymentRecords" } }, { $addFields: { id: "$_id", payment: { paidCash: { $sum: "$paymentRecords.cashAmount" }, paidTransfer: { $sum: "$paymentRecords.transferAmount" } } } }, { $project: { paymentRecords: 0, _id: 0, __v: 0 } }]);
        res.json({ booking: result[0] });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/bookings/:id", async (req, res) => {
    try {
        const bookingId = req.params.id;
        const booking = await Booking.findById(bookingId);
        if (!booking) return res.status(404).json({ error: "Booking not found" });
        for (const item of booking.items) {
            const trip = await Trip.findById(item.tripId);
            if (trip) {
                trip.seats = trip.seats.map(s => item.seatIds.includes(s.id) ? { ...s, status: 'available' } : s);
                trip.markModified('seats');
                await trip.save();
            }
        }
        await Payment.deleteMany({ bookingId: booking._id });
        await Booking.findByIdAndDelete(bookingId);
        const allTrips = await Trip.find();
        const allBookings = await Booking.aggregate([{ $lookup: { from: "payments", localField: "_id", foreignField: "bookingId", as: "paymentRecords" } }, { $addFields: { id: "$_id", payment: { paidCash: { $sum: "$paymentRecords.cashAmount" }, paidTransfer: { $sum: "$paymentRecords.transferAmount" } } } }, { $project: { paymentRecords: 0, _id: 0, __v: 0 } }]);
        res.json({ success: true, trips: allTrips, bookings: allBookings });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/payments", async (req, res) => {
    try {
        const payments = await Payment.find().populate('bookingId').sort({ timestamp: -1 });
        const formatted = payments.map(p => { const doc = p.toJSON(); doc.amount = doc.totalAmount; return doc; });
        res.json(formatted);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/payments/:id", async (req, res) => { try { const payment = await Payment.findByIdAndUpdate(req.params.id, req.body, { new: true }); res.json(payment); } catch (e) { res.status(500).json({ error: e.message }); } });
app.get("/api/settings/:key", async (req, res) => { try { const setting = await Setting.findOne({ key: req.params.key }); res.json(setting ? setting.value : null); } catch (error) { res.status(500).json({ error: error.message }); } });
app.post("/api/settings", async (req, res) => { try { const { key, value } = req.body; const setting = await Setting.findOneAndUpdate({ key }, { value }, { upsert: true, new: true }); res.json(setting.value); } catch (error) { res.status(500).json({ error: error.message }); } });

app.post("/api/maintenance/fix-seats", async (req, res) => {
  try {
    const activeBookings = await Booking.find({ status: { $ne: 'cancelled' } });
    const occupiedMap = new Set();
    activeBookings.forEach(b => { b.items.forEach(item => { item.seatIds.forEach(seatId => { occupiedMap.add(`${item.tripId}_${seatId}`); }); }); });
    const trips = await Trip.find();
    let fixedCount = 0;
    for (const trip of trips) {
      let isModified = false;
      trip.seats = trip.seats.map(s => {
        if (s.status === 'booked' || s.status === 'sold' || s.status === 'held') {
          if (!occupiedMap.has(`${trip.id}_${s.id}`)) { isModified = true; fixedCount++; return { ...s, status: 'available' }; }
        }
        return s;
      });
      if (isModified) { trip.markModified('seats'); await trip.save(); }
    }
    res.json({ success: true, fixedCount });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/bookings/swap", async (req, res) => {
    try {
        const { tripId, seatId1, seatId2 } = req.body;
        const trip = await Trip.findById(tripId);
        if (!trip) return res.status(404).json({ error: "Trip not found" });
        const seat1 = trip.seats.find(s => s.id === seatId1);
        const seat2 = trip.seats.find(s => s.id === seatId2);
        const booking1 = await Booking.findOne({ status: { $ne: 'cancelled' }, "items": { $elemMatch: { tripId: tripId, seatIds: seatId1 } } });
        if (!booking1) return res.status(404).json({ error: "Source has no booking" });
        const booking2 = await Booking.findOne({ status: { $ne: 'cancelled' }, "items": { $elemMatch: { tripId: tripId, seatIds: seatId2 } } });
        if (booking2) {
             if (booking1._id.equals(booking2._id)) {
                 booking1.items = booking1.items.map(item => {
                     if (item.tripId === tripId) {
                         const newSeatIds = item.seatIds.map(s => s === seatId1 ? seatId2 : s === seatId2 ? seatId1 : s);
                         let newTickets = item.tickets.map(t => t.seatId === seatId1 ? { ...t, seatId: seatId2 } : t.seatId === seatId2 ? { ...t, seatId: seatId1 } : t);
                         return { ...item, seatIds: newSeatIds, tickets: newTickets };
                     }
                     return item;
                 });
                 booking1.markModified('items');
                 await booking1.save();
             } else {
                 booking1.items = booking1.items.map(item => { if (item.tripId === tripId) { const newSeatIds = item.seatIds.map(s => s === seatId1 ? seatId2 : s); let newTickets = item.tickets.map(t => t.seatId === seatId1 ? { ...t, seatId: seatId2 } : t); return { ...item, seatIds: newSeatIds, tickets: newTickets }; } return item; });
                 booking2.items = booking2.items.map(item => { if (item.tripId === tripId) { const newSeatIds = item.seatIds.map(s => s === seatId2 ? seatId1 : s); let newTickets = item.tickets.map(t => t.seatId === seatId2 ? { ...t, seatId: seatId1 } : t); return { ...item, seatIds: newSeatIds, tickets: newTickets }; } return item; });
                 const s1s = seat1.status; const s2s = seat2.status;
                 trip.seats = trip.seats.map(s => s.id === seatId1 ? { ...s, status: s2s } : s.id === seatId2 ? { ...s, status: s1s } : s);
                 booking1.markModified('items'); booking2.markModified('items'); trip.markModified('seats');
                 await booking1.save(); await booking2.save(); await trip.save();
             }
        } else {
            booking1.items = booking1.items.map(item => { if (item.tripId === tripId) { const newSeatIds = item.seatIds.map(s => s === seatId1 ? seatId2 : s); let newTickets = item.tickets.map(t => t.seatId === seatId1 ? { ...t, seatId: seatId2 } : t); return { ...item, seatIds: newSeatIds, tickets: newTickets }; } return item; });
            const s1s = seat1.status; trip.seats = trip.seats.map(s => s.id === seatId1 ? { ...s, status: 'available' } : s.id === seatId2 ? { ...s, status: s1s } : s);
            booking1.markModified('items'); trip.markModified('seats'); await booking1.save(); await trip.save();
        }
        const allBookings = await Booking.aggregate([{ $lookup: { from: "payments", localField: "_id", foreignField: "bookingId", as: "paymentRecords" } }, { $addFields: { id: "$_id", payment: { paidCash: { $sum: "$paymentRecords.cashAmount" }, paidTransfer: { $sum: "$paymentRecords.transferAmount" } } } }, { $project: { paymentRecords: 0, _id: 0, __v: 0 } }]);
        const allTrips = await Trip.find();
        res.json({ bookings: allBookings, trips: allTrips });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, "0.0.0.0", async () => { await seedData(); console.log(`🚀 Server running on http://0.0.0.0:${PORT}`); });
