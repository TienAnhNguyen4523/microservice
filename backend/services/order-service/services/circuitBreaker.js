/**
 * Simple Circuit Breaker implementation for external calls.
 * States:
 * - CLOSED: Calls go through. If failures reach threshold, go to OPEN.
 * - OPEN: Calls immediately throw an error. After timeout, go to HALF_OPEN.
 * - HALF_OPEN: Next call determines state. If success -> CLOSED. If fail -> OPEN.
 */
class CircuitBreaker {
  constructor(action, failureThreshold = 3, resetTimeout = 10000) {
    this.action = action;
    this.failureThreshold = failureThreshold;
    this.resetTimeout = resetTimeout;
    
    this.state = "CLOSED";
    this.failures = 0;
    this.nextAttempt = Date.now();
  }

  async fire(...args) {
    if (this.state === "OPEN") {
      if (this.nextAttempt <= Date.now()) {
        this.state = "HALF_OPEN";
        console.log("[Circuit Breaker] State changed to HALF_OPEN");
      } else {
        throw new Error("Circuit Breaker OPEN - Bank API is currently unreachable.");
      }
    }

    try {
      const result = await this.action(...args);
      return this.onSuccess(result);
    } catch (err) {
      return this.onFailure(err);
    }
  }

  onSuccess(result) {
    if (this.state === "HALF_OPEN") {
       this.state = "CLOSED";
       console.log("[Circuit Breaker] State recovered to CLOSED");
    }
    this.failures = 0;
    return result;
  }

  onFailure(err) {
    this.failures++;
    console.error(`[Circuit Breaker] Check failed. Failures: ${this.failures}`);
    
    if (this.failures >= this.failureThreshold) {
      this.state = "OPEN";
      this.nextAttempt = Date.now() + this.resetTimeout;
      console.warn(`[Circuit Breaker] Threshold reached. State changed to OPEN for ${this.resetTimeout / 1000}s`);
    }
    
    throw err;
  }
}

// Giả lập Bank API Check (Có tỷ lệ fail ngẫu nhiên nho nhỏ khoảng 10%)
const simulatedBankCheck = async (paymentMethod, totalAmount) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // 10% cơ hội lỗi mạng khi gọi bank, hoặc logic bank bị từ chối
      if (Math.random() < 0.1) {
         reject(new Error("Bank connection timeout or rejected"));
      } else {
         resolve({ success: true, transactionId: "TXN" + Date.now() });
      }
    }, 500);
  });
};

export const bankApiBreaker = new CircuitBreaker(simulatedBankCheck, 3, 15000);
