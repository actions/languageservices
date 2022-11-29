// From https://github.com/cschleiden/github-actions-parser/blob/a81dec9b7462dbcff08fbad0792f5ad549d9de7d/src/lib/workflowschema/workflowSchema.ts
interface CacheEntry<T> {
  cachedAt: number;
  content: T;
}

export class TTLCache {
  private cache = new Map<string, CacheEntry<unknown>>();

  constructor(private defaultTTLinMS: number = 10 * 60 * 1000) {}

  /**
   *
   * @param key Key to cache value under
   * @param ttlInMS How long is the content valid. If optional, default value will be used
   * @param getter Function to retrieve content if not in cache
   */
  async get<T>(key: string, ttlInMS: number | undefined, getter: () => Promise<T>): Promise<T> {
    const hasEntry = this.cache.has(key);
    const e = hasEntry && this.cache.get(key);
    if (hasEntry && e && e.cachedAt > Date.now() - (ttlInMS || this.defaultTTLinMS)) {
      return e.content as T;
    }

    try {
      const content = await getter();

      this.cache.set(key, {
        cachedAt: Date.now(),
        content
      });

      return content;
    } catch (e) {
      this.cache.delete(key);
      throw e;
    }
  }
}
