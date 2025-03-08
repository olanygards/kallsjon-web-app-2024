import { useState, useEffect } from 'react';
import { isWithinInterval } from 'date-fns';
import { WindData } from '../types/WindData';

const FORECAST_URL = 'https://opendata-download-metfcst.smhi.se/api/category/pmp3g/version/2/geotype/point/lon/13.8/lat/63.3/data.json';
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

// Global cache
const forecastCache = {
  data: null as WindData[] | null,
  timestamp: 0,
  pendingPromise: null as Promise<WindData[]> | null
};

export function useForecast({ startDate, endDate }: { startDate: Date; endDate: Date }) {
  const [data, setData] = useState<WindData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        // Use cache if valid
        if (forecastCache.data && Date.now() - forecastCache.timestamp < CACHE_DURATION) {
          const filteredData = forecastCache.data.filter(item =>
            isWithinInterval(item.time, { start: startDate, end: endDate })
          );
          if (mounted) {
            setData(filteredData);
            setLoading(false);
          }
          return;
        }

        // Wait for pending request if exists
        if (forecastCache.pendingPromise) {
          const result = await forecastCache.pendingPromise;
          if (mounted) {
            const filteredData = result.filter(item =>
              isWithinInterval(item.time, { start: startDate, end: endDate })
            );
            setData(filteredData);
            setLoading(false);
          }
          return;
        }

        // Make new request
        forecastCache.pendingPromise = fetch(FORECAST_URL)
          .then(response => {
            if (!response.ok) throw new Error('Failed to fetch forecast');
            return response.json();
          })
          .then(json => {
            if (!json.timeSeries) throw new Error('Invalid forecast data');
            
            const processedData = json.timeSeries.map((item: any) => ({
              time: new Date(item.validTime),
              windSpeed: item.parameters.find((p: any) => p.name === 'ws')?.values[0] ?? 0,
              windGust: item.parameters.find((p: any) => p.name === 'gust')?.values[0] ?? 0,
              windDirection: item.parameters.find((p: any) => p.name === 'wd')?.values[0] ?? 0,
              isForecast: true
            }));

            forecastCache.data = processedData;
            forecastCache.timestamp = Date.now();
            return processedData;
          })
          .finally(() => {
            forecastCache.pendingPromise = null;
          });

        const result = await forecastCache.pendingPromise;
        if (mounted) {
          const filteredData = result.filter(item =>
            isWithinInterval(item.time, { start: startDate, end: endDate })
          );
          setData(filteredData);
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        console.error('Forecast error:', err);
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

  return { data, loading, error };
}