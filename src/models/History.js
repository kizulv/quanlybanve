import mongoose from "mongoose";
import { transformId } from "../utils/schemaUtils.js";

const historySchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    action: {
      type: String,
      enum: [
        "CREATE",
        "UPDATE",
        "CANCEL",
        "SWAP",
        "PASSENGER_UPDATE",
        "DELETE",
        "TRANSFER",
        "PAY_SEAT",
        "REFUND_SEAT",
      ],
      required: true,
    },
    description: String,
    details: mongoose.Schema.Types.Mixed,
    timestamp: { type: Date, default: Date.now },
    performedBy: String,
  },
  { toJSON: { virtuals: true, transform: transformId } },
);

export default mongoose.model("History", historySchema);
