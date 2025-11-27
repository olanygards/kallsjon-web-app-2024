import { useState } from 'react';
import { useWindCache } from './useWindCache';
import { WindData } from '../types/WindData';

/**
 * Cache manager hook for user-facing cache controls
 * Provides functions to clear cache, get stats, and manage cache behavior
 */
export function useCacheManager() {
    const windCache = useWindCache<WindData>();

    // Session flag to ignore cache (useful for debugging)
    const [ignoreCache, setIgnoreCache] = useState(false);

    /**
     * Clear cache for a specific month
     * @param date - Date within the month to clear
     * @param type - 'obs' for observations, 'stats' for statistics
     * @param minForce - For stats type, the minForce filter value (default: 10)
     */
    const clearMonth = (
        date: Date,
        type: 'obs' | 'stats' = 'obs',
        minForce: number = 10
    ): void => {
        const force = type === 'stats' ? minForce : 0;
        windCache.clearCacheForMonth(date, force);
    };

    /**
     * Clear cache for an entire year
     * Removes all month entries within that year
     * @param year - Year to clear (e.g. 2024)
     * @param type - 'obs' for observations, 'stats' for statistics
     */
    const clearYear = (
        year: number,
        type: 'obs' | 'stats' = 'stats'
    ): void => {
        const prefix = type === 'stats' ? `stats:${year}` : `obs:${year}`;

        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith(prefix)) {
                keysToRemove.push(key);
            }
        }

        keysToRemove.forEach(key => localStorage.removeItem(key));
        console.log(`Cleared ${keysToRemove.length} cache entries for ${type}:${year}`);
    };

    /**
     * Clear all cache (both obs: and stats:)
     */
    const clearAll = (): void => {
        windCache.clearAllCache();
    };

    /**
     * Get cache statistics
     * Returns info about cached months, storage usage, etc.
     */
    const getCacheStats = () => {
        return windCache.getCacheStats();
    };

    /**
     * Clear old non-permanent caches to free up space
     */
    const clearOldCaches = (): void => {
        windCache.clearOldCaches();
    };

    /**
     * Check if a specific month is cached
     * @param date - Date within the month to check
     * @param minForce - Optional minForce filter (0 = observations, >0 = stats)
     */
    const isMonthCached = (date: Date, minForce: number = 0): boolean => {
        return windCache.isMonthDataFresh(date, minForce);
    };

    /**
     * Get a formatted cache key for display purposes
     * @param date - Date within the month
     * @param minForce - Optional minForce filter
     */
    const getDisplayKey = (date: Date, minForce: number = 0): string => {
        return windCache.getMonthKey(date, minForce);
    };

    return {
        // Clear functions
        clearMonth,
        clearYear,
        clearAll,
        clearOldCaches,

        // Query functions
        getCacheStats,
        isMonthCached,
        getDisplayKey,

        // Dev/debug flags
        ignoreCache,
        setIgnoreCache
    };
}
