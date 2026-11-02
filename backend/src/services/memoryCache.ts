type CacheEntry<T> = { expiresAt: number; value: T };

export class MemoryCache {
  private entries = new Map<string, CacheEntry<unknown>>();
  private pending = new Map<string, Promise<unknown>>();

  constructor(private readonly maxEntries = 500) {}

  get<T>(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlSeconds: number): T {
    this.entries.delete(key);
    for (const [storedKey, entry] of this.entries) {
      if (entry.expiresAt <= Date.now()) this.entries.delete(storedKey);
    }
    if (this.entries.size >= this.maxEntries) this.entries.delete(this.entries.keys().next().value!);
    this.entries.set(key, {
      expiresAt: Date.now() + Math.max(1, ttlSeconds) * 1000,
      value,
    });
    return value;
  }

  getOrLoad<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) return Promise.resolve(cached);
    const existing = this.pending.get(key);
    if (existing) return existing as Promise<T>;
    const pending = Promise.resolve().then(loader).then((value) => this.set(key, value, ttlSeconds)).finally(() => this.pending.delete(key));
    this.pending.set(key, pending);
    return pending;
  }
}
