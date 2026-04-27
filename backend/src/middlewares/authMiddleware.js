const jwt = require("jsonwebtoken");
const env = require("../config/env");

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    let token = null;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }
    const isPdfGet =
      req.method === "GET" && String(req.originalUrl || req.url || "").includes("/pdf");
    if (!token && isPdfGet && req.query?.access_token) {
      token = String(req.query.access_token);
    }
    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // 🔐 التحقق من التوكن
    const decoded = jwt.verify(token, env.jwtSecret);

    // ❌ تحقق إضافي (اختياري لكن مهم)
    if (!decoded?.id || !decoded?.tenantId) {
      return res.status(401).json({ message: "Invalid token" });
    }

    // ✅ تخزين بيانات المستخدم
    req.user = decoded;

    next();
  } catch (error) {
    // ❗ لا نكشف تفاصيل الخطأ
    return res.status(401).json({ message: "Unauthorized" });
  }
};

module.exports = { authMiddleware };