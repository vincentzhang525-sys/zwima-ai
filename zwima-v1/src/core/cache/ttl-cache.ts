export type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export class TtlCache<T> {
  private store = new Map<string, CacheEntry<T>>();

  constructor(private readonly defaultTtlMs: number) {}

  set(key: string, value: T, ttlMs = this.defaultTtlMs): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  getOrSet(key: string, factory: () => T | Promise<T>, ttlMs = this.defaultTtlMs): T | Promise<T> {
    const hit = this.get(key);
    if (hit !== undefined) return hit;
    const value = factory();
    if (value instanceof Promise) {
      return value.then((v) => {
        this.set(key, v, ttlMs);
        return v;
      });
    }
    this.set(key, value, ttlMs);
    return value;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    this.prune();
    return this.store.size;
  }

  private prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) this.store.delete(key);
    }
  }
}
