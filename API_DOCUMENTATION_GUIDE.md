# Hướng dẫn Quản lý API với Swagger UI

Tài liệu này hướng dẫn cách sử dụng và mở rộng tài liệu API cho dự án VinaBus Manager.

## 1. Truy cập Tài liệu API

Sau khi khởi động server (`npm start` hoặc `npm run dev:server`), bạn có thể truy cập tài liệu tại:
**http://localhost:5001/api-docs**

## 2. Cấu trúc Tài liệu

Cấu hình Swagger nằm tại `src/config/swagger.js`.
Swagger sẽ tự động quét tất cả các file trong `src/routes/*.js` để tìm các chú thích JSDoc có tag `@swagger`.

## 3. Cách thêm tài liệu cho API mới

Để thêm tài liệu cho một endpoint mới, hãy thêm chú thích JSDoc ngay phía trên định nghĩa route trong file routes tương ứng.

### Ví dụ mẫu (GET Request):

```javascript
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
 *                 type: object
 *                 properties:
 *                   username:
 *                     type: string
 * */
router.get("/", verifyToken, getUsers);
```

### Các thành phần chính:

- **`tags`**: Nhóm các API lại với nhau (ví dụ: Auth, Users, Bus).
- **`summary`**: Mô tả ngắn gọn về endpoint.
- **`security`**: Yêu cầu xác thực (ví dụ: `bearerAuth` cho JWT).
- **`requestBody`**: Mô tả dữ liệu gửi lên (dùng cho POST/PUT).
- **`responses`**: Mô tả các phản hồi có thể có (200, 400, 401, 500...).

## 4. Các kiểu dữ liệu thường dùng

Có thể định nghĩa các schema tái sử dụng trong `src/config/swagger.js` dưới mục `components/schemas` nếu cần thiết.

## 5. Lưu ý

- Luôn cập nhật tài liệu khi thay đổi code API.
- Kiểm tra cú pháp YAML trong chú thích (thụt đầu dòng rất quan trọng).
