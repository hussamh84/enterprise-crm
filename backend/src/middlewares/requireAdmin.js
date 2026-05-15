const requireAdmin = (req, res, next) => {
  const role = req.user?.role;
  if (role === "admin" || role === "company_admin") return next();
  return res.status(403).json({ message: "Access denied. Admin only." });
};

module.exports = { requireAdmin };
