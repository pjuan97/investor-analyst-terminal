import { ProviderResponse } from '@/types';

// ============================================================================
// RATE LIMITER
// ============================================================================

export class RateLimiter {
  private queue: Array<() => void> = [];
  private lastRequest = 0;
  private processing = false;

  constructor(private requestsPerSecond: number) {}

  async acquire(): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push(resolve);
      this.processQueue();
    });
  }

  private processQueue(): void {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    const minInterval = 1000 / this.requestsPerSecond;
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;

    if (timeSinceLastRequest >= minInterval) {
      this.executeNext();
    } else {
      setTimeout(() => this.executeNext(), minInterval - timeSinceLastRequest);
    }
  }

  private executeNext(): void {
    const resolve = this.queue.shift();
    if (resolve) {
      this.lastRequest = Date.now();
      resolve();
    }
    this.processing = false;
    if (this.queue.length > 0) {
      this.processQueue();
    }
  }
}

// ============================================================================
// RETRY LOGIC
// ============================================================================

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error | null = null;
  let delay = config.initialDelayMs;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === config.maxRetries) {
        break;
      }

      // Check if error is retryable
      if (!isRetryableError(error)) {
        throw lastError;
      }

      console.warn(
        `Attempt ${attempt + 1} failed, retrying in ${delay}ms:`,
        lastError.message
      );

      await sleep(delay);
      delay = Math.min(delay * config.backoffMultiplier, config.maxDelayMs);
    }
  }

  throw lastError;
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    // Rate limit errors
    if (error.message.includes('429') || error.message.includes('rate limit')) {
      return true;
    }
    // Network errors
    if (
      error.message.includes('ECONNRESET') ||
      error.message.includes('ETIMEDOUT') ||
      error.message.includes('fetch failed')
    ) {
      return true;
    }
    // Server errors (5xx)
    if (/5\d{2}/.test(error.message)) {
      return true;
    }
  }
  return false;
}

// ============================================================================
// UTILITIES
// ============================================================================

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createErrorResponse<T>(
  error: unknown,
  warnings?: string[]
): ProviderResponse<T> {
  const errorMessage =
    error instanceof Error ? error.message : 'Unknown error occurred';
  return {
    success: false,
    data: null,
    error: errorMessage,
    warnings,
  };
}

export function createSuccessResponse<T>(
  data: T,
  rawDocument?: { url: string; payload: unknown },
  warnings?: string[]
): ProviderResponse<T> {
  return {
    success: true,
    data,
    rawDocument,
    warnings,
  };
}

// ============================================================================
// CACHE
// ============================================================================

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set<T>(key: string, data: T, ttlSeconds: number): void {
    // LRU eviction if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Singleton cache instance
export const globalCache = new MemoryCache();
