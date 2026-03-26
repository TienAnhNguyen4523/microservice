/**
 * Product Service – Entry Point
 * Port: 5001
 *
 * Connects to MongoDB and Redis on startup.
 * Exposes REST API for product management with Redis caching.
 */

import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import productRoutes from "./routes/productRoutes.js";
import { connectRedis } from "../shared/redis/client.js";

dotenv.config();

const app = express();
const PORT = process.env.PRODUCT_SERVICE_PORT || 5001;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/huxnStore";

// ─── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Routes ──────────────────────────────────────────────────
app.use("/products", productRoutes);

// Health check
app.get("/health", (_, res) => res.json({ service: "product-service", status: "ok" }));

// ─── Startup ──────────────────────────────────────────────────
const start = async () => {
  try {
    // Connect MongoDB
    await mongoose.connect(MONGO_URI);
    console.log("product-service connected to MongoDB");

    // Connect Redis
    await connectRedis();

    app.listen(PORT, () => {
      console.log(`product-service running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start product-service:", error.message);
    process.exit(1);
  }
};

start();
