import mongoose from "mongoose";
import { transformId } from "../utils/schemaUtils.js";

const settingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: mongoose.Schema.Types.Mixed,
  },
  { toJSON: { virtuals: true, transform: transformId } },
);

export default mongoose.model("Setting", settingSchema);
