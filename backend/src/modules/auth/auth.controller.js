const bcrypt = require("bcrypt");
const User = require("../users/user.model");

const login = async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    const user = await User.findOne({ email });
    console.log("LOGIN USER:", user);
    console.log("LOGIN HASH:", user?.passwordHash);

    if (!user || !user.passwordHash) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    return res.status(200).json({
      message: "Login success",
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(401).json({ message: "Invalid credentials" });
  }
};

const changePassword = async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const oldPassword = String(req.body?.oldPassword || "");
    const newPassword = String(req.body?.newPassword || "");

    if (!email || !oldPassword || !newPassword) {
      return res.status(400).json({
        message: "Email, current password, and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }

    const user = await User.findOne({ email });
    if (!user || !user.passwordHash) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    user.passwordHash = hashed;
    await user.save();
    const updated = await User.findOne({ email });
    console.log("UPDATED HASH:", updated.passwordHash);

    return res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = { login, changePassword };
