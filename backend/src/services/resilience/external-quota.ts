import { metrics } from './metrics.service.js';
import { logger } from '../../utils/logger.js';

export class ProviderQuotaError extends Error {
  readonly providerName: string;
  readonly retryAfterSeconds: number;

  constructor(providerName: string, retryAfterSeconds: number) {
    super(`External provider [${providerName}] request quota reached. Please retry in ${retryAfterSeconds} seconds.`);
    this.name = 'ProviderQuotaError';
    this.providerName = providerName;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export interface TokenBucketOptions {
  providerName: string;
  maxTokens: number;
  refillRatePerMinute: number;
}

export class TokenBucketQuota {
  readonly providerName: string;
  private readonly maxTokens: number;
  private readonly refillIntervalMs: number;

  private tokens: number;
  private lastRefillTime: number;

  constructor(options: TokenBucketOptions) {
    this.providerName = options.providerName;
    this.maxTokens = options.maxTokens;
    this.tokens = options.maxTokens;
    this.refillIntervalMs = (60 * 1000) / options.refillRatePerMinute;
    this.lastRefillTime = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefillTime;
    const tokensToAdd = Math.floor(elapsed / this.refillIntervalMs);
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
      this.lastRefillTime = now - (elapsed % this.refillIntervalMs);
    }
  }

  tryAcquire(): boolean {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    const waitSeconds = Math.max(1, Math.ceil((this.refillIntervalMs - (Date.now() - this.lastRefillTime)) / 1000));
    metrics.recordProviderCall(this.providerName, false, true);
    logger.warn(`External quota exhausted for provider ${this.providerName}. Retry after ${waitSeconds}s`);
    return false;
  }

  acquireOrThrow(): void {
    if (!this.tryAcquire()) {
      const waitSeconds = Math.max(1, Math.ceil((this.refillIntervalMs - (Date.now() - this.lastRefillTime)) / 1000));
      throw new ProviderQuotaError(this.providerName, waitSeconds);
    }
  }

  markExhausted(cooldownSeconds = 60): void {
    this.tokens = 0;
    this.lastRefillTime = Date.now() + (cooldownSeconds * 1000) - this.refillIntervalMs;
    metrics.recordProviderCall(this.providerName, false, true);
  }

  getAvailableTokens(): number {
    this.refill();
    return this.tokens;
  }

  reset(): void {
    this.tokens = this.maxTokens;
    this.lastRefillTime = Date.now();
  }
}

// VirusTotal free tier is strictly 4 requests per minute
export const virusTotalQuota = new TokenBucketQuota({
  providerName: 'VirusTotal',
  maxTokens: 4,
  refillRatePerMinute: 4,
});

// Gemini AI calls token bucket (e.g. 30 requests per minute capacity safeguard)
export const geminiQuota = new TokenBucketQuota({
  providerName: 'Gemini',
  maxTokens: 30,
  refillRatePerMinute: 30,
});
