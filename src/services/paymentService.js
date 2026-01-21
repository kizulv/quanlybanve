import Payment from "../models/Payment.js";
import Booking from "../models/Booking.js";
import Trip from "../models/Trip.js";
import Route from "../models/Route.js";
import { logDebug } from "../utils/logger.js";

export const getBookingsWithPayment = async (match = {}, session = null) => {
  const pipeline = [
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
  ];

  const query = Booking.aggregate(pipeline);
  if (session) query.session(session);
  const bookings = await query;

  return bookings.map((b) => {
    if (b.items) {
      b.items = b.items.map((item) => ({
        ...item,
        seatIds: item.tickets ? item.tickets.map((t) => t.seatId) : [],
      }));
    }

    const totalPaid =
      (b.payment?.paidCash || 0) + (b.payment?.paidTransfer || 0);
    const hasHoldTickets = b.items?.some((item) =>
      item.tickets?.some((t) => t.status === "hold"),
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

export const getBookingPayments = async (bookingId, session = null) => {
  const query = Payment.find({ bookingId });
  if (session) query.session(session);
  const payments = await query;

  const paidCash = payments.reduce((sum, p) => sum + (p.cashAmount || 0), 0);
  const paidTransfer = payments.reduce(
    (sum, p) => sum + (p.transferAmount || 0),
    0,
  );
  return { paidCash, paidTransfer };
};

export const processPaymentUpdate = async (
  booking,
  newPaymentState,
  session = null,
) => {
  const current = await getBookingPayments(booking._id, session);
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

  const enrichedTrips = await Promise.all(
    booking.items.map(async (i) => {
      const tripQuery = Trip.findById(i.tripId);
      if (session) tripQuery.session(session);
      const trip = await tripQuery;

      let route = null;
      if (trip) {
        const routeQuery = Route.findById(trip.routeId);
        if (session) routeQuery.session(session);
        route = await routeQuery;
      }

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
        labels: seatLabels,
        tickets: i.tickets.map((t) => {
          const seat = trip?.seats?.find((s) => s.id === t.seatId);
          return { ...t.toObject(), label: seat ? seat.label : t.seatId };
        }),
        busType: i.busType || trip?.type || "SLEEPER",
        isEnhanced: i.isEnhanced || route?.isEnhanced || false,
      };
    }),
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
      seats: booking.items.flatMap((i) => i.tickets.map((t) => t.seatId)),
      labels: enrichedTrips.flatMap((et) => et.labels),
      tripDate: booking.items[0]?.tripDate,
      route: booking.items[0]?.route,
      licensePlate: booking.items[0]?.licensePlate,
      trips: enrichedTrips,
    },
  });
  await paymentRecord.save(session ? { session } : undefined);
};
