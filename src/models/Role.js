import mongoose from "mongoose";
import { transformId } from "../utils/schemaUtils.js";

const roleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    permissions: { type: [String], default: [] },
  },
  { toJSON: { virtuals: true, transform: transformId } },
);

export default mongoose.model("Role", roleSchema);
