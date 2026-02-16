import express from "express";
import {
  getAllBuses,
  createBus,
  updateBus,
  deleteBus,
} from "../controllers/busController.js";
import { verifyToken, isAdmin } from "../middleware/auth.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Buses
 *   description: Quản lý danh sách xe
 */

/**
 * @swagger
 * /buses:
 *   get:
 *     summary: Lấy danh sách xe
 *     tags: [Buses]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách xe
 *   post:
 *     summary: Thêm xe mới
 *     tags: [Buses]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - plateNumber
 *               - busType
 *             properties:
 *               plateNumber:
 *                 type: string
 *               busType:
 *                 type: string
 *                 description: Giường nằm/Cabin/...
 *               capacity:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Tạo xe thành công
 */
router.get("/", verifyToken, isAdmin, getAllBuses);
router.post("/", verifyToken, isAdmin, createBus);

/**
 * @swagger
 * /buses/{id}:
 *   put:
 *     summary: Cập nhật thông tin xe
 *     tags: [Buses]
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
 *             properties:
 *               plateNumber:
 *                 type: string
 *               busType:
 *                 type: string
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *   delete:
 *     summary: Xóa xe
 *     tags: [Buses]
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
 *         description: Xóa xe thành công
 */
router.put("/:id", verifyToken, isAdmin, updateBus);
router.delete("/:id", verifyToken, isAdmin, deleteBus);

export default router;
