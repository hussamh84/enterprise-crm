const mongoose = require("mongoose");

const CounterSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    value: { type: Number, default: 0 },
  },
  { timestamps: true }
);

CounterSchema.index({ tenantId: 1, name: 1 }, { unique: true });

const Counter = mongoose.models.Counter || mongoose.model("Counter", CounterSchema);

/**
 * Atomically increments the per-tenant client counter and returns the new value.
 */
async function incrementClientCounter(tenantId) {
  const doc = await Counter.findOneAndUpdate(
    { tenantId, name: "client" },
    { $inc: { value: 1 }, $setOnInsert: { tenantId, name: "client" } },
    { new: true, upsert: true }
  );
  return doc.value;
}

module.exports = { Counter, incrementClientCounter };
