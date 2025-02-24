import { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { WindData } from '../types/WindData';

interface UseWindDataProps {
  startDate: Date;
  endDate: Date;
}

const CACHE_TIME = 5 * 60 * 1000; // 5 minuter
const cache = new Map<string, {data: WindData[], timestamp: number}>();

export function useWindData({ startDate, endDate }: UseWindDataProps) {
  const [data, setData] = useState<WindData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isEmpty, setIsEmpty] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    // Reset mount ref on mount
    isMountedRef.current = true;

    async function fetchData() {
      try {
        if (!isMountedRef.current) return;

        const cacheKey = `${startDate.getTime()}-${endDate.getTime()}`;
        const cachedData = cache.get(cacheKey);

        // Check cache inside the effect
        if (cachedData && Date.now() - cachedData.timestamp < CACHE_TIME) {
          setData(cachedData.data);
          setLoading(false);
          setIsEmpty(false);
          return;
        }

        setLoading(true);
        setError(null);
        
        const windRef = collection(db, 'wind');
        const q = query(
          windRef,
          where('time', '>=', Timestamp.fromDate(startDate)),
          where('time', '<=', Timestamp.fromDate(endDate)),
          orderBy('time', 'asc')
        );

        const querySnapshot = await getDocs(q);
        
        if (!isMountedRef.current) return;

        const windData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          windSpeed: doc.data().force,
          windDirection: doc.data().direction,
          windGust: doc.data().forceMax,
          time: doc.data().time?.toDate() || new Date(doc.data().time),
          isForecast: false
        } as WindData));

        setData(windData);
        setIsEmpty(windData.length === 0);
        cache.set(cacheKey, { data: windData, timestamp: Date.now() });
      } catch (err: unknown) {
        if (!isMountedRef.current) return;
        setError(err instanceof Error ? err : new Error('An unknown error occurred'));
        console.error('Error fetching wind data:', err);
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      isMountedRef.current = false;
    };
  }, [startDate, endDate]);

  return { 
    data, 
    loading, 
    error,
    isEmpty
  };
}