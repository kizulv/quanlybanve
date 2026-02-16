import express from "express";
import {
  getQRGeneral,
  createQRGeneral,
  deleteQRGeneral,
  simulateQRSuccess,
} from "../controllers/qrController.js";
import { verifyToken, isAdmin } from "../middleware/auth.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: QR
 *   description: Cấu hình mã QR thanh toán chung
 */

/**
 * @swagger
 * /qrgeneral:
 *   get:
 *     summary: Lấy cấu hình QR hiện tại
 *     tags: [QR]
 *     responses:
 *       200:
 *         description: Cấu hình QR
 *   post:
 *     summary: Tạo hoặc cập nhật cấu hình QR
 *     tags: [QR]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bankCode
 *               - accountNumber
 *             properties:
 *               bankCode:
 *                 type: string
 *               accountNumber:
 *                 type: string
 *     responses:
 *       201:
 *         description: Lưu thành công
 *   delete:
 *     summary: Xóa cấu hình QR
 *     tags: [QR]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Xóa thành công
 */
router.get("/", getQRGeneral);
router.post("/", verifyToken, isAdmin, createQRGeneral);
router.delete("/", verifyToken, isAdmin, deleteQRGeneral);

/**
 * @swagger
 * /qrgeneral/simulate-success:
 *   post:
 *     summary: Giả lập thanh toán QR thành công (Demo)
 *     tags: [QR]
 *     responses:
 *       200:
 *         description: Giả lập thành công
 */
router.post("/simulate-success", simulateQRSuccess);

export default router;
