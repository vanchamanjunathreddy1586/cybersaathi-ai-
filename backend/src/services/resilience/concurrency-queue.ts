import { metrics, type QueueMetric } from './metrics.service.js';
import { logger } from '../../utils/logger.js';

export class QueueCapacityError extends Error {
  readonly retryAfterSeconds: number;
  readonly queueName: string;

  constructor(queueName: string, retryAfterSeconds = 5) {
    super(`The ${queueName} service is operating at full capacity. Please wait a few seconds and try again.`);
    this.name = 'QueueCapacityError';
    this.queueName = queueName;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class QueueTimeoutError extends Error {
  readonly retryAfterSeconds: number;
  readonly queueName: string;

  constructor(queueName: string, retryAfterSeconds = 10) {
    super(`Request to ${queueName} timed out waiting in queue. Please retry.`);
    this.name = 'QueueTimeoutError';
    this.queueName = queueName;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export interface RequestQueueOptions {
  name: string;
  concurrency: number;
  maxQueueSize?: number;
  timeoutMs?: number;
}

interface QueuedItem<T> {
  task: () => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
  enqueueTime: number;
  timer: NodeJS.Timeout;
}

export class RequestQueue {
  readonly name: string;
  private readonly concurrency: number;
  private readonly maxQueueSize: number;
  private readonly timeoutMs: number;

  private activeWorkers = 0;
  private queue: Array<QueuedItem<unknown>> = [];
  private maxObservedQueueDepth = 0;
  private totalProcessed = 0;
  private totalRejected = 0;
  private totalTimedOut = 0;

  constructor(options: RequestQueueOptions) {
    this.name = options.name;
    this.concurrency = Math.max(1, options.concurrency);
    this.maxQueueSize = options.maxQueueSize ?? 25;
    this.timeoutMs = options.timeoutMs ?? 15_000;

    metrics.registerQueue(this.name, () => this.getMetrics());
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.activeWorkers < this.concurrency) {
      this.activeWorkers++;
      return this.executeTask(task);
    }

    if (this.queue.length >= this.maxQueueSize) {
      this.totalRejected++;
      logger.warn(`Request queue [${this.name}] rejected request: capacity exceeded (${this.queue.length}/${this.maxQueueSize})`);
      throw new QueueCapacityError(this.name, 5);
    }

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        const index = this.queue.findIndex((item) => item.resolve === (resolve as unknown));
        if (index !== -1) {
          this.queue.splice(index, 1);
          this.totalTimedOut++;
          logger.warn(`Request queue [${this.name}] timed out after waiting ${this.timeoutMs}ms in queue`);
          reject(new QueueTimeoutError(this.name, 10));
        }
      }, this.timeoutMs);

      this.queue.push({
        task: task as () => Promise<unknown>,
        resolve: resolve as (val: unknown) => void,
        reject,
        enqueueTime: Date.now(),
        timer,
      });

      if (this.queue.length > this.maxObservedQueueDepth) {
        this.maxObservedQueueDepth = this.queue.length;
      }
    });
  }

  private async executeTask<T>(task: () => Promise<T>): Promise<T> {
    try {
      this.totalProcessed++;
      return await task();
    } finally {
      this.activeWorkers--;
      this.processNext();
    }
  }

  private processNext(): void {
    if (this.activeWorkers >= this.concurrency || this.queue.length === 0) {
      return;
    }

    const next = this.queue.shift();
    if (!next) return;

    clearTimeout(next.timer);
    this.activeWorkers++;

    next.task()
      .then((val) => {
        next.resolve(val);
      })
      .catch((err) => {
        next.reject(err);
      })
      .finally(() => {
        this.activeWorkers--;
        this.processNext();
      });
  }

  getMetrics(): QueueMetric {
    return {
      activeWorkers: this.activeWorkers,
      maxConcurrency: this.concurrency,
      queueDepth: this.queue.length,
      maxQueueDepth: this.maxObservedQueueDepth,
      totalProcessed: this.totalProcessed,
      totalRejected: this.totalRejected,
      totalTimedOut: this.totalTimedOut,
    };
  }

  reset(): void {
    for (const item of this.queue) {
      clearTimeout(item.timer);
      item.reject(new QueueCapacityError(this.name, 1));
    }
    this.queue = [];
    this.activeWorkers = 0;
    this.maxObservedQueueDepth = 0;
    this.totalProcessed = 0;
    this.totalRejected = 0;
    this.totalTimedOut = 0;
  }
}
