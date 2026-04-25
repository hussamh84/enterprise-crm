const env = require("./config/env");
const mongoose = require("mongoose");
const { app } = require("./app");
const { ensureDefaultAdmin } = require("./modules/auth/auth.routes");

const start = async () => {
  try {
    // الاتصال بـ MongoDB Atlas
    await mongoose.connect(env.mongoUri);
    console.log("MongoDB connected successfully ✅");

    // إنشاء الأدمن الافتراضي
    await ensureDefaultAdmin();

    // تشغيل السيرفر
    app.listen(env.port, () => {
      console.log(`API running on http://localhost:${env.port}`);
    });

  } catch (error) {
    console.error("MongoDB connection error ❌");
    console.error(error);
    process.exit(1);
  }
};

start();