const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const { body, validationResult } = require("express-validator");

const env = require("../../config/env");
const { ROLES } = require("../../constants/roles");
const { changePassword } = require("./auth.controller");

const router = express.Router();

/* ===================== LOAD USER MODEL ===================== */
const User = require("../users/user.model");

const mailTransporter =
  env.smtpHost && env.smtpUser && env.smtpPass
    ? nodemailer.createTransport({
        host: env.smtpHost,
        port: env.smtpPort,
        secure: env.smtpSecure,
        auth: {
          user: env.smtpUser,
          pass: env.smtpPass,
        },
      })
    : nodemailer.createTransport({ jsonTransport: true });

const sendResetPasswordEmail = async ({ to, resetToken }) => {
  const resetLink = `${env.clientOrigin || "http://localhost:5173"}/reset-password/${encodeURIComponent(
    resetToken
  )}`;
  await mailTransporter.sendMail({
    from: env.mailFrom,
    to,
    subject: "Reset Password",
    text: `Click link:\n${resetLink}`,
    html: `<p>Click link:</p><p><a href="${resetLink}">${resetLink}</a></p>`,
  });
};

/* ===================== CREATE DEFAULT ADMIN ===================== */
const ensureDefaultAdmin = async () => {
  const adminEmail = "admin@demo.com";
  const adminPassword = "12345678";
  const existingAdmin = await User.findOne({ email: adminEmail });
  if (existingAdmin) {
    if (!existingAdmin.passwordHash) {
      existingAdmin.passwordHash = await bcrypt.hash(adminPassword, 10);
      await existingAdmin.save();
      console.log("Admin password hash initialized");
    }

    return existingAdmin;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const adminUser = await User.create({
    fullName: "Admin",
    name: "Admin",
    email: adminEmail,
    tenantId: "default",
    role: "admin",
    passwordHash,
    permissions: [
      { module: "*", actions: ["create", "read", "update", "delete"] },
    ],
  });

  console.log("Admin created");
  return adminUser;
};

/* ===================== REGISTER ===================== */
router.post(
  "/register",
  body("email").isEmail(),
  body("password").isLength({ min: 6 }),
  body("name").optional().isString().isLength({ min: 2 }),
  body("fullName").optional().isString().isLength({ min: 2 }),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const email = String(req.body.email || "").trim().toLowerCase();
      const password = String(req.body.password || "");
      const displayName = String(req.body.name || req.body.fullName || "").trim();
      const tenantId = String(req.body.tenantId || env.defaultAdminTenantId || "default").trim();
      const role = String(req.body.role || ROLES.TEAM_MEMBER || "user");

      if (!displayName) {
        return res.status(400).json({ message: "Name is required" });
      }

      const existing = await User.findOne({ email });
      if (existing) {
        return res.status(400).json({ message: "Email already exists" });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const user = await User.create({
        name: displayName,
        fullName: displayName,
        email,
        tenantId,
        role,
        passwordHash,
      });
      res.status(201).json({
        id: user._id,
        name: user.name || user.fullName,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      });
    } catch (error) {
      next(error);
    }
  }
);

/* ===================== LOGIN ===================== */
router.post(
  "/login",
  body("email").isEmail(),
  body("password").isLength({ min: 6 }),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const email = String(req.body.email || "").trim().toLowerCase();
      const password = String(req.body.password || "");

      const user = await User.findOne({ email });
      console.log("USER:", user);
      console.log("INPUT PASSWORD:", password);
      console.log("HASH:", user?.passwordHash);

      if (!user || !user.passwordHash) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);

      if (!isMatch) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = jwt.sign(
        {
          id: String(user._id),
          tenantId: user.tenantId,
          role: user.role,
          email: user.email,
        },
        env.jwtSecret,
        { expiresIn: "12h" }
      );

      res.json({
        token,
        user: {
          id: user._id,
          fullName: user.fullName,
          name: user.name || user.fullName,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
        },
      });
    } catch (err) {
      console.error("LOGIN ERROR:", err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

/* ===================== FORGOT PASSWORD ===================== */
router.post("/forgot-password", body("email").isEmail(), async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const email = String(req.body.email || "").trim().toLowerCase();

    const user = await User.findOne({ email });

    if (!user)
      return res.json({
        message: "If this account exists, reset instructions were generated.",
      });

    const token = crypto.randomBytes(32).toString("hex");
    user.resetToken = token;
    user.resetTokenExpiry = new Date(Date.now() + 1000 * 60 * 15);

    await user.save();
    await sendResetPasswordEmail({ to: user.email, resetToken: token });

    res.json({
      message: "If this account exists, reset instructions were sent by email.",
    });
  } catch (error) {
    next(error);
  }
});

/* ===================== RESET PASSWORD ===================== */
router.post(
  "/reset-password/:token",
  body("newPassword").isLength({ min: 6 }),
  async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const token = String(req.params.token || "").trim();
    const newPassword = String(req.body.newPassword || "");

    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() },
    });

    if (!user)
      return res
        .status(400)
        .json({ message: "Invalid or expired reset token" });

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.resetToken = null;
    user.resetTokenExpiry = null;

    await user.save();

    res.json({ message: "Password reset successful" });
  } catch (error) {
    next(error);
  }
}
);

/* ===================== CHANGE PASSWORD ===================== */
router.put("/change-password", changePassword);

module.exports = { authRouter: router, ensureDefaultAdmin, User };