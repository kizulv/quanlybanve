import express from "express";
import {
  getAllBookings,
  createBooking,
  swapBookings,
  updateBooking,
  updatePassenger,
  updateTicket,
  deleteBooking,
  updateBookingPayment,
  transferSeat,
  getBookingHistory,
} from "../controllers/bookingController.js";
import { verifyToken, isAdmin } from "../middleware/auth.js";
import { body } from "express-validator";
import { validateResult } from "../middleware/validation.js";

const router = express.Router();

/**
 * @swagger
 * /bookings:
 *   get:
 *     summary: Lấy danh sách đặt vé
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách đặt vé
 *   post:
 *     summary: Tạo đơn đặt vé mới
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tripId
 *               - customerName
 *               - customerPhone
 *             properties:
 *               tripId:
 *                 type: string
 *               customerName:
 *                 type: string
 *               customerPhone:
 *                 type: string
 *               seatIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Đặt vé thành công
 */
router.get("/", verifyToken, getAllBookings);
router.post(
  "/",
  verifyToken,
  [
    body("tripId").notEmpty().withMessage("TripID là bắt buộc"),
    body("customerName").notEmpty().withMessage("Tên khách hàng là bắt buộc"),
    body("customerPhone").notEmpty().withMessage("Số điện thoại là bắt buộc"),
    body("seatIds").isArray({ min: 1 }).withMessage("Phải chọn ít nhất 1 ghế"),
    validateResult,
  ],
  createBooking,
);

/**
 * @swagger
 * /bookings/swap:
 *   post:
 *     summary: Hoán đổi vị trí ghế giữa 2 vé
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tripId
 *               - seat1Id
 *               - seat2Id
 *             properties:
 *               tripId:
 *                 type: string
 *               seat1Id:
 *                 type: string
 *               seat2Id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Hoán đổi thành công
 */
router.post(
  "/swap",
  verifyToken,
  [
    body("tripId").notEmpty().withMessage("TripID là bắt buộc"),
    body("seatId1").notEmpty().withMessage("Ghế 1 là bắt buộc"),
    body("seatId2").notEmpty().withMessage("Ghế 2 là bắt buộc"),
    validateResult,
  ],
  swapBookings,
);

/**
 * @swagger
 * /bookings/transfer:
 *   post:
 *     summary: Chuyển ghế sang chuyến khác (chưa cài đặt chi tiết)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Chuyển thành công
 */
router.post("/transfer", verifyToken, transferSeat);

/**
 * @swagger
 * /bookings/payment:
 *   put:
 *     summary: Cập nhật thông tin thanh toán cho đơn hàng
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *             properties:
 *               id:
 *                 type: string
 *                 description: ID đơn hàng
 *               paymentStatus:
 *                 type: string
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 */
router.put("/payment", verifyToken, updateBookingPayment);

/**
 * @swagger
 * /bookings/{id}/history:
 *   get:
 *     summary: Lấy lịch sử vé/đơn hàng
 *     tags: [Bookings]
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
 *         description: Lịch sử đặt vé
 */
router.get("/:id/history", verifyToken, getBookingHistory);

/**
 * @swagger
 * /bookings/{id}:
 *   put:
 *     summary: Cập nhật thông tin đơn vé
 *     tags: [Bookings]
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
 *     summary: Hủy đơn vé
 *     tags: [Bookings]
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
 *         description: Hủy thành công
 */
router.put("/:id", verifyToken, updateBooking);
router.delete("/:id", verifyToken, deleteBooking);

/**
 * @swagger
 * /bookings/{id}/passenger:
 *   patch:
 *     summary: Cập nhật thông tin hành khách
 *     tags: [Bookings]
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
 *               customerName:
 *                 type: string
 *               customerPhone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 */
router.patch("/:id/passenger", verifyToken, updatePassenger);

/**
 * @swagger
 * /bookings/{id}/tickets/{seatId}:
 *   patch:
 *     summary: Cập nhật thông tin vé cụ thể (ghế)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: seatId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 */
router.patch("/:id/tickets/:seatId", verifyToken, updateTicket);

export default router;
