import User from "../models/User.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const getSecretKey = () => process.env.SECRET_KEY || "vinabus-secret-key-123";

export const login = async (req, res) => {
  try {
    const username = req.body.username?.trim();
    const password = req.body.password?.trim();

    if (!username || !password) {
      console.log(`[AUTH] Login failed: Missing credentials`);
      return res
        .status(400)
        .json({ error: "Tên đăng nhập và mật khẩu là bắt buộc" });
    }

    const user = await User.findOne({ username });
    if (!user) {
      console.log(`[AUTH] Login failed: User not found (${username})`);
      return res.status(400).json({ error: "User not found" });
    }

    const validPass = await bcrypt.compare(password, user.password);
    if (!validPass) {
      console.log(`[AUTH] Login failed: Invalid password for user ${username}`);
      return res.status(400).json({ error: "Invalid password" });
    }

    const token = jwt.sign(
      {
        id: user._id,
        username: user.username,
        role: user.role,
        name: user.name,
        permissions: user.permissions,
      },
      getSecretKey(),
      { expiresIn: "24h" },
    );
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        name: user.name,
        permissions: user.permissions,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const validPass = await bcrypt.compare(oldPassword, user.password);
    if (!validPass)
      return res.status(400).json({ error: "Mật khẩu cũ không đúng" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();
    res.json({ success: true, message: "Đổi mật khẩu thành công" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
