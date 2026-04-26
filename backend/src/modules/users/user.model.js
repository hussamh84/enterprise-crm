import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
{
fullName: String,
email: { type: String, unique: true },
passwordHash: String,
role: String,
tenantId: String,
permissions: [String]
},
{ timestamps: true }
);

export default mongoose.model("User", userSchema);