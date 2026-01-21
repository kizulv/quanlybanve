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
        const trip = await Trip.findById(item.tripId).session(session);
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
          // REMOVED: Seat label lookup from Trip.seats
          return {
            id: t.seatId,
            label: t.seatId, // Use seatId as label fallback, or will need frontend to resolve
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
      const trip1 = await Trip.findById(tripId1).session(session);
      const trip2 =
        String(tripId1) === String(tripId2)
          ? trip1
          : await Trip.findById(tripId2).session(session);

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
      // REMOVED: Seat index lookup in trip.seats
      /*
      const s1Index = trip1.seats.findIndex(
        (s) => String(s.id) === String(seatId1),
      );
      const s2Index = trip2.seats.findIndex(
        (s) => String(s.id) === String(seatId2),
      );
      */

      if (s1Index === -1)
        throw new Error(`Ghế ${seatId1} không tồn tại trên chuyến 1.`);
      if (s2Index === -1)
        throw new Error(`Ghế ${seatId2} không tồn tại trên chuyến 2.`);

      // const s1 = trip1.seats[s1Index]; // REMOVED
      // const s2 = trip2.seats[s2Index]; // REMOVED
      // const s1Status = s1?.status || "available";
      // const s2Status = s2?.status || "available";
      const s1Label = seatId1; // Fallback
      const s2Label = seatId2; // Fallback

      console.log(
        `[SWAP] Seats: ${trip1.route}(${s1.label}) <-> ${trip2.route}(${s2.label})`,
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

        // Extract ticket - use toObject() to detach from old parent cleanly
        const ticketDoc = item.tickets[ticketIndex];
        const ticket = ticketDoc.toObject ? ticketDoc.toObject() : ticketDoc;

        // Remove from source
        item.tickets.splice(ticketIndex, 1);

        // Update ticket info
        ticket.seatId = newSeatId;

        // Find or Create destination item
        let destItem = booking.items.find(
          (i) => String(i.tripId) === String(toTrip._id),
        );

        if (!destItem) {
          booking.items.push({
            tripId: toTrip._id,
            tripDate: toTrip.departureTime,
            route: toTrip.route,
            route: toTrip.route,
            // licensePlate: toTrip.licensePlate, // REMOVED
            tickets: [],
            price: 0,
            isEnhanced:
              toTrip.name?.toLowerCase().includes("tăng cường") || false,
            busType: toTrip.type,
            seatIds: [],
          });
          // Retrieve the newly created Mongoose Subdocument
          destItem = booking.items[booking.items.length - 1];
        }

        destItem.tickets.push(ticket);

        // Update seatIds arrays & Prices
        // Note: item and destItem are Mongoose documents, so we update their fields directly.
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

      // 7. Update Trip Layouts/Statuses -> SKIPPED (Dynamic Status)
      // We no longer persist status to Trip.seats. Status is calculated from Booking items.

      // We might still need to save trips if we moved OTHER data on them,
      // but here we were only updating seat status.
      // Checking if we need to save trips for any other reason...
      // It seems we only updated .status. So we can skip saving trips entirely unless other fields were touched.
      // However, to be safe if any other middleware relies on 'save', we can skip or keep as no-op.
      // Since we didn't modify trip.seats, verification:
      // trip1.seats[s1Index].status = newS1Status; // REMOVED
      // trip2.seats[s2Index].status = newS2Status; // REMOVED

      // So effectively we don't save trips anymore for status changes.

      // 8. Log History
      if (booking1) {
        await logBookingAction(
          booking1._id,
          "SWAP",
          `Đổi ghế: ${trip1.route} (${s1.label}) ngày ${formatDate(trip1.departureTime)} -> ${trip2.route} (${s2.label}) ngày ${formatDate(trip2.departureTime)}`,
          {
            tripId: trip2._id,
            route: trip2.route,
            date: trip2.departureTime,
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
          `Đổi/Dời vé: ${trip2.route} (${s2.label}) ngày ${formatDate(trip2.departureTime)} -> ${trip1.route} (${s1.label}) ngày ${formatDate(trip1.departureTime)}`,
          {
            tripId: trip1._id,
            route: trip1.route,
            date: trip1.departureTime,
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
    const { passenger, payment, status } = req.body;
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      {
        ...(passenger && { passenger }),
        ...(payment && { payment }),
        ...(status && { status }),
      },
      { new: true },
    );
    res.json(booking);
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
    const { seatId } = req.params;
    const details = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: "Not found" });

    let found = false;
    booking.items.forEach((item) => {
      const ticket = item.tickets.find(
        (t) => String(t.seatId) === String(seatId),
      );
      if (ticket) {
        Object.assign(ticket, details);
        found = true;
      }
    });

    if (found) {
      booking.markModified("items");
      await booking.save();
      res.json({ booking });
    } else {
      res.status(404).json({ error: "Ticket not found in booking" });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const transferSeat = async (req, res) => {
  try {
    const result = await withTransaction(async (session) => {
      const { bookingId, fromTripId, toTripId, seatTransfers } = req.body;

      const booking = await Booking.findById(bookingId).session(session);
      if (!booking) throw new Error("Booking not found");

      const trip1 = await Trip.findById(fromTripId).session(session);
      const trip2 = await Trip.findById(toTripId).session(session);
      if (!trip1 || !trip2) throw new Error("Trip not found");

      for (const transfer of seatTransfers) {
        const { sourceSeatId, targetSeatId } = transfer;

        /*
        const s1 = trip1.seats.find(
          (s) => String(s.id) === String(sourceSeatId),
        );
        const s2 = trip2.seats.find(
          (s) => String(s.id) === String(targetSeatId),
        );
        */

        if (s1) {
          // s1.status = "available"; // REMOVED
        }

        if (s2) {
          // REMOVED STATUS UPDATE
          /*
          s2.status = "booked";
          if (booking.status === "payment" || (s1 && s1.status === "sold"))
            s2.status = "sold";
          */
        }

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
                route: trip2.route,
                // licensePlate: trip2.licensePlate, // REMOVED
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
          }
        }
      }

      booking.markModified("items");
      await booking.save({ session });
      await trip1.save({ session });
      await trip2.save({ session });

      return { success: true };
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
