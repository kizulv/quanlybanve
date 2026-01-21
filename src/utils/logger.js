import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
// src/utils/logger.js -> src/utils -> src -> root
const __dirname = path.dirname(path.dirname(path.dirname(__filename)));

export const logDebug = (message, data) => {
  const logline = `[${new Date().toISOString()}] ${message} ${JSON.stringify(
    data || {},
  )}\n`;
  console.log(message, data);
  try {
    fs.appendFileSync(path.join(__dirname, "server_debug.log"), logline);
  } catch (e) {
    console.error("Failed to write to log file", e);
  }
};
