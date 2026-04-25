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

const { authMiddleware } = require("./middlewares/authMiddleware");
const { tenantMiddleware } = require("./middlewares/tenantMiddleware");
const { errorHandler } = require("./middlewares/errorHandler");

const app = express();

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
app.use(express.json({ limit: "10mb" }));

/* ===================== STATIC ===================== */
app.use("/uploads", express.static(path.resolve(__dirname, "../uploads")));

/* ===================== HEALTH ===================== */
app.get("/health", (_req, res) => res.json({ ok: true }));

/* ===================== APPLY RATE LIMIT ===================== */
app.use("/api", apiLimiter);

/* ===================== ROUTES ===================== */
// 🔐 حماية تسجيل الدخول فقط
app.use("/api/v1/auth/login", loginLimiter);

app.use("/api/v1/auth", authRouter);
app.use("/api/v1", authMiddleware, tenantMiddleware, moduleRouter);
app.use("/api/v1", authMiddleware, tenantMiddleware, pdfRouter);

/* ===================== ERROR HANDLER ===================== */
app.use(errorHandler);

module.exports = { app };