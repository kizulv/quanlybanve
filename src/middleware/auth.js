import jwt from "jsonwebtoken";

const SECRET_KEY = process.env.SECRET_KEY || "vinabus-secret-key-123";

export const verifyToken = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Access denied" });

  try {
    const verified = jwt.verify(token, SECRET_KEY);
    const { id, username, role, name, permissions } = verified;
    req.user = { id, username, role, name, permissions: permissions || [] };
    next();
  } catch (err) {
    res.status(400).json({ error: "Invalid token" });
  }
};

export const isAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};
