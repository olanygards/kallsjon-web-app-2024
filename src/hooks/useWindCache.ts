import { useState, useEffect, useRef } from 'react';

interface CacheItem<T> {
  data: { [key: string]: T };
  timestamp: number;
  expiresIn: number;
  lastFetchedDate?: string; // Track the most recent date we have data for
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
      // This looks like an ISO date string
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
  key?: string;
  maxAge?: number; // in milliseconds, how fresh should recent data be
}

export function useWindCache<T>(
  options: WindCacheOptions = {}
) {
  const {
    expirationTime = 7 * 24 * 60 * 60 * 1000,
    key = 'windData',
    maxAge = 30 * 60 * 1000
  } = options;

  // Store static values in refs to prevent unnecessary effect re-runs
  const keyRef = useRef(key);
  const expirationTimeRef = useRef(expirationTime);
  const maxAgeRef = useRef(maxAge);

  // Get data from localStorage with smart expiration check
  const getStoredData = (): Map<number | null, T> => {
    try {
      const storedItem = localStorage.getItem(keyRef.current);
      if (!storedItem) return new Map();

      const cacheItem: CacheItem<T> = JSON.parse(storedItem);
      const { data, timestamp, expiresIn } = cacheItem;
      
      // Check if cache has completely expired
      if (Date.now() - timestamp > expirationTimeRef.current) {
        localStorage.removeItem(keyRef.current);
        return new Map();
      }

      // Convert the plain object back to a Map and revive dates
      return new Map(
        Object.entries(data).map(([k, v]) => [
          k === 'null' ? null : Number(k),
          reviveDates<T>(v)
        ])
      );
    } catch (error) {
      console.error('Error reading from cache:', error);
      return new Map();
    }
  };

  const [cachedData, setCachedData] = useState<Map<number | null, T>>(getStoredData);
  const [lastFetchedDate, setLastFetchedDate] = useState<string | undefined>(() => {
    try {
      const stored = localStorage.getItem(keyRef.current);
      return stored ? JSON.parse(stored).lastFetchedDate : undefined;
    } catch {
      return undefined;
    }
  });

  // Update localStorage when cachedData changes
  useEffect(() => {
    try {
      const mapData = Object.fromEntries(
        Array.from(cachedData.entries()).map(([k, v]) => [k === null ? 'null' : k, v])
      );

      const cacheItem: CacheItem<T> = {
        data: mapData,
        timestamp: Date.now(),
        expiresIn: expirationTimeRef.current,
        lastFetchedDate
      };

      localStorage.setItem(keyRef.current, JSON.stringify(cacheItem, (key, value) => {
        if (value instanceof Date) {
          return value.toISOString();
        }
        return value;
      }));
    } catch (error) {
      console.error('Error saving to cache:', error);
    }
  }, [cachedData, lastFetchedDate]); // Removed expirationTime and key from dependencies

  const isDataFresh = (date: Date): boolean => {
    if (!lastFetchedDate) return false;
    
    const dateStr = date.toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    if (dateStr === today || dateStr === yesterday) {
      return Date.now() - new Date(lastFetchedDate).getTime() < maxAgeRef.current;
    }
    
    return true;
  };

  const updateLastFetchedDate = () => {
    const now = new Date().toISOString();
    setLastFetchedDate(now);
  };

  return {
    cachedData,
    setCachedData,
    isDataFresh,
    updateLastFetchedDate,
    clearCache: () => {
      localStorage.removeItem(keyRef.current);
      setCachedData(new Map());
      setLastFetchedDate(undefined);
    }
  };
} 