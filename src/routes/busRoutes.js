import express from "express";
import {
  getAllBuses,
  createBus,
  updateBus,
  deleteBus,
} from "../controllers/busController.js";

const router = express.Router();

router.get("/", getAllBuses);
router.post("/", createBus);
router.put("/:id", updateBus);
router.delete("/:id", deleteBus);

export default router;
