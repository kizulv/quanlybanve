
    // Collect detailed trips info
    const tripsSnapshot = booking.items.map(item => ({
        route: item.route,
        tripDate: item.tripDate,
        licensePlate: item.licensePlate,
        seats: item.seatIds,
        tickets: item.tickets // NEW: Include ticket details for precise pricing
    }));

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
            pricePerTicket: avgPrice,
            trips: tripsSnapshot // NEW FIELD
        }
    });
