const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    fullName: String,
    name: String,
    email: { type: String, unique: true },
    passwordHash: String,
    role: String,
    tenantId: String,
    permissions: [String],
    fcmTokens: [{ type: String }],
    resetToken: String,
    resetTokenExpiry: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.models.User || mongoose.model("User", userSchema);