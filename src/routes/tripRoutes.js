import express from "express";
import {
  getAllTrips,
  createTrip,
  updateTrip,
  deleteTrip,
  updateTripSeats,
} from "../controllers/tripController.js";
import { verifyToken, isAdmin } from "../middleware/auth.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Trips
 *   description: Quản lý chuyến đi
 */

/**
 * @swagger
 * /trips:
 *   get:
 *     summary: Lấy danh sách chuyến đi
 *     tags: [Trips]
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Lọc theo ngày (YYYY-MM-DD)
 *       - in: query
 *         name: routeId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Danh sách chuyến đi
 *   post:
 *     summary: Tạo chuyến đi mới
 *     tags: [Trips]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - date
 *               - time
 *               - routeId
 *               - busId
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *               time:
 *                 type: string
 *               routeId:
 *                 type: string
 *               busId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Tạo chuyến đi thành công
 */
router.get("/", getAllTrips);
router.post("/", verifyToken, isAdmin, createTrip);

/**
 * @swagger
 * /trips/{id}:
 *   put:
 *     summary: Cập nhật thông tin chuyến đi
 *     tags: [Trips]
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
 *               busId:
 *                 type: string
 *               driver:
 *                 type: string
 *               assistant:
 *                 type: string
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *   delete:
 *     summary: Xóa chuyến đi
 *     tags: [Trips]
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
router.put("/:id", verifyToken, isAdmin, updateTrip);
router.delete("/:id", verifyToken, isAdmin, deleteTrip);

/**
 * @swagger
 * /trips/{id}/seats:
 *   put:
 *     summary: Cập nhật sơ đồ ghế/trạng thái ghế
 *     tags: [Trips]
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
 *               seats:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Cập nhật ghế thành công
 */
router.put("/:id/seats", verifyToken, isAdmin, updateTripSeats);

export default router;
