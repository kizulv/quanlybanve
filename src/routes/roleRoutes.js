import express from "express";
import {
  getAllRoles,
  updateRolePermissions,
} from "../controllers/roleController.js";
import { verifyToken, isAdmin } from "../middleware/auth.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Roles
 *   description: Quản lý vai trò và phân quyền
 */

/**
 * @swagger
 * /roles:
 *   get:
 *     summary: Lấy danh sách vai trò
 *     tags: [Roles]
 *     responses:
 *       200:
 *         description: Danh sách vai trò
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   permissions:
 *                     type: array
 *                     items:
 *                       type: string
 * */
router.get("/", verifyToken, isAdmin, getAllRoles);

/**
 * @swagger
 * /roles/{name}:
 *   put:
 *     summary: Cập nhật quyền hạn cho vai trò
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: Tên vai trò (admin, nhanvien, ...)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - permissions
 *             properties:
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 */
router.put("/:name", verifyToken, isAdmin, updateRolePermissions);

export default router;
