import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { WindData } from '../types/WindData';

interface UseWindDataProps {
  startDate: Date;
  endDate: Date;
}

export function useWindData({ startDate, endDate }: UseWindDataProps) {
  const [data, setData] = useState<WindData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      try {
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
        
        if (!isMounted) return;

        const windData = querySnapshot.docs
          .map(doc => ({
            id: doc.id,
            windSpeed: doc.data().force,
            windDirection: doc.data().direction,
            windGust: doc.data().forceMax,
            time: doc.data().time?.toDate() || new Date(doc.data().time),
          } as WindData))
          .filter(data => 
            data.time && 
            !isNaN(data.time.getTime()) && 
            typeof data.windSpeed === 'number' && 
            typeof data.windDirection === 'number'
          );

        setData(windData);
      } catch (err) {
        if (isMounted) {
          setError(err as Error);
          console.error('Error fetching wind data:', err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [startDate, endDate]);

  return { 
    data, 
    loading, 
    error,
    isEmpty: !loading && (!data || data.length === 0)
  };
}