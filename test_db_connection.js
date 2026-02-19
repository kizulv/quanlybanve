import mongoose from "mongoose";
import { loadEnv } from "vite";

async function test() {
  const env = loadEnv("development", process.cwd(), "");
  const uri = env.MONGO_URI;
  console.log("Testing connection to:", uri.split("@")[1]); // Don't log password

  try {
    await mongoose.connect(uri);
    console.log("✅ CONNECTED TO MONGODB ATLAS SUCCESSFUL!");
    const collections = await mongoose.connection.db
      .listCollections()
      .toArray();
    console.log(
      "Collections found:",
      collections.map((c) => c.name),
    );
    await mongoose.disconnect();
  } catch (err) {
    console.error("❌ CONNECTION FAILED:", err.message);
  }
}

test();
