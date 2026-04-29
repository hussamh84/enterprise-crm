const env = require("./config/env");
const mongoose = require("mongoose");
const { app } = require("./app");
const User = require("./modules/users/user.model");

const start = async () => {
  try {
    mongoose.connection.once("open", async () => {
      try {
        const existing = await User.findOne({ email: "admin@demo.com" });

        if (!existing) {
          const bcrypt = await import("bcrypt");
          const hashed = await bcrypt.default.hash("12345678", 10);
          await User.create({
            fullName: "Admin",
            email: "admin@demo.com",
            passwordHash: hashed,
            role: "admin",
            tenantId: "default",
          });
          console.log("Admin created");
        }
      } catch (err) {
        console.error(err.message);
      }
    });

    await mongoose.connect(env.mongoUri);
    console.log("MongoDB connected successfully ✅");
    console.log(`MongoDB database: ${mongoose.connection.name}`);

    app.listen(env.port, () => {
      console.log(`Server running on port ${env.port}`);
      console.log(`API running on http://localhost:${env.port}`);
    });
  } catch (error) {
    console.error("MongoDB connection error ❌");
    console.error(error);
    process.exit(1);
  }
};

start();