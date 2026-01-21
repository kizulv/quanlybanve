import express from "express";
import {
  getAllTrips,
  createTrip,
  updateTrip,
  deleteTrip,
  updateTripSeats,
} from "../controllers/tripController.js";

const router = express.Router();

router.get("/", getAllTrips);
router.post("/", createTrip);
router.put("/:id", updateTrip);
router.delete("/:id", deleteTrip);
router.put("/:id/seats", updateTripSeats);

export default router;
