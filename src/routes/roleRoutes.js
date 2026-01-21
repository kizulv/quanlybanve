import express from "express";
import {
  getAllRoles,
  updateRolePermissions,
} from "../controllers/roleController.js";
import { verifyToken, isAdmin } from "../middleware/auth.js";

const router = express.Router();

router.get("/", getAllRoles);
router.put("/:name", verifyToken, isAdmin, updateRolePermissions);

export default router;
