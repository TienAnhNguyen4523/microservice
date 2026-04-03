/**
 * Inventory Service – Business Logic
 *
 * Consumes ORDER_CREATED events from RabbitMQ.
 * Steps:
 * 1. For each item in the order, check if countInStock >= qty
 * 2. If all items are available:
 *    - Reduce countInStock for each product atomically
 *    - Publish STOCK_RESERVED event for payment-service
 * 3. If any item is out of stock:
 *    - Publish STOCK_FAILED event for order-service to mark as FAILED
 */

import mongoose from "mongoose";
import { consume, publish } from "../../shared/rabbitmq/connection.js";
import Idempotency from "../models/idempotencyModel.js";

// Product model (inline for this service)
const productSchema = new mongoose.Schema({
  name: String,
  quantity: Number,
  countInStock: { type: Number, required: true, default: 0 },
  price: Number,
  brand: String,
  image: String,
  category: mongoose.Schema.Types.ObjectId,
  description: String,
  rating: Number,
  numReviews: Number,
  reviews: Array,
});

const Product = mongoose.models.Product || mongoose.model("Product", productSchema);

// Event handle

export const startInventoryConsumer = async () => {
  await consume("order.created", "inventory_service_queue", async (orderPayload) => {
    // Lấy traceId nếu có truyền hoặc sinh ra để tracking log
    const traceId = orderPayload.traceId || `trace-${Math.random().toString(36).substring(7)}`;
    const { orderId, orderItems } = orderPayload;
    
    console.log(`[Jaeger] Trace Continued: ${traceId} - inventory-service processing ORDER_CREATED for ${orderId}`);

    // Idempotency: Kiểm tra message đã từng xử lý thành công chưa
    const idemKey = `order_created_${orderId}`;
    const alreadyProcessed = await Idempotency.findOne({ key: idemKey });
    if (alreadyProcessed) {
      console.log(`[Idempotency] Duplicate message detected for key: ${idemKey}. Skipping (Will ACK).`);
      return; // Return smoothly to trigger automatic ACK in the shared consume function
    }

    try {
      // 1. Reserve stock using atomic updates to prevent Overselling
      const reservedItems = [];
      let reservationFailed = false;
      let failureReason = "";

      for (const item of orderItems) {
        // Atomic decrement: only succeeds if countInStock >= item.qty
        const updatedProduct = await Product.findOneAndUpdate(
          { _id: item.product, countInStock: { $gte: item.qty } },
          { $inc: { countInStock: -item.qty } },
          { new: true }
        );

        if (!updatedProduct) {
          // Failed to reserve this item! (either not found or insufficient stock)
          reservationFailed = true;
          failureReason = `Insufficient stock for product: ${item.product}`;
          break;
        }
        reservedItems.push(item);
      }

      if (reservationFailed) {
        // Rollback reserved items (Saga Compensation for partial success)
        for (const item of reservedItems) {
          await Product.findByIdAndUpdate(item.product, {
            $inc: { countInStock: item.qty },
          });
        }
        console.warn(`Insufficient stock for order ${orderId}. Rolled back partial reservations.`);
        await publish("stock.failed", { orderId, reason: failureReason });
        return;
      }

      // 2. All items reserved successfully
      
      // Save idempotency key to prevent double-processing in the future
      await Idempotency.create({ key: idemKey });
      
      await publish("stock.reserved", {
        orderId,
        orderItems,
        totalPrice: orderPayload.totalPrice,
      });

      console.log(`inventory-service: STOCK_RESERVED published for order ${orderId}`);
    } catch (error) {
      console.error(`inventory-service error for order ${orderId}:`, error.message);
      await publish("stock.failed", { orderId, reason: error.message });
      // Throw error to trigger Manual NACK in the shared consume logic, routing it to DLX
      throw error;
    }
  });

  // Saga Compensation: Restore inventory if Payment fails
  await consume("payment.failed", "inventory_service_queue", async ({ orderId, reason, orderItems }) => {
    console.log(`STOCK COMPENSATION: PAYMENT_FAILED for order ${orderId}: ${reason}`);
    
    // Restore stock if items were provided in the payload
    if (orderItems && orderItems.length > 0) {
      for (const item of orderItems) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { countInStock: item.qty },
        });
        console.log(`Restored +${item.qty} to product ${item.product}`);
      }
    } else {
      console.warn(`Could not restore stock for ${orderId}: Missing orderItems in PAYMENT_FAILED payload`);
    }
  });

  await consume("stock.failed", "inventory_service_queue", async ({ orderId, reason }) => {
    console.log(`STOCK_FAILED for order ${orderId}: ${reason}`);
    // Handled by order-service
  });
};
