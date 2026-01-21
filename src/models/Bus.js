import mongoose from "mongoose";
import { transformId } from "../utils/schemaUtils.js";

const busSchema = new mongoose.Schema(
  {
    plate: String,
    phoneNumber: String,
    type: String,
    seats: Number,
    status: String,
    layoutConfig: Object,
    defaultRouteId: String,
  },
  { toJSON: { virtuals: true, transform: transformId } },
);

export default mongoose.model("Bus", busSchema);
