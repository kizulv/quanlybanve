import Booking from "../models/Booking.js";
import Trip from "../models/Trip.js";
import Route from "../models/Route.js";
import mongoose from "mongoose";
import { withTransaction } from "../utils/transaction.js";
import {
  getBookingsWithPayment,
  processPaymentUpdate,
} from "../services/paymentService.js";
import { logBookingAction } from "../services/historyService.js";

export const getAllBookings = async (req, res) => {
  try {
    const { date } = req.query;
    const match = {};
    if (date) {
      match["items.tripDate"] = { $regex: `^${date}` };
    }
    const bookings = await getBookingsWithPayment(match);
    res.json(bookings);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const createBooking = async (req, res) => {
  try {
    const result = await withTransaction(async (session) => {
      const { items, passenger, payment, status: requestedStatus } = req.body;
      if (!items || items.length === 0) throw new Error("No items to book");
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
        const trip = await Trip.findById(item.tripId)
          .populate("busId")
          .session(session);
        if (!trip) continue;
        const route = await Route.findById(trip.routeId).session(session);
        const isEnhanced =
          route?.isEnhanced ||
          trip.name?.toLowerCase().includes("tăng cường") ||
          trip.route?.toLowerCase().includes("tăng cường");

        if (finalStatus === "payment" && !item.tickets) {
          throw new Error(
            "Khi thanh toán, phải cung cấp thông tin vé chi tiết (tickets) với giá chính thức.",
          );
        }

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
        calculatedTotalPrice += itemPrice;
        calculatedTotalTickets += seatIds.length;

        bookingItems.push({
          tripId: trip.id,
          tripDate: trip.departureTime,
          route: trip.route,
          route: trip.route,
          // licensePlate: trip.licensePlate, // REMOVED: Derived dynamically
          tickets,
          price: itemPrice,
          isEnhanced,
          busType: trip.type,
        });

        const seatLogDetails = tickets.map((t) => {
          let label = t.seatId;
          if (
            trip &&
            trip.busId &&
            trip.busId.layoutConfig?.seatLabels &&
            trip.busId.layoutConfig.seatLabels[t.seatId]
          ) {
            label = trip.busId.layoutConfig.seatLabels[t.seatId];
          }
          return {
            id: t.seatId,
            label,
            status: t.status,
          };
        });

        logTripDetails.push({
          route: trip.route,
          tripDate: trip.departureTime,
          seats: seatLogDetails,
          licensePlate: trip.licensePlate,
        });
      }

      // NOTE: We no longer update Trip.seats status here.
      // Status is derived dynamically from Bookings at runtime.
      // This prevents "ghost" seats and synchronization issues.

      const booking = new Booking({
        passenger,
        items: bookingItems,
        createdAt: now,
        updatedAt: now,
        totalPrice: calculatedTotalPrice,
        totalTickets: calculatedTotalTickets,
      });
      await booking.save({ session });

      const createDesc = logTripDetails
        .map((tripLog, idx) => {
          const item = bookingItems[idx];
          const action = finalStatus === "payment" ? "Mua" : "Đặt";
          const count = tripLog.seats.length;

          const seatDetails = tripLog.seats
            .map((s) => {
              const ticket = item.tickets.find(
                (t) => String(t.seatId) === String(s.id),
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

      await logBookingAction(
        booking._id,
        "CREATE",
        createDesc,
        {
          trips: logTripDetails,
          totalTickets: calculatedTotalTickets,
        },
        session,
      );

      if (finalStatus !== "hold" && (totalPaid > 0 || payment)) {
        await processPaymentUpdate(booking, payment, session);
      }

      return { bookingId: booking._id, updatedTrips };
    });

    const bookings = await getBookingsWithPayment({ _id: result.bookingId });
    res.json({ bookings, updatedTrips: result.updatedTrips });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const swapBookings = async (req, res) => {
  try {
    const result = await withTransaction(async (session) => {
      const { tripId1, seatId1, tripId2, seatId2 } = req.body;
      console.log(
        `[SWAP] Request: ${tripId1}/${seatId1} <-> ${tripId2}/${seatId2}`,
      );

      if (!tripId1 || !seatId1 || !tripId2 || !seatId2) {
        throw new Error(
          "Missing required parameters (tripId1, seatId1, tripId2, seatId2)",
        );
      }

      // 1. Load Trips
      const trip1 = await Trip.findById(tripId1)
        .populate("busId")
        .session(session);
      const trip2 =
        String(tripId1) === String(tripId2)
          ? trip1
          : await Trip.findById(tripId2).populate("busId").session(session);

      if (!trip1 || !trip2) throw new Error("One or more trips not found");

      // Helper date formatter
      const formatDate = (dateStr) => {
        const d = new Date(dateStr);
        return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
      };

      // 2. Validate Bus Types match
      if (trip1.type !== trip2.type) {
        throw new Error(
          `Không thể đổi vé giữa các loại xe khác nhau (${trip1.type} vs ${trip2.type}).`,
        );
      }

      // 3. Find Seat Objects & Indexes
      // Since we don't persist seats in trip anymore, we skip index validation.
      // Front-end should have validated seat existence.
      // We rely on seat Ids and layout config for labeling.

      const s1Label =
        trip1.busId?.layoutConfig?.seatLabels?.[seatId1] || seatId1;
      const s2Label =
        trip2.busId?.layoutConfig?.seatLabels?.[seatId2] || seatId2;

      console.log(
        `[SWAP] Seats: ${trip1.route}(${s1Label}) <-> ${trip2.route}(${s2Label})`,
      );

      // 4. Find Bookings
      const findBookingForSeat = async (tId, sId) => {
        return Booking.findOne({
          items: {
            $elemMatch: {
              tripId: tId,
              $or: [
                { seatIds: String(sId) },
                { "tickets.seatId": String(sId) },
              ],
            },
          },
        }).session(session);
      };

      const booking1 = await findBookingForSeat(tripId1, seatId1);
      const booking2 = await findBookingForSeat(tripId2, seatId2);

      if (!booking1 && !booking2) {
        throw new Error("Cả hai ghế đều trống, không có gì để đổi.");
      }

      // Handle Aliasing
      let targetBooking2 = booking2;
      const b1Id = booking1 ? String(booking1._id) : null;
      const b2Id = booking2 ? String(booking2._id) : null;
      if (b1Id && b2Id && b1Id === b2Id) {
        targetBooking2 = booking1;
      }

      // HELPER: Move Ticket Logic
      const moveTicketBetweenTrips = (
        booking,
        fromTrip,
        toTrip,
        oldSeatId,
        newSeatId,
      ) => {
        if (!booking) return false;

        // Find source item
        const itemIndex = booking.items.findIndex(
          (i) => String(i.tripId) === String(fromTrip._id),
        );
        if (itemIndex === -1) return false;

        const item = booking.items[itemIndex];
        const ticketIndex = item.tickets.findIndex(
          (t) => String(t.seatId) === String(oldSeatId),
        );

        if (ticketIndex === -1) return false;

        // Extract ticket
        const ticketDoc = item.tickets[ticketIndex];
        const ticket = ticketDoc.toObject ? ticketDoc.toObject() : ticketDoc;
        ticket.seatId = newSeatId;

        // Remove from source
        item.tickets.splice(ticketIndex, 1);

        // Find or Create destination item
        let destItem = booking.items.find(
          (i) => String(i.tripId) === String(toTrip._id),
        );

        if (!destItem) {
          booking.items.push({
            tripId: toTrip._id,
            tripDate: toTrip.departureTime,
            route: toTrip.route,
            tickets: [],
            price: 0,
            isEnhanced:
              toTrip.name?.toLowerCase().includes("tăng cường") || false,
            busType: toTrip.type,
            seatIds: [],
          });
          destItem = booking.items[booking.items.length - 1];
        }

        destItem.tickets.push(ticket);

        // Update derived fields
        item.seatIds = item.tickets.map((t) => t.seatId);
        item.price = item.tickets.reduce((acc, t) => acc + (t.price || 0), 0);

        destItem.seatIds = destItem.tickets.map((t) => t.seatId);
        destItem.price = destItem.tickets.reduce(
          (acc, t) => acc + (t.price || 0),
          0,
        );

        // Cleanup empty source item
        if (item.tickets.length === 0) {
          booking.items.splice(itemIndex, 1);
        }

        booking.totalTickets = booking.items.reduce(
          (s, i) => s + i.tickets.length,
          0,
        );
        booking.markModified("items");
        return true;
      };

      // 5. EXECUTE MOVES
      // Move Booking1 (Ticket on Trip1/Seat1) -> Trip2/Seat2
      if (booking1) {
        moveTicketBetweenTrips(booking1, trip1, trip2, seatId1, seatId2);
      }

      // Move Booking2 (Ticket on Trip2/Seat2) -> Trip1/Seat1, IF it exists and is distinct ticket
      if (targetBooking2) {
        moveTicketBetweenTrips(targetBooking2, trip2, trip1, seatId2, seatId1);
      }

      // 6. Save Bookings
      const saveList = [];
      if (booking1) saveList.push(booking1.save({ session }));
      if (
        targetBooking2 &&
        (!booking1 || String(booking1._id) !== String(targetBooking2._id))
      ) {
        saveList.push(targetBooking2.save({ session }));
      }
      await Promise.all(saveList);

      // 8. Log History
      if (booking1) {
        await logBookingAction(
          booking1._id,
          "SWAP",
          `Đổi ghế: ${trip1.route} (${s1Label}) ngày ${formatDate(trip1.departureTime)} -> ${trip2.route} (${s2Label}) ngày ${formatDate(trip2.departureTime)}`,
          {
            tripId: trip2._id,
            route: trip2.route,
            date: trip2.departureTime,
            from: s1Label,
            to: s2Label,
          },
          session,
        );
      }
      if (
        booking2 &&
        (!booking1 || String(booking1._id) !== String(booking2._id))
      ) {
        await logBookingAction(
          booking2._id,
          "SWAP",
          `Đổi/Dời vé: ${trip2.route} (${s2Label}) ngày ${formatDate(trip2.departureTime)} -> ${trip1.route} (${s1Label}) ngày ${formatDate(trip1.departureTime)}`,
          {
            tripId: trip1._id,
            route: trip1.route,
            date: trip1.departureTime,
            from: s2Label,
            to: s1Label,
          },
          session,
        );
      }

      return { success: true };
    });

    res.json({
      success: true,
      message: "Đổi vé thành công",
      bookings: await getBookingsWithPayment(),
      trips: await Trip.find(),
    });
  } catch (e) {
    console.error("[SWAP ERROR]", e);
    res.status(500).json({
      error: e.message,
      stack: process.env.NODE_ENV === "development" ? e.stack : undefined,
    });
  }
};

export const deleteBooking = async (req, res) => {
  try {
    const result = await withTransaction(async (session) => {
      const booking = await Booking.findById(req.params.id).session(session);
      if (!booking) throw new Error("Booking not found");

      // Restore seats -> SKIPPED (Dynamic Status)
      // No need to update Trip.seats.status manually.
      /*
      for (const item of booking.items) {
        const trip = await Trip.findById(item.tripId).session(session);
        if (trip) {
          let modified = false;
          for (const ticket of item.tickets) {
            const seat = trip.seats.find(
              (s) => String(s.id) === String(ticket.seatId),
            );
            if (seat) {
              seat.status = "available";
              modified = true;
            }
          }
          if (modified) await trip.save({ session });
        }
      }
      */

      await Booking.findByIdAndDelete(req.params.id, { session });
      return { success: true };
    });

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const getBookingHistory = async (req, res) => {
  try {
    // dynamic import or assume History model is available if I import it
    // Check if History model is imported. It is NOT.
    // I should import it at top of file, or use mongoose.model("History")
    const History = mongoose.model("History"); // safer if circular deps
    const history = await History.find({ bookingId: req.params.id }).sort({
      timestamp: -1,
    });
    res.json(history);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const updateBookingPayment = async (req, res) => {
  try {
    const { bookingIds, payment } = req.body;
    // Logic to update payments for multiple bookings
    // This usually involves updating paidCash/paidTransfer and status
    await withTransaction(async (session) => {
      const updates = bookingIds.map(async (id) => {
        const booking = await Booking.findById(id).session(session);
        if (booking) {
          await processPaymentUpdate(booking, payment, session);
          await booking.save({ session });
        }
      });
      await Promise.all(updates);
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const updateBooking = async (req, res) => {
  try {
    const result = await withTransaction(async (session) => {
      const { items, passenger, payment, status } = req.body;
      const booking = await Booking.findById(req.params.id).session(session);
      if (!booking) throw new Error("Booking not found");

      const oldStatus = booking.status;
      const oldItems = JSON.parse(JSON.stringify(booking.items));

      // 1. Update Top-level Fields
      if (passenger) booking.passenger = { ...booking.passenger, ...passenger };
      if (payment) booking.payment = { ...booking.payment, ...payment };
      if (status) booking.status = status;

      // 2. Update Items (Seats/Tickets)
      if (items && items.length > 0) {
        booking.items = items.map((item) => ({
          ...item,
          tickets: item.tickets || [],
        }));

        booking.totalTickets = booking.items.reduce(
          (sum, i) => sum + (i.tickets ? i.tickets.length : 0),
          0,
        );

        const newTotal = booking.items.reduce(
          (sum, i) =>
            sum +
            (i.tickets
              ? i.tickets.reduce((ts, t) => ts + (t.price || 0), 0)
              : 0),
          0,
        );
        if (newTotal > 0) booking.totalPrice = newTotal;
      }

      booking.updatedAt = new Date().toISOString();
      await booking.save({ session });

      // 3. Log History & Generate Diff
      let action = "UPDATE";
      let desc = "Cập nhật đơn hàng";
      let logPayload = {};

      if (status === "cancelled" && oldStatus !== "cancelled") {
        action = "CANCEL";
        const descParts = await Promise.all(
          booking.items.map(async (item) => {
            const trip = await Trip.findById(item.tripId)
              .populate("busId")
              .session(session);
            const routeName = trip ? trip.route : item.route;
            const seatLabels = await Promise.all(
              item.tickets.map(async (t) => {
                if (
                  trip &&
                  trip.busId &&
                  trip.busId.layoutConfig?.seatLabels &&
                  trip.busId.layoutConfig.seatLabels[t.seatId]
                ) {
                  return trip.busId.layoutConfig.seatLabels[t.seatId];
                }
                return t.seatId;
              }),
            );
            return `${routeName}: Hủy (${item.tickets.length} vé) ${seatLabels.join(" ")}`;
          }),
        );
        desc = descParts.join(" | ");

        const tripsPayload = await Promise.all(
          booking.items.map(async (item) => {
            const trip = await Trip.findById(item.tripId)
              .populate("busId")
              .session(session);
            const seatLabels = item.tickets.map((t) => {
              let label = t.seatId;
              if (
                trip &&
                trip.busId &&
                trip.busId.layoutConfig?.seatLabels &&
                trip.busId.layoutConfig.seatLabels[t.seatId]
              ) {
                label = trip.busId.layoutConfig.seatLabels[t.seatId];
              }
              return {
                id: t.seatId,
                label,
                status: "cancelled",
              };
            });
            return {
              tripId: item.tripId,
              route: trip ? trip.route : item.route,
              licensePlate: trip ? trip.licensePlate : "",
              tripDate: trip ? trip.departureTime : item.tripDate,
              seats: seatLabels,
            };
          }),
        );
        logPayload = {
          trips: tripsPayload,
          totalTickets: booking.totalTickets,
        };
      } else if (status !== "cancelled" && oldStatus === "cancelled") {
        action = "RESTORE";
        desc = "Khôi phục đơn hàng";
        logPayload = {
          prevStatus: oldStatus,
          newStatus: status,
        };
      } else {
        // Normal Update with Diffing
        const changes = [];
        const uniqueTripIds = new Set([
          ...oldItems.map((i) => i.tripId),
          ...booking.items.map((i) => i.tripId),
        ]);

        for (const tripId of uniqueTripIds) {
          const oldItem = oldItems.find((i) => i.tripId === tripId);
          const newItem = booking.items.find((i) => i.tripId === tripId);
          const trip = await Trip.findById(tripId)
            .populate("busId")
            .session(session);

          // Get seat label helper
          const getLabel = (seatId) => {
            if (trip && trip.busId && trip.busId.layoutConfig) {
              const labels = trip.busId.layoutConfig.seatLabels || {};
              if (labels[seatId]) return labels[seatId];
            }
            // Fallback if not found in map
            return seatId;
          };

          const oldSeatIds = oldItem
            ? oldItem.tickets.map((t) => String(t.seatId))
            : [];
          const newSeatIds = newItem
            ? newItem.tickets.map((t) => String(t.seatId))
            : [];

          const removed = oldSeatIds.filter((id) => !newSeatIds.includes(id));
          const added = newSeatIds.filter((id) => !oldSeatIds.includes(id));
          const kept = newSeatIds.filter((id) => oldSeatIds.includes(id));

          if (removed.length > 0 || added.length > 0) {
            changes.push({
              route: trip ? trip.route : oldItem?.route || newItem?.route,
              date: trip
                ? trip.departureTime
                : oldItem?.tripDate || newItem?.tripDate,
              kept: kept.map((id) => ({
                id,
                label: getLabel(id),
                status: "kept",
              })),
              removed: removed.map((id) => ({
                id,
                label: getLabel(id),
                status: "cancelled",
              })),
              added: added.map((id) => ({
                id,
                label: getLabel(id),
                status: "new",
              })),
            });
          }
        }

        if (changes.length > 0) {
          // Generate Description from Changes
          const descParts = changes.map((c) => {
            const parts = [];
            if (c.removed.length > 0) {
              parts.push(
                `Hủy (${c.removed.length} vé) ${c.removed.map((s) => s.label).join(" ")}`,
              );
            }
            if (c.added.length > 0) {
              parts.push(
                `Thêm (${c.added.length} vé) ${c.added.map((s) => s.label).join(" ")}`,
              );
            }
            return `${c.route}: ${parts.join(" - ")}`;
          });
          desc = descParts.join(" | ");
          logPayload = { changes, totalTickets: booking.totalTickets };
        } else {
          // No seat changes, generic update
          if (
            payment &&
            JSON.stringify(payment) !== JSON.stringify(booking.payment)
          ) {
            desc = "Cập nhật thanh toán";
          } else if (
            passenger &&
            JSON.stringify(passenger) !== JSON.stringify(booking.passenger)
          ) {
            desc = "Cập nhật thông tin khách hàng";
          }
        }
      }

      await logBookingAction(booking._id, action, desc, logPayload, session);

      await processPaymentUpdate(booking, booking.payment, session);

      return { booking, updatedTrips: [] };
    });

    res.json(result.booking);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const updatePassenger = async (req, res) => {
  try {
    const { passenger } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: "Not found" });
    booking.passenger = { ...booking.passenger, ...passenger };
    await booking.save();
    res.json(booking);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const updateTicket = async (req, res) => {
  try {
    const result = await withTransaction(async (session) => {
      const { seatId } = req.params;
      const { action, payment, ...details } = req.body;
      const booking = await Booking.findById(req.params.id).session(session);
      if (!booking) throw new Error("Booking not found");

      // Find the item and ticket
      let targetItem = null;
      let targetTicket = null;
      let targetTicketIndex = -1;
      let targetItemIndex = -1;

      for (let i = 0; i < booking.items.length; i++) {
        const item = booking.items[i];
        const ticketIndex = item.tickets.findIndex(
          (t) => String(t.seatId) === String(seatId),
        );
        if (ticketIndex !== -1) {
          targetItem = item;
          targetTicket = item.tickets[ticketIndex];
          targetTicketIndex = ticketIndex;
          targetItemIndex = i;
          break;
        }
      }

      if (!targetTicket) {
        throw new Error("Ticket not found in booking");
      }

      // Get trip and seat label for logging
      const trip = await Trip.findById(targetItem.tripId)
        .populate("busId")
        .session(session);
      const seatLabel =
        trip?.busId?.layoutConfig?.seatLabels?.[seatId] || seatId;

      // Handle REFUND action - Cancel/Refund a single ticket
      if (action === "REFUND") {
        const ticketPrice = targetTicket.price || 0;
        const ticketStatus = targetTicket.status;

        // Remove the ticket from the item
        targetItem.tickets.splice(targetTicketIndex, 1);

        // Update item's derived fields
        targetItem.seatIds = targetItem.tickets.map((t) => t.seatId);
        targetItem.price = targetItem.tickets.reduce(
          (sum, t) => sum + (t.price || 0),
          0,
        );

        // Remove item if no tickets left
        if (targetItem.tickets.length === 0) {
          booking.items.splice(targetItemIndex, 1);
        }

        // Update booking totals
        booking.totalTickets = booking.items.reduce(
          (sum, i) => sum + i.tickets.length,
          0,
        );
        booking.totalPrice = booking.items.reduce(
          (sum, i) => sum + i.tickets.reduce((ts, t) => ts + (t.price || 0), 0),
          0,
        );

        // If no tickets left, mark booking as cancelled
        if (booking.totalTickets === 0) {
          booking.status = "cancelled";
        }

        booking.updatedAt = new Date().toISOString();
        booking.markModified("items");
        await booking.save({ session });

        // Handle refund payment if ticket was paid
        if (ticketStatus === "payment" && ticketPrice > 0) {
          await processPaymentUpdate(
            booking,
            {
              paidCash: -ticketPrice,
              paidTransfer: 0,
            },
            session,
          );
        }

        // Log the refund action
        const actionType = ticketStatus === "payment" ? "REFUND" : "CANCEL";
        const actionDesc =
          ticketStatus === "payment"
            ? `Hoàn vé: ${trip?.route || targetItem.route} (${seatLabel}) - ${ticketPrice.toLocaleString("vi-VN")}đ`
            : `Hủy vé: ${trip?.route || targetItem.route} (${seatLabel})`;

        await logBookingAction(
          booking._id,
          actionType,
          actionDesc,
          {
            tripId: targetItem.tripId,
            route: trip?.route || targetItem.route,
            seatId,
            seatLabel,
            ticketPrice,
            ticketStatus,
          },
          session,
        );

        return { booking, action: actionType };
      }

      // Handle PAY action - Pay for a single ticket
      if (action === "PAY" && payment) {
        const totalPaid = (payment.paidCash || 0) + (payment.paidTransfer || 0);
        if (totalPaid > 0) {
          targetTicket.status = "payment";
          targetTicket.price = totalPaid;

          // Update item price
          targetItem.price = targetItem.tickets.reduce(
            (sum, t) => sum + (t.price || 0),
            0,
          );

          // Update booking total
          booking.totalPrice = booking.items.reduce(
            (sum, i) =>
              sum + i.tickets.reduce((ts, t) => ts + (t.price || 0), 0),
            0,
          );

          booking.updatedAt = new Date().toISOString();
          booking.markModified("items");
          await booking.save({ session });

          // Process payment
          await processPaymentUpdate(booking, payment, session);

          // Log the payment action
          await logBookingAction(
            booking._id,
            "PAY_TICKET",
            `Thanh toán vé: ${trip?.route || targetItem.route} (${seatLabel}) - ${totalPaid.toLocaleString("vi-VN")}đ`,
            {
              tripId: targetItem.tripId,
              route: trip?.route || targetItem.route,
              seatId,
              seatLabel,
              amount: totalPaid,
              paidCash: payment.paidCash || 0,
              paidTransfer: payment.paidTransfer || 0,
            },
            session,
          );

          return { booking, action: "PAY_TICKET" };
        }
      }

      // Default: Just update ticket details (pickup, dropoff, note, etc.)
      Object.keys(details).forEach((key) => {
        if (details[key] !== undefined) {
          targetTicket[key] = details[key];
        }
      });

      booking.updatedAt = new Date().toISOString();
      booking.markModified("items");
      await booking.save({ session });

      return { booking, action: "UPDATE" };
    });

    // Fetch updated booking with payment info
    const bookings = await getBookingsWithPayment({ _id: req.params.id });
    const updatedBooking = bookings[0] || result.booking;

    res.json({ booking: updatedBooking, action: result.action });
  } catch (e) {
    console.error("[updateTicket ERROR]", e);
    res.status(500).json({ error: e.message });
  }
};

export const transferSeat = async (req, res) => {
  try {
    const result = await withTransaction(async (session) => {
      const { bookingId, fromTripId, toTripId, seatTransfers } = req.body;

      const booking = await Booking.findById(bookingId).session(session);
      if (!booking) throw new Error("Booking not found");

      const trip1 = await Trip.findById(fromTripId)
        .populate("busId")
        .session(session);
      const trip2 =
        String(fromTripId) === String(toTripId)
          ? trip1
          : await Trip.findById(toTripId).populate("busId").session(session);
      if (!trip1 || !trip2) throw new Error("Trip not found");

      // Helper date formatter
      const formatDate = (dateStr) => {
        const d = new Date(dateStr);
        return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
      };

      // Helper to get seat label from bus layoutConfig
      const getLabel = (trip, seatId) => {
        if (
          trip &&
          trip.busId &&
          trip.busId.layoutConfig?.seatLabels &&
          trip.busId.layoutConfig.seatLabels[seatId]
        ) {
          return trip.busId.layoutConfig.seatLabels[seatId];
        }
        return seatId;
      };

      const transferLogs = [];

      for (const transfer of seatTransfers) {
        const { sourceSeatId, targetSeatId } = transfer;

        const sourceLabel = getLabel(trip1, sourceSeatId);
        const targetLabel = getLabel(trip2, targetSeatId);

        const itemIndex = booking.items.findIndex(
          (i) => String(i.tripId) === String(fromTripId),
        );
        if (itemIndex !== -1) {
          const item = booking.items[itemIndex];
          const tIndex = item.tickets.findIndex(
            (t) => String(t.seatId) === String(sourceSeatId),
          );

          if (tIndex !== -1) {
            const ticketDoc = item.tickets[tIndex];
            const ticket = ticketDoc.toObject
              ? ticketDoc.toObject()
              : ticketDoc;

            item.tickets.splice(tIndex, 1);
            if (item.tickets.length === 0) booking.items.splice(itemIndex, 1);

            let destItem = booking.items.find(
              (i) => String(i.tripId) === String(toTripId),
            );
            if (!destItem) {
              booking.items.push({
                tripId: trip2._id,
                tripDate: trip2.departureTime,
                route: trip2.route,
                tickets: [],
                price: 0,
                isEnhanced:
                  trip2.name?.toLowerCase().includes("tăng cường") || false,
                busType: trip2.type,
                seatIds: [],
              });
              destItem = booking.items[booking.items.length - 1];
            }

            ticket.seatId = targetSeatId;
            destItem.tickets.push(ticket);

            destItem.seatIds = destItem.tickets.map((t) => t.seatId);
            destItem.price = destItem.tickets.reduce(
              (acc, t) => acc + (t.price || 0),
              0,
            );

            // Record transfer for logging
            transferLogs.push({
              from: {
                route: trip1.route,
                date: formatDate(trip1.departureTime),
                seatLabel: sourceLabel,
              },
              to: {
                route: trip2.route,
                date: formatDate(trip2.departureTime),
                seatLabel: targetLabel,
              },
            });
          }
        }
      }

      booking.markModified("items");
      await booking.save({ session });
      await trip1.save({ session });
      if (String(fromTripId) !== String(toTripId)) {
        await trip2.save({ session });
      }

      // Log the transfer action
      if (transferLogs.length > 0) {
        const desc = transferLogs
          .map(
            (t) =>
              `Điều chuyển: ${t.from.route} (${t.from.seatLabel}) ngày ${t.from.date} -> ${t.to.route} (${t.to.seatLabel}) ngày ${t.to.date}`,
          )
          .join(" | ");

        await logBookingAction(
          booking._id,
          "TRANSFER",
          desc,
          { transfers: transferLogs },
          session,
        );
      }

      return { success: true };
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
