import express from "express";
import {
  getSettingByKey,
  updateSetting,
  getSystemSettings,
  updateSystemSettings,
} from "../controllers/settingController.js";
import { verifyToken, isAdmin } from "../middleware/auth.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Settings
 *   description: Cấu hình hệ thống và tham số
 */

/**
 * @swagger
 * /settings/{key}:
 *   get:
 *     summary: Lấy cài đặt theo khóa
 *     tags: [Settings]
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: Khóa cài đặt
 *     responses:
 *       200:
 *         description: Giá trị cài đặt
 */
router.get("/settings/:key", getSettingByKey);

/**
 * @swagger
 * /settings:
 *   post:
 *     summary: Cập nhật hoặc tạo mới cài đặt
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - key
 *               - value
 *             properties:
 *               key:
 *                 type: string
 *               value:
 *                 type: object
 *     responses:
 *       200:
 *         description: Lưu thành công
 */
router.post("/settings", verifyToken, isAdmin, updateSetting);

/**
 * @swagger
 * /system-settings:
 *   get:
 *     summary: Lấy toàn bộ cấu hình hệ thống
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cấu hình hệ thống
 *   put:
 *     summary: Cập nhật cấu hình hệ thống
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 */
router.get("/system-settings", verifyToken, isAdmin, getSystemSettings);
router.put("/system-settings", verifyToken, isAdmin, updateSystemSettings);

export default router;
