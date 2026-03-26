import express from "express";
import * as product from "../controllers/productController.js";

const router = express.Router();

// ─── List / Search / Filter / Paginate ───────────────────────────
// GET /products?page=1&limit=20&category=...&minPrice=...&maxPrice=...&search=...&sort=price_asc&fields=name,price
router.get("/", product.getProducts);

// ─── Special lists ─────────────────────────────────────────────
router.get("/top", product.getTopProducts);   // Top-rated
router.get("/new", product.getNewProducts);   // Newest

// ─── CRUD ──────────────────────────────────────────────────────
router.post("/", product.createProduct);         // Create (admin)
router.get("/:id", product.getProductById);      // Get by ID
router.put("/:id", product.updateProduct);       // Update (admin)
router.delete("/:id", product.deleteProduct);    // Delete (admin)

export default router;
