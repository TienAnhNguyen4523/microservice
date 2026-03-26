/**
 * Order Service – Business Logic
 *
 * Async Order Flow:
 * 1. createOrder() → saves order with status PENDING → publishes ORDER_CREATED
 * 2. consumePaymentEvents() → listens for PAYMENT_SUCCESS / PAYMENT_FAILED
 *    → updates order status accordingly
 *
 * Idempotency:
 * An idempotencyKey (userId + hash of orderItems) is stored on the order.
 * If the same key is submitted twice, the existing order is returned instead
 * of creating a duplicate.
 */

import crypto from "crypto";
import Order from "../models/orderModel.js";
import { publish, consume } from "../../shared/rabbitmq/connection.js";

//Price calculation

function calcPrices(orderItems) {
  const itemsPrice = orderItems.reduce((acc, item) => acc + item.price * item.qty, 0);
  const shippingPrice = itemsPrice > 100 ? 0 : 10;
  const taxRate = 0.15;
  const taxPrice = (itemsPrice * taxRate).toFixed(2);
  const totalPrice = (itemsPrice + shippingPrice + parseFloat(taxPrice)).toFixed(2);
  return {
    itemsPrice: itemsPrice.toFixed(2),
    shippingPrice: shippingPrice.toFixed(2),
    taxPrice,
    totalPrice,
  };
}

//Idempotency helper

/**
 * Generate a deterministic key for duplicate detection.
 * Uses a hash of (userId + sorted product IDs + quantities).
 */
const generateIdempotencyKey = (userId, orderItems) => {
  const payload = userId + JSON.stringify(
    [...orderItems].sort((a, b) => a.product.localeCompare(b.product))
  );
  return crypto.createHash("sha256").update(payload).digest("hex");
};

// Create Order

export const createOrder = async ({ orderItems, shippingAddress, paymentMethod, user, idempotencyKey }) => {
  if (!orderItems || orderItems.length === 0) {
    throw new Error("No order items");
  }

  // Use provided idempotency key from header or fallback to generating one
  const finalIdempotencyKey = idempotencyKey || generateIdempotencyKey(
    user._id.toString(),
    orderItems.map((i) => ({ product: i.product.toString(), qty: i.qty }))
  );

  // Check if this exact order was already placed
  const existing = await Order.findOne({ idempotencyKey: finalIdempotencyKey });
  if (existing) {
    console.log(`Duplicate order detected (idempotencyKey: ${finalIdempotencyKey}). Returning existing order.`);
    return existing;
  }

  const { itemsPrice, taxPrice, shippingPrice, totalPrice } = calcPrices(orderItems);

  // Save order with status PENDING
  const order = new Order({
    orderItems,
    user: user._id,
    shippingAddress,
    paymentMethod,
    itemsPrice,
    taxPrice,
    shippingPrice,
    totalPrice,
    status: "PENDING",
    idempotencyKey: finalIdempotencyKey,
  });

  const savedOrder = await order.save();
  console.log(`Order created: ${savedOrder._id} (status: PENDING)`);

  // Publish ORDER_CREATED event for inventory-service to consume
  await publish("ORDER_CREATED", {
    orderId: savedOrder._id.toString(),
    userId: user._id.toString(),
    orderItems: savedOrder.orderItems.map((i) => ({
      product: i.product.toString(),
      qty: i.qty,
      price: i.price,
    })),
    totalPrice: savedOrder.totalPrice,
  });

  return savedOrder;
};

// Consume Payment Results

/**
 * Listen for PAYMENT_SUCCESS and PAYMENT_FAILED events from payment-service.
 * Updates the order status in MongoDB accordingly.
 */
export const consumePaymentEvents = async () => {
  // Success handler
  await consume("PAYMENT_SUCCESS", async ({ orderId }) => {
    console.log(`Payment success event received for order: ${orderId}`);
    
    const order = await Order.findById(orderId);
    if (!order) {
      console.warn(`Order ${orderId} not found during payment success processing!`);
      return;
    }
    
    // Webhook Idempotency & Consistency check
    if (order.isPaid) {
      console.log(`Idempotency triggered: Order ${orderId} is already marked as PAID. Ignoring duplicate payment webhook.`);
      return;
    }

    order.status = "CONFIRMED";
    order.isPaid = true;
    order.paidAt = new Date();
    await order.save();
    
    console.log(`Order ${orderId} successfully updated to CONFIRMED`);
  });

  // Failure handler
  await consume("PAYMENT_FAILED", async ({ orderId }) => {
    console.log(`Payment failed for order: ${orderId}`);
    await Order.findByIdAndUpdate(orderId, { status: "FAILED" });
    console.log(`Order ${orderId} marked as FAILED`);
  });
};

// Query helpers

export const getAllOrders = async () =>
  Order.find({}).populate("user", "id username");

export const getUserOrders = async (userId) =>
  Order.find({ user: userId });

export const findOrderById = async (id) =>
  Order.findById(id).populate("user", "username email");

export const countTotalOrders = async () =>
  Order.countDocuments();

export const calculateTotalSales = async () => {
  const orders = await Order.find({ status: "CONFIRMED" });
  return orders.reduce((sum, order) => sum + Number(order.totalPrice), 0);
};

export const calcTotalSalesByDate = async () =>
  Order.aggregate([
    { $match: { isPaid: true } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$paidAt" } },
        totalSales: { $sum: "$totalPrice" },
      },
    },
  ]);

export const markOrderAsDelivered = async (id) => {
  const order = await Order.findById(id);
  if (!order) return null;
  order.isDelivered = true;
  order.deliveredAt = new Date();
  return order.save();
};
