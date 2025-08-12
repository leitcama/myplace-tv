export type LruEntry<V> = { value: V; expiresAt: number };

export default class LruCache<K, V> {
  private maxEntries: number;
  private defaultTtlMs: number;
  private map: Map<K, LruEntry<V>>;

  constructor(maxEntries = 64, defaultTtlMs = 5 * 60 * 1000) {
    this.maxEntries = maxEntries;
    this.defaultTtlMs = defaultTtlMs;
    this.map = new Map();
  }

  get(key: K): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return undefined;
    }
    // refresh LRU order
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V, ttlMs?: number): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs) });
    if (this.map.size > this.maxEntries) {
      // evict least-recently-used (first item in Map)
      const firstKey = this.map.keys().next().value;
      if (firstKey !== undefined) this.map.delete(firstKey);
    }
  }

  delete(key: K): void { this.map.delete(key); }
  clear(): void { this.map.clear(); }
}