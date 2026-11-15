import { metrics } from './metrics.service.js';
import { logger } from '../../utils/logger.js';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  name: string;
  failureThreshold?: number; // consecutive failures before opening
  cooldownMs?: number; // time to remain open before half-open probe
}

export class CircuitBreakerError extends Error {
  readonly retryAfterSeconds: number;
  readonly providerName: string;

  constructor(providerName: string, retryAfterSeconds: number) {
    super(`${providerName} service is temporarily unavailable due to high error rates. Retry in ${retryAfterSeconds}s.`);
    this.name = 'CircuitBreakerError';
    this.providerName = providerName;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class CircuitBreaker {
  readonly name: string;
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;

  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private nextAttemptTime = 0;

  constructor(options: CircuitBreakerOptions) {
    this.name = options.name;
    this.failureThreshold = options.failureThreshold ?? 5;
    this.cooldownMs = options.cooldownMs ?? 30_000;
  }

  getState(): CircuitState {
    if (this.state === 'OPEN' && Date.now() >= this.nextAttemptTime) {
      this.state = 'HALF_OPEN';
      metrics.updateCircuitState(this.name, 'HALF_OPEN');
      logger.info(`Circuit breaker for ${this.name} entered HALF_OPEN probe state`);
    }
    return this.state;
  }

  async execute<T>(action: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === 'OPEN') {
      const waitSeconds = Math.max(1, Math.ceil((this.nextAttemptTime - Date.now()) / 1000));
      metrics.recordProviderCall(this.name, false);
      throw new CircuitBreakerError(this.name, waitSeconds);
    }

    try {
      const result = await action();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state !== 'CLOSED') {
      logger.info(`Circuit breaker for ${this.name} recovered to CLOSED state`);
    }
    this.failureCount = 0;
    this.state = 'CLOSED';
    metrics.updateCircuitState(this.name, 'CLOSED');
    metrics.recordProviderCall(this.name, true);
  }

  private onFailure(error: unknown): void {
    this.failureCount++;
    metrics.recordProviderCall(this.name, false);

    if (this.state === 'HALF_OPEN' || this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttemptTime = Date.now() + this.cooldownMs;
      metrics.updateCircuitState(this.name, 'OPEN');
      logger.warn(`Circuit breaker for ${this.name} tripped to OPEN state`, {
        failureCount: this.failureCount,
        cooldownMs: this.cooldownMs,
        error: error instanceof Error ? error.message : 'UnknownError',
      });
    }
  }

  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.nextAttemptTime = 0;
    metrics.updateCircuitState(this.name, 'CLOSED');
  }
}
