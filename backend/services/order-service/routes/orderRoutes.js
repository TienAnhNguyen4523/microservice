import express from "express";
import * as order from "../controllers/orderController.js";
import { authenticate, authorizeAdmin } from "../middlewares/authMiddleware.js";

const router = express.Router();

// User routes
router.post("/", authenticate, order.createOrder);
router.get("/mine", authenticate, order.getUserOrders);
router.get("/:id", authenticate, order.findOrderById);

// Admin routes
router.get("/", authenticate, authorizeAdmin, order.getAllOrders);
router.get("/total-orders", authenticate, authorizeAdmin, order.countTotalOrders);
router.get("/total-sales", authenticate, authorizeAdmin, order.calculateTotalSales);
router.get("/total-sales-by-date", authenticate, authorizeAdmin, order.calcualteTotalSalesByDate);
router.put("/:id/deliver", authenticate, authorizeAdmin, order.markOrderAsDelivered);

export default router;
