import express from "express";
import { login, changePassword } from "../controllers/authController.js";
import { verifyToken } from "../middleware/auth.js";
import { body } from "express-validator";
import { validateResult } from "../middleware/validation.js";

import rateLimit from "express-rate-limit";

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // Limit each IP to 5 login requests per windowMs
  message: {
    message: "Quá nhiều lần đăng nhập sai. Vui lòng thử lại sau 5 phút.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: API xác thực người dùng
 */

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Đăng nhập vào hệ thống
 *     tags: [Auth]
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
 *                 description: Tên đăng nhập
 *               password:
 *                 type: string
 *                 description: Mật khẩu
 *     responses:
 *       200:
 *         description: Đăng nhập thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JSON Web Token
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     username:
 *                       type: string
 *                     role:
 *                       type: string
 *       401:
 *         description: Sai tên đăng nhập hoặc mật khẩu
 *       500:
 *         description: Lỗi máy chủ
 */
router.post(
  "/login",
  loginLimiter,
  [
    body("username")
      .notEmpty()
      .withMessage("Tên đăng nhập không được để trống"),
    body("password").notEmpty().withMessage("Mật khẩu không được để trống"),
    validateResult,
  ],
  login,
);

/**
 * @swagger
 * /auth/change-password:
 *   post:
 *     summary: Đổi mật khẩu
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - oldPassword
 *               - newPassword
 *             properties:
 *               oldPassword:
 *                 type: string
 *                 description: Mật khẩu cũ
 *               newPassword:
 *                 type: string
 *                 description: Mật khẩu mới
 *     responses:
 *       200:
 *         description: Đổi mật khẩu thành công
 *       400:
 *         description: Mật khẩu cũ không đúng
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi máy chủ
 */
router.post(
  "/change-password",
  verifyToken,
  [
    body("oldPassword").notEmpty().withMessage("Mật khẩu cũ là bắt buộc"),
    body("newPassword")
      .isLength({ min: 6 })
      .withMessage("Mật khẩu mới phải có ít nhất 6 ký tự"),
    validateResult,
  ],
  changePassword,
);

export default router;
