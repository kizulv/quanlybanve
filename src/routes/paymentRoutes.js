import express from "express";
import {
  getAllPayments,
  createPayment,
  updatePayment,
  deletePayment,
} from "../controllers/paymentController.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Quản lý thanh toán
 */

/**
 * @swagger
 * /payments:
 *   get:
 *     summary: Lấy danh sách giao dịch thanh toán
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách thanh toán
 *   post:
 *     summary: Tạo giao dịch thanh toán mới
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bookingId
 *               - amount
 *             properties:
 *               bookingId:
 *                 type: string
 *               amount:
 *                 type: number
 *               method:
 *                 type: string
 *     responses:
 *       201:
 *         description: Tạo thanh toán thành công
 */
router.get("/", verifyToken, getAllPayments);
router.post("/", verifyToken, createPayment);

/**
 * @swagger
 * /payments/{id}:
 *   put:
 *     summary: Cập nhật giao dịch
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *   delete:
 *     summary: Xóa giao dịch
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Xóa thành công
 */
router.put("/:id", verifyToken, updatePayment);
router.delete("/:id", verifyToken, deletePayment);

export default router;
