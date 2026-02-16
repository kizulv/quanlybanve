import express from "express";
import {
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
} from "../controllers/userController.js";
import { verifyToken, isAdmin } from "../middleware/auth.js";

import { body } from "express-validator";
import { validateResult } from "../middleware/validation.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: Quản lý người dùng
 */

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Lấy danh sách người dùng
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách người dùng
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *   post:
 *     summary: Tạo người dùng mới
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *                 default: nhanvien
 *     responses:
 *       201:
 *         description: Người dùng được tạo
 *       400:
 *         description: Dữ liệu không hợp lệ
 */
router.get("/", verifyToken, isAdmin, getAllUsers);
router.post(
  "/",
  verifyToken,
  isAdmin,
  [
    body("username")
      .notEmpty()
      .withMessage("Tên đăng nhập là bắt buộc")
      .isLength({ min: 3 })
      .withMessage("Tên đăng nhập phải có ít nhất 3 ký tự"),
    body("password")
      .notEmpty()
      .withMessage("Mật khẩu là bắt buộc")
      .isLength({ min: 6 })
      .withMessage("Mật khẩu phải có ít nhất 6 ký tự"),
    validateResult,
  ],
  createUser,
);

/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: Cập nhật thông tin người dùng
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID người dùng
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       404:
 *         description: Không tìm thấy người dùng
 *   delete:
 *     summary: Xóa người dùng
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID người dùng
 *     responses:
 *       200:
 *         description: Xóa thành công
 *       404:
 *         description: Không tìm thấy người dùng
 */
router.put(
  "/:id",
  verifyToken,
  isAdmin,
  [
    body("username")
      .optional()
      .isLength({ min: 3 })
      .withMessage("Tên đăng nhập phải có ít nhất 3 ký tự"),
    body("password")
      .optional()
      .isLength({ min: 6 })
      .withMessage("Mật khẩu phải có ít nhất 6 ký tự"),
    validateResult,
  ],
  updateUser,
);
router.delete("/:id", verifyToken, isAdmin, deleteUser);

export default router;
