import * as orderService from "../services/orderService.js";

// POST /orders
export const createOrder = async (req, res) => {
  try {
    const { orderItems, shippingAddress, paymentMethod } = req.body;
    const idempotencyKey = req.headers["x-idempotency-key"];
    
    const order = await orderService.createOrder({
      orderItems,
      shippingAddress,
      paymentMethod,
      user: req.user,
      idempotencyKey,
    });
    res.status(201).json(order);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// GET /orders (admin)
export const getAllOrders = async (req, res) => {
  try {
    const orders = await orderService.getAllOrders();
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /orders/mine
export const getUserOrders = async (req, res) => {
  try {
    const orders = await orderService.getUserOrders(req.user._id);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /orders/total-orders
export const countTotalOrders = async (req, res) => {
  try {
    const totalOrders = await orderService.countTotalOrders();
    res.json({ totalOrders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /orders/total-sales
export const calculateTotalSales = async (req, res) => {
  try {
    const totalSales = await orderService.calculateTotalSales();
    res.json({ totalSales });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /orders/total-sales-by-date
export const calcualteTotalSalesByDate = async (req, res) => {
  try {
    const salesByDate = await orderService.calcTotalSalesByDate();
    res.json(salesByDate);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /orders/:id
export const findOrderById = async (req, res) => {
  try {
    const order = await orderService.findOrderById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// PUT /orders/:id/deliver (admin)
export const markOrderAsDelivered = async (req, res) => {
  try {
    const order = await orderService.markOrderAsDelivered(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
