const jwt = require("jsonwebtoken");
const env = require("../config/env");

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;

    // ❌ لا يوجد توكن
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // 🔐 استخراج التوكن
    const token = authHeader.split(" ")[1];

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