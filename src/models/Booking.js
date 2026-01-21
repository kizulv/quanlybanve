import mongoose from "mongoose";
import { transformId } from "../utils/schemaUtils.js";

const ticketDetailSchema = new mongoose.Schema(
  {
    seatId: String,
    price: Number,
    pickup: String,
    dropoff: String,
    note: String,
    name: String,
    phone: String,
    status: String,
    exactBed: { type: Boolean, default: false },
  },
  { _id: false },
);

const bookingItemSchema = new mongoose.Schema(
  {
    tripId: String,
    tripDate: String,
    route: String,
    seatIds: [String],
    tickets: [ticketDetailSchema],
    price: Number,
    isEnhanced: { type: Boolean, default: false },
    busType: String,
    seatIds: [String], // Keeping for compatibility or if used in queries, though marked removed in comments
  },
  { _id: false },
);

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
    createdAt: String,
    updatedAt: String,
    totalPrice: Number,
    totalTickets: Number,
  },
  { toJSON: { virtuals: true, transform: transformId } },
);

export default mongoose.model("Booking", bookingSchema);
