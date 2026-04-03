import mongoose from "mongoose";

const outboxSchema = new mongoose.Schema(
  {
    topic: { type: String, required: true },
    payload: { type: Object, required: true },
    status: { type: String, enum: ["PENDING", "COMPLETED", "FAILED"], default: "PENDING" },
    retries: { type: Number, default: 0 },
    error: { type: String, default: null }
  },
  { timestamps: true }
);

const Outbox = mongoose.models.Outbox || mongoose.model("Outbox", outboxSchema);

export default Outbox;
