import { LRUCache } from 'lru-cache';

// Cache configuration
const CACHE_TTL = {
  PLAYER_RESPONSE: 5 * 60 * 1000, // 5 minutes
  RESOLVE_OUTCOME: 4 * 60 * 1000, // 4 minutes (slightly less than typical expiry)
  DECIPHER_CONTEXT: 10 * 60 * 1000, // 10 minutes
};

// In-memory LRU cache for development
const lruCache = new LRUCache<string, any>({
  max: 1000, // Maximum number of items
  ttl: CACHE_TTL.PLAYER_RESPONSE,
  updateAgeOnGet: true,
});

// Cache key generators
export function cacheKey(type: 'playerResponse' | 'resolveOutcome' | 'decipherContext' | 'prefetch', videoId: string, clientProfile?: string, region?: string) {
  const parts = [type, videoId];
  if (clientProfile) parts.push(clientProfile);
  if (region) parts.push(region);
  return parts.join(':');
}

// Cache interface
export interface CacheInterface {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

// LRU Cache implementation
class LRUCacheAdapter implements CacheInterface {
  async get<T>(key: string): Promise<T | null> {
    return lruCache.get(key) || null;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    lruCache.set(key, value, { ttl });
  }

  async delete(key: string): Promise<void> {
    lruCache.delete(key);
  }

  async clear(): Promise<void> {
    lruCache.clear();
  }
}

// Redis Cache implementation (for production)
class RedisCacheAdapter implements CacheInterface {
  private redis: any;

  constructor() {
    // This would be initialized with your Redis client
    // For now, we'll use LRU as fallback
    this.redis = null;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.redis) return null;
    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.setex(key, Math.floor((ttl || CACHE_TTL.PLAYER_RESPONSE) / 1000), JSON.stringify(value));
    } catch {
      // Silently fail
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.del(key);
    } catch {
      // Silently fail
    }
  }

  async clear(): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.flushdb();
    } catch {
      // Silently fail
    }
  }
}

// Export the appropriate cache implementation
export const cache: CacheInterface = process.env.NODE_ENV === 'production' 
  ? new RedisCacheAdapter() 
  : new LRUCacheAdapter();

// Structured logging with correlation IDs
export interface LogContext {
  correlationId: string;
  videoId: string;
  tier?: string;
  clientProfile?: string;
  region?: string;
  operation: string;
}

export function generateCorrelationId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function logWithContext(level: 'info' | 'warn' | 'error', message: string, context: LogContext, data?: any) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
    ...(data && { data }),
  };
  
  console[level](JSON.stringify(logEntry));
}

// Cache metrics
export interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
}

const metrics: CacheMetrics = {
  hits: 0,
  misses: 0,
  sets: 0,
  deletes: 0,
};

export function getCacheMetrics(): CacheMetrics {
  return { ...metrics };
}

export function incrementCacheMetric(type: keyof CacheMetrics) {
  metrics[type]++;
}