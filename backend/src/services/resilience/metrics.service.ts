export interface RouteMetric {
  totalRequests: number;
  status2xx: number;
  status4xx: number;
  status429: number;
  status5xx: number;
  totalLatencyMs: number;
  avgLatencyMs: number;
  maxLatencyMs: number;
}

export interface ProviderMetric {
  calls: number;
  successes: number;
  failures: number;
  rateLimitHits: number;
  circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  lastFailureTime?: string;
}

export interface QueueMetric {
  activeWorkers: number;
  maxConcurrency: number;
  queueDepth: number;
  maxQueueDepth: number;
  totalProcessed: number;
  totalRejected: number;
  totalTimedOut: number;
}

export interface MetricsSnapshot {
  timestamp: string;
  uptimeSeconds: number;
  totalRequests: number;
  totalRateLimitBlocks: number;
  routes: Record<string, RouteMetric>;
  queues: Record<string, QueueMetric>;
  providers: Record<string, ProviderMetric>;
}

class MetricsService {
  private startTime = Date.now();
  private totalRequests = 0;
  private totalRateLimitBlocks = 0;

  private routes: Map<string, RouteMetric> = new Map();
  private queues: Map<string, () => QueueMetric> = new Map();
  private providers: Map<string, ProviderMetric> = new Map();

  recordRequest(routeCategory: string, statusCode: number, latencyMs: number): void {
    this.totalRequests++;
    let metric = this.routes.get(routeCategory);
    if (!metric) {
      metric = {
        totalRequests: 0,
        status2xx: 0,
        status4xx: 0,
        status429: 0,
        status5xx: 0,
        totalLatencyMs: 0,
        avgLatencyMs: 0,
        maxLatencyMs: 0,
      };
      this.routes.set(routeCategory, metric);
    }

    metric.totalRequests++;
    if (statusCode >= 200 && statusCode < 300) metric.status2xx++;
    else if (statusCode === 429) {
      metric.status429++;
      this.totalRateLimitBlocks++;
    } else if (statusCode >= 400 && statusCode < 500) metric.status4xx++;
    else if (statusCode >= 500) metric.status5xx++;

    metric.totalLatencyMs += latencyMs;
    metric.avgLatencyMs = Math.round((metric.totalLatencyMs / metric.totalRequests) * 10) / 10;
    if (latencyMs > metric.maxLatencyMs) {
      metric.maxLatencyMs = latencyMs;
    }
  }

  recordRateLimitEvent(routeCategory: string): void {
    this.totalRateLimitBlocks++;
    let metric = this.routes.get(routeCategory);
    if (!metric) {
      metric = {
        totalRequests: 0,
        status2xx: 0,
        status4xx: 0,
        status429: 0,
        status5xx: 0,
        totalLatencyMs: 0,
        avgLatencyMs: 0,
        maxLatencyMs: 0,
      };
      this.routes.set(routeCategory, metric);
    }
    metric.status429++;
  }

  registerQueue(name: string, getter: () => QueueMetric): void {
    this.queues.set(name, getter);
  }

  recordProviderCall(name: string, success: boolean, isRateLimit = false): void {
    let metric = this.providers.get(name);
    if (!metric) {
      metric = {
        calls: 0,
        successes: 0,
        failures: 0,
        rateLimitHits: 0,
        circuitState: 'CLOSED',
      };
      this.providers.set(name, metric);
    }

    metric.calls++;
    if (success) {
      metric.successes++;
    } else {
      metric.failures++;
      metric.lastFailureTime = new Date().toISOString();
      if (isRateLimit) {
        metric.rateLimitHits++;
      }
    }
  }

  updateCircuitState(providerName: string, state: 'CLOSED' | 'OPEN' | 'HALF_OPEN'): void {
    let metric = this.providers.get(providerName);
    if (!metric) {
      metric = {
        calls: 0,
        successes: 0,
        failures: 0,
        rateLimitHits: 0,
        circuitState: state,
      };
      this.providers.set(providerName, metric);
    } else {
      metric.circuitState = state;
    }
  }

  getMetricsSnapshot(): MetricsSnapshot {
    const queueSnapshots: Record<string, QueueMetric> = {};
    for (const [name, getter] of this.queues.entries()) {
      queueSnapshots[name] = getter();
    }

    const routeSnapshots: Record<string, RouteMetric> = {};
    for (const [name, metric] of this.routes.entries()) {
      routeSnapshots[name] = { ...metric };
    }

    const providerSnapshots: Record<string, ProviderMetric> = {};
    for (const [name, metric] of this.providers.entries()) {
      providerSnapshots[name] = { ...metric };
    }

    return {
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      totalRequests: this.totalRequests,
      totalRateLimitBlocks: this.totalRateLimitBlocks,
      routes: routeSnapshots,
      queues: queueSnapshots,
      providers: providerSnapshots,
    };
  }

  reset(): void {
    this.startTime = Date.now();
    this.totalRequests = 0;
    this.totalRateLimitBlocks = 0;
    this.routes.clear();
    this.providers.clear();
  }
}

export const metrics = new MetricsService();
