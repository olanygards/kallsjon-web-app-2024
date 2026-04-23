import { useRef } from 'react';
import { format, startOfMonth, differenceInDays } from 'date-fns';
import LZString from 'lz-string';

// Per-month cache entry for observations or stats
interface MonthCacheEntry<T> {
  data: T[];
  timestamp: number;
  month: string;        // "2025-11"
  minForce: number;     // 0 for complete data, >0 for filtered
  permanent: boolean;   // true for data >7 days old
}

// Helper function to revive dates in objects
function reviveDates<T>(obj: any): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => reviveDates(item)) as unknown as T;
  }

  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      result[key] = new Date(value);
    } else if (typeof value === 'object') {
      result[key] = reviveDates(value);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

interface WindCacheOptions {
  currentMonthTTL?: number;     // TTL for current month (default: 5 min)
  previousMonthTTL?: number;    // TTL for previous month (default: 30 min)
  permanentDataAgeDays?: number; // Days after which data becomes permanent (default: 7)
}

export function useWindCache<T>(
  options: WindCacheOptions = {}
) {
  const {
    currentMonthTTL = 30 * 1000,            // 30 sec (for real-time Overview data)
    previousMonthTTL = 30 * 60 * 1000,      // 30 min
    permanentDataAgeDays = 7
  } = options;

  const currentMonthTTLRef = useRef(currentMonthTTL);
  const previousMonthTTLRef = useRef(previousMonthTTL);
  const permanentDataAgeDaysRef = useRef(permanentDataAgeDays);

  /**
   * Generate cache key for a month
   * Format: obs:2025-11 (observations) or stats:2025-11-minForce10 (stats)
   */
  const getMonthKey = (date: Date, minForce: number = 0): string => {
    const month = format(date, 'yyyy-MM');
    if (minForce > 0) {
      return `stats:${month}-minForce${minForce}`;
    }
    return `obs:${month}`;
  };

  /**
   * Calculate TTL for a month based on its age
   * - Current month: 5-10 min
   * - Previous month: 30 min
   * - Older than 7 days: permanent (Infinity)
   */
  const getMonthTTL = (date: Date): number => {
    const now = new Date();
    const monthStart = startOfMonth(date);
    const currentMonthStart = startOfMonth(now);

    // Calculate how many days ago this month started
    const daysDiff = differenceInDays(currentMonthStart, monthStart);

    // Current month (0 days diff)
    if (daysDiff === 0) {
      return currentMonthTTLRef.current;
    }

    // Previous month (roughly 30 days diff, but can vary)
    if (daysDiff <= 31) {
      return previousMonthTTLRef.current;
    }

    // Older months: permanent cache
    return Infinity;
  };

  /**
   * Helper to read and parse a cache entry (handling compression)
   */
  const readCacheEntry = (key: string): MonthCacheEntry<T> | null => {
    try {
      const storedItem = localStorage.getItem(key);
      if (!storedItem) return null;

      // Try to decompress first
      if (!storedItem.trim().startsWith('{')) {
        const decompressed = LZString.decompressFromUTF16(storedItem);
        if (decompressed) {
          return JSON.parse(decompressed);
        }
        // Fallback: try parsing directly (maybe legacy uncompressed)
        return JSON.parse(storedItem);
      }

      // Legacy uncompressed data
      return JSON.parse(storedItem);
    } catch (error) {
      return null;
    }
  };

  /**
   * Get stored data for a specific month from localStorage
   */
  const getStoredDataForMonth = (date: Date, minForce: number = 0): T[] => {
    try {
      const monthKey = getMonthKey(date, minForce);
      const cacheEntry = readCacheEntry(monthKey);

      if (!cacheEntry) return [];

      const { data, timestamp, permanent } = cacheEntry;

      // If permanent cache, never expire
      if (permanent) {
        return reviveDates<T[]>(data);
      }

      // Check if cache has expired based on month age
      const ttl = getMonthTTL(date);
      if (ttl !== Infinity && Date.now() - timestamp > ttl) {
        localStorage.removeItem(monthKey);
        return [];
      }

      return reviveDates<T[]>(data);
    } catch (error) {
      console.error('Error reading month cache:', error);
      // If error reading, clear it
      const monthKey = getMonthKey(date, minForce);
      localStorage.removeItem(monthKey);
      return [];
    }
  };

  /**
   * Store data for a specific month in localStorage
   */
  const setStoredDataForMonth = (date: Date, data: T[], minForce: number = 0): void => {
    try {
      const monthKey = getMonthKey(date, minForce);
      const monthStart = startOfMonth(date);
      const now = new Date();

      // Determine if this data should be permanent
      // It should only be permanent if it's NOT the current month AND it's old enough
      const currentMonthStart = startOfMonth(now);
      const isCurrentMonth = currentMonthStart.getTime() === monthStart.getTime();
      const daysSinceMonthStart = differenceInDays(now, monthStart);

      const isPermanent = !isCurrentMonth && daysSinceMonthStart > permanentDataAgeDaysRef.current;

      const cacheEntry: MonthCacheEntry<T> = {
        data,
        timestamp: Date.now(),
        month: format(date, 'yyyy-MM'),
        minForce,
        permanent: isPermanent
      };

      const jsonString = JSON.stringify(cacheEntry, (_k, value) => {
        if (value instanceof Date) {
          return value.toISOString();
        }
        return value;
      });

      // Compress the data
      const compressed = LZString.compressToUTF16(jsonString);

      localStorage.setItem(monthKey, compressed);
    } catch (error) {
      console.error('Error saving month cache:', error);
      // If quota exceeded, try aggressive cleanup
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn('localStorage quota exceeded, attempting aggressive cleanup');

        // Strategy 1: Remove all non-permanent caches
        clearNonPermanentCaches();

        // Strategy 2: If still not enough, remove oldest permanent caches
        // Keep only last 6 months of permanent data
        clearOldestCaches(6);

        // Retry once after cleanup
        try {
          const monthKey = getMonthKey(date, minForce);
          const cacheEntry: MonthCacheEntry<T> = {
            data,
            timestamp: Date.now(),
            month: format(date, 'yyyy-MM'),
            minForce,
            permanent: false // Don't make it permanent if we're struggling with space
          };

          const jsonString = JSON.stringify(cacheEntry, (_k, value) => {
            if (value instanceof Date) {
              return value.toISOString();
            }
            return value;
          });

          const compressed = LZString.compressToUTF16(jsonString);

          localStorage.setItem(monthKey, compressed);
          console.log('Successfully saved after cleanup');
        } catch (retryError) {
          console.error('Failed to save cache even after cleanup, falling back to in-memory only');
          // Silently fail - data will still work, just no localStorage persistence
        }
      }
    }
  };

  /**
   * Check if data for a specific month is fresh (in cache and not expired)
   */
  const isMonthDataFresh = (date: Date, minForce: number = 0): boolean => {
    try {
      const monthKey = getMonthKey(date, minForce);
      const cacheEntry = readCacheEntry(monthKey);

      if (!cacheEntry) return false;

      const { timestamp, permanent } = cacheEntry;

      // Permanent cache is always fresh
      // BUT: If it's the current month, it should NEVER be treated as permanent (fix for bug where current month got marked permanent)
      const currentMonthStart = startOfMonth(new Date());
      const entryMonthStart = startOfMonth(date);
      const isCurrentMonth = currentMonthStart.getTime() === entryMonthStart.getTime();

      if (permanent && !isCurrentMonth) return true;

      // Check TTL
      const ttl = getMonthTTL(date);
      if (ttl === Infinity) return true;

      return Date.now() - timestamp < ttl;
    } catch (error) {
      console.error('Error checking month cache freshness:', error);
      return false;
    }
  };

  /**
   * Clear cache for a specific month
   */
  const clearCacheForMonth = (date: Date, minForce: number = 0): void => {
    const monthKey = getMonthKey(date, minForce);
    localStorage.removeItem(monthKey);
  };

  /**
   * Clear all cached data (both obs: and stats: prefixes)
   */
  const clearAllCache = (): void => {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('obs:') || key?.startsWith('stats:')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  };

  /**
   * Clear all non-permanent caches to free up space
   */
  const clearNonPermanentCaches = (): void => {
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith('obs:') && !key?.startsWith('stats:')) continue;

      const cacheEntry = readCacheEntry(key);
      if (!cacheEntry) continue;

      // Remove all non-permanent caches
      if (!cacheEntry.permanent) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`Cleared ${keysToRemove.length} non-permanent cache entries`);
  };

  /**
   * Clear oldest caches, keeping only the most recent N months
   * @param keepMonths - Number of most recent months to keep
   */
  const clearOldestCaches = (keepMonths: number = 6): void => {
    interface CacheInfo {
      key: string;
      month: string;
      timestamp: number;
    }

    const allCaches: CacheInfo[] = [];

    // Collect all cache entries with their dates
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith('obs:') && !key?.startsWith('stats:')) continue;

      const cacheEntry = readCacheEntry(key);
      if (!cacheEntry) {
        // If corrupted, add to list for removal
        allCaches.push({
          key,
          month: '1970-01', // Old date to ensure it gets removed
          timestamp: 0
        });
        continue;
      }

      allCaches.push({
        key,
        month: cacheEntry.month,
        timestamp: cacheEntry.timestamp
      });
    }

    // Sort by month (newest first)
    allCaches.sort((a, b) => b.month.localeCompare(a.month));

    // Remove everything except the newest N months
    const toRemove = allCaches.slice(keepMonths);
    toRemove.forEach(cache => localStorage.removeItem(cache.key));

    console.log(`Cleared ${toRemove.length} oldest cache entries, keeping ${keepMonths} most recent months`);
  };

  /**
   * Clear old caches to free up space
   * Removes non-permanent caches older than 60 days
   */
  const clearOldCaches = (): void => {
    const now = new Date();
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith('obs:') && !key?.startsWith('stats:')) continue;

      const cacheEntry = readCacheEntry(key);
      if (!cacheEntry) continue;

      // Don't remove permanent caches
      if (cacheEntry.permanent) continue;

      // Remove if older than 60 days
      const daysSinceCache = (now.getTime() - cacheEntry.timestamp) / (1000 * 60 * 60 * 24);
      if (daysSinceCache > 60) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`Cleared ${keysToRemove.length} old cache entries`);
  };

  /**
   * Get cache statistics
   */
  const getCacheStats = () => {
    let obsMonths = 0;
    let statsMonths = 0;
    let totalSize = 0;
    let permanentCount = 0;
    const months: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith('obs:') && !key?.startsWith('stats:')) continue;

      const storedItem = localStorage.getItem(key);
      if (!storedItem) continue;

      const cacheEntry = readCacheEntry(key);
      if (!cacheEntry) continue;

      if (key.startsWith('obs:')) {
        obsMonths++;
      } else if (key.startsWith('stats:')) {
        statsMonths++;
      }

      if (cacheEntry.permanent) {
        permanentCount++;
      }

      totalSize += storedItem.length;
      months.push(cacheEntry.month);
    }

    const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
    const sortedMonths = months.sort();

    return {
      obsMonths,
      statsMonths,
      permanentCount,
      totalSizeMB: parseFloat(totalSizeMB),
      oldestMonth: sortedMonths[0] || null,
      newestMonth: sortedMonths[sortedMonths.length - 1] || null
    };
  };

  return {
    // Core month-based functions
    getMonthKey,
    getStoredDataForMonth,
    setStoredDataForMonth,
    isMonthDataFresh,
    clearCacheForMonth,
    getMonthTTL,

    // Cache management
    clearAllCache,
    clearOldCaches,
    clearNonPermanentCaches,
    clearOldestCaches,
    getCacheStats
  };
}