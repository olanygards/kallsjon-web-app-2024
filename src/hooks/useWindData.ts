import { useState, useEffect, useContext, createContext } from 'react';
import { collection, query, where, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { WindData } from '../types/WindData';
import { useWindCache } from './useWindCache';
import { eachMonthOfInterval, startOfMonth, endOfMonth } from 'date-fns';

// Context for ignore cache flag (from useCacheManager)
const IgnoreCacheContext = createContext(false);
export const IgnoreCacheProvider = IgnoreCacheContext.Provider;

// L1 cache: In-memory for session speed
const memoryCache = {
  data: new Map<string, { data: WindData[]; timestamp: number }>(),
  maxAge: 5 * 60 * 1000, // 5 minutes

  getKey(startDate: Date, endDate: Date, minForce: number = 0) {
    return `${startDate.toISOString()}_${endDate.toISOString()}_force${minForce}`;
  },

  isDataFresh(startDate: Date, endDate: Date, minForce: number = 0, maxAge: number = 5 * 60 * 1000) {
    const key = this.getKey(startDate, endDate, minForce);
    const cached = this.data.get(key);
    if (!cached) return false;
    return Date.now() - cached.timestamp < maxAge;
  },

  getData(startDate: Date, endDate: Date, minForce: number = 0) {
    const key = this.getKey(startDate, endDate, minForce);
    return this.data.get(key)?.data || [];
  },

  setData(startDate: Date, endDate: Date, data: WindData[], minForce: number = 0) {
    const key = this.getKey(startDate, endDate, minForce);
    this.data.set(key, { data, timestamp: Date.now() });
  },

  clearData(startDate: Date, endDate: Date, minForce: number = 0) {
    const key = this.getKey(startDate, endDate, minForce);
    this.data.delete(key);
  },

  clearAll() {
    this.data.clear();
  }
};

export function useWindData({
  startDate,
  endDate,
  minForce = 0
}: {
  startDate: Date;
  endDate: Date;
  minForce?: number;
}) {
  const [data, setData] = useState<WindData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // L2 cache: localStorage per month
  // Hook results are stable between renders, so it's safe to omit from dependency array
  const windCache = useWindCache<WindData>();

  // Check if we should ignore cache (from context, set by useCacheManager)
  const ignoreCacheFlag = useContext(IgnoreCacheContext);

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      if (!mounted) return;

      try {
        // If ignore cache flag is set, skip all caching
        if (ignoreCacheFlag) {
          console.log('Ignoring cache (session flag enabled)');
          await fetchFromFirebase();
          return;
        }

        // L1 cache check: In-memory (fastest)
        // Use very short cache (30 sec) for live data (last 1 hour), 1 min for recent (7 days), 5 min for historical
        const now = new Date().getTime();
        const oneHourAgo = now - (60 * 60 * 1000);
        const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);

        const isLiveData = endDate.getTime() >= oneHourAgo; // Last 1 hour
        const isRecentData = endDate.getTime() >= sevenDaysAgo; // Last 7 days

        let maxAge: number;
        if (isLiveData) {
          maxAge = 30 * 1000; // 30 seconds for live data
        } else if (isRecentData) {
          maxAge = 1 * 60 * 1000; // 1 minute for recent data
        } else {
          maxAge = 5 * 60 * 1000; // 5 minutes for historical data
        }

        if (memoryCache.isDataFresh(startDate, endDate, minForce, maxAge)) {
          const cachedData = memoryCache.getData(startDate, endDate, minForce);
          if (mounted && cachedData.length > 0) {
            console.log(`L1 cache hit (memory) - ${isLiveData ? '30sec' : isRecentData ? '1min' : '5min'} cache`);
            setData(cachedData);
            setLoading(false);
            return;
          }
        }

        // L2 cache check: localStorage per month
        // BUT: Skip L2 for live data if L1 is expired (to ensure freshest data)

        // If this is live data and L1 cache is not fresh, skip L2 and fetch from Firebase
        const skipL2ForLiveData = isLiveData && !memoryCache.isDataFresh(startDate, endDate, minForce, 30 * 1000);

        if (!skipL2ForLiveData) {
          const monthsInRange = eachMonthOfInterval({ start: startDate, end: endDate });
          const cachedMonths: WindData[] = [];
          const monthsToFetch: Date[] = [];

          for (const month of monthsInRange) {
            if (windCache.isMonthDataFresh(month, minForce)) {
              const monthData = windCache.getStoredDataForMonth(month, minForce);
              if (monthData.length > 0) {
                cachedMonths.push(...monthData);
              } else {
                monthsToFetch.push(month);
              }
            } else {
              monthsToFetch.push(month);
            }
          }

          // If we have all months cached, use them
          if (monthsToFetch.length === 0 && cachedMonths.length > 0) {
            console.log('L2 cache hit (localStorage) - all months cached');

            // Filter to exact date range
            const filteredData = cachedMonths.filter(d =>
              d.time >= startDate && d.time <= endDate
            );

            if (mounted) {
              setData(filteredData);
              setLoading(false);

              // Update L1 cache
              memoryCache.setData(startDate, endDate, filteredData, minForce);
            }
            return;
          }

          // Partial cache hit: use cached months + fetch missing ones
          if (monthsToFetch.length < monthsInRange.length) {
            console.log(`Partial L2 cache hit - ${monthsInRange.length - monthsToFetch.length}/${monthsInRange.length} months cached`);
          }

          // Fetch missing months from Firebase
          const fetchedData: WindData[] = [];

          for (const month of monthsToFetch) {
            const monthStart = startOfMonth(month);
            const monthEnd = endOfMonth(month);

            const monthData = await fetchFromFirebaseForMonth(monthStart, monthEnd, minForce);

            if (monthData.length > 0) {
              fetchedData.push(...monthData);

              // Cache this month in L2
              windCache.setStoredDataForMonth(month, monthData, minForce);
            } else {
              // Even if empty, cache it to avoid re-fetching
              windCache.setStoredDataForMonth(month, [], minForce);
            }
          }

          // Combine cached + fetched data
          const allData = [...cachedMonths, ...fetchedData];

          // Filter to exact date range and sort
          const filteredData = allData
            .filter(d => d.time >= startDate && d.time <= endDate)
            .sort((a, b) => a.time.getTime() - b.time.getTime());

          if (mounted) {
            setData(filteredData);
            setError(null);
            setLoading(false);

            // Update L1 cache
            memoryCache.setData(startDate, endDate, filteredData, minForce);
          }
        } else {
          // Skip L2 for live data - fetch directly from Firebase
          console.debug('Skipping L2 cache for live data - fetching from Firebase');
          await fetchFromFirebase();
        }
      } catch (err) {
        console.error('Error fetching wind data:', err);
        if (mounted) {
          setError(err as Error);
          setLoading(false);
        }
      }
    };

    /**
     * Fetch data for a specific month from Firebase
     */
    async function fetchFromFirebaseForMonth(
      monthStart: Date,
      monthEnd: Date,
      minForce: number
    ): Promise<WindData[]> {
      const windRef = collection(db, 'wind');
      const startTimestamp = Timestamp.fromDate(monthStart);
      const endTimestamp = Timestamp.fromDate(monthEnd);

      let q;
      if (minForce > 0) {
        q = query(
          windRef,
          where('time', '>=', startTimestamp),
          where('time', '<=', endTimestamp),
          where('force', '>=', minForce),
          orderBy('time', 'asc')
        );
      } else {
        q = query(
          windRef,
          where('time', '>=', startTimestamp),
          where('time', '<=', endTimestamp),
          orderBy('time', 'asc')
        );
      }

      const querySnapshot = await getDocs(q);

      const windData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          windSpeed: data.force || 0,
          windDirection: data.direction || 0,
          windGust: data.forceMax || data.force || 0,
          time: data.time?.toDate() || new Date(data.time),
          isForecast: false
        };
      });

      return windData;
    }

    /**
     * Fetch all data directly from Firebase (fallback, no caching)
     */
    async function fetchFromFirebase() {
      const windRef = collection(db, 'wind');
      const startTimestamp = Timestamp.fromDate(startDate);
      const endTimestamp = Timestamp.fromDate(endDate);

      let q;
      if (minForce > 0) {
        q = query(
          windRef,
          where('time', '>=', startTimestamp),
          where('time', '<=', endTimestamp),
          where('force', '>=', minForce),
          orderBy('time', 'asc')
        );
      } else {
        q = query(
          windRef,
          where('time', '>=', startTimestamp),
          where('time', '<=', endTimestamp),
          orderBy('time', 'asc')
        );
      }

      const querySnapshot = await getDocs(q);

      const windData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          windSpeed: data.force || 0,
          windDirection: data.direction || 0,
          windGust: data.forceMax || data.force || 0,
          time: data.time?.toDate() || new Date(data.time),
          isForecast: false
        };
      });

      if (mounted) {
        setData(windData);
        setError(null);
        setLoading(false);
      }
    }

    // Only show loading on initial load, not on background updates
    if (data.length === 0) {
      setLoading(true);
    }
    fetchData();

    return () => {
      mounted = false;
    };
    // Removed windCache from dependencies - it's a stable hook result wrapped in useMemo
  }, [startDate.getTime(), endDate.getTime(), minForce, ignoreCacheFlag]);

  const clearCache = () => {
    memoryCache.clearData(startDate, endDate, minForce);
    const monthsInRange = eachMonthOfInterval({ start: startDate, end: endDate });
    monthsInRange.forEach(month => {
      windCache.clearCacheForMonth(month, minForce);
    });
  };

  return { data, loading, error, clearCache };
}