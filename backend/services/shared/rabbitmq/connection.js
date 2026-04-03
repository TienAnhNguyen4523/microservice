/**
 * Shared RabbitMQ connection module.
 * Provides a singleton channel and helper functions for publishing/consuming messages.
 * All services import from this module to reuse the same connection logic.
 */

import amqplib from "amqplib";

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://localhost";

let connection = null;
let pubChannel = null;
let subChannel = null;
let isConnecting = false;

/**
 * Connect to RabbitMQ and create channels.
 * Retries every 5 seconds if connection fails (e.g., RabbitMQ not yet ready).
 */
export const connectRabbitMQ = async () => {
  if (isConnecting) return;
  isConnecting = true;

  try {
    connection = await amqplib.connect(RABBITMQ_URL);
    pubChannel = await connection.createConfirmChannel();
    subChannel = await connection.createChannel();
    console.log("Connected to RabbitMQ");
    isConnecting = false;

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
    isConnecting = false;
    setTimeout(connectRabbitMQ, 5000);
  }
};

/**
 * Attempt to re-establish the connection after a disconnect.
 */
const reconnect = () => {
  if (isConnecting) return;
  connection = null;
  pubChannel = null;
  subChannel = null;
  setTimeout(connectRabbitMQ, 5000);
};

/**
 * Get the publish channel (throws if not yet connected).
 */
export const getPubChannel = () => {
  if (!pubChannel) throw new Error("RabbitMQ pubChannel not initialized. Call connectRabbitMQ() first.");
  return pubChannel;
};

/**
 * Get the subscribe channel (throws if not yet connected).
 */
export const getSubChannel = () => {
  if (!subChannel) throw new Error("RabbitMQ subChannel not initialized. Call connectRabbitMQ() first.");
  return subChannel;
};

const EXCHANGE_NAME = "ecommerce_topic_exchange";

/**
 * Publish a message to a topic exchange.
 * @param {string} routingKey - Routing key (e.g., "order.created")
 * @param {object} message - JSON-serializable payload
 */
export const publish = async (routingKey, message) => {
  const ch = getPubChannel();
  
  // Assert the topic exchange exists
  await ch.assertExchange(EXCHANGE_NAME, "topic", { durable: true });

  // Send the message to the exchange, wait for confirm
  return new Promise((resolve, reject) => {
    ch.publish(
      EXCHANGE_NAME, 
      routingKey, 
      Buffer.from(JSON.stringify(message)), 
      { persistent: true }, 
      (err, ok) => {
        if (err !== null) {
          console.warn(`Message nacked by broker: ${err}`);
          reject(err);
        } else {
          console.log(`Published to Exchange [${EXCHANGE_NAME}] with key [${routingKey}]:`, message);
          resolve(ok);
        }
    });
  });
};

/**
 * Consume messages from a topic exchange.
 * @param {string} routingKey - The routing key to bind to (e.g., "order.created" or "order.#")
 * @param {string} queueName - Specific queue name for this service (e.g., "inventory_service_queue")
 * @param {function} handler - async function(parsedMessage) called for each message
 */
export const consume = async (routingKey, queueName, handler) => {
  const ch = getSubChannel();
  
  // Assert the topic exchange exists
  await ch.assertExchange(EXCHANGE_NAME, "topic", { durable: true });

  // Assert the specific queue for this consumer service
  await ch.assertQueue(queueName, { durable: true });

  // Bind the queue to the exchange with the given routingKey
  await ch.bindQueue(queueName, EXCHANGE_NAME, routingKey);

  // prefetch(1) ensures fair dispatch – only one unacked message per consumer at a time
  ch.prefetch(1);

  console.log(`Listening on Queue [${queueName}] with Routing Key [${routingKey}]`);

  ch.consume(
    queueName,
    async (msg) => {
      if (!msg) return;
      try {
        const content = JSON.parse(msg.content.toString());
        await handler(content);
        // Manually acknowledge after successful processing
        ch.ack(msg);
      } catch (error) {
        console.error(`Error handling message from Queue [${queueName}]:`, error.message);
        // Nack without requeue to avoid infinite retry loop
        ch.nack(msg, false, false);
      }
    },
    { noAck: false } // Explicitly state manual ACK is required
  );
};
