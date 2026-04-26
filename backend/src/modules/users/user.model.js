const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true },
    name: { type: String, trim: true },
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, default: "company_admin" },
    permissions: [{ module: String, actions: [String] }],
    resetPasswordToken: String,
    resetPasswordExpiresAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.models.User || mongoose.model("User", userSchema);