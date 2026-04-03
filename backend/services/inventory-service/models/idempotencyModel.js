import mongoose from "mongoose";

const idempotencySchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now, expires: "30d" } // Tự xoá sau 30 ngày
});

const Idempotency = mongoose.models.Idempotency || mongoose.model("Idempotency", idempotencySchema);

export default Idempotency;
