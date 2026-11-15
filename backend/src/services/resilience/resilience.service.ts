import { CircuitBreaker } from './circuit-breaker.js';
import { RequestQueue } from './concurrency-queue.js';
import { virusTotalQuota, geminiQuota } from './external-quota.js';
import { metrics } from './metrics.service.js';

export const assistantQueue = new RequestQueue({
  name: 'AI Assistant',
  concurrency: 5,
  maxQueueSize: 25,
  timeoutMs: 20_000,
});

export const scannerQueue = new RequestQueue({
  name: 'Scanner Analysis',
  concurrency: 10,
  maxQueueSize: 30,
  timeoutMs: 15_000,
});

export const tutorQueue = new RequestQueue({
  name: 'AI Tutor',
  concurrency: 5,
  maxQueueSize: 25,
  timeoutMs: 20_000,
});

export const investigationQueue = new RequestQueue({
  name: 'Investigation Evidence',
  concurrency: 4,
  maxQueueSize: 20,
  timeoutMs: 20_000,
});

export const apkAnalysisQueue = new RequestQueue({
  name: 'APK Analysis',
  concurrency: 3,
  maxQueueSize: 15,
  timeoutMs: 25_000,
});

export const callAnalysisQueue = new RequestQueue({
  name: 'Call Analysis',
  concurrency: 5,
  maxQueueSize: 25,
  timeoutMs: 20_000,
});

export const geminiCircuitBreaker = new CircuitBreaker({
  name: 'Gemini',
  failureThreshold: 5,
  cooldownMs: 30_000,
});

export const virusTotalCircuitBreaker = new CircuitBreaker({
  name: 'VirusTotal',
  failureThreshold: 4,
  cooldownMs: 45_000,
});

export { virusTotalQuota, geminiQuota, metrics };
