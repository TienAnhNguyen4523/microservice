/**
 * Product Service – Business Logic Layer
 *
 * Handles MongoDB queries with full support for:
 * - Pagination  (?page=1&limit=20)
 * - Filtering   (?category=id&minPrice=10&maxPrice=500)
 * - Search      (?search=keyword)
 * - Sorting     (?sort=price_asc | price_desc | rating_desc | newest)
 * - Field select(?fields=name,price,image)
 *
 * All list queries are cached in Redis with a 60-second TTL.
 * Cache is invalidated on any write operation.
 */

import Product from "../models/productModel.js";
import { get, set, del } from "../../shared/redis/client.js";

// ─── Cache helpers ────────────────────────────────────────────────

/**
 * Build a deterministic cache key from query parameters.
 * Format: products:{page}:{limit}:{category}:{minPrice}:{maxPrice}:{search}:{sort}:{fields}
 */
const buildCacheKey = (query) => {
  const { page = 1, limit = 20, category = "", minPrice = "", maxPrice = "", search = "", sort = "", fields = "" } = query;
  return `products:${page}:${limit}:${category}:${minPrice}:${maxPrice}:${search}:${sort}:${fields}`;
};

/**
 * Invalidate all product list caches (used after any write).
 */
const invalidateListCache = async () => {
  await del("products:*");
};

// ─── Sort map ────────────────────────────────────────────────────

const SORT_MAP = {
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  rating_desc: { rating: -1 },
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
};

// ─── Service functions ────────────────────────────────────────────

/**
 * List products with full filter / paginate / search / sort / fields support.
 */
export const fetchProducts = async (query) => {
  const cacheKey = buildCacheKey(query);

  // 1. Check Redis cache first
  const cached = await get(cacheKey);
  if (cached) {
    console.log(`Cache HIT for key: ${cacheKey}`);
    return { ...cached, fromCache: true };
  }
  console.log(`Cache MISS for key: ${cacheKey}`);

  // 2. Build MongoDB filter
  const { page = 1, limit = 20, category, minPrice, maxPrice, search, sort, fields } = query;
  const filter = {};

  if (search) {
    filter.name = { $regex: search, $options: "i" };
  }
  if (category) {
    filter.category = category;
  }
  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }

  // 3. Build sort
  const sortObj = SORT_MAP[sort] || { createdAt: -1 };

  // 4. Field selection (comma-separated → space-separated for Mongoose)
  const projection = fields ? fields.split(",").join(" ") : "";

  // 5. Pagination
  const pageNum = Math.max(1, Number(page));
  const pageSize = Math.min(100, Math.max(1, Number(limit)));
  const skip = (pageNum - 1) * pageSize;

  // 6. Execute query
  const [products, total] = await Promise.all([
    Product.find(filter).select(projection).sort(sortObj).skip(skip).limit(pageSize).populate("category", "name"),
    Product.countDocuments(filter),
  ]);

  const result = {
    products,
    page: pageNum,
    pages: Math.ceil(total / pageSize),
    total,
    limit: pageSize,
  };

  // 7. Cache for 60 seconds
  await set(cacheKey, result, 60);

  return result;
};

/**
 * Get a single product by ID.
 * Cached for 5 minutes (300s).
 */
export const fetchProductById = async (id) => {
  const cacheKey = `product:${id}`;
  const cached = await get(cacheKey);
  if (cached) {
    console.log(`🟢 Cache HIT for product: ${id}`);
    return cached;
  }

  const product = await Product.findById(id).populate("category", "name");
  if (!product) return null;

  await set(cacheKey, product, 300);
  return product;
};

/**
 * Create a new product.
 * Invalidates all list caches after creation.
 */
export const createProduct = async (data) => {
  const product = new Product(data);
  await product.save();
  await invalidateListCache();
  return product;
};

/**
 * Update a product by ID.
 * Invalidates both the specific product cache and all list caches.
 */
export const updateProduct = async (id, data) => {
  const product = await Product.findByIdAndUpdate(id, data, { new: true });
  if (!product) return null;
  await del(`product:${id}`);
  await invalidateListCache();
  return product;
};

/**
 * Delete a product by ID.
 * Invalidates caches accordingly.
 */
export const deleteProduct = async (id) => {
  const product = await Product.findByIdAndDelete(id);
  if (!product) return null;
  await del(`product:${id}`);
  await invalidateListCache();
  return product;
};

/**
 * Get top-rated products (cached 5 min).
 */
export const fetchTopProducts = async (limit = 4) => {
  const cacheKey = `products:top:${limit}`;
  const cached = await get(cacheKey);
  if (cached) return cached;

  const products = await Product.find({}).sort({ rating: -1 }).limit(limit);
  await set(cacheKey, products, 300);
  return products;
};

/**
 * Get newest products (cached 5 min).
 */
export const fetchNewProducts = async (limit = 5) => {
  const cacheKey = `products:new:${limit}`;
  const cached = await get(cacheKey);
  if (cached) return cached;

  const products = await Product.find({}).sort({ _id: -1 }).limit(limit);
  await set(cacheKey, products, 300);
  return products;
};
