const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const rateLimit = require("express-rate-limit");

const env = require("./config/env");

const { authRouter } = require("./modules/auth/auth.routes");
const { moduleRouter } = require("./modules");
const { pdfRouter } = require("./modules/pdf.routes");
const { backupRouter } = require("./modules/backup.routes");

const { authMiddleware } = require("./middlewares/authMiddleware");
const { tenantMiddleware } = require("./middlewares/tenantMiddleware");
const { errorHandler } = require("./middlewares/errorHandler");

const app = express();
app.set("trust proxy", 1);

/* ===================== SECURITY: RATE LIMIT ===================== */

// حماية عامة لكل API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 100, // 100 طلب لكل IP
  message: { message: "Too many requests, please try again later." }
});

// حماية قوية لتسجيل الدخول
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: "Too many login attempts, try again later." }
});

/* ===================== CORS ===================== */
app.use(
  cors({
    origin: [env.clientOrigin, "https://enterprise-crm-omega.vercel.app"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

/* ===================== HEADERS SECURITY ===================== */
app.use(helmet());

/* ===================== MIDDLEWARE ===================== */
app.use(morgan("dev"));
app.use(express.json({ limit: "20mb" }));

/* ===================== STATIC ===================== */
app.use("/uploads", express.static(path.resolve(__dirname, "../uploads")));

/* ===================== HEALTH ===================== */
app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/api", (_req, res) => res.send("API is working"));

/* ===================== APPLY RATE LIMIT ===================== */
app.use("/api", apiLimiter);

/* ===================== ROUTES ===================== */
// 🔐 حماية تسجيل الدخول فقط
app.use("/api/v1/auth/login", loginLimiter);

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/backup", authMiddleware, tenantMiddleware, backupRouter);
app.use("/api/v1", tenantMiddleware, moduleRouter);
app.use("/api/v1", tenantMiddleware, pdfRouter);

// Backward-compatible aliases so frontend calls to /api/* continue to work.
app.use("/api/auth/login", loginLimiter);
app.use("/api/auth", authRouter);
app.use("/api/backup", authMiddleware, tenantMiddleware, backupRouter);
app.use("/api", tenantMiddleware, moduleRouter);
app.use("/api", tenantMiddleware, pdfRouter);

/* ===================== ERROR HANDLER ===================== */
app.use(errorHandler);

module.exports = { app };