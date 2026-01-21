import mongoose from "mongoose";
import { transformId } from "../utils/schemaUtils.js";

const systemSettingsSchema = new mongoose.Schema(
  {
    bankName: { type: String, default: "BIDV" },
    bankAccount: { type: String, default: "" },
    accountName: { type: String, default: "" },
    bankBin: { type: String, default: "" },
    qrTemplate: { type: String, default: "compact" },
    qrExpiryTime: { type: Number, default: 300 },
  },
  { toJSON: { virtuals: true, transform: transformId } },
);

export default mongoose.model("SystemSettings", systemSettingsSchema);
