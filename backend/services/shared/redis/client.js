/**
 * Shared Redis client module using ioredis.
 * Provides a singleton client and convenience wrappers for get/set/del.
 * All services import from here to reuse the same connection.
 */

import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Create the Redis client once
const redisClient = new Redis(REDIS_URL, {
  lazyConnect: true,
  retryStrategy: (times) => {
    // Exponential back-off, max 30 seconds
    const delay = Math.min(times * 500, 30000);
    console.log(`Redis retry #${times}, next attempt in ${delay}ms`);
    return delay;
  },
});

redisClient.on("connect", () => console.log("Connected to Redis"));
redisClient.on("error", (err) => console.error("Redis error:", err.message));

/**
 * Connect the Redis client (call once at service startup).
 */
export const connectRedis = async () => {
  await redisClient.connect();
};

/**
 * Get a cached value by key.
 * @param {string} key
 * @returns {any|null} Parsed JSON value, or null if not found
 */
export const get = async (key) => {
  const value = await redisClient.get(key);
  return value ? JSON.parse(value) : null;
};

/**
 * Set a value in cache with optional TTL.
 * @param {string} key
 * @param {any} value - Will be JSON-stringified
 * @param {number} [ttl=60] - Time-to-live in seconds
 */
export const set = async (key, value, ttl = 60) => {
  await redisClient.set(key, JSON.stringify(value), "EX", ttl);
};

/**
 * Delete one or more keys from cache.
 * Supports glob patterns via SCAN (e.g., "products:*")
 * @param {string} pattern - Exact key or glob pattern
 */
export const del = async (pattern) => {
  if (pattern.includes("*")) {
    // Use SCAN to find and delete all matching keys
    let cursor = "0";
    do {
      const [newCursor, keys] = await redisClient.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = newCursor;
      if (keys.length > 0) {
        await redisClient.del(...keys);
        console.log(`Redis: Deleted ${keys.length} keys matching "${pattern}"`);
      }
    } while (cursor !== "0");
  } else {
    await redisClient.del(pattern);
  }
};

export default redisClient;
