import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { loadEnv } from "vite";
import connectDB from "./config/db.js";
import swaggerUi from "swagger-ui-express";
import { specs } from "./config/swagger.js";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";

// Import routes
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import roleRoutes from "./routes/roleRoutes.js";
import busRoutes from "./routes/busRoutes.js";
import routeRoutes from "./routes/routeRoutes.js";
import tripRoutes from "./routes/tripRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import settingRoutes from "./routes/settingRoutes.js";
import maintenanceRoutes from "./routes/maintenanceRoutes.js";
import qrRoutes from "./routes/qrRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js"; // Added missing payment routes

// Load env
const env = loadEnv(process.env.NODE_ENV || "development", process.cwd(), "");
const MONGO_URI = env.MONGO_URI;
const VITE_API_URL = env.VITE_API_URL;
const VITE_APP_MAIN_DOMAIN = env.VITE_APP_MAIN_DOMAIN;
const VITE_APP_ORDER_DOMAIN = env.VITE_APP_ORDER_DOMAIN;

// Connect DB
connectDB(MONGO_URI);

// App init
const app = express();

// Trust Proxy - Cần thiết khi chạy sau Nginx/của Cloudflare để lấy đúng IP client
app.set("trust proxy", 1);

// Security and Logging Middleware
app.use(helmet());
app.use(morgan("dev"));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", limiter);

// CORS Configuration
const allowedOrigins = [
  "http://localhost:5173", // Vite Dev Server
  VITE_API_URL,
  `https://${VITE_APP_MAIN_DOMAIN}`,
  `https://${VITE_APP_ORDER_DOMAIN}`,
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        // For development convenience, we might want to log this but allow it temporarily
        // or just restrict it tightly. Let's restrict it but allow localhost.
        // check if origin starts with localhost
        if (origin.startsWith("http://localhost")) {
          return callback(null, true);
        }
        return callback(
          new Error(
            "The CORS policy for this site does not allow access from the specified Origin.",
          ),
          false,
        );
      }
      return callback(null, true);
    },
    credentials: true,
  }),
);

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Private-Network", "true");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization",
  );
  next();
});
app.use(bodyParser.json());

// Swagger UI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/buses", busRoutes);
app.use("/api/routes", routeRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/payments", paymentRoutes); // Mounted payment routes
app.use("/api/maintenance", maintenanceRoutes);
app.use("/api/qrgeneral", qrRoutes);
app.use("/api", settingRoutes); // Use settings last as it might have generic paths? No, usually specific.

const urlPort =
  VITE_API_URL.match(/:(\d+)\//)?.[1] || VITE_API_URL.match(/:(\d+)$/)?.[1];
const PORT = process.env.PORT || urlPort || 5001;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔗 API URL: ${VITE_API_URL}`);
});
