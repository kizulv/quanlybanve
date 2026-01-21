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
      const tripQuery = Trip.findById(i.tripId).populate("busId");
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

      // Ưu tiên lấy label từ bus.layoutConfig.seatLabels, fallback trip.seats, rồi seatId
      const bus = trip?.busId;
      const seatLabels = seatIds.map((sid) => {
        // 1. Ưu tiên bus.layoutConfig.seatLabels
        if (bus?.layoutConfig?.seatLabels?.[sid]) {
          return bus.layoutConfig.seatLabels[sid];
        }
        // 2. Fallback trip.seats
        const seat = trip?.seats?.find((s) => s.id === sid);
        if (seat?.label) return seat.label;
        // 3. Fallback seatId
        return sid;
      });

      return {
        tripId: i.tripId,
        route: i.route,
        tripDate: i.tripDate,
        licensePlate: i.licensePlate,
        seats: i.seatIds,
        labels: seatLabels,
        tickets: i.tickets.map((t) => {
          // Ưu tiên bus.layoutConfig.seatLabels
          let label = t.seatId;
          if (bus?.layoutConfig?.seatLabels?.[t.seatId]) {
            label = bus.layoutConfig.seatLabels[t.seatId];
          } else {
            const seat = trip?.seats?.find((s) => s.id === t.seatId);
            if (seat?.label) label = seat.label;
          }
          return { ...t.toObject(), label };
        }),
        busType: i.busType || trip?.type || "SLEEPER",
        isEnhanced: i.isEnhanced || route?.isEnhanced || false,
      };
    }),
  );

  // Xác định transactionLabel dựa trên delta: thanh_toan, hoan_tien, cap_nhat
  // - Nếu chỉ có delta dương (thu tiền) → thanh_toan
  // - Nếu chỉ có delta âm (hoàn tiền) → hoan_tien
  // - Nếu có cả hai (cập nhật booking) → cap_nhat
  let transactionLabel = "thanh_toan";
  if (totalDelta < 0) {
    transactionLabel = "hoan_tien";
  } else if (totalDelta > 0) {
    transactionLabel = "thanh_toan";
  } else {
    // totalDelta === 0 nhưng có thay đổi (ví dụ: đổi ghế giữ nguyên giá)
    transactionLabel = "cap_nhat";
  }

  // Tạo ghi chú chi tiết với số vé và danh sách mã ghế
  const allLabels = enrichedTrips.flatMap((et) => et.labels);
  const ticketCount = allLabels.length;
  const ticketCountPadded = ticketCount.toString().padStart(2, "0");
  const seatListStr = allLabels.join(" ");

  let note = "";
  if (transactionLabel === "thanh_toan") {
    note = `Thanh toán (${ticketCountPadded} vé) ${seatListStr}`;
  } else if (transactionLabel === "hoan_tien") {
    note = `Hoàn tiền (${ticketCountPadded} vé) ${seatListStr}`;
  } else {
    note = `Cập nhật (${ticketCountPadded} vé) ${seatListStr}`;
  }

  const paymentRecord = new Payment({
    bookingId: booking._id,
    totalAmount: totalDelta,
    cashAmount: cashDelta,
    transferAmount: transferDelta,
    type,
    transactionType: "snapshot",
    transactionLabel,
    method,
    note,
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
