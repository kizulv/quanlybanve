import express from "express";
import {
  getAllRoutes,
  createRoute,
  updateRoute,
  deleteRoute,
} from "../controllers/routeController.js";

import { verifyToken, isAdmin } from "../middleware/auth.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Routes
 *   description: Quản lý tuyến đường
 */

/**
 * @swagger
 * /routes:
 *   get:
 *     summary: Lấy danh sách tuyến đường
 *     tags: [Routes]
 *     responses:
 *       200:
 *         description: Danh sách tuyến đường
 *   post:
 *     summary: Tạo tuyến đường mới
 *     tags: [Routes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - routeId
 *             properties:
 *               name:
 *                 type: string
 *               routeId:
 *                 type: string
 *               prices:
 *                 type: object
 *                 description: Bảng giá
 *     responses:
 *       201:
 *         description: Tạo tuyến thành công
 */
router.get("/", getAllRoutes);
router.post("/", verifyToken, isAdmin, createRoute);

/**
 * @swagger
 * /routes/{id}:
 *   put:
 *     summary: Cập nhật tuyến đường
 *     tags: [Routes]
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
 *     summary: Xóa tuyến đường
 *     tags: [Routes]
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
 *   delete:
 *     summary: Xóa tuyến đường
 *     tags: [Routes]
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
router.put("/:id", verifyToken, isAdmin, updateRoute);
router.delete("/:id", verifyToken, isAdmin, deleteRoute);

export default router;
