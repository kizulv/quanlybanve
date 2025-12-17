
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

// Trip Schema: Strictly operational data (Schedule, Seats Status). No Payment Data.
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
    seats: Array, // Stores seat configuration and status (Available/Booked/Sold), NOT payment records.
    direction: String,
  },
  { toJSON: { virtuals: true, transform: transformId } }
);

// Ticket Detail Schema (Granular per seat)
const ticketDetailSchema = new mongoose.Schema({
    seatId: String,
    price: Number,
    pickup: String,
    dropoff: String
}, { _id: false });

// Booking Item Schema: Snapshot of trip details at time of booking
const bookingItemSchema = new mongoose.Schema({
    tripId: String,
    tripDate: String,
    route: String,
    licensePlate: String,
    seatIds: [String],
    tickets: [ticketDetailSchema], // NEW: Detailed ticket info
    price: Number // Total price for this line item (sum of tickets)
}, { _id: false });

// Booking Schema: Strictly Invoice/Order Data. No Payment Data.
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
    status: String, // pending | confirmed | cancelled | modified
    createdAt: String,
    totalPrice: Number, // Total Invoice Amount
    totalTickets: Number,
  },
  { toJSON: { virtuals: true, transform: transformId } }
);

// Payment Schema: The Single Source of Truth for Financial Transactions
const paymentSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    totalAmount: Number, // Net change in balance
    cashAmount: { type: Number, default: 0 },
    transferAmount: { type: Number, default: 0 },
    method: String, // cash | transfer | mixed
    type: String, // payment | refund
    note: String,
    timestamp: { type: Date, default: Date.now },
    performedBy: String,
    // Audit Trail Snapshot
    details: {
       seats: [String],
       tripDate: String,
       route: String,
       licensePlate: String,
       pricePerTicket: Number
    }
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

// --- HELPER: GET CURRENT PAYMENTS FOR BOOKING ---
const getBookingPayments = async (bookingId) => {
    const payments = await Payment.find({ bookingId });
    const paidCash = payments.reduce((sum, p) => sum + (p.cashAmount || 0), 0);
    const paidTransfer = payments.reduce((sum, p) => sum + (p.transferAmount || 0), 0);
    return { paidCash, paidTransfer };
};

// --- HELPER: RECORD PAYMENT DELTA ---
// Calculates the difference between existing DB records and the new desired state
const processPaymentUpdate = async (booking, newPaymentState) => {
    // 1. Get current totals strictly from Payment Collection
    const current = await getBookingPayments(booking._id);
    
    // 2. Calculate Deltas
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

    // Extract snapshot details
    const tripDetails = booking.items[0] || {};
    const allSeats = booking.items.flatMap(i => i.seatIds);
    const avgPrice = booking.totalTickets > 0 ? booking.totalPrice / booking.totalTickets : 0;

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
            pricePerTicket: avgPrice
        }
    });

    await paymentRecord.save();
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


