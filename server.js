
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
    dropoff: String
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
      enum: ['CREATE', 'UPDATE', 'CANCEL', 'SWAP', 'PASSENGER_UPDATE', 'DELETE'],
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
    // Auto update the Booking's updatedAt field
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
        tripsSnapshot.push({
            route: item.route,
            tripDate: item.tripDate,
            licensePlate: item.licensePlate,
            seats: item.seatIds,
            tickets: item.tickets,
            isEnhanced: item.isEnhanced
        });
    }

    const paymentRecord = new Payment({
        bookingId: booking._id,
        totalAmount: totalDelta,
        cashAmount: cashDelta,
        transferAmount: transferDelta,
        type,
        method,
        note: type === 'refund' ? 'Hoàn tiền' : 'Thanh toán/Cập nhật',
        timestamp: new Date(),
        details: {
            seats: allSeats,
            tripDate: tripDetails.tripDate,
            route: tripDetails.route,
            licensePlate: tripDetails.licensePlate,
            trips: tripsSnapshot 
        }
    });

    await paymentRecord.save();
    await Booking.findByIdAndUpdate(booking._id, { updatedAt: new Date().toISOString() });
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
      {
        $lookup: { from: "payments", localField: "_id", foreignField: "bookingId", as: "paymentRecords" }
      },
      {
        $addFields: {
          id: "$_id",
          payment: {
            paidCash: { $sum: "$paymentRecords.cashAmount" },
            paidTransfer: { $sum: "$paymentRecords.transferAmount" }
          }
        }
      },
      { $project: { paymentRecords: 0, _id: 0, __v: 0 } }
    ]);
    res.json(bookings);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/bookings/:id/history", async (req, res) => {
  try {
    const history = await History.find({ bookingId: req.params.id }).sort({ timestamp: -1 });
    res.json(history);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/bookings", async (req, res) => {
  try {
    const { items, passenger, payment, status: requestedStatus } = req.body; 
    
    if (!items || items.length === 0) {
        return res.status(400).json({ error: "No items to book" });
    }

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

        const tickets = item.tickets || item.seats.map(s => ({ 
            seatId: s.id, 
            price: s.price, 
            pickup: passenger.pickupPoint || '', 
            dropoff: passenger.dropoffPoint || '' 
        }));

        const seatIds = tickets.map(t => t.seatId);
        const itemPrice = tickets.reduce((sum, t) => sum + t.price, 0);
        
        calculatedTotalPrice += itemPrice;
        calculatedTotalTickets += seatIds.length;

        const seatLabels = seatIds.map(sid => {
            const s = trip.seats.find(ts => ts.id === sid);
            return s ? s.label : sid;
        });

        logTripDetails.push({
            route: trip.route,
            tripDate: trip.departureTime,
            seats: seatLabels,
            licensePlate: trip.licensePlate
        });

        bookingItems.push({
            tripId: trip.id,
            tripDate: trip.departureTime,
            route: trip.route,
            licensePlate: trip.licensePlate,
            seatIds: seatIds,
            tickets: tickets,
            price: itemPrice,
            isEnhanced: isEnhanced,
            busType: trip.type
        });
    }

    const totalPaid = (payment?.paidCash || 0) + (payment?.paidTransfer || 0);
    const isFullyPaid = totalPaid >= calculatedTotalPrice;
    
    // Status Logic
    let finalStatus = requestedStatus;
    if (!finalStatus) {
        finalStatus = isFullyPaid ? "payment" : "booking";
    }

    // Mapping to seat status
    const getSeatStatusForBookingStatus = (bStatus) => {
        if (bStatus === 'payment') return 'sold';
        if (bStatus === 'hold') return 'held';
        return 'booked'; // for 'booking' status
    };

    const targetSeatStatus = getSeatStatusForBookingStatus(finalStatus);

    for (const item of bookingItems) {
         const trip = await Trip.findById(item.tripId);
         if (!trip) continue;
         
         const seatIds = item.seatIds;
         trip.seats = trip.seats.map(s => {
             if (seatIds.includes(s.id)) {
                 return { ...s, status: targetSeatStatus };
             }
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
      updatedAt: now,
      totalPrice: calculatedTotalPrice,
      totalTickets: calculatedTotalTickets,
    });
    
    await booking.save();

    await logBookingAction(
        booking._id,
        'CREATE',
        `Tạo mới đơn hàng (${finalStatus === 'payment' ? 'Mua vé' : finalStatus === 'hold' ? 'Giữ vé' : 'Đặt vé'})`,
        { 
            trips: logTripDetails,
            totalTickets: calculatedTotalTickets 
        }
    );

    if (totalPaid > 0 || payment) {
        await processPaymentUpdate(booking, payment);
    }

    const aggregatedBookings = await Booking.aggregate([
        { $match: { _id: booking._id } },
        {
            $lookup: { from: "payments", localField: "_id", foreignField: "bookingId", as: "paymentRecords" }
        },
        {
            $addFields: {
                id: "$_id",
                payment: { paidCash: { $sum: "$paymentRecords.cashAmount" }, paidTransfer: { $sum: "$paymentRecords.transferAmount" } }
            }
        },
        { $project: { paymentRecords: 0, _id: 0, __v: 0 } }
    ]);

    res.json({ bookings: aggregatedBookings, updatedTrips: updatedTrips }); 
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/bookings/:id", async (req, res) => {
  try {
      const { items, passenger, payment } = req.body;
      const bookingId = req.params.id;

      const oldBooking = await Booking.findById(bookingId);
      if (!oldBooking) return res.status(404).json({ error: "Booking not found" });

      const comparisonMap = {};

      oldBooking.items.forEach(item => {
          if (!comparisonMap[item.tripId]) {
              comparisonMap[item.tripId] = { 
                  date: item.tripDate, 
                  route: item.route, 
                  oldSeats: new Set(item.seatIds), 
                  newSeats: new Set() 
              };
          } else {
              item.seatIds.forEach(s => comparisonMap[item.tripId].oldSeats.add(s));
          }
      });

      for (const oldItem of oldBooking.items) {
          const trip = await Trip.findById(oldItem.tripId);
          if (trip) {
              trip.seats = trip.seats.map(s => {
                  if (oldItem.seatIds.includes(s.id)) return { ...s, status: 'available' };
                  return s;
              });
              await trip.save();
          }
      }

      let calculatedTotalPrice = 0;
      let calculatedTotalTickets = 0;
      const bookingItems = [];
      const updatedTrips = [];

      for (const item of items) {
          const trip = await Trip.findById(item.tripId);
          if (!trip) continue; 

          const route = await Route.findById(trip.routeId);
          const isEnhanced = route?.isEnhanced || trip.name?.toLowerCase().includes('tăng cường') || trip.route?.toLowerCase().includes('tăng cường');
          
          const tickets = item.tickets || item.seats.map(s => ({ 
            seatId: s.id, price: s.price, pickup: passenger.pickupPoint || '', dropoff: passenger.dropoffPoint || '' 
          }));
          const seatIds = tickets.map(t => t.seatId);
          const itemPrice = tickets.reduce((sum, t) => sum + t.price, 0);
          
          calculatedTotalPrice += itemPrice;
          calculatedTotalTickets += seatIds.length;

          if (!comparisonMap[trip.id]) {
              comparisonMap[trip.id] = { 
                  date: trip.departureTime, 
                  route: trip.route, 
                  oldSeats: new Set(), 
                  newSeats: new Set(seatIds) 
              };
          } else {
              comparisonMap[trip.id].date = trip.departureTime;
              comparisonMap[trip.id].route = trip.route;
              seatIds.forEach(s => comparisonMap[trip.id].newSeats.add(s));
          }

          bookingItems.push({
              tripId: trip.id,
              tripDate: trip.departureTime,
              route: trip.route,
              licensePlate: trip.licensePlate,
              seatIds: seatIds,
              tickets: tickets,
              price: itemPrice,
              isEnhanced: isEnhanced,
              busType: trip.type
          });
      }

      const changesLog = [];
      
      for (const tripId of Object.keys(comparisonMap)) {
          const data = comparisonMap[tripId];
          const addedIds = [...data.newSeats].filter(x => !data.oldSeats.has(x));
          const removedIds = [...data.oldSeats].filter(x => !data.newSeats.has(x));

          if (addedIds.length > 0 || removedIds.length > 0) {
              const trip = await Trip.findById(tripId);
              const resolveLabel = (sid) => {
                  if (!trip) return sid;
                  const s = trip.seats.find(ts => ts.id === sid);
                  return s ? s.label : sid;
              };

              changesLog.push({
                  route: data.route,
                  date: data.date,
                  added: addedIds.map(resolveLabel),
                  removed: removedIds.map(resolveLabel)
              });
          }
      }

      const totalPaid = (payment?.paidCash || 0) + (payment?.paidTransfer || 0);
      const isFullyPaid = totalPaid >= calculatedTotalPrice;
      
      // Update status mapping
      let finalStatus = calculatedTotalTickets === 0 ? "cancelled" : (isFullyPaid ? "payment" : "booking");
      
      // Preserve "hold" if it was hold and not fully paid
      if (oldBooking.status === "hold" && !isFullyPaid && calculatedTotalTickets > 0) {
          finalStatus = "hold";
      }

      const getSeatStatusForBookingStatus = (bStatus) => {
        if (bStatus === 'payment') return 'sold';
        if (bStatus === 'hold') return 'held';
        return 'booked';
      };

      const targetSeatStatus = getSeatStatusForBookingStatus(finalStatus);

      if (calculatedTotalTickets > 0) {
          for (const item of bookingItems) {
              const trip = await Trip.findById(item.tripId);
              if (!trip) continue;
              const seatIds = item.seatIds;
              trip.seats = trip.seats.map(s => {
                  if (seatIds.includes(s.id)) {
                      return { ...s, status: targetSeatStatus };
                  }
                  return s;
              });
              await trip.save();
              if (!updatedTrips.find(t => t.id === trip.id)) updatedTrips.push(trip);
          }
      }

      let historyDesc = "Cập nhật vé";
      if (changesLog.length > 0) {
          historyDesc = "Thay đổi lịch trình/ghế";
      } else if (oldBooking.passenger.phone !== passenger.phone || oldBooking.passenger.name !== passenger.name) {
          historyDesc = "Thay đổi thông tin hành khách";
      }

      oldBooking.passenger = passenger;
      oldBooking.items = bookingItems;
      oldBooking.status = finalStatus;
      oldBooking.totalPrice = calculatedTotalPrice;
      oldBooking.totalTickets = calculatedTotalTickets;
      oldBooking.updatedAt = new Date().toISOString();
      
      await oldBooking.save();

      await logBookingAction(
        oldBooking._id,
        'UPDATE',
        historyDesc,
        { 
            changes: changesLog,
            passengerChanged: (oldBooking.passenger.phone !== passenger.phone || oldBooking.passenger.name !== passenger.name)
        }
      );

      await processPaymentUpdate(oldBooking, payment);

      const allTrips = await Trip.find();
      const aggregatedBooking = await Booking.aggregate([
        { $match: { _id: oldBooking._id } },
        {
            $lookup: { from: "payments", localField: "_id", foreignField: "bookingId", as: "paymentRecords" }
        },
        {
            $addFields: {
                id: "$_id",
                payment: { paidCash: { $sum: "$paymentRecords.cashAmount" }, paidTransfer: { $sum: "$paymentRecords.transferAmount" } }
            }
        },
        { $project: { paymentRecords: 0, _id: 0, __v: 0 } }
      ]);

      res.json({ booking: aggregatedBooking[0], updatedTrips: allTrips });

  } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
  }
});

