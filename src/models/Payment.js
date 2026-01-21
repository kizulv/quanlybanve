import mongoose from "mongoose";
import { transformId } from "../utils/schemaUtils.js";

const paymentSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    totalAmount: Number,
    cashAmount: { type: Number, default: 0 },
    transferAmount: { type: Number, default: 0 },
    method: String,
    type: String, // 'payment' | 'refund'
    transactionType: { type: String, default: "snapshot" }, // 'snapshot' | 'incremental'
    note: String,
    timestamp: { type: Date, default: Date.now },
    performedBy: String,
    details: {
      seats: [String],
      labels: [String],
      tripDate: String,
      route: String,
      licensePlate: String,
      trips: [mongoose.Schema.Types.Mixed],
    },
  },
  { toJSON: { virtuals: true, transform: transformId } },
);

export default mongoose.model("Payment", paymentSchema);
