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
  await consume("ORDER_CREATED", async (orderPayload) => {
    const { orderId, orderItems } = orderPayload;
    console.log(`inventory-service: processing ORDER_CREATED for order ${orderId}`);

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
        await publish("STOCK_FAILED", { orderId, reason: failureReason });
        return;
      }

      // 2. All items reserved successfully
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

  // Saga Compensation: Restore inventory if Payment fails
  await consume("PAYMENT_FAILED", async ({ orderId, reason, orderItems }) => {
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

  await consume("STOCK_FAILED", async ({ orderId, reason }) => {
    console.log(`STOCK_FAILED for order ${orderId}: ${reason}`);
    // Handled by order-service
  });
};
