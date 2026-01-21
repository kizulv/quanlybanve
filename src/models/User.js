import mongoose from "mongoose";
import { transformId } from "../utils/schemaUtils.js";

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: String,
    role: { type: String, enum: ["admin", "sale", "guest"], default: "guest" },
    permissions: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  { toJSON: { virtuals: true, transform: transformId } },
);

export default mongoose.model("User", userSchema);
