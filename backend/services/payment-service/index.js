/**
 * Payment Service – Entry Point
 * Purely event-driven via RabbitMQ. No HTTP server needed.
 * Consumes STOCK_RESERVED → simulates payment → publishes result.
 */

import dotenv from "dotenv";
import { connectRabbitMQ } from "../shared/rabbitmq/connection.js";
import { startPaymentConsumer } from "./services/paymentService.js";

dotenv.config();

const start = async () => {
  try {
    await connectRabbitMQ();
    await startPaymentConsumer();
    console.log("payment-service running and listening for STOCK_RESERVED events");
  } catch (error) {
    console.error("Failed to start payment-service:", error.message);
    process.exit(1);
  }
};

start();
