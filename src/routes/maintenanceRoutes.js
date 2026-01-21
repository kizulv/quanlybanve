import express from "express";
import {
  fixSeats,
  fixPayments,
  fixFloorSeats,
  resetBusConfigs,
  syncBusLayouts,
} from "../controllers/maintenanceController.js";
// import { isAdmin } from "../middleware/auth.js"; // Should probably be admin only, keeping open for now to match legacy

const router = express.Router();

router.post("/fix-seats", fixSeats);
router.post("/fix-payments", fixPayments);
router.post("/fix-floor-seats", fixFloorSeats);
router.post("/reset-bus-configs", resetBusConfigs);
router.post("/sync-bus-layouts", syncBusLayouts);

export default router;
