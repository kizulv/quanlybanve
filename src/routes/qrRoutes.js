import express from "express";
import {
  getQRGeneral,
  createQRGeneral,
  deleteQRGeneral,
  simulateQRSuccess,
} from "../controllers/qrController.js";

const router = express.Router();

router.get("/", getQRGeneral);
router.post("/", createQRGeneral);
router.delete("/", deleteQRGeneral);
router.post("/simulate-success", simulateQRSuccess);

export default router;
