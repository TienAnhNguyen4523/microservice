/**
 * User Service – Entry Point
 * Port: 5005
 */

import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import userRoutes from "./routes/userRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.USER_SERVICE_PORT || 5005;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/huxnStore";

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(cookieParser());

app.use("/users", userRoutes);

app.get("/health", (_, res) => res.json({ service: "user-service", status: "ok" }));

const start = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("user-service connected to MongoDB");
    app.listen(PORT, () => console.log(`user-service running on port ${PORT}`));
  } catch (error) {
    console.error("Failed to start user-service:", error.message);
    process.exit(1);
  }
};

start();
