import Outbox from "../models/outboxModel.js";
import { publish } from "../../shared/rabbitmq/connection.js";

/**
 * Worker polls Outbox table for PENDING messages, publishes them to RabbitMQ,
 * and marks them as COMPLETED upon successful ACK.
 */
export const startOutboxRelayWorker = () => {
  console.log("Starting Outbox Relay Worker...");
  
  // Poll every 5 seconds
  setInterval(async () => {
    try {
      // Find all pending messages
      const pendingMessages = await Outbox.find({ status: "PENDING" }).limit(50);
      
      if (pendingMessages.length === 0) return;

      for (const msg of pendingMessages) {
        try {
          // Gửi message. RabbitMQ utils đang dùng ConfirmChannel cho `publish`
          // Nên nếu thành công thì tức là Broker đã ACK.
          await publish(msg.topic, msg.payload);
          
          // Mark completed
          msg.status = "COMPLETED";
          await msg.save();
          console.log(`[Outbox Worker] Published and marked COMPLETED: ${msg._id}`);
          
        } catch (publishErr) {
          console.error(`[Outbox Worker] Failed to publish message: ${msg._id}`, publishErr.message);
          msg.retries += 1;
          msg.error = publishErr.message;
          // Có thể chuyển status -> FAILED nếu retries > max limit
          if (msg.retries > 5) {
            msg.status = "FAILED";
          }
          await msg.save();
        }
      }
    } catch (err) {
      console.error("[Outbox Worker] DB Error pulling outbox:", err.message);
    }
  }, 5000);
};
