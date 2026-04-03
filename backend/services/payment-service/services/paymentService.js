/**
 * Payment Service – Business Logic
 *
 * Consumes STOCK_RESERVED events from inventory-service.
 * Simulates payment processing:
 * - 90% chance of success (PAYMENT_SUCCESS)
 * - 10% chance of failure (PAYMENT_FAILED)
 *
 * In production, replace the simulation with a real payment gateway
 * (e.g., Stripe, PayPal) using await stripeClient.paymentIntents.create(...)
 */

import { consume, publish } from "../../shared/rabbitmq/connection.js";

// Simple memory store to simulate Redis idempotency locking against double charges
const processedPayments = new Set();

export const startPaymentConsumer = async () => {
  await consume("stock.reserved", "payment_service_queue", async (payload) => {
    const { orderId, totalPrice, orderItems } = payload;

    // 1. Idempotency Check: Prevent charging the user twice
    if (processedPayments.has(orderId)) {
      console.log(`payment-service: Idempotency triggered – Payment for ${orderId} already processed! Ignoring duplicate.`);
      return;
    }
    
    // Add to lock map
    processedPayments.add(orderId);
    
    console.log(`payment-service: processing payment for order ${orderId} ($${totalPrice})`);

    // Simulate async payment processing (e.g. network latency)
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Simulate 90% success rate
    const isSuccess = Math.random() < 0.9;

    if (isSuccess) {
      await publish("payment.success", {
        orderId,
        transactionId: `txn_${Date.now()}`,
        amount: totalPrice,
        paidAt: new Date().toISOString(),
      });
      console.log(`payment-service: PAYMENT_SUCCESS for order ${orderId}`);
    } else {
      // Remove from lock to allow retry if they trigger Webhook again
      processedPayments.delete(orderId);
      
      await publish("payment.failed", {
        orderId,
        reason: "Payment declined by payment gateway (simulated)",
        orderItems, // Send orderItems back to inventory-service for compensation!
      });
      console.log(`payment-service: PAYMENT_FAILED for order ${orderId}`);
    }
  });

  await consume("stock.failed", "payment_service_queue", async ({ orderId }) => {
    console.log(`payment-service: skipping payment for order ${orderId} (stock failed)`);
    // No payment to process – order-service will handle STOCK_FAILED
  });
};
