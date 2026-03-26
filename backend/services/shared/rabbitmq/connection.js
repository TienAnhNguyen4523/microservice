/**
 * Shared RabbitMQ connection module.
 * Provides a singleton channel and helper functions for publishing/consuming messages.
 * All services import from this module to reuse the same connection logic.
 */

import amqplib from "amqplib";

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://localhost";

let connection = null;
let channel = null;

/**
 * Connect to RabbitMQ and create a channel.
 * Retries every 5 seconds if connection fails (e.g., RabbitMQ not yet ready).
 */
export const connectRabbitMQ = async () => {
  try {
    connection = await amqplib.connect(RABBITMQ_URL);
    channel = await connection.createChannel();
    console.log("Connected to RabbitMQ");

    // Handle unexpected disconnections
    connection.on("error", (err) => {
      console.error("RabbitMQ connection error:", err.message);
      reconnect();
    });

    connection.on("close", () => {
      console.warn("RabbitMQ connection closed. Reconnecting...");
      reconnect();
    });
  } catch (error) {
    console.error("Failed to connect to RabbitMQ:", error.message);
    console.log("Retrying in 5 seconds...");
    setTimeout(connectRabbitMQ, 5000);
  }
};

/**
 * Attempt to re-establish the connection after a disconnect.
 */
const reconnect = () => {
  connection = null;
  channel = null;
  setTimeout(connectRabbitMQ, 5000);
};

/**
 * Get the current channel (throws if not yet connected).
 */
export const getChannel = () => {
  if (!channel) throw new Error("RabbitMQ channel not initialized. Call connectRabbitMQ() first.");
  return channel;
};

/**
 * Publish a message to a named queue.
 * @param {string} queue - Queue name (e.g., "ORDER_CREATED")
 * @param {object} message - JSON-serializable payload
 */
export const publish = async (queue, message) => {
  const ch = getChannel();
  // Assert the queue exists (idempotent)
  await ch.assertQueue(queue, { durable: true });
  // Send the message as a Buffer
  ch.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
    persistent: true, // Survive RabbitMQ broker restart
  });
  console.log(`Published to [${queue}]:`, message);
};

/**
 * Consume messages from a queue.
 * @param {string} queue - Queue name to listen on
 * @param {function} handler - async function(parsedMessage) called for each message
 */
export const consume = async (queue, handler) => {
  const ch = getChannel();
  await ch.assertQueue(queue, { durable: true });

  // prefetch(1) ensures fair dispatch – only one unacked message per consumer at a time
  ch.prefetch(1);

  console.log(`Listening on queue [${queue}]`);

  ch.consume(queue, async (msg) => {
    if (!msg) return;
    try {
      const content = JSON.parse(msg.content.toString());
      await handler(content);
      // Manually acknowledge after successful processing
      ch.ack(msg);
    } catch (error) {
      console.error(`Error handling message from [${queue}]:`, error.message);
      // Nack without requeue to avoid infinite retry loop
      ch.nack(msg, false, false);
    }
  });
};
