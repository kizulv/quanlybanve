import mongoose from "mongoose";
import { transformId } from "../utils/schemaUtils.js";

const tripSchema = new mongoose.Schema(
  {
    routeId: String,
    name: String,
    route: String,
    departureTime: String,
    type: String,
    busId: { type: mongoose.Schema.Types.ObjectId, ref: "Bus" },
    licensePlate: String,
    driver: String,
    basePrice: Number,
    basePrice: Number,
    direction: String,
  },
  { toJSON: { virtuals: true, transform: transformId } },
);

export default mongoose.model("Trip", tripSchema);
