const mongoose = require("mongoose");
const env = require("./env");

const connectDb = async () => {
  try {
    await mongoose.connect(env.mongoUri);
    console.log("MongoDB connected successfully ✅");
  } catch (error) {
    console.error("MongoDB connection failed ❌");
    console.error(error);
    process.exit(1); // يوقف السيرفر إذا فشل الاتصال
  }
};

module.exports = { connectDb };