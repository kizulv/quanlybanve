import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { loadEnv } from "vite";
import User from "./src/models/User.js";

async function verify() {
  const env = loadEnv("development", process.cwd(), "");
  const MONGO_URI = env.MONGO_URI;

  try {
    await mongoose.connect(MONGO_URI);
    const user = await User.findOne({ username: "admin" });
    if (!user) {
      console.log("❌ KHÔNG TÌM THẤY USER ADMIN TRÊN ATLAS!");
      return;
    }

    const isMatch = await bcrypt.compare("password123", user.password);
    if (isMatch) {
      console.log(
        "✅ XÁC NHẬN: Mật khẩu 'password123' HỢP LỆ cho admin trên Atlas.",
      );
    } else {
      console.log(
        "❌ XÁC NHẬN: Mật khẩu 'password123' KHÔNG HỢP LỆ! (Hash mismatch)",
      );
    }
  } catch (err) {
    console.error("❌ Lỗi kiểm tra:", err);
  } finally {
    await mongoose.disconnect();
  }
}

verify();
