const tenantMiddleware = (req, _res, next) => {
  req.tenantId = req.user?.tenantId || req.headers["x-tenant-id"] || null;
  next();
};

module.exports = { tenantMiddleware };
