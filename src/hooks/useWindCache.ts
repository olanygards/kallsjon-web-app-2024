import { useRef } from 'react';
import { format } from 'date-fns';

interface CacheItem<T> {
  data: T[];
  timestamp: number;
  expiresIn: number;
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
  expirationTime?: number; // in milliseconds, default 7 days for historical data
  baseKey?: string;
  maxAge?: number; // in milliseconds, how fresh should recent data be
}

export function useWindCache<T>(
  options: WindCacheOptions = {}
) {
  const {
    expirationTime = 7 * 24 * 60 * 60 * 1000, // 7 days
    baseKey = 'windData',
    maxAge = 30 * 60 * 1000 // 30 minutes
  } = options;

  const keyRef = useRef(baseKey);
  const expirationTimeRef = useRef(expirationTime);
  const maxAgeRef = useRef(maxAge);

  // Get data for a specific date from localStorage
  const getStoredDataForDate = (date: Date): T[] => {
    try {
      const dateKey = `${keyRef.current}-${format(date, 'yyyy-MM-dd')}`;
      const storedItem = localStorage.getItem(dateKey);
      
      if (!storedItem) return [];

      const cacheItem: CacheItem<T> = JSON.parse(storedItem);
      const { data, timestamp } = cacheItem;
      
      // Check if this day's cache has expired
      if (Date.now() - timestamp > expirationTimeRef.current) {
        localStorage.removeItem(dateKey);
        return [];
      }

      return reviveDates<T[]>(data);
    } catch (error) {
      console.error('Error reading from cache:', error);
      return [];
    }
  };

  // Store data for a specific date
  const setStoredDataForDate = (date: Date, data: T[]) => {
    try {
      const dateKey = `${keyRef.current}-${format(date, 'yyyy-MM-dd')}`;
      const cacheItem: CacheItem<T> = {
        data,
        timestamp: Date.now(),
        expiresIn: expirationTimeRef.current
      };

      localStorage.setItem(dateKey, JSON.stringify(cacheItem, (_k, value) => {
        if (value instanceof Date) {
          return value.toISOString();
        }
        return value;
      }));
    } catch (error) {
      console.error('Error saving to cache:', error);
    }
  };

  // Check if data for a specific date is fresh
  const isDataFreshForDate = (date: Date): boolean => {
    try {
      const dateKey = `${keyRef.current}-${format(date, 'yyyy-MM-dd')}`;
      const storedItem = localStorage.getItem(dateKey);
      
      if (!storedItem) return false;

      const cacheItem: CacheItem<T> = JSON.parse(storedItem);
      const { timestamp } = cacheItem;

      const dateStr = format(date, 'yyyy-MM-dd');
      const today = format(new Date(), 'yyyy-MM-dd');
      const yesterday = format(new Date(Date.now() - 24 * 60 * 60 * 1000), 'yyyy-MM-dd');

      // For today or yesterday, check if data is within maxAge
      if (dateStr === today || dateStr === yesterday) {
        return Date.now() - timestamp < maxAgeRef.current;
      }

      // For older dates, check if cache hasn't expired
      return Date.now() - timestamp < expirationTimeRef.current;
    } catch (error) {
      console.error('Error checking cache freshness:', error);
      return false;
    }
  };

  // Clear cache for a specific date
  const clearCacheForDate = (date: Date) => {
    const dateKey = `${keyRef.current}-${format(date, 'yyyy-MM-dd')}`;
    localStorage.removeItem(dateKey);
  };

  // Clear all cached data
  const clearAllCache = () => {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(keyRef.current)) {
        localStorage.removeItem(key);
      }
    }
  };

  return {
    getStoredDataForDate,
    setStoredDataForDate,
    isDataFreshForDate,
    clearCacheForDate,
    clearAllCache
  };
} 