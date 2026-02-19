import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { loadEnv } from "vite";
import path from "path";

// Load environment variables
const env = loadEnv("development", process.cwd(), "");
const MONGO_URI = env.MONGO_URI;

if (!MONGO_URI) {
  console.error("❌ MONGO_URI not found in environment variables!");
  process.exit(1);
}

async function resetPassword() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB.");

    const username = "admin";
    const newPassword = "12345678";

    console.log(`Hashing new password for user: ${username}...`);
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const User = mongoose.model(
      "User",
      new mongoose.Schema({
        username: String,
        password: String,
      }),
    );

    console.log("Updating database...");
    const result = await User.updateOne(
      { username: username },
      { $set: { password: hashedPassword } },
    );

    if (result.matchedCount === 0) {
      console.log(`❌ User "${username}" not found.`);
    } else if (result.modifiedCount === 0) {
      console.log(
        `ℹ️ User "${username}" found, but password was already set to this value.`,
      );
    } else {
      console.log(`✅ Successfully reset password for user "${username}".`);
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
    process.exit(0);
  }
}

resetPassword();
