/**
 * Order Service – Entry Point
 * Port: 5002
 *
 * On startup:
 * - Connects to MongoDB and RabbitMQ
 * - Starts consuming PAYMENT_SUCCESS and PAYMENT_FAILED events
 */

import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import orderRoutes from "./routes/orderRoutes.js";
import { connectRabbitMQ } from "../shared/rabbitmq/connection.js";
import { consumePaymentEvents } from "./services/orderService.js";

dotenv.config();

const app = express();
const PORT = process.env.ORDER_SERVICE_PORT || 5002;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/huxnStore";

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(cookieParser());

app.use("/orders", orderRoutes);

app.get("/health", (_, res) => res.json({ service: "order-service", status: "ok" }));

const start = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("order-service connected to MongoDB");

    await connectRabbitMQ();

    // Start listening for payment results from payment-service
    await consumePaymentEvents();
    console.log("order-service listening for PAYMENT_SUCCESS / PAYMENT_FAILED");

    app.listen(PORT, () => console.log(`order-service running on port ${PORT}`));
  } catch (error) {
    console.error("Failed to start order-service:", error.message);
    process.exit(1);
  }
};

start();
