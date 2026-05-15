const User = require("../modules/users/user.model");

const requireAdmin = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(403).json({ message: "Access denied. Admin only." });
    const user = await User.findById(userId).select("role").lean();
    const role = user?.role;
    if (role === "admin" || role === "company_admin") return next();
    return res.status(403).json({ message: "Access denied. Admin only." });
  } catch {
    return res.status(403).json({ message: "Access denied." });
  }
};

module.exports = { requireAdmin };
