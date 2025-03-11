import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { format } from 'date-fns';

// More detailed type to include wind speed
export interface WindyDay {
  date: Date;
  maxWindSpeed: number;
}

// Wind speed map type
export type WindSpeedMap = Map<string, number>;

// Cache for windy days to avoid excessive Firebase queries
const windyDaysCache = {
  data: new Map<string, { dates: WindyDay[]; timestamp: number }>(),
  maxAge: 24 * 60 * 60 * 1000, // 24 hours cache time

  getKey(minForce: number = 10, year: number) {
    return `windy_days_${minForce}_${year}`;
  },

  isDataFresh(minForce: number = 10, year: number) {
    const key = this.getKey(minForce, year);
    const cached = this.data.get(key);
    if (!cached) return false;
    return Date.now() - cached.timestamp < this.maxAge;
  },

  getData(minForce: number = 10, year: number) {
    const key = this.getKey(minForce, year);
    return this.data.get(key)?.dates || [];
  },

  setData(dates: WindyDay[], minForce: number = 10, year: number) {
    const key = this.getKey(minForce, year);
    this.data.set(key, { dates, timestamp: Date.now() });
  }
};

interface UseWindyDaysProps {
  minForce?: number;
  year?: number;
}

export function useWindyDays({ minForce = 10, year = new Date().getFullYear() }: UseWindyDaysProps = {}) {
  const [windyDays, setWindyDays] = useState<WindyDay[]>([]);
  const [windSpeedMap, setWindSpeedMap] = useState<WindSpeedMap>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchWindyDays = async () => {
      if (!mounted) return;
      
      try {
        // Check cache first
        if (windyDaysCache.isDataFresh(minForce, year)) {
          const cachedDates = windyDaysCache.getData(minForce, year);
          if (mounted) {
            setWindyDays(cachedDates);
            
            // Also create and set the wind speed map
            const newMap = new Map<string, number>();
            cachedDates.forEach(day => {
              newMap.set(format(day.date, 'yyyy-MM-dd'), day.maxWindSpeed);
            });
            setWindSpeedMap(newMap);
            
            setLoading(false);
          }
          return;
        }

        // Setup date range for the year
        const startDate = new Date(year, 0, 1); // January 1st
        const endDate = new Date(year, 11, 31, 23, 59, 59); // December 31st
        
        // Fetch from Firebase
        const windRef = collection(db, 'wind');
        const windQuery = query(
          windRef,
          where('time', '>=', Timestamp.fromDate(startDate)),
          where('time', '<=', Timestamp.fromDate(endDate)),
          where('force', '>=', minForce),
          orderBy('time', 'asc')
        );

        const querySnapshot = await getDocs(windQuery);
        
        if (!mounted) return;

        // Process the data to get unique dates with wind over threshold
        const daysMap = new Map<string, WindyDay>();
        
        querySnapshot.forEach(doc => {
          const data = doc.data();
          const date = data.time?.toDate();
          if (date) {
            const dateString = format(date, 'yyyy-MM-dd');
            const windSpeed = data.force || 0;
            
            // If we haven't seen this date yet, or this entry has a higher wind speed
            if (!daysMap.has(dateString) || windSpeed > daysMap.get(dateString)!.maxWindSpeed) {
              daysMap.set(dateString, { 
                date: new Date(dateString), 
                maxWindSpeed: windSpeed 
              });
            }
          }
        });

        const uniqueWindyDays = Array.from(daysMap.values());
        
        // Create wind speed map for easy lookup
        const newSpeedMap = new Map<string, number>();
        uniqueWindyDays.forEach(day => {
          newSpeedMap.set(format(day.date, 'yyyy-MM-dd'), day.maxWindSpeed);
        });
        
        // Update cache and state
        if (mounted) {
          windyDaysCache.setData(uniqueWindyDays, minForce, year);
          setWindyDays(uniqueWindyDays);
          setWindSpeedMap(newSpeedMap);
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error fetching windy days:', err);
        if (mounted) {
          setError(err as Error);
          setLoading(false);
        }
      }
    };

    setLoading(true);
    fetchWindyDays();

    return () => {
      mounted = false;
    };
  }, [minForce, year]);

  return { windyDays, windSpeedMap, loading, error };
} 