app.patch("/api/bookings/:id/passenger", async (req, res) => {
    try {
        const { passenger } = req.body;
        const bookingId = req.params.id;
        const oldBooking = await Booking.findById(bookingId);
        if (!oldBooking) return res.status(404).json({ error: "Booking not found" });

        await Booking.findByIdAndUpdate(bookingId, { 
            passenger: passenger,
            updatedAt: new Date().toISOString()
        }, { new: true });

        await logBookingAction(
            bookingId,
            'PASSENGER_UPDATE',
            `Cập nhật thông tin khách`,
            { 
                oldName: oldBooking.passenger.name,
                newName: passenger.name,
                oldPhone: oldBooking.passenger.phone,
                newPhone: passenger.phone 
            }
        );

        const aggregatedBooking = await Booking.aggregate([
            { $match: { _id: new mongoose.Types.ObjectId(bookingId) } },
            { $lookup: { from: "payments", localField: "_id", foreignField: "bookingId", as: "paymentRecords" } },
            { $addFields: { id: "$_id", payment: { paidCash: { $sum: "$paymentRecords.cashAmount" }, paidTransfer: { $sum: "$paymentRecords.transferAmount" } } } },
            { $project: { paymentRecords: 0, _id: 0, __v: 0 } }
        ]);
        res.json({ booking: aggregatedBooking[0] });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete("/api/bookings/:id", async (req, res) => {
    try {
        const bookingId = req.params.id;
        const booking = await Booking.findById(bookingId);
        if (!booking) return res.status(404).json({ error: "Booking not found" });

        const cancelDetails = [];
        for (const item of booking.items) {
            const trip = await Trip.findById(item.tripId);
            const labels = item.seatIds.map(sid => {
                if (trip) {
                    const s = trip.seats.find(ts => ts.id === sid);
                    return s ? s.label : sid;
                }
                return sid;
            });
            cancelDetails.push({
                route: item.route,
                date: item.tripDate,
                seats: labels
            });
        }

        await logBookingAction(
            bookingId,
            'DELETE',
            'Xóa đơn hàng (Hủy vé)',
            { cancelledTrips: cancelDetails }
        );

        for (const item of booking.items) {
            const trip = await Trip.findById(item.tripId);
            if (trip) {
                trip.seats = trip.seats.map(s => {
                    if (item.seatIds.includes(s.id)) return { ...s, status: 'available' };
                    return s;
                });
                await trip.save();
            }
        }

        await Payment.deleteMany({ bookingId: booking._id });
        await Booking.findByIdAndDelete(bookingId);
        
        const allTrips = await Trip.find();
        const allBookings = await Booking.aggregate([
            { $lookup: { from: "payments", localField: "_id", foreignField: "bookingId", as: "paymentRecords" } },
            { $addFields: { id: "$_id", payment: { paidCash: { $sum: "$paymentRecords.cashAmount" }, paidTransfer: { $sum: "$paymentRecords.transferAmount" } } } },
            { $project: { paymentRecords: 0, _id: 0, __v: 0 } }
        ]);

        res.json({ success: true, trips: allTrips, bookings: allBookings });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

app.get("/api/payments", async (req, res) => {
    try {
        const payments = await Payment.find().populate('bookingId').sort({ timestamp: -1 });
        const formattedPayments = payments.map(p => {
            const doc = p.toJSON();
            if (doc.totalAmount === undefined) doc.amount = (doc.cashAmount || 0) + (doc.transferAmount || 0);
            else doc.amount = doc.totalAmount;
            return doc;
        });
        res.json(formattedPayments);
    } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put("/api/payments/:id", async (req, res) => { try { const payment = await Payment.findByIdAndUpdate(req.params.id, req.body, { new: true }); res.json(payment); } catch (e) { res.status(500).json({ error: e.message }); } });
app.delete("/api/payments/:id", async (req, res) => { try { await Payment.findByIdAndDelete(req.params.id); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });

app.get("/api/settings/:key", async (req, res) => { try { const setting = await Setting.findOne({ key: req.params.key }); res.json(setting ? setting.value : null); } catch (error) { res.status(500).json({ error: error.message }); } });
app.post("/api/settings", async (req, res) => { try { const { key, value } = req.body; const setting = await Setting.findOneAndUpdate({ key }, { value }, { upsert: true, new: true }); res.json(setting.value); } catch (error) { res.status(500).json({ error: error.message }); } });

app.post("/api/maintenance/fix-seats", async (req, res) => {
  try {
    const activeBookings = await Booking.find({ status: { $ne: 'cancelled' } });
    const occupiedMap = new Set();
    activeBookings.forEach(b => {
      b.items.forEach(item => {
        item.seatIds.forEach(seatId => {
          occupiedMap.add(`${item.tripId}_${seatId}`);
        });
      });
    });
    const trips = await Trip.find();
    let fixedCount = 0;
    const fixedTrips = [];
    for (const trip of trips) {
      let isModified = false;
      trip.seats = trip.seats.map(s => {
        if (s.status === 'booked' || s.status === 'sold' || s.status === 'held') {
          const key = `${trip.id}_${s.id}`;
          if (!occupiedMap.has(key)) {
            isModified = true;
            fixedCount++;
            return { ...s, status: 'available' };
          }
        }
        return s;
      });
      if (isModified) {
        await trip.save();
        fixedTrips.push(trip.id);
      }
    }
    res.json({ success: true, fixedCount, fixedTrips });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/bookings/swap", async (req, res) => {
    try {
        const { tripId, seatId1, seatId2 } = req.body;
        const trip = await Trip.findById(tripId);
        if (!trip) return res.status(404).json({ error: "Trip not found" });

        const seat1 = trip.seats.find(s => s.id === seatId1);
        const seat2 = trip.seats.find(s => s.id === seatId2);
        if (!seat1 || !seat2) return res.status(400).json({ error: "Seat invalid" });

        const booking1 = await Booking.findOne({ status: { $ne: 'cancelled' }, "items": { $elemMatch: { tripId: tripId, seatIds: seatId1 } } });
        if (!booking1) return res.status(404).json({ error: "Source seat has no active booking" });

        const booking2 = await Booking.findOne({ status: { $ne: 'cancelled' }, "items": { $elemMatch: { tripId: tripId, seatIds: seatId2 } } });

        if (booking2) {
             // Trường hợp 2 ghế nằm trong CÙNG 1 ĐƠN HÀNG
             if (booking1._id.equals(booking2._id)) {
                 booking1.items = booking1.items.map(item => {
                     if (item.tripId === tripId) {
                         const newSeatIds = item.seatIds.map(s => {
                             if (s === seatId1) return seatId2;
                             if (s === seatId2) return seatId1;
                             return s;
                         });
                         let newTickets = item.tickets;
                         if (newTickets) {
                             newTickets = newTickets.map(t => {
                                 if (t.seatId === seatId1) return { ...t, seatId: seatId2 };
                                 if (t.seatId === seatId2) return { ...t, seatId: seatId1 };
                                 return t;
                             });
                         }
                         return { ...item, seatIds: newSeatIds, tickets: newTickets };
                     }
                     return item;
                 });
                 
                 // Không cần thay đổi trạng thái trong trip.seats vì cả 2 đều đang bị chiếm giữ
                 // Tuy nhiên vẫn cần cập nhật label nếu cần (thường label gắn với seatId)
                 
                 booking1.updatedAt = new Date().toISOString();
                 await booking1.save();
             } else {
                 // Trường hợp 2 ghế thuộc 2 đơn hàng khác nhau
                 booking1.items = booking1.items.map(item => {
                     if (item.tripId === tripId) {
                         const newSeatIds = item.seatIds.map(s => s === seatId1 ? seatId2 : s);
                         let newTickets = item.tickets;
                         if (newTickets) newTickets = newTickets.map(t => t.seatId === seatId1 ? { ...t, seatId: seatId2 } : t);
                         return { ...item, seatIds: newSeatIds, tickets: newTickets };
                     }
                     return item;
                 });
                 booking2.items = booking2.items.map(item => {
                     if (item.tripId === tripId) {
                         const newSeatIds = item.seatIds.map(s => s === seatId2 ? seatId1 : s);
                         let newTickets = item.tickets;
                         if (newTickets) newTickets = newTickets.map(t => t.seatId === seatId2 ? { ...t, seatId: seatId1 } : t);
                         return { ...item, seatIds: newSeatIds, tickets: newTickets };
                     }
                     return item;
                 });
                 
                 const status1 = seat1.status;
                 const status2 = seat2.status;
                 trip.seats = trip.seats.map(s => {
                     if (s.id === seatId1) return { ...s, status: status2 };
                     if (s.id === seatId2) return { ...s, status: status1 };
                     return s;
                 });

                 const updateNow = new Date().toISOString();
                 booking1.updatedAt = updateNow;
                 booking2.updatedAt = updateNow;

                 await booking1.save();
                 await booking2.save();
                 await trip.save();
             }

             await logBookingAction(
                booking1._id,
                'SWAP',
                `Đổi ghế ${seat1.label} sang ${seat2.label}`,
                { route: trip.route, date: trip.departureTime, from: seat1.label, to: seat2.label }
             );
             if (!booking1._id.equals(booking2._id)) {
                 await logBookingAction(
                    booking2._id,
                    'SWAP',
                    `Đổi ghế ${seat2.label} sang ${seat1.label} (Hoán đổi)`,
                    { route: trip.route, date: trip.departureTime, from: seat1.label, to: seat2.label }
                 );
             }
        } else {
            // Trường hợp ghế đích trống
            booking1.items = booking1.items.map(item => {
                 if (item.tripId === tripId) {
                     const newSeatIds = item.seatIds.map(s => s === seatId1 ? seatId2 : s);
                     let newTickets = item.tickets;
                     if (newTickets) newTickets = newTickets.map(t => t.seatId === seatId1 ? { ...t, seatId: seatId2 } : t);
                     return { ...item, seatIds: newSeatIds, tickets: newTickets };
                 }
                 return item;
            });
            const status1 = seat1.status;
            trip.seats = trip.seats.map(s => {
                if (s.id === seatId1) return { ...s, status: 'available' };
                if (s.id === seatId2) return { ...s, status: status1 };
                return s;
            });

            booking1.updatedAt = new Date().toISOString();
            await booking1.save();
            await trip.save();

            await logBookingAction(
                booking1._id,
                'SWAP',
                `Đổi ghế ${seat1.label} sang ${seat2.label}`,
                { route: trip.route, date: trip.departureTime, from: seat1.label, to: seat2.label }
            );
        }
        
        const allBookings = await Booking.aggregate([
            { $lookup: { from: "payments", localField: "_id", foreignField: "bookingId", as: "paymentRecords" } },
            { $addFields: { id: "$_id", payment: { paidCash: { $sum: "$paymentRecords.cashAmount" }, paidTransfer: { $sum: "$paymentRecords.transferAmount" } } } },
            { $project: { paymentRecords: 0, _id: 0, __v: 0 } }
        ]);
        const allTrips = await Trip.find();
        res.json({ bookings: allBookings, trips: allTrips });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, "0.0.0.0", async () => {
  await seedData();
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});
