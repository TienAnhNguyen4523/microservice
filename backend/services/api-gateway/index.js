/**
 * API Gateway – Entry Point
 * Port: 5000
 *
 * Acts as a single entry point for all microservices.
 * Handles:
 * - Request routing via http-proxy-middleware
 * - JWT authentication before forwarding to services
 *
 * Routes:
 *   /api/users/*    → user-service   :5005
 *   /api/products/* → product-service:5001
 *   /api/orders/*   → order-service  :5002
 */

import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createProxyMiddleware } from "http-proxy-middleware";
import jwt from "jsonwebtoken";

dotenv.config();

const app = express();
const PORT = process.env.GATEWAY_PORT || 5000;

// Service URLs (configurable via env for Docker)
const PRODUCT_URL = process.env.PRODUCT_SERVICE_URL || "http://localhost:5001";
const USER_URL    = process.env.USER_SERVICE_URL    || "http://localhost:5005";
const ORDER_URL   = process.env.ORDER_SERVICE_URL   || "http://localhost:5002";

// Global Middleware
app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());
// Auth Middleware

/**
 * Validates JWT cookie and attaches user info to the request header.
 * Downstream services receive X-User-Id and X-User-Is-Admin headers.
 */
const authMiddleware = (req, res, next) => {
  const token = req.cookies?.jwt;
  if (!token) {
    return res.status(401).json({ error: "Not authorized, no token." });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Forward user info to downstream services via headers
    req.headers["x-user-id"] = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Not authorized, token failed." });
  }
};

// Public routes (no auth required)

app.get("/api/config/paypal", (req, res) => {
  res.send({ clientId: process.env.PAYPAL_CLIENT_ID || "sb" });
});

app.post("/api/upload", (req, res) => {
  res.send({ message: "Image uploaded successfully", image: "/uploads/sample.jpg" });
});

// User registration / login – public
app.use(
  "/api/users/register",
  createProxyMiddleware({ target: USER_URL, changeOrigin: true, pathRewrite: { "^/api/users": "/users" } })
);

app.use(
  "/api/users/login",
  createProxyMiddleware({ target: USER_URL, changeOrigin: true, pathRewrite: { "^/api/users": "/users" } })
);

app.use(
  "/api/users/logout",
  createProxyMiddleware({ target: USER_URL, changeOrigin: true, pathRewrite: { "^/api/users": "/users" } })
);

// Public product browsing (list, search, filter, single)
app.use(
  "/api/products",
  createProxyMiddleware({
    target: PRODUCT_URL,
    changeOrigin: true,
    pathRewrite: { "^/api/products": "/products" },
    on: { error: (err, req, res) => res.status(502).json({ error: "product-service unavailable", detail: err.message }) },
  })
);

app.use(
  "/api/category",
  createProxyMiddleware({
    target: PRODUCT_URL,
    changeOrigin: true,
    pathRewrite: { "^/api/category": "/category" },
    on: { error: (err, req, res) => res.status(502).json({ error: "product-service unavailable", detail: err.message }) },
  })
);

// ─── Protected routes (auth required) ─────────────────────────

// Users (requires auth; admin actions are enforced at user-service level)
app.use(
  "/api/users",
  authMiddleware,
  createProxyMiddleware({
    target: USER_URL,
    changeOrigin: true,
    pathRewrite: { "^/api/users": "/users" },
    on: { error: (err, req, res) => res.status(502).json({ error: "user-service unavailable", detail: err.message }) },
  })
);

// Orders (requires auth)
app.use(
  "/api/orders",
  authMiddleware,
  createProxyMiddleware({
    target: ORDER_URL,
    changeOrigin: true,
    pathRewrite: { "^/api/orders": "/orders" },
    on: { error: (err, req, res) => res.status(502).json({ error: "order-service unavailable", detail: err.message }) },
  })
);

// Gateway health check
app.get("/health", (_, res) =>
  res.json({
    gateway: "ok",
    services: {
      "product-service": PRODUCT_URL,
      "order-service": ORDER_URL,
      "user-service": USER_URL,
    },
  })
);

// Remove unused mongoose import warning
app.get("/favicon.ico", (_, res) => res.status(204).end());

// Start
app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
  console.log(`  /api/products → product-service:5001`);
  console.log(`  /api/orders   → order-service:5002`);
  console.log(`  /api/users    → user-service:5005`);
});
