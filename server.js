
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

// --- HELPERS ---

const syncTripStatuses = async (tripId) => {
    const trip = await Trip.findById(tripId);
    if (!trip) return;

    // Lấy tất cả đơn hàng đang hoạt động liên quan đến chuyến này
    const activeBookings = await Booking.find({ 
        status: { $ne: 'cancelled' },
        "items": { $elemMatch: { tripId: tripId } }
    });

    const occupiedMap = new Map(); // seatId -> status
    activeBookings.forEach(b => {
        const item = b.items.find(i => i.tripId === tripId);
        if (item) {
            let status = 'booked';
            if (b.status === 'payment') status = 'sold';
            else if (b.status === 'hold') status = 'held';
            
            item.seatIds.forEach(sid => {
                occupiedMap.set(sid, status);
            });
        }
    });

    // Cập nhật lại toàn bộ sơ đồ ghế
    trip.seats = trip.seats.map(s => {
        const newStatus = occupiedMap.get(s.id);
        return { 
            ...s, 
            status: newStatus || 'available' 
        };
    });

    trip.markModified('seats');
    await trip.save();
    return trip;
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

const ensureItemForTrip = async (booking, tripId) => {
    let item = booking.items.find(i => i.tripId === tripId);
    if (!item) {
        const trip = await Trip.findById(tripId);
        if (!trip) throw new Error("Trip not found: " + tripId);
        
        const route = await Route.findById(trip.routeId);
        const isEnhanced = route?.isEnhanced || trip.name?.toLowerCase().includes('tăng cường') || trip.route?.toLowerCase().includes('tăng cường');

        item = {
            tripId: tripId,
            tripDate: trip.departureTime,
            route: trip.route,
            licensePlate: trip.licensePlate,
            seatIds: [],
            tickets: [],
            price: 0,
            busType: trip.type,
            isEnhanced: !!isEnhanced
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
        bookingItems.push({ tripId: trip.id, tripDate: trip.departureTime, route: trip.route, licensePlate: trip.licensePlate, seatIds: seatIds, tickets: tickets, price: itemPrice, isEnhanced: !!isEnhanced, busType: trip.type });
    }
    
    const totalPaid = (payment?.paidCash || 0) + (payment?.paidTransfer || 0);
    const finalStatus = requestedStatus || (totalPaid >= calculatedTotalPrice ? "payment" : "booking");
    const booking = new Booking({ passenger, items: bookingItems, status: finalStatus, createdAt: now, updatedAt: now, totalPrice: calculatedTotalPrice, totalTickets: calculatedTotalTickets });
    await booking.save();
    
    for (const item of bookingItems) {
         await syncTripStatuses(item.tripId);
    }
    
    await logBookingAction(booking._id, 'CREATE', `Tạo đơn hàng`, { trips: logTripDetails, totalTickets: calculatedTotalTickets });
    res.json({ bookings: [booking], updatedTrips: await Trip.find() }); 
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/bookings/transfer", async (req, res) => {
  try {
    const { bookingId, sourceTripId, targetTripId, seatTransfers } = req.body;
    
    // SỬA LỖI: Sử dụng cache để quản lý các đơn hàng đang bị thay đổi trong vòng lặp
    // Điều này ngăn việc đọc dữ liệu cũ (stale data) từ Database khi chuyển nhiều ghế cùng lúc.
    const cache = new Map();
    
    const sourceBooking = await Booking.findById(bookingId);
    if (!sourceBooking) return res.status(404).json({ error: "Source booking not found" });
    cache.set(bookingId, sourceBooking);

    for (const transfer of seatTransfers) {
        const { sourceSeatId, targetSeatId } = transfer;
        
        // 1. Tìm người đang chiếm giữ ghế đích (nếu có)
        // Ưu tiên tìm trong cache trước, nếu không có mới tìm trong DB
        let targetOccupant = Array.from(cache.values()).find(b => 
            b.status !== 'cancelled' && 
            b.items.some(i => i.tripId === targetTripId && i.seatIds.includes(targetSeatId))
        );

        if (!targetOccupant) {
            targetOccupant = await Booking.findOne({ 
                status: { $ne: 'cancelled' }, 
                "items": { $elemMatch: { tripId: targetTripId, seatIds: targetSeatId } } 
            });
            if (targetOccupant) cache.set(targetOccupant._id.toString(), targetOccupant);
        }

        // 2. Thực hiện chuyển ghế cho Source Booking
        const sBooking = cache.get(bookingId);
        const sItem = sBooking.items.find(i => i.tripId === sourceTripId);
        if (!sItem) continue;

        const sTicketIdx = sItem.tickets.findIndex(t => t.seatId === sourceSeatId);
        if (sTicketIdx === -1) continue;

        const sTicket = JSON.parse(JSON.stringify(sItem.tickets[sTicketIdx]));
        
        // Xóa khỏi Trip Nguồn
        sItem.seatIds = sItem.seatIds.filter(sid => sid !== sourceSeatId);
        sItem.tickets.splice(sTicketIdx, 1);

        // Thêm vào Trip Đích
        const sTargetItem = await ensureItemForTrip(sBooking, targetTripId);
        sTargetItem.seatIds.push(targetSeatId);
        sTicket.seatId = targetSeatId;
        sTargetItem.tickets.push(sTicket);

        // 3. Nếu có người ở đích, chuyển họ về chỗ của Source ở Trip Nguồn (Hoán đổi chéo)
        if (targetOccupant) {
            const tBooking = cache.get(targetOccupant._id.toString());
            const tItem = tBooking.items.find(i => i.tripId === targetTripId);
            const tTicketIdx = tItem.tickets.findIndex(t => t.seatId === targetSeatId);
            
            if (tTicketIdx !== -1) {
                const tTicket = JSON.parse(JSON.stringify(tItem.tickets[tTicketIdx]));
                
                // Xóa khỏi Trip Đích
                tItem.seatIds = tItem.seatIds.filter(sid => sid !== targetSeatId);
                tItem.tickets.splice(tTicketIdx, 1);

                // Chuyển về Trip Nguồn (vị trí cũ của người kia)
                const tSourceItem = await ensureItemForTrip(tBooking, sourceTripId);
                tSourceItem.seatIds.push(sourceSeatId);
                tTicket.seatId = sourceSeatId;
                tSourceItem.tickets.push(tTicket);
            }
        }
    }

    // 4. Lưu tất cả thay đổi và đồng bộ
    for (const b of cache.values()) {
        b.items.forEach(item => { 
            if (item.tickets) {
                item.price = item.tickets.reduce((sum, t) => sum + (t.price || 0), 0);
            }
        });
        b.items = b.items.filter(i => i.seatIds.length > 0);
        b.totalPrice = b.items.reduce((sum, i) => sum + (i.price || 0), 0);
        b.totalTickets = b.items.reduce((sum, i) => sum + i.seatIds.length, 0);
        b.updatedAt = new Date().toISOString();
        b.markModified('items');
        await b.save();
    }

    await syncTripStatuses(sourceTripId);
    await syncTripStatuses(targetTripId);
    await logBookingAction(bookingId, 'TRANSFER', `Điều phối khách (${seatTransfers.length} ghế)`);

    res.json({ 
        success: true, 
        trips: await Trip.find(), 
        bookings: await Booking.aggregate([
            { $lookup: { from: "payments", localField: "_id", foreignField: "bookingId", as: "paymentRecords" } },
            { $addFields: { id: "$_id", payment: { paidCash: { $sum: "$paymentRecords.cashAmount" }, paidTransfer: { $sum: "$paymentRecords.transferAmount" } } } },
            { $project: { paymentRecords: 0, _id: 0, __v: 0 } }
        ])
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/bookings/swap", async (req, res) => {
    try {
        const { tripId, seatId1, seatId2 } = req.body;
        const booking1 = await Booking.findOne({ status: { $ne: 'cancelled' }, "items": { $elemMatch: { tripId: tripId, seatIds: seatId1 } } });
        const booking2 = await Booking.findOne({ status: { $ne: 'cancelled' }, "items": { $elemMatch: { tripId: tripId, seatIds: seatId2 } } });
        
        if (!booking1 && !booking2) return res.status(404).json({ error: "No bookings found at these seats" });

        if (booking1 && booking2 && booking1._id.equals(booking2._id)) {
            booking1.items = booking1.items.map(item => {
                if (item.tripId === tripId) {
                    const newSeatIds = item.seatIds.map(s => s === seatId1 ? seatId2 : s === seatId2 ? seatId1 : s);
                    const newTickets = item.tickets.map(t => {
                        if (t.seatId === seatId1) return { ...t, seatId: seatId2 };
                        if (t.seatId === seatId2) return { ...t, seatId: seatId1 };
                        return t;
                    });
                    return { ...item, seatIds: newSeatIds, tickets: newTickets };
                }
                return item;
            });
            booking1.markModified('items');
            await booking1.save();
        } else {
            if (booking1) {
                booking1.items = booking1.items.map(item => { 
                    if (item.tripId === tripId) { 
                        const newSeatIds = item.seatIds.map(s => s === seatId1 ? seatId2 : s); 
                        const newTickets = item.tickets.map(t => t.seatId === seatId1 ? { ...t, seatId: seatId2 } : t); 
                        return { ...item, seatIds: newSeatIds, tickets: newTickets }; 
                    } 
                    return item; 
                });
                booking1.markModified('items'); 
                await booking1.save();
            }
            if (booking2) {
                booking2.items = booking2.items.map(item => { 
                    if (item.tripId === tripId) { 
                        const newSeatIds = item.seatIds.map(s => s === seatId2 ? seatId1 : s); 
                        const newTickets = item.tickets.map(t => t.seatId === seatId2 ? { ...t, seatId: seatId1 } : t); 
                        return { ...item, seatIds: newSeatIds, tickets: newTickets }; 
                    } 
                    return item; 
                });
                booking2.markModified('items'); 
                await booking2.save();
            }
        }
        
        await syncTripStatuses(tripId);
        res.json({ 
            bookings: await Booking.aggregate([{ $lookup: { from: "payments", localField: "_id", foreignField: "bookingId", as: "paymentRecords" } }, { $addFields: { id: "$_id", payment: { paidCash: { $sum: "$paymentRecords.cashAmount" }, paidTransfer: { $sum: "$paymentRecords.transferAmount" } } } }, { $project: { paymentRecords: 0, _id: 0, __v: 0 } }]), 
            trips: await Trip.find() 
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/bookings/:id", async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ error: "Booking not found" });
        const tripIds = booking.items.map(i => i.tripId);
        await Booking.findByIdAndDelete(req.params.id);
        for (const tId of tripIds) { await syncTripStatuses(tId); }
        res.json({ success: true, trips: await Trip.find(), bookings: await Booking.find() });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/settings/:key", async (req, res) => { try { const setting = await Setting.findOne({ key: req.params.key }); res.json(setting ? setting.value : null); } catch (error) { res.status(500).json({ error: error.message }); } });
app.post("/api/settings", async (req, res) => { try { const { key, value } = req.body; const setting = await Setting.findOneAndUpdate({ key }, { value }, { upsert: true, new: true }); res.json(setting.value); } catch (error) { res.status(500).json({ error: error.message }); } });
app.post("/api/maintenance/fix-seats", async (req, res) => {
  try {
    const trips = await Trip.find();
    let count = 0;
    for (const trip of trips) {
      await syncTripStatuses(trip._id);
      count++;
    }
    res.json({ success: true, fixedCount: count });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, "0.0.0.0", async () => { console.log(`🚀 Server running on http://0.0.0.0:${PORT}`); });
