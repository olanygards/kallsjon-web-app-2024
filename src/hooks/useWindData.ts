import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { WindData } from '../types/WindData';

// Simple cache implementation
const windCache = {
  data: new Map<string, { data: WindData[]; timestamp: number }>(),
  maxAge: 5 * 60 * 1000, // 5 minutes for current data

  getKey(date: Date) {
    return date.toISOString().split('T')[0];
  },

  isDataFresh(date: Date) {
    const key = this.getKey(date);
    const cached = this.data.get(key);
    if (!cached) return false;
    return Date.now() - cached.timestamp < this.maxAge;
  },

  getData(date: Date) {
    const key = this.getKey(date);
    return this.data.get(key)?.data || [];
  },

  setData(date: Date, data: WindData[]) {
    const key = this.getKey(date);
    this.data.set(key, { data, timestamp: Date.now() });
  },

  clearData(date: Date) {
    const key = this.getKey(date);
    this.data.delete(key);
  }
};

export function useWindData({ startDate, endDate }: { startDate: Date; endDate: Date }) {
  const [data, setData] = useState<WindData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      if (!mounted) return;
      
      try {
        // Check cache first
        if (windCache.isDataFresh(startDate)) {
          const cachedData = windCache.getData(startDate);
          if (mounted) {
            setData(cachedData);
            setLoading(false);
          }
          return;
        }

        // Fetch from Firebase
        const windRef = collection(db, 'wind');
        const q = query(
          windRef,
          where('time', '>=', Timestamp.fromDate(startDate)),
          where('time', '<=', Timestamp.fromDate(endDate)),
          orderBy('time', 'asc')
        );

        const querySnapshot = await getDocs(q);
        if (!mounted) return;

        const windData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          windSpeed: doc.data().force,
          windDirection: doc.data().direction,
          windGust: doc.data().forceMax,
          time: doc.data().time?.toDate() || new Date(doc.data().time),
          isForecast: false
        }));

        // Update cache and state
        if (mounted) {
          windCache.setData(startDate, windData);
          setData(windData);
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error fetching wind data:', err);
        if (mounted) {
          setError(err as Error);
          setLoading(false);
        }
      }
    };

    setLoading(true);
    fetchData();

    return () => {
      mounted = false;
    };
  }, [startDate, endDate]);

  const clearCache = () => {
    windCache.clearData(startDate);
  };

  return { data, loading, error, clearCache };
}