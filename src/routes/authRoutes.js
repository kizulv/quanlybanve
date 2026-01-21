import express from "express";
import { login, changePassword } from "../controllers/authController.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

router.post("/login", login);
router.post("/change-password", verifyToken, changePassword);

export default router;
