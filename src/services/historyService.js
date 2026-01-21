import History from "../models/History.js";
import Booking from "../models/Booking.js";

export const logBookingAction = async (
  bookingId,
  action,
  description,
  details = {},
  session = null,
) => {
  try {
    const opts = session ? { session } : {};
    await History.create(
      [
        {
          bookingId,
          action,
          description,
          details,
          timestamp: new Date(),
        },
      ],
      opts,
    );
    await Booking.findByIdAndUpdate(
      bookingId,
      { updatedAt: new Date().toISOString() },
      session ? { session } : undefined,
    );
  } catch (e) {
    console.error("Failed to log history:", e);
  }
};
