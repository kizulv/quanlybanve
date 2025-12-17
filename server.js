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

      // 3. Determine Status & Global Seat Status
      // Use incoming payment state (Snapshot of total paid from Frontend)
      const currentPaymentState = payment || { paidCash: 0, paidTransfer: 0 };
      const totalPaid = (currentPaymentState.paidCash || 0) + (currentPaymentState.paidTransfer || 0);
      const isFullyPaid = totalPaid >= calculatedTotalPrice;
      
      let finalStatus;
      if (calculatedTotalTickets === 0) {
          finalStatus = "cancelled";
      } else {
          // Logic: If fully paid -> Confirmed. If not -> Pending.
          // This eliminates the ambiguous 'modified' status.
          // If you edit a booking and collect enough money, it becomes Paid immediately.
          finalStatus = isFullyPaid ? "confirmed" : "pending";
      }

      // Visual Status for SeatMap: Confirmed = Sold (Green), Pending = Booked (Yellow)
      const globalSeatStatus = finalStatus === "confirmed" ? "sold" : "booked";

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
                      // Force 'booked' if price is 0 (Gift/Free ticket logic), otherwise use global status
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
      if (payment) {
          await processPaymentUpdate(oldBooking, payment);
      }

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