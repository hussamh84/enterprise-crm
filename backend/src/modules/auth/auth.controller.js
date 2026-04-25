const bcrypt = require("bcrypt");
const User = require("../users/user.model");

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log("LOGIN INPUT:", email, password);

    const user = await User.findOne({ email });

    console.log("FOUND USER:", user);

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    console.log("HASH:", user.passwordHash);

    if (!user.passwordHash) {
      return res.status(500).json({ message: "Password hash missing" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);

    console.log("MATCH:", isMatch);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password" });
    }

    return res.json({ message: "Login success" });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = { login };
