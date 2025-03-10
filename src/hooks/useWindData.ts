import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { WindData } from '../types/WindData';

// Simple cache implementation
const windCache = {
  data: new Map<string, { data: WindData[]; timestamp: number }>(),
  maxAge: 5 * 60 * 1000, // 5 minutes for current data

  getKey(date: Date, minForce: number = 0) {
    return `${date.toISOString().split('T')[0]}_force${minForce}`;
  },

  isDataFresh(date: Date, minForce: number = 0) {
    const key = this.getKey(date, minForce);
    const cached = this.data.get(key);
    if (!cached) return false;
    return Date.now() - cached.timestamp < this.maxAge;
  },

  getData(date: Date, minForce: number = 0) {
    const key = this.getKey(date, minForce);
    return this.data.get(key)?.data || [];
  },

  setData(date: Date, data: WindData[], minForce: number = 0) {
    const key = this.getKey(date, minForce);
    this.data.set(key, { data, timestamp: Date.now() });
  },

  clearData(date: Date, minForce: number = 0) {
    const key = this.getKey(date, minForce);
    this.data.delete(key);
  }
};

export function useWindData({ 
  startDate, 
  endDate, 
  minForce = 0 // Add optional parameter with default of 0 (no filtering)
}: { 
  startDate: Date; 
  endDate: Date; 
  minForce?: number; 
}) {
  const [data, setData] = useState<WindData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      if (!mounted) return;
      
      try {
        // Check cache first
        if (windCache.isDataFresh(startDate, minForce)) {
          const cachedData = windCache.getData(startDate, minForce);
          if (mounted) {
            setData(cachedData);
            setLoading(false);
          }
          return;
        }

        // Fetch from Firebase - note: field name is 'force' in Firestore, not 'windSpeed'
        const windRef = collection(db, 'wind');
        // Log the start and end dates with timestamps
        const startTimestamp = Timestamp.fromDate(startDate);
        const endTimestamp = Timestamp.fromDate(endDate);
        
        
        // Create the query based on whether filtering by force is needed
        let q;
        if (minForce > 0) {
          // Filter by minimum force/wind speed if specified
          q = query(
            windRef,
            where('time', '>=', startTimestamp),
            where('time', '<=', endTimestamp),
            where('force', '>=', minForce),
            orderBy('time', 'asc')
          );
          
        } else {
          // No force/wind speed filter
          q = query(
            windRef,
            where('time', '>=', startTimestamp),
            where('time', '<=', endTimestamp),
            orderBy('time', 'asc')
          );
          
        }

        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.size > 0) {
          const sampleDoc = querySnapshot.docs[0].data();
          console.log('Sample document structure:', {
            time: sampleDoc.time,
            force: sampleDoc.force,
            forceMax: sampleDoc.forceMax,
            direction: sampleDoc.direction
          });
        }

        if (!mounted) return;

        // Map fields from Firebase schema to our application schema
        const windData = querySnapshot.docs
          .map(doc => {
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

        // Update cache and state
        if (mounted) {
          windCache.setData(startDate, windData, minForce);
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
  }, [startDate, endDate, minForce]);

  const clearCache = () => {
    windCache.clearData(startDate, minForce);
  };

  return { data, loading, error, clearCache };
}