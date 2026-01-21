import express from "express";
import {
  getAllBookings,
  createBooking,
  swapBookings,
  updateBooking,
  updatePassenger,
  updateTicket,
  deleteBooking,
  updateBookingPayment,
  transferSeat,
  getBookingHistory,
} from "../controllers/bookingController.js";

const router = express.Router();

router.get("/", getAllBookings);
router.post("/", createBooking);
router.post("/swap", swapBookings);
router.post("/transfer", transferSeat);
router.put("/payment", updateBookingPayment);

router.get("/:id/history", getBookingHistory);
router.put("/:id", updateBooking);
router.delete("/:id", deleteBooking);
router.patch("/:id/passenger", updatePassenger);
router.patch("/:id/tickets/:seatId", updateTicket);

export default router;
