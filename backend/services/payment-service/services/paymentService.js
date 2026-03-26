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

export const startPaymentConsumer = async () => {
  await consume("STOCK_RESERVED", async (payload) => {
    const { orderId, totalPrice } = payload;
    console.log(`payment-service: processing payment for order ${orderId} ($${totalPrice})`);

    // Simulate async payment processing (e.g. network latency)
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Simulate 90% success rate
    const isSuccess = Math.random() < 0.9;

    if (isSuccess) {
      await publish("PAYMENT_SUCCESS", {
        orderId,
        transactionId: `txn_${Date.now()}`,
        amount: totalPrice,
        paidAt: new Date().toISOString(),
      });
      console.log(`payment-service: PAYMENT_SUCCESS for order ${orderId}`);
    } else {
      await publish("PAYMENT_FAILED", {
        orderId,
        reason: "Payment declined by payment gateway (simulated)",
      });
      console.log(`payment-service: PAYMENT_FAILED for order ${orderId}`);
    }
  });

  // If stock reservation failed, order-service already handles it via STOCK_FAILED consumer
  // Payment service can also listen if it wants to rollback any pre-auth
  await consume("STOCK_FAILED", async ({ orderId }) => {
    console.log(`payment-service: skipping payment for order ${orderId} (stock failed)`);
    // No payment to process – publish PAYMENT_FAILED so order-service marks it as FAILED
    await publish("PAYMENT_FAILED", {
      orderId,
      reason: "Stock reservation failed — payment not processed",
    });
  });
};
