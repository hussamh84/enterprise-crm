const tenantMiddleware = (req, _res, next) => {
  req.tenantId = req.user?.tenantId || req.headers["x-tenant-id"] || "default";
  next();
};

module.exports = { tenantMiddleware };
