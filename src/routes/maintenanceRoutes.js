import express from "express";
import {
  fixSeats,
  fixPayments,
  fixFloorSeats,
  resetBusConfigs,
  syncBusLayouts,
} from "../controllers/maintenanceController.js";
import { verifyToken, isAdmin } from "../middleware/auth.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Maintenance
 *   description: Các công cụ bảo trì và đồng bộ hệ thống
 */

/**
 * @swagger
 * /maintenance/fix-seats:
 *   post:
 *     summary: Sửa lỗi dữ liệu ghế
 *     tags: [Maintenance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Hoàn thành
 */
router.post("/fix-seats", verifyToken, isAdmin, fixSeats);

/**
 * @swagger
 * /maintenance/fix-payments:
 *   post:
 *     summary: Sửa lỗi dữ liệu thanh toán
 *     tags: [Maintenance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Hoàn thành
 */
router.post("/fix-payments", verifyToken, isAdmin, fixPayments);

/**
 * @swagger
 * /maintenance/fix-floor-seats:
 *   post:
 *     summary: Cập nhật nhãn ghế sàn
 *     tags: [Maintenance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Hoàn thành
 */
router.post("/fix-floor-seats", verifyToken, isAdmin, fixFloorSeats);

/**
 * @swagger
 * /maintenance/reset-bus-configs:
 *   post:
 *     summary: Reset cấu hình ghế của xe về mặc định
 *     tags: [Maintenance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Hoàn thành
 */
router.post("/reset-bus-configs", verifyToken, isAdmin, resetBusConfigs);

/**
 * @swagger
 * /maintenance/sync-bus-layouts:
 *   post:
 *     summary: Đồng bộ sơ đồ xe vào các chuyến đi
 *     tags: [Maintenance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Đồng bộ thành công
 */
router.post("/sync-bus-layouts", verifyToken, isAdmin, syncBusLayouts);

export default router;
