/**
 * Product Controller – HTTP layer.
 * Validates requests and delegates to productService.
 */

import * as productService from "../services/productService.js";

// GET /products
export const getProducts = async (req, res) => {
  try {
    const result = await productService.fetchProducts(req.query);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server Error" });
  }
};

// GET /products/top
export const getTopProducts = async (req, res) => {
  try {
    const products = await productService.fetchTopProducts();
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: "Server Error" });
  }
};

// GET /products/new
export const getNewProducts = async (req, res) => {
  try {
    const products = await productService.fetchNewProducts();
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: "Server Error" });
  }
};

// GET /products/:id
export const getProductById = async (req, res) => {
  try {
    const product = await productService.fetchProductById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server Error" });
  }
};

// POST /products  (admin)
export const createProduct = async (req, res) => {
  try {
    const { name, image, brand, quantity, category, description, price, countInStock } = req.body;
    if (!name || !image || !brand || !quantity || !category || !description || !price) {
      return res.status(400).json({ error: "All fields are required" });
    }
    const product = await productService.createProduct(req.body);
    res.status(201).json(product);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message });
  }
};

// PUT /products/:id  (admin)
export const updateProduct = async (req, res) => {
  try {
    const product = await productService.updateProduct(req.params.id, req.body);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message });
  }
};

// DELETE /products/:id  (admin)
export const deleteProduct = async (req, res) => {
  try {
    const product = await productService.deleteProduct(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json({ message: "Product deleted", product });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server Error" });
  }
};
