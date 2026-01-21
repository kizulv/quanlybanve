import mongoose from "mongoose";

const qrGeneralSchema = new mongoose.Schema(
  {
    data: Object,
    status: { type: String, default: "pending" }, // pending, success
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export default mongoose.model("QRGeneral", qrGeneralSchema);
