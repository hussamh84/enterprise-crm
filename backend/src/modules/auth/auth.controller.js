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
    console.log("CHANGE PASSWORD HIT");
    const { email, oldPassword, newPassword } = req.body;

    console.log("BODY:", req.body);

    const user = await User.findOne({ email });

    console.log("USER:", user);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.passwordHash) {
      return res.status(500).json({ message: "Password hash missing" });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);

    if (!isMatch) {
      return res.status(401).json({ message: "Old password incorrect" });
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    user.passwordHash = hashed;
    await user.save();

    return res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("CHANGE PASSWORD ERROR:", err);
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { login, changePassword };