// 4. Bookings - Aggregated with Payments on Read
app.get("/api/bookings", async (req, res) => {
  try {
    const bookings = await Booking.aggregate([
      {
        $lookup: {
          from: "payments",
          localField: "_id",
          foreignField: "bookingId",
          as: "paymentRecords"
        }
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
      {
        $project: {
          paymentRecords: 0,
          _id: 0, 
          __v: 0
        }
      }
    ]);
    
    res.json(bookings);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/bookings", async (req, res) => {
  try {
    const { items, passenger, payment, status } = req.body; 
    
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

        // Use tickets array from body if present, or fallback to simple seats
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

        bookingItems.push({
            tripId: trip.id,
            tripDate: trip.departureTime,
            route: trip.route,
            licensePlate: trip.licensePlate,
            seatIds: seatIds,
            tickets: tickets, // Save detailed info
            price: itemPrice
        });
    }

    // Determine status
    const totalPaid = (payment?.paidCash || 0) + (payment?.paidTransfer || 0);
    const isFullyPaid = totalPaid >= calculatedTotalPrice;
    
    const finalStatus = status ? status : (isFullyPaid ? "confirmed" : "pending");
    // Standard Global Status
    const globalSeatStatus = finalStatus === "confirmed" ? "sold" : "booked";

    // Update Trips (Status only, no payment info)
    for (const item of bookingItems) {
         const trip = await Trip.findById(item.tripId);
         if (!trip) continue;
         
         const seatIds = item.seatIds;
         
         // Create a quick lookup for ticket prices
         const ticketPriceMap = {};
         item.tickets.forEach(t => {
             ticketPriceMap[t.seatId] = t.price;
         });

         trip.seats = trip.seats.map(s => {
             if (seatIds.includes(s.id)) {
                 // Check if this specific seat has a price of 0
                 // If price is 0 (free/gift), force status to 'booked' regardless of payment
                 const specificPrice = ticketPriceMap[s.id];
                 const finalSeatStatus = (specificPrice === 0) ? 'booked' : globalSeatStatus;
                 return { ...s, status: finalSeatStatus };
             }
             return s;
         });
         
         await trip.save();
         updatedTrips.push(trip);
    }

    // Save Booking (No payment field)
    const booking = new Booking({
      passenger,
      items: bookingItems,
      status: finalStatus,
      createdAt: now,
      totalPrice: calculatedTotalPrice,
      totalTickets: calculatedTotalTickets,
    });
    
    await booking.save();

    // RECORD PAYMENT IN SEPARATE DB
    if (totalPaid > 0 || payment) {
        await processPaymentUpdate(booking, payment);
    }

    // Return Aggregated Booking
    const aggregatedBookings = await Booking.aggregate([
        { $match: { _id: booking._id } },
        {
            $lookup: {
                from: "payments",
                localField: "_id",
                foreignField: "bookingId",
                as: "paymentRecords"
            }
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

    res.json({ bookings: aggregatedBookings, updatedTrips: updatedTrips }); 
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// UPDATE BOOKING
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

      // 2. Process New Items
      let calculatedTotalPrice = 0;
      let calculatedTotalTickets = 0;
      const bookingItems = [];
      const updatedTrips = [];

      for (const item of items) {
          const trip = await Trip.findById(item.tripId);
          if (!trip) continue; 
          
          // Use tickets array from body if present
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
          
          bookingItems.push({
              tripId: trip.id,
              tripDate: trip.departureTime,
              route: trip.route,
              licensePlate: trip.licensePlate,
              seatIds: seatIds,
              tickets: tickets,
              price: itemPrice
          });
      }

      // 3. Determine Status
      const totalPaid = (payment?.paidCash || 0) + (payment?.paidTransfer || 0);
      const isFullyPaid = totalPaid >= calculatedTotalPrice;
      
      let finalStatus;
      if (calculatedTotalTickets === 0) {
          finalStatus = "cancelled";
      } else {
          finalStatus = "modified";
          if (isFullyPaid) finalStatus = "confirmed";
      }

      const globalSeatStatus = isFullyPaid ? "sold" : "booked";

      // 4. Update Trips
      if (calculatedTotalTickets > 0) {
          for (const item of bookingItems) {
              const trip = await Trip.findById(item.tripId);
              if (!trip) continue;

              const seatIds = item.seatIds;
              
              // Create lookup for ticket prices
              const ticketPriceMap = {};
              item.tickets.forEach(t => {
                  ticketPriceMap[t.seatId] = t.price;
              });

              trip.seats = trip.seats.map(s => {
                  if (seatIds.includes(s.id)) {
                      // Force 'booked' if price is 0
                      const specificPrice = ticketPriceMap[s.id];
                      const finalSeatStatus = (specificPrice === 0) ? 'booked' : globalSeatStatus;
                      return { ...s, status: finalSeatStatus };
                  }
                  return s;
              });
              
              await trip.save();
              if (!updatedTrips.find(t => t.id === trip.id)) {
                  updatedTrips.push(trip);
              }
          }
      }

      // 5. Update Booking Record (No Payment Field)
      oldBooking.passenger = passenger;
      oldBooking.items = bookingItems;
      oldBooking.status = finalStatus;
      oldBooking.totalPrice = calculatedTotalPrice;
      oldBooking.totalTickets = calculatedTotalTickets;
      
      await oldBooking.save();

      // 6. RECORD PAYMENT DIFFERENCE (INDEPENDENT DB)
      await processPaymentUpdate(oldBooking, payment);

      const allTrips = await Trip.find();

      // Fetch updated booking with aggregated payment
      const aggregatedBooking = await Booking.aggregate([
        { $match: { _id: oldBooking._id } },
        {
            $lookup: {
                from: "payments",
                localField: "_id",
                foreignField: "bookingId",
                as: "paymentRecords"
            }
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

      res.json({ booking: aggregatedBooking[0], updatedTrips: allTrips });

  } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
  }
});

// PARTIAL UPDATE BOOKING (Passenger Info Only)
app.patch("/api/bookings/:id/passenger", async (req, res) => {
    try {
        const { passenger } = req.body;
        const bookingId = req.params.id;
        
        await Booking.findByIdAndUpdate(
            bookingId,
            { passenger: passenger },
            { new: true }
        );

        const aggregatedBooking = await Booking.aggregate([
            { $match: { _id: new mongoose.Types.ObjectId(bookingId) } },
            {
                $lookup: {
                    from: "payments",
                    localField: "_id",
                    foreignField: "bookingId",
                    as: "paymentRecords"
                }
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

        if (!aggregatedBooking || aggregatedBooking.length === 0) return res.status(404).json({ error: "Booking not found" });
        
        res.json({ booking: aggregatedBooking[0] });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// DELETE BOOKING (For Undo Create)
app.delete("/api/bookings/:id", async (req, res) => {
    try {
        const bookingId = req.params.id;
        const booking = await Booking.findById(bookingId);
        
        if (!booking) return res.status(404).json({ error: "Booking not found" });

        for (const item of booking.items) {
            const trip = await Trip.findById(item.tripId);
            if (trip) {
                trip.seats = trip.seats.map(s => {
                    if (item.seatIds.includes(s.id)) {
                        return { ...s, status: 'available' };
                    }
                    return s;
                });
                await trip.save();
            }
        }

        // Delete associated payments
        await Payment.deleteMany({ bookingId: booking._id });

        await Booking.findByIdAndDelete(bookingId);
        
        const allTrips = await Trip.find();
        const allBookings = await Booking.aggregate([
            {
              $lookup: {
                from: "payments",
                localField: "_id",
                foreignField: "bookingId",
                as: "paymentRecords"
              }
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

        res.json({ success: true, trips: allTrips, bookings: allBookings });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// 5. Payment Management APIs
app.get("/api/payments", async (req, res) => {
    try {
        const payments = await Payment.find().populate('bookingId').sort({ timestamp: -1 });
        const formattedPayments = payments.map(p => {
            const doc = p.toJSON();
            if (doc.totalAmount === undefined) {
                doc.amount = (doc.cashAmount || 0) + (doc.transferAmount || 0);
            } else {
                doc.amount = doc.totalAmount;
            }
            return doc;
        });
        res.json(formattedPayments);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put("/api/payments/:id", async (req, res) => {
    try {
        const payment = await Payment.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(payment);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete("/api/payments/:id", async (req, res) => {
    try {
        await Payment.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 6. Settings
app.get("/api/settings/:key", async (req, res) => {
  try { const setting = await Setting.findOne({ key: req.params.key }); res.json(setting ? setting.value : null); } catch (error) { res.status(500).json({ error: error.message }); }
});
app.post("/api/settings", async (req, res) => {
  try { const { key, value } = req.body; const setting = await Setting.findOneAndUpdate({ key }, { value }, { upsert: true, new: true }); res.json(setting.value); } catch (error) { res.status(500).json({ error: error.message }); }
});

// MAINTENANCE: Fix Ghost Seats
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
        if (s.status === 'booked' || s.status === 'sold') {
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
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// SWAP SEATS
app.post("/api/bookings/swap", async (req, res) => {
    try {
        const { tripId, seatId1, seatId2 } = req.body;
        const trip = await Trip.findById(tripId);
        if (!trip) return res.status(404).json({ error: "Trip not found" });

        const seat1 = trip.seats.find(s => s.id === seatId1);
        const seat2 = trip.seats.find(s => s.id === seatId2);

        if (!seat1 || !seat2) return res.status(400).json({ error: "Seat invalid" });

        const booking1 = await Booking.findOne({
            status: { $ne: 'cancelled' },
            "items": { $elemMatch: { tripId: tripId, seatIds: seatId1 } }
        });

        if (!booking1) return res.status(404).json({ error: "Source seat has no active booking" });

        const booking2 = await Booking.findOne({
            status: { $ne: 'cancelled' },
            "items": { $elemMatch: { tripId: tripId, seatIds: seatId2 } }
        });

        if (booking2) {
             booking1.items = booking1.items.map(item => {
                 if (item.tripId === tripId) {
                     // Swap seatId in array
                     const newSeatIds = item.seatIds.map(s => s === seatId1 ? seatId2 : s);
                     // Swap ticket details if present
                     let newTickets = item.tickets;
                     if (newTickets) {
                         newTickets = newTickets.map(t => t.seatId === seatId1 ? { ...t, seatId: seatId2 } : t);
                     }
                     return { ...item, seatIds: newSeatIds, tickets: newTickets };
                 }
                 return item;
             });
             
             booking2.items = booking2.items.map(item => {
                 if (item.tripId === tripId) {
                     const newSeatIds = item.seatIds.map(s => s === seatId2 ? seatId1 : s);
                     let newTickets = item.tickets;
                     if (newTickets) {
                         newTickets = newTickets.map(t => t.seatId === seatId2 ? { ...t, seatId: seatId1 } : t);
                     }
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

             await booking1.save();
             await booking2.save();
             await trip.save();

        } else {
            booking1.items = booking1.items.map(item => {
                 if (item.tripId === tripId) {
                     const newSeatIds = item.seatIds.map(s => s === seatId1 ? seatId2 : s);
                     let newTickets = item.tickets;
                     if (newTickets) {
                         newTickets = newTickets.map(t => t.seatId === seatId1 ? { ...t, seatId: seatId2 } : t);
                     }
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

            await booking1.save();
            await trip.save();
        }
        
        // Return Aggregated Bookings
        const allBookings = await Booking.aggregate([
            {
              $lookup: {
                from: "payments",
                localField: "_id",
                foreignField: "bookingId",
                as: "paymentRecords"
              }
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
        
        const allTrips = await Trip.find();
        
        res.json({ bookings: allBookings, trips: allTrips });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// Start Server
app.listen(PORT, "0.0.0.0", async () => {
  await seedData();
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});
