/**
 * Cache storage med localStorage och in-memory fallback
 * Hanterar edge case när localStorage inte finns (PWA/privatläge)
 */

interface CacheEntry {
  value: any;
  timestamp: number;
  etag?: string;
}

// In-memory fallback
const memoryCache = new Map<string, CacheEntry>();

class CacheStorage {
  private useMemory: boolean = false;

  constructor() {
    // Testa om localStorage finns och fungerar
    try {
      const testKey = '__cache_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      this.useMemory = false;
    } catch (e) {
      console.warn('localStorage not available, using in-memory cache');
      this.useMemory = true;
    }
  }

  /**
   * Hämta värde från cache
   */
  get(key: string): any | null {
    try {
      if (this.useMemory) {
        const entry = memoryCache.get(key);
        return entry ? entry.value : null;
      }

      const item = localStorage.getItem(key);
      if (!item) return null;

      const entry: CacheEntry = JSON.parse(item);
      return entry.value;
    } catch (e) {
      console.error('Cache get error:', e);
      return null;
    }
  }

  /**
   * Spara värde i cache med TTL
   */
  set(key: string, value: any, _ttl?: number, etag?: string): void {
    try {
      const entry: CacheEntry = {
        value,
        timestamp: Date.now(),
        etag
      };

      if (this.useMemory) {
        memoryCache.set(key, entry);
        return;
      }

      localStorage.setItem(key, JSON.stringify(entry));
    } catch (e) {
      // Quota exceeded eller annat fel - försök med memory fallback
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        console.warn('localStorage quota exceeded, falling back to memory');
        this.useMemory = true;
        memoryCache.set(key, { value, timestamp: Date.now(), etag });
      } else {
        console.error('Cache set error:', e);
      }
    }
  }

  /**
   * Kontrollera om nyckel finns och är färsk
   */
  has(key: string, maxAge?: number): boolean {
    try {
      if (this.useMemory) {
        const entry = memoryCache.get(key);
        if (!entry) return false;
        if (maxAge && Date.now() - entry.timestamp > maxAge) {
          memoryCache.delete(key);
          return false;
        }
        return true;
      }

      const item = localStorage.getItem(key);
      if (!item) return false;

      const entry: CacheEntry = JSON.parse(item);
      if (maxAge && Date.now() - entry.timestamp > maxAge) {
        localStorage.removeItem(key);
        return false;
      }

      return true;
    } catch (e) {
      console.error('Cache has error:', e);
      return false;
    }
  }

  /**
   * Hämta ETag för en cache-nyckel
   */
  getETag(key: string): string | null {
    try {
      if (this.useMemory) {
        const entry = memoryCache.get(key);
        return entry?.etag || null;
      }

      const item = localStorage.getItem(key);
      if (!item) return null;

      const entry: CacheEntry = JSON.parse(item);
      return entry.etag || null;
    } catch (e) {
      console.error('Cache getETag error:', e);
      return null;
    }
  }

  /**
   * Ta bort från cache
   */
  remove(key: string): void {
    try {
      if (this.useMemory) {
        memoryCache.delete(key);
        return;
      }
      localStorage.removeItem(key);
    } catch (e) {
      console.error('Cache remove error:', e);
    }
  }

  /**
   * Rensa all cache
   */
  clear(): void {
    try {
      if (this.useMemory) {
        memoryCache.clear();
        return;
      }
      // Ta bara bort cache-relaterade nycklar
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('forecast_cache_') || key.startsWith('smhi_') || key.startsWith('met_norway_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.error('Cache clear error:', e);
    }
  }
}

// Singleton instance
export const cacheStorage = new CacheStorage();

