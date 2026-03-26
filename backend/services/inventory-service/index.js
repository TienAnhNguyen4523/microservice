/**
 * Inventory Service – Entry Point
 * Port: 5003 (no HTTP server needed – purely event-driven via RabbitMQ)
 * Connects to MongoDB and starts consuming ORDER_CREATED events.
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectRabbitMQ } from "../shared/rabbitmq/connection.js";
import { startInventoryConsumer } from "./services/inventoryService.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/huxnStore";

const start = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("inventory-service connected to MongoDB");

    await connectRabbitMQ();
    await startInventoryConsumer();
    console.log("inventory-service running and listening for ORDER_CREATED events");
  } catch (error) {
    console.error("Failed to start inventory-service:", error.message);
    process.exit(1);
  }
};

start();
