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

// ─── Product model (inline for this service) ───────────────────
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

// ─── Event handler ─────────────────────────────────────────────

export const startInventoryConsumer = async () => {
  await consume("ORDER_CREATED", async (orderPayload) => {
    const { orderId, orderItems } = orderPayload;
    console.log(`inventory-service: processing ORDER_CREATED for order ${orderId}`);

    try {
      // Check stock availability for all items first
      for (const item of orderItems) {
        const product = await Product.findById(item.product);

        if (!product) {
          console.error(`Product not found: ${item.product}`);
          await publish("STOCK_FAILED", { orderId, reason: `Product ${item.product} not found` });
          return;
        }

        if (product.countInStock < item.qty) {
          console.warn(`Insufficient stock: ${product.name} has ${product.countInStock}, need ${item.qty}`);
          await publish("STOCK_FAILED", {
            orderId,
            reason: `Insufficient stock for product: ${product.name}`,
          });
          return;
        }
      }

      // All items are available — reduce stock using atomic $inc operations
      for (const item of orderItems) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { countInStock: -item.qty },
        });
        console.log(`Reduced stock for product ${item.product} by ${item.qty}`);
      }

      // Notify payment-service that stock is reserved
      await publish("STOCK_RESERVED", {
        orderId,
        orderItems,
        totalPrice: orderPayload.totalPrice,
      });

      console.log(`inventory-service: STOCK_RESERVED published for order ${orderId}`);
    } catch (error) {
      console.error(`inventory-service error for order ${orderId}:`, error.message);
      await publish("STOCK_FAILED", { orderId, reason: error.message });
    }
  });

  // Also consume STOCK_FAILED from order-service to show correct log
  await consume("STOCK_FAILED", async ({ orderId, reason }) => {
    console.log(`STOCK_FAILED for order ${orderId}: ${reason}`);
    // Order service will listen separately if needed; this is just for logging
  });
};
